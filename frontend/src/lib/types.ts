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
  showBusinessMarkers: boolean;
  opportunityLayerEnabled: boolean;
};

/** A single opportunity cell returned by GET /api/opportunity-grid */
export type OpportunityCell = {
  lat: number;
  lng: number;
  category: string;
  score: number;
  demand_score: number;
  scarcity_score: number;
  quality_gap_score: number;
  total_nearby: number;
  competitor_count: number;
  avg_competitor_rating: number | null;
  top_competitors: Array<{
    name: string;
    rating: number | null;
    review_count: number;
    distance_km: number;
  }>;
};

/** Color configuration per category group for the opportunity layer */
export type CategoryColor = {
  fill: string;
  stroke: string;
  label: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  'Food & Dining':  { fill: '#F0997B', stroke: '#993C1D', label: 'Food & Dining' },
  'Automotive':     { fill: '#85B7EB', stroke: '#185FA5', label: 'Automotive' },
  'Car Wash':       { fill: '#6BC5E8', stroke: '#1A7FA3', label: 'Car Wash' },
  'Health':         { fill: '#5DCAA5', stroke: '#0F6E56', label: 'Health' },
  'Beauty & Salon': { fill: '#F2A8D0', stroke: '#A63D7A', label: 'Beauty & Salon' },
  'Retail':         { fill: '#AFA9EC', stroke: '#534AB7', label: 'Retail' },
  'Fitness':        { fill: '#FAC775', stroke: '#854F0B', label: 'Fitness' },
  'Home Services':  { fill: '#8BC78B', stroke: '#2D7A2D', label: 'Home Services' },
  'Pet Services':   { fill: '#D4A76A', stroke: '#8B6914', label: 'Pet Services' },
  'Education':      { fill: '#7EC8E3', stroke: '#2B7A9B', label: 'Education' },
  'Entertainment':  { fill: '#E8A0E8', stroke: '#8B3D8B', label: 'Entertainment' },
  'Services':       { fill: '#B4B2A9', stroke: '#5F5E5A', label: 'Services' },
};

export function getCategoryColor(category: string): CategoryColor {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Services'];
}
