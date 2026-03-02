const { app, BrowserWindow, ipcMain, dialog, protocol, shell, Notification, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { execSync } = require('child_process');
const youtubedl = require('youtube-dl-exec');
const NodeID3 = require('node-id3');

// Custom fetch for Spotify: use Electron's net.fetch (no CORS) with browser-like headers
const spotifyFetch = (url, opts = {}) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(opts.headers || {})
  };
  return net.fetch(url, { ...opts, headers });
};
const { getTracks, getDetails, getPreview, getData } = require('spotify-url-info')(spotifyFetch);

function sanitizeFilename(str) {
  if (!str || typeof str !== 'string') return 'Unknown';
  return str.replace(/[/\\:*?"<>|]/g, '').trim() || 'Unknown';
}

let mm;
async function getMM() {
    if (!mm) {
        mm = await import('music-metadata');
    }
    return mm;
}

// Prisma client will be initialized when app is ready
let prisma;
let mainWindow;

function initializePrisma() {
  const dbPath = path.join(app.getPath('userData'), 'music-tree.db');
  
  // Copy the initial database if it doesn't exist in userData
  const sourceDb = path.join(__dirname, '../prisma/music-tree.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(sourceDb)) {
    fs.copyFileSync(sourceDb, dbPath);
  }
  
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`
      }
    }
  });
  
  return prisma;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Register custom protocol as privileged so <audio> can stream from it (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'music-tree-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

function registerAudioProtocol() {
  if (typeof protocol.handle === 'function') {
    protocol.handle('music-tree-file', (request) => {
      try {
        console.log('[Protocol] Request URL:', request.url.slice(0, 100));
        const u = new URL(request.url);
        console.log('[Protocol] Parsed — host:', u.hostname, 'pathname:', u.pathname.slice(0, 60));
        const encoded = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        const filePath = Buffer.from(encoded, 'base64url').toString('utf-8');
        console.log('[Protocol] Decoded filePath:', filePath);

        if (!fs.existsSync(filePath)) {
          console.error('[Protocol] File NOT found on disk:', filePath);
          return new Response('Not Found', { status: 404 });
        }
        console.log('[Protocol] File exists, serving via net.fetch');
        const fileUrl = pathToFileURL(filePath).href;
        return net.fetch(fileUrl);
      } catch (e) {
        console.error('[Protocol] Handler error:', e);
        return new Response('Not Found', { status: 404 });
      }
    });
  } else {
    protocol.registerFileProtocol('music-tree-file', (request, callback) => {
      try {
        const u = new URL(request.url);
        const encoded = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        const filePath = Buffer.from(encoded, 'base64url').toString('utf-8');
        callback({ path: filePath });
      } catch (e) {
        callback({ error: -2 });
      }
    });
  }
}

app.whenReady().then(async () => {
  registerAudioProtocol();

  // Initialize Prisma with correct path
  initializePrisma();
  
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    // Ensure schema is in sync (e.g. new columns like downloadFolderPath)
    try {
      const userDbPath = path.join(app.getPath('userData'), 'music-tree.db');
      execSync('npx prisma db push', {
        env: { ...process.env, DATABASE_URL: `file:${userDbPath}` },
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
    } catch (pushErr) {
      // Ignore if already in sync
    }
    // Initialize default settings if they don't exist
    let settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      await prisma.settings.create({
        data: { id: 'default' }
      });
    }
  } catch (error) {
    // P2021 = table doesn't exist - run schema migration and retry
    if (error.code === 'P2021') {
      try {
        const dbPath = path.join(app.getPath('userData'), 'music-tree.db');
        const cwd = path.join(__dirname, '..');
        execSync('npx prisma db push', {
          env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
          stdio: 'pipe',
          cwd
        });
        console.log('Database schema applied successfully');
        await prisma.$connect();
        const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
        if (!settings) {
          await prisma.settings.create({ data: { id: 'default' } });
        }
      } catch (pushError) {
        console.error('Failed to apply database schema:', pushError);
        throw error;
      }
    } else {
      console.error('Database connection error:', error);
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC Handlers - Database Operations
// ============================================

// --- SONG OPERATIONS ---

// Get all songs
ipcMain.handle('get-all-songs', async () => {
  try {
    const songs = await prisma.song.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        connectionsFrom: {
          include: { targetSong: true }
        },
        connectionsTo: {
          include: { sourceSong: true }
        }
      }
    });
    return { success: true, data: songs };
  } catch (error) {
    console.error('Error fetching songs:', error);
    return { success: false, error: error.message };
  }
});

// Get single song with connections
ipcMain.handle('get-song', async (_, songId) => {
  try {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        connectionsFrom: {
          include: { targetSong: true }
        },
        connectionsTo: {
          include: { sourceSong: true }
        }
      }
    });
    return { success: true, data: song };
  } catch (error) {
    console.error('Error fetching song:', error);
    return { success: false, error: error.message };
  }
});

// Add new song
ipcMain.handle('add-new-song', async (_, songData) => {
  try {
    const song = await prisma.song.create({
      data: songData
    });
    return { success: true, data: song };
  } catch (error) {
    // Handle duplicate file path
    if (error.code === 'P2002') {
      return { success: false, error: 'Song already exists in library' };
    }
    console.error('Error adding song:', error);
    return { success: false, error: error.message };
  }
});

// Update song
ipcMain.handle('update-song', async (_, { id, data }) => {
  try {
    const song = await prisma.song.update({
      where: { id },
      data
    });
    return { success: true, data: song };
  } catch (error) {
    console.error('Error updating song:', error);
    return { success: false, error: error.message };
  }
});

// Delete song
ipcMain.handle('delete-song', async (_, songId) => {
  try {
    await prisma.song.delete({
      where: { id: songId }
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting song:', error);
    return { success: false, error: error.message };
  }
});

// --- PLAYLIST OPERATIONS ---

// Get all playlists
ipcMain.handle('get-all-playlists', async () => {
  try {
    const playlists = await prisma.playlist.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        songs: {
          include: { song: true },
          orderBy: { position: 'asc' }
        }
      }
    });
    return { success: true, data: playlists };
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return { success: false, error: error.message };
  }
});

// Create playlist
ipcMain.handle('create-playlist', async (_, name) => {
  try {
    const playlist = await prisma.playlist.create({
      data: { name },
      include: { songs: true }
    });
    return { success: true, data: playlist };
  } catch (error) {
    console.error('Error creating playlist:', error);
    return { success: false, error: error.message };
  }
});

// Add song to playlist
ipcMain.handle('add-song-to-playlist', async (_, { playlistId, songId }) => {
  try {
    // Get the highest position in the playlist
    const maxPosition = await prisma.playlistSong.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
      select: { position: true }
    });
    
    const position = maxPosition ? maxPosition.position + 1 : 0;
    
    const playlistSong = await prisma.playlistSong.create({
      data: { playlistId, songId, position },
      include: { song: true }
    });
    return { success: true, data: playlistSong };
  } catch (error) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Song already in playlist' };
    }
    console.error('Error adding song to playlist:', error);
    return { success: false, error: error.message };
  }
});

// Remove song from playlist
ipcMain.handle('remove-song-from-playlist', async (_, { playlistId, songId }) => {
  try {
    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: { playlistId, songId }
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error removing song from playlist:', error);
    return { success: false, error: error.message };
  }
});

// Delete playlist
ipcMain.handle('delete-playlist', async (_, playlistId) => {
  try {
    await prisma.playlist.delete({
      where: { id: playlistId }
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return { success: false, error: error.message };
  }
});

// --- CONNECTION OPERATIONS ---

// Add connection between songs
ipcMain.handle('add-connection', async (_, { sourceSongId, targetSongId, notes, bidirectional }) => {
  try {
    const connection = await prisma.songConnection.create({
      data: { sourceSongId, targetSongId, notes, bidirectional: bidirectional || false },
      include: { targetSong: true, sourceSong: true }
    });
    return { success: true, data: connection };
  } catch (error) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Connection already exists' };
    }
    console.error('Error adding connection:', error);
    return { success: false, error: error.message };
  }
});

// Remove connection
ipcMain.handle('remove-connection', async (_, connectionId) => {
  try {
    await prisma.songConnection.delete({
      where: { id: connectionId }
    });
    return { success: true };
  } catch (error) {
    console.error('Error removing connection:', error);
    return { success: false, error: error.message };
  }
});

// Get connections for a song
ipcMain.handle('get-song-connections', async (_, songId) => {
  try {
    const connections = await prisma.songConnection.findMany({
      where: {
        OR: [
          { sourceSongId: songId },
          { targetSongId: songId }
        ]
      },
      include: {
        sourceSong: true,
        targetSong: true
      }
    });
    return { success: true, data: connections };
  } catch (error) {
    console.error('Error fetching connections:', error);
    return { success: false, error: error.message };
  }
});

// --- SETTINGS OPERATIONS ---

// Get settings
ipcMain.handle('get-settings', async () => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' }
    });
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default' }
      });
    }
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return { success: false, error: error.message };
  }
});

// Update settings
ipcMain.handle('update-settings', async (_, data) => {
  try {
    const settings = await prisma.settings.update({
      where: { id: 'default' },
      data
    });
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
});

// --- FILE OPERATIONS ---

// Open file dialog to select MP3s
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aiff'] }
      ]
    });
    
    if (result.canceled) {
      return { success: true, data: [] };
    }
    
    return { success: true, data: result.filePaths };
  } catch (error) {
    console.error('Error opening file dialog:', error);
    return { success: false, error: error.message };
  }
});

// Open folder dialog to import playlist
ipcMain.handle('open-folder-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { success: true, data: null };
    }
    
    return { success: true, data: result.filePaths[0] };
  } catch (error) {
    console.error('Error opening folder dialog:', error);
    return { success: false, error: error.message };
  }
});

// Get a playable URL for a local audio file (uses custom protocol so renderer can play it)
ipcMain.handle('get-audio-url', (_, filePath) => {
  console.log('[get-audio-url] Requested for:', filePath);
  if (!filePath || typeof filePath !== 'string') {
    console.error('[get-audio-url] Invalid file path:', filePath);
    return { success: false, error: 'Invalid file path' };
  }
  const exists = fs.existsSync(filePath);
  console.log('[get-audio-url] File exists:', exists);
  // Base64url encoding avoids Chromium URL normalization issues (host lowercasing, etc.)
  const encoded = Buffer.from(filePath, 'utf-8').toString('base64url');
  const url = `music-tree-file://audio/${encoded}`;
  console.log('[get-audio-url] Generated URL:', url.slice(0, 80));
  return { success: true, data: url };
});

// Open a path in the system file manager
ipcMain.handle('open-path-in-folder', async (_, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: 'Folder does not exist' };
  }
  await shell.openPath(folderPath);
  return { success: true };
});

// Get default download folder (used when no custom path is set)
ipcMain.handle('get-default-download-path', () => {
  const defaultPath = path.join(app.getPath('userData'), 'downloads');
  return { success: true, data: defaultPath };
});

// Parse MP3 metadata
ipcMain.handle('parse-audio-metadata', async (_, filePath) => {
  try {
    const mm = await getMM();
    const metadata = await mm.parseFile(filePath);
    
    // Extract common metadata
    const title = metadata.common.title || path.basename(filePath, path.extname(filePath));
    const artist = metadata.common.artist || null;
    const duration = metadata.format.duration || null;
    
    // Try to extract BPM and Key from various sources
    // Rekordbox and other DJ software often store these in native tags
    let bpm = null;
    let key = null;
    
    // Check native tags for BPM
    if (metadata.native) {
      for (const format of Object.values(metadata.native)) {
        for (const tag of format) {
          // Check for BPM tags
          if (tag.id === 'TBPM' || tag.id === 'BPM' || tag.id === 'bpm') {
            bpm = parseFloat(tag.value);
          }
          // Check for key tags (TKEY is standard ID3v2)
          if (tag.id === 'TKEY' || tag.id === 'KEY' || tag.id === 'initialkey') {
            key = convertToCamelot(tag.value);
          }
        }
      }
    }
    
    // Fallback to common tags
    if (!bpm && metadata.common.bpm) {
      bpm = metadata.common.bpm;
    }
    
    return {
      success: true,
      data: {
        title,
        artist,
        bpm,
        key,
        duration,
        filePath,
        fileName: path.basename(filePath)
      }
    };
  } catch (error) {
    console.error('Error parsing audio metadata:', error);
    return { 
      success: false, 
      error: error.message,
      data: {
        title: path.basename(filePath, path.extname(filePath)),
        artist: null,
        bpm: null,
        key: null,
        duration: null,
        filePath,
        fileName: path.basename(filePath)
      }
    };
  }
});

// Get files from folder (for playlist import)
ipcMain.handle('get-folder-audio-files', async (_, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aiff'];
    const audioFiles = files
      .filter(file => audioExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => path.join(folderPath, file));
    
    return { success: true, data: audioFiles, folderName: path.basename(folderPath) };
  } catch (error) {
    console.error('Error reading folder:', error);
    return { success: false, error: error.message };
  }
});

// --- Download from Spotify/SoundCloud ---
// Uses youtube-dl-exec (bundles yt-dlp) + spotify-url-info - no Python required

function parseSpotifyTrack(t) {
  const track = t.track || t;
  const title = track.name || track.title || track.track;

  let artist = null;
  if (Array.isArray(track.artists) && track.artists.length > 0) {
    artist = track.artists.map(a => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(', ');
  }
  if (!artist && typeof track.artist === 'string') artist = track.artist;
  if (!artist && track.artist?.name) artist = track.artist.name;

  // Return even without artist — YouTube search can still work with title alone
  return title ? { title, artist: artist || null } : null;
}

function getSpotifyUrlType(url) {
  if (url.includes('/track/') || url.includes('spotify:track:')) return 'track';
  if (url.includes('/playlist/') || url.includes('spotify:playlist:')) return 'playlist';
  if (url.includes('/album/') || url.includes('spotify:album:')) return 'album';
  return 'unknown';
}

// Fallback: scrape Spotify oEmbed for basic title info
async function spotifyOEmbedFallback(url) {
  try {
    const res = await net.fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // oEmbed title for tracks is typically the song title
    return data.title ? { title: data.title, artist: null } : null;
  } catch { return null; }
}

// Extract artist from a "Artist - Title" or similar pattern
function parseArtistFromTitle(title) {
  if (!title) return { title, artist: null };
  const separators = [' - ', ' – ', ' — ', ' by '];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx > 0) {
      return { artist: title.slice(0, idx).trim(), title: title.slice(idx + sep.length).trim() };
    }
  }
  return { title, artist: null };
}

function sendDownloadProgress(data) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('download-progress', data);
  }
}

ipcMain.handle('download-from-url', async (_, { url, playlistName }) => {
  const logs = [];
  const push = (msg) => { logs.push(msg); sendDownloadProgress({ log: msg, logs: [...logs] }); };
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } }).catch(() => null);
    const baseDownloadPath = settings?.downloadFolderPath
      ? path.resolve(settings.downloadFolderPath)
      : path.join(app.getPath('userData'), 'downloads');
    const downloadsDir = path.join(baseDownloadPath, Date.now().toString());
    fs.mkdirSync(downloadsDir, { recursive: true });

    const isSpotify = url.includes('spotify.com') || url.includes('spotify:');
    const isSoundCloud = url.includes('soundcloud.com');

    if (!isSpotify && !isSoundCloud) {
      return { success: false, error: 'Unrecognized URL. Only Spotify and SoundCloud links are supported.', logs };
    }

    const defaultOutputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s').replace(/\\/g, '/');
    const baseYtdlOpts = {
      extractAudio: true,
      audioFormat: 'mp3',
      noWarnings: true,
      noCheckCertificates: true,
      addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0']
    };

    if (isSpotify) {
      push('Fetching Spotify track list...');
      let queries = [];

      // Strategy 1: getDetails (works for playlists, albums, and tracks)
      try {
        const details = await getDetails(url);
        let raw = details?.tracks ?? details;
        let trackList = Array.isArray(raw) ? raw : (raw?.items || raw?.tracks?.items || [raw]).flat();
        if (trackList.length === 0 && details?.preview) trackList = [details.preview];
        queries = trackList.map(parseSpotifyTrack).filter(Boolean);
        if (queries.length > 0) push(`getDetails returned ${queries.length} track(s).`);
      } catch (e) {
        push(`getDetails failed: ${e.message?.slice(0, 80)}`);
      }

      // Strategy 2: getTracks
      if (queries.length === 0) {
        try {
          push('Trying getTracks...');
          const trackList = await getTracks(url);
          queries = (trackList || []).map(parseSpotifyTrack).filter(Boolean);
          if (queries.length > 0) push(`getTracks returned ${queries.length} track(s).`);
        } catch (e) {
          push(`getTracks failed: ${e.message?.slice(0, 80)}`);
        }
      }

      // Strategy 3: getPreview (best for single tracks)
      if (queries.length === 0) {
        try {
          push('Trying getPreview...');
          const preview = await getPreview(url);
          if (preview?.title) {
            queries = [{ title: preview.title || preview.track, artist: preview.artist || null }];
            push(`getPreview returned: ${preview.artist || '?'} - ${preview.title}`);
          }
        } catch (e) {
          push(`getPreview failed: ${e.message?.slice(0, 80)}`);
        }
      }

      // Strategy 4: getData (raw scrape)
      if (queries.length === 0) {
        try {
          push('Trying getData...');
          const raw = await getData(url);
          if (raw?.name) {
            const parsed = parseSpotifyTrack(raw);
            if (parsed) queries = [parsed];
          }
        } catch (e) {
          push(`getData failed: ${e.message?.slice(0, 80)}`);
        }
      }

      // Strategy 5: oEmbed fallback (always available, no scraping)
      if (queries.length === 0 && getSpotifyUrlType(url) === 'track') {
        push('Trying Spotify oEmbed fallback...');
        const oembed = await spotifyOEmbedFallback(url);
        if (oembed) {
          queries = [oembed];
          push(`oEmbed returned title: ${oembed.title}`);
        }
      }

      if (queries.length === 0) {
        return { success: false, error: 'Could not parse any tracks from Spotify URL. Make sure the link is a valid playlist, album, or track.', logs };
      }
      push(`Found ${queries.length} track(s). Downloading from YouTube Music...`);
      sendDownloadProgress({ current: 0, total: queries.length, phase: 'download' });

      for (let i = 0; i < queries.length; i++) {
        const { title, artist } = queries[i];
        const searchQuery = artist
          ? `ytsearch1:${artist} - ${title}`
          : `ytsearch1:${title}`;
        sendDownloadProgress({ current: i, total: queries.length, phase: 'download' });
        const safeName = `${sanitizeFilename(artist ? `${artist} - ${title}` : title)}.mp3`;
        const trackOutputPath = path.join(downloadsDir, safeName);
        const ytdlOpts = { ...baseYtdlOpts, output: trackOutputPath.replace(/\\/g, '/') };
        try {
          push(`[${i + 1}/${queries.length}] ${artist || '?'} - ${title}`);
          await youtubedl(searchQuery, ytdlOpts, { timeout: 120000 });
          if (fs.existsSync(trackOutputPath)) {
            try {
              const tags = { title };
              if (artist) tags.artist = artist;
              NodeID3.write(tags, trackOutputPath);
            } catch (_) { /* non-fatal */ }
          }
        } catch (err) {
          push(`  Skip (not found): ${err.message?.slice(0, 80)}`);
        }
      }
      sendDownloadProgress({ current: queries.length, total: queries.length, phase: 'download' });
    } else {
      push('Downloading from SoundCloud...');
      const scOutput = path.join(downloadsDir, '%(title)s.%(ext)s').replace(/\\/g, '/');
      try {
        await youtubedl(url, { ...baseYtdlOpts, output: scOutput, writeInfoJson: true }, { timeout: 600000 });
      } catch (err) {
        if (!fs.readdirSync(downloadsDir).some(f => ['.mp3', '.m4a', '.ogg'].includes(path.extname(f).toLowerCase()))) {
          return { success: false, error: `SoundCloud download failed: ${err.message}`, logs };
        }
      }
    }

    const audioFiles = fs.readdirSync(downloadsDir).filter(f =>
      ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].includes(path.extname(f).toLowerCase())
    );

    if (audioFiles.length === 0) {
      return { success: false, error: 'No audio files were downloaded.', logs };
    }

    const result = { downloadsDir, audioFiles };
    push(`Downloaded ${result.audioFiles.length} file(s)`);
    sendDownloadProgress({ phase: 'importing', current: 0, total: result.audioFiles.length });

    // Create playlist
    const playlist = await prisma.playlist.create({
      data: { name: playlistName },
      include: { songs: true }
    });

    // Import each downloaded file
    let songCount = 0;
    for (const fileName of result.audioFiles) {
      const filePath = path.join(result.downloadsDir, fileName);
      try {
        // Parse metadata
        const mm = await getMM();
        const metadata = await mm.parseFile(filePath);
        let title = metadata.common.title || path.basename(filePath, path.extname(filePath));
        let artist = metadata.common.artist || null;

        // Failsafe chain for artist metadata
        if (!artist) {
          // Try yt-dlp info.json (SoundCloud sets uploader, artist, creator, channel)
          const baseName = path.basename(fileName, path.extname(fileName));
          const infoCandidates = [
            path.join(result.downloadsDir, baseName + '.info.json'),
            path.join(result.downloadsDir, fileName + '.info.json'),
          ];
          for (const infoPath of infoCandidates) {
            if (!artist && fs.existsSync(infoPath)) {
              try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                artist = info.artist || info.uploader || info.creator || info.channel || null;
                if (!artist && info.track && info.track !== title) {
                  // Sometimes yt-dlp puts "Artist - Title" in the track field
                  const parsed = parseArtistFromTitle(info.track);
                  if (parsed.artist) { artist = parsed.artist; title = parsed.title; }
                }
              } catch (_) { /* ignore parse errors */ }
            }
          }

          // Try parsing "Artist - Title" from the filename or metadata title
          if (!artist) {
            const parsed = parseArtistFromTitle(title);
            if (parsed.artist) { artist = parsed.artist; title = parsed.title; }
          }

          // Write recovered artist back into the MP3 ID3 tags
          if (artist) {
            try { NodeID3.write({ title, artist }, filePath); } catch (_) { /* non-fatal */ }
          }
        }
        const duration = metadata.format.duration || null;
        let bpm = null;
        let key = null;

        if (metadata.native) {
          for (const format of Object.values(metadata.native)) {
            for (const tag of format) {
              if (tag.id === 'TBPM' || tag.id === 'BPM' || tag.id === 'bpm') bpm = parseFloat(tag.value);
              if (tag.id === 'TKEY' || tag.id === 'KEY' || tag.id === 'initialkey') key = convertToCamelot(tag.value);
            }
          }
        }
        if (!bpm && metadata.common.bpm) bpm = metadata.common.bpm;

        // Add song to DB (skip if already exists by filePath)
        let song;
        try {
          song = await prisma.song.create({
            data: { title, artist, bpm, key, duration, filePath, fileName }
          });
        } catch (e) {
          if (e.code === 'P2002') {
            // Song with this filePath already exists
            song = await prisma.song.findUnique({ where: { filePath } });
          } else {
            throw e;
          }
        }

        if (song) {
          const maxPos = await prisma.playlistSong.findFirst({
            where: { playlistId: playlist.id },
            orderBy: { position: 'desc' },
            select: { position: true }
          });
          await prisma.playlistSong.create({
            data: { playlistId: playlist.id, songId: song.id, position: maxPos ? maxPos.position + 1 : 0 }
          });
          songCount++;
          sendDownloadProgress({ phase: 'importing', current: songCount, total: result.audioFiles.length });
        }
      } catch (parseErr) {
        push(`Warning: Failed to import ${fileName}: ${parseErr.message}`);
      }
    }

    push(`Imported ${songCount} song(s) into playlist "${playlistName}"`);

    if (songCount > 0 && mainWindow) {
      new Notification({
        title: 'Download complete',
        body: `Music Tree: ${songCount} song(s) added to "${playlistName}".`
      }).show();
    }

    return { success: true, songCount, logs, downloadsDir };
  } catch (error) {
    logs.push(`Error: ${error.message}`);
    return { success: false, error: error.message, logs };
  }
});

// --- BPM/Key Lookup via GetSongBPM API (optional, if API key is configured) ---

ipcMain.handle('lookup-song-metadata', async (_, { title, artist }) => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    const apiKey = settings?.getSongBpmApiKey;
    if (!apiKey) {
      // No API key — analysis is done locally in the renderer, so just return gracefully
      return { success: false, error: 'no-api-key' };
    }

    let searchUrl;
    if (artist) {
      searchUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=both&lookup=song:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}`;
    } else {
      searchUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=song&lookup=${encodeURIComponent(title)}`;
    }

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.search || searchData.search.length === 0) {
      return { success: false, error: 'Song not found in database' };
    }

    const match = searchData.search[0];
    const songRes = await fetch(`https://api.getsong.co/song/?api_key=${apiKey}&id=${match.id}`);
    const songData = await songRes.json();

    if (!songData.song) {
      return { success: false, error: 'Could not fetch song details' };
    }

    const bpm = songData.song.tempo ? parseInt(songData.song.tempo, 10) : null;
    const keyOf = songData.song.key_of || null;
    const camelotKey = keyOf ? convertToCamelot(keyOf) : null;

    return {
      success: true,
      data: { bpm, key: camelotKey, rawKey: keyOf, title: songData.song.title, artist: songData.song.artist?.name || null }
    };
  } catch (error) {
    console.error('Error looking up song metadata:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// Helper Functions
// ============================================

// Convert musical key to Camelot notation
function convertToCamelot(musicalKey) {
  if (!musicalKey) return null;
  
  // If already in Camelot notation
  if (/^(1[0-2]|[1-9])[AB]$/i.test(musicalKey)) {
    return musicalKey.toUpperCase();
  }
  
  // Mapping from musical keys to Camelot
  const camelotMap = {
    // Major keys (B)
    'C': '8B', 'C#': '3B', 'Db': '3B', 'D': '10B', 'D#': '5B', 'Eb': '5B',
    'E': '12B', 'F': '7B', 'F#': '2B', 'Gb': '2B', 'G': '9B',
    'G#': '4B', 'Ab': '4B', 'A': '11B', 'A#': '6B', 'Bb': '6B', 'B': '1B',
    // Minor keys (A)
    'Cm': '5A', 'C#m': '12A', 'Dbm': '12A', 'Dm': '7A', 'D#m': '2A', 'Ebm': '2A',
    'Em': '9A', 'Fm': '4A', 'F#m': '11A', 'Gbm': '11A', 'Gm': '6A',
    'G#m': '1A', 'Abm': '1A', 'Am': '8A', 'A#m': '3A', 'Bbm': '3A', 'Bm': '10A'
  };
  
  // Normalize the key string
  const normalized = musicalKey.trim().replace(/\s+/g, '').replace('min', 'm').replace('maj', '');
  
  return camelotMap[normalized] || musicalKey;
}
