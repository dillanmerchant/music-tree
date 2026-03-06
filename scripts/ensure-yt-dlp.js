#!/usr/bin/env node
/**
 * Downloads the latest yt-dlp binaries for macOS and Windows into build/bin/
 * so packaged apps work on all target machines without relying on node_modules paths.
 * - macOS: yt-dlp_macos (universal Intel + Apple Silicon) -> build/bin/yt-dlp
 * - Windows: yt-dlp.exe -> build/bin/yt-dlp.exe
 * Run before electron-builder when building the app.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const BUILD_BIN = path.join(__dirname, '..', 'build', 'bin');
const RELEASE_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

const ASSETS = [
  { name: 'yt-dlp_macos', dest: 'yt-dlp' },
  { name: 'yt-dlp.exe', dest: 'yt-dlp.exe' }
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'Music-Tree-Build' } };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'Music-Tree-Build' } };
    const file = fs.createWriteStream(destPath, { mode: 0o755 });
    https.get(url, opts, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location;
        if (loc) return download(loc.startsWith('http') ? loc : new URL(loc, url).href, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

async function main() {
  try {
    const release = await fetchJson(RELEASE_URL);
    const assets = release.assets || [];
    fs.mkdirSync(BUILD_BIN, { recursive: true });

    for (const { name, dest } of ASSETS) {
      const asset = assets.find((a) => a.name === name);
      if (!asset) {
        console.warn('ensure-yt-dlp: no', name, 'in latest release, skipping');
        continue;
      }
      const destPath = path.join(BUILD_BIN, dest);
      console.log('ensure-yt-dlp: downloading', name, '->', destPath);
      await download(asset.browser_download_url, destPath);
      fs.chmodSync(destPath, 0o755);
      console.log('ensure-yt-dlp: saved', dest);
    }
  } catch (err) {
    console.warn('ensure-yt-dlp: failed', err.message);
    process.exitCode = 1;
  }
}

main();
