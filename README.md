# electron-vite-react

[![awesome-vite](https://awesome.re/mentioned-badge.svg)](https://github.com/vitejs/awesome-vite)
![GitHub stars](https://img.shields.io/github/stars/caoxiemeihao/vite-react-electron?color=fa6470)
![GitHub issues](https://img.shields.io/github/issues/caoxiemeihao/vite-react-electron?color=d8b22d)
![GitHub license](https://img.shields.io/github/license/caoxiemeihao/vite-react-electron)
[![Required Node.JS >= 14.18.0 || >=16.0.0](https://img.shields.io/static/v1?label=node&message=14.18.0%20||%20%3E=16.0.0&logo=node.js&color=3f893e)](https://nodejs.org/about/releases)

English | [简体中文](README.zh-CN.md)

## 👀 Overview

📦 Ready out of the box  
🎯 Based on the official [template-react-ts](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts), project structure will be familiar to you  
🌱 Easily extendable and customizable  
💪 Supports Node.js API in the renderer process  
🔩 Supports C/C++ native addons  
🐞 Debugger configuration included  
🖥 Easy to implement multiple windows

## 🛫 Quick Setup

```sh
# clone the project
git clone https://github.com/electron-vite/electron-vite-react.git

# enter the project directory
cd electron-vite-react

# install dependency
npm install

# develop
npm run dev
```

## 🐞 Debug

![electron-vite-react-debug.gif](/electron-vite-react-debug.gif)

## 📂 Directory structure

Familiar React application structure, just with `electron` folder on the top :wink:  
_Files in this folder will be separated from your React application and built into `dist-electron`_

```tree
├── electron                                 Electron-related code
│   ├── main                                 Main-process source code
│   └── preload                              Preload-scripts source code
│
├── release                                  Generated after production build, contains executables
│   └── {version}
│       ├── {os}-{os_arch}                   Contains unpacked application executable
│       └── {app_name}_{version}.{ext}       Installer for the application
│
├── public                                   Static assets
└── src                                      Renderer source code, your React application
```

🎵 Music Tree

Music Tree is a desktop app that lets users upload songs, organize them into playlists, and visualize the connections between tracks using an interactive node tree.
Built with Electron, React (Vite), and Prisma, it’s designed to be fast, local-first, and scalable.

🚀 Features

🎧 Add and manage playlists

🌳 Visualize song relationships through a dynamic node tree

💾 Persistent local storage powered by SQLite + Prisma ORM

⚡ Fast UI built with React + Vite

🧩 Modular Electron backend with IPC communication

🧩 Tech Stack
Layer Tech
Frontend React + Vite
Backend Electron + Node.js
Database Prisma ORM with SQLite (local)
Language TypeScript
Build Tool Vite + Electron Builder
🧱 Project Setup
1️⃣ Prerequisites

Make sure you have:

Node.js
(v18 or newer)

npm (comes with Node)

git

2️⃣ Clone the Repository
git clone https://github.com/YOUR_USERNAME/music-tree.git
cd music-tree

3️⃣ Install Dependencies
npm install

4️⃣ Environment Setup

Create a .env file in the project root:

DATABASE_URL="file:./dev.db"

This uses a local SQLite database.
(You can later switch to PostgreSQL, Supabase, or another provider.)

5️⃣ Initialize Prisma

Generate the Prisma client and sync the schema to your database:

npx prisma generate
npx prisma db push

To visually explore your database:

npx prisma studio

6️⃣ Run in Development

Start the Electron + React dev environment:

npm run dev

This will:

Start the Vite dev server

Launch Electron

Open your Music Tree window

7️⃣ Build for Production

Create a packaged production build:

npm run build
npm run start

🧠 Architecture Overview
music-tree/
├── src/
│ ├── main/ # Electron main process (backend)
│ ├── preload/ # Secure IPC bridge between renderer and main
│ ├── renderer/ # React frontend (Vite)
├── prisma/
│ ├── schema.prisma # Database schema definition
│ ├── dev.db # Local SQLite database
├── public/ # Static assets
├── package.json
└── README.md

🧰 Common Commands
Command Description
npm run dev Start app in development
npm run build Build the app for production
npm run start Run the built app
npx prisma studio Open Prisma data viewer
npx prisma db push Push schema changes to the database
🤝 Contributing

Contributions are welcome!

Fork the repo

Create your feature branch (git checkout -b feature/awesome-idea)

Commit your changes (git commit -m 'Add some feature')

Push to the branch (git push origin feature/awesome-idea)

Open a Pull Request 🎉

🧾 License

MIT License © 2025 Dillan Merchant

<!--
## 🚨 Be aware

This template integrates Node.js API to the renderer process by default. If you want to follow **Electron Security Concerns** you might want to disable this feature. You will have to expose needed API by yourself.

To get started, remove the option as shown below. This will [modify the Vite configuration and disable this feature](https://github.com/electron-vite/vite-plugin-electron-renderer#config-presets-opinionated).

```diff
# vite.config.ts

export default {
  plugins: [
    ...
-   // Use Node.js API in the Renderer-process
-   renderer({
-     nodeIntegration: true,
-   }),
    ...
  ],
}
```
-->

## 🔧 Additional features

1. electron-updater 👉 [see docs](src/components/update/README.md)
1. playwright

## ❔ FAQ

- [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
- [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)
