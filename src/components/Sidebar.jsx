import { useState } from 'react';
import { 
  Plus, 
  Music, 
  FolderPlus, 
  Settings, 
  ListMusic, 
  ChevronRight,
  ChevronDown,
  Download,
  Search,
  X
} from 'lucide-react';
import useMusicStore from '../store/useMusicStore';
import SongCard from './SongCard';
import { analyzeAndUpdateSong } from '../utils/audioAnalysis';

export default function Sidebar() {
  const { 
    songs, 
    playlists,
    activePlaylist,
    setActivePlaylist,
    addSong,
    addPlaylist,
    addSongToPlaylist,
    openSettings,
    openDownloadModal,
    fetchSongs 
  } = useMusicStore();

  const [playlistsExpanded, setPlaylistsExpanded] = useState(true);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [playlistSearchVisible, setPlaylistSearchVisible] = useState(false);

  // Get songs to display based on active playlist, then filter by search
  const baseSongs = activePlaylist 
    ? activePlaylist.songs.map(ps => ps.song)
    : songs;

  const displaySongs = searchQuery.trim()
    ? baseSongs.filter(song => {
        const q = searchQuery.toLowerCase();
        return (
          (song.title && song.title.toLowerCase().includes(q)) ||
          (song.artist && song.artist.toLowerCase().includes(q)) ||
          (song.key && song.key.toLowerCase().includes(q)) ||
          (song.bpm && String(Math.round(song.bpm)).includes(q))
        );
      })
    : baseSongs;

  // Run local BPM/key analysis for songs missing metadata
  const tryAnalyzeSong = (song) => {
    if (song.bpm && song.key) return;
    analyzeAndUpdateSong(song).then(updates => {
      if (updates) {
        useMusicStore.getState().updateSong(song.id, updates);
      }
    });
  };

  // Handle adding songs from file dialog
  const handleAddSongs = async () => {
    try {
      const result = await window.api.openFileDialog();
      if (!result.success || result.data.length === 0) return;

      // Process each selected file
      for (const filePath of result.data) {
        const metadataResult = await window.api.parseAudioMetadata(filePath);
        const songData = metadataResult.data;

        // Add to database
        const dbResult = await window.api.addNewSong(songData);
        if (dbResult.success) {
          addSong(dbResult.data);
          // Analyze BPM/key locally in background
          tryAnalyzeSong(dbResult.data);
        }
      }
      // Refresh songs after analysis may have updated DB
      setTimeout(() => fetchSongs(), 3000);
    } catch (error) {
      console.error('Error adding songs:', error);
    }
  };

  // Handle importing a folder as a playlist
  const handleImportPlaylist = async () => {
    try {
      const result = await window.api.openFolderDialog();
      if (!result.success || !result.data) return;

      // Get audio files from folder
      const filesResult = await window.api.getFolderAudioFiles(result.data);
      if (!filesResult.success) return;

      // Create playlist with folder name
      const playlistResult = await window.api.createPlaylist(filesResult.folderName);
      if (!playlistResult.success) return;

      addPlaylist(playlistResult.data);

      // Add songs and link to playlist
      for (const filePath of filesResult.data) {
        const metadataResult = await window.api.parseAudioMetadata(filePath);
        const songData = metadataResult.data;

        const existingSong = songs.find(s => s.filePath === filePath);
        let songId;

        if (existingSong) {
          songId = existingSong.id;
          tryAnalyzeSong(existingSong);
        } else {
          const dbResult = await window.api.addNewSong(songData);
          if (dbResult.success) {
            addSong(dbResult.data);
            songId = dbResult.data.id;
            tryAnalyzeSong(dbResult.data);
          }
        }

        if (songId) {
          const addResult = await window.api.addSongToPlaylist(playlistResult.data.id, songId);
          if (addResult.success) {
            addSongToPlaylist(playlistResult.data.id, addResult.data);
          }
        }
      }
    } catch (error) {
      console.error('Error importing playlist:', error);
    }
  };

  // Handle creating a new empty playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      const result = await window.api.createPlaylist(newPlaylistName.trim());
      if (result.success) {
        addPlaylist(result.data);
        setNewPlaylistName('');
        setIsCreatingPlaylist(false);
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
    }
  };

  return (
    <aside className="w-80 h-full bg-surface border-r border-border flex flex-col">
      {/* Header with drag region */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border drag-region">
        <h1 className="text-lg font-semibold text-white no-drag">Music Tree</h1>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={openDownloadModal}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
            title="Download from Spotify/SoundCloud"
          >
            <Download size={18} />
          </button>
          <button
            onClick={openSettings}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Playlists Section */}
      <div className="border-b border-border">
        <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover">
          <button
            type="button"
            onClick={() => setPlaylistsExpanded(!playlistsExpanded)}
            className="flex-1 flex items-center justify-between pr-2"
          >
            <span className="text-sm font-medium text-gray-300">Playlists</span>
            {playlistsExpanded ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setPlaylistSearchVisible(!playlistSearchVisible); setPlaylistSearchQuery(''); }}
              className={`p-1 rounded hover:bg-border hover:text-white
                ${playlistSearchVisible ? 'text-primary bg-border' : 'text-gray-400'}`}
              title="Search playlists"
            >
              <Search size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingPlaylist(true)}
              className="p-1 rounded hover:bg-border text-gray-400 hover:text-white"
              title="New playlist"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {playlistsExpanded && (
          <div className="pb-2">
            {/* Playlist Search */}
            {playlistSearchVisible && (
              <div className="px-3 py-1.5">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={playlistSearchQuery}
                    onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                    placeholder="Search playlists..."
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-7 py-1 text-xs
                      text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />
                  {playlistSearchQuery && (
                    <button
                      onClick={() => setPlaylistSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* All Songs option */}
            <button
              onClick={() => setActivePlaylist(null)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover
                ${!activePlaylist ? 'bg-surface-hover text-white' : 'text-gray-400'}`}
            >
              <ListMusic size={16} />
              <span>All Songs</span>
              <span className="ml-auto text-xs text-gray-500">{songs.length}</span>
            </button>

            {/* Playlist list (filtered by search) */}
            {playlists
              .filter(pl => !playlistSearchQuery.trim() || pl.name.toLowerCase().includes(playlistSearchQuery.toLowerCase()))
              .map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setActivePlaylist(playlist)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover
                  ${activePlaylist?.id === playlist.id ? 'bg-surface-hover text-white' : 'text-gray-400'}`}
              >
                <Music size={16} />
                <span className="truncate">{playlist.name}</span>
                <span className="ml-auto text-xs text-gray-500">{playlist.songs?.length || 0}</span>
              </button>
            ))}

            {/* No results message */}
            {playlistSearchQuery.trim() && playlists.filter(pl => pl.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())).length === 0 && (
              <p className="px-4 py-2 text-xs text-gray-500">No playlists match</p>
            )}

            {/* New playlist input */}
            {isCreatingPlaylist && (
              <div className="px-4 py-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreatePlaylist();
                    if (e.key === 'Escape') {
                      setIsCreatingPlaylist(false);
                      setNewPlaylistName('');
                    }
                  }}
                  onBlur={() => {
                    if (newPlaylistName.trim()) {
                      handleCreatePlaylist();
                    } else {
                      setIsCreatingPlaylist(false);
                    }
                  }}
                  placeholder="Playlist name..."
                  autoFocus
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm
                    text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Songs Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-gray-300">
            {activePlaylist ? activePlaylist.name : 'Songs'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSearchVisible(!searchVisible); setSearchQuery(''); }}
              className={`p-1.5 rounded hover:bg-surface-hover hover:text-white
                ${searchVisible ? 'text-primary bg-surface-hover' : 'text-gray-400'}`}
              title="Search songs"
            >
              <Search size={16} />
            </button>
            <button
              onClick={handleAddSongs}
              className="p-1.5 rounded hover:bg-surface-hover text-gray-400 hover:text-white"
              title="Add Songs"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleImportPlaylist}
              className="p-1.5 rounded hover:bg-surface-hover text-gray-400 hover:text-white"
              title="Import Folder as Playlist"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {searchVisible && (
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, artist, key, BPM..."
                autoFocus
                className="w-full bg-background border border-border rounded-lg pl-8 pr-8 py-1.5 text-sm
                  text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <p className="text-xs text-gray-500 mt-1 px-1">
                {displaySongs.length} result{displaySongs.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Song List */}
        <div className="flex-1 overflow-y-auto">
          {displaySongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Music size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No songs yet</p>
              <button
                onClick={handleAddSongs}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Add your first song
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displaySongs.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
