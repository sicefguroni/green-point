import fs from "fs";
import path from "path";
import "dotenv/config";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";

import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STUDY_DIR = path.join(process.cwd(), "resources/studies");
const EXCLUDED = ["fullpaper_SILLIMANJOURNAL.pdf"];
const CHUNK_SIZE = 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Embedding — OpenAI text-embedding-3-small (1536 dims)
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return res.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, size: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if ((current + " " + word).length > size) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function syncStudies() {
  console.log("Scanning resources/studies for OpenAI indexing...");

  if (!fs.existsSync(STUDY_DIR)) {
    console.error(`Directory not found: ${STUDY_DIR}`);
    return;
  }

  const files = fs
    .readdirSync(STUDY_DIR)
    .filter(
      (f) =>
        (f.endsWith(".pdf") || f.endsWith(".txt") || f.endsWith(".html")) &&
        !EXCLUDED.includes(f),
    );

  console.log(`Found ${files.length} supported file(s).\n`);

  for (const fileName of files) {
    const filePath = path.join(STUDY_DIR, fileName);
    const relativePath = path.relative(process.cwd(), filePath);

    let study = await prisma.researchStudy.findFirst({
      where: { filePath: relativePath },
    });

    const cleanTitle = fileName
      .replace(/\.(pdf|txt|html)$/, "")
      .replace(/[_-]+/g, " ");

    if (!study) {
      study = await prisma.researchStudy.create({
        data: { title: cleanTitle, filePath: relativePath },
      });
      console.log(`New study: "${fileName}"`);
    } else {
      console.log(`Resuming: "${fileName}"`);
    }

    let text = "";
    try {
      if (fileName.endsWith(".pdf")) {
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = result.text;
        await parser.destroy();
      } else {
        text = fs.readFileSync(filePath, "utf-8");
        if (fileName.endsWith(".html")) text = stripHtml(text);
      }
    } catch (err) {
      console.error(`Failed to read "${fileName}":`, err);
      continue;
    }

    if (!text || text.trim().length < 50) {
      continue;
    }

    const chunks = chunkText(text);
    console.log(`→ Generating ${chunks.length} OpenAI embeddings...`);

    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
        const existing = await prisma.studyChunk.findFirst({
            where: { studyID: study.id, chunkIndex: i },
        });

        if (existing) {
            const has_emb = await prisma.$queryRawUnsafe<{ has_emb: boolean }[]>(
                `SELECT (embedding IS NOT NULL) AS has_emb FROM "StudyChunk" WHERE id = $1`,
                existing.id
            );
            if (has_emb[0]?.has_emb) {
                process.stdout.write(".");
                successCount++;
                continue;
            }
        }

      try {
        const embedding = await generateEmbedding(chunks[i]);

        const chunk = existing ?? (await prisma.studyChunk.create({
          data: { studyID: study.id, content: chunks[i], chunkIndex: i },
        }));

        await prisma.$executeRawUnsafe(
          `UPDATE "StudyChunk" SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(",")}]`,
          chunk.id,
        );

        process.stdout.write("✓");
        successCount++;
      } catch (err: any) {
        console.error(`\n Failed chunk ${i}:`, err?.message ?? err);
        if (err?.status === 429) {
          console.error("🚫 OpenAI Rate Limit — stopping.");
          break;
        }
      }
    }

    console.log(`\n Done "${fileName}" — ${successCount}/${chunks.length} chunks stored.`);
  }

  console.log("\n Sync complete!");
}

syncStudies()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
