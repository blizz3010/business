const SUPPORTING_CATEGORIES = {
  auto_repair: 'car_repair',
  car_dealer: 'car_repair',
  car_wash: 'car_repair'
};

const TARGET_CATEGORIES = ['cafe', 'restaurant', 'quick_service_restaurant', 'car_repair', 'gym', 'pharmacy'];

export function analyzeTile(businesses) {
  const category_counts = businesses.reduce((acc, b) => {
    acc[b.category] = (acc[b.category] || 0) + 1;
    return acc;
  }, {});

  const avgRatings = businesses.reduce((acc, b) => {
    const existing = acc[b.category] || { sum: 0, count: 0 };
    existing.sum += b.rating ?? 0;
    existing.count += b.rating ? 1 : 0;
    acc[b.category] = existing;
    return acc;
  }, {});

  const opportunities = [];

  for (const category of TARGET_CATEGORIES) {
    if (!category_counts[category]) {
      const score = Math.min(100, 60 + reviewDemandScore(businesses));
      opportunities.push({
        type: 'missing-category',
        category,
        score,
        reason: `No ${category} found in this tile despite active business density.`
      });
    }
  }

  const weak_competitors = businesses.filter((b) => (b.rating ?? 0) > 0 && (b.rating ?? 0) < 3.5);

  Object.entries(avgRatings).forEach(([category, metrics]) => {
    if (!metrics.count) return;
    const avg = metrics.sum / metrics.count;
    if (avg < 3.5) {
      opportunities.push({
        type: 'weak-competitor',
        category,
        score: Math.min(100, 55 + Math.round((3.5 - avg) * 15) + reviewDemandScore(businesses)),
        reason: `Average ${category} rating is ${avg.toFixed(2)}. Better execution can outperform incumbents.`
      });
    }
  });

  const clusterKeys = Object.keys(SUPPORTING_CATEGORIES);
  const clusterCount = clusterKeys.reduce((sum, k) => sum + (category_counts[k] || 0), 0);
  if (clusterCount >= 3 && !category_counts.tire_shop) {
    opportunities.push({
      type: 'cluster-opportunity',
      category: 'tire_shop',
      score: Math.min(100, 65 + Math.round(clusterCount * 2) + reviewDemandScore(businesses)),
      reason: 'Automotive cluster detected without tire shop support.'
    });
  }

  const sorted = opportunities.sort((a, b) => b.score - a.score);

  return {
    businesses,
    category_counts,
    opportunities: sorted,
    weak_competitors
  };
}

function reviewDemandScore(businesses) {
  const totalReviews = businesses.reduce((sum, b) => sum + (b.review_count || 0), 0);
  if (totalReviews > 2500) return 30;
  if (totalReviews > 1000) return 20;
  if (totalReviews > 300) return 12;
  return 6;
}
