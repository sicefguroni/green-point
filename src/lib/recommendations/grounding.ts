/**
 * Grounding for AI-written recommendation text: every citation shown to a user
 * must point at a study in the corpus (`ResearchStudy`), and nothing is attributed
 * on the model's behalf. Shared by the Explore generate route, the barangay
 * backfill, and the cache read path, so stored and new rows follow the same rules.
 */

const SENTENCE_END = /[.!?]["”')\]]*$/;

/** Lower-case, strip quotes / punctuation / extra spaces, for title comparison. */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Match a cited title against the corpus. Exact (normalized) matches count, and so
 * does a citation that drops a corpus title's trailing journal / year suffix
 * (e.g. "Living Walls Effect on Cooling Energy Consumption in Urban Microclimates"
 * for "… Microclimates   Sustainability 2024"), as long as it is at least 5 words.
 */
export function matchStudyTitle(
  candidate: string | null | undefined,
  studyTitles: readonly string[],
): string | null {
  if (!candidate || !candidate.trim()) return null;
  const want = normalizeTitle(candidate);
  if (!want) return null;
  for (const title of studyTitles) {
    const have = normalizeTitle(title);
    if (have === want) return title;
  }
  if (want.split(" ").length >= 5) {
    for (const title of studyTitles) {
      const have = normalizeTitle(title);
      if (have.startsWith(want + " ") || want.startsWith(have + " ")) return title;
    }
  }
  return null;
}

/** Author surnames and years that appear in corpus titles ("Lozano et al 2025"). */
function citableAuthorYears(studyTitles: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const title of studyTitles) {
    const rx = /([A-Z][A-Za-z-]+)(?:\s+et\s+al\.?)?\s+((?:19|20)\d{2})/g;
    for (const m of title.matchAll(rx)) out.add(`${m[1].toLowerCase()} ${m[2]}`);
  }
  return out;
}

const SURNAME = String.raw`[A-Z][A-Za-z'’-]+`;
const AUTHORS = String.raw`${SURNAME}(?:\s+et\s+al\.?|\s+(?:and|&)\s+${SURNAME})?`;
const YEAR = String.raw`(?:19|20)\d{2}[a-z]?`;

function isCitable(authors: string, year: string, citable: Set<string>): boolean {
  const surname = authors.trim().split(/\s+/)[0].toLowerCase();
  return citable.has(`${surname} ${year.slice(0, 4)}`);
}

function tidy(text: string): string {
  return text
    .replace(/\(\s*[,;]?\s*\)/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;])\s*([.!?])/g, "$2")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

export type CitationCleanup = { text: string; removed: string[] };

/**
 * Remove citations that are not in the corpus from free text:
 * - author–year citations, parenthetical "(Davis et al., 2014)" or narrative
 *   "Garcia et al. (2013) found", unless the author and year match a corpus title;
 * - quoted titles that are not corpus studies (`per "Urban Heat Island Study"`);
 * - leftover "SOURCE 2" style labels.
 * Narrative forms are replaced with "research" so the sentence still reads.
 */
export function removeUngroundedCitations(
  text: string,
  studyTitles: readonly string[],
): CitationCleanup {
  if (!text || !text.trim()) return { text: text ?? "", removed: [] };
  const citable = citableAuthorYears(studyTitles);
  const removed: string[] = [];
  let out = text;

  // Parenthetical groups, possibly several citations separated by ";".
  out = out.replace(/\(([^()]*\b(?:19|20)\d{2}[a-z]?[^()]*)\)/g, (whole, inner: string) => {
    const parts = inner.split(/;\s*/);
    const citeRx = new RegExp(String.raw`^(?:e\.g\.,?\s*|see\s+)?(${AUTHORS}),?\s+(${YEAR})$`);
    if (!parts.every((p) => citeRx.test(p.trim()))) return whole;
    const keep = parts.filter((p) => {
      const m = p.trim().match(citeRx)!;
      const ok = isCitable(m[1], m[2], citable);
      if (!ok) removed.push(p.trim());
      return ok;
    });
    return keep.length ? `(${keep.join("; ")})` : "";
  });

  // Narrative "Garcia et al. (2013)" / "Israel and Bantayan (2021)".
  out = out.replace(
    new RegExp(String.raw`\b(${AUTHORS})\s+\((${YEAR})\)`, "g"),
    (whole, authors: string, year: string) => {
      if (isCitable(authors, year, citable)) return whole;
      removed.push(`${authors} (${year})`);
      return "research";
    },
  );

  // Quoted titles. Short quotes (< 4 words) are ordinary quotation, not citations.
  out = out.replace(
    /(\(\s*)?(\b(?:per|see|according to|as (?:noted|highlighted|shown|reported|documented|found) (?:in|by)|in|from|by)\s+)?(?:the\s+)?[“"]([^”"]{8,200})[”"](\s*\))?/gi,
    (whole, openParen: string | undefined, lead: string | undefined, title: string, closeParen: string | undefined) => {
      if (title.trim().split(/\s+/).length < 4) return whole;
      if (matchStudyTitle(title, studyTitles)) return whole;
      removed.push(`"${title.trim()}"`);
      if (openParen && closeParen) return "";
      if (lead) return `${openParen ?? ""}${lead}research${closeParen ?? ""}`;
      return `${openParen ?? ""}research${closeParen ?? ""}`;
    },
  );

  // Single-quoted titles, only after a citing word, since apostrophes are common
  // ("as noted in 'Urban Heat Island Mitigation Study'").
  out = out.replace(
    /\b(per|in|from|by|according to)\s+(?:the\s+(?:research|study|paper)\s+)?['‘]([A-Z][^'’]{8,200})['’](?=[\s.,;:)]|$)/g,
    (whole, lead: string, title: string) => {
      if (title.trim().split(/\s+/).length < 4) return whole;
      if (matchStudyTitle(title, studyTitles)) return whole;
      removed.push(`'${title.trim()}'`);
      return `${lead} research`;
    },
  );

  // Unresolved numbered placeholders.
  out = out.replace(/\(?\[?\bSOURCE\s*\d+\]?\)?/gi, (m) => {
    removed.push(m.trim());
    return "";
  });

  return { text: tidy(out), removed };
}

/**
 * Cut text that stops mid-sentence ("…As highlighted in the research,") back to its
 * last complete sentence. Returns "" when there is no complete sentence at all.
 */
export function trimToCompleteSentence(text: string): string {
  const t = (text ?? "").trim();
  if (!t || SENTENCE_END.test(t)) return t;
  const matches = [...t.matchAll(/[.!?]["”')\]]*(?=\s|$)/g)];
  const last = matches.at(-1);
  if (last && last.index !== undefined) return t.slice(0, last.index + last[0].length).trim();
  // One unfinished sentence: drop the dangling trailing clause
  // ("…shade, as noted in the findings of the") if what remains still says something.
  const body = t.replace(/[\s,;:–—-]+$/, "");
  const cut = body.lastIndexOf(", ");
  if (cut > 0) {
    const kept = body.slice(0, cut).trim();
    if (kept.split(/\s+/).length >= 8) return `${kept}.`;
  }
  return "";
}

/** Site metrics used to catch text that contradicts the data. */
export type GreeneryMetrics = {
  ndvi?: number | null;
  treeCanopy?: number | null;
  greeneryIndex?: number | null;
};

function fraction01(v: number | null | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
}

/** True when any metric shows a clearly low-green site. */
export function isLowGreenerySite(m: GreeneryMetrics): boolean {
  const canopy = fraction01(m.treeCanopy);
  return (
    (canopy !== null && canopy < 0.1) ||
    (typeof m.ndvi === "number" && m.ndvi < 0.2) ||
    (typeof m.greeneryIndex === "number" && m.greeneryIndex < 0.3)
  );
}

const HIGH = String.raw`(?:abundant|ample|lush|dense|extensive|substantial|rich|high|plentiful|significant)`;
const GREEN_NOUN = String.raw`(?:greenery|green cover|vegetation|tree cover|canopy)`;
/**
 * Claims about the site's *current* state only. "Planting creates dense canopy" is
 * an outcome, not a claim, so a high-greenery phrase must sit next to a
 * present-state cue ("already", "existing", "the site has", "well-shaded").
 */
const HIGH_GREENERY_CLAIMS = [
  new RegExp(String.raw`\b(?:already|currently|existing|present)\b[^.!?]{0,40}\b${HIGH}\s+(?:existing\s+)?${GREEN_NOUN}`, "i"),
  new RegExp(String.raw`\b${HIGH}\s+(?:existing\s+)?${GREEN_NOUN}\b[^.!?]{0,20}\b(?:already|currently)\b`, "i"),
  new RegExp(String.raw`\b(?:site|area|barangay|location)\s+(?:already\s+)?(?:has|have|boasts|enjoys|features)\s+(?:an?\s+|its\s+)?${HIGH}\s+${GREEN_NOUN}`, "i"),
  /\b(?:already|well)[- ](?:green|vegetated|shaded)\b/i,
];

/**
 * Drop sentences that describe a low-green site as already green
 * (QA: Tabok at 1.9 % canopy, NDVI 0.04 was called "abundant greenery with a high canopy").
 */
export function removeGreeneryContradictions(
  text: string,
  metrics: GreeneryMetrics | null | undefined,
): CitationCleanup {
  if (!text || !metrics || !isLowGreenerySite(metrics)) return { text: text ?? "", removed: [] };
  const sentences = text.match(/[^.!?]+[.!?]+["”')\]]*\s*|[^.!?]+$/g) ?? [text];
  const removed: string[] = [];
  const kept = sentences.filter((s) => {
    if (HIGH_GREENERY_CLAIMS.some((rx) => rx.test(s))) {
      removed.push(s.trim());
      return false;
    }
    return true;
  });
  return { text: kept.join("").trim(), removed };
}
