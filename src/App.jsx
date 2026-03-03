import { useEffect } from 'react';
import useMusicStore from './store/useMusicStore';
import Sidebar from './components/Sidebar';
import ConnectionTree from './components/ConnectionTree';
import AudioPlayer from './components/AudioPlayer';
import AddConnectionModal from './components/modals/AddConnectionModal';
import AddToPlaylistModal from './components/modals/AddToPlaylistModal';
import DownloadModal from './components/modals/DownloadModal';
import HelpModal from './components/modals/HelpModal';
import SettingsPanel from './components/SettingsPanel';

function App() {
  const { 
    initialize, 
    isLoading, 
    isAddConnectionModalOpen, 
    isAddToPlaylistModalOpen,
    isDownloadModalOpen,
    isSettingsOpen,
    isHelpOpen,
    currentlyPlaying
  } = useMusicStore();

  // Initialize the store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Keep download progress in sync even when modal is closed (so reopening shows current state)
  useEffect(() => {
    const unsub = window.api.onDownloadProgress?.((data) => {
      useMusicStore.getState().setDownloadState({
        ...(data.logs && { logs: data.logs }),
        ...(data.phase !== undefined && { progress: { current: data.current ?? 0, total: data.total ?? 0, phase: data.phase } }),
        ...(data.cancelled && { isDownloading: false, status: { type: 'error', message: 'Download cancelled.' } }),
      });
    });
    return () => unsub?.();
  }, []);

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
      {isHelpOpen && <HelpModal />}
      
      {/* Settings Panel */}
      {isSettingsOpen && <SettingsPanel />}
    </div>
  );
}

export default App;
