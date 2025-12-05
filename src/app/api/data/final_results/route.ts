import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper function to determine GI level
function getGILevel(giScore: number): string {
  if (giScore >= 0.75) return 'Excellent';
  if (giScore >= 0.60) return 'High';
  if (giScore >= 0.40) return 'Medium';
  return 'Low';
}

// Helper function to clean barangay name
function cleanBarangayName(name: string): string {
  return name.replace(/\s*\(Pob\.\)\s*$/i, '').trim();
}

export async function GET() {
  try {
    // Read the GeoJSON data file
    const filePath = path.join(process.cwd(), 'public', 'geo', 'mandaue_barangays_gi.geojson');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const barangayData = JSON.parse(fileContents);

    // Transform the data to match the expected API format
    const results = barangayData.map((item: any, index: number) => {
      const giScore = item.greenery_index || 0;
      
      return {
        brgy_name: cleanBarangayName(item.name),
        gi_score: giScore,
        gi_level: getGILevel(giScore),
        gi_rank: index + 1, // Simple ranking by array order
        ndvi_mean: item.ndvi || 0,
        canopy_cover_pct: (item.tree_canopy || 0) * 100, // Convert to percentage
        mean_lst: item.lst || 0,
        flood_exposure: item.flood_exposure || 'Unknown',
        current_intervention: item.current_intervention || ''
      };
    });

    // Sort by GI score (descending) and update ranks
    results.sort((a: any, b: any) => b.gi_score - a.gi_score);
    results.forEach((item: any, index: number) => {
      item.gi_rank = index + 1;
    });

    return NextResponse.json(results, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error reading final results:', error);
    return NextResponse.json(
      { error: 'Failed to load final results' },
      { status: 500 }
    );
  }
}

