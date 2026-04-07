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

// Subcategory mappings — checked against raw category AND business name
const SUBCATEGORY_RULES = [
  // Food & Dining subcategories
  { subcategory: 'Fast Food', categoryMatch: 'Food & Dining', namePatterns: ['mcdonald', 'burger king', 'wendy', 'taco bell', 'chick-fil-a', 'popeye', 'sonic', 'jack in the box', 'whataburger', 'five guys', 'in-n-out', 'carl\'s jr', 'hardee', 'arby', 'rally', 'checkers', 'white castle', 'wingstop', 'zaxby', 'raising cane', 'panda express', 'chipotle', 'qdoba', 'del taco', 'church\'s', 'kfc', 'bojangle'], rawPatterns: ['fast_food', 'meal_takeaway'] },
  { subcategory: 'Pizza', categoryMatch: 'Food & Dining', namePatterns: ['pizza', 'domino', 'papa john', 'little caesar', 'papa murphy'], rawPatterns: ['pizza'] },
  { subcategory: 'Coffee Shop', categoryMatch: 'Food & Dining', namePatterns: ['starbucks', 'dunkin', 'coffee', 'espresso', 'cafe', 'café', 'dutch bros', 'peet\'s'], rawPatterns: ['cafe', 'coffee'] },
  { subcategory: 'Bakery', categoryMatch: 'Food & Dining', namePatterns: ['bakery', 'bake', 'donut', 'doughnut', 'pastry', 'bread', 'krispy kreme', 'panera'], rawPatterns: ['bakery'] },
  { subcategory: 'Ice Cream & Dessert', categoryMatch: 'Food & Dining', namePatterns: ['ice cream', 'frozen yogurt', 'gelato', 'baskin', 'cold stone', 'dairy queen', 'smoothie', 'jamba', 'yogurt'], rawPatterns: ['ice_cream'] },
  { subcategory: 'Bar & Nightlife', categoryMatch: 'Food & Dining', namePatterns: ['bar ', 'pub ', 'grill & bar', 'tavern', 'brewery', 'lounge', 'nightclub', 'sports bar'], rawPatterns: ['bar', 'night_club'] },
  { subcategory: 'Fine Dining', categoryMatch: 'Food & Dining', namePatterns: ['steakhouse', 'steak house', 'ruth\'s chris', 'capital grille', 'morton\'s', 'flemming'], rawPatterns: [] },
  { subcategory: 'Restaurant', categoryMatch: 'Food & Dining', namePatterns: [], rawPatterns: ['restaurant', 'food'] },

  // Automotive subcategories
  { subcategory: 'Gas Station', categoryMatch: 'Automotive', namePatterns: ['shell', 'chevron', 'exxon', 'mobil', 'bp ', 'sunoco', 'citgo', 'marathon', 'speedway', 'wawa', 'racetrac', 'quick trip', 'quiktrip', '7-eleven', 'circle k', 'murphy'], rawPatterns: ['gas_station'] },
  { subcategory: 'Auto Repair', categoryMatch: 'Automotive', namePatterns: ['auto repair', 'mechanic', 'muffler', 'brake', 'meineke', 'midas', 'pep boys', 'firestone', 'aamco', 'maaco', 'caliber collision', 'service king'], rawPatterns: ['car_repair', 'mechanic'] },
  { subcategory: 'Tire Shop', categoryMatch: 'Automotive', namePatterns: ['tire', 'discount tire', 'goodyear', 'ntb ', 'belle tire'], rawPatterns: ['tire'] },
  { subcategory: 'Oil Change', categoryMatch: 'Automotive', namePatterns: ['oil change', 'jiffy lube', 'valvoline', 'take 5', 'express lube', 'quick lube'], rawPatterns: ['oil_change'] },
  { subcategory: 'Auto Dealer', categoryMatch: 'Automotive', namePatterns: ['dealer', 'toyota', 'honda', 'ford', 'chevrolet', 'chevy', 'nissan', 'hyundai', 'kia', 'bmw', 'mercedes', 'audi', 'lexus', 'volkswagen', 'subaru', 'mazda', 'jeep', 'dodge', 'ram ', 'chrysler', 'buick', 'gmc', 'cadillac', 'volvo', 'acura', 'infiniti', 'tesla', 'carmax', 'carvana', 'autozone', 'o\'reilly'], rawPatterns: ['car_dealer'] },
  { subcategory: 'Auto Parts', categoryMatch: 'Automotive', namePatterns: ['auto parts', 'autozone', 'o\'reilly', 'advance auto', 'napa '], rawPatterns: ['auto_parts'] },
  { subcategory: 'Transmission', categoryMatch: 'Automotive', namePatterns: ['transmission'], rawPatterns: ['transmission'] },
  { subcategory: 'Auto Service', categoryMatch: 'Automotive', namePatterns: [], rawPatterns: ['auto', 'car'] },

  // Car Wash subcategories
  { subcategory: 'Car Wash', categoryMatch: 'Car Wash', namePatterns: ['car wash', 'wash'], rawPatterns: ['car_wash', 'wash'] },
  { subcategory: 'Auto Detailing', categoryMatch: 'Car Wash', namePatterns: ['detail', 'detailing'], rawPatterns: ['detailing'] },

  // Health subcategories
  { subcategory: 'Dentist', categoryMatch: 'Health', namePatterns: ['dental', 'dentist', 'orthodont', 'oral surgery'], rawPatterns: ['dentist'] },
  { subcategory: 'Doctor', categoryMatch: 'Health', namePatterns: ['doctor', 'physician', 'medical center', 'family medicine', 'primary care', 'internal medicine'], rawPatterns: ['doctor'] },
  { subcategory: 'Hospital', categoryMatch: 'Health', namePatterns: ['hospital', 'medical center', 'emergency', 'er '], rawPatterns: ['hospital'] },
  { subcategory: 'Pharmacy', categoryMatch: 'Health', namePatterns: ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'drug store', 'drugstore'], rawPatterns: ['pharmacy'] },
  { subcategory: 'Urgent Care', categoryMatch: 'Health', namePatterns: ['urgent care', 'walk-in', 'walk in clinic', 'minuteclinic', 'centra care'], rawPatterns: ['urgent_care'] },
  { subcategory: 'Optometrist', categoryMatch: 'Health', namePatterns: ['eye', 'vision', 'optical', 'optometrist', 'lenscrafters', 'pearle vision'], rawPatterns: ['optometrist', 'optician'] },
  { subcategory: 'Chiropractor', categoryMatch: 'Health', namePatterns: ['chiropractic', 'chiropractor'], rawPatterns: ['chiropractor'] },
  { subcategory: 'Clinic', categoryMatch: 'Health', namePatterns: ['clinic'], rawPatterns: ['clinic', 'medical'] },

  // Beauty & Salon subcategories
  { subcategory: 'Barbershop', categoryMatch: 'Beauty & Salon', namePatterns: ['barber', 'barbershop', 'barber shop', 'men\'s cut', 'fades'], rawPatterns: ['barber'] },
  { subcategory: 'Hair Salon', categoryMatch: 'Beauty & Salon', namePatterns: ['hair', 'salon', 'supercuts', 'great clips', 'sport clips', 'fantastic sams', 'hair cuttery', 'ulta'], rawPatterns: ['hair_care', 'salon'] },
  { subcategory: 'Nail Salon', categoryMatch: 'Beauty & Salon', namePatterns: ['nail', 'manicure', 'pedicure'], rawPatterns: ['nail'] },
  { subcategory: 'Spa', categoryMatch: 'Beauty & Salon', namePatterns: ['spa', 'massage', 'facial', 'wax', 'european wax', 'hand & stone'], rawPatterns: ['spa'] },
  { subcategory: 'Beauty Supply', categoryMatch: 'Beauty & Salon', namePatterns: ['beauty supply', 'cosmetic', 'sally beauty', 'sephora'], rawPatterns: ['beauty', 'cosmetic'] },

  // Retail subcategories
  { subcategory: 'Grocery Store', categoryMatch: 'Retail', namePatterns: ['publix', 'kroger', 'aldi', 'trader joe', 'whole foods', 'walmart', 'target', 'winn-dixie', 'food lion', 'safeway', 'costco', 'sam\'s club', 'bj\'s', 'grocery'], rawPatterns: ['grocery', 'supermarket'] },
  { subcategory: 'Convenience Store', categoryMatch: 'Retail', namePatterns: ['7-eleven', 'circle k', 'wawa', 'convenience', 'quickstop', 'dollar general', 'dollar tree', 'family dollar'], rawPatterns: ['convenience_store'] },
  { subcategory: 'Clothing Store', categoryMatch: 'Retail', namePatterns: ['clothing', 'fashion', 'apparel', 'outfit', 'dress', 'boutique', 'h&m', 'zara', 'old navy', 'gap ', 'forever 21', 'tjmaxx', 't.j. maxx', 'ross', 'marshalls', 'burlington'], rawPatterns: ['clothing_store'] },
  { subcategory: 'Electronics', categoryMatch: 'Retail', namePatterns: ['best buy', 'electronics', 'apple store', 'gamestop', 'computer', 'phone', 't-mobile', 'verizon', 'at&t'], rawPatterns: ['electronics_store'] },
  { subcategory: 'Hardware Store', categoryMatch: 'Retail', namePatterns: ['home depot', 'lowe\'s', 'lowes', 'hardware', 'ace hardware', 'menard'], rawPatterns: ['hardware_store'] },
  { subcategory: 'Shopping Mall', categoryMatch: 'Retail', namePatterns: ['mall', 'plaza', 'shopping center', 'outlet'], rawPatterns: ['shopping_mall'] },
  { subcategory: 'General Retail', categoryMatch: 'Retail', namePatterns: [], rawPatterns: ['store', 'shop', 'market'] },

  // Fitness subcategories
  { subcategory: 'Gym', categoryMatch: 'Fitness', namePatterns: ['gym', 'planet fitness', 'la fitness', 'gold\'s gym', 'anytime fitness', 'crunch', 'equinox', '24 hour fitness', 'orange theory', 'orangetheory', 'f45', 'snap fitness'], rawPatterns: ['gym'] },
  { subcategory: 'Yoga Studio', categoryMatch: 'Fitness', namePatterns: ['yoga', 'hot yoga', 'corepower'], rawPatterns: ['yoga'] },
  { subcategory: 'CrossFit', categoryMatch: 'Fitness', namePatterns: ['crossfit', 'cross fit'], rawPatterns: ['crossfit'] },
  { subcategory: 'Martial Arts', categoryMatch: 'Fitness', namePatterns: ['martial art', 'karate', 'taekwondo', 'jiu jitsu', 'bjj', 'boxing', 'mma', 'kickbox'], rawPatterns: ['martial_arts'] },
  { subcategory: 'Fitness Studio', categoryMatch: 'Fitness', namePatterns: ['pilates', 'barre', 'spin', 'cycle'], rawPatterns: ['fitness', 'pilates'] },

  // Home Services subcategories
  { subcategory: 'Plumber', categoryMatch: 'Home Services', namePatterns: ['plumb', 'plumber', 'plumbing'], rawPatterns: ['plumber'] },
  { subcategory: 'Electrician', categoryMatch: 'Home Services', namePatterns: ['electric', 'electrician', 'electrical'], rawPatterns: ['electrician'] },
  { subcategory: 'HVAC', categoryMatch: 'Home Services', namePatterns: ['hvac', 'air condition', 'heating', 'cooling', 'a/c'], rawPatterns: ['hvac'] },
  { subcategory: 'Roofing', categoryMatch: 'Home Services', namePatterns: ['roof', 'roofing'], rawPatterns: ['roofing'] },
  { subcategory: 'Landscaping', categoryMatch: 'Home Services', namePatterns: ['landscap', 'lawn', 'tree service', 'garden'], rawPatterns: ['landscaping'] },
  { subcategory: 'Cleaning Service', categoryMatch: 'Home Services', namePatterns: ['clean', 'maid', 'janitorial', 'pressure wash'], rawPatterns: ['cleaning'] },
  { subcategory: 'Pest Control', categoryMatch: 'Home Services', namePatterns: ['pest', 'exterminator', 'terminix', 'orkin'], rawPatterns: ['pest_control'] },
  { subcategory: 'Locksmith', categoryMatch: 'Home Services', namePatterns: ['locksmith', 'lock & key'], rawPatterns: ['locksmith'] },
  { subcategory: 'General Home Services', categoryMatch: 'Home Services', namePatterns: [], rawPatterns: [] },

  // Pet Services subcategories
  { subcategory: 'Veterinarian', categoryMatch: 'Pet Services', namePatterns: ['vet', 'veterinar', 'animal hospital', 'animal clinic'], rawPatterns: ['veterinar'] },
  { subcategory: 'Pet Store', categoryMatch: 'Pet Services', namePatterns: ['pet store', 'petsmart', 'petco', 'pet supply', 'pet supermarket'], rawPatterns: ['pet_store', 'pet'] },
  { subcategory: 'Pet Grooming', categoryMatch: 'Pet Services', namePatterns: ['groom', 'pet groom', 'dog groom'], rawPatterns: ['grooming'] },
  { subcategory: 'Boarding & Kennel', categoryMatch: 'Pet Services', namePatterns: ['kennel', 'boarding', 'doggy daycare', 'dog daycare', 'pet hotel'], rawPatterns: ['kennel'] },

  // Education subcategories
  { subcategory: 'Daycare', categoryMatch: 'Education', namePatterns: ['daycare', 'day care', 'childcare', 'child care', 'kindercare', 'kiddie', 'bright horizons', 'goddard', 'primrose', 'children\'s'], rawPatterns: ['daycare', 'preschool'] },
  { subcategory: 'Preschool', categoryMatch: 'Education', namePatterns: ['preschool', 'pre-school', 'pre school', 'montessori', 'head start'], rawPatterns: ['preschool'] },
  { subcategory: 'Tutoring', categoryMatch: 'Education', namePatterns: ['tutor', 'kumon', 'mathnasium', 'sylvan', 'huntington', 'test prep'], rawPatterns: ['tutor'] },
  { subcategory: 'School', categoryMatch: 'Education', namePatterns: ['school', 'academy', 'elementary', 'middle school', 'high school'], rawPatterns: ['school'] },
  { subcategory: 'Training Center', categoryMatch: 'Education', namePatterns: ['training', 'driving school', 'cdl', 'trade school', 'vocational'], rawPatterns: ['training', 'learning'] },

  // Entertainment subcategories
  { subcategory: 'Movie Theater', categoryMatch: 'Entertainment', namePatterns: ['cinema', 'movie', 'theater', 'theatre', 'amc', 'regal', 'cinemark'], rawPatterns: ['movie_theater', 'cinema'] },
  { subcategory: 'Bowling', categoryMatch: 'Entertainment', namePatterns: ['bowling', 'bowl'], rawPatterns: ['bowling'] },
  { subcategory: 'Arcade & Gaming', categoryMatch: 'Entertainment', namePatterns: ['arcade', 'gaming', 'dave & buster', 'main event', 'round1', 'laser tag', 'go kart'], rawPatterns: ['arcade', 'amusement'] },
  { subcategory: 'Recreation', categoryMatch: 'Entertainment', namePatterns: ['recreation', 'park', 'trampoline', 'mini golf', 'escape room', 'fun '], rawPatterns: ['recreation'] },
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

export function normalizeSubcategory(rawCategory, businessName) {
  const parentCategory = normalizeCategory(rawCategory);
  if (!rawCategory && !businessName) return parentCategory;

  const rawLower = String(rawCategory || '').toLowerCase();
  const nameLower = String(businessName || '').toLowerCase();

  // Check subcategory rules for matching parent category
  const relevantRules = SUBCATEGORY_RULES.filter((r) => r.categoryMatch === parentCategory);

  for (const rule of relevantRules) {
    // Check name patterns first (more specific)
    if (rule.namePatterns.length > 0) {
      const nameMatch = rule.namePatterns.some((pattern) => nameLower.includes(pattern));
      if (nameMatch) return rule.subcategory;
    }

    // Check raw category patterns
    if (rule.rawPatterns.length > 0) {
      const rawMatch = rule.rawPatterns.some((pattern) => rawLower.includes(pattern));
      if (rawMatch) return rule.subcategory;
    }
  }

  // Fallback: use parent category as subcategory
  return parentCategory;
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

export function getSubcategoryNormalizationSqlExpression() {
  // Build a SQL CASE expression that checks both category and name columns
  const statements = SUBCATEGORY_RULES.map((rule) => {
    const conditions = [];

    // Parent category must match
    conditions.push(`normalized_category = '${escapeSqlLiteral(rule.categoryMatch)}'`);

    const matchConditions = [];

    // Name pattern matches
    for (const pattern of rule.namePatterns) {
      matchConditions.push(`LOWER(name) LIKE '%${escapeSqlLiteral(pattern)}%'`);
    }

    // Raw category pattern matches
    for (const pattern of rule.rawPatterns) {
      assertSafeMatcher(pattern);
      matchConditions.push(`LOWER(category) LIKE '%${escapeSqlLiteral(pattern)}%'`);
    }

    if (matchConditions.length === 0) return null;

    return `WHEN ${conditions.join(' AND ')} AND (${matchConditions.join(' OR ')}) THEN '${escapeSqlLiteral(rule.subcategory)}'`;
  }).filter(Boolean).join('\n    ');

  return `
  CASE
    ${statements}
    ELSE normalized_category
  END
`;
}

export const CATEGORY_SQL_CASE = getCategoryNormalizationSqlExpression();
export const SUBCATEGORY_SQL_CASE = getSubcategoryNormalizationSqlExpression();
