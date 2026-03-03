import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Link2, Trash2, Plus, Play, Pause } from 'lucide-react';
import useMusicStore from '../store/useMusicStore';

export default function NodeCard({ song, isSource = false, connectionId, onAddConnection }) {
  const { 
    activeSong,
    setActiveSongById,
    refreshSong,
    openAddConnectionModal,
    currentlyPlaying,
    isPlaying,
    playSong,
    pauseSong
  } = useMusicStore();

  const isSongPlaying = isPlaying && currentlyPlaying?.id === song.id;

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isSongPlaying) {
      pauseSong();
    } else {
      playSong(song);
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleClick = () => {
    if (!isSource) {
      // Navigate to this song as the new source (fresh DB data)
      setActiveSongById(song.id);
    }
  };

  const handleRemoveConnection = async () => {
    if (!connectionId) return;
    
    try {
      const result = await window.api.removeConnection(connectionId);
      if (result.success) {
        // Refresh activeSong from DB so tree + lines update correctly
        if (activeSong?.id) await refreshSong(activeSong.id);
      }
    } catch (error) {
      console.error('Error removing connection:', error);
    }
    setMenuOpen(false);
  };

  const handleAddConnections = () => {
    openAddConnectionModal(song);
    setMenuOpen(false);
  };

  // Format BPM display
  const formatBpm = (bpm) => {
    if (!bpm) return '--';
    return Math.round(bpm);
  };

  return (
    <div
      className={`relative group rounded-xl border bg-surface shadow-lg
        transition-all duration-200 cursor-pointer select-none
        ${isSource 
          ? 'border-primary/50 shadow-primary/20 w-64' 
          : 'border-border hover:border-primary/30 hover:shadow-xl w-56'}`}
      onClick={handleClick}
    >
      {/* Source indicator */}
      {isSource && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 rounded text-xs 
          bg-primary text-white font-medium">
          Source
        </div>
      )}

      {/* Card Content */}
      <div className={`p-4 ${!isSource ? 'pr-10' : ''}`}>
        {/* Title, Artist, Play Button, and Menu */}
        <div className="mb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate ${isSource ? 'text-lg text-white' : 'text-sm text-gray-200'}`}>
              {song.title}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {song.artist || 'Unknown Artist'}
            </p>
          </div>
          <button
            onClick={handlePlayPause}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all
              ${isSongPlaying 
                ? 'bg-primary text-white' 
                : 'bg-border/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-primary/30'}`}
          >
            {isSongPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
        </div>

        {/* BPM and Key */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">BPM:</span>
            <span className="text-sm font-mono text-gray-300">
              {formatBpm(song.bpm)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Key:</span>
            <span className={`text-sm font-mono px-2 py-0.5 rounded
              ${song.key 
                ? 'bg-primary/20 text-primary' 
                : 'text-gray-500'}`}
            >
              {song.key || '--'}
            </span>
          </div>
        </div>

        {/* Connection count for source */}
        {isSource && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link2 size={12} />
              <span>
                {(song.connectionsFrom?.length || 0) + (song.connectionsTo || []).filter(c => c.bidirectional).length} connections
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddConnection) onAddConnection();
              }}
              className="p-1 rounded hover:bg-surface-hover text-gray-400 hover:text-white"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Menu Button (for non-source cards) */}
      {!isSource && (
        <div className="absolute top-3 right-2" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={`p-1.5 rounded hover:bg-border text-gray-400 hover:text-white
              ${menuOpen ? 'bg-border text-white' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border 
              rounded-lg shadow-xl z-50 py-1 animate-scale-in">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddConnections();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 
                  hover:bg-surface-hover hover:text-white"
              >
                <Link2 size={14} />
                <span>View Connections</span>
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveConnection();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error 
                  hover:bg-surface-hover"
              >
                <Trash2 size={14} />
                <span>Remove Link</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
