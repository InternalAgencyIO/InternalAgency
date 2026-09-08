import fs from "node:fs";
import { commonProhibitions, palette, sceneSpecs } from "./batch-319-specs.mjs";

const sourcePath = "tmp/world-195x4/batch-318/materialize-batch-318.mjs";
const targetPath = "tmp/world-195x4/batch-319/materialize-batch-319.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

function replaceRequired(search, replacement) {
  if (!source.includes(search)) throw new Error(`Missing replacement target: ${search.slice(0, 120)}`);
  source = source.replace(search, replacement);
}

function replaceRange(start, end, replacement) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing range: ${start} ... ${end}`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

replaceRequired("const batch = 318;", "const batch = 319;");
replaceRequired('const country = "Suriname";', 'const country = "Montenegro";');
replaceRequired('const countrySlug = "suriname";', 'const countrySlug = "montenegro";');
replaceRequired("const firstScene = 1292;", "const firstScene = 1296;");
replaceRequired('const root = path.resolve("tmp/world-195x4/batch-318");', 'const root = path.resolve("tmp/world-195x4/batch-319");');
replaceRange(
  "const commonProhibitions =",
  "const sceneSpecs = [",
  `const commonProhibitions = ${JSON.stringify(commonProhibitions)};\nconst palette = ${JSON.stringify(palette)};\n\nconst sceneSpecs = [`,
);
replaceRange(
  "const sceneSpecs = [",
  "];\n\nconst maleKey",
  `const sceneSpecs = ${JSON.stringify(sceneSpecs, null, 2)};\n\nconst maleKey`,
);
replaceRequired("if (maleScene !== 1293)", "if (maleScene !== 1298)");
source = source.replaceAll("Suriname", "Montenegro");
source = source.replaceAll("batch318-suriname", "batch319-montenegro");
replaceRequired(
  "and ECE keeps the separate hands-free route map.",
  "and ECE keeps the separate hands-free holographic route map.",
);
replaceRange(
  "  rollMethod:",
  "  faceAnchors:",
  `  rollMethod: "FNV-1a over the recorded batch319-montenegro keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextThemePair: ["undercover investigator couture", "nurse-care couture"],
  nextQueueCountry: "Malta", nextQueueBatch: 320, nextQueueScenes: [1300, 1301, 1302, 1303],
  researchSources: [
    { url: "https://whc.unesco.org/en/list/100", usedFor: "Durmitor limestone massif, glacial lakes, Black Lake, black-pine forest, and Tara River gorge" },
    { url: "https://whc.unesco.org/en/list/125", usedFor: "Boka Kotorska linked bays, steep rocky hills, coastal town planning, fortified settlements, and sea routes" },
    { url: "https://www.montenegro.travel/en/explore-montenegro/culture-and-tours/fortresses", usedFor: "Kotor's 4.5-kilometre defensive wall system rising from the sea to the mountain fortress" },
    { url: "https://www.montenegro.travel/en/unique-montenegro/canyons-of-montenegro/tara-canyon", usedFor: "Tara River limestone gorge, forested walls, mountain water, and Djurdjevica bridge setting" },
    { url: "https://www.montenegro.travel/en/inspiration-for-a-dream-trip/en167/the-bridge-on-durdevica-tara", usedFor: "Djurdjevica Tara Bridge's five concrete arches, 365-metre span, and canyon crossing" },
    { url: "https://www.montenegro.travel/en/unique-montenegro/national-parks-of-montenegro/skadar-lake-national-park", usedFor: "Skadar Lake water lilies, reed habitat, Virpazar, Rijeka Crnojevica, kayaking, and cycling routes" },
  ],
  faceAnchors:`,
);
replaceRange(
  "  countryMotifPolicy:",
  "  rollAudit:",
  `  countryMotifPolicy: {
    flagMotifDecision: "No literal Montenegro flag, coat of arms, double-headed eagle, crown, or official emblem is copied onto clothing. Large researched secular bay, wall, mountain, glacial-lake, canyon, bridge, forest, river, water-lily, reed, path, and route fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Montenegro motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Durmitor and Black Lake, Kotor's fortified bay, the Tara gorge and Djurdjevica bridge, and Skadar Lake with Rijeka Crnojevica.",
    prohibitions: "No literal flag, coat of arms, double-headed eagle, crown, official seal, sacred symbol, religious architecture, copied ceremonial pattern, copied covert or investigator uniform, badge, weapon threat, police impersonation, arrest, raid, surveillance of people, assassination, combat, political insignia, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Montenegro images plus one accepted Malta image when available",
    captionIfEligible: "Montenegro white heart Malta #Montenegro #WorldXXXSeries",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: true,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1296, 1297, and 1299 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1298 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",
  },
  rollAudit:`,
);
replaceRequired(
  'fs.writeFileSync(path.join(root, "batch-318-suriname-preflight.json")',
  'fs.writeFileSync(path.join(root, "batch-319-montenegro-preflight.json")',
);
replaceRequired(
  'preflight: path.join(root, "batch-318-suriname-preflight.json")',
  'preflight: path.join(root, "batch-319-montenegro-preflight.json")',
);

fs.mkdirSync("tmp/world-195x4/batch-319", { recursive: true });
fs.writeFileSync(targetPath, source, "utf8");
console.log(JSON.stringify({ sourcePath, targetPath, bytes: Buffer.byteLength(source) }, null, 2));
