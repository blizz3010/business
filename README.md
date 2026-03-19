# StreetScope AI

StreetScope AI is a location intelligence platform for Orlando, Florida. It scans business data at 500m x 500m tiles, stores normalized business listings, and produces actionable opportunity signals such as missing categories, weak competitors, and cluster-based openings.

## Architecture

- **Frontend**: Next.js + React + TailwindCSS + Leaflet
- **Backend**: Node.js + Express
- **Data**: PostgreSQL businesses table + Redis tile cache
- **Collection**: Orlando tile scanner using Google Places API

## Orlando Coverage & Tiling

- City: Orlando, Florida
- Bounding box:
  - minLat: `28.3479`
  - maxLat: `28.6143`
  - minLng: `-81.5078`
  - maxLng: `-81.2276`
- Tile size: `500m x 500m`

## Core API

### `POST /analyze-tile`

Input:

```json
{
  "lat": 28.5383,
  "lng": -81.3792,
  "radius": 500
}
```

Response:

- `businesses`
- `category_counts`
- `opportunities`
- `weak_competitors`

## Opportunity Logic

The analysis engine computes:

- category counts
- competitor density
- average ratings
- review demand proxy

And emits opportunities:

1. **Missing Category** (target category absent)
2. **Weak Competitor Opportunity** (avg rating < 3.5)
3. **Cluster Opportunity** (supporting cluster exists but key support category missing)

Opportunity score is normalized to 0–100 from density/reviews/absence factors.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env
   ```
3. Create PostgreSQL database and apply schema:
   ```bash
   psql "$DATABASE_URL" -f database/schema.sql
   ```
4. If your DB already contains data, run the normalized-category backfill migration:
   ```bash
   psql "$DATABASE_URL" -f database/migrations/001_add_normalized_category.sql
   ```
5. Ensure Redis is running on `REDIS_URL` (optional but recommended; backend now degrades gracefully if Redis is unavailable).
6. Start frontend + backend:
   ```bash
   npm run dev
   ```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:4000`

## Data Collection

To scan all Orlando tiles and persist businesses:

```bash
npm run scan --workspace backend
```

## Deployment (Vercel + backend host)

- Deploy frontend on Vercel (`frontend` workspace).
- Deploy backend on a Node host (Render/Fly/Railway).
- Set `NEXT_PUBLIC_API_BASE_URL` to backend URL in Vercel env (e.g. `https://your-backend.up.railway.app`, usually without `:8080`).
- Set `CORS_ALLOWED_ORIGINS` on backend as a comma-separated list of allowed frontend origins.
- Keep Google API keys in environment variables.

## Troubleshooting Deployment

- If you deploy from repo root, use build command `npm run build --workspace frontend`; the frontend `postbuild` also copies artifacts to root `.next` for Vercel compatibility.
- If Vercel shows `/.next/routes-manifest.json` missing, set the Vercel project **Root Directory** to `frontend` and redeploy.
- If the **Analyze Tile** button hangs, verify `NEXT_PUBLIC_API_BASE_URL` points to your backend base URL **without** appending `:8080` unless your host explicitly requires it.
- Confirm backend health endpoint returns JSON: `GET /health`.
- Ensure backend environment variables are set: `DATABASE_URL`, `REDIS_URL`, and `GOOGLE_PLACES_API_KEY`.
- For production CORS, include your deployed frontend URL in `CORS_ALLOWED_ORIGINS`.
