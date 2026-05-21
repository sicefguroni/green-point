import { retrieveRelevantChunks } from "@/lib/rag";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testRAGRetrieval() {
  console.log(
    "\n🧪 TESTING RAG RETRIEVAL FOR FLOOD MITIGATION + NATIVE PLANTS + SOCIAL RESILIENCE\n",
  );

  // Simulate a query similar to what might generate those fake citations
  const context = {
    areaName: "Test Barangay",
    ndvi: 0.15,
    lst: 38,
    treeCanopy: 0.12,
    greeneryIndex: 0.25,
    greeneryLevel: "Very Low",
    floodHazard: 3,
    stormHazard: 2,
    aqi: 85,
    taggedTreeCount: 5,
    inventoryCanopyFraction: 0.1,
    areaHectares: 50,
  };

  try {
    const { chunks, query } = await retrieveRelevantChunks(context, 6);

    console.log("Generated RAG Query:");
    console.log("====================");
    console.log(query);
    console.log("\n");

    console.log(`Retrieved ${chunks.length} chunks:`);
    console.log("==================================\n");

    chunks.forEach((chunk, i) => {
      console.log(
        `[${i + 1}] ${chunk.studyTitle} (similarity: ${(chunk.similarity * 100).toFixed(1)}%)`,
      );
      console.log(`Content preview: ${chunk.content.substring(0, 150)}...\n`);
    });

    // Check for the specific fake references
    console.log("🔍 CHECKING FOR FAKE REFERENCES:");
    console.log("=================================");

    const allContent = chunks.map((c) => c.content.toLowerCase()).join(" ");
    const allTitles = chunks.map((c) => c.studyTitle.toLowerCase()).join(" ");

    const fakeRefs = [
      { author: "Rojas", year: "2021", title: "native plants flood" },
      { author: "Hoffman", year: "2017", title: "green infrastructure" },
      { author: "Hatzell", year: "2019", title: "social resilience" },
    ];

    fakeRefs.forEach((ref) => {
      const inContent = allContent.includes(ref.author.toLowerCase());
      const inTitle = allTitles.includes(ref.author.toLowerCase());
      console.log(
        `${ref.author} (${ref.year}): In content? ${inContent}, In title? ${inTitle}`,
      );
    });

    // Check if any chunks mention these authors directly
    console.log("\n📚 FULL CHUNK ANALYSIS:");
    console.log("======================");

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (
        chunk.content.toLowerCase().includes("rojas") ||
        chunk.content.toLowerCase().includes("hoffman") ||
        chunk.content.toLowerCase().includes("hatzell")
      ) {
        console.log(
          `✓ Chunk ${i + 1} (${chunk.studyTitle}) contains one of these authors`,
        );
      }
    }
  } catch (err) {
    console.error("RAG retrieval test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testRAGRetrieval();
