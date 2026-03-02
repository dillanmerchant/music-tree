import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Link2, ListPlus, Trash2, Play, Pause, RefreshCw } from 'lucide-react';
import useMusicStore from '../store/useMusicStore';
import { forceAnalyzeSong } from '../utils/audioAnalysis';

export default function SongCard({ song, compact = false }) {
  const { 
    setActiveSongById, 
    activeSong,
    openAddConnectionModal,
    openAddToPlaylistModal,
    deleteSong,
    currentlyPlaying,
    isPlaying,
    playSong,
    pauseSong 
  } = useMusicStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const menuRef = useRef(null);

  const isActive = activeSong?.id === song.id;
  const isSongPlaying = isPlaying && currentlyPlaying?.id === song.id;

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
    // Always fetch fresh data from DB so connections are up-to-date
    setActiveSongById(song.id);
  };

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isSongPlaying) {
      pauseSong();
    } else {
      playSong(song);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await window.api.deleteSong(song.id);
      if (result.success) {
        deleteSong(song.id);
      }
    } catch (error) {
      console.error('Error deleting song:', error);
    }
    setMenuOpen(false);
  };

  const handleAddConnection = () => {
    openAddConnectionModal(song);
    setMenuOpen(false);
  };

  const handleAddToPlaylist = () => {
    openAddToPlaylistModal(song);
    setMenuOpen(false);
  };

  const handleReanalyze = async () => {
    setMenuOpen(false);
    setIsAnalyzing(true);
    try {
      const updates = await forceAnalyzeSong(song);
      if (updates) {
        useMusicStore.getState().updateSong(song.id, updates);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Format BPM display
  const formatBpm = (bpm) => {
    if (!bpm) return '--';
    return Math.round(bpm);
  };

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer
        hover:bg-surface-hover transition-colors
        ${isActive ? 'bg-surface-hover border-l-2 border-primary' : ''}`}
      onClick={handleClick}
    >
      {/* Play Button */}
      <button
        onClick={handlePlayPause}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          transition-all duration-150
          ${isSongPlaying 
            ? 'bg-primary text-white' 
            : 'bg-surface-hover text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-primary/30'}`}
      >
        {isSongPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-gray-200'}`}>
          {song.title}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {song.artist || 'Unknown Artist'}
        </p>
      </div>

      {/* Metadata Tags */}
      <div className="flex items-center gap-2 text-xs">
        {isAnalyzing ? (
          <span className="flex items-center gap-1 text-gray-500">
            <RefreshCw size={12} className="animate-spin" />
            <span className="text-xs">analyzing</span>
          </span>
        ) : (
          <>
            {song.key && (
              <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono">
                {song.key}
              </span>
            )}
            <span className="text-gray-500 font-mono w-12 text-right">
              {formatBpm(song.bpm)} bpm
            </span>
          </>
        )}
      </div>

      {/* 3-dot Menu Button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className={`p-1.5 rounded hover:bg-border text-gray-400 hover:text-white
            ${menuOpen ? 'bg-border text-white' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <MoreVertical size={16} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border 
            rounded-lg shadow-xl z-50 py-1 animate-scale-in">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddConnection();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 
                hover:bg-surface-hover hover:text-white"
            >
              <Link2 size={16} />
              <span>Add Connections</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToPlaylist();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 
                hover:bg-surface-hover hover:text-white"
            >
              <ListPlus size={16} />
              <span>Add to Playlist</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReanalyze();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 
                hover:bg-surface-hover hover:text-white"
            >
              <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Re-analyze BPM/Key'}</span>
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error 
                hover:bg-surface-hover"
            >
              <Trash2 size={16} />
              <span>Delete Song</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
