const CATEGORY_GROUPS = [
  { group: 'Food & Dining', matches: ['restaurant', 'food', 'cafe'] },
  { group: 'Automotive', matches: ['gas_station', 'auto', 'car', 'tire'] },
  { group: 'Health', matches: ['dentist', 'doctor', 'hospital', 'medical', 'pharmacy'] },
  { group: 'Retail', matches: ['store', 'supermarket', 'market', 'grocery', 'shop'] },
  { group: 'Fitness', matches: ['gym', 'fitness'] }
];

export function normalizeCategory(rawCategory) {
  if (!rawCategory) return 'Services';

  const category = String(rawCategory).toLowerCase();

  const match = CATEGORY_GROUPS.find((entry) => entry.matches.some((keyword) => category.includes(keyword)));
  return match ? match.group : 'Services';
}

export const CATEGORY_SQL_CASE = `
  CASE
    WHEN LOWER(category) LIKE '%restaurant%' OR LOWER(category) LIKE '%food%' OR LOWER(category) LIKE '%cafe%' THEN 'Food & Dining'
    WHEN LOWER(category) LIKE '%gas_station%' OR LOWER(category) LIKE '%auto%' OR LOWER(category) LIKE '%car%' OR LOWER(category) LIKE '%tire%' THEN 'Automotive'
    WHEN LOWER(category) LIKE '%dentist%' OR LOWER(category) LIKE '%doctor%' OR LOWER(category) LIKE '%hospital%' OR LOWER(category) LIKE '%medical%' OR LOWER(category) LIKE '%pharmacy%' THEN 'Health'
    WHEN LOWER(category) LIKE '%store%' OR LOWER(category) LIKE '%supermarket%' OR LOWER(category) LIKE '%market%' OR LOWER(category) LIKE '%grocery%' OR LOWER(category) LIKE '%shop%' THEN 'Retail'
    WHEN LOWER(category) LIKE '%gym%' OR LOWER(category) LIKE '%fitness%' THEN 'Fitness'
    ELSE 'Services'
  END
`;
