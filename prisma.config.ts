import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(process.cwd(), '.env') });

export default defineConfig({
    datasource: {
        // We use the "||" fallback so the code doesn't crash during the loading phase
        url: process.env.DATABASE_URL || "postgresql://postgres.gnzxbldchgwtppprgnnk:Princess.and.frogs1@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
    },
});