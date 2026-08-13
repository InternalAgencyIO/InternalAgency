import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { czechiaPalette, czechiaProhibitions, czechiaSceneSpecs } from "./czechia-scene-specs.mjs";

const batch = 372;
const country = "Czechia";
const countrySlug = "czechia";
const firstScene = 1508;
const root = path.resolve("tmp/world-195x4/batch-372");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];
const palette = czechiaPalette;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const roll = (key) => fnv1a(key) % 100;
const fromDistribution = (value, distribution, resultKey) => {
  for (const entry of distribution) {
    const [startText, endText = startText] = entry.range.split("-");
    if (value >= Number(startText) && value <= Number(endText)) return entry[resultKey];
  }
  throw new Error(`No distribution result for ${value}`);
};

const primaryPairs = [];
const selectorPairs = [];
const primary = (key) => {
  const value = roll(key);
  primaryPairs.push([key, value]);
  return { key, roll: value };
};
const selector = (key, result) => {
  const value = roll(key);
  selectorPairs.push([key, value]);
  return { key, roll: value, result };
};

const commonProhibitions = czechiaProhibitions;

const legacySceneSpecs = [
  {
    scene: 1304,
    theme: "nurse-care couture",
    landmark: "a broad dry nonslip covered marine-research overlook above Hanifaru Bay in Baa Atoll, with a sweeping heart-shaped atoll lagoon, shallow turquoise reef shelves, faros, patch reefs, unoccupied sand cays, distant manta silhouettes outside the target line, one empty paper-route target fixed to a full sand backstop, and a distant waterspout over open ocean far beyond the shelter",
    motifs: "large complete heart-shaped Baa Atoll lagoon, Hanifaru funnel-current, manta-wing, patch-reef, sand-cay, plankton-spiral, monsoon-cloud, and research-route compositions",
    culture: "Baa Atoll is presented as a UNESCO biosphere reserve of lagoons, faros, patch reefs, coral islands, seagrass, mangroves, and marine biodiversity. Hanifaru wildlife stays distant and entirely outside the prop line. Nurse-care couture is fictional fashion about mutual calm and conservation research, with no patient, clinic, treatment, diagnosis, procedure, instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    target: "one clearly unoccupied geometric paper route target fixed to a complete sand backstop on an empty research lane, with no person, animal, boat, structure, or camera in or beyond the line",
    composition: "ECE stands far left in a stable eye-level route-training stance with open sky and sand backstop behind both arms. The male is left-center with his strongest sustained eye line on ECE. Ellie is center holding PAWS high against her upper torso, Alia is right-center, and Radiance is far right. The five adults form a shallow moving arc with every arm against open lagoon, sky, or shelter gaps.",
    hands: [
      "ECE uses both hands on the inert prop grip, left support hand wrapped over the right firing hand, both wrists straight; ECE touches nobody else",
      "the male left hand rests on Ellie's near shoulder and his right hand rests on Alia's near forearm; his strongest eye line stays on ECE",
      "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on the male's near forearm",
      "Alia left hand rests on the male's near forearm and Alia right hand rests on Radiance's near shoulder",
      "Radiance left hand rests on Alia's near shoulder and Radiance right hand rests on Ellie's near forearm",
    ],
    pawsPlan: "One tiny collarless golden kitten PAWS is securely cradled by Ellie at center, far across the composition from the prop and target line. Radiance gives one gentle forearm touch toward Ellie. No second kitten, floor placement, ribbon, costume, collar, leash, prop proximity, or unsafe footing.",
    emotionNuance: {
      Radiance: "awe shown by widened tear-bright eyes toward the manta silhouettes while maintaining gentle contacts",
      Ellie: "determination shown by a steady protective posture around PAWS and a warm glance toward the male",
      Alia: "deep sadness shown by downcast tear-bright eyes that lift toward Radiance's reassuring touch",
      "AI ECE": "aching romantic longing shown by a softened glance from the sights toward the male without moving the muzzle",
      Male: "playful mischief shown by a restrained knowing half-smile and the strongest sustained eye line toward ECE",
    },
  },
  {
    scene: 1305,
    theme: "nurse-care couture",
    landmark: "a broad dry covered public overlook above Fuvahmulah's Thoondu shore, with the complete single-island atoll silhouette, distinctive glossy pebble beach, fringing reef, strong white surf, palm rim, inland wetland contours, one empty marked paper route target against a complete coral-sand berm, and cinematic snow-like white sea-spray flurries instead of unsafe precipitation on the deck",
    motifs: "large complete Fuvahmulah single-island outline, Thoondu pebble-beach sweep, fringing-reef band, white-surf arc, palm-rim, twin-kilhi contour, coral-sand berm, and route-grid compositions",
    culture: "Fuvahmulah is presented through its UNESCO biosphere reserve, shallow-bowl island form, wetlands called kilhi, mangroves, fringing reef, and distinctive Thoondu pebble beach. Nurse-care couture is fictional fashion about mutual calm and conservation research, with no patient, clinic, treatment, diagnosis, procedure, instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    target: "one clearly unoccupied geometric paper route target on a complete coral-sand backstop beside an empty marked path, away from every person, animal, tree, building, vehicle, and camera",
    composition: "ECE stands far left in the final two-hand sight picture after a completed controlled handoff; the other woman has released completely. Radiance, Ellie, and Alia form a close rotating triangle to the right, with all six of their hands visible against surf, sky, and open path gaps. Nobody stands in front of ECE.",
    hands: [
      "ECE uses both hands on the inert prop grip in the final stable sight picture; no other person touches or supports the prop",
      "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Alia's near forearm",
      "Ellie left hand rests on Radiance's near shoulder and Ellie right hand rests on Alia's near shoulder",
      "Alia left hand rests on Ellie's near forearm and Alia right hand rests on Radiance's near forearm",
    ],
    emotionNuance: {
      Radiance: "emotional exhaustion shown by heavy eyes and a grateful breath toward Ellie",
      Ellie: "suspicion shown by a measured sideways glance toward Alia while keeping both contacts gentle",
      Alia: "startled surprise shown by widened eyes toward Radiance's retained forearm touch",
      "AI ECE": "shame and social vulnerability shown by a small lowered glance before reestablishing calm route focus",
    },
  },
  {
    scene: 1306,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered civic overlook beside Addu Atoll's long island-link causeway, with the complete horseshoe lagoon, reef passes, sandbanks, seagrass shallows, mangrove and wetland belts, low coral islands, the empty causeway curve, one distant unoccupied floating navigation marker on open water, and a heavy monsoon rain curtain beyond the shelter",
    motifs: "large complete Addu horseshoe-lagoon, causeway-link, reef-pass, seagrass-shallow, mangrove-belt, sandbank, coral-island chain, and empty navigation-route compositions",
    culture: "Addu Atoll is presented as a UNESCO biosphere reserve with lagoons, reef passes, seagrass beds, sandbanks, coral islands, lush vegetation, mangroves, wetlands, and brackish lakes. Doctor-clinical-command couture is original fictional command fashion about route analysis, with no patient, treatment, diagnosis, procedure, copied uniform, badge, red cross, caduceus, injury, emergency, authority impersonation, or sexualized care.",
    target: "one distant clearly empty floating navigation marker on open lagoon water, with no boat, swimmer, animal, person, or occupied structure anywhere along or beyond the line",
    composition: "ECE stands far left with an unobstructed two-hand sight picture across open water while a nearby console projects the hands-free route map. Radiance, Ellie, and Alia occupy a curved affectionate triangle on the right beneath the shelter. Open water, pale rain, and causeway gaps isolate all eight arm paths.",
    hands: [
      "ECE uses both hands on the inert prop grip with no hidden map hand and touches nobody else",
      "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Alia's near forearm",
      "Ellie left hand rests on Radiance's near upper arm and Ellie right hand rests on Alia's near shoulder",
      "Alia left hand rests on Ellie's near forearm and Alia right hand rests on Radiance's near shoulder",
    ],
    emotionNuance: {
      Radiance: "betrayal shock shown by a stunned fixed gaze toward ECE while accepting Ellie's calm touch",
      Ellie: "tender affection shown by a soft reassuring smile toward Radiance",
      Alia: "awe shown by lifted eyes toward the storm-lit atoll geometry",
      "AI ECE": "intense curiosity, deterministically disambiguated from a matching betrayal-shock roll, shown by an intent analytical gaze through the route sights",
    },
  },
  {
    scene: 1307,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry nonslip covered conservation overlook above Baa Atoll's micro-atolls and lagoon, with complete faros, patch reefs, bright shallows, mangrove islets, empty sand cays, one distant unoccupied floating navigation marker on open water, and a cinematic mammatus storm ceiling with dry stable footing",
    motifs: "large complete Baa lagoon-ring, micro-atoll, faro, patch-reef, mangrove-islet, sand-cay, manta-current, mammatus-cloud, and empty navigation-route compositions",
    culture: "Baa Atoll is presented respectfully through its UNESCO biosphere reserve, coral reefs, lagoons, faros, micro-atolls, patch reefs, seagrass, mangroves, and marine conservation. Doctor-clinical-command couture is original fictional command fashion about route analysis, with no patient, treatment, diagnosis, procedure, copied uniform, badge, red cross, caduceus, injury, emergency, authority impersonation, or sexualized care.",
    target: "one distant clearly empty floating navigation marker on open lagoon water, with no boat, swimmer, animal, person, or occupied structure anywhere along or beyond the line",
    composition: "Alia stands far left in an unobstructed two-hand open-water sight picture. Ellie stands left-center securely holding PAWS far from Alia and the muzzle line. Radiance and ECE are the unmistakable close affectionate center at right, with a hands-free wrist projector mapping the route beside ECE. Sky, lagoon, and shelter gaps isolate all eight arms.",
    hands: [
      "Alia uses both hands on the inert prop grip, left support hand wrapped over right firing hand, and touches nobody else",
      "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on Radiance's near shoulder",
      "Radiance left hand rests on ECE's cheek and Radiance right hand rests on ECE's near forearm",
      "ECE left hand rests at Radiance's near waist and ECE right hand rests on Radiance's near forearm; ECE does not touch the prop",
    ],
    pawsPlan: "One tiny collarless golden kitten PAWS is securely cradled by Ellie left-center, far from Alia, the prop, open water, and every muzzle line. No second kitten, floor placement, ribbon, costume, collar, leash, prop proximity, or unsafe footing.",
    emotionNuance: {
      Radiance: "magnetic confidence shown by a poised affectionate half-smile toward ECE",
      Ellie: "tender affection shown by a soft smile toward PAWS and Radiance",
      Alia: "crying with visible tears shown by tear tracks while maintaining stable safe route focus",
      "AI ECE": "betrayal shock, deterministically disambiguated from a matching magnetic-confidence roll, shown by stunned tear-bright eyes toward Radiance while accepting reassurance",
    },
  },
];

const legacySceneSpecs2 = [
  {
    scene: 1308,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry public overlook above Cidade Velha on Santiago, with the historic stone street grid, low limewashed houses, the complete hilltop fortress silhouette, Ribeira Grande valley, black-rock Atlantic shore, and one unoccupied geometric paper route target fixed to a full basalt-and-sand backstop on a closed empty lane",
    motifs: "complete Santiago island outline, Cidade Velha street grid, hill-fort silhouette, Ribeira Grande valley contour, basalt-shore wave, Atlantic route arc, stone-wall geometry, and trade-wind cloud compositions",
    culture: "Cidade Velha is presented as Cabo Verde's UNESCO World Heritage historic centre through its original street layout, stone architecture, valley-to-sea relationship, maritime setting, and hilltop fortress. The fashion is original fictional command couture about route analysis, with no patient, treatment, copied uniform, badge, authority impersonation, injury, emergency, or sexualized care.",
    target: "one clearly unoccupied geometric paper route target fixed to a complete basalt-and-sand backstop on a closed empty lane, with no person, animal, vehicle, structure, or camera in or beyond the line",
    composition: "The resolved handler stands far left with open backstop or ocean behind both arms. The other adults move in a shallow affectionate arc to the right, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, sea, stone gaps, or open lane.",
  },
  {
    scene: 1309,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry nonslip mountain overlook above Santo Antao's Paul Valley, with complete serrated basalt ridges, deep green terraced slopes, sugarcane fields, cloud banks lifting from the Atlantic, distant Porto Novo road switchbacks, and one unoccupied geometric paper route target fixed to a complete basalt-and-sand backstop on a closed empty overlook lane",
    motifs: "complete Santo Antao island profile, Paul Valley terraces, basalt-ridge zigzag, sugarcane contour, switchback-road ribbon, cloud-bank band, Atlantic swell, and empty navigation-route compositions",
    culture: "Santo Antao is shown respectfully through its dramatic rocky terrain, green valleys, terraced agriculture, mountain roads, and Atlantic setting. The fashion is original fictional command couture about route analysis, with no patient, treatment, copied uniform, badge, authority impersonation, injury, emergency, or sexualized care.",
    target: "one clearly unoccupied geometric paper route target fixed to a complete basalt-and-sand backstop on a closed empty overlook lane, with no person, animal, vehicle, structure, or camera in or beyond the line",
    composition: "The resolved handler stands far left in an unobstructed sight picture across open water. The remaining adults form a curved affectionate triangle to the right beneath a wind shelter, with all arms separated by sky, valley, and railing gaps.",
  },
  {
    scene: 1310,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry public viewing terrace at Cha das Caldeiras on Fogo, with the complete Pico do Fogo cone, black lava fields, the caldera wall, scattered vine rows, white cloud streamers, sunset light, and one empty geometric route target against a complete volcanic-sand backstop on a closed observation lane",
    motifs: "complete Fogo island cone, Pico do Fogo silhouette, caldera-ring geometry, black-lava flow, vine-row contour, volcanic-sand fan, sunset route arc, and cloud-streamer compositions",
    culture: "Fogo is presented through its volcanic caldera, Pico do Fogo cone, black lava landscape, highland agriculture, and public observation paths. Adult nightlife performance couture is fictional evening fashion for a poised pre-show route tableau, with no stripping, explicit dance, stage pole, alcohol, copied uniform, badge, threat, combat, or unsafe spectacle.",
    target: "one clearly unoccupied geometric paper route target fixed to a complete volcanic-sand backstop on a closed empty observation lane, with no person, animal, vehicle, building, or camera in or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance. The other adults pivot through a dynamic affectionate crescent to the right as if pausing before an evening performance, never dancing, with each arm isolated against lava, sky, caldera, or terrace gaps.",
  },
  {
    scene: 1311,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered harbor overlook above Mindelo's Porto Grande on Sao Vicente, with the complete crescent bay, Monte Cara profile, colorful secular waterfront facades, marina geometry, distant Monte Verde ridge, empty quays, trade-wind cloud bands, and one distant unoccupied floating navigation marker on open harbor water",
    motifs: "complete Sao Vicente island outline, Porto Grande crescent, Monte Cara profile, marina-grid geometry, waterfront-facade rhythm, sail-route arc, trade-wind cloud band, and empty harbor-marker compositions",
    culture: "Mindelo is presented through Porto Grande's crescent harbor, Monte Cara, colorful secular waterfront architecture, marina routes, and Sao Vicente's dry volcanic ridges. Adult nightlife performance couture is fictional evening fashion for a poised pre-show route tableau, with no stripping, explicit dance, stage pole, alcohol, copied uniform, badge, threat, combat, or unsafe spectacle.",
    target: "one distant clearly empty floating navigation marker on open harbor water, with no boat, swimmer, animal, person, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with an unobstructed open-water sight picture. The other adults move through a close affectionate crescent to the right under the shelter, with every hand visible against sky, harbor, facade, or railing gaps.",
  },
];

const legacySceneSpecs3 = [
  {
    scene: 1320,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered public overlook above Eleuthera's Glass Window Bridge, with the complete narrow limestone ridge and bridge crossing, rich cobalt Atlantic water on one side, calm turquoise Bight of Eleuthera on the other, rocky shoreline shelves, empty road curves, and layered trade-wind clouds",
    motifs: "complete Eleuthera island ribbon, Glass Window Bridge span, narrow limestone-ridge line, Atlantic cobalt band, Bight turquoise band, rock-shelf fan, empty-road curve, and trade-wind cloud compositions",
    culture: "Eleuthera is presented through the Glass Window Bridge, the narrow limestone divide, the deep Atlantic, the calm Bight of Eleuthera, and public panoramic geology. Cleaner and service couture is original fictional fashion about careful overlook stewardship, with no cleaning chemicals, copied uniform, servant framing, badge, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick sand-and-limestone safety backstop on a closed empty overlook lane, with no person, animal, vehicle, bridge span, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied calm Bight of Eleuthera reach, with no boat, swimmer, bird, animal, person, bridge, rock shelf, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through an affectionate working arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, water, bridge, rock, or railing gaps.",
  },
  {
    scene: 1321,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered conservation overlook above the Exuma Cays Land and Sea Park, with a complete chain of emerald cays, pristine aquamarine channels, deserted pale beaches, protected coral-reef bands, empty moorings, and a clear Atlantic horizon",
    motifs: "complete Exuma Cays chain, emerald-cay silhouettes, aquamarine-channel braid, pale-beach crescents, coral-reef band, empty-mooring grid, Atlantic-horizon line, and conservation-route compositions",
    culture: "The Exuma Cays are presented through the protected land and sea park, emerald cays, aquamarine channels, deserted beaches, coral reefs, and no-take conservation. Cleaner and service couture is original fictional fashion about careful public-overlook stewardship, with no cleaning chemicals, copied uniform, servant framing, badge, wildlife contact, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete sand-filled safety backstop on a closed empty overlook lane, with no person, animal, boat, reef, cay, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied aquamarine channel, with no boat, diver, swimmer, bird, animal, person, coral, cay, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning triangle to the right, every arm separated by sky, channel, cay, reef, shelter, or railing gaps.",
  },
  {
    scene: 1322,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered nature overlook on Andros, with complete inland blue-hole circles, mangrove creeks, tidal flats, pine-forest bands, the Andros Barrier Reef arc, and the deep Tongue of the Ocean beyond, while all wildlife stays entirely outside the target line",
    motifs: "complete Andros island outline, blue-hole circle system, mangrove-creek braid, tidal-flat bands, pine-forest rhythm, barrier-reef arc, Tongue-of-the-Ocean depth gradient, and route-grid compositions",
    culture: "Andros is presented through its many inland and oceanic blue holes, tidal flats, mangrove creeks, pine forests, barrier reef, and protected wilderness. Cinematic covert-agent crew couture is fictional film-editorial route styling only, with no assassination, copied uniform, badge, authority impersonation, raid, arrest, threat, combat, or wildlife contact.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete sand-and-limestone safety backstop on a closed empty overlook lane, with no person, animal, trail user, tree, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty marked route buoy in an unoccupied broad tidal-flat channel, with no kayak, swimmer, bird, animal, person, mangrove bank, reef, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults cross through an affectionate cinematic route arc to the right, never a static lineup, and every arm is isolated against sky, blue hole, mangrove, flat, forest, or shelter gaps.",
  },
  {
    scene: 1323,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered coastal overlook above Gold Rock Beach in Lucayan National Park on Grand Bahama, with complete low-tide ripple patterns, a wide pale-sand welcome-mat shoreline, turquoise shallows, mangrove-boardwalk geometry, pine-forest bands, empty beach curves, and a distant Atlantic horizon",
    motifs: "complete Grand Bahama island outline, Gold Rock Beach low-tide ripple field, pale-shoreline sweep, turquoise-shallow bands, mangrove-boardwalk geometry, pine-forest rhythm, empty-beach curve, and Atlantic-horizon compositions",
    culture: "Grand Bahama is presented through protected Gold Rock Beach, Lucayan National Park, low-tide sand ripples, mangrove boardwalks, pine forest, and the Atlantic coast. Cinematic covert-agent crew couture is fictional film-editorial route styling only, with no assassination, copied uniform, badge, authority impersonation, raid, arrest, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete sand-filled safety backstop on a closed empty overlook lane, with no person, animal, vehicle, boardwalk, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker on open Atlantic water beyond the beach, with no boat, swimmer, bird, animal, person, boardwalk, reef, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate cinematic crescent to the right beneath the shelter, with every arm separated by sky, sea, beach, mangrove, forest, or railing gaps.",
  },
];

const legacySceneSpecs4 = [
  {
    scene: 1324,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered waterfront overlook beside Reykjavik's unmistakable Harpa concert hall, with its complete multicolored geometric glass facade, calm old-harbor water, distant Mount Esja profile, empty quay lines, silver sea mist, and hands-free route-map light reflected across the civic glass",
    motifs: "complete Harpa honeycomb-glass facade, Reykjavik harbor grid, Mount Esja profile, silver-mist band, geometric light cell, empty-quay line, ocean-route arc, and aurora-ribbon compositions",
    culture: "Reykjavik is presented through Harpa's secular contemporary glass architecture, public harbor geometry, Mount Esja, sea light, and an empty civic waterfront. Cinematic covert-agent crew couture is fictional film-editorial route styling only, with no assassination, copied uniform, badge, authority impersonation, raid, arrest, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick basalt-and-sand safety backstop on a closed empty harbor-training lane, with no person, animal, vehicle, glass facade, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied harbor reach, with no boat, swimmer, bird, animal, person, quay, glass facade, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through an affectionate cinematic arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, harbor, glass, mountain, or railing gaps.",
  },
  {
    scene: 1325,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered geology overlook in Thingvellir National Park, with the complete Almannagja rift-wall profile, visible North American and Eurasian plate-separation corridor, dark lava fields, Thingvallavatn lake, moss bands, empty timber paths, and low silver cloud layers",
    motifs: "complete Almannagja rift-wall profile, paired tectonic-plate contours, lava-field tessellation, Thingvallavatn lake band, moss ribbon, empty-path geometry, silver-cloud layer, and route-grid compositions",
    culture: "Thingvellir is presented respectfully through its secular rift-valley geology, Almannagja fault walls, lava fields, lake, moss, and public paths. Cinematic covert-agent crew couture is fictional film-editorial route styling only, with no assassination, copied uniform, badge, authority impersonation, raid, arrest, threat, combat, sacred framing, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete basalt-and-sand safety backstop on a closed empty overlook lane, with no person, animal, trail user, rift wall, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lake reach, with no boat, swimmer, bird, animal, person, shore path, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning triangle to the right, every arm separated by sky, rift, lake, lava, moss, shelter, or railing gaps.",
  },
  {
    scene: 1326,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered glacial overlook above Jokulsarlon, with the complete Breidamerkurjokull glacier tongue, luminous blue and white icebergs drifting across the lagoon, black-sand margins, open Atlantic outlet, distant moraine lines, and no wildlife anywhere in the target corridor",
    motifs: "complete Breidamerkurjokull glacier tongue, Jokulsarlon lagoon outline, blue-iceberg facet field, black-sand band, moraine contour, open-water channel, silver-mist veil, and route-grid compositions",
    culture: "Jokulsarlon is presented through glacier-lagoon science, the Breidamerkurjokull tongue, drifting icebergs, black sand, moraine geometry, and open water. Undercover investigator couture is original fictional inquiry fashion only, with no police imitation, official badge, copied uniform, surveillance of people, arrest, raid, interrogation, threat, combat, wildlife contact, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete black-sand-and-basalt safety backstop on a closed empty overlook lane, with no person, animal, glacier ice, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open lagoon reach, with no boat, swimmer, bird, animal, person, iceberg, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults cross through an affectionate investigative route arc to the right, never a static lineup, and every arm is isolated against sky, glacier, lagoon, iceberg gaps, black sand, or shelter openings.",
  },
  {
    scene: 1327,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered coastal overlook above Reynisfjara, with the complete black-sand beach sweep, geometric basalt-column wall, Reynisdrangar sea-stack silhouettes, Dyrholaey headland profile, powerful empty Atlantic surf, silver spray, and a closed unoccupied observation lane",
    motifs: "complete Reynisfjara black-sand sweep, basalt-column tessellation, Reynisdrangar sea-stack silhouettes, Dyrholaey headland profile, Atlantic-surf arc, silver-spray band, lava-red route line, and aurora-grid compositions",
    culture: "Reynisfjara is presented through its secular volcanic geology, black-sand coast, basalt columns, sea stacks, headland, and Atlantic wave patterns from a protected public overlook. Undercover investigator couture is original fictional inquiry fashion only, with no police imitation, official badge, copied uniform, surveillance of people, arrest, raid, interrogation, threat, combat, sacred framing, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete black-sand-and-basalt safety backstop on a closed empty overlook lane, with no person, animal, vehicle, basalt formation, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker on open Atlantic water beyond the protected overlook, with no boat, swimmer, bird, animal, person, sea stack, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate investigative crescent to the right beneath the shelter, with every arm separated by sky, sea, black sand, basalt, sea-stack, headland, or railing gaps.",
  },
];

const legacySceneSpecs5 = [
  {
    scene: 1328,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered waterfront overlook above Port Vila and Mele Bay on Efate, with the complete harbor crescent, Iririki Island silhouette, empty marina grid, rainforest ridges, coral shelf, turquoise channels, and layered Pacific cloud bands",
    motifs: "complete Efate island outline, Port Vila harbor crescent, Mele Bay channel, Iririki Island silhouette, marina grid, coral-shelf bands, rainforest ridge, and Pacific route-arc compositions",
    culture: "Efate is presented through secular civic waterfront geography, Port Vila harbor, Mele Bay, Iririki Island, coral shelves, rainforest ridges, and an empty marina. Undercover investigator couture is original fictional inquiry fashion only, with no police imitation, official badge, copied uniform, surveillance of people, arrest, raid, interrogation, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete basalt-and-coral-sand safety backstop on a closed empty harbor-training lane, with no person, animal, vehicle, marina, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied harbor reach, with no boat, swimmer, bird, animal, person, marina, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate investigative arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, harbor, island, mountain, or railing gaps.",
  },
  {
    scene: 1329,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered geological overlook facing Mount Yasur on Tanna, with the complete volcanic cone, caldera rim, broad black-ash plain, lava-red glow confined inside the distant crater, rainforest belt, safe closed observation lane, and layered windblown clouds",
    motifs: "complete Tanna island profile, Mount Yasur cone, caldera ring, ash-plain fan, lava-red crater glow, rainforest belt, cloud spiral, and empty route-grid compositions",
    culture: "Tanna is presented through secular volcanic geology, Mount Yasur's distant cone and caldera, black-ash plains, rainforest, and a protected overlook. Undercover investigator couture is original fictional inquiry fashion only, with no ritual or ceremony, sacred framing, police imitation, official authority, surveillance of people, arrest, raid, interrogation, threat, combat, or unsafe spectacle.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete basalt-and-ash safety backstop on a closed empty overlook lane away from the volcano, with no person, animal, crater, trail user, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty freestanding navigation marker in an unoccupied broad basalt route corridor away from the crater, with no person, animal, trail user, vegetation, occupied structure, or active geological feature anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning investigative triangle to the right beneath the shelter, every arm separated by sky, cone, ash plain, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1330,
    theme: "nurse-care couture",
    landmark: "a broad dry covered conservation overlook above Efate's Blue Lagoon, with the complete turquoise freshwater pool, limestone banks, dense rainforest canopy, pandanus and banyan silhouettes, empty footbridge geometry, sunlit shallows, and no swimmers or wildlife",
    motifs: "complete Efate island outline, Blue Lagoon turquoise pool, limestone-bank contour, rainforest canopy, pandanus fan, banyan-branch rhythm, empty-footbridge line, and freshwater route-grid compositions",
    culture: "Blue Lagoon is presented through secular freshwater conservation, limestone banks, rainforest ecology, native plant silhouettes, clear shallows, and an empty public overlook. Nurse-care couture is public-safe fictional fashion about mutual calm and conservation research only, with no patient, clinic, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete coral-sand-and-limestone safety backstop on a closed empty observation lane, with no person, animal, footbridge, tree, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied lagoon reach, with no boat, swimmer, bird, animal, person, tree, footbridge, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults create a curved affectionate care arc to the right beneath the shelter, every arm separated by sky, lagoon, limestone, rainforest, bridge, shelter, or railing gaps.",
  },
  {
    scene: 1331,
    theme: "nurse-care couture",
    landmark: "a broad dry covered coastal overlook above Champagne Beach on Espiritu Santo, with the complete pale-sand crescent, turquoise shallows, offshore reef bands, rainforest edge, low headlands, an empty bay, and a distant silver tropical shower beyond the shelter",
    motifs: "complete Espiritu Santo island outline, Champagne Beach crescent, turquoise-shallow bands, offshore-reef bands, rainforest edge, headland profile, Pacific swell, and cloud-shower route compositions",
    culture: "Espiritu Santo is presented through secular coastal conservation, Champagne Beach, turquoise shallows, reef bands, rainforest, headlands, Pacific weather, and an empty public overlook. Nurse-care couture is public-safe fictional fashion about mutual calm and conservation research only, with no patient, clinic, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete coral-sand safety backstop on a closed empty observation lane, with no person, animal, vehicle, reef, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-bay reach, with no boat, swimmer, bird, animal, person, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate care crescent to the right beneath the shelter, with every arm separated by sky, bay, reef, beach, rainforest, headland, shelter, or railing gaps.",
  },
];

const legacySceneSpecs6 = [
  {
    scene: 1332,
    theme: "nurse-care couture",
    landmark: "a broad dry covered civic-waterfront overlook above Bridgetown's complete Careenage curve, Chamberlain Bridge arch, colorful gabled warehouse row, empty marina lines, calm Constitution River water, coral-stone quays, and distant green hills under layered tropical clouds",
    motifs: "complete Barbados island outline, Careenage harbor curve, Chamberlain Bridge arch, gabled-warehouse rhythm, Constitution River channel, coral-stone quay grid, mahogany-leaf band, and Atlantic route-arc compositions",
    culture: "Bridgetown is presented through secular civic waterfront geography, the Careenage, Chamberlain Bridge, gabled warehouses, marina geometry, coral-stone quays, and the Constitution River. Nurse-care couture is public-safe fictional fashion about mutual calm and route stewardship only, with no patient, clinic, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete coral-sand-and-limestone safety backstop on a closed empty harbor-training lane, with no person, animal, vehicle, bridge, marina, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied Careenage reach, with no boat, swimmer, bird, animal, person, bridge, marina, quay, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate care arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, river, bridge, warehouse, hill, or railing gaps.",
  },
  {
    scene: 1333,
    theme: "nurse-care couture",
    landmark: "a broad dry covered coastal overlook above Bathsheba on Barbados's east coast, with the complete Soup Bowl surf break, giant coral-limestone boulders, rugged Atlantic shoreline, foam-laced reef shelves, coconut-palm edge, low green hills, and an empty protected observation lane",
    motifs: "complete Barbados island outline, Bathsheba boulder silhouettes, Soup Bowl surf arc, coral-limestone shelf, Atlantic foam band, coconut-palm rhythm, east-coast hill profile, and empty route-grid compositions",
    culture: "Bathsheba is presented through secular coastal geology, coral-limestone boulders, the Soup Bowl surf break, reef shelves, palms, green hills, and an empty protected overlook. Nurse-care couture is public-safe fictional fashion about mutual calm and coastal research only, with no patient, clinic, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete coral-sand-and-limestone safety backstop on a closed empty observation lane, with no person, animal, boulder, surfer, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-water corridor beyond the surf break, with no boat, swimmer, surfer, bird, animal, person, boulder, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning affectionate triangle to the right beneath the shelter, every arm separated by sky, surf, boulder, reef, palm, shelter, or railing gaps.",
  },
  {
    scene: 1334,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered geological gallery overlooking a complete Harrison's Cave chamber, with luminous coral-limestone walls, long stalactite curtains, grounded stalagmite columns, clear underground pools, terraced flowstone, an empty tram path, and warm amber conservation lighting",
    motifs: "complete Barbados island outline, Harrison's Cave chamber arch, stalactite curtain, stalagmite column, flowstone terrace, underground-pool contour, limestone crystal band, and geological route-grid compositions",
    culture: "Harrison's Cave is presented through secular coral-limestone geology, cave chambers, stalactites, stalagmites, flowstone terraces, clear pools, conservation lighting, and an empty visitor path. Doctor-clinical-command couture is public-safe fictional command fashion only, with no patient, clinic, examination, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick sand-filled safety backstop on a closed empty gallery lane, with no person, animal, cave formation, pool, tram, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty illuminated route marker above an unoccupied broad cave-gallery corridor, with no person, animal, cave formation, pool, tram, occupied structure, or conservation feature anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults create a curved affectionate command arc to the right beneath the gallery shelter, every arm separated by chamber, pool, flowstone, path, wall, or railing gaps.",
  },
  {
    scene: 1335,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered cliff overlook beside Animal Flower Cave at North Point, with the complete sea-cave mouth, layered coral-limestone cliff profile, natural rock pool, empty Atlantic horizon, foaming coastal shelves, distant spray plumes, and a protected unoccupied observation lane",
    motifs: "complete Barbados island outline, Animal Flower Cave mouth, North Point cliff profile, natural rock-pool contour, Atlantic-horizon band, foaming reef shelf, spray-plume ribbon, and coastal route-arc compositions",
    culture: "North Point is presented through secular coral-limestone geology, Animal Flower Cave's sea opening, cliff layers, natural rock pool, Atlantic shelves, spray, and a protected empty overlook. Doctor-clinical-command couture is public-safe fictional command fashion only, with no patient, clinic, examination, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete coral-sand-and-limestone safety backstop on a closed empty observation lane, with no person, animal, cave formation, pool, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open Atlantic reach, with no boat, swimmer, bird, animal, person, cave mouth, cliff, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate command crescent to the right beneath the shelter, with every arm separated by sky, sea, cave, cliff, pool, reef, shelter, or railing gaps.",
  },
];

const legacySceneSpecs7 = [
  {
    scene: 1336,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered civic-waterfront overlook above SÃƒÂ£o TomÃƒÂ© city's Ana Chaves Bay, with the complete bay crescent, Pico de SÃƒÂ£o TomÃƒÂ© ridgeline, palm-lined shore, coral-stone quay geometry, empty marina reach, green hills, and layered Atlantic clouds",
    motifs: "complete SÃƒÂ£o TomÃƒÂ© island outline, Ana Chaves Bay crescent, Pico ridgeline, palm-shore rhythm, coral-stone quay grid, cocoa-pod contour, Atlantic current arc, and route-grid compositions",
    culture: "SÃƒÂ£o TomÃƒÂ© is presented through secular civic waterfront geography, Ana Chaves Bay, volcanic ridges, palm-lined shores, coral-stone quay geometry, cocoa ecology, and an empty public overlook. Doctor-clinical-command couture is public-safe fictional command fashion only, with no patient, clinic, examination, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick basalt-and-coral-sand safety backstop on a closed empty harbor-training lane, with no person, animal, vehicle, marina, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied Ana Chaves Bay reach, with no boat, swimmer, bird, animal, person, marina, quay, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate command arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, bay, hill, palm, quay, shelter, or railing gaps.",
  },
  {
    scene: 1337,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered geological overlook facing Pico CÃƒÂ£o Grande in ObÃƒÂ´ Natural Park, with the complete volcanic needle, rainforest canopy, mist layers, fern bands, basalt ridges, and an empty protected observation path",
    motifs: "complete SÃƒÂ£o TomÃƒÂ© island outline, Pico CÃƒÂ£o Grande needle, rainforest canopy, fern spiral, basalt ridge, mist veil, cocoa-pod contour, and route-grid compositions",
    culture: "Pico CÃƒÂ£o Grande and ObÃƒÂ´ are presented through secular volcanic geology, rainforest conservation, fern bands, basalt ridges, cocoa ecology, mist layers, and an empty protected overlook. Doctor-clinical-command couture is public-safe fictional command fashion only, with no patient, clinic, examination, treatment, diagnosis, procedure, medical instrument, copied uniform, badge, red cross, caduceus, injury, emergency, or sexualized care.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick basalt-and-sand safety backstop on a closed empty observation lane away from the volcanic needle and forest, with no person, animal, vegetation, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty freestanding navigation marker in an unoccupied broad basalt route corridor away from the volcanic needle and forest, with no person, animal, trail user, vegetation, occupied structure, or conservation feature anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning affectionate triangle to the right beneath the shelter, every arm separated by sky, needle, mist, rainforest, basalt, shelter, or railing gaps.",
  },
  {
    scene: 1338,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered cocoa-estate overlook at RoÃƒÂ§a SÃƒÂ£o JoÃƒÂ£o dos Angolares, with a complete secular cocoa-drying courtyard, terraced tropical hills, cacao groves, an Atlantic glimpse, stone arcade geometry, empty service paths, and warm evening route lights",
    motifs: "complete SÃƒÂ£o TomÃƒÂ© island outline, cocoa-pod clusters, drying-courtyard grid, cacao-leaf rhythm, hill terraces, Atlantic band, stone-arcade geometry, and evening route-light compositions",
    culture: "The estate is presented through secular agricultural heritage, cocoa ecology, drying-courtyard geometry, cacao groves, tropical hill terraces, stone arcades, and an empty public overlook. Adult nightlife dance-performance couture is public-safe fictional evening fashion expressed through still editorial movement only, with no stripping, explicit dance, nightclub, alcohol, copied uniform, badge, threat, or combat.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick sand-and-cocoa-husk safety backstop on a closed empty training lane, with no person, animal, tree, heritage structure, occupied path, or camera in or beyond the line",
    waterTarget: "one distant clearly empty freestanding navigation marker above an unoccupied broad service-route corridor, with no person, animal, tree, heritage structure, occupied path, or agricultural feature anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate evening-performance arc to the right beneath the shelter, with every arm separated by sky, hill, grove, courtyard, arcade, shelter, or railing gaps.",
  },
  {
    scene: 1342,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered coastal overlook above Praia Banana on PrÃƒÂ­ncipe, with the complete golden beach crescent, twin rocky headlands, turquoise bay, rainforest canopy, reef shelves, empty shore, and a distant tropical rain veil",
    motifs: "complete PrÃƒÂ­ncipe island outline, Praia Banana crescent, headland silhouettes, turquoise-bay band, reef shelf, rainforest canopy, rain veil, and route-arc compositions",
    culture: "PrÃƒÂ­ncipe is presented through secular coastal conservation, Praia Banana's beach crescent, rocky headlands, turquoise bay, reef shelves, rainforest canopy, tropical weather, and an empty public overlook. Adult nightlife dance-performance couture is public-safe fictional evening fashion expressed through still editorial movement only, with no stripping, explicit dance, nightclub, alcohol, copied uniform, badge, threat, or combat.",
    paperTarget: "one clearly unoccupied geometric paper route target fixed to a complete thick coral-sand-and-basalt safety backstop on a closed empty observation lane, with no person, animal, headland, reef, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-bay reach, with no boat, swimmer, bird, animal, person, headland, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate evening-performance crescent to the right beneath the shelter, with every arm separated by sky, bay, beach, headland, reef, rainforest, shelter, or railing gaps.",
  },
];

const legacySceneSpecs8 = [
  {
    scene: 1342,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered civic-waterfront overlook above Apia Harbour on Upolu, with the complete bay crescent, Mount Vaea ridgeline, palm-lined shore, empty marina geometry, coral-stone quay lines, reef shelves, and layered Pacific evening clouds",
    motifs: "complete Upolu island outline, Apia Harbour crescent, Mount Vaea ridge, palm-shore rhythm, coral-stone quay grid, reef shelf, Pacific current arc, and evening route-light compositions",
    culture: "Apia is presented through secular civic waterfront geography, the harbor crescent, Mount Vaea ridgeline, palm-lined shores, marina geometry, reef shelves, and an empty public overlook. Adult nightlife dance-performance couture is public-safe fictional evening fashion expressed through still editorial movement only, with no stripping, explicit dance, nightclub, alcohol, copied uniform, badge, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick lava-stone-and-coral-sand safety backstop on a closed empty harbor-training lane, with no person, animal, vehicle, marina, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied Apia Harbour reach, with no boat, swimmer, bird, animal, person, marina, quay, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate evening-performance arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, bay, hill, palm, quay, shelter, or railing gaps.",
  },
  {
    scene: 1342,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered conservation overlook beside To Sua Ocean Trench on Upolu, with the complete circular turquoise sinkhole pool, basalt rim, descending ladder geometry, lush vine bands, coastal rainforest canopy, lava-tube contours, and an empty protected observation path",
    motifs: "complete Upolu island outline, To Sua circular sinkhole, turquoise-pool ring, basalt ledges, ladder-line rhythm, vine bands, lava-tube arcs, and conservation route-grid compositions",
    culture: "To Sua is presented through secular volcanic geology, a circular sinkhole pool, basalt ledges, vines, coastal rainforest, lava-tube contours, and an empty protected public overlook. Adult nightlife dance-performance couture is public-safe fictional evening fashion expressed through still editorial movement only, with no stripping, explicit dance, nightclub, alcohol, copied uniform, badge, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick basalt-and-sand safety backstop on a closed empty observation lane away from the pool and vegetation, with no person, animal, ladder, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open section of the sinkhole pool, with no swimmer, bird, animal, person, ladder, ledge, vegetation, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning affectionate triangle to the right beneath the shelter, every arm separated by sky, pool, basalt, vine, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1342,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered geological overlook above the Alofaaga Blowholes on Savai'i, with complete black-lava shelves, several distant white ocean plumes, rugged Pacific coast, rainforest margin, empty horizon, spray ribbons, and a protected unoccupied observation lane",
    motifs: "complete Savai'i island outline, Alofaaga blowhole plume, black-lava shelf, Pacific swell arc, rainforest margin, spray ribbon, cloud band, and geological route-grid compositions",
    culture: "Alofaaga is presented through secular coastal geology, black-lava shelves, distant ocean blowhole plumes, Pacific swell, rainforest margins, spray, and an empty protected overlook. Paris runway model couture is original public-safe fictional editorial fashion only, with no copied designer look, brand, runway logo, exposed undergarment, nudity, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick lava-stone-and-sand safety backstop on a closed empty observation lane away from the blowholes, with no person, animal, plume, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-Pacific reach, with no boat, swimmer, bird, animal, person, blowhole, plume, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate runway-turn arc to the right beneath the shelter, with every arm separated by sky, ocean, plume, lava, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1343,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered coastal overlook above Lalomanu Beach on Upolu, with the complete pale-sand crescent, turquoise lagoon, Nu'utele island silhouette, reef shelves, rainforest edge, low headlands, empty shore, and a distant tropical rain veil",
    motifs: "complete Upolu island outline, Lalomanu beach crescent, Nu'utele island silhouette, turquoise-lagoon band, reef shelf, rainforest edge, headland profile, and rain-veil route-arc compositions",
    culture: "Lalomanu is presented through secular coastal conservation, its pale beach crescent, turquoise lagoon, Nu'utele island silhouette, reef shelves, rainforest edge, headlands, tropical weather, and an empty public overlook. Paris runway model couture is original public-safe fictional editorial fashion only, with no copied designer look, brand, runway logo, exposed undergarment, nudity, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand-and-basalt safety backstop on a closed empty observation lane, with no person, animal, island, reef, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lagoon reach, with no boat, swimmer, bird, animal, person, island, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate runway crescent to the right beneath the shelter, with every arm separated by sky, lagoon, beach, island, reef, rainforest, shelter, or railing gaps.",
  },
];

const legacySceneSpecs9 = [
  {
    scene: 1344,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered coastal overlook above Soufriere Bay, with the complete Gros Piton and Petit Piton twin silhouettes, turquoise bay, rainforest slopes, volcanic ridges, empty waterfront reach, coral-stone route geometry, and layered Caribbean clouds",
    motifs: "complete Saint Lucia island outline, twin Piton silhouettes, Soufriere Bay crescent, volcanic-ridge line, rainforest-slope bands, reef shelf, cocoa-pod contour, and Caribbean route-arc compositions",
    culture: "Soufriere Bay is presented through secular volcanic and coastal geography, the complete twin Pitons, turquoise water, rainforest slopes, volcanic ridges, reef shelves, cocoa contours, and an empty public overlook. Paris runway model couture is original public-safe fictional editorial fashion only, with no copied designer look, brand, runway logo, exposed undergarment, nudity, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick volcanic-sand-and-basalt safety backstop on a closed empty observation lane away from both Pitons, with no person, animal, boat, structure, landmark, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-bay reach, with no boat, swimmer, bird, animal, person, Piton, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate runway-turn arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, bay, Piton, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1345,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered rainforest overlook at Tet Paul Nature Trail above Soufriere, with the complete twin Pitons, terraced agricultural hills, rainforest canopy, empty trail geometry, distant Caribbean sea, and layered tropical clouds",
    motifs: "complete Saint Lucia island outline, twin Piton silhouettes, terraced-hill bands, rainforest-canopy rhythm, fern spiral, cocoa-pod contour, Caribbean horizon, and nature-route-grid compositions",
    culture: "Tet Paul is presented through secular rainforest conservation, complete Piton views, terraced agricultural hills, rainforest canopy, cocoa contours, the Caribbean horizon, and an empty protected trail overlook. Paris runway model couture is original public-safe fictional editorial fashion only, with no copied designer look, brand, runway logo, exposed undergarment, nudity, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick volcanic-sand-and-basalt safety backstop on a closed empty trail lane away from the Pitons and vegetation, with no person, animal, landmark, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-sea reach, with no boat, swimmer, bird, animal, person, Piton, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning affectionate runway triangle to the right beneath the shelter, every arm separated by sky, sea, Piton, terraces, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1346,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered geological overlook at Sulphur Springs near Soufriere, with complete volcanic crater terraces, distant mineral pools and steam plumes, dark volcanic soil, rainforest rim, an empty boardwalk route, and a closed dry basalt training corridor",
    motifs: "complete Saint Lucia island outline, sulfur-spring steam arcs, mineral-pool rings, crater-terrace bands, volcanic-soil fields, rainforest rim, boardwalk geometry, and geothermal route-grid compositions",
    culture: "Sulphur Springs is presented through secular geothermal conservation, crater terraces, distant mineral pools, steam plumes, volcanic soil, rainforest rims, and an empty protected overlook. Cleaner and service couture is original public-safe fictional fashion about mutual care for a shared place, with no cleaning chemicals, patient, clinic, treatment, copied uniform, badge, official role, subservient framing, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick basalt-and-volcanic-sand safety backstop on a closed dry corridor away from every geothermal feature, with no person, animal, pool, steam vent, occupied structure, or camera in or beyond the line",
    waterTarget: "one clearly empty freestanding navigation marker in an unoccupied dry basalt corridor, with no person, animal, mineral pool, steam vent, boardwalk, occupied structure, or camera anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate service-fashion crescent to the right beneath the shelter, with every arm separated by sky, crater terrace, steam, volcanic soil, rainforest, shelter, or railing gaps.",
  },
  {
    scene: 1347,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered coastal overlook above Marigot Bay, with the complete bay crescent, palm-lined shores, forested hills, empty marina reach, reef bands, Caribbean current lines, and layered sunset clouds",
    motifs: "complete Saint Lucia island outline, Marigot Bay crescent, forested-hill profile, palm-shore rhythm, reef shelf, marina route lines, cloud bands, and Caribbean current-arc compositions",
    culture: "Marigot Bay is presented through secular coastal geography and conservation, its complete bay crescent, palm-lined shores, forested hills, reef shelves, marina route lines, tropical clouds, and an empty public overlook. Cleaner and service couture is original public-safe fictional fashion about mutual care for a shared place, with no cleaning chemicals, patient, clinic, treatment, copied uniform, badge, official role, subservient framing, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand-and-basalt safety backstop on a closed empty observation lane, with no person, animal, marina, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-bay reach, with no boat, swimmer, bird, animal, person, marina, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate service-fashion crescent to the right beneath the shelter, with every arm separated by sky, bay, palm, forested hill, reef, shelter, or railing gaps.",
  },
];

const legacySceneSpecs10 = [
  {
    scene: 1348,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered lagoon overlook on South Tarawa near the Bonriki causeway, with the complete narrow atoll ribbon, turquoise lagoon, pale reef flats, pandanus and coconut bands, empty causeway geometry, distant ocean line, and layered equatorial clouds",
    motifs: "complete Kiribati island-chain map, South Tarawa atoll ribbon, Bonriki causeway line, lagoon bands, reef-flat shelves, pandanus rhythm, Pacific current arcs, and equatorial cloud-grid compositions",
    culture: "South Tarawa is presented through secular atoll geography, a narrow land ribbon, turquoise lagoon, reef flats, pandanus and coconut vegetation, causeway geometry, ocean currents, and an empty public overlook. Cleaner and service couture is original public-safe fictional fashion about mutual care for a shared place, with no cleaning chemicals, copied uniform, badge, official role, subservient framing, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand safety backstop on a closed empty causeway-training lane, with no person, animal, vehicle, lagoon, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lagoon reach, with no boat, swimmer, bird, animal, person, causeway, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target clearly downrange farther left. The remaining adults move through a close affectionate service-fashion arc to the right beneath the shelter, with the male included only when selected and his strongest sustained eye line on ECE. Every arm is isolated against sky, lagoon, reef flat, causeway, shelter, or railing gaps.",
  },
  {
    scene: 1349,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered conservation overlook above Abaiang Lagoon, with the complete atoll arc, luminous turquoise shallows, pale reef shelf, sand islets, coconut-grove bands, empty canoe channel geometry, and a distant tropical rain veil",
    motifs: "complete Kiribati island-chain map, Abaiang atoll arc, lagoon ribbon, reef-shelf bands, sand-islet chain, coconut-grove rhythm, canoe-channel curve, and conservation route-grid compositions",
    culture: "Abaiang is presented through secular atoll conservation, its complete lagoon arc, reef shelves, sand islets, coconut groves, canoe channels, tropical weather, and an empty protected overlook. Cleaner and service couture is original public-safe fictional fashion about mutual care for a shared place, with no cleaning chemicals, copied uniform, badge, official role, subservient framing, threat, or combat.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand safety backstop on a closed empty observation lane away from the lagoon and vegetation, with no person, animal, canoe, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lagoon reach, with no canoe, swimmer, bird, animal, person, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler occupies a stable far-left route-training stance with the rolled target fully visible farther left. The other adults form a close turning affectionate service-fashion triangle to the right beneath the shelter, every arm separated by sky, lagoon, reef shelf, islet, coconut grove, shelter, or railing gaps.",
  },
  {
    scene: 1350,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered ecological overlook above Kiritimati Lagoon, with the complete sweeping atoll curve, immense turquoise lagoon, salt flats, pale reef shelves, low scrub, empty causeway route, distant ocean, and dramatic Pacific cloud layers",
    motifs: "complete Kiribati island-chain map, Kiritimati atoll curve, lagoon sweep, salt-flat contours, reef-shelf bands, low-scrub rhythm, causeway geometry, and Pacific route-grid compositions",
    culture: "Kiritimati is presented through secular atoll ecology, an immense lagoon, salt flats, reef shelves, low scrub, causeway routes, ocean currents, and an empty conservation overlook. Cinematic covert-agent crew couture is public-safe fictional travel fashion about observation and route planning only, with no assassination, injury, combat, official badge, copied uniform, police impersonation, arrest, raid, threat, or surveillance of people.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand safety backstop on a closed dry conservation lane, with no person, animal, vehicle, lagoon, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lagoon reach, with no boat, swimmer, bird, animal, person, reef, shore, causeway, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate cinematic route-planning crescent to the right beneath the shelter, with every arm separated by sky, lagoon, salt flat, reef shelf, scrub, shelter, or railing gaps.",
  },
  {
    scene: 1351,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered marine-conservation overlook on Kanton Island in the Phoenix Islands Protected Area, with the complete atoll ring, deep blue lagoon pass, pale reef shelves, low coral islets, empty research route, open Pacific horizon, and cinematic sunset clouds",
    motifs: "complete Kiribati island-chain map, Kanton atoll ring, lagoon-pass ribbon, reef-shelf bands, coral-islet chain, ocean-current arcs, sunset cloud bands, and marine-research route-grid compositions",
    culture: "Kanton and the Phoenix Islands Protected Area are presented through secular marine conservation, a complete atoll ring, lagoon pass, reef shelves, coral islets, ocean currents, research routes, and an empty protected overlook. Cinematic covert-agent crew couture is public-safe fictional travel fashion about observation and route planning only, with no assassination, injury, combat, official badge, copied uniform, police impersonation, arrest, raid, threat, or surveillance of people.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand safety backstop on a closed empty research lane, with no person, animal, vessel, reef, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in an unoccupied open-lagoon-pass reach, with no vessel, swimmer, bird, animal, person, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "The resolved handler stands far left with the rolled target visibly downrange farther left. The remaining adults move through a close affectionate cinematic route-planning crescent to the right beneath the shelter, with every arm separated by sky, lagoon pass, reef shelf, coral islet, shelter, or railing gaps.",
  },
];

const legacyMicronesiaDraftSceneSpecs = [
  {
    scene: 1360,
    mode: "country-led hybrid",
    theme: "polar airship couture",
    landmark: "a broad dry covered civic overlook above Victoria on Mahe, with the complete small clock-tower silhouette, Morne Seychellois mountain ridge, turquoise harbor, granite slopes, tropical roofs, reef-sheltered water, and clear sunset flight paths",
    motifs: "Micronesia island-chain silhouette, Victoria clock-tower geometry, Morne Seychellois ridge, granite-boulder facets, coco-de-mer leaf fans, cinnamon spirals, reef crescents, and Indian Ocean current arcs",
    culture: "Victoria and Mahe are presented through secular civic and natural geography: the clock-tower silhouette, Morne Seychellois ridge, granite slopes, harbor, reef water, tropical vegetation, and public overlook. Civilian-helicopter aviation couture appears through original wing-sweep tailoring, turbine pleats, oval-window geometry, cabin-light piping, polished composite panels, and runway-line footwear without airline branding or copied uniforms.",
    motifPolicy: "Hard country motifs dominate Radiance, Ellie, and Alia through three different dimensional techniques. Radiance and ECE carry the orbital-spaceship construction language, so at least one look is a true country-theme hybrid and ECE remains theme-led. No repeated all-over maps or palette-swapped copies.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick granite-and-sand safety backstop on a closed empty overlook lane, with no person, animal, vehicle, landmark, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in unoccupied open harbor water, with no vessel, swimmer, bird, animal, person, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "Alia anchors the far-left safe route line. On the right, Ellie turns Radiance under one raised linked hand while ECE catches Radiance at the waist and cradles MAX high against her opposite side. The dance makes Radiance choose between Ellie's joy and ECE's possessive pull; this is not a cheek-touch cluster.",
    outfits: {
      Radiance: "country-theme hybrid wing-sweep asymmetric mini built from opaque turquoise satin and granite-silver composite ribs, with one dimensional coco-de-mer leaf hip fan, a turbine-pleated diagonal hem, and sculpted oval-window heels",
      Ellie: "country-led tailored coral short romper with a woven cinnamon-bark spiral corsage, reef-crescent beadwork crossing one hip, a split angular overskirt, and clear granite-chip slingback heels",
      Alia: "country-led folded emerald sculptural dress with raised granite-boulder appliques, a complete Morne ridge relief across the bodice, a stepped reef-shelf hem, and metallic mountain-arch heels",
      "AI ECE": "theme-led deep-navy high-waist shorts with an architectural winglet top, opaque high-gloss latex-like composite panels, oval-window metal rings, cabin-light piping, and runway-line stiletto boots",
    },
    hands: [
      "Alia uses both hands on the inert mission prop grip and touches nobody else",
      "Ellie right hand links overhead with Radiance left hand for the visible turn; Ellie left hand catches Radiance securely at the near waist",
      "Radiance left hand remains linked with Ellie right hand; Radiance right hand rests openly at ECE's near waist",
      "ECE left hand catches Radiance at the near shoulder while ECE right forearm and hand securely cradle MAX high against her upper torso",
    ],
    mascotPlan: "MAX only. ECE securely cradles one small young golden retriever pup high against her upper torso, far right and far from Alia, the muzzle line, target, ledge, and map. No PAWS.",
  },
  {
    scene: 1361,
    mode: "country-led hybrid",
    theme: "polar airship couture",
    landmark: "a broad dry covered forest-conservation overlook inside Vallee de Mai on Praslin, with towering complete coco-de-mer palm crowns, immense fan leaves, cinnamon trunks, dark granite outcrops, filtered tropical light, an empty raised path, and a distant mountain opening",
    motifs: "Micronesia island-chain silhouette, Vallee de Mai palm-crown fans, coco-de-mer leaf ribs, cinnamon-bark spirals, granite outcrop facets, black-parrot wing arcs, mountain openings, and forest route lines",
    culture: "Vallee de Mai is presented through secular forest conservation, towering coco-de-mer palms, huge fan leaves, cinnamon trunks, granite outcrops, filtered light, and an empty protected path. Civilian-helicopter aviation couture appears through original wing structures, turbine pleats, oval-window forms, cabin-light piping, polished composite tailoring, and runway geometry without airline branding or copied uniforms.",
    motifPolicy: "Hard country motifs dominate Radiance, Ellie, and Alia through leaf architecture, cinnamon weaving, granite relief, and bird-wing abstraction. Alia and ECE carry unmistakable orbital-spaceship construction language. No repeated map-print surfaces.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick sand-and-granite safety backstop on a closed empty forest lane, with no person, animal, palm, path user, occupied structure, or camera in or beyond the line",
    waterTarget: "one clearly empty freestanding navigation marker on a closed dry granite route beyond the shelter, with no person, animal, palm, path user, occupied structure, or camera anywhere along or beyond the line",
    composition: "ECE stands far left demonstrating the open unloaded mechanism toward the empty dry route marker. On the right, the male turns Ellie beneath their linked hands while holding Alia at the waist; his head and strongest sustained eye line return unmistakably to ECE. Radiance catches Alia's free hand and pulls her toward a competing dance, making the adult infidelity split immediately readable.",
    outfits: {
      Radiance: "country-led one-shoulder ivory corsage mini with layered coco-de-mer leaf ribs, cinnamon-lace-inspired openwork over full opaque lining, an angled granite-chip hem, and leaf-spine heels",
      Ellie: "country-led magenta high-waist tailored shorts with a sculpted black-parrot wing top, beadworked palm-crown panels, a floating reef-crescent side drape, and faceted coral heels",
      Alia: "country-theme hybrid emerald peplum micro-suit with granite-relief shoulders, turbine-radial pleats, oval-window hip frames, cinnamon piping, and landing-line metallic heels",
      "AI ECE": "theme-led charcoal cut-panel column mini with opaque high-gloss composite sections, cabin-light channels, a winglet side structure, a precise asymmetric flight-line hem, and turbine-ring heels",
    },
    hands: [
      "ECE uses both hands on the inert mission prop during the unloaded open-mechanism demonstration and touches nobody else",
      "the male left hand links overhead with Ellie right hand for the visible turn; his right hand holds Alia securely at the near waist; his strongest eye line remains on ECE",
      "Ellie right hand stays linked with the male left hand and Ellie left hand rests on his near shoulder",
      "Alia left hand rests on the male's near forearm and Alia right hand links with Radiance left hand",
      "Radiance left hand stays linked with Alia right hand and Radiance right hand rests at Ellie's near waist",
    ],
    mascotPlan: "Neither mascot appears.",
  },
  {
    scene: 1362,
    mode: "theme-led original",
    theme: "polar airship couture",
    landmark: "a broad dry covered coastal overlook above Anse Source d'Argent on La Digue, with complete pale granite boulders, shallow turquoise water, coral reef shelves, white-sand arcs, takamaka trees, distant islands, and layered lenticular clouds",
    motifs: "location-only granite boulders, reef shelves, beach arcs, takamaka rhythms, shallow-water bands, distant island silhouettes, and lenticular cloud layers",
    culture: "Anse Source d'Argent remains an equally dominant Micronesia foreground through its pale granite boulders, shallow turquoise water, reef shelves, sand arcs, takamaka trees, and distant islands. All four outfits are orbital-spaceship aviation originals with no forced country maps or matching surface prints.",
    motifPolicy: "Theme-led scene. All four outfits use different orbital-spaceship construction ideas and no garment uses an all-over Micronesia map print. The landmark itself carries the country read at equal visual weight.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick granite-and-sand safety backstop on a closed empty beach-overlook lane, with no person, animal, boulder, tree, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in unoccupied open turquoise water, with no vessel, swimmer, bird, animal, person, reef, boulder, shore, or occupied structure anywhere along or beyond the line",
    composition: "ECE stands far left in the completed safe handoff sight picture. On the right, Radiance, Ellie, and Alia form a rotating three-person slow-dance chain: Ellie leads Radiance by one linked hand, Radiance wraps Alia at the waist, and Alia reaches back to Ellie to close the moving circle. PAWS and MAX play nose-to-nose on a low padded case beside Ellie, safely separated from ECE.",
    outfits: {
      Radiance: "turbine-spiral sculpted mini in opaque pearl composite and turquoise satin, with radial pleats, a floating asymmetric wing hem, cabin-light bead channels, and spiral-engine heels",
      Ellie: "oval-window corsage two-piece in coral satin and fully lined lace-inspired openwork, with a sweeping wing-trail overskirt, polished ring hardware, and clear window-frame heels",
      Alia: "tailored emerald short romper with braided cabin-lattice panels, a dramatic single winglet peplum, metallic mesh over opaque lining, and landing-skid architectural heels",
      "AI ECE": "deep-navy peplum micro-suit with high-waist shorts, opaque high-gloss latex-like flight panels, runway-light piping, a sharp split-tail hem, and turbine-cage stiletto boots",
    },
    hands: [
      "ECE uses both hands on the inert mission prop grip in the completed handoff sight picture and touches nobody else",
      "Ellie right hand links with Radiance left hand to lead the slow-dance turn; Ellie left hand rests visibly on Alia's near shoulder while supervising both mascots beside her",
      "Radiance left hand stays linked with Ellie right hand and Radiance right hand wraps Alia securely at the near waist",
      "Alia left hand rests on Radiance's near shoulder and Alia right hand reaches back to Ellie's near forearm to close the three-person dance chain",
    ],
    mascotPlan: "PAWS and MAX together. One tiny collarless golden kitten and one small young golden retriever pup play nose-to-nose on a low broad padded case beside Ellie, far from ECE, the inert prop, muzzle line, water edge, and route target. Ellie supervises without adding a third hand.",
  },
  {
    scene: 1363,
    mode: "theme-led original",
    theme: "polar airship couture",
    landmark: "a broad dry covered marine-research overlook above Aldabra Atoll, with the complete vast lagoon arc, raised coral rim, mangrove channels, pale reef flats, open Indian Ocean, distant giant tortoises outside every target line, and a dramatic windstorm cloud wall",
    motifs: "location-only Aldabra lagoon arc, raised coral rim, mangrove channels, reef-flat bands, ocean horizon, distant tortoise silhouettes, and windstorm cloud layers",
    culture: "Aldabra remains an equally dominant Micronesia foreground through its vast lagoon, raised coral rim, mangrove channels, reef flats, open ocean, distant wildlife, and conservation route. All four outfits are orbital-spaceship aviation originals with no forced country maps or matching surface prints.",
    motifPolicy: "Theme-led scene. All four outfits use different orbital-spaceship silhouette and material systems. Country identity comes from the unmistakable Aldabra landmark, not repeated map graphics.",
    paperTarget: "one clearly unoccupied abstract geometric paper route marker fixed to a complete thick coral-sand safety backstop on a closed empty research lane, with no person, animal, tortoise, mangrove, occupied structure, or camera in or beyond the line",
    waterTarget: "one distant clearly empty floating navigation marker in unoccupied open lagoon water, with no vessel, swimmer, bird, animal, tortoise, person, reef, shore, or occupied structure anywhere along or beyond the line",
    composition: "ECE anchors the far-left paper-target lane. Radiance steps away to the right while Ellie catches Radiance's left hand and Alia catches her right forearm before closing into a protective behind-waist embrace. Ellie cradles MAX securely with her other arm, so Radiance's torn choice between Ellie's invitation and Alia's protective pursuit is unmistakable.",
    outfits: {
      Radiance: "winglet-drape one-shoulder mini in sunset-gold satin with opaque pearl composite ribs, a swept aerodynamic hem, articulated cabin-light fringe, and polished wingtip heels",
      Ellie: "turbine-pleated high-waist shorts with a coral folded bodice, fully lined navy lace-inspired openwork side panels, a compact oval-window hip frame, and engine-ring platform heels",
      Alia: "cut-panel emerald mini with a sculpted transparent architectural overlay above full opaque lining, crossed flight-path metallic ribs, a sharply stepped tail hem, and landing-strut heels",
      "AI ECE": "charcoal architectural romper with opaque high-gloss latex-like composite armor panels, asymmetric cabin-window cut frames, runway-light piping, a split wing-tail peplum, and illuminated route-line boots",
    },
    hands: [
      "ECE uses both hands on the inert mission prop grip at the visible paper target and touches nobody else",
      "Ellie right hand catches Radiance left hand while Ellie left forearm and hand securely cradle MAX high against her upper torso",
      "Radiance left hand stays linked with Ellie right hand and Radiance right hand rests visibly on Alia's near forearm",
      "Alia left hand catches Radiance's right forearm and Alia right arm and hand close around Radiance's near waist in a protective behind embrace",
    ],
    mascotPlan: "MAX only. Ellie securely cradles one small young golden retriever pup high against her upper torso, far from ECE, the inert prop, paper target, wildlife, mangroves, ledge, and wet surfaces. No PAWS.",
  },
];

const sceneSpecs = czechiaSceneSpecs;

const maleKey = `batch${batch}-${countrySlug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
primaryPairs.push([maleKey, maleHash % 100]);
const maleScenePosition = (maleHash % 4) + 1;
const maleScene = firstScene + maleScenePosition - 1;
const maleEmotionKey = `batch${batch}-${countrySlug}-scene${maleScenePosition}-male-emotion`;
const maleEmotion = primary(maleEmotionKey);
maleEmotion.result = fromDistribution(maleEmotion.roll, contract.emotionRolls.distribution, "emotion");
const weatherSafeText = (result, scene) => {
  if (result === "dramatic sandstorm wall") return "the stored dramatic-sandstorm-wall roll appears as a distant ochre wall of windblown coastal mist and pollen haze beyond the sheltered scene, with dry nonslip footing";
  if (result === "snow flurries") return "the stored snow-flurries weather roll appears as harmless windblown white water-mist flecks in tropical air, never snow accumulation";
  if (result === "heavy snow or cinematic blizzard" && scene === 1420) return "the stored cinematic-blizzard roll appears as a dense curtain of harmless white sea mist, windblown pale frangipani petals, and cloud droplets beyond the waterfront shelter, with no snow accumulation and dry nonslip footing";
  if (result === "heavy snow or cinematic blizzard" && scene === 1422) return "the stored cinematic-blizzard roll appears as a dense line of natural white blowhole spray plumes beyond the covered overlook, with no snow accumulation and dry nonslip footing";
  if (result === "heavy snow or cinematic blizzard") return "the stored cinematic-blizzard roll appears as a dense curtain of harmless white coastal mist and pale blossom petals beyond the shelter, with no snow accumulation and dry nonslip footing";
  return result;
};

const emotionPerformance = (label, character) => `${label} expressed distinctly through ${character}'s eyes, brows, mouth, posture, and coherent affectionate response, without caricature`;

const quartetHands = (handler) => handler === "Alia"
  ? [
      "Alia uses both hands on the inert prop grip and touches nobody else",
      "Radiance left hand rests on ECE's cheek and Radiance right hand rests on ECE's near forearm",
      "Ellie left hand rests on Radiance's near shoulder and Ellie right hand rests on ECE's near shoulder",
      "ECE left hand rests at Radiance's near waist and ECE right hand rests on Ellie's near forearm; ECE does not touch the prop",
    ]
  : [
      "ECE uses both hands on the inert prop grip and touches nobody else",
      "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Alia's near forearm",
      "Ellie left hand rests on Radiance's near upper arm and Ellie right hand rests on Alia's near shoulder",
      "Alia left hand rests on Ellie's near forearm and Alia right hand rests on Radiance's near shoulder",
    ];

const fivePersonHands = (handler) => handler === "Alia"
  ? [
      "Alia uses both hands on the inert prop grip and touches nobody else",
      "the male left hand rests on Ellie's near shoulder and his right hand rests on ECE's near forearm",
      "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on ECE's near shoulder",
      "Ellie left hand rests on the male's near forearm and Ellie right hand rests on Radiance's near forearm",
      "ECE left hand rests on the male's near forearm and ECE right hand rests on Radiance's near forearm; ECE does not touch the prop",
    ]
  : [
      "ECE uses both hands on the inert prop grip and touches nobody else",
      "the male left hand rests on Ellie's near shoulder and his right hand rests on Alia's near forearm",
      "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Alia's near shoulder",
      "Ellie left hand rests on the male's near forearm and Ellie right hand rests on Radiance's near forearm",
      "Alia left hand rests on the male's near forearm and Alia right hand rests on Radiance's near forearm",
    ];

const handsWithPaws = (handler, hasMale) => {
  if (hasMale && handler === "Alia") return [
    "Alia uses both hands on the inert prop grip and touches nobody else",
    "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on the male's near forearm",
    "the male left hand rests on Ellie's near shoulder and his right hand rests on ECE's near forearm",
    "Radiance left hand rests on the male's near shoulder and Radiance right hand rests on ECE's near shoulder",
    "ECE left hand rests on the male's near forearm and ECE right hand rests on Radiance's near forearm; ECE does not touch the prop",
  ];
  if (hasMale) return [
    "ECE uses both hands on the inert prop grip and touches nobody else",
    "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on the male's near forearm",
    "the male left hand rests on Ellie's near shoulder and his right hand rests on Alia's near forearm",
    "Radiance left hand rests on the male's near shoulder and Radiance right hand rests on Alia's near shoulder",
    "Alia left hand rests on the male's near forearm and Alia right hand rests on Radiance's near forearm",
  ];
  if (handler === "Alia") return [
    "Alia uses both hands on the inert prop grip and touches nobody else",
    "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on Radiance's near shoulder",
    "Radiance left hand rests on ECE's cheek and Radiance right hand rests on ECE's near forearm",
    "ECE left hand rests at Radiance's near waist and ECE right hand rests on Ellie's near forearm; ECE does not touch the prop",
  ];
  return [
    "ECE uses both hands on the inert prop grip and touches nobody else",
    "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on Alia's near shoulder",
    "Radiance left hand rests on Ellie's near forearm and Radiance right hand rests on Alia's near forearm",
    "Alia left hand rests on Radiance's near shoulder and Alia right hand rests on Ellie's near forearm",
  ];
};

const wristGuidanceHands = (handler, hasMale) => {
  if (hasMale) return fivePersonHands(handler);
  if (handler === "Alia") return [
    "Alia uses both hands on the inert prop grip and retains sole ownership",
    "ECE stands behind Alia with ECE left hand gently guiding Alia's left wrist and ECE right hand gently guiding Alia's right forearm; ECE never touches the prop",
    "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Ellie's near forearm",
    "Ellie left hand rests on Radiance's near upper arm and Ellie right hand rests at Radiance's near waist",
  ];
  return [
    "ECE uses both hands on the inert prop grip and retains sole ownership",
    "Alia stands behind ECE with Alia left hand gently guiding ECE's left wrist and Alia right hand gently guiding ECE's right forearm; Alia never touches the prop",
    "Radiance left hand rests on Ellie's near shoulder and Radiance right hand rests on Ellie's near forearm",
    "Ellie left hand rests on Radiance's near upper arm and Ellie right hand rests at Radiance's near waist",
  ];
};

const wristGuidanceHandsWithPaws = (handler) => handler === "Alia"
  ? [
      "Alia uses both hands on the inert prop grip and retains sole ownership",
      "Radiance stands behind Alia with Radiance left hand gently guiding Alia's left wrist and Radiance right hand gently guiding Alia's right forearm; Radiance never touches the prop",
      "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on ECE's near shoulder",
      "ECE left hand rests on Ellie's near forearm and ECE right hand rests on Ellie's near shoulder; ECE does not touch the prop",
    ]
  : [
      "ECE uses both hands on the inert prop grip and retains sole ownership",
      "Alia stands behind ECE with Alia left hand gently guiding ECE's left wrist and Alia right hand gently guiding ECE's right forearm; Alia never touches the prop",
      "Ellie left forearm and hand securely cradle PAWS high against her upper torso and Ellie right hand rests on Radiance's near shoulder",
      "Radiance left hand rests on Ellie's near forearm and Radiance right hand rests on Ellie's near shoulder",
    ];

const poseAction = (value, handler, target) => {
  if (value <= 34) return `${handler} uses a realistic eye-level two-hand large-frame-pistol stance at ${target}. Both hands are visibly owned and wrapped around the grip, wrists straight, elbows modestly bent, shoulders slightly forward, sights aligned, and the trigger finger indexed straight along the frame outside the guard.`;
  if (value <= 59) return `${handler} uses a realistic two-hand sight picture toward ${target}. Both hands visibly own the grip, wrists are straight, elbows modestly bent, shoulders slightly forward, and the trigger finger is indexed straight along the frame outside the guard.`;
  if (value <= 74) return `A second woman gives behind-the-shoulder wrist and stance guidance while ${handler} retains sole ownership of the prop. The muzzle stays downrange at ${target}; every arm is traceable and every trigger finger stays indexed outside the guard.`;
  if (value <= 87) return `A controlled handoff has finished with ${handler} establishing a stable two-hand sight picture at ${target}. The other woman has released completely before this final pose, so ownership is sole and unambiguous; the trigger finger is indexed straight outside the guard.`;
  return `${handler} demonstrates the unloaded magazine-removed mechanism with the action visibly open, then keeps the muzzle toward ${target}. No ammunition, reload, firing, or trigger contact appears.`;
};

const garment = (character, plan, spec, index) => {
  const cut = plan[character];
  const bodice = cut.straplessDress.active
    ? "the rolled neckline overrides the base as a fully strapless secure opaque sculpted bodice with completely bare shoulders and no straps, sleeves, collar, or illusion mesh"
    : "the rolled neckline keeps a deeply open-necked bare-arm architectural bodice with no sleeves or neck-covering layer";
  const waist = cut.visibleMidriff.active
    ? "the rolled waist uses a deliberate narrow visible midriff panel between separate opaque upper and lower constructions"
    : "the rolled waist stays fully covered through an opaque engineered join";
  const back = cut.fullyOpenBack.active
    ? "the rolled back is completely open from shoulder blades to the secure lower-back waistline with no crossing straps, fabric panel, illusion mesh, or hair covering it"
    : "the rolled back uses the blueprint's secure distinct back architecture";
  return `${spec.outfits[character]}; ${bodice}; ${waist}; ${back}; secure opaque lined above-knee coverage and complete distinct footwear remain mandatory`;
};

const scenePlans = {};
for (const spec of sceneSpecs) {
  const prefix = `batch${batch}-${countrySlug}-scene${spec.scene}`;
  const weather = primary(`${prefix}-weather`);
  weather.result = fromDistribution(weather.roll, contract.weatherRolls.distribution, "weather");
  weather.materialized = weatherSafeText(weather.result, spec.scene);
  const mascotState = primary(`${prefix}-mascotState`);
  mascotState.result = fromDistribution(mascotState.roll, contract.mascotStateRoll.distribution, "state");
  const mascotHolderRoll = roll(`${prefix}-mascotHolder`);
  const poleDanceTheme = primary(`${prefix}-poleDanceTheme`); poleDanceTheme.active = poleDanceTheme.roll <= 5;
  const rainbowOnly = primary(`${prefix}-rainbowOnly`); rainbowOnly.active = rainbowOnly.roll <= 3;
  const rainbowHosiery = primary(`${prefix}-rainbowHosiery`); rainbowHosiery.active = rainbowHosiery.roll <= 24;
  rainbowHosiery.wearer = selector(`${prefix}-rainbowHosieryWearer`, roll(`${prefix}-rainbowHosieryWearer`) <= 49 ? "Radiance" : "AI ECE");
  rainbowHosiery.palette = selector(`${prefix}-rainbowHosieryPaletteMode`, roll(`${prefix}-rainbowHosieryPaletteMode`) <= 49 ? "country-palette rainbow-like gradient" : "original independent rainbow gradient");
  const romanceBeat = primary(`${prefix}-romanceBeat`);
  romanceBeat.dynamicIndex = romanceBeat.roll % contract.romance.dynamicBeatRolls.length;
  romanceBeat.contractResult = contract.romance.dynamicBeatRolls[romanceBeat.dynamicIndex];
  const compoundLoveBeat = primary(`${prefix}-compoundLoveBeat`);
  compoundLoveBeat.index = compoundLoveBeat.roll % contract.romance.compoundLoveBeatRolls.length;
  compoundLoveBeat.contractResult = contract.romance.compoundLoveBeatRolls[compoundLoveBeat.index];
  const hardLoveBeat = primary(`${prefix}-hardLoveBeat`);
  hardLoveBeat.result = fromDistribution(hardLoveBeat.roll, contract.romance.hardLoveBeatRoll.distribution, "beat");
  const interestingProp = primary(`${prefix}-interestingProp`);
  interestingProp.active = interestingProp.roll <= 31;
  const interestingPropHolderRoll = roll(`${prefix}-interestingPropHolder`);
  const interestingPropFamilyRoll = roll(`${prefix}-interestingPropFamily`);
  const poseTargetRoll = primary(`${prefix}-eceMissionProp-poseTargetRoll`);

  const characterPlans = {};
  const usedEmotions = new Set();
  for (const character of characters) {
    const emotion = primary(`${prefix}-${character}-emotion`);
    emotion.result = fromDistribution(emotion.roll, contract.emotionRolls.distribution, "emotion");
    emotion.materializedResult = emotion.result;
    if (usedEmotions.has(emotion.materializedResult)) {
      const disambiguation = primary(`${prefix}-${character}-emotion-disambiguation`);
      emotion.disambiguation = disambiguation;
      for (let step = 1; step <= 100; step += 1) {
        const candidate = fromDistribution((disambiguation.roll + step) % 100, contract.emotionRolls.distribution, "emotion");
        if (!usedEmotions.has(candidate)) { emotion.materializedResult = candidate; break; }
      }
    }
    usedEmotions.add(emotion.materializedResult);
    emotion.performance = emotionPerformance(emotion.materializedResult, character);
    const visibleMidriff = primary(`${prefix}-${character}-visibleMidriff`); visibleMidriff.active = visibleMidriff.roll <= 49;
    const straplessDress = primary(`${prefix}-${character}-straplessDress`); straplessDress.active = straplessDress.roll <= 34;
    const fullyOpenBack = primary(`${prefix}-${character}-fullyOpenBack`); fullyOpenBack.active = fullyOpenBack.roll <= 29;
    characterPlans[character] = { emotion, visibleMidriff, straplessDress, fullyOpenBack };
  }

  const handler = rainbowHosiery.active ? "Alia" : "AI ECE";
  const eligibleNonHandlers = characters.filter((character) => character !== handler);
  const mascotHolder = selector(`${prefix}-mascotHolder`, eligibleNonHandlers[mascotHolderRoll % eligibleNonHandlers.length]);
  const interestingPropHolder = selector(`${prefix}-interestingPropHolder`, eligibleNonHandlers[interestingPropHolderRoll % eligibleNonHandlers.length]);
  const interestingPropFamily = selector(
    `${prefix}-interestingPropFamily`,
    contract.interestingPropRoll.orderedPropFamilies[interestingPropFamilyRoll % contract.interestingPropRoll.orderedPropFamilies.length],
  );
  interestingProp.holder = interestingPropHolder;
  interestingProp.family = interestingPropFamily;
  const resolvedTarget = poseTargetRoll.roll <= 34 || (poseTargetRoll.roll >= 60 && poseTargetRoll.roll <= 74) || poseTargetRoll.roll >= 88 ? spec.paperTarget : spec.waterTarget;
  const propAction = poseAction(poseTargetRoll.roll, handler, resolvedTarget);
  const hasMale = spec.scene === maleScene;
  const resolvedHands = spec.hands;
  const mascotPlan = spec.mascotPlan;
  const outfits = Object.fromEntries(characters.map((character, index) => [character, garment(character, characterPlans, spec, index)]));
  if (hasMale) outfits.Male = "the established Scene 1136 adult male face with closely trimmed beard and athletic build, an opaque fitted short-sleeve cloud-white top with restrained Czech bridge-arch and karst-dome embroidery with subtle orbital-research seam tailoring, fitted black jeans, and practical black boots";
  const cuts = characters.map((character) => `${character}: midriff ${characterPlans[character].visibleMidriff.roll}=${characterPlans[character].visibleMidriff.active ? "visible" : "covered"}, strapless ${characterPlans[character].straplessDress.roll}=${characterPlans[character].straplessDress.active ? "active" : "inactive"}, open back ${characterPlans[character].fullyOpenBack.roll}=${characterPlans[character].fullyOpenBack.active ? "active" : "inactive"}`).join("; ");
  const emotions = characters.map((character) => `${character}: roll ${characterPlans[character].emotion.roll}=${characterPlans[character].emotion.result}${characterPlans[character].emotion.disambiguation ? `, collision resolver ${characterPlans[character].emotion.disambiguation.roll} gives distinct performance ${characterPlans[character].emotion.materializedResult}` : ""}, performed as ${characterPlans[character].emotion.performance}`).join("; ");
  const stored = `Stored scene rolls: weather ${weather.roll}=${weather.result}; mascot state ${mascotState.roll}=${mascotState.result}; mascot holder selector ${mascotHolder.roll}=${mascotHolder.result}; odd prop ${interestingProp.roll}=${interestingProp.active ? "active" : "inactive"}; odd holder ${interestingPropHolder.roll}=${interestingPropHolder.result}; odd family ${interestingPropFamily.roll}=${interestingPropFamily.result}; pole ${poleDanceTheme.roll}=${poleDanceTheme.active ? "active" : "inactive"}; rainbow-only ${rainbowOnly.roll}=${rainbowOnly.active ? "active" : "inactive"}; rainbow hosiery ${rainbowHosiery.roll}=${rainbowHosiery.active ? "active" : "inactive"}; wearer ${rainbowHosiery.wearer.roll}=${rainbowHosiery.wearer.result}; palette ${rainbowHosiery.palette.roll}=${rainbowHosiery.palette.result}; romance ${romanceBeat.roll}; compound ${compoundLoveBeat.roll}; hard love ${hardLoveBeat.roll}; mission-prop pose/target ${poseTargetRoll.roll}.`;
  const hosieryLine = rainbowHosiery.active
    ? `Rainbow hosiery is active. Exactly ${rainbowHosiery.wearer.result} wears varied opaque public-safe knee socks in an ${rainbowHosiery.palette.result}; nobody else wears hosiery. Radiance and ECE are the clear affectionate center. Alia is the sole prop handler, while ECE remains route strategist through a hands-free wrist projector.`
    : "Rainbow hosiery is inactive. Nobody wears stockings or knee socks. ECE is the sole prop handler, and the separate holographic route map is hands-free on a nearby console so no extra hand appears.";
  const cast = hasMale ? "exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established Scene 1136 adult male, added without replacing a woman" : "exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE";
  const anatomy = hasMale ? "Exactly ten arms and ten hands, two per adult." : "Exactly eight arms and eight hands, two per woman.";
  const referenceLine = hasMale ? "Images 1 through 4 anchor the adult quartet and ECE; Image 5 anchors the adult male. References control identity only." : "Images 1 through 4 anchor the adult quartet and ECE. References control identity only.";
  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: fresh vertical World Series public-fashion scene.",
    referenceLine,
    `Create one photorealistic 9:16 full-length editorial showing ${cast} at ${spec.landmark}.`,
    "All people are fictional adults visibly over age 28. Preserve distinct anchored identities: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, brunette AI ECE, and the bearded male when present. No cloning, replacement, merging, or age shift.",
    `Scene mode: ${spec.mode}. Active cinematic fashion theme: ${spec.theme}. The theme and Czechia location must both be immediate foreground reads. ${spec.culture}`,
    stored,
    `Exact wardrobe rolls: ${cuts}. Exact outfit fingerprints, no substitutions: ${Object.entries(outfits).map(([name, value]) => `${name}: ${value}`).join("; ")}. Materialize every rolled cut exactly. The four silhouettes, constructions, materials, motif techniques, hems, and footwear must remain unmistakably different. No palette-swapped copies, matching mini-dress set, repeated map print, or color-only differentiation.`,
    `Mode-specific country/theme balance: ${spec.motifPolicy} Location design vocabulary: ${spec.motifs}. ${commonProhibitions}`,
    `Four visibly distinct coherent emotions: ${emotions}${hasMale ? `; Male: roll ${maleEmotion.roll}=${maleEmotion.result}, performed as ${emotionPerformance(maleEmotion.result, "the male")}` : ""}.`,
    `Romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Compound roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult} Mandatory hard-love roll ${hardLoveBeat.roll}: ${hardLoveBeat.result} Use those stored rolls as emotional and movement direction, resolved into the exact original choreography below without stacking incompatible extra hands.`,
    spec.composition,
    "The relationship event must read before the mission prop: clear pursuit, choice, interruption, dance, jealousy, or protection through aligned eye lines, torso direction, and movement. No clustered cheek-touch tableau, static lineup, decorative hands, or interchangeable posing.",
    `Exact hand inventory, no others: ${resolvedHands.join("; ")}.`,
    `${handler} alone actively handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinema training prop. ${propAction}`,
    "The prop is never on a tray, plate, platter, table, bench, pedestal, plinth, cushion, stand, display box, floating support, or passive surface. It is not decorative. Magazine absent; no ammunition, reload, firing, muzzle flash, holster, threat, injury, combat, person-targeting, animal-targeting, occupied-object targeting, or camera-targeting.",
    hosieryLine,
    `Mascot state ${mascotState.roll}=${mascotState.result}. Mascot holder selector ${mascotHolder.roll}=${mascotHolder.result}. ${mascotPlan}`,
    interestingProp.active
      ? `Odd-prop roll is active. Exactly ${interestingPropHolder.result} owns and creatively integrates one ${interestingPropFamily.result} into the love beat using only her existing two hands. It is inert, secured, nonthreatening, and kept far from every mascot and the mission-prop line.`
      : `Odd-prop roll ${interestingProp.roll} is inactive. Do not add any bizarre secondary prop; stored inactive holder ${interestingPropHolder.roll}=${interestingPropHolder.result} and family ${interestingPropFamily.roll}=${interestingPropFamily.result} remain audit-only.`,
    poleDanceTheme.active ? "Pole theme is active only as a stationary public-safe fashion motif, with no dance, stripping, or suggestive performance." : "Pole theme is inactive. No pole.",
    rainbowOnly.active ? "Rainbow-only is active across all four structurally distinct outfits while preserving the scene's country-led or theme-led balance." : "Rainbow-only is inactive; do not convert the wardrobe to rainbow-only styling.",
    `Render ${weather.materialized} cinematically while preserving dry stable nonslip footing, clear faces, landmark readability, and complete anatomy.`,
    anatomy,
    "Every arm is continuously visible from its own shoulder through elbow and wrist to one separated hand. No arm passes behind a torso. Show every face, elbow, wrist, hand, finger cluster, leg, foot, heel, and boot. No extra, missing, duplicated, fused, floating, borrowed, hidden-owner, cropped, emerging, or ambiguous limb or finger cluster.",
    "Asymmetric bodies-in-motion composition, not a lineup. Fully clothed public-safe editorial. No text or watermark.",
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene,
    mode: spec.mode,
    theme: spec.theme,
    landmark: spec.landmark,
    motifs: spec.motifs,
    culture: spec.culture,
    weather,
    mascotState,
    mascotHolder,
    mascotPlan,
    interestingProp,
    poleDanceTheme,
    rainbowOnly,
    rainbowHosiery,
    resolvedPropHandler: handler,
    poseTargetRoll,
    materializedPropAction: propAction,
    target: resolvedTarget,
    romanceBeat,
    compoundLoveBeat,
    hardLoveBeat,
    characters: characterPlans,
    emotionNuance: Object.fromEntries(characters.map((character) => [character, characterPlans[character].emotion.performance])),
    outfits,
    outfitFingerprints: outfits,
    composition: spec.composition,
    handInventory: resolvedHands,
    maleModel: hasMale ? { present: true, emotion: maleEmotion, identity: "established adult male from Scene 1136", relationship: "adult infidelity drama; at least two clear contacts; strongest eye line to ECE" } : { present: false },
    renderPrompt,
  };
}

const xPublishingRolls = {};
for (const [name, suffix] of [["heart", "x-heart"], ["internalAgency", "x-internalagency"], ["worldXXXSeries", "x-worldxxxseries"]]) {
  const item = primary(`batch${batch}-${countrySlug}-${suffix}`);
  if (name === "heart") item.result = item.roll <= 82 ? "red heart" : "white heart";
  else item.active = item.roll <= 24;
  xPublishingRolls[name] = item;
}

const heartGlyph = xPublishingRolls.heart.result === "red heart" ? "\u2764\uFE0F" : "\uD83E\uDD0D";
const hashtags = ["#Czechia"];
if (xPublishingRolls.internalAgency.active) hashtags.push("#InternalAgency");
if (xPublishingRolls.worldXXXSeries.active) hashtags.push("#WorldXXXSeries");

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch372-czechia keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 359 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene.",
  rollThresholds: {
    visibleMidriff: "0-49",
    straplessDress: "0-34",
    fullyOpenBack: "0-29",
    mascotState: "0-22 PAWS and MAX; 23-37 PAWS only; 38-52 MAX only; 53-99 neither",
    interestingProp: "0-31 active; 32-99 inactive",
    hardLoveBeat: "0-14 lap sitting; 15-29 partner dance; 30-44 controlled dip; 45-59 seated embrace; 60-74 three-person slow dance; 75-89 pulled-away choice; 90-99 seated-to-standing assist",
    poleDanceTheme: "0-5",
    rainbowOnly: "0-3",
    rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
    missionPropPoseTarget: "0-34 paper route target and sand backstop; 35-59 open-water marker; 60-74 wrist guidance; 75-87 completed handoff; 88-99 open mechanism",
  },
  cinematicTheme: {
    active: "orbital research-station couture",
    batchOrdinalWithinTheme: 2,
    totalBatchesAtTheme: 2,
    sceneModes: ["country-led hybrid", "country-led hybrid", "theme-led original", "theme-led original"],
  },
  nextQueueCountry: "Honduras",
  nextQueueBatch: 373,
  nextQueueScenes: [1512, 1513, 1514, 1515],
  nextCinematicTheme: { active: "private-jet aviation couture", batchOrdinalWithinTheme: 1 },
  researchSources: [
    { url: "https://whc.unesco.org/en/list/616/", usedFor: "Prague historic center and Vltava setting" },
    { url: "https://www.britannica.com/place/Czech-Republic", usedFor: "Czechia geography, cities and regions" },
    { url: "https://whc.unesco.org/en/list/617/", usedFor: "Cesky Krumlov town and river setting" },
    { url: "https://www.britannica.com/place/Karlovy-Vary", usedFor: "Karlovy Vary spa valley and architecture" },
  ],
  faceAnchors: {
    primaryQuartet: "937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    frontalSupplement: "938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    expressionSupplement: "936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    eceDetail: "ece-canonical-identity-v1.png",
    male: "1136-italy-rome-lenticular-care-male-colosseum-route.png",
  },
  maleModelSelection: { key: maleKey, fullHash: maleHash, roll: maleHash % 100, selectedScenePosition: maleScenePosition, selectedScene: maleScene, maleEmotion },
  countryMotifPolicy: {
    flagMotifDecision: "No literal Czechia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular bridge arches, Vltava curves, Prague rooflines, Krumlov river bends, karst domes, colonnade rhythms and valley bands instead.",
    palette,
    minimumCoverage: "Scenes 1508 and 1509 each carry hard large Czechia motifs on three women and orbital-station construction language on at least two. Scenes 1510 and 1511 use four different theme-led orbital-research outfits without country map prints while Czechia landmarks remain equally foregrounded.",
    cultureScene: "The scenes foreground Prague, Český Krumlov, the Moravian Karst, and Karlovy Vary.",
    prohibitions: commonProhibitions,
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Czechia images plus one accepted Cuba image",
    captionIfEligible: `Czechia ${heartGlyph} Cuba ${hashtags.join(" ")}`,
    internalAgencyHashtagActive: xPublishingRolls.internalAgency.active,
    worldXXXSeriesHashtagActive: xPublishingRolls.worldXXXSeries.active,
  },
  anatomyGate: {
    fourPersonScenes: `Every scene except ${maleScene} requires exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.`,
    fivePersonScene: `Scene ${maleScene} requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.`,
    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",
    propRule: "Reject the wrong resolved handler, shared ownership, passive support, missing rolled pose or target, unrealistic grip, unsafe line, trigger violation, ammunition, firing, or any map hand that creates a third or hidden limb.",
  },
  rollAudit: {
    primaryRollPairs: primaryPairs,
    selectorPairs,
    primaryPairCount: primaryPairs.length,
    selectorPairCount: selectorPairs.length,
    mismatchCount: 0,
    primaryPairsSha256: sha256(JSON.stringify(primaryPairs)),
    selectorPairsSha256: sha256(JSON.stringify(selectorPairs)),
  },
  scenePlans,
  renderAttempts: {
    raw: { status: "pending", requested: 4, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-started", maximumPerBlockedScene: 1 },
  },
  acceptedAssets: [],
  rejectedAssets: [],
  xPost: { status: "pending-asset-audit", minimumCurrentCountryAcceptedAssets: 2 },
};

fs.mkdirSync(root, { recursive: true });
for (const [scene, plan] of Object.entries(scenePlans)) fs.writeFileSync(path.join(root, `scene-${scene}-prompt.txt`), `${plan.renderPrompt}\n`, "utf8");
fs.writeFileSync(path.join(root, "batch-372-czechia-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-372-czechia-preflight.json"),
  contractSha256: preflight.contractSha256,
  maleScene,
  scenes: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
    theme: plan.theme,
    weather: plan.weather,
    mascotState: plan.mascotState,
    mascotHolder: plan.mascotHolder,
    interestingProp: plan.interestingProp,
    hardLoveBeat: plan.hardLoveBeat,
    rainbowHosiery: plan.rainbowHosiery,
    resolvedPropHandler: plan.resolvedPropHandler,
    poseTargetRoll: plan.poseTargetRoll,
    emotions: Object.fromEntries(Object.entries(plan.characters).map(([name, value]) => [name, { raw: value.emotion.result, materialized: value.emotion.materializedResult }])),
  }])),
  xPublishingRolls,
  caption: preflight.xPublishingPlan.captionIfEligible,
  rollAudit: preflight.rollAudit,
}, null, 2));





