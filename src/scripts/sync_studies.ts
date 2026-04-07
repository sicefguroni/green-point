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
const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 240;

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
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|li|ul|ol|h[1-6]|table|tr|td|th)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongSegment(text: string, size: number): string[] {
  const parts: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > size && current) {
      parts.push(current.trim());
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    parts.push(current.trim());
  }

  return parts;
}

function splitParagraphIntoSegments(paragraph: string, size: number): string[] {
  if (paragraph.length <= size) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(/(?<=[.!?])\s+(?=(?:[A-Z0-9"']))/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return splitLongSegment(paragraph, size);
  }

  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > size) {
      if (current) {
        segments.push(current.trim());
        current = "";
      }
      segments.push(...splitLongSegment(sentence, size));
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > size && current) {
      segments.push(current.trim());
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) {
    segments.push(current.trim());
  }

  return segments;
}

function buildSemanticSegments(text: string, size: number): string[] {
  const normalized = normalizeExtractedText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitParagraphIntoSegments(paragraph, size));
}

function chunkText(
  text: string,
  size: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  const segments = buildSemanticSegments(text, size);
  if (segments.length === 0) {
    return [];
  }

  const joinSegments = (parts: string[]) => parts.join("\n\n").trim();
  const measure = (parts: string[]) => joinSegments(parts).length;
  const buildOverlapSeed = (parts: string[]) => {
    if (overlap <= 0 || parts.length === 0) {
      return [] as string[];
    }

    const seed: string[] = [];
    for (let index = parts.length - 1; index >= 0; index--) {
      seed.unshift(parts[index]);
      if (measure(seed) >= overlap) {
        break;
      }
    }
    return seed;
  };

  const chunks: string[] = [];
  let current: string[] = [];

  for (const segment of segments) {
    const next = current.length === 0 ? [segment] : [...current, segment];
    if (current.length > 0 && measure(next) > size) {
      chunks.push(joinSegments(current));
      current = buildOverlapSeed(current);

      while (current.length > 0 && measure([...current, segment]) > size) {
        current.shift();
      }
    }

    current.push(segment);
  }

  if (current.length > 0) {
    chunks.push(joinSegments(current));
  }

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
      if (study.title !== cleanTitle) {
        await prisma.researchStudy.update({
          where: { id: study.id },
          data: { title: cleanTitle },
        });
        console.log(`Updated title: "${study.title}" → "${cleanTitle}"`);
      }
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

    text = normalizeExtractedText(text);

    if (!text || text.trim().length < 50) {
      continue;
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      console.warn(`Skipped "${fileName}" because no usable chunks were produced.`);
      continue;
    }

    console.log(`→ Generating ${chunks.length} OpenAI embeddings...`);

    const existingChunks = await prisma.studyChunk.findMany({
      where: { studyID: study.id },
      orderBy: [{ chunkIndex: "asc" }, { createdAt: "asc" }],
    });

    const existingByIndex = new Map<number, typeof existingChunks>();
    for (const existingChunk of existingChunks) {
      const atIndex = existingByIndex.get(existingChunk.chunkIndex) ?? [];
      atIndex.push(existingChunk);
      existingByIndex.set(existingChunk.chunkIndex, atIndex);
    }

    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const nextContent = chunks[i];
      const existingAtIndex = existingByIndex.get(i) ?? [];
      const [existing, ...duplicates] = existingAtIndex;

      if (duplicates.length > 0) {
        await prisma.studyChunk.deleteMany({
          where: { id: { in: duplicates.map((chunk) => chunk.id) } },
        });
      }

      if (existing && existing.content === nextContent) {
        const hasEmbedding = await prisma.$queryRawUnsafe<{ has_emb: boolean }[]>(
          `SELECT (embedding IS NOT NULL) AS has_emb FROM "StudyChunk" WHERE id = $1`,
          existing.id,
        );
        if (hasEmbedding[0]?.has_emb) {
          process.stdout.write(".");
          successCount++;
          continue;
        }
      }

      try {
        const embedding = await generateEmbedding(nextContent);

        const chunk = existing
          ? await prisma.studyChunk.update({
              where: { id: existing.id },
              data: { content: nextContent, chunkIndex: i },
            })
          : await prisma.studyChunk.create({
              data: { studyID: study.id, content: nextContent, chunkIndex: i },
            });

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

    const staleChunkIds = existingChunks
      .filter((chunk) => chunk.chunkIndex >= chunks.length)
      .map((chunk) => chunk.id);

    if (staleChunkIds.length > 0) {
      await prisma.studyChunk.deleteMany({
        where: { id: { in: staleChunkIds } },
      });
    }

    console.log(`\n Done "${fileName}" — ${successCount}/${chunks.length} chunks stored.`);
  }

  // Remove orphaned ResearchStudy records whose files no longer exist on disk
  const allStudies = await prisma.researchStudy.findMany({ select: { id: true, filePath: true, title: true } });
  const activeRelativePaths = new Set(
    files.map((f) => path.relative(process.cwd(), path.join(STUDY_DIR, f))),
  );
  const orphanIds = allStudies
    .filter((s) => !activeRelativePaths.has(s.filePath))
    .map((s) => s.id);
  if (orphanIds.length > 0) {
    const orphanTitles = allStudies.filter((s) => orphanIds.includes(s.id)).map((s) => s.title);
    await prisma.researchStudy.deleteMany({ where: { id: { in: orphanIds } } });
    console.log(`\n Purged ${orphanIds.length} orphaned study record(s): ${orphanTitles.join(", ")}`);
  }

  console.log("\n Sync complete!");
}

syncStudies()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
