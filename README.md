# Music Tree - DJ Helper

A desktop application for DJs to manage song connections and transitions. Built with Electron, React, Prisma, and Tailwind CSS.

## Features

- **Song Library**: Import MP3 files from your file system with automatic metadata extraction (BPM, Key, Title, Artist)
- **Playlists**: Create and manage playlists, or import folders as playlists
- **Connection Tree**: Visual tree view showing which songs work well together
- **Smart Recommendations**: Uses Camelot wheel logic to suggest compatible songs based on key and BPM
- **Settings**: Customize recommendation sensitivity and preferences

## Tech Stack

- **Electron** - Desktop app framework
- **React 18** - UI framework
- **Vite** - Build tool
- **Zustand** - State management
- **Prisma** - Database ORM (SQLite)
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **music-metadata** - Audio file metadata parsing

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd music-tree
```

2. Install dependencies:
```bash
npm install
```

3. Generate Prisma client and set up the database:
```bash
npm run prisma:generate
npm run prisma:push
```

4. Start the development server:
```bash
npm run dev
```

This will start both the Vite dev server and Electron app concurrently.

### Building for Production

```bash
npm run build
```

This will create distributable packages in the `release/` directory.

## Project Structure

```
music-tree/
├── electron/           # Electron main process
│   ├── main.js         # Main process entry, IPC handlers
│   └── preload.js      # Context bridge for secure IPC
├── prisma/
│   └── schema.prisma   # Database schema
├── src/
│   ├── components/     # React components
│   │   ├── modals/     # Modal components
│   │   ├── Sidebar.jsx
│   │   ├── SongCard.jsx
│   │   ├── NodeCard.jsx
│   │   ├── ConnectionTree.jsx
│   │   └── SettingsPanel.jsx
│   ├── store/
│   │   └── useMusicStore.js  # Zustand store
│   ├── utils/
│   │   └── recommendations.js # Camelot wheel logic
│   ├── types/
│   │   └── api.d.ts    # TypeScript declarations
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Usage

### Adding Songs

1. Click the **+** button in the Songs section
2. Select one or more audio files (MP3, WAV, FLAC, M4A, AIFF)
3. Metadata will be automatically extracted from the files

### Creating Playlists

- Click the **+** button next to "Playlists" to create an empty playlist
- Click the folder icon to import a folder as a playlist

### Managing Connections

1. Click on a song to view it in the Connection Tree
2. Click "Add Connections" to open the connection modal
3. Search for songs and select the ones that mix well
4. Recommendations are highlighted based on BPM and key compatibility

### Camelot Wheel Compatibility

The app uses the Camelot wheel system for key compatibility:
- **Same key** (e.g., 8A → 8A) - Perfect match
- **Adjacent keys** (e.g., 8A → 7A or 9A) - Smooth transition
- **Relative major/minor** (e.g., 8A → 8B) - Energy change

## License

MIT
