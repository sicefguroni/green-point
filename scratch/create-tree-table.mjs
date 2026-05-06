import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS "TaggedTree" (
        "id" TEXT NOT NULL,
        "treeId" TEXT,
        "species" TEXT,
        "dbhCm" DOUBLE PRECISION,
        "heightFt" DOUBLE PRECISION,
        "remarks" TEXT,
        "barangay" TEXT,
        "source" TEXT,
        "latitude" DOUBLE PRECISION NOT NULL,
        "longitude" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "TaggedTree_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX IF NOT EXISTS "TaggedTree_barangay_idx" ON "TaggedTree"("barangay");
    CREATE INDEX IF NOT EXISTS "TaggedTree_species_idx" ON "TaggedTree"("species");
    CREATE INDEX IF NOT EXISTS "TaggedTree_latitude_longitude_idx" ON "TaggedTree"("latitude", "longitude");
  `;

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Running SQL migration...");
    await client.query(sql);
    console.log('Table "TaggedTree" created successfully.');
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    await client.end();
  }
}

main();
