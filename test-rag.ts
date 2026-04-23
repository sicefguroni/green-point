import "dotenv/config";
import { retrieveRelevantChunks } from "./src/lib/rag";

async function test() {
  console.log(
    "Searching for research matching Alang-alang with high flood hazard...",
  );
  const context = { areaName: "Alang-alang", lst: 37, floodHazard: 3 };

  try {
    const result = await retrieveRelevantChunks(context, 2);

    if (result.chunks.length > 0) {
      console.log(`SUCCESS! Found ${result.chunks.length} relevant chunks.`);
      result.chunks.forEach((c, i) => {
        console.log(
          `[${i + 1}] (${(c.similarity * 100).toFixed(1)}% match) "${c.studyTitle}"`,
        );
        console.log(`   "${c.content.slice(0, 100)}..."\n`);
      });
    } else {
      console.log("No research found.");
    }
  } catch (err: any) {
    console.error("RAG Test failed:", err.message);
  }
}
test();
