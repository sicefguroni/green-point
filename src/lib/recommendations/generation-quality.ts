import { matchStrategyKey } from "@/lib/simulation/cost-model";
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
} from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";

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

/** Fix rationale citations; align sourceStudy when missing. */
export function applyStudyCitations<T extends GeneratedRecommendationLike>(
  rec: T,
  chunks: StudyChunkRef[],
): T {
  if (chunks.length === 0) return rec;

  const fallbackTitle =
    (typeof rec.sourceStudy === "string" && rec.sourceStudy.trim()) ||
    chunks[0]?.studyTitle?.trim() ||
    "";

  let rationale = rec.rationale?.trim() ?? "";
  if (rationale) {
    rationale = resolveSourcePlaceholders(rationale, chunks);
    if (hasPlaceholderSourceCitation(rationale) && fallbackTitle) {
      rationale = rationale.replace(
        PLACEHOLDER_SOURCE_PATTERN,
        `"${fallbackTitle}"`,
      );
    }
    rationale = rationale.replace(/\(\s*\)/g, "").trim();
  }

  if (
    rationale &&
    hasPlaceholderSourceCitation(rationale) &&
    fallbackTitle
  ) {
    rationale = rationale.replace(PLACEHOLDER_SOURCE_PATTERN, "").trim();
    if (!rationale.toLowerCase().includes(fallbackTitle.toLowerCase())) {
      rationale = `${rationale} (per "${fallbackTitle}")`.trim();
    }
  }

  let sourceStudy = rec.sourceStudy;
  if (
    (!sourceStudy || !String(sourceStudy).trim()) &&
    fallbackTitle
  ) {
    sourceStudy = fallbackTitle;
  }

  return {
    ...rec,
    rationale: rationale || rec.rationale,
    sourceStudy,
  };
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
): T[] {
  const seen = new Set<InterventionType>();
  const kept: T[] = [];

  for (const raw of generated) {
    const recChunks =
      typeof raw.sourceStudy === "string" && raw.sourceStudy.trim()
        ? [{ studyTitle: raw.sourceStudy.trim() }]
        : chunks;
    const cited = applyStudyCitations(raw, recChunks);
    const normalized = normalizeToCanonicalRecommendation(cited);
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
