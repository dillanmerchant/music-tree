import { useState } from 'react';
import { X, Plus, Check, Music } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

export default function AddToPlaylistModal() {
  const { 
    modalSong,
    playlists, 
    closeAddToPlaylistModal,
    addPlaylist,
    addSongToPlaylist 
  } = useMusicStore();

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedToPlaylists, setAddedToPlaylists] = useState([]);

  // Check if song is already in playlist
  const isSongInPlaylist = (playlist) => {
    return playlist.songs?.some((ps) => ps.songId === modalSong?.id);
  };

  const handleAddToPlaylist = async (playlist) => {
    if (isSongInPlaylist(playlist)) return;
    
    setIsSubmitting(true);
    try {
      const result = await window.api.addSongToPlaylist(playlist.id, modalSong.id);
      if (result.success) {
        addSongToPlaylist(playlist.id, result.data);
        setAddedToPlaylists((prev) => [...prev, playlist.id]);
      }
    } catch (error) {
      console.error('Error adding song to playlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Create the playlist
      const createResult = await window.api.createPlaylist(newPlaylistName.trim());
      if (createResult.success) {
        addPlaylist(createResult.data);
        
        // Add song to the new playlist
        const addResult = await window.api.addSongToPlaylist(createResult.data.id, modalSong.id);
        if (addResult.success) {
          addSongToPlaylist(createResult.data.id, addResult.data);
          setAddedToPlaylists((prev) => [...prev, createResult.data.id]);
        }
        
        setNewPlaylistName('');
        setIsCreatingNew(false);
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!modalSong) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[70vh] bg-surface border border-border 
        rounded-xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-white">Add to Playlist</h2>
            <p className="text-sm text-gray-400 truncate max-w-[280px]">
              "{modalSong.title}"
            </p>
          </div>
          <button
            onClick={closeAddToPlaylistModal}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Create New Playlist */}
        <div className="px-6 py-3 border-b border-border">
          {isCreatingNew ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateAndAdd();
                  if (e.key === 'Escape') {
                    setIsCreatingNew(false);
                    setNewPlaylistName('');
                  }
                }}
                placeholder="Playlist name..."
                autoFocus
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2
                  text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newPlaylistName.trim() || isSubmitting}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white
                  hover:bg-primary-hover disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewPlaylistName('');
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                text-primary hover:bg-primary/10 border border-dashed border-primary/50"
            >
              <Plus size={16} />
              <span>Create New Playlist</span>
            </button>
          )}
        </div>

        {/* Playlist List */}
        <div className="flex-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Music size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No playlists yet</p>
              <p className="text-xs">Create one to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {playlists.map((playlist) => {
                const inPlaylist = isSongInPlaylist(playlist);
                const justAdded = addedToPlaylists.includes(playlist.id);
                
                return (
                  <button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist)}
                    disabled={inPlaylist || isSubmitting}
                    className={`w-full flex items-center gap-4 px-6 py-3 hover:bg-surface-hover
                      transition-colors disabled:cursor-not-allowed
                      ${inPlaylist ? 'opacity-60' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      <Music size={18} className="text-gray-400" />
                    </div>
                    
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">{playlist.name}</p>
                      <p className="text-xs text-gray-500">
                        {playlist.songs?.length || 0} songs
                      </p>
                    </div>

                    {(inPlaylist || justAdded) && (
                      <div className="flex items-center gap-1 text-success text-xs">
                        <Check size={14} />
                        <span>{justAdded ? 'Added!' : 'Already added'}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={closeAddToPlaylistModal}
            className="w-full px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white
              hover:bg-surface-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
