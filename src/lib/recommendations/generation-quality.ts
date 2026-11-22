import { matchStrategyKey } from "@/lib/simulation/cost-model";
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
} from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { groundSpeciesForIntervention } from "@/lib/green-solutions/species-catalog";
import {
  matchStudyTitle,
  normalizeTitle,
  removeGreeneryContradictions,
  removeUngroundedCitations,
  trimToCompleteSentence,
  type GreeneryMetrics,
} from "./grounding";

export type GeneratedRecommendationLike = {
  name: string;
  interventionType: string;
  summary: string;
  description: string;
  justification: string;
  recommendedSpecies: string;
  rationale?: string;
  sourceStudy?: string | null;
  efficiency?: number;
};

export type StudyChunkRef = { studyTitle: string };

const PLACEHOLDER_SOURCE_PATTERN = /\b(?:\[)?SOURCE\s*\d+/i;

const MIN_SUMMARY_WORDS = 5;
const MAX_SUMMARY_WORDS = 22;
const MIN_DESCRIPTION_CHARS = 80;
const MIN_JUSTIFICATION_CHARS = 60;
const MIN_SPECIES_PARTS = 2;

const GENERIC_COPY_PATTERNS = [
  /greening the area/i,
  /improve(?:ing)? (?:the )?environment/i,
  /general urban greening/i,
  /various benefits/i,
  /this (?:solution|intervention) (?:will|can) help/i,
  /deterministic context-fit/i,
  /greenpoint engine/i,
  /simulation engine/i,
  /lorem ipsum/i,
];

const METRIC_SIGNAL =
  /\b(ndvi|lst|canopy|greenery|flood|storm|heat|aqi|air quality|tree count|tagged tree|vegetation|temperature|runoff|shade)\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasGenericCopy(...fields: string[]): boolean {
  const blob = fields.join(" ");
  return GENERIC_COPY_PATTERNS.some((rx) => rx.test(blob));
}

function speciesCount(species: string): number {
  return species
    .split(/,\s*(?![^()]*\))/)
    .map((s) => s.trim().replace(/\s*\(.*?\)/g, "").trim())
    .filter((s) => s.length > 1).length;
}

/** Prompt block listing the only allowed solution titles. */
export function buildCanonicalStrategiesPromptBlock(): string {
  return STRATEGY_IDS.map((id) => {
    const { label, tagline } = STRATEGY_LABELS[id];
    return `- "${label}" — ${tagline}`;
  }).join("\n");
}

/** Match catalog entry from the declared title only (not body text). */
export function resolveRecommendationStrategyKey(
  rec: GeneratedRecommendationLike,
): InterventionType | null {
  const blob = [rec.name, rec.interventionType].filter(Boolean).join(" ");
  return matchStrategyKey(blob);
}

export function hasPlaceholderSourceCitation(text: string): boolean {
  return PLACEHOLDER_SOURCE_PATTERN.test(text);
}

/** Replace SOURCE 1 / (SOURCE 1) style labels with real study titles from RAG chunks. */
export function resolveSourcePlaceholders(
  text: string,
  chunks: StudyChunkRef[],
): string {
  if (!text.trim() || chunks.length === 0) return text;

  const titleForIndex = (index: number): string => {
    const title = chunks[index]?.studyTitle?.trim();
    return title ? `"${title}"` : "";
  };

  let result = text;

  result = result.replace(
    /\[SOURCE\s*(\d+)\s*:\s*"([^"]+)"\]/gi,
    (_match, _num, embeddedTitle: string) => embeddedTitle.trim(),
  );
  result = result.replace(
    /\[SOURCE\s*(\d+)\s*:\s*([^\]]+)\]/gi,
    (_match, _num, embeddedTitle: string) => embeddedTitle.trim(),
  );
  result = result.replace(
    /\(?\[?SOURCE\s*(\d+)\]?[^.)]*\)?/gi,
    (_match, numStr: string) => {
      const idx = parseInt(numStr, 10) - 1;
      if (!Number.isFinite(idx) || idx < 0) return "";
      return titleForIndex(idx);
    },
  );

  result = result
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

  return result;
}

/**
 * Resolve "SOURCE 2" style labels to the study the prompt numbered as source 2.
 * That is the model's own citation, so it is kept. Nothing else is attributed:
 * when the model cites no study, `sourceStudy` stays empty. (This used to fall
 * back to the first retrieved chunk and append `(per "<title>")`, which is how one
 * study ended up "cited" by 127 recommendations.)
 */
export function applyStudyCitations<T extends GeneratedRecommendationLike>(
  rec: T,
  chunks: StudyChunkRef[],
): T {
  if (chunks.length === 0 || !rec.rationale?.trim()) return rec;
  const rationale = resolveSourcePlaceholders(rec.rationale, chunks)
    .replace(/\(\s*\)/g, "")
    .trim();
  return { ...rec, rationale: rationale || rec.rationale };
}

export type GroundingOptions = {
  /** Chunks in the order the prompt numbered them, for "SOURCE n" labels. */
  chunks?: StudyChunkRef[];
  /**
   * Studies a citation may point to. Defaults to the chunk titles. When neither
   * this nor chunks are given, citations are left as they are (nothing to check
   * against); pass `[]` to strip every citation.
   */
  studyTitles?: readonly string[];
  /** Site metrics, to drop sentences that contradict them. */
  metrics?: GreeneryMetrics | null;
  /**
   * Keep `sourceStudy` only when the text actually cites it. For rows stored before
   * grounding, where the old code filled `sourceStudy` with the first retrieved
   * study whenever the model cited nothing, so a source the text never mentions
   * cannot be trusted.
   */
  requireSourceInText?: boolean;
  /** Collects what was removed, for logging and the API's `hallucinations` field. */
  report?: string[];
};

const TEXT_FIELDS = ["description", "justification", "rationale"] as const;

/**
 * Make one recommendation safe to show: citations point only at corpus studies,
 * no sentence is cut off, no sentence calls a low-green site green, and species are
 * native and fit the intervention. Used for new generations and cached rows alike.
 */
export function groundGeneratedRecommendation<T extends GeneratedRecommendationLike>(
  rec: T,
  options: GroundingOptions = {},
): T {
  const chunks = options.chunks ?? [];
  const checkCitations = options.studyTitles !== undefined || chunks.length > 0;
  const studyTitles =
    options.studyTitles ?? [...new Set(chunks.map((c) => c.studyTitle))];
  const label = rec.name || rec.interventionType || "recommendation";
  const note = (what: string) => options.report?.push(`${what} (in "${label}")`);

  const out = { ...rec };
  for (const field of TEXT_FIELDS) {
    const raw = out[field];
    if (typeof raw !== "string" || !raw.trim()) continue;
    let text = chunks.length ? resolveSourcePlaceholders(raw, chunks) : raw;
    const cited = checkCitations
      ? removeUngroundedCitations(text, studyTitles)
      : { text, removed: [] as string[] };
    cited.removed.forEach((c) => note(`removed citation ${c}`));
    const contradiction = removeGreeneryContradictions(cited.text, options.metrics);
    contradiction.removed.forEach((c) => note(`removed claim contradicting site metrics: "${c}"`));
    text = trimToCompleteSentence(contradiction.text);
    if (text !== contradiction.text) note(`trimmed unfinished ${field}`);
    (out as Record<string, unknown>)[field] = text;
  }

  const claimed = typeof rec.sourceStudy === "string" ? rec.sourceStudy.trim() : "";
  let sourceStudy = checkCitations ? matchStudyTitle(claimed, studyTitles) : claimed || null;
  if (checkCitations && claimed && !sourceStudy) note(`removed source "${claimed}"`);
  if (checkCitations && !sourceStudy && out.rationale) {
    // The model quoted a corpus title in its rationale but left sourceStudy empty.
    for (const m of out.rationale.matchAll(/[“"]([^”"]{8,200})[”"]/g)) {
      sourceStudy = matchStudyTitle(m[1], studyTitles);
      if (sourceStudy) break;
    }
  }
  if (sourceStudy && options.requireSourceInText) {
    const cited = TEXT_FIELDS.some((field) =>
      normalizeTitle(String(out[field] ?? "")).includes(
        normalizeTitle(sourceStudy as string).split(" ").slice(0, 6).join(" "),
      ),
    );
    if (!cited) {
      note(`removed source "${sourceStudy}" that the text never cites`);
      sourceStudy = null;
    }
  }
  out.sourceStudy = sourceStudy;

  const key = resolveRecommendationStrategyKey(out);
  if (key) {
    const species = groundSpeciesForIntervention(out.recommendedSpecies ?? "", key);
    species.removed.forEach((s) => note(`removed species ${s}`));
    if (species.toppedUp) note("added native default species");
    out.recommendedSpecies = species.species;
  }

  return out;
}

/** Normalize title, type, and card summary to the canonical catalog entry. */
export function normalizeToCanonicalRecommendation<T extends GeneratedRecommendationLike>(
  rec: T,
): T {
  const key = resolveRecommendationStrategyKey(rec);
  if (!key) return rec;
  const { label, tagline } = STRATEGY_LABELS[key];
  const summary =
    rec.summary.trim().length > 0 && wordCount(rec.summary) <= MAX_SUMMARY_WORDS
      ? rec.summary.trim()
      : tagline;
  return {
    ...rec,
    name: label,
    interventionType: label,
    summary,
  };
}

export function passesRecommendationQualityGate(
  rec: GeneratedRecommendationLike,
): boolean {
  if (!resolveRecommendationStrategyKey(rec)) {
    return false;
  }

  const summaryWords = wordCount(rec.summary);
  if (
    summaryWords < MIN_SUMMARY_WORDS ||
    summaryWords > MAX_SUMMARY_WORDS
  ) {
    return false;
  }

  if (rec.description.trim().length < MIN_DESCRIPTION_CHARS) {
    return false;
  }

  if (
    rec.justification.trim().length < MIN_JUSTIFICATION_CHARS ||
    !METRIC_SIGNAL.test(rec.justification)
  ) {
    return false;
  }

  if (speciesCount(rec.recommendedSpecies) < MIN_SPECIES_PARTS) {
    return false;
  }

  if (
    hasGenericCopy(
      rec.summary,
      rec.description,
      rec.justification,
      rec.rationale ?? "",
    )
  ) {
    return false;
  }

  if (rec.rationale && hasPlaceholderSourceCitation(rec.rationale)) {
    return false;
  }

  return true;
}

const MIN_RECOMMENDATIONS = 3;
const MAX_RECOMMENDATIONS = 5;

/**
 * Filter low-quality rows, dedupe by strategy, normalize titles, and cap at 5.
 */
export function sanitizeGeneratedRecommendations<T extends GeneratedRecommendationLike>(
  generated: T[],
  chunks: StudyChunkRef[] = [],
  options: Omit<GroundingOptions, "chunks"> = {},
): T[] {
  const seen = new Set<InterventionType>();
  const kept: T[] = [];

  for (const raw of generated) {
    const normalized = groundGeneratedRecommendation(
      normalizeToCanonicalRecommendation(raw),
      { ...options, chunks },
    );
    const key = resolveRecommendationStrategyKey(normalized);
    if (!key || seen.has(key) || !passesRecommendationQualityGate(normalized)) {
      continue;
    }
    seen.add(key);
    kept.push(normalized);
  }

  return kept.slice(0, MAX_RECOMMENDATIONS);
}

export function isValidRecommendationBatch<T extends GeneratedRecommendationLike>(
  recs: T[],
): boolean {
  return (
    recs.length >= MIN_RECOMMENDATIONS && recs.length <= MAX_RECOMMENDATIONS
  );
}

export const RECOMMENDATION_COUNT_BOUNDS = {
  min: MIN_RECOMMENDATIONS,
  max: MAX_RECOMMENDATIONS,
};

/**
 * Clamp a model-supplied 0–1 score. A missing or non-numeric score becomes the
 * neutral 0.5 (and is reported) instead of 0, which used to drag the overall
 * rating down as if the model had scored the option as worthless.
 */
export function normalizeUnitScore(
  value: unknown,
  onMissing?: () => void,
): number {
  const raw = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (value === null || value === undefined || !Number.isFinite(raw)) {
    onMissing?.();
    return 0.5;
  }
  return Math.min(1, Math.max(0, raw));
}

/**
 * Ground a batch read from the cache. Stored rows get the stricter source rule
 * (`requireSourceInText`). Grounding on read must never be what turns a usable
 * cached batch into a cache miss: a miss deletes the rows and pays for a new
 * generation (and, signed out, shows "Sign in" instead of the cards). Dropping
 * sentences that contradict the site metrics can leave a recommendation too thin
 * for the quality gate (QA's Tabok rows did), so when full grounding would
 * invalidate a batch that is valid as stored, everything except that step is
 * applied; the cleanup script and the next regeneration handle the rest.
 */
export function groundCachedRecommendations<T extends GeneratedRecommendationLike>(
  rows: T[],
  options: { studyTitles?: readonly string[]; metrics?: GreeneryMetrics | null } = {},
): T[] {
  const ground = (metrics: GreeneryMetrics | null | undefined) =>
    rows.map((row) =>
      groundGeneratedRecommendation(row, {
        studyTitles: options.studyTitles,
        metrics,
        requireSourceInText: true,
      }),
    );
  const isValid = (batch: T[]) =>
    isValidRecommendationBatch(sanitizeGeneratedRecommendations(batch, []));

  const full = ground(options.metrics);
  if (isValid(full) || !isValid(rows)) return full;
  const withoutContradictionCheck = ground(null);
  if (isValid(withoutContradictionCheck)) return withoutContradictionCheck;
  return rows;
}
