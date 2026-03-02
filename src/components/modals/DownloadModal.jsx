import { useState } from 'react';
import { X, Download, Music, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

export default function DownloadModal() {
  const { closeDownloadModal, fetchSongs, fetchPlaylists } = useMusicStore();
  
  const [url, setUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(null); // { current, total, phase }

  const detectPlatform = (inputUrl) => {
    if (inputUrl.includes('spotify.com') || inputUrl.includes('spotify:')) return 'spotify';
    if (inputUrl.includes('soundcloud.com')) return 'soundcloud';
    return null;
  };

  const platform = detectPlatform(url);

  const handleDownload = async () => {
    if (!url.trim() || !playlistName.trim()) return;
    
    setIsDownloading(true);
    setStatus(null);
    setLogs([]);
    setProgress(null);

    const unsubscribe = window.api.onDownloadProgress?.((data) => {
      if (data.logs) setLogs(data.logs);
      if (data.phase !== undefined) setProgress({ current: data.current ?? 0, total: data.total ?? 0, phase: data.phase });
    });

    try {
      const result = await window.api.downloadFromUrl(url.trim(), playlistName.trim());
      
      if (result.success) {
        setStatus({ type: 'success', message: `Downloaded ${result.songCount} song(s) into "${playlistName}"` });
        setLogs(result.logs || []);
        await fetchSongs();
        await fetchPlaylists();
      } else {
        setStatus({ type: 'error', message: result.error });
        setLogs(result.logs || []);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      unsubscribe?.();
      setIsDownloading(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Download size={20} className="text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-white">Download from URL</h2>
              <p className="text-xs text-gray-400">Import songs from Spotify or SoundCloud</p>
            </div>
          </div>
          <button
            onClick={closeDownloadModal}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Playlist Name */}
          <div>
            <label className="text-sm text-gray-300 mb-1.5 block">Playlist Name</label>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="My Playlist"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5
                text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          {/* URL Input */}
          <div>
            <label className="text-sm text-gray-300 mb-1.5 block">Spotify or SoundCloud URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/... or https://soundcloud.com/..."
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5
                text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
            {url && (
              <div className="mt-2 flex items-center gap-2">
                {platform === 'spotify' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Spotify detected</span>
                )}
                {platform === 'soundcloud' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">SoundCloud detected</span>
                )}
                {!platform && url.length > 5 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Unrecognized URL</span>
                )}
              </div>
            )}
          </div>

          {/* Progress during download */}
          {isDownloading && progress?.total > 0 && (
            <div className="bg-background rounded-lg p-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{progress.phase === 'download' ? 'Downloading...' : 'Importing...'}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} 
                />
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className={`flex items-start gap-3 p-3 rounded-lg text-sm
              ${status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {status.type === 'success' ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* Download Logs - show during download or when complete */}
          {(logs.length > 0 || isDownloading) && (
            <div className="bg-background rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">Progress:</p>
              {logs.length > 0 ? logs.map((log, i) => (
                <p key={i} className="text-xs text-gray-400 font-mono leading-relaxed">{log}</p>
              )) : (
                <p className="text-xs text-gray-500 italic">Starting...</p>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={closeDownloadModal}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!url.trim() || !playlistName.trim() || !platform || isDownloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white
              hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download size={16} />
                Download & Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
