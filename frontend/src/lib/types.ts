export type Business = {
  id?: number;
  name: string;
  category: string;
  normalized_category: string;
  lat: number;
  lng: number;
  rating: number | null;
  review_count: number;
  opportunity_score: number;
};

export type CategoryInsight = {
  category: string;
  total: string;
  avg_rating: string | null;
  avg_reviews: string | null;
};

export type BusinessFilters = {
  minRating?: number;
  minReviews?: number;
  category?: string;
  opportunitiesOnly: boolean;
  opportunityLayerEnabled: boolean;
};
