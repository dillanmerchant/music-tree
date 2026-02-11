import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Plus, Sparkles, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import useMusicStore from '../store/useMusicStore';
import NodeCard from './NodeCard';

const MAX_VISIBLE = 24;

export default function ConnectionTree() {
  const { 
    activeSong, 
    openAddConnectionModal,
    settings 
  } = useMusicStore();

  const [showAll, setShowAll] = useState(false);
  const transformRef = useRef(null);

  // Get connected songs
  const connectedSongs = useMemo(() => {
    if (!activeSong) return [];
    const connected = [];

    (activeSong.connectionsFrom || []).forEach((conn) => {
      if (conn.targetSong) {
        connected.push({
          ...conn.targetSong,
          connectionId: conn.id,
          direction: 'from',
        });
      }
    });

    // Only show reverse connections if bidirectional
    (activeSong.connectionsTo || []).forEach((conn) => {
      if (conn.sourceSong && conn.bidirectional) {
        connected.push({
          ...conn.sourceSong,
          connectionId: conn.id,
          direction: 'to',
        });
      }
    });

    return connected;
  }, [activeSong]);

  const visibleConnectedSongs = useMemo(() => {
    if (showAll) return connectedSongs;
    return connectedSongs.slice(0, MAX_VISIBLE);
  }, [connectedSongs, showAll]);

  // Reset zoom when active song changes
  useEffect(() => {
    if (transformRef.current) {
      transformRef.current.resetTransform();
    }
  }, [activeSong?.id]);

  const handleResetView = useCallback(() => {
    if (transformRef.current) {
      transformRef.current.resetTransform();
    }
  }, []);

  // Empty state
  if (!activeSong) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <Link2 size={48} className="mb-4 opacity-30" />
        <h2 className="text-xl font-medium text-gray-400 mb-2">No Song Selected</h2>
        <p className="text-sm max-w-md text-center">
          Click on a song in the sidebar to view and manage its connections.
          The tree view will show all songs that work well together.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <div className="h-14 flex-shrink-0 flex items-center justify-between px-6 
        bg-background border-b border-border z-20">
        <h2 className="text-lg font-medium text-white">Connection Tree</h2>
        <div className="flex items-center gap-2">
          {connectedSongs.length > MAX_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-gray-200 hover:bg-surface-hover"
            >
              {showAll ? 'Show fewer' : `Show all (${connectedSongs.length})`}
            </button>
          )}
          {settings.showRecommendations && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs">
              <Sparkles size={12} />
              <span>Recommendations Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
        <button
          onClick={() => transformRef.current?.zoomIn()}
          className="p-2 rounded-lg bg-surface border border-border text-gray-300 hover:bg-surface-hover hover:text-white"
          title="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => transformRef.current?.zoomOut()}
          className="p-2 rounded-lg bg-surface border border-border text-gray-300 hover:bg-surface-hover hover:text-white"
          title="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 rounded-lg bg-surface border border-border text-gray-300 hover:bg-surface-hover hover:text-white"
          title="Reset view"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Pan/Zoom Canvas */}
      <div className="flex-1 overflow-hidden">
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.25}
          maxScale={2.5}
          centerOnInit={false}
          limitToBounds={false}
          panning={{ velocityDisabled: true }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ minWidth: '100%' }}
          >
            {/* Tree layout using flexbox - always centered */}
            <div className="flex flex-col items-center pt-12 pb-24 px-8 min-w-full">
              
              {/* Source Node */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`source-${activeSong.id}`}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <NodeCard 
                    song={activeSong} 
                    isSource={true}
                    onAddConnection={() => openAddConnectionModal(activeSong)}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Add Connection Button - only when no connections */}
              {connectedSongs.length === 0 && (
                <motion.div
                  className="mt-12"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <button
                    onClick={() => openAddConnectionModal(activeSong)}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-dashed
                      border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60 
                      transition-all duration-200"
                  >
                    <Plus size={18} />
                    <span className="font-medium">Add Connections</span>
                  </button>
                </motion.div>
              )}

              {/* Connected Nodes Grid */}
              {visibleConnectedSongs.length > 0 && (
                <motion.div
                  className="mt-16 flex flex-wrap justify-center gap-6 max-w-[1200px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <AnimatePresence>
                    {visibleConnectedSongs.map((song, index) => (
                      <motion.div
                        key={`child-${song.id}`}
                        initial={{ scale: 0.9, opacity: 0, y: -10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ 
                          duration: 0.2, 
                          delay: index * 0.02,
                        }}
                      >
                        <NodeCard 
                          song={song} 
                          connectionId={song.connectionId}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center z-10 pointer-events-none">
        <p className="text-xs text-gray-500 bg-background/80 px-3 py-1 rounded-full">
          Scroll to zoom • Drag to pan • Click a song to navigate
        </p>
      </div>
    </div>
  );
}
