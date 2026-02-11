import { useEffect } from 'react';
import useMusicStore from './store/useMusicStore';
import Sidebar from './components/Sidebar';
import ConnectionTree from './components/ConnectionTree';
import AudioPlayer from './components/AudioPlayer';
import AddConnectionModal from './components/modals/AddConnectionModal';
import AddToPlaylistModal from './components/modals/AddToPlaylistModal';
import DownloadModal from './components/modals/DownloadModal';
import SettingsPanel from './components/SettingsPanel';

function App() {
  const { 
    initialize, 
    isLoading, 
    isAddConnectionModalOpen, 
    isAddToPlaylistModalOpen,
    isDownloadModalOpen,
    isSettingsOpen,
    currentlyPlaying
  } = useMusicStore();

  // Initialize the store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading Music Tree...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Playlists and Songs */}
        <Sidebar />
        
        {/* Main Content - Connection Tree */}
        <main className="flex-1 overflow-hidden">
          <ConnectionTree />
        </main>
      </div>
      
      {/* Audio Player (fixed bottom bar) */}
      <AudioPlayer />
      
      {/* Modals */}
      {isAddConnectionModalOpen && <AddConnectionModal />}
      {isAddToPlaylistModalOpen && <AddToPlaylistModal />}
      {isDownloadModalOpen && <DownloadModal />}
      
      {/* Settings Panel */}
      {isSettingsOpen && <SettingsPanel />}
    </div>
  );
}

export default App;
