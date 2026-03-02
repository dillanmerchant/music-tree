import { useState } from 'react';
import { 
  Plus, 
  Music, 
  FolderPlus, 
  Settings, 
  ListMusic, 
  ChevronRight,
  ChevronDown,
  Download 
} from 'lucide-react';
import useMusicStore from '../store/useMusicStore';
import SongCard from './SongCard';

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

  // Get songs to display based on active playlist
  const displaySongs = activePlaylist 
    ? activePlaylist.songs.map(ps => ps.song)
    : songs;

  // Try to look up BPM/Key from API if missing from file metadata
  const tryLookupMetadata = async (song) => {
    if (song.bpm && song.key) return; // already has both
    try {
      const lookup = await window.api.lookupSongMetadata(song.title, song.artist);
      if (lookup.success && lookup.data) {
        const updates = {};
        if (!song.bpm && lookup.data.bpm) updates.bpm = lookup.data.bpm;
        if (!song.key && lookup.data.key) updates.key = lookup.data.key;
        if (Object.keys(updates).length > 0) {
          await window.api.updateSong(song.id, updates);
        }
      }
    } catch (err) {
      // Silently fail - API lookup is best-effort
      console.log('API lookup skipped or failed for:', song.title);
    }
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
          // Try API lookup in background for missing metadata
          tryLookupMetadata(dbResult.data);
        }
      }
      // Refresh songs after all lookups may have updated DB
      setTimeout(() => fetchSongs(), 2000);
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
        } else {
          const dbResult = await window.api.addNewSong(songData);
          if (dbResult.success) {
            addSong(dbResult.data);
            songId = dbResult.data.id;
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
          <button
            type="button"
            onClick={() => setIsCreatingPlaylist(true)}
            className="p-1 rounded hover:bg-border text-gray-400 hover:text-white"
            title="New playlist"
          >
            <Plus size={16} />
          </button>
        </div>

        {playlistsExpanded && (
          <div className="pb-2">
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

            {/* Playlist list */}
            {playlists.map((playlist) => (
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
