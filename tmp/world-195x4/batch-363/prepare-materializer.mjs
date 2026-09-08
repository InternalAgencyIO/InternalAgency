import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-362/materialize-batch-362.mjs", "utf8");
const replacements = [
  ['import { burundiPalette, burundiProhibitions, burundiSceneSpecs } from "./burundi-scene-specs.mjs";', 'import { boliviaPalette, boliviaProhibitions, boliviaSceneSpecs } from "./bolivia-scene-specs.mjs";'],
  ["const batch = 362;", "const batch = 363;"],
  ['const country = "Burundi";', 'const country = "Bolivia";'],
  ['const countrySlug = "burundi";', 'const countrySlug = "bolivia";'],
  ["const firstScene = 1468;", "const firstScene = 1472;"],
  ['const root = path.resolve("tmp/world-195x4/batch-362");', 'const root = path.resolve("tmp/world-195x4/batch-363");'],
  ["const palette = burundiPalette;", "const palette = boliviaPalette;"],
  ["const commonProhibitions = burundiProhibitions;", "const commonProhibitions = boliviaProhibitions;"],
  ["const sceneSpecs = burundiSceneSpecs;", "const sceneSpecs = boliviaSceneSpecs;"],
  ["The theme and Burundi location", "The theme and Bolivia location"],
  ['const hashtags = ["#Burundi"];', 'const hashtags = ["#Bolivia"];'],
  ["batch362-burundi", "batch363-bolivia"],
  ['active: "Mars-surface expedition couture",', 'active: "Moon-surface expedition couture",'],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Bolivia",', 'nextQueueCountry: "Tunisia",'],
  ["nextQueueBatch: 363,", "nextQueueBatch: 364,"],
  ["nextQueueScenes: [1472, 1473, 1474, 1475],", "nextQueueScenes: [1476, 1477, 1478, 1479],"],
  ['nextCinematicTheme: { active: "Moon-surface expedition couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "Moon-surface expedition couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Bujumbura", usedFor: "Bujumbura and Lake Tanganyika setting" },', '{ url: "https://www.britannica.com/place/La-Paz-Bolivia", usedFor: "La Paz basin, cable-car and Illimani setting" },'],
  ['{ url: "https://www.britannica.com/place/Burundi", usedFor: "Burundi highlands, lakes and forest geography" },', '{ url: "https://www.britannica.com/place/Bolivia", usedFor: "Bolivia Altiplano, mountains, salt flats and cities" },'],
  ['{ url: "https://www.britannica.com/place/Lake-Tanganyika", usedFor: "Lake Tanganyika shore and mountain landscape" },', '{ url: "https://www.britannica.com/place/Salar-de-Uyuni", usedFor: "Salar de Uyuni salt plain and horizon" },'],
  ['{ url: "https://www.britannica.com/place/Gitega", usedFor: "Gitega central-highland city setting" },', '{ url: "https://www.britannica.com/place/Lake-Titicaca", usedFor: "Lake Titicaca and Cordillera landscape" },'],
  ["No literal Burundi flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular lake currents, highland terraces, city arcs, canopy layers, tea-field ribbons and waterfall steps instead.", "No literal Bolivia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular mountain profiles, cable-car arcs, salt polygons, lake currents, white-city terraces and highland strata instead."],
  ["Scenes 1468 and 1469 each carry hard large Burundi motifs on three women and Mars-expedition construction language on at least two. Scenes 1470 and 1471 use four different theme-led Mars expedition outfits without country map prints while Burundi landmarks remain equally foregrounded.", "Scenes 1472 and 1473 each carry hard large Bolivia motifs on three women and Moon-expedition construction language on at least two. Scenes 1474 and 1475 use four different theme-led lunar expedition outfits without country map prints while Bolivia landmarks remain equally foregrounded."],
  ["The scenes foreground Bujumbura and Lake Tanganyika, Gitega, Kibira forest, and Karera Falls.", "The scenes foreground La Paz and Illimani, Salar de Uyuni, Lake Titicaca and Copacabana, and Sucre."],
  ["two Burundi images plus one accepted Rwanda image", "two Bolivia images plus one accepted Burundi image"],
  ["Burundi ${heartGlyph} Rwanda", "Bolivia ${heartGlyph} Burundi"],
  ["batch-362-burundi-preflight.json", "batch-363-bolivia-preflight.json"],
  ["batch-362-burundi-preflight.json", "batch-363-bolivia-preflight.json"],
  ["restrained Burundi lake-current and highland-terrace embroidery with subtle Mars-surface expedition seam tailoring", "restrained Bolivia mountain-profile and salt-polygon embroidery with subtle Moon-surface expedition seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-363/materialize-batch-363.mjs", output);
