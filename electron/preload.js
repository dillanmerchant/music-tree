const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // ============================================
  // Song Operations
  // ============================================
  
  // Fetch all songs from the database
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  
  // Get a single song by ID with its connections
  getSong: (songId) => ipcRenderer.invoke('get-song', songId),
  
  // Add a new song to the database
  addNewSong: (songData) => ipcRenderer.invoke('add-new-song', songData),
  
  // Update an existing song
  updateSong: (id, data) => ipcRenderer.invoke('update-song', { id, data }),
  
  // Delete a song
  deleteSong: (songId) => ipcRenderer.invoke('delete-song', songId),

  // ============================================
  // Playlist Operations
  // ============================================
  
  // Get all playlists with their songs
  getAllPlaylists: () => ipcRenderer.invoke('get-all-playlists'),
  
  // Create a new playlist
  createPlaylist: (name) => ipcRenderer.invoke('create-playlist', name),
  
  // Add a song to a playlist
  addSongToPlaylist: (playlistId, songId) => 
    ipcRenderer.invoke('add-song-to-playlist', { playlistId, songId }),
  
  // Remove a song from a playlist
  removeSongFromPlaylist: (playlistId, songId) => 
    ipcRenderer.invoke('remove-song-from-playlist', { playlistId, songId }),
  
  // Delete a playlist (deleteSongs: true to also remove songs from the library)
  deletePlaylist: (playlistId, deleteSongs = false) =>
    ipcRenderer.invoke('delete-playlist', { playlistId, deleteSongs }),

  // ============================================
  // Connection Operations
  // ============================================
  
  // Add a connection between two songs
  addConnection: (sourceSongId, targetSongId, notes = null, bidirectional = false) => 
    ipcRenderer.invoke('add-connection', { sourceSongId, targetSongId, notes, bidirectional }),
  
  // Remove a connection
  removeConnection: (connectionId) => ipcRenderer.invoke('remove-connection', connectionId),
  
  // Get all connections for a song
  getSongConnections: (songId) => ipcRenderer.invoke('get-song-connections', songId),

  // ============================================
  // Settings Operations
  // ============================================
  
  // Get app settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // Update app settings
  updateSettings: (data) => ipcRenderer.invoke('update-settings', data),

  // ============================================
  // File Operations
  // ============================================
  
  // Open file dialog to select audio files
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Open folder dialog (for importing playlists)
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
  // Parse audio file metadata
  parseAudioMetadata: (filePath) => ipcRenderer.invoke('parse-audio-metadata', filePath),
  
  // Get audio files from a folder
  getFolderAudioFiles: (folderPath) => ipcRenderer.invoke('get-folder-audio-files', folderPath),

  // ============================================
  // Download Operations (Spotify/SoundCloud)
  // ============================================
  
  // Download songs from a URL (Spotify or SoundCloud)
  downloadFromUrl: (url, playlistName) => ipcRenderer.invoke('download-from-url', { url, playlistName }),

  // Subscribe to download progress updates (returns unsubscribe function)
  onDownloadProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  cancelDownload: () => ipcRenderer.send('cancel-download'),

  // Get playable URL for local audio (custom protocol)
  getAudioUrl: (filePath) => ipcRenderer.invoke('get-audio-url', filePath),
  // Open folder in system file manager
  openPathInFolder: (folderPath) => ipcRenderer.invoke('open-path-in-folder', folderPath),
  // Get default download folder path
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),

  // ============================================
  // Metadata Lookup (GetSongBPM API)
  // ============================================
  
  // Look up BPM and key for a song via online API
  lookupSongMetadata: (title, artist) => ipcRenderer.invoke('lookup-song-metadata', { title, artist }),
});
