import dotenv from 'dotenv';
import pg from 'pg';
import { normalizeCategory, normalizeSubcategory } from '../src/services/categoryService.js';

dotenv.config();

const { Pool } = pg;

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 500;

async function backfillSubcategories() {
  console.log('Starting subcategory backfill...');

  // Ensure subcategory column exists
  await pgPool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subcategory TEXT`);

  // Count total businesses
  const countResult = await pgPool.query('SELECT COUNT(*) as total FROM businesses');
  const total = parseInt(countResult.rows[0].total, 10);
  console.log(`Total businesses to process: ${total}`);

  let processed = 0;
  let updated = 0;

  // Process in batches
  while (processed < total) {
    const result = await pgPool.query(
      `SELECT id, name, category, normalized_category, subcategory
       FROM businesses
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, processed]
    );

    if (result.rows.length === 0) break;

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      for (const row of result.rows) {
        const newNormalizedCategory = normalizeCategory(row.category);
        const newSubcategory = normalizeSubcategory(row.category, row.name);

        // Update if subcategory is missing or if recalculation changes it
        if (row.subcategory !== newSubcategory || row.normalized_category !== newNormalizedCategory) {
          await client.query(
            `UPDATE businesses SET subcategory = $1, normalized_category = $2 WHERE id = $3`,
            [newSubcategory, newNormalizedCategory, row.id]
          );
          updated++;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error processing batch at offset ${processed}:`, error.message);
    } finally {
      client.release();
    }

    processed += result.rows.length;
    console.log(`Processed ${processed}/${total} (${updated} updated)`);
  }

  // Set NOT NULL and default
  await pgPool.query(`
    UPDATE businesses SET subcategory = normalized_category WHERE subcategory IS NULL
  `);
  await pgPool.query(`
    ALTER TABLE businesses ALTER COLUMN subcategory SET NOT NULL;
  `);
  await pgPool.query(`
    ALTER TABLE businesses ALTER COLUMN subcategory SET DEFAULT 'Services';
  `);

  // Create indexes
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_subcategory ON businesses(subcategory)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_viewport_subcategory ON businesses(subcategory, lat, lng)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_name_lower ON businesses(LOWER(name))');

  console.log(`\nBackfill complete! ${updated} businesses updated out of ${total}.`);

  // Show subcategory distribution
  const stats = await pgPool.query(`
    SELECT subcategory, COUNT(*) as total
    FROM businesses
    GROUP BY subcategory
    ORDER BY total DESC
    LIMIT 30
  `);
  console.log('\nTop subcategories:');
  for (const row of stats.rows) {
    console.log(`  ${row.subcategory}: ${row.total}`);
  }

  await pgPool.end();
}

backfillSubcategories().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
