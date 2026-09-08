import fs from "node:fs";
import { commonProhibitions, palette, sceneSpecs } from "./batch-320-specs.mjs";

const sourcePath = "tmp/world-195x4/batch-319/materialize-batch-319.mjs";
const targetPath = "tmp/world-195x4/batch-320/materialize-batch-320.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

function replaceRequired(search, replacement) {
  if (!source.includes(search)) {
    throw new Error(`Missing replacement target: ${search.slice(0, 120)}`);
  }
  source = source.replace(search, replacement);
}

function replaceRange(start, end, replacement) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing range: ${start} ... ${end}`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

replaceRequired("const batch = 319;", "const batch = 320;");
replaceRequired('const country = "Montenegro";', 'const country = "Malta";');
replaceRequired('const countrySlug = "montenegro";', 'const countrySlug = "malta";');
replaceRequired("const firstScene = 1296;", "const firstScene = 1300;");
replaceRequired(
  'const root = path.resolve("tmp/world-195x4/batch-319");',
  'const root = path.resolve("tmp/world-195x4/batch-320");',
);
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
replaceRequired("if (maleScene !== 1298)", "if (maleScene !== 1301)");
source = source.replaceAll("Montenegro", "Malta");
source = source.replaceAll("batch319-montenegro", "batch320-malta");
replaceRange(
  "  rollMethod:",
  "  faceAnchors:",
  `  rollMethod: "FNV-1a over the recorded batch320-malta keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["undercover investigator couture", "nurse-care couture"],
  nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
  nextQueueCountry: "Maldives", nextQueueBatch: 321, nextQueueScenes: [1304, 1305, 1306, 1307],
  researchSources: [
    { url: "https://whc.unesco.org/en/list/131", usedFor: "Valletta's fortified hilly peninsula, natural harbors, uniform civic grid, bastioned walls, and historic urban form" },
    { url: "https://whc.unesco.org/en/tentativelists/983/", usedFor: "Mdina's fortified hilltop, winding street system, Baroque urban fabric, defenses, dry ditches, and terraced setting" },
    { url: "https://www.visitmalta.com/en/attraction/blue-grotto-malta/", usedFor: "Blue Grotto as a recognized Maltese sea-cave attraction and boat-route landscape" },
    { url: "https://whc.unesco.org/en/tentativelists/980/", usedFor: "Dwejra's inland sea, circular subsidence structures, sea tunnel, limestone cliffs, caves, stacks, reefs, fossil layers, and Fungus Rock" },
  ],
  faceAnchors:`,
);
replaceRange(
  "  countryMotifPolicy:",
  "  rollAudit:",
  `  countryMotifPolicy: {
    flagMotifDecision: "No literal Malta flag, Maltese cross, coat of arms, crown, or official emblem is copied onto clothing. Large researched secular harbor, bastion, civic-grid, gate, lane, terrace, natural-arch, sea-cave, cliff, inland-sea, tunnel, sea-stack, reef, fossil-layer, boat, and route fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Malta motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Valletta and Grand Harbour, Mdina's fortified hilltop, Blue Grotto and Wied iz-Zurrieq, and Dwejra's inland sea geology.",
    prohibitions: "No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious architecture, copied ceremonial pattern, copied investigator or nurse uniform, badge, red cross, caduceus, patient, treatment, diagnosis, procedure, sexualized care, weapon threat, police impersonation, arrest, raid, surveillance of people, assassination, combat, political insignia, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Malta images plus one accepted Maldives image when available",
    captionIfEligible: "Malta white heart Maldives #Malta #WorldXXXSeries",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: true,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1300, 1302, and 1303 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1301 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",
  },
  rollAudit:`,
);
replaceRequired(
  'fs.writeFileSync(path.join(root, "batch-319-montenegro-preflight.json")',
  'fs.writeFileSync(path.join(root, "batch-320-malta-preflight.json")',
);
replaceRequired(
  'preflight: path.join(root, "batch-319-montenegro-preflight.json")',
  'preflight: path.join(root, "batch-320-malta-preflight.json")',
);

fs.mkdirSync("tmp/world-195x4/batch-320", { recursive: true });
fs.writeFileSync(targetPath, source, "utf8");
console.log(
  JSON.stringify({ sourcePath, targetPath, bytes: Buffer.byteLength(source) }, null, 2),
);
