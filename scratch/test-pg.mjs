import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    console.log('Connecting to:', process.env.DIRECT_URL?.split('@')[1]);
    await client.connect();
    console.log('Connected successfully with pg');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('pg connection error:', err);
  } finally {
    await client.end();
  }
}

main();
