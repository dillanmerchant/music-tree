import { useState } from 'react'
import './App.css'

declare global {
  interface Window {
    electronAPI: {
      selectmp3: () => Promise<string[]>;
    };
  }
}

function App() {
  const [files, setFiles] = useState<string[]>([]);

  const handlePickFiles = async () => {
    const selectedFiles = await window.electronAPI.selectmp3();
    setFiles(selectedFiles);
  };

  return (
    <div className="p-4">
      <button
        className="bg-blue-500 text-white py-2 px-4 rounded"
        onClick={handlePickFiles}
      >
        Pick MP3 files
      </button>

      <ul className="mt-4 space-y-2">
        {files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </div>
  )
}

export default App