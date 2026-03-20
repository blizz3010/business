const CATEGORY_GROUPS = [
  { group: 'Food & Dining', matches: ['restaurant', 'food', 'cafe', 'bakery', 'pizza', 'coffee'] },
  { group: 'Automotive', matches: ['gas_station', 'auto', 'car', 'tire', 'mechanic', 'oil_change', 'transmission'] },
  { group: 'Car Wash', matches: ['car_wash', 'detailing', 'wash'] },
  { group: 'Health', matches: ['dentist', 'doctor', 'hospital', 'medical', 'pharmacy', 'clinic', 'optometrist', 'chiropractor'] },
  { group: 'Beauty & Salon', matches: ['salon', 'barber', 'spa', 'nail', 'hair', 'beauty', 'cosmetic'] },
  { group: 'Retail', matches: ['store', 'supermarket', 'market', 'grocery', 'shop', 'mall', 'outlet'] },
  { group: 'Fitness', matches: ['gym', 'fitness', 'yoga', 'pilates', 'crossfit'] },
  { group: 'Home Services', matches: ['plumber', 'electrician', 'hvac', 'roofing', 'landscaping', 'cleaning', 'pest_control', 'locksmith'] },
  { group: 'Pet Services', matches: ['veterinar', 'pet', 'grooming', 'kennel', 'animal'] },
  { group: 'Education', matches: ['school', 'tutor', 'daycare', 'preschool', 'learning', 'training'] },
  { group: 'Entertainment', matches: ['theater', 'cinema', 'bowling', 'arcade', 'amusement', 'recreation'] }
];

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function assertSafeMatcher(keyword) {
  if (!/^[a-z0-9_\s-]+$/i.test(keyword)) {
    throw new Error(`Unsafe category matcher: ${keyword}`);
  }
}

function toSqlLikeCondition(matchers, categoryColumn = 'category') {
  return matchers
    .map((keyword) => {
      assertSafeMatcher(keyword);
      const escapedKeyword = escapeSqlLiteral(keyword.toLowerCase());
      return `LOWER(${categoryColumn}) LIKE '%${escapedKeyword}%'`;
    })
    .join(' OR ');
}

export function normalizeCategory(rawCategory) {
  if (!rawCategory) return 'Services';

  const category = String(rawCategory).toLowerCase();

  const match = CATEGORY_GROUPS.find((entry) => entry.matches.some((keyword) => category.includes(keyword)));
  return match ? match.group : 'Services';
}

export function getCategoryNormalizationSqlExpression(categoryColumn = 'category') {
  const statements = CATEGORY_GROUPS.map(
    (group) => `WHEN ${toSqlLikeCondition(group.matches, categoryColumn)} THEN '${escapeSqlLiteral(group.group)}'`
  ).join('\n    ');

  return `
  CASE
    ${statements}
    ELSE 'Services'
  END
`;
}

export const CATEGORY_SQL_CASE = getCategoryNormalizationSqlExpression();
