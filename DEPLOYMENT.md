# Deployment Guide for Vercel

## Required Environment Variables

Your application requires the following environment variables to be set in Vercel:

### 1. **NEXT_PUBLIC_MODEL_API_URL** (REQUIRED)
- **Purpose**: Backend API URL that provides barangay data and recommendations
- **Endpoints Used**:
  - `/data/final_results` - Returns barangay GI scores, NDVI, LST, canopy cover, etc.
  - `/data/recommendations` - Returns greening intervention recommendations
- **Default**: `http://localhost:8000` (won't work in production)
- **Example**: `https://your-api-server.com` or `https://api.yourdomain.com`

**Where it's used:**
- `src/lib/api.ts` - Main API client
- `next.config.ts` - API rewrite rules

### 2. **NEXT_PUBLIC_MAPBOX_TOKEN** (REQUIRED)
- **Purpose**: Mapbox access token for map rendering and geocoding
- **Where to get it**: https://account.mapbox.com/access-tokens/
- **Example**: `pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImN...`

**Where it's used:**
- `src/components/map/mapbox_map.tsx` - Map rendering
- `src/app/green_solutions/page.tsx` - Geocoding
- `src/components/ui/general/inputs/searchbar.tsx` - Search functionality

### 3. **DATABASE_URL** (OPTIONAL - Currently Unused)
- **Purpose**: PostgreSQL connection string for Prisma
- **Status**: Prisma is installed but not actively used in the codebase
- **Note**: You can ignore this if you're not using a database, or set it if you plan to use Prisma in the future

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: `NEXT_PUBLIC_MODEL_API_URL`
   - **Value**: Your backend API URL
   - **Environment**: Production, Preview, Development (select all)
4. Repeat for `NEXT_PUBLIC_MAPBOX_TOKEN`
5. **Redeploy** your application after adding variables

## Backend API Requirements

Your backend API must be accessible and provide these endpoints:

### GET `/data/final_results`
Returns array of barangay data:
```json
[
  {
    "brgy_name": "Barangay Name",
    "gi_score": 0.65,
    "gi_level": "High",
    "gi_rank": 1,
    "ndvi_mean": 0.72,
    "canopy_cover_pct": 45.2,
    "mean_lst": 32.5,
    "flood_exposure": "Medium"
  }
]
```

### GET `/data/recommendations`
Returns array of recommendations:
```json
[
  {
    "barangay_name": "Barangay Name",
    "intervention_type": "urban canopy",
    "intervention_name": "Street Trees",
    "priority_rank": 1,
    "estimated_cost_per_sqm": 850,
    "cooling_potential": 2.5,
    "stormwater_retention": 45,
    "pm25_removal": 12.5,
    "efficiency_score": 0.85,
    "explanation": "Recommended intervention..."
  }
]
```

## Static Files (Already Included)

These files are in the `public/` folder and will be served automatically:
- ✅ `public/geo/mandaue_barangay_boundaries.json`
- ✅ `public/geo/mandaue_barangays_gi.geojson`
- ✅ `public/metrics/mandaue_metrics.json`
- ✅ `public/metrics/airqual_index.json`
- ✅ `public/terms/termdefs.json`

## Troubleshooting

### Map not showing
- Check that `NEXT_PUBLIC_MAPBOX_TOKEN` is set correctly
- Verify the token has the right permissions in Mapbox dashboard

### No data on map/dashboard
- Check browser console for API errors
- Verify `NEXT_PUBLIC_MODEL_API_URL` is correct and accessible
- Ensure your backend API is running and CORS is configured
- Check that API endpoints return data in the expected format

### API calls failing
- Verify the API URL is accessible from the internet (not localhost)
- Check CORS settings on your backend API
- Ensure the API endpoints match exactly: `/data/final_results` and `/data/recommendations`

## Quick Checklist

- [ ] Set `NEXT_PUBLIC_MODEL_API_URL` in Vercel
- [ ] Set `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel
- [ ] Backend API is deployed and accessible
- [ ] Backend API has CORS enabled for your Vercel domain
- [ ] Redeploy application after setting environment variables
- [ ] Test map functionality
- [ ] Test data loading on dashboard

