export type Business = {
  id?: number;
  place_id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  rating: number | null;
  review_count: number;
  address: string;
};

export type Opportunity = {
  type: 'missing-category' | 'weak-competitor' | 'cluster-opportunity';
  category: string;
  score: number;
  reason: string;
};

export type AnalyzeResponse = {
  businesses: Business[];
  category_counts: Record<string, number>;
  opportunities: Opportunity[];
  weak_competitors: Business[];
};
