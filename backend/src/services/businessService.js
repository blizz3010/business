import { pgPool } from '../db/index.js';

export async function upsertBusinesses(businesses) {
  for (const b of businesses) {
    await pgPool.query(
      `INSERT INTO businesses (place_id, name, category, lat, lng, rating, review_count, address, street, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (place_id)
       DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        address = EXCLUDED.address,
        street = EXCLUDED.street,
        city = EXCLUDED.city`,
      [b.place_id, b.name, b.category, b.lat, b.lng, b.rating, b.review_count, b.address, b.street, b.city]
    );
  }
}

export async function queryBusinessesInRadius(lat, lng, radiusMeters) {
  const approxDegree = radiusMeters / 111_320;
  const result = await pgPool.query(
    `SELECT * FROM businesses
     WHERE lat BETWEEN $1 AND $2
       AND lng BETWEEN $3 AND $4`,
    [lat - approxDegree, lat + approxDegree, lng - approxDegree, lng + approxDegree]
  );
  return result.rows;
}
