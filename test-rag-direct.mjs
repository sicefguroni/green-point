import { Pool } from "pg";
import "dotenv/config";
import OpenAI from "openai";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testRAGDirectly() {
  console.log(
    "\n🧪 TESTING RAG RETRIEVAL - FLOOD + NATIVE PLANTS + SOCIAL RESILIENCE\n",
  );

  // Build a query similar to what the system would generate
  const query =
    "Flooding flood mitigation native plants urban green spaces social resilience community";

  try {
    // Step 1: Generate embedding for the query
    console.log("1️⃣ Generating embedding for query...");
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const embedding = embeddingRes.data[0].embedding;
    console.log(`   Embedding generated: ${embedding.length} dimensions\n`);

    // Step 2: Query the database with different similarity thresholds
    const thresholds = [0.1, 0.2, 0.3, 0.5, 0.7];

    for (const threshold of thresholds) {
      console.log(`\n2️⃣ Testing with similarity threshold: ${threshold}`);
      console.log("   ================================================");

      const vectorString = `[${embedding.join(",")}]`;

      const result = await pool.query(
        `
        SELECT
          sc.id,
          sc."studyID",
          rs.title AS "studyTitle",
          sc.content,
          1 - (sc.embedding <=> $1::vector) AS similarity
        FROM "StudyChunk" sc
        JOIN "ResearchStudy" rs ON rs.id = sc."studyID"
        WHERE sc.embedding IS NOT NULL
          AND 1 - (sc.embedding <=> $1::vector) >= $2
        ORDER BY similarity DESC
        LIMIT 6
      `,
        [vectorString, threshold],
      );

      console.log(`   Retrieved: ${result.rows.length} chunks`);

      if (result.rows.length > 0) {
        result.rows.forEach((row, i) => {
          console.log(
            `   [${i + 1}] ${row.studyTitle} (${(row.similarity * 100).toFixed(1)}%)`
          );
          console.log(
            `       Preview: ${row.content.substring(0, 100).replace(/\n/g, " ")}...`
          );

          // Check if fake refs are in this chunk
          const fakeRefs = ["Rojas", "Hoffman", "Hatzell"];
          const found = fakeRefs.filter((ref) =>
            row.content.includes(ref) || row.studyTitle.includes(ref)
          );
          if (found.length > 0) {
            console.log(`       ⚠️  Found fake ref(s): ${found.join(", ")}`);
          }
        });
      } else {
        console.log("   ❌ No chunks retrieved with this threshold");
      }
    }

    // Step 3: Check if fake references exist ANYWHERE in the database
    console.log("\n\n3️⃣ SEARCHING ENTIRE DATABASE FOR FAKE REFERENCES:");
    console.log("   ==================================================");

    const fakeRefsToSearch = [
      "Rojas",
      "J. Rojas",
      "Hoffman",
      "Hatzell",
      "2021",
      "2017",
      "2019",
    ];

    for (const ref of fakeRefsToSearch) {
      const result = await pool.query(
        `
        SELECT COUNT(*) as count FROM "StudyChunk" 
        WHERE content ILIKE $1
      `,
        [`%${ref}%`],
      );

      const count = result.rows[0].count;
      console.log(`   "${ref}": ${count} occurrences`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

testRAGDirectly();
