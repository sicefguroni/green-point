import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TaggedTree } from "@prisma/client";

export async function GET() {
  try {
    const trees = await prisma.taggedTree.findMany();

    const geojson = {
      type: "FeatureCollection",
      features: trees.map((tree: TaggedTree) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [tree.longitude, tree.latitude],
        },
        properties: {
          id: tree.treeId,
          species: tree.species,
          dbh_cm: tree.dbhCm,
          height_ft: tree.heightFt,
          remarks: tree.remarks,
          barangay: tree.barangay,
          source: tree.source,
        },
      })),
    };

    return NextResponse.json(geojson);
  } catch (error) {
    console.error("Failed to fetch trees:", error);
    return NextResponse.json(
      { error: "Failed to fetch tree data" },
      { status: 500 },
    );
  }
}
