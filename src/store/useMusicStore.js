import { create } from 'zustand';

// Zustand store for managing Music Tree application state
const useMusicStore = create((set, get) => ({
  // ============================================
  // State
  // ============================================
  
  // All songs in the library
  songs: [],
  
  // Currently selected song for the Tree View
  activeSong: null,
  
  // All playlists
  playlists: [],
  
  // Currently selected playlist (null = All Songs)
  activePlaylist: null,
  
  // App settings
  settings: {
    bpmTolerance: 5,
    showRecommendations: true,
    theme: 'dark',
  },
  
  // UI State
  isLoading: false,
  error: null,
  
  // Audio playback
  currentlyPlaying: null,
  isPlaying: false,
  
  // Modal states
  isAddConnectionModalOpen: false,
  isAddToPlaylistModalOpen: false,
  isDownloadModalOpen: false,
  isSettingsOpen: false,
  modalSong: null, // Song being acted upon in modals

  // ============================================
  // Song Actions
  // ============================================
  
  // Fetch all songs from the database
  fetchSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.api.getAllSongs();
      if (result.success) {
        set({ songs: result.data, isLoading: false });
      } else {
        set({ error: result.error, isLoading: false });
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // Add a new song to the store (after database insert)
  addSong: (song) => {
    set((state) => ({
      songs: [song, ...state.songs]
    }));
  },
  
  // Update a song in the store
  updateSong: (id, updates) => {
    set((state) => ({
      songs: state.songs.map((song) =>
        song.id === id ? { ...song, ...updates } : song
      ),
      activeSong: state.activeSong?.id === id 
        ? { ...state.activeSong, ...updates } 
        : state.activeSong
    }));
  },
  
  // Delete a song from the store
  deleteSong: (id) => {
    set((state) => ({
      songs: state.songs.filter((song) => song.id !== id),
      activeSong: state.activeSong?.id === id ? null : state.activeSong
    }));
  },
  
  // Set the active song for Tree View
  setActiveSong: (song) => {
    set({ activeSong: song });
  },

  // Fetch a single song (with connections) and refresh it in state
  refreshSong: async (songId) => {
    try {
      const result = await window.api.getSong(songId);
      if (!result.success || !result.data) return null;

      const fresh = result.data;
      set((state) => ({
        songs: state.songs.map((s) => (s.id === songId ? fresh : s)),
        activeSong: state.activeSong?.id === songId ? fresh : state.activeSong,
        modalSong: state.modalSong?.id === songId ? fresh : state.modalSong,
      }));

      return fresh;
    } catch (error) {
      console.error('Error refreshing song:', error);
      return null;
    }
  },

  // Select a song as active, always using fresh DB data
  setActiveSongById: async (songId) => {
    const fresh = await get().refreshSong(songId);
    if (fresh) set({ activeSong: fresh });
  },

  // ============================================
  // Playlist Actions
  // ============================================
  
  // Fetch all playlists from the database
  fetchPlaylists: async () => {
    try {
      const result = await window.api.getAllPlaylists();
      if (result.success) {
        set({ playlists: result.data });
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  },
  
  // Add a new playlist
  addPlaylist: (playlist) => {
    set((state) => ({
      playlists: [playlist, ...state.playlists]
    }));
  },
  
  // Update a playlist
  updatePlaylist: (id, updates) => {
    set((state) => ({
      playlists: state.playlists.map((playlist) =>
        playlist.id === id ? { ...playlist, ...updates } : playlist
      )
    }));
  },
  
  // Delete a playlist
  deletePlaylist: (id) => {
    set((state) => ({
      playlists: state.playlists.filter((playlist) => playlist.id !== id),
      activePlaylist: state.activePlaylist?.id === id ? null : state.activePlaylist
    }));
  },
  
  // Set the active playlist
  setActivePlaylist: (playlist) => {
    set({ activePlaylist: playlist });
  },
  
  // Add a song to a playlist (local state update)
  addSongToPlaylist: (playlistId, playlistSong) => {
    set((state) => ({
      playlists: state.playlists.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, songs: [...playlist.songs, playlistSong] }
          : playlist
      )
    }));
  },
  
  // Remove a song from a playlist (local state update)
  removeSongFromPlaylist: (playlistId, songId) => {
    set((state) => ({
      playlists: state.playlists.map((playlist) =>
        playlist.id === playlistId
          ? { 
              ...playlist, 
              songs: playlist.songs.filter((ps) => ps.songId !== songId) 
            }
          : playlist
      )
    }));
  },

  // ============================================
  // Connection Actions
  // ============================================
  
  // Add a connection to a song
  addConnection: (sourceSongId, connection) => {
    set((state) => ({
      songs: state.songs.map((song) =>
        song.id === sourceSongId
          ? { 
              ...song, 
              connectionsFrom: [...(song.connectionsFrom || []), connection] 
            }
          : song
      ),
      activeSong: state.activeSong?.id === sourceSongId
        ? {
            ...state.activeSong,
            connectionsFrom: [...(state.activeSong.connectionsFrom || []), connection]
          }
        : state.activeSong
    }));
  },
  
  // Remove a connection from a song
  removeConnection: (sourceSongId, connectionId) => {
    set((state) => ({
      songs: state.songs.map((song) =>
        song.id === sourceSongId
          ? {
              ...song,
              connectionsFrom: (song.connectionsFrom || []).filter(
                (conn) => conn.id !== connectionId
              )
            }
          : song
      ),
      activeSong: state.activeSong?.id === sourceSongId
        ? {
            ...state.activeSong,
            connectionsFrom: (state.activeSong.connectionsFrom || []).filter(
              (conn) => conn.id !== connectionId
            )
          }
        : state.activeSong
    }));
  },

  // ============================================
  // Settings Actions
  // ============================================
  
  // Fetch settings from the database
  fetchSettings: async () => {
    try {
      const result = await window.api.getSettings();
      if (result.success) {
        set({ settings: result.data });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  },
  
  // Update settings
  setSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates }
    }));
  },

  // ============================================
  // Modal Actions
  // ============================================
  
  openAddConnectionModal: (song) => {
    set({ isAddConnectionModalOpen: true, modalSong: song });
  },
  
  closeAddConnectionModal: () => {
    set({ isAddConnectionModalOpen: false, modalSong: null });
  },
  
  openAddToPlaylistModal: (song) => {
    set({ isAddToPlaylistModalOpen: true, modalSong: song });
  },
  
  closeAddToPlaylistModal: () => {
    set({ isAddToPlaylistModalOpen: false, modalSong: null });
  },
  
  openSettings: () => {
    set({ isSettingsOpen: true });
  },
  
  closeSettings: () => {
    set({ isSettingsOpen: false });
  },

  // ============================================
  // Audio Playback Actions
  // ============================================
  
  playSong: (song) => {
    set({ currentlyPlaying: song, isPlaying: true });
  },
  
  pauseSong: () => {
    set({ isPlaying: false });
  },
  
  resumeSong: () => {
    set({ isPlaying: true });
  },
  
  stopSong: () => {
    set({ currentlyPlaying: null, isPlaying: false });
  },

  // ============================================
  // Download Modal Actions
  // ============================================
  
  openDownloadModal: () => {
    set({ isDownloadModalOpen: true });
  },
  
  closeDownloadModal: () => {
    set({ isDownloadModalOpen: false });
  },

  // ============================================
  // Utility Actions
  // ============================================
  
  // Clear any error
  clearError: () => {
    set({ error: null });
  },
  
  // Get connected songs for the active song
  getConnectedSongs: () => {
    const { activeSong, songs } = get();
    if (!activeSong) return [];
    
    const connectedIds = new Set();
    
    // Songs connected FROM the active song
    (activeSong.connectionsFrom || []).forEach((conn) => {
      connectedIds.add(conn.targetSongId);
    });
    
    // Songs connected TO the active song (bidirectional)
    (activeSong.connectionsTo || []).forEach((conn) => {
      connectedIds.add(conn.sourceSongId);
    });
    
    return songs.filter((song) => connectedIds.has(song.id));
  },

  // ============================================
  // Initialization
  // ============================================
  
  // Initialize the store by fetching all data
  initialize: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().fetchSongs(),
        get().fetchPlaylists(),
        get().fetchSettings(),
      ]);
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useMusicStore;
