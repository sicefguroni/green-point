/**
 * One-time cleanup: apply recommendation grounding to rows stored before it existed.
 *
 *   npx tsx scripts/ground-stored-recommendations.ts            # dry run, writes a report
 *   npx tsx scripts/ground-stored-recommendations.ts --apply    # update the rows
 *
 * Same rules as new generations (src/lib/recommendations/generation-quality.ts):
 * citations must name a ResearchStudy, species must be native and fit the
 * intervention, unfinished sentences are trimmed, and a source the text never
 * cites is cleared (the old code filled it with the first retrieved study). Site-metric contradictions are
 * handled on read, because stored rows don't carry the metrics they were made for.
 * A JSON backup of every changed row is written before anything is updated.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { groundGeneratedRecommendation } from "../src/lib/recommendations/generation-quality";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

const APPLY = process.argv.includes("--apply");
const OUT_DIR = path.resolve("scripts/output");

type Row = {
  id: string;
  name: string;
  interventionType: string;
  description: string;
  implementationOptions: Record<string, unknown> | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const studyTitles = (await pool.query<{ title: string }>(`select title from "ResearchStudy"`)).rows.map(
    (r) => r.title,
  );
  const rows = (
    await pool.query<Row>(
      `select id, name, "interventionType", description, "implementationOptions" from "GreeningRecommendation"`,
    )
  ).rows;

  const changes: {
    id: string;
    name: string;
    fixes: string[];
    before: Row;
    after: { description: string; implementationOptions: Record<string, unknown> };
  }[] = [];

  for (const row of rows) {
    const opts = row.implementationOptions ?? {};
    const report: string[] = [];
    const grounded = groundGeneratedRecommendation(
      {
        name: row.name,
        interventionType: row.interventionType,
        summary: str(opts.summary),
        description: row.description ?? "",
        justification: str(opts.justification),
        recommendedSpecies: str(opts.recommendedSpecies),
        rationale: str(opts.rationale),
        sourceStudy: str(opts.sourceStudy) || null,
      },
      { studyTitles, report, requireSourceInText: true },
    );

    const nextOpts: Record<string, unknown> = { ...opts };
    const setIf = (key: string, value: string | null, had: unknown) => {
      if (had === undefined && (value === "" || value === null)) return;
      nextOpts[key] = value;
    };
    setIf("justification", grounded.justification, opts.justification);
    setIf("recommendedSpecies", grounded.recommendedSpecies, opts.recommendedSpecies);
    setIf("rationale", grounded.rationale ?? "", opts.rationale);
    setIf("sourceStudy", grounded.sourceStudy ?? null, opts.sourceStudy);

    const descriptionChanged = grounded.description !== (row.description ?? "");
    const optsChanged = JSON.stringify(nextOpts) !== JSON.stringify(opts);
    if (descriptionChanged || optsChanged) {
      changes.push({
        id: row.id,
        name: row.name,
        fixes: report,
        before: row,
        after: { description: grounded.description, implementationOptions: nextOpts },
      });
    }
  }

  const tally: Record<string, number> = {};
  for (const c of changes) {
    for (const f of c.fixes) {
      const kind = f.replace(/ \(in ".*"\)$/, "").replace(/^(removed \w+).*$/, "$1").replace(/^(trimmed unfinished \w+).*/, "$1");
      tally[kind] = (tally[kind] ?? 0) + 1;
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportFile = path.join(OUT_DIR, `grounding-${APPLY ? "applied" : "dry-run"}-${stamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({ rows: rows.length, changed: changes.length, tally, changes }, null, 1));

  console.log({ rows: rows.length, changed: changes.length, tally, report: reportFile });

  if (APPLY && changes.length) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const c of changes) {
        await client.query(
          `update "GreeningRecommendation" set description = $2, "implementationOptions" = $3 where id = $1`,
          [c.id, c.after.description, JSON.stringify(c.after.implementationOptions)],
        );
      }
      await client.query("commit");
      console.log(`updated ${changes.length} rows (backup of previous values: ${reportFile})`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
