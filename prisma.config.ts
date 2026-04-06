import { defineConfig } from "@prisma/config";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DIRECT_URL ||
      "postgresql://postgres.gnzxbldchgwtppprgnnk:GreenPoint_2026%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  },
});
