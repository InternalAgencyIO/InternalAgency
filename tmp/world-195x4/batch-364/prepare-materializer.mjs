import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-363/materialize-batch-363.mjs", "utf8");
const replacements = [
  ['import { boliviaPalette, boliviaProhibitions, boliviaSceneSpecs } from "./bolivia-scene-specs.mjs";', 'import { tunisiaPalette, tunisiaProhibitions, tunisiaSceneSpecs } from "./tunisia-scene-specs.mjs";'],
  ["const batch = 363;", "const batch = 364;"],
  ['const country = "Bolivia";', 'const country = "Tunisia";'],
  ['const countrySlug = "bolivia";', 'const countrySlug = "tunisia";'],
  ["const firstScene = 1472;", "const firstScene = 1476;"],
  ['const root = path.resolve("tmp/world-195x4/batch-363");', 'const root = path.resolve("tmp/world-195x4/batch-364");'],
  ["const palette = boliviaPalette;", "const palette = tunisiaPalette;"],
  ["const commonProhibitions = boliviaProhibitions;", "const commonProhibitions = tunisiaProhibitions;"],
  ["const sceneSpecs = boliviaSceneSpecs;", "const sceneSpecs = tunisiaSceneSpecs;"],
  ["The theme and Bolivia location", "The theme and Tunisia location"],
  ['const hashtags = ["#Bolivia"];', 'const hashtags = ["#Tunisia"];'],
  ["batch363-bolivia", "batch364-tunisia"],
  ["batchOrdinalWithinTheme: 1,", "batchOrdinalWithinTheme: 2,"],
  ['nextQueueCountry: "Tunisia",', 'nextQueueCountry: "South Sudan",'],
  ["nextQueueBatch: 364,", "nextQueueBatch: 365,"],
  ["nextQueueScenes: [1476, 1477, 1478, 1479],", "nextQueueScenes: [1480, 1481, 1482, 1483],"],
  ['nextCinematicTheme: { active: "Moon-surface expedition couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://www.britannica.com/place/La-Paz-Bolivia", usedFor: "La Paz basin, cable-car and Illimani setting" },', '{ url: "https://www.britannica.com/place/Tunis", usedFor: "Tunis city, lake and Mediterranean setting" },'],
  ['{ url: "https://www.britannica.com/place/Bolivia", usedFor: "Bolivia Altiplano, mountains, salt flats and cities" },', '{ url: "https://www.britannica.com/place/Tunisia", usedFor: "Tunisia Mediterranean, desert and salt-lake geography" },'],
  ['{ url: "https://www.britannica.com/place/Salar-de-Uyuni", usedFor: "Salar de Uyuni salt plain and horizon" },', '{ url: "https://whc.unesco.org/en/list/38/", usedFor: "El Jem amphitheatre architecture" },'],
  ['{ url: "https://www.britannica.com/place/Lake-Titicaca", usedFor: "Lake Titicaca and Cordillera landscape" },', '{ url: "https://www.britannica.com/place/Chott-el-Djerid", usedFor: "Chott el Jerid salt-lake landscape" },'],
  ["No literal Bolivia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular mountain profiles, cable-car arcs, salt polygons, lake currents, white-city terraces and highland strata instead.", "No literal Tunisia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Mediterranean currents, white-city terraces, blue door arches, amphitheatre arcades, salt-lake bands and oasis fans instead."],
  ["Scenes 1472 and 1473 each carry hard large Bolivia motifs on three women and Moon-expedition construction language on at least two. Scenes 1474 and 1475 use four different theme-led lunar expedition outfits without country map prints while Bolivia landmarks remain equally foregrounded.", "Scenes 1476 and 1477 each carry hard large Tunisia motifs on three women and Moon-expedition construction language on at least two. Scenes 1478 and 1479 use four different theme-led lunar expedition outfits without country map prints while Tunisia landmarks remain equally foregrounded."],
  ["The scenes foreground La Paz and Illimani, Salar de Uyuni, Lake Titicaca and Copacabana, and Sucre.", "The scenes foreground Tunis, Sidi Bou Said, El Jem, and Chott el Jerid with Tozeur."],
  ["two Bolivia images plus one accepted Burundi image", "two Tunisia images plus one accepted Bolivia image"],
  ["Bolivia ${heartGlyph} Burundi", "Tunisia ${heartGlyph} Bolivia"],
  ["batch-363-bolivia-preflight.json", "batch-364-tunisia-preflight.json"],
  ["batch-363-bolivia-preflight.json", "batch-364-tunisia-preflight.json"],
  ["restrained Bolivia mountain-profile and salt-polygon embroidery with subtle Moon-surface expedition seam tailoring", "restrained Tunisia Mediterranean-current and salt-band embroidery with subtle Moon-surface expedition seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-364/materialize-batch-364.mjs", output);
