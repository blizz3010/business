import axios from 'axios';

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const GOOGLE_PAGE_DELAY_MS = 2_000;
const MAX_GOOGLE_PAGES = 3;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBusinessesByTile({ lat, lng, radius }) {
  const allResults = [];
  let nextPageToken;

  for (let page = 0; page < MAX_GOOGLE_PAGES; page += 1) {
    if (page > 0) {
      if (!nextPageToken) break;
      await wait(GOOGLE_PAGE_DELAY_MS);
    }

    const response = await axios.get(TEXT_SEARCH_URL, {
      params: {
        location: `${lat},${lng}`,
        radius,
        key: process.env.GOOGLE_PLACES_API_KEY,
        type: 'establishment',
        pagetoken: nextPageToken
      }
    });

    const pageResults = response.data.results || [];
    allResults.push(...pageResults);
    nextPageToken = response.data.next_page_token;
  }

  return allResults.map((item) => ({
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
