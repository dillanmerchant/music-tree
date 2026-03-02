// Type declarations for the Electron IPC API exposed via preload

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Song {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  key: string | null;
  duration: number | null;
  filePath: string;
  fileName: string;
  createdAt: Date;
  updatedAt: Date;
  connectionsFrom?: SongConnection[];
  connectionsTo?: SongConnection[];
}

interface Playlist {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  songs: PlaylistSong[];
}

interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedAt: Date;
  song: Song;
}

interface SongConnection {
  id: string;
  sourceSongId: string;
  targetSongId: string;
  notes: string | null;
  createdAt: Date;
  sourceSong?: Song;
  targetSong?: Song;
}

interface Settings {
  id: string;
  bpmTolerance: number;
  showRecommendations: boolean;
  theme: string;
  lastImportPath: string | null;
  getSongBpmApiKey?: string | null;
  downloadFolderPath?: string | null;
}

interface SongMetadata {
  title: string;
  artist: string | null;
  bpm: number | null;
  key: string | null;
  duration: number | null;
  filePath: string;
  fileName: string;
}

interface ElectronAPI {
  // Song operations
  getAllSongs: () => Promise<ApiResponse<Song[]>>;
  getSong: (songId: string) => Promise<ApiResponse<Song>>;
  addNewSong: (songData: Partial<Song>) => Promise<ApiResponse<Song>>;
  updateSong: (id: string, data: Partial<Song>) => Promise<ApiResponse<Song>>;
  deleteSong: (songId: string) => Promise<ApiResponse<void>>;

  // Playlist operations
  getAllPlaylists: () => Promise<ApiResponse<Playlist[]>>;
  createPlaylist: (name: string) => Promise<ApiResponse<Playlist>>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<ApiResponse<PlaylistSong>>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<ApiResponse<void>>;
  deletePlaylist: (playlistId: string) => Promise<ApiResponse<void>>;

  // Connection operations
  addConnection: (sourceSongId: string, targetSongId: string, notes?: string) => Promise<ApiResponse<SongConnection>>;
  removeConnection: (connectionId: string) => Promise<ApiResponse<void>>;
  getSongConnections: (songId: string) => Promise<ApiResponse<SongConnection[]>>;

  // Settings operations
  getSettings: () => Promise<ApiResponse<Settings>>;
  updateSettings: (data: Partial<Settings>) => Promise<ApiResponse<Settings>>;

  // File operations
  openFileDialog: () => Promise<ApiResponse<string[]>>;
  openFolderDialog: () => Promise<ApiResponse<string | null>>;
  parseAudioMetadata: (filePath: string) => Promise<ApiResponse<SongMetadata>>;
  getFolderAudioFiles: (folderPath: string) => Promise<ApiResponse<string[]> & { folderName?: string }>;

  // Download (Spotify/SoundCloud)
  downloadFromUrl: (url: string, playlistName: string) => Promise<ApiResponse<{ songCount: number; logs: string[]; downloadsDir?: string }>>;
  onDownloadProgress: (callback: (data: { logs?: string[]; log?: string; phase?: string; current?: number; total?: number }) => void) => () => void;
  getAudioUrl: (filePath: string) => Promise<ApiResponse<string>>;
  openPathInFolder: (folderPath: string) => Promise<ApiResponse<void>>;
  getDefaultDownloadPath: () => Promise<ApiResponse<string>>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
