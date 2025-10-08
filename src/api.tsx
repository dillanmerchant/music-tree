import { ipcMain } from 'electron'
import prisma from './db'

// Fetch all playlists
ipcMain.handle('get-playlists', async () => {
    return await prisma.playlist.findMany({
        include: { songs: true }
    })
})

// Create a new playlist
ipcMain.handle('create-playlist', async (_, name: string) => {
  return await prisma.playlist.create({
    data: { name }
  })
})

// Get songs in a playlist
ipcMain.handle('get-songs', async (_, playlistId: number) => {
  return await prisma.song.findMany({
    where: { playlistId },
    include: { connections: true }
  })
})

// Add a song to a playlist
ipcMain.handle('add-song', async (_, playlistId: number, title: string, filePath: string) => {
  return await prisma.song.create({
    data: { title, filePath, playlistId }
  })
})

ipcMain.handle('get-song-connections', async (_, songId: string) => {
  const connections = await prisma.connection.findMany({
    where: { fromId: songId },
    include: { to: true },
  });
  return connections; // returns all nodes this song connects to
});
