import { useState, useRef, useCallback, useEffect } from 'react';
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
  X,
  HelpCircle,
  Trash2,
  RefreshCw,
  ListPlus,
  CheckSquare,
  Square
} from 'lucide-react';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 320;
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
    openHelp,
    fetchSongs,
    deletePlaylist
  } = useMusicStore();

  const [playlistsExpanded, setPlaylistsExpanded] = useState(true);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [playlistSearchVisible, setPlaylistSearchVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [playlistToDelete, setPlaylistToDelete] = useState(null); // { playlist } when confirm open
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const lastSelectedIndexRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(SIDEBAR_DEFAULT);

  // Resize sensitivity: scale down delta so sidebar doesn't jump (0.4 = 40% of pointer movement)
  const RESIZE_SENSITIVITY = 0.03;
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    const onMove = (moveE) => {
      const delta = (moveE.clientX - dragStartX.current) * RESIZE_SENSITIVITY;
      setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

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

  const handleDeletePlaylistClick = (e, playlist) => {
    e.stopPropagation();
    setPlaylistToDelete(playlist);
  };

  const onToggleSelectSong = useCallback((songId, options) => {
    const shiftKey = options?.shiftKey;
    const index = displaySongs.findIndex((s) => s.id === songId);
    if (index < 0) return;

    if (shiftKey) {
      const last = lastSelectedIndexRef.current;
      const from = last != null ? Math.min(last, index) : index;
      const to = last != null ? Math.max(last, index) : index;
      setSelectedSongIds((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) {
          next.add(displaySongs[i].id);
        }
        return next;
      });
      return;
    }

    lastSelectedIndexRef.current = index;
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, [displaySongs]);

  const clearSelection = useCallback(() => {
    setSelectedSongIds(new Set());
    setSelectionMode(false);
    lastSelectedIndexRef.current = null;
  }, []);

  // Cmd+A / Ctrl+A to select all visible songs when in selection mode
  useEffect(() => {
    if (!selectionMode) return;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        const tag = e.target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        setSelectedSongIds(new Set(displaySongs.map((s) => s.id)));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectionMode, displaySongs]);

  const handleBulkReanalyze = useCallback(async () => {
    const ids = Array.from(selectedSongIds);
    clearSelection();
    for (const songId of ids) {
      const song = displaySongs.find((s) => s.id === songId);
      if (song) {
        const { forceAnalyzeSong } = await import('../utils/audioAnalysis');
        const updates = await forceAnalyzeSong(song);
        if (updates) useMusicStore.getState().updateSong(song.id, updates);
      }
    }
  }, [selectedSongIds, displaySongs, clearSelection]);

  const handleBulkAddToPlaylist = useCallback(() => {
    const list = Array.from(selectedSongIds)
      .map((id) => displaySongs.find((s) => s.id === id))
      .filter(Boolean);
    if (list.length) {
      useMusicStore.getState().openAddToPlaylistModal(list);
      clearSelection();
    }
  }, [selectedSongIds, displaySongs, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`Delete ${selectedSongIds.size} song(s) from your library?`)) return;
    const ids = Array.from(selectedSongIds);
    clearSelection();
    for (const songId of ids) {
      try {
        const result = await window.api.deleteSong(songId);
        if (result.success) useMusicStore.getState().deleteSong(songId);
      } catch (e) {
        console.error('Error deleting song', songId, e);
      }
    }
  }, [selectedSongIds, clearSelection]);

  const handleDeletePlaylistConfirm = async (deleteSongs) => {
    if (!playlistToDelete) return;
    const playlist = playlistToDelete;
    setPlaylistToDelete(null);
    try {
      const result = await window.api.deletePlaylist(playlist.id, deleteSongs);
      if (result.success) {
        deletePlaylist(playlist.id);
        if (activePlaylist?.id === playlist.id) {
          setActivePlaylist(null);
        }
        if (result.deletedSongs > 0) {
          await fetchSongs();
        }
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
  };

  return (
    <aside
      className="relative h-full bg-surface border-r border-border flex flex-col flex-shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle - hit area on the right edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 group"
        style={{ left: '100%', marginLeft: -4 }}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-border group-hover:bg-primary/50 rounded-full transition-colors" />
      </div>
      {/* Header with drag region — extra left padding for macOS traffic-light buttons */}
      <div className="h-12 flex items-center justify-between pl-20 pr-4 border-b border-border drag-region relative">
        <h1 className="text-lg font-semibold text-white no-drag">Music Tree</h1>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={openHelp}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
            title="How to use Music Tree"
          >
            <HelpCircle size={18} />
          </button>
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
              <div
                key={playlist.id}
                className={`group/pl flex items-center w-full
                  ${activePlaylist?.id === playlist.id ? 'bg-surface-hover' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setActivePlaylist(playlist)}
                  className={`flex-1 flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover min-w-0
                    ${activePlaylist?.id === playlist.id ? 'text-white' : 'text-gray-400'}`}
                >
                  <Music size={16} className="flex-shrink-0" />
                  <span className="truncate">{playlist.name}</span>
                  <span className="ml-auto text-xs text-gray-500 flex-shrink-0">{playlist.songs?.length || 0}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeletePlaylistClick(e, playlist)}
                  className="self-stretch px-3 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-surface-hover opacity-0 group-hover/pl:opacity-100 transition-opacity flex-shrink-0 rounded-none"
                  title="Delete playlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
              onClick={() => { setSelectionMode(!selectionMode); if (!selectionMode) setSelectedSongIds(new Set()); }}
              className={`p-1.5 rounded hover:bg-surface-hover hover:text-white
                ${selectionMode ? 'text-primary bg-surface-hover' : 'text-gray-400'}`}
              title="Select songs for bulk actions"
            >
              <CheckSquare size={16} />
            </button>
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

        {/* Bulk actions bar */}
        {selectedSongIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-border flex-wrap">
            <span className="text-xs text-gray-300">{selectedSongIds.size} selected</span>
            <button
              type="button"
              onClick={handleBulkReanalyze}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-surface-hover text-gray-200 hover:text-white"
            >
              <RefreshCw size={12} />
              Re-analyze
            </button>
            <button
              type="button"
              onClick={handleBulkAddToPlaylist}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-surface-hover text-gray-200 hover:text-white"
            >
              <ListPlus size={12} />
              Add to playlist
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-surface-hover ml-auto"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}

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
                <SongCard
                  key={song.id}
                  song={song}
                  selected={selectedSongIds.has(song.id)}
                  selectionMode={selectionMode}
                  onToggleSelect={onToggleSelectSong}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete playlist confirm */}
      {playlistToDelete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 rounded-lg p-4">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-4 w-full max-w-xs">
            <p className="text-sm font-medium text-white mb-1">Delete &quot;{playlistToDelete.name}&quot;</p>
            <p className="text-xs text-gray-400 mb-4">
              {playlistToDelete.songs?.length || 0} song(s) in this playlist.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDeletePlaylistConfirm(false)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-surface-hover text-gray-200 hover:text-white"
              >
                Delete playlist only (keep songs in library)
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlaylistConfirm(true)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Delete playlist and remove songs from library
              </button>
              <button
                type="button"
                onClick={() => setPlaylistToDelete(null)}
                className="w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-hover mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
