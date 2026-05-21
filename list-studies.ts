import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const studies = await prisma.researchStudy.findMany({
    select: { id: true, title: true, filePath: true },
    orderBy: { title: "asc" },
  });

  console.log("\n📚 RESEARCH STUDIES IN DATABASE:");
  console.log("==================================\n");
  studies.forEach((s, i) => {
    console.log(`${i + 1}. ${s.title}`);
  });

  console.log(`\nTotal: ${studies.length} studies\n`);

  // Search for specific references
  const searchTerms = ["Rojas", "Hoffman", "Hatzell"];
  console.log("🔍 SEARCHING FOR USER'S REFERENCES:");
  console.log("===================================\n");

  let found = false;
  for (const term of searchTerms) {
    const matches = studies.filter((s) =>
      s.title.toLowerCase().includes(term.toLowerCase()),
    );
    if (matches.length > 0) {
      console.log(`"${term}" found in:`);
      matches.forEach((m) => console.log(`  - ${m.title}`));
      console.log();
      found = true;
    }
  }

  if (!found) {
    console.log(
      "❌ NONE of the user's references were found in the database.\n",
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
