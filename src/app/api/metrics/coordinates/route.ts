import { NextResponse } from "next/server";
import { fetchGeeMetricsPoint } from "@/lib/api/gee_service";
import {
  calculateGreeneryIndex,
  estimateTreeCanopy,
  estimateGreenArea,
} from "@/lib/api/greenery_index";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and Longitude are required." },
        { status: 400 },
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: "Invalid coordinate format." },
        { status: 400 },
      );
    }


    const [nasaData, geeData] = await Promise.all([
      fetchGeeMetricsPoint(latitude, longitude),
    ]);

    const lst = geeData.lst ?? 30;
    const ndvi = geeData.ndvi ?? 0.3;
    const treeCanopy = estimateTreeCanopy(ndvi, lst);
    const greenArea = estimateGreenArea(ndvi, 1);

    const giResult = calculateGreeneryIndex({
      ndvi,
      lst,
      treeCanopy,
      greenArea,
    });

    return NextResponse.json({
      success: true,
      coordinates: { lat: latitude, lng: longitude },
      metrics: {
        lst,
        t2m: nasaData.t2m,
        humidity: nasaData.humidity,
        precipitation: nasaData.precipitation,
        ndvi,
        treeCanopy,
        greenArea,
        greeneryIndex: giResult.greeneryIndex,
        greeneryLevel: giResult.level,
        breakdown: giResult.breakdown,
        timestamp: nasaData.timestamp,
      },
      sources: {
        lst: "MODIS LST via Google Earth Engine",
        ndvi: "Sentinel-2 via Google Earth Engine",
        treeCanopy: "Derived from NDVI and LST",
        greeneryIndex:
          "Weighted calculation (NDVI 35%, LST 25%, Canopy 25%, Green Area 15%)",
      },
    });
  } catch (error) {
    console.error("Error fetching environmental metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 },
    );
  }
}
