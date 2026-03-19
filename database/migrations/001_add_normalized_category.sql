ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS normalized_category TEXT;

UPDATE businesses
SET normalized_category = CASE
  WHEN LOWER(category) LIKE '%restaurant%' OR LOWER(category) LIKE '%food%' OR LOWER(category) LIKE '%cafe%' THEN 'Food & Dining'
  WHEN LOWER(category) LIKE '%gas_station%' OR LOWER(category) LIKE '%auto%' OR LOWER(category) LIKE '%car%' OR LOWER(category) LIKE '%tire%' THEN 'Automotive'
  WHEN LOWER(category) LIKE '%dentist%' OR LOWER(category) LIKE '%doctor%' OR LOWER(category) LIKE '%hospital%' OR LOWER(category) LIKE '%medical%' OR LOWER(category) LIKE '%pharmacy%' THEN 'Health'
  WHEN LOWER(category) LIKE '%store%' OR LOWER(category) LIKE '%supermarket%' OR LOWER(category) LIKE '%market%' OR LOWER(category) LIKE '%grocery%' OR LOWER(category) LIKE '%shop%' THEN 'Retail'
  WHEN LOWER(category) LIKE '%gym%' OR LOWER(category) LIKE '%fitness%' THEN 'Fitness'
  ELSE 'Services'
END
WHERE normalized_category IS NULL;

ALTER TABLE businesses
ALTER COLUMN normalized_category SET NOT NULL,
ALTER COLUMN normalized_category SET DEFAULT 'Services';

CREATE INDEX IF NOT EXISTS idx_businesses_normalized_category ON businesses(normalized_category);
CREATE INDEX IF NOT EXISTS idx_businesses_viewport_normalized ON businesses(normalized_category, lat, lng);
CREATE INDEX IF NOT EXISTS idx_businesses_opportunity_filters ON businesses(review_count, rating);
