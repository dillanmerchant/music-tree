const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const mm = require('music-metadata');
const fs = require('fs');
const { execFile } = require('child_process');

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

app.whenReady().then(async () => {
  // Initialize Prisma with correct path
  initializePrisma();
  
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    
    // Initialize default settings if they don't exist
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      await prisma.settings.create({
        data: { id: 'default' }
      });
    }
  } catch (error) {
    console.error('Database connection error:', error);
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

// Parse MP3 metadata
ipcMain.handle('parse-audio-metadata', async (_, filePath) => {
  try {
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

ipcMain.handle('download-from-url', async (_, { url, playlistName }) => {
  const logs = [];
  try {
    // Create a downloads directory in userData
    const downloadsDir = path.join(app.getPath('userData'), 'downloads', Date.now().toString());
    fs.mkdirSync(downloadsDir, { recursive: true });

    const isSpotify = url.includes('spotify.com') || url.includes('spotify:');
    const isSoundCloud = url.includes('soundcloud.com');

    if (!isSpotify && !isSoundCloud) {
      return { success: false, error: 'Unrecognized URL. Only Spotify and SoundCloud links are supported.', logs };
    }

    // Run the download command
    const result = await new Promise((resolve, reject) => {
      let command, args;

      if (isSpotify) {
        // spotdl: download to specific output directory
        command = 'spotdl';
        args = ['download', url, '--output', downloadsDir, '--format', 'mp3'];
      } else {
        // scdl: download to specific path
        command = 'scdl';
        args = ['-l', url, '--path', downloadsDir, '--onlymp3'];
      }

      logs.push(`Running: ${command} ${args.join(' ')}`);

      const child = execFile(command, args, {
        timeout: 600000, // 10 min timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
      }, (error, stdout, stderr) => {
        if (stdout) logs.push(...stdout.split('\n').filter(Boolean));
        if (stderr) logs.push(...stderr.split('\n').filter(Boolean));

        if (error) {
          // Some tools write to stderr but still succeed
          if (error.killed) {
            reject(new Error('Download timed out (10 min limit)'));
          } else {
            // Check if files were actually downloaded despite the "error"
            const files = fs.readdirSync(downloadsDir);
            const audioFiles = files.filter(f => ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].includes(path.extname(f).toLowerCase()));
            if (audioFiles.length > 0) {
              resolve({ downloadsDir, audioFiles });
            } else {
              reject(new Error(`${command} failed: ${error.message}. Make sure ${command} is installed (pip install ${isSpotify ? 'spotdl' : 'scdl'}).`));
            }
          }
        } else {
          const files = fs.readdirSync(downloadsDir);
          const audioFiles = files.filter(f => ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].includes(path.extname(f).toLowerCase()));
          resolve({ downloadsDir, audioFiles });
        }
      });
    });

    if (result.audioFiles.length === 0) {
      return { success: false, error: 'No audio files were downloaded.', logs };
    }

    logs.push(`Downloaded ${result.audioFiles.length} file(s)`);

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
        const metadata = await mm.parseFile(filePath);
        const title = metadata.common.title || path.basename(filePath, path.extname(filePath));
        const artist = metadata.common.artist || null;
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
          // Add to playlist
          const maxPos = await prisma.playlistSong.findFirst({
            where: { playlistId: playlist.id },
            orderBy: { position: 'desc' },
            select: { position: true }
          });
          await prisma.playlistSong.create({
            data: { playlistId: playlist.id, songId: song.id, position: maxPos ? maxPos.position + 1 : 0 }
          });
          songCount++;
        }
      } catch (parseErr) {
        logs.push(`Warning: Failed to import ${fileName}: ${parseErr.message}`);
      }
    }

    logs.push(`Imported ${songCount} song(s) into playlist "${playlistName}"`);
    return { success: true, songCount, logs };
  } catch (error) {
    logs.push(`Error: ${error.message}`);
    return { success: false, error: error.message, logs };
  }
});

// --- BPM/Key Lookup via GetSongBPM API ---

ipcMain.handle('lookup-song-metadata', async (_, { title, artist }) => {
  try {
    // Get API key from settings
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    const apiKey = settings?.getSongBpmApiKey;
    if (!apiKey) {
      return { success: false, error: 'No API key configured. Add one in Settings.' };
    }

    // Search using both song title and artist if available
    let lookupQuery = encodeURIComponent(title);
    let searchUrl;
    if (artist) {
      searchUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=both&lookup=song:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}`;
    } else {
      searchUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=song&lookup=${lookupQuery}`;
    }

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.search || searchData.search.length === 0) {
      return { success: false, error: 'Song not found in database' };
    }

    // Take the first result
    const match = searchData.search[0];

    // Get full song details
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
      data: {
        bpm,
        key: camelotKey,
        rawKey: keyOf,
        title: songData.song.title,
        artist: songData.song.artist?.name || null
      }
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
  if (/^[1-9]|1[0-2][AB]$/i.test(musicalKey)) {
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
