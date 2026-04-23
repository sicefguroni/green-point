import { prisma } from '../lib/prisma.js';
import 'dotenv/config';

async function test() {
  try {
    console.log('Testing findFirst()...');
    const res = await prisma.researchStudy.findFirst();
    console.log('Result:', res);
  } catch (err) {
    console.error('ERROR OBJECT:');
    console.dir(err, { depth: null });
  } finally {
    await prisma.$disconnect();
  }
}

test();
