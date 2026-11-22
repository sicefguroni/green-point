import type { InterventionType } from "@/lib/simulation/coefficients";

/**
 * Plant species GreenPoint may recommend, and the ones it must not.
 *
 * Recommendations follow the corpus ("The Sustainability of Native Trees in the
 * Greening Initiatives of the Philippines", "Suitable Species for Urban Forestry",
 * the Cebu mangrove studies): only **native** species are recommended, and only in
 * a plant form that fits the intervention (no trees on green roofs or walls).
 * Introduced and invasive entries are kept so older stored text can be labelled
 * honestly, but they are never recommended.
 */

export type PlantForm =
  | "tree"
  | "palm"
  | "shrub"
  | "herb"
  | "groundcover"
  | "fern"
  | "climber"
  | "grass"
  | "bamboo"
  | "mangrove";

export type SpeciesOrigin = "native" | "introduced" | "invasive";

export type SpeciesEntry = {
  /** Display name (common Filipino name where one is standard). */
  name: string;
  aliases?: string[];
  scientific: string;
  origin: SpeciesOrigin;
  form: PlantForm;
  tags: string[];
  description: string;
};

export const SPECIES_CATALOG: SpeciesEntry[] = [
  // ── Native trees ─────────────────────────────────────────────────────────
  {
    name: "Narra",
    scientific: "Pterocarpus indicus",
    origin: "native",
    form: "tree",
    tags: ["Native", "Nitrogen-fixing", "Shade"],
    description:
      "The Philippine national tree. Fixes nitrogen and forms a broad spreading canopy, a staple of long-term urban greening.",
  },
  {
    name: "Molave",
    scientific: "Vitex parviflora",
    origin: "native",
    form: "tree",
    tags: ["Native", "Drought-tolerant", "Hardwood"],
    description:
      "Tolerates dry, compacted soils, which suits streetscapes and roadsides with little irrigation.",
  },
  {
    name: "Kamagong",
    aliases: ["Mabolo"],
    scientific: "Diospyros discolor",
    origin: "native",
    form: "tree",
    tags: ["Native", "Dense canopy", "Fruit-bearing"],
    description:
      "A native hardwood with a dense crown for shade. Its fruit feeds birds and other urban wildlife.",
  },
  {
    name: "Banaba",
    scientific: "Lagerstroemia speciosa",
    origin: "native",
    form: "tree",
    tags: ["Native", "Flowering", "Medium-sized"],
    description:
      "A medium-sized flowering tree that tolerates poor soils and fits medians, verges and parks.",
  },
  {
    name: "Talisay",
    scientific: "Terminalia catappa",
    origin: "native",
    form: "tree",
    tags: ["Native", "Salt-tolerant", "Shade"],
    description:
      "A coastal native with tiered horizontal branches. Tolerates salty, compacted and nutrient-poor soils.",
  },
  {
    name: "Bitaog",
    aliases: ["Bitanghol", "Palomaria"],
    scientific: "Calophyllum inophyllum",
    origin: "native",
    form: "tree",
    tags: ["Native", "Salt-tolerant", "Coastal"],
    description:
      "Thrives in coastal and saline conditions, suited to waterfronts and flood-prone edges.",
  },
  {
    name: "Dao",
    scientific: "Dracontomelon dao",
    origin: "native",
    form: "tree",
    tags: ["Native", "Large canopy"],
    description:
      "A tall native tree with a broad crown, best for parks and wide boulevards that have room for it.",
  },
  {
    name: "Ipil",
    scientific: "Intsia bijuga",
    origin: "native",
    form: "tree",
    tags: ["Native", "Coastal", "Hardwood"],
    description:
      "A native coastal hardwood that tolerates sandy and periodically wet soils.",
  },
  {
    name: "Kalumpit",
    scientific: "Terminalia microcarpa",
    origin: "native",
    form: "tree",
    tags: ["Native", "Shade", "Fruit-bearing"],
    description:
      "A native shade tree with edible fruit, tolerant of a range of lowland soils.",
  },
  {
    name: "Bani",
    scientific: "Pongamia pinnata",
    origin: "native",
    form: "tree",
    tags: ["Native", "Flood-tolerant", "Nitrogen-fixing"],
    description:
      "A native coastal and riverbank tree that tolerates flooding and fixes nitrogen.",
  },
  {
    name: "Yakal",
    scientific: "Shorea astylosa",
    origin: "native",
    form: "tree",
    tags: ["Native", "Hardwood", "Long-lived"],
    description:
      "A native dipterocarp for parks where a long-lived anchor tree is wanted. Slow to establish.",
  },
  {
    name: "Bignay",
    scientific: "Antidesma bunius",
    origin: "native",
    form: "tree",
    tags: ["Native", "Small tree", "Fruit-bearing"],
    description:
      "A small native fruit tree that fits narrow verges, pocket parks and gap planting.",
  },
  {
    name: "Alagaw",
    scientific: "Premna odorata",
    origin: "native",
    form: "tree",
    tags: ["Native", "Small tree", "Medicinal"],
    description:
      "A small native tree used in traditional medicine, suited to tight planting strips.",
  },
  {
    name: "Alibangbang",
    scientific: "Bauhinia malabarica",
    origin: "native",
    form: "tree",
    tags: ["Native", "Small tree", "Street tree"],
    description:
      "A small native tree with butterfly-shaped leaves, widely planted along streets and in small parks.",
  },
  {
    name: "Pili",
    scientific: "Canarium ovatum",
    origin: "native",
    form: "tree",
    tags: ["Endemic", "Fruit-bearing", "Wind-firm"],
    description:
      "An endemic nut tree with a deep root system that tolerates strong winds.",
  },
  {
    name: "Ilang-ilang",
    scientific: "Cananga odorata",
    origin: "native",
    form: "tree",
    tags: ["Native", "Fast-growing", "Fragrant"],
    description:
      "A fast-growing native tree with fragrant flowers, suited to parks and gap planting.",
  },
  // ── Native palms ─────────────────────────────────────────────────────────
  {
    name: "Anahaw",
    scientific: "Saribus rotundifolius",
    origin: "native",
    form: "palm",
    tags: ["Native", "Ornamental", "Narrow footprint"],
    description:
      "The national leaf. A fan palm with a narrow footprint for medians and plazas.",
  },
  {
    name: "Nipa",
    scientific: "Nypa fruticans",
    origin: "native",
    // A palm, but it only grows in brackish tidal water, so it is grouped with the
    // mangroves rather than with street palms like Anahaw.
    form: "mangrove",
    tags: ["Native", "Mangrove associate", "Brackish water"],
    description:
      "A native palm of brackish estuaries and tidal channels, used in wetland and mangrove restoration.",
  },
  // ── Native shrubs ────────────────────────────────────────────────────────
  {
    name: "Lagundi",
    scientific: "Vitex negundo",
    origin: "native",
    form: "shrub",
    tags: ["Native", "Hardy", "Medicinal"],
    description:
      "A hardy native shrub that tolerates drought and periodic wetting, used for hedges and rain-garden edges.",
  },
  {
    name: "Tsaang Gubat",
    scientific: "Ehretia microphylla",
    origin: "native",
    form: "shrub",
    tags: ["Native", "Hedge", "Medicinal"],
    description:
      "A small-leaved native shrub that takes clipping well, good for low hedges and planters.",
  },
  {
    name: "Kamuning",
    scientific: "Murraya paniculata",
    origin: "native",
    form: "shrub",
    tags: ["Native", "Hedge", "Fragrant"],
    description:
      "A dense, fragrant native shrub for hedges, screens and roof planters.",
  },
  {
    name: "Sambong",
    scientific: "Blumea balsamifera",
    origin: "native",
    form: "shrub",
    tags: ["Native", "Fast-growing", "Medicinal"],
    description:
      "A fast-growing native medicinal shrub for understory planting and community gardens.",
  },
  {
    name: "Pandan Dagat",
    aliases: ["Pandan"],
    scientific: "Pandanus tectorius",
    origin: "native",
    form: "shrub",
    tags: ["Native", "Salt-tolerant", "Wind-resistant"],
    description:
      "A salt- and wind-tolerant native screw pine for coastal buffers and exposed sites.",
  },
  // ── Native herbs, groundcover, ferns, climbers, grasses, bamboo ──────────
  {
    name: "Badiang",
    aliases: ["Alocasia", "Giant Taro"],
    scientific: "Alocasia macrorrhizos",
    origin: "native",
    form: "herb",
    tags: ["Native", "Large-leaved", "Moist soils"],
    description:
      "A large-leaved native aroid for shaded, moist beds in rain gardens and pocket parks.",
  },
  {
    name: "Takip-kohol",
    aliases: ["Gotu kola", "Centella"],
    scientific: "Centella asiatica",
    origin: "native",
    form: "groundcover",
    tags: ["Native", "Groundcover", "Moist soils"],
    description:
      "A low native groundcover that likes moist soil, suited to rain gardens and permeable planting strips.",
  },
  {
    name: "Bird's Nest Fern",
    aliases: ["Pakpak-lawin"],
    scientific: "Asplenium nidus",
    origin: "native",
    form: "fern",
    tags: ["Native", "Epiphyte", "Shade-tolerant"],
    description:
      "A native epiphytic fern for shaded green walls, planters and roof gardens.",
  },
  {
    name: "Pakong-alagdan",
    scientific: "Blechnum orientale",
    origin: "native",
    form: "fern",
    tags: ["Native", "Hardy fern"],
    description:
      "A hardy native fern for green-wall modules, slopes and understory planting.",
  },
  {
    name: "Staghorn Fern",
    aliases: ["Sungay-usa"],
    scientific: "Platycerium coronarium",
    origin: "native",
    form: "fern",
    tags: ["Native", "Epiphyte"],
    description:
      "A native epiphytic fern that mounts on walls and trunks with little substrate.",
  },
  {
    name: "Hoya",
    aliases: ["Hoyas"],
    scientific: "Hoya spp.",
    origin: "native",
    form: "climber",
    tags: ["Native", "Climber", "Low water"],
    description:
      "Native wax-flower vines that climb trellises and cables with little water.",
  },
  {
    name: "Jade Vine",
    aliases: ["Tayabak"],
    scientific: "Strongylodon macrobotrys",
    origin: "native",
    form: "climber",
    tags: ["Endemic", "Climber", "Flowering"],
    description:
      "An endemic flowering vine for pergolas and sturdy trellises; it needs strong support.",
  },
  {
    name: "Tiger Grass",
    aliases: ["Tambo"],
    scientific: "Thysanolaena latifolia",
    origin: "native",
    form: "grass",
    tags: ["Native", "Erosion control"],
    description:
      "A clumping native grass that binds soil on banks and in bioswales.",
  },
  {
    name: "Kawayan Tinik",
    aliases: ["Kawayan"],
    scientific: "Bambusa blumeana",
    origin: "native",
    form: "bamboo",
    tags: ["Native", "Bank stabilization"],
    description:
      "A native thorny bamboo widely used to stabilize riverbanks and creek edges.",
  },
  {
    name: "Bolo",
    scientific: "Gigantochloa levis",
    origin: "native",
    form: "bamboo",
    tags: ["Native", "Bank stabilization"],
    description:
      "A large native bamboo for riparian strips and erosion control.",
  },
  // ── Native mangroves ─────────────────────────────────────────────────────
  {
    name: "Bakauan",
    aliases: ["Bakhaw"],
    scientific: "Rhizophora spp.",
    origin: "native",
    form: "mangrove",
    tags: ["Native", "Mangrove", "Storm buffer"],
    description:
      "Stilt-rooted native mangroves that trap sediment and buffer storm surge on tidal flats.",
  },
  {
    name: "Bungalon",
    aliases: ["Api-api"],
    scientific: "Avicennia marina",
    origin: "native",
    form: "mangrove",
    tags: ["Native", "Mangrove", "Pioneer"],
    description:
      "A pioneer native mangrove that colonizes exposed seaward mudflats.",
  },
  {
    name: "Pagatpat",
    scientific: "Sonneratia alba",
    origin: "native",
    form: "mangrove",
    tags: ["Native", "Mangrove", "Seaward zone"],
    description:
      "A native mangrove of the seaward zone, tolerant of regular tidal flooding.",
  },
  // ── Introduced / invasive: recognised, never recommended ─────────────────
  {
    name: "Acacia",
    aliases: ["Rain Tree", "Raintree"],
    scientific: "Samanea saman",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Large canopy"],
    description:
      "An introduced shade tree from tropical America. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Fire Tree",
    aliases: ["Flame Tree", "Caballero", "Poinciana"],
    scientific: "Delonix regia",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Ornamental"],
    description:
      "An introduced ornamental from Madagascar. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Mahogany",
    scientific: "Swietenia macrophylla",
    origin: "invasive",
    form: "tree",
    tags: ["Introduced", "Invasive risk"],
    description:
      "An introduced timber tree known to crowd out native vegetation. Not recommended by GreenPoint.",
  },
  {
    name: "Ipil-ipil",
    aliases: ["Leucaena"],
    scientific: "Leucaena leucocephala",
    origin: "invasive",
    form: "tree",
    tags: ["Introduced", "Invasive"],
    description:
      "An invasive introduced species that forms dense thickets. Not recommended by GreenPoint.",
  },
  {
    name: "Gmelina",
    aliases: ["Yemane"],
    scientific: "Gmelina arborea",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Plantation timber"],
    description:
      "An introduced plantation timber tree. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Mangium",
    aliases: ["Acacia mangium"],
    scientific: "Acacia mangium",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Plantation timber"],
    description:
      "An introduced plantation tree from Australasia. Not recommended by GreenPoint.",
  },
  {
    name: "Golden Shower",
    aliases: ["Cassia fistula"],
    scientific: "Cassia fistula",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Ornamental"],
    description: "An introduced flowering tree from South Asia. Not recommended by GreenPoint.",
  },
  {
    name: "Mango",
    aliases: ["Mangga"],
    scientific: "Mangifera indica",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Fruit tree"],
    description: "An introduced fruit tree. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Jackfruit",
    aliases: ["Langka"],
    scientific: "Artocarpus heterophyllus",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Fruit tree"],
    description: "An introduced fruit tree. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Guava",
    aliases: ["Bayabas"],
    scientific: "Psidium guajava",
    origin: "invasive",
    form: "tree",
    tags: ["Introduced", "Invasive risk"],
    description: "An introduced fruit tree that spreads readily. Not recommended by GreenPoint.",
  },
  {
    name: "Moringa",
    aliases: ["Malunggay"],
    scientific: "Moringa oleifera",
    origin: "introduced",
    form: "tree",
    tags: ["Introduced", "Edible"],
    description: "An introduced edible tree. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Sampaguita",
    scientific: "Jasminum sambac",
    origin: "introduced",
    form: "shrub",
    tags: ["Introduced", "Fragrant"],
    description: "An introduced flowering shrub. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Bougainvillea",
    scientific: "Bougainvillea spectabilis",
    origin: "introduced",
    form: "climber",
    tags: ["Introduced", "Ornamental"],
    description: "An introduced ornamental vine. Not recommended by GreenPoint, which favours native species.",
  },
  {
    name: "Pothos",
    aliases: ["Golden Pothos"],
    scientific: "Epipremnum aureum",
    origin: "invasive",
    form: "climber",
    tags: ["Introduced", "Invasive risk"],
    description: "An introduced vine that escapes into forests. Not recommended by GreenPoint.",
  },
];

/** Plant forms that fit each intervention. */
export const FORMS_BY_INTERVENTION: Record<InterventionType, PlantForm[]> = {
  "urban canopy": ["tree"],
  "targeted infill": ["tree"],
  "green corridor": ["tree", "palm", "shrub"],
  "pocket park": ["tree", "palm", "shrub", "herb", "groundcover", "fern"],
  "understory shrubs": ["shrub", "herb", "groundcover", "fern"],
  "green roof": ["shrub", "groundcover", "fern", "grass"],
  "vertical greening": ["climber", "fern"],
  "rain garden": ["groundcover", "grass", "shrub", "herb"],
  "permeable surface": ["groundcover", "grass"],
  "riparian buffer": ["tree", "bamboo", "shrub", "grass"],
  "wetland restoration": ["mangrove"],
};

/** Native picks used to top up a list when fewer than two valid species remain. */
export const DEFAULT_SPECIES_BY_INTERVENTION: Record<InterventionType, string[]> = {
  "urban canopy": ["Narra", "Banaba", "Talisay"],
  "targeted infill": ["Banaba", "Bignay", "Molave"],
  "green corridor": ["Narra", "Anahaw", "Kamuning"],
  "pocket park": ["Banaba", "Kamuning", "Bird's Nest Fern"],
  "understory shrubs": ["Lagundi", "Tsaang Gubat", "Kamuning"],
  "green roof": ["Kamuning", "Tsaang Gubat", "Bird's Nest Fern"],
  "vertical greening": ["Hoya", "Bird's Nest Fern", "Pakong-alagdan"],
  "rain garden": ["Takip-kohol", "Tiger Grass", "Lagundi"],
  "permeable surface": ["Takip-kohol", "Tiger Grass"],
  "riparian buffer": ["Bani", "Kawayan Tinik", "Talisay"],
  "wetland restoration": ["Bakauan", "Bungalon", "Nipa"],
};

const MIN_SPECIES = 2;
const MAX_SPECIES = 4;

function keyOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, SpeciesEntry>();
for (const entry of SPECIES_CATALOG) {
  for (const label of [entry.name, ...(entry.aliases ?? []), entry.scientific]) {
    BY_KEY.set(keyOf(label), entry);
  }
}

/**
 * Find a catalog entry from a name as written, e.g. "Narra (Pterocarpus indicus)",
 * "pterocarpus indicus" or "Bakhaw".
 */
export function findSpecies(raw: string): SpeciesEntry | null {
  const direct = BY_KEY.get(keyOf(raw));
  if (direct) return direct;
  const inParens = raw.match(/\(([^)]+)\)/)?.[1];
  if (inParens) {
    const byScientific = BY_KEY.get(keyOf(inParens));
    if (byScientific) return byScientific;
    const genus = keyOf(inParens).split(" ")[0];
    const byGenus = SPECIES_CATALOG.find(
      (e) => e.scientific.endsWith("spp.") && keyOf(e.scientific).split(" ")[0] === genus,
    );
    if (byGenus) return byGenus;
  }
  return null;
}

/** Split a comma-separated species string, ignoring commas inside parentheses. */
export function splitSpeciesList(value: string): string[] {
  return value
    .split(/[,;](?![^()]*\))/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export type SpeciesGrounding = {
  species: string;
  /** Entries dropped, with the reason, for logging. */
  removed: string[];
  /** True when catalog defaults were added to reach the minimum. */
  toppedUp: boolean;
};

/**
 * Keep only native catalog species whose plant form fits the intervention,
 * deduplicated and capped at four. When fewer than two remain, top up from the
 * intervention's native defaults so a card never shows filler or unsuitable plants.
 */
export function groundSpeciesForIntervention(
  value: string,
  intervention: InterventionType,
): SpeciesGrounding {
  const forms = FORMS_BY_INTERVENTION[intervention];
  const kept: SpeciesEntry[] = [];
  const removed: string[] = [];

  for (const raw of splitSpeciesList(value ?? "")) {
    const entry = findSpecies(raw);
    if (!entry) {
      removed.push(`${raw} (not a recognised species)`);
    } else if (entry.origin !== "native") {
      removed.push(`${raw} (${entry.origin})`);
    } else if (!forms.includes(entry.form)) {
      removed.push(`${raw} (${entry.form} does not fit ${intervention})`);
    } else if (!kept.includes(entry)) {
      kept.push(entry);
    }
  }

  let toppedUp = false;
  if (kept.length < MIN_SPECIES) {
    for (const name of DEFAULT_SPECIES_BY_INTERVENTION[intervention]) {
      const entry = findSpecies(name);
      if (entry && !kept.includes(entry)) {
        kept.push(entry);
        toppedUp = true;
      }
      if (kept.length >= MIN_SPECIES) break;
    }
  }

  return {
    species: kept.slice(0, MAX_SPECIES).map((e) => e.name).join(", "),
    removed,
    toppedUp,
  };
}

/** Prompt block listing the native species allowed for each intervention. */
export function buildSpeciesPromptBlock(
  labels: Record<InterventionType, { label: string }>,
): string {
  return (Object.keys(FORMS_BY_INTERVENTION) as InterventionType[])
    .map((key) => {
      const forms = FORMS_BY_INTERVENTION[key];
      const names = SPECIES_CATALOG.filter(
        (e) => e.origin === "native" && forms.includes(e.form),
      ).map((e) => e.name);
      return `- ${labels[key].label}: ${names.join(", ")}`;
    })
    .join("\n");
}
