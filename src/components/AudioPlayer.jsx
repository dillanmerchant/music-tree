import { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import useMusicStore from '../store/useMusicStore';

export default function AudioPlayer() {
  const { currentlyPlaying, isPlaying, pauseSong, resumeSong, stopSong } = useMusicStore();
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  // Handle play/pause state changes (only play when we have a source)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.src) {
        console.log('[AudioPlayer] Attempting play, src:', audio.src.slice(0, 80));
        audio.play().catch((err) => {
          console.error('[AudioPlayer] play() rejected:', err.name, err.message);
          pauseSong();
        });
      } else {
        console.log('[AudioPlayer] isPlaying=true but no src yet');
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, pauseSong]);

  // Handle song change: resolve playable URL via main process (custom protocol)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentlyPlaying) return;

    setPlaybackError(null);
    console.log('[AudioPlayer] Song changed:', currentlyPlaying.title, '| filePath:', currentlyPlaying.filePath);

    let cancelled = false;
    window.api.getAudioUrl(currentlyPlaying.filePath).then((res) => {
      if (cancelled || !audioRef.current) return;
      console.log('[AudioPlayer] getAudioUrl response:', res.success, res.error || '', res.data?.slice(0, 80));
      if (res.success && res.data) {
        audio.volume = isMuted ? 0 : volume;
        setCurrentTime(0);
        setDuration(0);
        const playWhenReady = () => {
          if (cancelled || !audioRef.current) return;
          console.log('[AudioPlayer] canplay fired, readyState:', audio.readyState, 'isPlaying:', useMusicStore.getState().isPlaying);
          if (useMusicStore.getState().isPlaying) {
            audio.play().catch((err) => {
              console.error('[AudioPlayer] play() after canplay failed:', err.name, err.message);
              setPlaybackError(err.message);
              pauseSong();
            });
          }
        };
        audio.addEventListener('canplay', playWhenReady, { once: true });
        console.log('[AudioPlayer] Setting audio.src to:', res.data.slice(0, 80));
        audio.src = res.data;
        audio.load();
        if (audio.readyState >= 2) playWhenReady();
      } else {
        console.error('[AudioPlayer] getAudioUrl failed:', res.error);
        setPlaybackError(res.error || 'Failed to get audio URL');
      }
    }).catch(err => {
      console.error('[AudioPlayer] getAudioUrl IPC error:', err);
      setPlaybackError(err.message);
    });
    return () => { cancelled = true; };
  }, [currentlyPlaying?.id, pauseSong]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    stopSong();
  };

  const handleError = (e) => {
    const audio = audioRef.current;
    const mediaError = audio?.error;
    const codes = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
    const errMsg = mediaError
      ? `${codes[mediaError.code] || mediaError.code}: ${mediaError.message || 'unknown'}`
      : 'Unknown audio error';
    console.error('[AudioPlayer] <audio> error event:', errMsg, '| src:', audio?.src?.slice(0, 80));
    setPlaybackError(errMsg);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = pct * duration;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentlyPlaying) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
      />
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 flex items-center px-4 gap-4">
        {/* Song Info */}
        <div className="w-56 flex-shrink-0 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentlyPlaying.title}</p>
          <p className={`text-xs truncate ${playbackError ? 'text-red-400' : 'text-gray-500'}`}>
            {playbackError || currentlyPlaying.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Play Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => isPlaying ? pauseSong() : resumeSong()}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying 
              ? <Pause size={18} className="text-background" /> 
              : <Play size={18} className="text-background ml-0.5" />}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right font-mono">{formatTime(currentTime)}</span>
          <div 
            className="flex-1 h-1.5 bg-border rounded-full cursor-pointer group relative"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-primary rounded-full relative"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow
                opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-xs text-gray-500 w-10 font-mono">{formatTime(duration)}</span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-32 flex-shrink-0">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-gray-400 hover:text-white"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none 
              [&::-webkit-slider-thumb]:w-3 
              [&::-webkit-slider-thumb]:h-3 
              [&::-webkit-slider-thumb]:rounded-full 
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Close */}
        <button
          onClick={stopSong}
          className="text-gray-400 hover:text-white p-1"
        >
          <X size={16} />
        </button>
      </div>
    </>
  );
}
