import 'dotenv/config';
import OpenAI from "openai";
import { retrieveRelevantChunks, buildGenerationPrompt } from './src/lib/rag';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testFullGeneration() {
  console.log('--- STARTING FULL RAG GENERATION TEST (OPENAI) ---');
  
  const context = {
    areaName: 'Mandaue City',
    ndvi: 0.15,
    lst: 38.2,
    floodHazard: 3,
    greeneryLevel: 'Very Low'
  };

  console.log('1. Retrieving relevant research from local database...');
  const { chunks, query } = await retrieveRelevantChunks(context, 4);
  
  if (chunks.length === 0) {
    console.log('❌ No research found.');
    return;
  }
  console.log(`✅ Found ${chunks.length} research chunks.`);

  console.log('2. Building grounded prompt...');
  const { systemPrompt, userPrompt } = buildGenerationPrompt(context, chunks);

  console.log('3. Calling OpenAI GPT-4o-mini for cited recommendations...');
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    console.log('\n--- OPENAI OUTPUT ---');
    console.log(response);
    console.log('\n--- END OF TEST ---');

  } catch (err: any) {
    console.error('❌ Generation failed:', err.message);
  }
}

testFullGeneration();
