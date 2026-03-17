import axios from 'axios';

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

export async function fetchBusinessesByTile({ lat, lng, radius }) {
  const response = await axios.get(TEXT_SEARCH_URL, {
    params: {
      location: `${lat},${lng}`,
      radius,
      key: process.env.GOOGLE_PLACES_API_KEY,
      type: 'establishment'
    }
  });

  return (response.data.results || []).map((item) => ({
    place_id: item.place_id,
    name: item.name,
    category: item.types?.[0] || 'unknown',
    lat: item.geometry.location.lat,
    lng: item.geometry.location.lng,
    rating: item.rating ?? null,
    review_count: item.user_ratings_total ?? 0,
    address: item.vicinity || '',
    street: item.vicinity?.split(',')[0] || '',
    city: 'Orlando'
  }));
}
