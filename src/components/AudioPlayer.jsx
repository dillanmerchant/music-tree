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

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        pauseSong();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, pauseSong]);

  // Handle song change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentlyPlaying) return;

    // Use file:// protocol for local files
    const filePath = currentlyPlaying.filePath;
    audio.src = `file://${filePath}`;
    audio.volume = isMuted ? 0 : volume;
    setCurrentTime(0);

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        pauseSong();
      });
    }
  }, [currentlyPlaying?.id]);

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
      />
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 flex items-center px-4 gap-4">
        {/* Song Info */}
        <div className="w-56 flex-shrink-0 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentlyPlaying.title}</p>
          <p className="text-xs text-gray-500 truncate">{currentlyPlaying.artist || 'Unknown Artist'}</p>
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
