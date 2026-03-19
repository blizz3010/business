import { pgPool } from '../db/index.js';
import { normalizeCategory } from './categoryService.js';

const UPSERT_BATCH_SIZE = 500;

export async function upsertBusinesses(businesses) {
  if (!Array.isArray(businesses) || businesses.length === 0) return;

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    for (let start = 0; start < businesses.length; start += UPSERT_BATCH_SIZE) {
      const batch = businesses.slice(start, start + UPSERT_BATCH_SIZE);
      const values = [];
      const placeholders = batch.map((b, index) => {
        const offset = index * 11;
        values.push(
          b.place_id,
          b.name,
          b.category,
          normalizeCategory(b.category),
          b.lat,
          b.lng,
          b.rating ?? null,
          b.review_count ?? 0,
          b.address ?? null,
          b.street ?? null,
          b.city ?? 'Orlando'
        );
        return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11})`;
      });

      await client.query(
        `INSERT INTO businesses (place_id, name, category, normalized_category, lat, lng, rating, review_count, address, street, city)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (place_id)
         DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          normalized_category = EXCLUDED.normalized_category,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          rating = EXCLUDED.rating,
          review_count = EXCLUDED.review_count,
          address = EXCLUDED.address,
          street = EXCLUDED.street,
          city = EXCLUDED.city`,
        values
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function queryBusinessesInRadius(lat, lng, radiusMeters) {
  const approxDegree = radiusMeters / 111_320;
  const radiusKm = radiusMeters / 1000;
  const result = await pgPool.query(
    `SELECT *,
            (
              6371 * ACOS(
                GREATEST(-1, LEAST(1,
                  COS(RADIANS($1)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS($2)) +
                  SIN(RADIANS($1)) * SIN(RADIANS(lat))
                ))
              )
            ) AS distance_km
     FROM businesses
     WHERE lat BETWEEN $2 AND $3
       AND lng BETWEEN $4 AND $5`,
    [lat, lat - approxDegree, lat + approxDegree, lng - approxDegree, lng + approxDegree]
  );
  return result.rows.filter((row) => Number(row.distance_km) <= radiusKm);
}
