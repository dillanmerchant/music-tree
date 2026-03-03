import { useRef, useEffect, useState, useCallback } from 'react';
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
  const [isSeeking, setIsSeeking] = useState(false);
  const progressBarRef = useRef(null);
  const ignoreTimeUpdateRef = useRef(false);
  const DEBUG_SEEK = true; // Set to false to disable progress bar debug logs
  const logSeek = (...args) => { if (DEBUG_SEEK) console.log('[AudioPlayer SEEK]', ...args); };

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
    if (ignoreTimeUpdateRef.current) {
      logSeek('timeupdate IGNORED (seeking)');
      return;
    }
    if (audioRef.current) {
      const t = audioRef.current.currentTime;
      setCurrentTime(t);
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

  const updateSeek = useCallback((clientX) => {
    const bar = progressBarRef.current;
    if (!bar || !audioRef.current || !duration) {
      logSeek('updateSeek SKIP', { bar: !!bar, audio: !!audioRef.current, duration });
      return;
    }
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pct * duration;
    logSeek('updateSeek', { pct: pct.toFixed(3), targetTime: targetTime.toFixed(2), duration });
    ignoreTimeUpdateRef.current = true;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    logSeek('audio.currentTime set to', audioRef.current.currentTime);
  }, [duration]);

  const handleSeekClick = (e) => {
    e.preventDefault();
    logSeek('handleSeekClick', e.clientX);
    updateSeek(e.clientX);
  };

  const handleSeekMouseDown = (e) => {
    e.preventDefault();
    logSeek('handleSeekMouseDown', e.clientX);
    setIsSeeking(true);
    updateSeek(e.clientX);
  };

  useEffect(() => {
    if (!isSeeking) return;
    const onMove = (e) => updateSeek(e.clientX);
    const onUp = () => {
      logSeek('mouseup - end drag');
      setIsSeeking(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isSeeking, updateSeek]);

  // Listen for 'seeked' so we stop ignoring timeupdate after the element has finished seeking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onSeeking = () => {
      logSeek('audio seeking event');
      ignoreTimeUpdateRef.current = true;
    };
    const onSeeked = () => {
      logSeek('audio seeked event, currentTime=', audio.currentTime);
      ignoreTimeUpdateRef.current = false;
    };
    const fallback = () => {
      logSeek('fallback: re-enable timeupdate after 1s');
      ignoreTimeUpdateRef.current = false;
    };
    let t;
    const onSeekingWithFallback = () => {
      onSeeking();
      clearTimeout(t);
      t = setTimeout(fallback, 1000);
    };
    const onSeekedClearFallback = () => {
      clearTimeout(t);
      onSeeked();
    };
    audio.addEventListener('seeking', onSeekingWithFallback);
    audio.addEventListener('seeked', onSeekedClearFallback);
    return () => {
      clearTimeout(t);
      audio.removeEventListener('seeking', onSeekingWithFallback);
      audio.removeEventListener('seeked', onSeekedClearFallback);
    };
  }, [currentlyPlaying?.id]);

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

        {/* Progress Bar - click and drag to seek */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right font-mono">{formatTime(currentTime)}</span>
          <div
            ref={progressBarRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
            tabIndex={0}
            className="flex-1 h-8 cursor-pointer group relative select-none flex items-center"
            onClick={handleSeekClick}
            onMouseDown={handleSeekMouseDown}
          >
            <div className="w-full h-1.5 bg-border rounded-full relative">
              <div 
                className="h-full bg-primary rounded-full relative pointer-events-none"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              >
                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow
                  transition-opacity ${isSeeking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-10 font-mono">{formatTime(duration)}</span>
        </div>

        {/* Volume - with padding before close button */}
        <div className="flex items-center gap-2 w-32 flex-shrink-0 mr-3">
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
