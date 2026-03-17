import dotenv from 'dotenv';
import { generateOrlandoTiles } from '../src/services/gridService.js';
import { fetchBusinessesByTile } from '../src/services/googlePlacesService.js';
import { upsertBusinesses } from '../src/services/businessService.js';

dotenv.config();

async function scanOrlando() {
  const tiles = generateOrlandoTiles();
  console.log(`Scanning ${tiles.length} Orlando tiles...`);

  for (const [index, tile] of tiles.entries()) {
    try {
      const businesses = await fetchBusinessesByTile(tile);
      await upsertBusinesses(businesses);
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

scanOrlando();
