import fs from "node:fs";

const contract = JSON.parse(
  fs.readFileSync(
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json",
    "utf8",
  ),
);
const batch = 320;
const slug = "malta";
const firstScene = 1300;
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const roll = (key) => fnv1a(key) % 100;
const fromDistribution = (value, distribution, field) => {
  for (const entry of distribution) {
    const [startText, endText = startText] = entry.range.split("-");
    if (value >= Number(startText) && value <= Number(endText)) return entry[field];
  }
  throw new Error(`No distribution value for ${value}`);
};

const maleKey = `batch${batch}-${slug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
const malePosition = (maleHash % 4) + 1;
const maleScene = firstScene + malePosition - 1;
const maleEmotionKey = `batch${batch}-${slug}-scene${malePosition}-male-emotion`;
const maleEmotionRoll = roll(maleEmotionKey);

const scenes = {};
for (let offset = 0; offset < 4; offset += 1) {
  const scene = firstScene + offset;
  const prefix = `batch${batch}-${slug}-scene${scene}`;
  const weatherRoll = roll(`${prefix}-weather`);
  const pawsRoll = roll(`${prefix}-paws`);
  const poleRoll = roll(`${prefix}-poleDanceTheme`);
  const rainbowOnlyRoll = roll(`${prefix}-rainbowOnly`);
  const hosieryRoll = roll(`${prefix}-rainbowHosiery`);
  const hosieryWearerRoll = roll(`${prefix}-rainbowHosieryWearer`);
  const hosieryPaletteRoll = roll(`${prefix}-rainbowHosieryPaletteMode`);
  const romanceRoll = roll(`${prefix}-romanceBeat`);
  const compoundRoll = roll(`${prefix}-compoundLoveBeat`);
  const charactersOut = {};

  for (const character of characters) {
    const emotionRoll = roll(`${prefix}-${character}-emotion`);
    const midriffRoll = roll(`${prefix}-${character}-visibleMidriff`);
    const straplessRoll = roll(`${prefix}-${character}-straplessDress`);
    const openBackRoll = roll(`${prefix}-${character}-fullyOpenBack`);
    charactersOut[character] = {
      emotion: {
        roll: emotionRoll,
        result: fromDistribution(emotionRoll, contract.emotionRolls.distribution, "emotion"),
      },
      visibleMidriff: { roll: midriffRoll, active: midriffRoll <= 49 },
      straplessDress: { roll: straplessRoll, active: straplessRoll <= 34 },
      fullyOpenBack: { roll: openBackRoll, active: openBackRoll <= 29 },
    };
  }

  scenes[scene] = {
    position: offset + 1,
    theme: offset < 2 ? "undercover investigator couture" : "nurse-care couture",
    weather: {
      roll: weatherRoll,
      result: fromDistribution(weatherRoll, contract.weatherRolls.distribution, "weather"),
    },
    paws: { roll: pawsRoll, active: pawsRoll <= 24 },
    poleDanceTheme: { roll: poleRoll, active: poleRoll <= 5 },
    rainbowOnly: { roll: rainbowOnlyRoll, active: rainbowOnlyRoll <= 3 },
    rainbowHosiery: {
      roll: hosieryRoll,
      active: hosieryRoll <= 24,
      wearer: {
        roll: hosieryWearerRoll,
        result: hosieryWearerRoll <= 49 ? "Radiance" : "AI ECE",
      },
      palette: {
        roll: hosieryPaletteRoll,
        result:
          hosieryPaletteRoll <= 49
            ? "country-palette rainbow-like gradient"
            : "original independent rainbow gradient",
      },
    },
    romanceBeat: {
      roll: romanceRoll,
      index: romanceRoll % contract.romance.dynamicBeatRolls.length,
      result: contract.romance.dynamicBeatRolls[romanceRoll % contract.romance.dynamicBeatRolls.length],
    },
    compoundLoveBeat: {
      roll: compoundRoll,
      index: compoundRoll % contract.romance.compoundLoveBeatRolls.length,
      result:
        contract.romance.compoundLoveBeatRolls[
          compoundRoll % contract.romance.compoundLoveBeatRolls.length
        ],
    },
    characters: charactersOut,
  };
}

const x = {
  heart: { roll: roll(`batch${batch}-${slug}-x-heart`) },
  internalAgency: { roll: roll(`batch${batch}-${slug}-x-internalagency`) },
  worldXXXSeries: { roll: roll(`batch${batch}-${slug}-x-worldxxxseries`) },
};
x.heart.result = x.heart.roll <= 82 ? "red heart" : "white heart";
x.internalAgency.active = x.internalAgency.roll <= 24;
x.worldXXXSeries.active = x.worldXXXSeries.roll <= 24;

console.log(
  JSON.stringify(
    {
      male: {
        key: maleKey,
        fullHash: maleHash,
        roll: maleHash % 100,
        position: malePosition,
        scene: maleScene,
        emotion: {
          key: maleEmotionKey,
          roll: maleEmotionRoll,
          result: fromDistribution(maleEmotionRoll, contract.emotionRolls.distribution, "emotion"),
        },
      },
      scenes,
      x,
    },
    null,
    2,
  ),
);
