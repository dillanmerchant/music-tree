import { X } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

export default function HelpModal() {
  const { closeHelp } = useMusicStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[85vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">How to Use Music Tree</h2>
          <button
            onClick={closeHelp}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 text-sm text-gray-300 leading-relaxed">
          <div>
            <h4 className="font-medium text-white mb-1">Getting Started</h4>
            <p className="text-xs text-gray-400">
              Music Tree helps DJs organize songs and map out which tracks mix well together.
              Build a library, create playlists, and visualize song connections as an interactive tree.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Importing Songs</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Click the <strong className="text-gray-300">+</strong> button in the sidebar to add individual audio files (MP3, WAV, FLAC, M4A, etc.).</li>
              <li>Click the <strong className="text-gray-300">folder icon</strong> to import an entire folder as a playlist.</li>
              <li>BPM and musical key are automatically detected when songs are imported.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Downloading from Spotify & SoundCloud</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Click the <strong className="text-gray-300">download icon</strong> in the sidebar header.</li>
              <li>Paste a Spotify or SoundCloud URL (track, album, or playlist).</li>
              <li>Songs are downloaded to the configured download folder and automatically added to your library.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Managing Playlists</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Create new playlists with the <strong className="text-gray-300">+</strong> next to &quot;Playlists&quot;.</li>
              <li>Use a song&apos;s 3-dot menu and choose &quot;Add to Playlist&quot;.</li>
              <li>Click &quot;All Songs&quot; to view your entire library, or click a playlist name to filter.</li>
              <li>Use the search bar to find songs by title, artist, key, or BPM.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Building Connections</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Click a song in the sidebar to open its <strong className="text-gray-300">Connection Tree</strong> view.</li>
              <li>Click &quot;Add Connections&quot; to find songs that mix well together.</li>
              <li>The modal highlights <strong className="text-gray-300">recommended songs</strong> based on BPM tolerance and key compatibility.</li>
              <li>Choose <strong className="text-gray-300">two-way</strong> connections (both songs see each other) or <strong className="text-gray-300">one-way</strong> (source only).</li>
              <li>Search connections by title, artist, key, BPM, or playlist name.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Connection Tree View</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>The main area shows the selected song at the top with all its connections below.</li>
              <li><strong className="text-gray-300">Scroll</strong> to zoom in/out, <strong className="text-gray-300">drag</strong> to pan around.</li>
              <li>Click any connected song to navigate to it and see its connections.</li>
              <li>Use the 3-dot menu on connected songs to remove a link or view that song&apos;s connections.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Playing & Previewing Songs</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Hover over a song in the sidebar and click the <strong className="text-gray-300">play button</strong>.</li>
              <li>The player bar at the bottom shows the current song with play/pause controls.</li>
              <li>Click or drag the <strong className="text-gray-300">progress bar</strong> to skip to any position in the song.</li>
              <li>Adjust volume with the slider or click the speaker icon to mute.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Re-analyzing BPM & Key</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>If BPM or key detection seems off, click the 3-dot menu on any song and select &quot;Re-analyze BPM/Key&quot;.</li>
              <li>Analysis runs locally — no internet connection or API key needed.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Tips</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Resize the sidebar by dragging its right edge to see more or less of your song list.</li>
              <li>Adjust the <strong className="text-gray-300">BPM Tolerance</strong> in Settings to widen or narrow recommendations.</li>
              <li>Musical keys use <strong className="text-gray-300">Camelot notation</strong> (e.g., 8A, 7B) for easy harmonic mixing.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
