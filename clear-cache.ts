import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearCachedSolutions() {
  try {
    console.log("\nCLEARING CACHED GREENING SOLUTIONS\n");

    const countBefore = await prisma.greeningRecommendation.count();
    console.log(`Current cached recommendations: ${countBefore}`);

    if (countBefore === 0) {
      console.log("No cached recommendations to clear.\n");
      await prisma.$disconnect();
      pool.end();
      return;
    }

    const deleted = await prisma.greeningRecommendation.deleteMany({});

    console.log(`\nDeleted ${deleted.count} cached recommendations`);
    console.log(`\nNext time you generate recommendations, fresh solutions will be created.\n`);
  } catch (err) {
    console.error("Error clearing cache:", err);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

clearCachedSolutions();
