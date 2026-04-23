import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(process.cwd(), '.env') });

const isCLI = process.argv.some(arg => arg.includes('prisma') || arg.includes('tsx'));
const url = (isCLI ? process.env.DIRECT_URL : process.env.DATABASE_URL) || process.env.DATABASE_URL;

export default defineConfig({
    datasource: {
        url: url!,
    },
});