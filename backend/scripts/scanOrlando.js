import dotenv from 'dotenv';
import { pgPool } from '../src/db/index.js';
import { generateOrlandoTiles } from '../src/services/gridService.js';
import { fetchBusinessesByTile } from '../src/services/googlePlacesService.js';
import { upsertBusinesses } from '../src/services/businessService.js';

dotenv.config();

async function ensureScannedTilesTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS scanned_tiles (
      tile_key TEXT PRIMARY KEY,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      businesses_found INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function tileKey(tile) {
  return `${tile.lat.toFixed(6)}:${tile.lng.toFixed(6)}:${tile.radius}`;
}

async function scanOrlando() {
  await ensureScannedTilesTable();

  const tiles = generateOrlandoTiles();
  console.log(`Scanning ${tiles.length} Orlando tiles...`);

  for (const [index, tile] of tiles.entries()) {
    const key = tileKey(tile);

    try {
      const prior = await pgPool.query('SELECT tile_key FROM scanned_tiles WHERE tile_key = $1', [key]);
      if (prior.rowCount > 0) {
        console.log(`Tile ${index + 1}/${tiles.length}: already scanned, skipping`);
        continue;
      }

      const businesses = await fetchBusinessesByTile(tile);
      await upsertBusinesses(businesses);
      await pgPool.query(
        `INSERT INTO scanned_tiles (tile_key, businesses_found)
         VALUES ($1, $2)
         ON CONFLICT (tile_key) DO UPDATE
         SET scanned_at = NOW(), businesses_found = EXCLUDED.businesses_found`,
        [key, businesses.length]
      );

      console.log(`Tile ${index + 1}/${tiles.length}: stored ${businesses.length} businesses`);
      await wait(250);
    } catch (error) {
      console.error(`Tile ${index + 1} failed:`, error.message);
    }
  }

  console.log('Scan complete.');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

scanOrlando()
  .catch((error) => {
    console.error('Orlando scan aborted:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
