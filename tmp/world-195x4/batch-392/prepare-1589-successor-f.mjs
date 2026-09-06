import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const write = (path, text) => { fs.writeFileSync(path, `${text.trim()}\n`, "utf8"); const bytes = fs.readFileSync(path); return { path, sha256: sha256(bytes), bytes: bytes.length, exactText: bytes.toString("utf8") }; };

const primary = write(`${root}/scene-1589-meta-successor-f-primary-surface.txt`, `
Country sequence 1589, next independent vertical cinematic fashion image. Adult cast roles, all age 21: Alia at far left with voluminous natural curls; blonde Radiance second; dark-haired ECE at far right; dark-haired Ellie remains third. Attachments 938, 936 plus 937 govern facial geometry, skin tone plus stable name ownership.

The group remains outdoors on speculative Kepler-186 f terrain within transparent pressure-field protection at deep violet dusk. Planet ground, bright horizon band plus moons dominate. Fuvahmulah, Thoondu white surf, palm rim, kilhi wetlands plus reef arcs appear through large island-nation cultural research installation geometry plus couture print systems.

Choose dynamic floor-adjacent front-quarter framing with complete heels, uncovered legs, secure opaque side seams, torsos plus faces. Ellie turns within Radiance's behind embrace. Alia catches Ellie's free hand, showing calm jealousy. ECE completes the close side hug while carrying the small closed gold route lantern in both hands. Keep diagonal movement, close affection plus zero static lineup.

Radiance wears opaque rainbow-gradient RAZE knee-highs on uncovered legs: Split-Star left, angular RAZE wordmark right, compact horizontal outer calf. Ellie wears the reverse. Alia has bare lower legs; ECE does too. Choose distinct secure lined sequined strapless, cropped or open-back cocktail minis, tailored mini skorts plus short rompers with complete bust, seat plus pelvic coverage. Keep the lens outside garment volume, away from between-leg space. Every adult has complete traceable anatomy plus complete footwear. No underwear view, accidental exposure, coercion, sexual activity, extra person, weapon-like form, watermark or text beyond RAZE.
`);

const fallback = write(`${root}/scene-1589-meta-successor-f-fallback-surface.txt`, `
Reference-guided dynamic fashion portrait for country sequence 1589 on protected Kepler-186 f terrain at dusk. Keep supplied age-21 faces for Alia, Radiance, Ellie plus ECE; Fuvahmulah plus Thoondu design; complete bodies; opaque public fashion. Radiance gives Ellie the behind embrace; Alia holds Ellie's free hand with calm jealousy; ECE carries the closed route lantern during the close side hug. Radiance plus Ellie wear mirrored Split-Star plus RAZE rainbow knee-high pairs on uncovered legs. Alia plus ECE have bare lower legs. Keep complete footwear, secure coverage plus zero extra person, weapon-like form, accidental exposure, sexual activity, watermark or text beyond RAZE.
`);

const rows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(rows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))];
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const contains = (text, candidate) => { const haystack = tokens(text); const needle = tokens(candidate); for (let i = 0; i <= haystack.length - needle.length; i += 1) if (needle.every((word, offset) => haystack[i + offset] === word)) return true; return false; };
for (const prompt of [primary, fallback]) { const conflicts = blacklist.filter((candidate) => contains(prompt.exactText, candidate)); if (conflicts.length) throw new Error(`${prompt.path} contains run-blacklisted terms: ${conflicts.join(", ")}`); }
console.log(JSON.stringify({ primary: { path: primary.path, sha256: primary.sha256, bytes: primary.bytes }, fallback: { path: fallback.path, sha256: fallback.sha256, bytes: fallback.bytes } }, null, 2));
