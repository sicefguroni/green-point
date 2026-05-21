/**
 * RAG Prompts module
 * Prompt template construction and location-context formatting for the LLM.
 */

import {
  analyzeInterventionContext,
  formatChallengeForPrompt,
  identifyPrimaryChallenges,
} from "@/lib/intervention-context-scoring";
import {
  analyzeSiteSignals,
  formatOptionalFixed,
  formatTreeCanopyForPrompt,
  isFiniteNumber,
} from "@/lib/site-analysis";
import type { LocationContext, RetrievedChunk } from "./query";

// ---------------------------------------------------------------------------
// Site form guidance
// ---------------------------------------------------------------------------

export function buildSiteUrbanFormGuidance(context: LocationContext): string {
  const {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  } = analyzeSiteSignals(context);
  const parts: string[] = [];

  if (highTaggedTreeDensity) {
  const inventoryPct = isFiniteNumber(
      context.inventoryCanopyFraction,
    )
      ? ` (inventory canopy ≈ ${(context.inventoryCanopyFraction * 100).toFixed(1)}%)`
      : "";
    parts.push(
      `**Ground-truth tree inventory:** ${taggedTreeCount} tagged tree(s) are recorded in this area${inventoryPct}—confirming meaningful existing tree cover from the city's official inventory. **Significantly de-emphasize** large-scale new street-tree planting campaigns as the primary recommendation. Instead lead with creation alternatives that **add greenery**: **understory and shrub planting**, **green roofs / vertical greening**, **shade-tolerant ground cover**, **pocket parks / community gardens**, and **targeted infill tree planting** where inventory shows gaps in species diversity, shade equity, or corridor continuity. **Tree stewardship and maintenance** is a valid supporting recommendation but must rank below new-greenery creation, never the headline.`,
    );
  } else if (substantialExistingGreen) {
    parts.push(
      "**Existing canopy / greenery:** Canopy or Greenery Index is relatively high—**avoid over-weighting** generic large-scale new street-tree campaigns as the only top options. Still allow **targeted tree planting** where research supports clear gaps (shade deficits, corridor continuity, species diversity, equity of access, or vacant strips). Lead with **creation** options (targeted infill, understory, vertical greening, pocket parks, courtyards) and **only** include stewardship/maintenance as a supporting recommendation, not the headline.",
    );
  }

  if (likelyDenseLimitedGround) {
    parts.push(
      "**Heat-stressed, built-up context (heuristic):** Metrics suggest a **tighter** ground footprint—**lean somewhat** toward roof gardens, green roofs, vertical/green walls, facade/balcony greening, and pocket/courtyard interventions, **without excluding** **narrow linear planting**, parklets, or **street trees** where a verifiable verge, median, or small parcel exists. Mention space trade-offs briefly when relevant. Slightly favor feasibility for modular/envelope options only when ground expansion is genuinely difficult—not as a blanket rule.",
    );
  }

  const vision = context.visionContext;
  if (vision && vision.confidence >= 0.35) {
    if (
      vision.buildingDensityLevel === "HIGH" ||
      vision.roofGreeningPotential === "HIGH" ||
      vision.verticalGreeningPotential === "HIGH"
    ) {
      parts.push(
        "**Image-derived urban form:** Photo analysis indicates a dense/built context with strong envelope opportunities. Prioritize roof gardens and vertical greening as primary options, while still including targeted ground interventions where feasible.",
      );
    }
    if (vision.groundOpenSpaceLevel === "HIGH") {
      parts.push(
        "**Image-derived open space signal:** Photo suggests meaningful ground space is available. Keep ground-based interventions (trees, understory, pocket parks, rain gardens) highly represented in the shortlist.",
      );
    }
    if (vision.permeabilityHint === "LOW") {
      parts.push(
        "**Image-derived soil/permeability hint:** Visible cues suggest lower infiltration. De-emphasize permeability-dependent interventions unless paired with engineered drainage/permeable retrofits.",
      );
    } else if (vision.permeabilityHint === "HIGH") {
      parts.push(
        "**Image-derived soil/permeability hint:** Visible cues suggest better infiltration potential. Rain gardens and permeable-surface strategies can be weighted higher for feasibility.",
      );
    }
  }

  parts.push(
    "**General:** Offer a **balanced mix** of ground-based (including trees where appropriate) and building-envelope options; let the evidence and metrics decide weights.",
  );

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Context block formatting
// ---------------------------------------------------------------------------

export function formatLocationContextBlock(context: LocationContext): string {
  const lines: string[] = [];
  lines.push(`Area: ${context.areaName ?? "Unknown"}`);
  lines.push(`- NDVI (greenness): ${formatOptionalFixed(context.ndvi, 2)}`);
  lines.push(
    `- LST (surface temperature): ${formatOptionalFixed(context.lst, 1)}°C`,
  );
  lines.push(
    `- Tree canopy (blended): ${formatTreeCanopyForPrompt(context.treeCanopy)}`,
  );
  lines.push(
    `- Greenery Index (composite): ${formatOptionalFixed(context.greeneryIndex, 3)}`,
  );
  lines.push(
    `- Greenery level (band): ${context.greeneryLevel != null && context.greeneryLevel !== "" ? context.greeneryLevel : "N/A"}`,
  );
  lines.push(
    `- Flood hazard: ${isFiniteNumber(context.floodHazard) ? context.floodHazard : "N/A"}/3`,
  );
  lines.push(
    `- Storm / surge hazard: ${isFiniteNumber(context.stormHazard) ? context.stormHazard : "N/A"}/3`,
  );
  lines.push(`- Air quality (AQI): ${formatOptionalFixed(context.aqi, 0)}`);
  // Tagged tree inventory
  const treeCount = isFiniteNumber(context.taggedTreeCount)
    ? context.taggedTreeCount
    : null;
  const invCanopy = isFiniteNumber(context.inventoryCanopyFraction)
    ? context.inventoryCanopyFraction
    : null;
  lines.push(
    `- Tagged tree inventory count: ${
      treeCount !== null ? treeCount : "N/A"
    } tree(s) (ground-truth city inventory)`,
  );
  lines.push(
    `- Inventory-only canopy fraction: ${
      invCanopy !== null ? `${(invCanopy * 100).toFixed(1)}%` : "N/A"
    } (from tagged tree crown areas only)`,
  );
  lines.push(
    `- Selected area: ${
      isFiniteNumber(context.areaHectares)
        ? `${context.areaHectares.toFixed(2)} ha`
        : "N/A"
    }`,
  );
  if (context.visionContext && context.visionContext.confidence >= 0.35) {
    const vision = context.visionContext;
    lines.push("- Vision context (geotagged image analysis):");
    lines.push(`  - Ground open space: ${vision.groundOpenSpaceLevel}`);
    lines.push(`  - Building density: ${vision.buildingDensityLevel}`);
    lines.push(`  - Roof greening potential: ${vision.roofGreeningPotential}`);
    lines.push(
      `  - Vertical greening potential: ${vision.verticalGreeningPotential}`,
    );
    lines.push(`  - Soil visibility: ${vision.soilVisibility}`);
    lines.push(`  - Permeability hint: ${vision.permeabilityHint}`);
    lines.push(`  - Vision confidence: ${vision.confidence.toFixed(2)}`);
  } else {
    lines.push("- Vision context (geotagged image analysis): N/A");
  }
  return lines.join("\n");
}

/**
 * Surface the biggest issues at the site (most severe first) so the AI can
 * lead its recommendations with whatever intervention most directly
 * alleviates the dominant challenge. Falls back to a "no acute challenges"
 * note when nothing crosses a planning threshold.
 */
export function formatPrimaryChallengesBlock(context: LocationContext): string {
  const signals = analyzeInterventionContext(context);
  const challenges = identifyPrimaryChallenges(signals);
  if (challenges.length === 0) {
    return "No acute hazards crossed planning thresholds. Optimize for general greenery uplift, equity, and connectivity.";
  }
  const lines = challenges.map(
    (c, i) =>
      `${i + 1}. ${formatChallengeForPrompt(c)} (severity ${c.severity.toFixed(2)})`,
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full generation prompt
// ---------------------------------------------------------------------------

export function buildGenerationPrompt(
  context: LocationContext,
  retrievedChunks: RetrievedChunk[],
) {
  const contextBlock = retrievedChunks
    .map((c, i) => `[SOURCE ${i + 1}: "${c.studyTitle}"]\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are an expert urban greening consultant for Philippine cities.
Grounded strictly in the research excerpts provided, generate 3-5 prioritized recommendations.

**Lead with a balanced planning choice.** Read the PRIMARY CHALLENGES block in the user message — the first item is the most severe issue on site. The top-ranked recommendation should meaningfully alleviate that challenge, but it must also be defensible on total environmental impact, cooling / GI gain where relevant, cost, and feasibility. Do not rank a narrow hazard-matching intervention first if another option addresses the issue while producing better overall greening outcomes at lower cost. Make this explicit in the recommendation's "justification" field by naming the challenge and the mechanism (e.g. "addresses flood pressure while improving shade and GI through a corridor treatment").

Adapt intervention types to **site context** (see SITE FORM & SPACE below)—these are **soft** biases, not hard bans:
- **Creation outranks stewardship.** Interventions that *add new greenery* (targeted infill trees, understory and shrubs, green roofs / vertical greening, pocket parks, green corridors, rain gardens, riparian / buffer planting, depaving) must rank above pure **stewardship / maintenance / pruning / "tree care"** options whenever both fit the site. Stewardship can be included as a supporting recommendation but should not be the headline action when there is any meaningful opportunity to expand greenery.
- Where **tagged tree inventory confirms meaningful existing trees**, **strongly de-emphasize** broad new tree-planting as the primary recommendation; instead lead with creation alternatives that add greenery (understory plants and shrubs, vertical greening, pocket parks, green corridors, targeted infill where gaps exist). Stewardship/maintenance is still valid but ranks below new-greenery creation.
- Where **canopy / Greenery Index are already high** (but low inventory count), **slightly de-emphasize** only **broad** new tree-planting campaigns; keep **targeted** trees (gaps, corridors, shade equity) when the evidence fits. Stewardship may be mentioned as a co-recommendation, not the lead.
- Where metrics suggest **tight ground** (heat stress + low green), **lean** toward roof/vertical/envelope and pocket greening, but **still include** street or verge trees, parklets, or small groves when justified.
- When helpful, **briefly name** the constraint (e.g. high tagged-tree count vs tight ROW)—not every recommendation must repeat it.

For each, provide:
- "name": Concise title.
- "interventionType": Type of solution.
- "summary": A very brief (max 10-15 words) description of what this is, suitable for a small card.
- "description": A concise (1-3 sentences) detailed description of the intervention.
- "justification": A concise 1-2-sentence justification for WHY this is recommended for THIS specific location. Explicitly reference relevant site metrics by name (e.g. NDVI, LST, tagged tree count).
- "recommendedSpecies": A string listing 1-4 specific plant or tree species suitable for this intervention in a Philippine urban context (e.g., "Narraw, Molave, Knight's Bush"), ideally based on the research provided or local suitability. It would be nice if the local name  
- "rationale": Scientific rationale citing specific studies.
- "sourceStudy": Title of the primary study matching a source.
- "priority": "high", "medium", or "low".
- "efficiency": number (0-100) representing site-specific effectiveness.
- "equity": number (0-1) social benefit level.
- "cost": number (0-1) normalized cost (0=cheap, 1=expensive). Penalize interventions that are costly relative to their expected local benefit.
- "impact": number (0-1) environmental impact level. Score this from expected GI, cooling/LST, canopy/NDVI, stormwater, air-quality, and carbon benefits — not only from hazard fit.
- "relevancy": number (0-1) how well the intervention matches this site's hazards and metrics.
- "feasibility": number (0-1) practical feasibility in a typical Philippine urban barangay: land tenure, maintenance burden, institutional capacity, supply chain, and time-to-implement (1 = very feasible).

Format: Return ONLY a JSON object with a "recommendations" key containing the array.`;

  const userPrompt = `## LOCATION CONTEXT
${formatLocationContextBlock(context)}

## PRIMARY CHALLENGES (most severe first — lead the recommendations toward alleviating these)
${formatPrimaryChallengesBlock(context)}

## SITE FORM & SPACE (use for reasoning and prioritization)
${buildSiteUrbanFormGuidance(context)}

## RESEARCH EVIDENCE
${contextBlock || "Use best practices for Philippine urban greening."}

Tailor recommendations using the metrics above, the PRIMARY CHALLENGES block, SITE FORM & SPACE, and the evidence. Guidelines (apply when metrics fit; **balance** SITE FORM with evidence):
- **Balance challenge fit with impact and cost**: The top recommendation should address PRIMARY CHALLENGE #1, but do not select an option only because it is a textbook hazard match. If another strategy also alleviates the challenge while giving better GI/cooling/NDVI improvement or materially lower cost, rank that balanced strategy higher. Examples: severe flooding → rain garden / permeable surface / riparian buffer / green corridor depending on stormwater benefit, cooling, GI, and cost; severe heat → urban canopy / green corridor / targeted infill; severe heat in tight ground → vertical greening / green roof / pocket park; storm exposure → riparian buffer / coastal-tolerant corridor; poor air quality → buffer planting / corridor; green deficit → pocket park / corridor / targeted infill. Set "priority": "high" only when both relevancy and value-for-impact are strong.
- **Creation > stewardship**: Always rank interventions that add new greenery (understory, shrubs, vertical greening, pocket parks, corridors, targeted infill, rain gardens, buffer planting) above pure stewardship/maintenance options when both are plausible. Reflect this in priority, relevancy, and impact so the headline recommendation creates greenery rather than just preserving it.
- **Tagged tree count is ground-truth**: If the inventory shows significant existing trees, shift emphasis away from broad new tree planting and toward creation alternatives that add greenery — understory planting, shrubs, vertical greening, pocket parks, corridors, and targeted infill. Stewardship is supporting, not leading.
- High LST or heat stress: prioritize **cooling** (shade, evapotranspiration). Combine **trees** (including **narrow strips / suitable ROW**), **green roofs**, **cool corridors**, and **vertical greening** as appropriate; if canopy or tree inventory is already high, favor **targeted** planting over city-wide generic campaigns.
- Low NDVI + low canopy + low tagged tree count: vegetation establishment and canopy building remain valid; in dense areas, pair **some** ground trees with roof/vertical options.
- Heat-island + tight ground (see SITE FORM): weight **roof, vertical, envelope, pocket** a bit more, but **do not drop** tree planting if the research supports a feasible verge, median, or pocket site.
- High flood hazard: stormwater retention, bioswales, riparian buffers, permeable surfaces where appropriate.
- High storm hazard: wind-resilient species, drainage-aware siting, coastal or surge-aware planting where relevant.
- High AQI: pollutant capture, buffer planting, health-related co-benefits.
Score "feasibility" with a **light touch** on space: lower only when an option is clearly impractical; **street and pocket tree planting** can still score well when maintenance and tenure are realistic.
Cite sources accurately.`;

  return { systemPrompt, userPrompt };
}
