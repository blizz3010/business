-- Migration 002: Add subcategory column and text search support

-- Add subcategory column
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Create indexes for subcategory and name search
CREATE INDEX IF NOT EXISTS idx_businesses_subcategory ON businesses(subcategory);
CREATE INDEX IF NOT EXISTS idx_businesses_viewport_subcategory ON businesses(subcategory, lat, lng);
CREATE INDEX IF NOT EXISTS idx_businesses_name_lower ON businesses(LOWER(name));

-- Backfill subcategory from category + name using pattern matching
-- This is a broad SQL CASE that maps raw categories and business names to subcategories.
-- The JS backfill script (backfillSubcategories.js) does a more thorough job using the full
-- normalizeSubcategory() function; this SQL handles the most common cases for initial setup.

UPDATE businesses
SET subcategory = CASE
  -- Food & Dining
  WHEN normalized_category = 'Food & Dining' AND (LOWER(name) LIKE '%mcdonald%' OR LOWER(name) LIKE '%burger king%' OR LOWER(name) LIKE '%wendy%' OR LOWER(name) LIKE '%taco bell%' OR LOWER(name) LIKE '%chick-fil-a%' OR LOWER(name) LIKE '%popeye%' OR LOWER(name) LIKE '%kfc%' OR LOWER(name) LIKE '%panda express%' OR LOWER(name) LIKE '%chipotle%' OR LOWER(category) LIKE '%fast_food%' OR LOWER(category) LIKE '%meal_takeaway%') THEN 'Fast Food'
  WHEN normalized_category = 'Food & Dining' AND (LOWER(name) LIKE '%pizza%' OR LOWER(name) LIKE '%domino%' OR LOWER(name) LIKE '%papa john%' OR LOWER(category) LIKE '%pizza%') THEN 'Pizza'
  WHEN normalized_category = 'Food & Dining' AND (LOWER(name) LIKE '%starbucks%' OR LOWER(name) LIKE '%dunkin%' OR LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%cafe%' OR LOWER(category) LIKE '%cafe%' OR LOWER(category) LIKE '%coffee%') THEN 'Coffee Shop'
  WHEN normalized_category = 'Food & Dining' AND (LOWER(name) LIKE '%bakery%' OR LOWER(name) LIKE '%donut%' OR LOWER(category) LIKE '%bakery%') THEN 'Bakery'
  WHEN normalized_category = 'Food & Dining' AND (LOWER(name) LIKE '%ice cream%' OR LOWER(name) LIKE '%frozen yogurt%' OR LOWER(name) LIKE '%dairy queen%' OR LOWER(category) LIKE '%ice_cream%') THEN 'Ice Cream & Dessert'
  WHEN normalized_category = 'Food & Dining' THEN 'Restaurant'

  -- Automotive
  WHEN normalized_category = 'Automotive' AND (LOWER(name) LIKE '%shell%' OR LOWER(name) LIKE '%chevron%' OR LOWER(name) LIKE '%exxon%' OR LOWER(name) LIKE '%bp %' OR LOWER(category) LIKE '%gas_station%') THEN 'Gas Station'
  WHEN normalized_category = 'Automotive' AND (LOWER(name) LIKE '%tire%' OR LOWER(category) LIKE '%tire%') THEN 'Tire Shop'
  WHEN normalized_category = 'Automotive' AND (LOWER(name) LIKE '%oil change%' OR LOWER(name) LIKE '%jiffy lube%' OR LOWER(name) LIKE '%valvoline%' OR LOWER(category) LIKE '%oil_change%') THEN 'Oil Change'
  WHEN normalized_category = 'Automotive' AND (LOWER(name) LIKE '%dealer%' OR LOWER(category) LIKE '%car_dealer%') THEN 'Auto Dealer'
  WHEN normalized_category = 'Automotive' AND (LOWER(name) LIKE '%auto repair%' OR LOWER(name) LIKE '%mechanic%' OR LOWER(category) LIKE '%car_repair%') THEN 'Auto Repair'
  WHEN normalized_category = 'Automotive' THEN 'Auto Service'

  -- Health
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%dental%' OR LOWER(name) LIKE '%dentist%' OR LOWER(category) LIKE '%dentist%') THEN 'Dentist'
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%pharmacy%' OR LOWER(name) LIKE '%cvs%' OR LOWER(name) LIKE '%walgreens%' OR LOWER(category) LIKE '%pharmacy%') THEN 'Pharmacy'
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%hospital%' OR LOWER(category) LIKE '%hospital%') THEN 'Hospital'
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%urgent care%' OR LOWER(name) LIKE '%walk-in%') THEN 'Urgent Care'
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%eye%' OR LOWER(name) LIKE '%vision%' OR LOWER(name) LIKE '%optical%' OR LOWER(category) LIKE '%optometrist%') THEN 'Optometrist'
  WHEN normalized_category = 'Health' AND (LOWER(name) LIKE '%chiropractic%' OR LOWER(category) LIKE '%chiropractor%') THEN 'Chiropractor'
  WHEN normalized_category = 'Health' THEN 'Clinic'

  -- Beauty & Salon
  WHEN normalized_category = 'Beauty & Salon' AND (LOWER(name) LIKE '%barber%' OR LOWER(category) LIKE '%barber%') THEN 'Barbershop'
  WHEN normalized_category = 'Beauty & Salon' AND (LOWER(name) LIKE '%nail%' OR LOWER(category) LIKE '%nail%') THEN 'Nail Salon'
  WHEN normalized_category = 'Beauty & Salon' AND (LOWER(name) LIKE '%spa%' OR LOWER(name) LIKE '%massage%' OR LOWER(category) LIKE '%spa%') THEN 'Spa'
  WHEN normalized_category = 'Beauty & Salon' THEN 'Hair Salon'

  -- Education
  WHEN normalized_category = 'Education' AND (LOWER(name) LIKE '%daycare%' OR LOWER(name) LIKE '%day care%' OR LOWER(name) LIKE '%childcare%' OR LOWER(name) LIKE '%kindercare%' OR LOWER(category) LIKE '%daycare%') THEN 'Daycare'
  WHEN normalized_category = 'Education' AND (LOWER(name) LIKE '%preschool%' OR LOWER(name) LIKE '%pre-school%' OR LOWER(name) LIKE '%montessori%' OR LOWER(category) LIKE '%preschool%') THEN 'Preschool'
  WHEN normalized_category = 'Education' AND (LOWER(name) LIKE '%tutor%' OR LOWER(name) LIKE '%kumon%' OR LOWER(category) LIKE '%tutor%') THEN 'Tutoring'
  WHEN normalized_category = 'Education' THEN 'School'

  -- Retail
  WHEN normalized_category = 'Retail' AND (LOWER(name) LIKE '%publix%' OR LOWER(name) LIKE '%walmart%' OR LOWER(name) LIKE '%grocery%' OR LOWER(name) LIKE '%aldi%' OR LOWER(category) LIKE '%grocery%' OR LOWER(category) LIKE '%supermarket%') THEN 'Grocery Store'
  WHEN normalized_category = 'Retail' AND (LOWER(name) LIKE '%7-eleven%' OR LOWER(name) LIKE '%circle k%' OR LOWER(name) LIKE '%convenience%' OR LOWER(name) LIKE '%dollar general%' OR LOWER(category) LIKE '%convenience%') THEN 'Convenience Store'
  WHEN normalized_category = 'Retail' THEN 'General Retail'

  -- Fitness
  WHEN normalized_category = 'Fitness' AND (LOWER(name) LIKE '%yoga%' OR LOWER(category) LIKE '%yoga%') THEN 'Yoga Studio'
  WHEN normalized_category = 'Fitness' AND (LOWER(name) LIKE '%crossfit%') THEN 'CrossFit'
  WHEN normalized_category = 'Fitness' AND (LOWER(name) LIKE '%martial%' OR LOWER(name) LIKE '%karate%' OR LOWER(name) LIKE '%boxing%' OR LOWER(name) LIKE '%mma%') THEN 'Martial Arts'
  WHEN normalized_category = 'Fitness' THEN 'Gym'

  -- Default: use parent category
  ELSE COALESCE(normalized_category, 'Services')
END
WHERE subcategory IS NULL;

-- Set defaults
ALTER TABLE businesses ALTER COLUMN subcategory SET NOT NULL;
ALTER TABLE businesses ALTER COLUMN subcategory SET DEFAULT 'Services';
