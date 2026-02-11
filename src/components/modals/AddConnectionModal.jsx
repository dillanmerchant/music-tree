import { useState, useMemo } from 'react';
import { X, Search, Check, Sparkles, ArrowRight, ArrowLeftRight } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';
import { getRecommendations, isKeyCompatible } from '../../utils/recommendations';

export default function AddConnectionModal() {
  const { 
    modalSong,
    songs, 
    settings,
    closeAddConnectionModal,
    addConnection,
    refreshSong
  } = useMusicStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidirectional, setBidirectional] = useState(true); // default to two-way

  // Get existing connection IDs to filter them out
  const existingConnectionIds = useMemo(() => {
    const ids = new Set();
    (modalSong?.connectionsFrom || []).forEach((conn) => {
      ids.add(conn.targetSongId);
    });
    (modalSong?.connectionsTo || []).forEach((conn) => {
      ids.add(conn.sourceSongId);
    });
    return ids;
  }, [modalSong]);

  // Get recommendations based on BPM and key compatibility
  const recommendations = useMemo(() => {
    if (!modalSong) return [];
    return getRecommendations(modalSong, songs, settings.bpmTolerance);
  }, [modalSong, songs, settings.bpmTolerance]);

  // Filter songs based on search and exclude already connected
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      if (song.id === modalSong?.id) return false;
      if (existingConnectionIds.has(song.id)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          song.title.toLowerCase().includes(query) ||
          (song.artist && song.artist.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [songs, modalSong, existingConnectionIds, searchQuery]);

  // Sort songs with recommendations first if enabled
  const sortedSongs = useMemo(() => {
    if (!showRecommendations) return filteredSongs;
    
    const recommendedIds = new Set(recommendations.map((s) => s.id));
    return [...filteredSongs].sort((a, b) => {
      const aRec = recommendedIds.has(a.id);
      const bRec = recommendedIds.has(b.id);
      if (aRec && !bRec) return -1;
      if (!aRec && bRec) return 1;
      return 0;
    });
  }, [filteredSongs, recommendations, showRecommendations]);

  const toggleSongSelection = (songId) => {
    setSelectedSongs((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  };

  const handleSubmit = async () => {
    if (selectedSongs.length === 0) return;
    
    setIsSubmitting(true);
    try {
      for (const targetSongId of selectedSongs) {
        const result = await window.api.addConnection(
          modalSong.id, 
          targetSongId, 
          null, 
          bidirectional
        );
        if (result.success) {
          addConnection(modalSong.id, result.data);
        }
      }
      // Ensure active song + tree are in sync with DB
      await refreshSong(modalSong.id);
      closeAddConnectionModal();
    } catch (error) {
      console.error('Error adding connections:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRecommended = (songId) => {
    return recommendations.some((s) => s.id === songId);
  };

  if (!modalSong) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-surface border border-border 
        rounded-xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Connections</h2>
            <p className="text-sm text-gray-400">
              Select songs that work well with "{modalSong.title}"
            </p>
          </div>
          <button
            onClick={closeAddConnectionModal}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Source Song Info */}
        <div className="px-6 py-4 bg-background/50 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{modalSong.title}</p>
              <p className="text-xs text-gray-400">{modalSong.artist || 'Unknown Artist'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {modalSong.key && (
                <span className="px-2 py-1 rounded bg-primary/20 text-primary font-mono">
                  {modalSong.key}
                </span>
              )}
              {modalSong.bpm && (
                <span className="px-2 py-1 rounded bg-accent/20 text-accent font-mono">
                  {Math.round(modalSong.bpm)} BPM
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Connection Type Toggle */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 mr-1">Connection type:</span>
            <button
              onClick={() => setBidirectional(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${bidirectional 
                  ? 'bg-primary/20 text-primary border border-primary/40' 
                  : 'bg-surface-hover text-gray-400 border border-transparent hover:text-white'}`}
            >
              <ArrowLeftRight size={14} />
              Two-way
            </button>
            <button
              onClick={() => setBidirectional(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${!bidirectional 
                  ? 'bg-primary/20 text-primary border border-primary/40' 
                  : 'bg-surface-hover text-gray-400 border border-transparent hover:text-white'}`}
            >
              <ArrowRight size={14} />
              One-way
            </button>
            <span className="text-xs text-gray-500 ml-2">
              {bidirectional 
                ? 'Songs will appear as connections on both sides' 
                : 'Only appears on the source song\'s connections'}
            </span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs..."
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2
                text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
              ${showRecommendations 
                ? 'bg-accent/20 text-accent' 
                : 'bg-surface-hover text-gray-400 hover:text-white'}`}
          >
            <Sparkles size={16} />
            <span>Recommendations</span>
          </button>
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto">
          {sortedSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <p className="text-sm">No songs available to connect</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedSongs.map((song) => {
                const selected = selectedSongs.includes(song.id);
                const recommended = isRecommended(song.id);
                
                return (
                  <button
                    key={song.id}
                    onClick={() => toggleSongSelection(song.id)}
                    className={`w-full flex items-center gap-4 px-6 py-3 hover:bg-surface-hover
                      transition-colors ${selected ? 'bg-primary/10' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                      ${selected 
                        ? 'bg-primary border-primary' 
                        : 'border-gray-500 hover:border-gray-400'}`}
                    >
                      {selected && <Check size={14} className="text-white" />}
                    </div>

                    {/* Song Info */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{song.title}</p>
                        {recommended && showRecommendations && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-accent/20 text-accent flex items-center gap-1 flex-shrink-0">
                            <Sparkles size={10} />
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{song.artist || 'Unknown Artist'}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {song.key && (
                        <span className={`px-2 py-0.5 rounded font-mono
                          ${isKeyCompatible(modalSong.key, song.key)
                            ? 'bg-success/20 text-success'
                            : 'bg-gray-700 text-gray-400'}`}
                        >
                          {song.key}
                        </span>
                      )}
                      {song.bpm && (
                        <span className="text-gray-500 font-mono">
                          {Math.round(song.bpm)} bpm
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {selectedSongs.length} song{selectedSongs.length !== 1 ? 's' : ''} selected
            {selectedSongs.length > 0 && (
              <span className="ml-2 text-gray-500">
                ({bidirectional ? 'two-way' : 'one-way'})
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={closeAddConnectionModal}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white
                hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedSongs.length === 0 || isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white
                hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Connections'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
