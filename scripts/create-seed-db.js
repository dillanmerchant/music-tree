/**
 * Creates a fresh seed database with the correct schema applied.
 * This DB is bundled with the packaged app as an extraResource so
 * first-launch users get a DB with all tables already created.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const seedDbPath = path.join(__dirname, '..', 'prisma', 'music-tree.db');

// Remove any existing seed DB so we get a clean one
if (fs.existsSync(seedDbPath)) {
  fs.unlinkSync(seedDbPath);
}

console.log('Creating fresh seed database...');
execSync('npx prisma db push --accept-data-loss', {
  env: { ...process.env, DATABASE_URL: `file:${seedDbPath}` },
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

console.log('Seed database created at:', seedDbPath);
