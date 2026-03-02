import { useState, useEffect } from 'react';
import { X, Save, Sliders, Sparkles, Moon, Sun, FolderOpen, FolderInput } from 'lucide-react';
import useMusicStore from '../store/useMusicStore';

export default function SettingsPanel() {
  const { settings, setSettings, closeSettings, fetchSettings, isSettingsOpen } = useMusicStore();

  const [localSettings, setLocalSettings] = useState({
    bpmTolerance: settings.bpmTolerance || 5,
    showRecommendations: settings.showRecommendations ?? true,
    theme: settings.theme || 'dark',
    downloadFolderPath: settings.downloadFolderPath ?? ''
  });
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    window.api.getDefaultDownloadPath?.().then((res) => {
      if (res?.success && res.data) setDefaultDownloadPath(res.data);
    });
  }, []);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalSettings({
        bpmTolerance: settings.bpmTolerance || 5,
        showRecommendations: settings.showRecommendations ?? true,
        theme: settings.theme || 'dark',
        downloadFolderPath: settings.downloadFolderPath ?? ''
      });
    }
  }, [isSettingsOpen, settings.bpmTolerance, settings.showRecommendations, settings.theme, settings.downloadFolderPath]);

  // Track changes
  useEffect(() => {
    const changed = 
      localSettings.bpmTolerance !== settings.bpmTolerance ||
      localSettings.showRecommendations !== settings.showRecommendations ||
      localSettings.theme !== settings.theme ||
      (localSettings.downloadFolderPath || '') !== (settings.downloadFolderPath || '');
    setHasChanges(changed);
  }, [localSettings, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const toSave = {
        ...localSettings,
        downloadFolderPath: localSettings.downloadFolderPath?.trim() || null
      };
      const result = await window.api.updateSettings(toSave);
      if (result.success) {
        setSettings(toSave);
        closeSettings();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setLocalSettings({
      bpmTolerance: settings.bpmTolerance || 5,
      showRecommendations: settings.showRecommendations ?? true,
      theme: settings.theme || 'dark',
      downloadFolderPath: settings.downloadFolderPath ?? ''
    });
    closeSettings();
  };

  const handleSelectDownloadFolder = async () => {
    const result = await window.api.openFolderDialog?.();
    if (result?.success && result.data) {
      setLocalSettings((prev) => ({ ...prev, downloadFolderPath: result.data }));
    }
  };

  const handleOpenDownloadFolder = () => {
    const path = localSettings.downloadFolderPath || defaultDownloadPath;
    if (path) window.api.openPathInFolder?.(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-surface border-l border-border 
        shadow-2xl animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 
          border-b border-border bg-surface z-10">
          <div className="flex items-center gap-3">
            <Sliders size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-8">
          {/* Download location */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <FolderOpen size={16} className="text-primary" />
              Download location
            </h3>
            <div className="bg-background rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Folder where Spotify and SoundCloud downloads are saved. Leave empty to use the default app folder.
              </p>
              {/* File path displayed prominently above the buttons */}
              <div className="bg-surface rounded-lg px-3 py-2 border border-border">
                <p className="text-xs text-gray-500 mb-0.5">Current path</p>
                <p className="text-sm text-gray-200 break-all select-all">
                  {localSettings.downloadFolderPath || defaultDownloadPath || 'Default (app data)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectDownloadFolder}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-hover text-gray-300 hover:text-white"
                >
                  <FolderInput size={14} />
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleOpenDownloadFolder}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-hover text-gray-300 hover:text-white"
                >
                  <FolderOpen size={14} />
                  Open folder
                </button>
                {localSettings.downloadFolderPath && (
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, downloadFolderPath: '' }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-surface-hover"
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* BPM & Key Detection */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              BPM & Key Detection
            </h3>
            <div className="bg-background rounded-lg p-4">
              <p className="text-sm text-gray-300 mb-1">Local Audio Analysis</p>
              <p className="text-xs text-gray-500">
                BPM and musical key are detected automatically using local audio analysis when songs are imported or downloaded.
                No API key or external service required.
              </p>
            </div>
          </section>

          {/* Recommendation Sensitivity */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              Recommendation Settings
            </h3>
            
            <div className="space-y-4">
              {/* BPM Tolerance */}
              <div className="bg-background rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">BPM Tolerance</label>
                  <span className="text-sm font-mono text-primary">
                    +/-{localSettings.bpmTolerance} BPM
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={localSettings.bpmTolerance}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    bpmTolerance: parseInt(e.target.value, 10)
                  }))}
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-4 
                    [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-primary
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Strict (1)</span>
                  <span>Loose (20)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Songs within this BPM range will be recommended when adding connections.
                </p>
              </div>

              {/* Show Recommendations Toggle */}
              <div className="bg-background rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-gray-300">Show Recommendations</label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Highlight compatible songs in connection modal
                    </p>
                  </div>
                  <button
                    onClick={() => setLocalSettings(prev => ({
                      ...prev,
                      showRecommendations: !prev.showRecommendations
                    }))}
                    className={`relative w-12 h-6 rounded-full transition-colors
                      ${localSettings.showRecommendations ? 'bg-primary' : 'bg-border'}`}
                  >
                    <div 
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md
                        transition-transform
                        ${localSettings.showRecommendations ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              {localSettings.theme === 'dark' ? (
                <Moon size={16} className="text-gray-400" />
              ) : (
                <Sun size={16} className="text-yellow-400" />
              )}
              Appearance
            </h3>
            
            <div className="bg-background rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-300">Theme</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Currently only dark mode is available
                  </p>
                </div>
                <select
                  value={localSettings.theme}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    theme: e.target.value
                  }))}
                  disabled
                  className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm
                    text-gray-400 cursor-not-allowed"
                >
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4">About</h3>
            <div className="bg-background rounded-lg p-4 text-center">
              <h4 className="text-lg font-semibold text-white mb-1">Music Tree</h4>
              <p className="text-xs text-gray-500 mb-2">Version 0.1.0</p>
              <p className="text-sm text-gray-400">
                A DJ helper for managing song connections and transitions.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 border-t border-border bg-surface">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white
                hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium 
                bg-primary text-white hover:bg-primary-hover
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
