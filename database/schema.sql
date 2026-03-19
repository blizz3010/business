CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  normalized_category TEXT NOT NULL DEFAULT 'Services',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  rating DOUBLE PRECISION,
  review_count INTEGER NOT NULL DEFAULT 0,
  address TEXT,
  street TEXT,
  city TEXT NOT NULL DEFAULT 'Orlando'
);

CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_category ON businesses(normalized_category);
CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng ON businesses(lat, lng);
CREATE INDEX IF NOT EXISTS idx_businesses_viewport_normalized ON businesses(normalized_category, lat, lng);
CREATE INDEX IF NOT EXISTS idx_businesses_opportunity_filters ON businesses(review_count, rating);
