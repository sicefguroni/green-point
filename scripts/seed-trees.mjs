import pg from 'pg';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function main() {
  const dataPath = path.join(process.cwd(), 'public', 'data', 'tagged-trees.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found:', dataPath);
    return;
  }

  const geojson = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const features = geojson.features || [];

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database with pg.');

    console.log(`Starting seed for ${features.length} trees...`);

    // Clear existing
    await client.query('DELETE FROM "TaggedTree"');
    console.log('Cleared existing records.');

    // Batch insert using raw SQL for speed and reliability
    const batchSize = 100;
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      
      let query = 'INSERT INTO "TaggedTree" ("id", "treeId", "species", "dbhCm", "heightFt", "remarks", "barangay", "source", "latitude", "longitude", "updatedAt") VALUES ';
      const values = [];
      
      batch.forEach((f, idx) => {
        const offset = idx * 11;
        query += `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})${idx === batch.length - 1 ? '' : ','} `;
        
        values.push(
          `tree_${i + idx}`, // unique id
          f.properties.id?.toString() || null,
          f.properties.species || null,
          f.properties.dbh_cm || null,
          f.properties.height_ft || null,
          f.properties.remarks || null,
          f.properties.barangay || null,
          f.properties.source || null,
          f.geometry.coordinates[1],
          f.geometry.coordinates[0],
          new Date()
        );
      });

      await client.query(query, values);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(features.length / batchSize)}`);
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

main();
