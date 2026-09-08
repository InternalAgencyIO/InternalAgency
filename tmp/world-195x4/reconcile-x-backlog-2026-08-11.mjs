import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const loreDir = path.join(repo, "assets/lore/starlight-era");
const ledgerPath = path.join(loreDir, "world-x-publish-ledger.json");

const publications = [
  {
    batch: 359,
    country: "Guinea",
    secondaryCountry: "Zimbabwe",
    checkpoint: "batch-359-guinea-orbital-spaceship-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087085841235550351",
    caption: "Guinea ❤️ Zimbabwe #Guinea #InternalAgency #WorldXXXSeries",
    files: [
      "1457-guinea-fouta-djallon-orbital-waterfall-cupola.png",
      "1459-guinea-niger-headwaters-orbital-choice.png"
    ],
    reconciled: false
  },
  {
    batch: 363,
    country: "Bolivia",
    secondaryCountry: "Burundi",
    checkpoint: "batch-363-bolivia-moon-expedition-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087038342894424285",
    caption: "Bolivia ❤️ Burundi #Bolivia #InternalAgency",
    files: [
      "1472-bolivia-la-paz-illimani-lunar-habitat-fast-pass.png",
      "1473-bolivia-salar-uyuni-lunar-lander-fast-pass.png",
      "1468-burundi-bujumbura-tanganyika-mars-habitat-fast-pass.png"
    ],
    reconciled: true
  },
  {
    batch: 364,
    country: "Tunisia",
    secondaryCountry: "Bolivia",
    checkpoint: "batch-364-tunisia-moon-expedition-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087086588354261209",
    caption: "Tunisia ❤️ Bolivia #Tunisia #WorldXXXSeries",
    files: [
      "1477-tunisia-sidi-bou-said-lunar-lander-fast-pass.png",
      "1478-tunisia-el-jem-lunar-crater-habitat-fast-pass.png",
      "1472-bolivia-la-paz-illimani-lunar-habitat-fast-pass.png"
    ],
    reconciled: false
  },
  {
    batch: 366,
    country: "Belgium",
    secondaryCountry: "South Sudan",
    checkpoint: "batch-366-belgium-solar-observation-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087087399465627713",
    caption: "Belgium ❤️ South Sudan #Belgium",
    files: [
      "1484-belgium-brussels-solar-observation-recovery-fast-pass.png",
      "1487-belgium-dinant-solar-observation-fast-pass.png",
      "1481-south-sudan-sudd-solar-observation-fast-pass.png"
    ],
    reconciled: false
  },
  {
    batch: 368,
    country: "Jordan",
    secondaryCountry: "Haiti",
    checkpoint: "batch-368-jordan-deep-sea-submersible-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087087798968844508",
    caption: "Jordan ❤️ Haiti #Jordan",
    files: [
      "1492-jordan-amman-citadel-deep-sea-submersible-fast-pass.png",
      "1494-jordan-wadi-rum-deep-sea-submersible-male-fast-pass.png",
      "1491-haiti-ile-a-vache-deep-sea-submersible-fast-pass.png"
    ],
    reconciled: false
  },
  {
    batch: 371,
    country: "Cuba",
    secondaryCountry: "United Arab Emirates",
    checkpoint: "batch-371-cuba-orbital-research-station-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087088121691169160",
    caption: "Cuba ❤️ United Arab Emirates #Cuba #WorldXXXSeries",
    files: [
      "1504-cuba-havana-orbital-research-station-recovery.png",
      "1507-cuba-santiago-bay-orbital-research-station-fast-pass.png",
      "1500-united-arab-emirates-dubai-polar-airship-fast-pass.png"
    ],
    reconciled: false
  },
  {
    batch: 372,
    country: "Czechia",
    secondaryCountry: "Cuba",
    checkpoint: "batch-372-czechia-orbital-research-station-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087088332253577528",
    caption: "Czechia 🤍 Cuba #Czechia #WorldXXXSeries",
    files: [
      "1508-czechia-prague-orbital-research-station-male-fast-pass.png",
      "1510-czechia-moravian-karst-orbital-research-station-recovery.png",
      "1504-cuba-havana-orbital-research-station-recovery.png"
    ],
    reconciled: false
  },
  {
    batch: 373,
    country: "Honduras",
    secondaryCountry: "Czechia",
    checkpoint: "batch-373-honduras-private-jet-aviation-checkpoint.json",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    caption: "Honduras ❤️ Czechia #Honduras",
    files: [
      "1512-honduras-tegucigalpa-private-jet-male-recovery.png",
      "1515-honduras-lake-yojoa-private-jet-recovery.png",
      "1508-czechia-prague-orbital-research-station-male-fast-pass.png"
    ],
    reconciled: false
  }
];

function postedAtFromUrl(url) {
  const id = BigInt(url.split("/").at(-1));
  return new Date(Number((id >> 22n) + 1288834974657n)).toISOString();
}

async function sha256(file) {
  const bytes = await readFile(path.join(loreDir, file));
  return createHash("sha256").update(bytes).digest("hex");
}

for (const publication of publications) {
  const checkpointPath = path.join(loreDir, publication.checkpoint);
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  checkpoint.xPost = {
    ...(checkpoint.xPost ?? {}),
    status: "published-and-live-verified",
    caption: publication.caption,
    actualAttachments: publication.files,
    url: publication.url,
    publishedAt: postedAtFromUrl(publication.url),
    account: "@dogramaci",
    verification: `Exact caption, ${publication.files.length} public photo endpoints, and signed-in live status URL verified.`,
    duplicatePrevention: publication.reconciled
      ? "Already-public Bolivia status was reconciled and was not re-uploaded."
      : "Public URL recorded immediately after the single authorized submission."
  };
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
ledger.maxPostsPerRun = 50;
ledger.continuousDrainPolicy = {
  activeFrom: "2026-08-11T07:22:46.656Z",
  drainAllEligiblePerWake: true,
  liveProfileFirst: true,
  duplicatePrevention: "Search and reconcile the signed-in @dogramaci profile before every upload.",
  activeCountryRule: "From Batch 382 onward publish only after all four current-country scenes are accepted, and do not advance until the live status URL is recorded."
};
ledger.latestContinuousDrain = {
  status: "publicly-clear-live-verified",
  requestedAt: "2026-08-11T07:22:46.656Z",
  completedAt: postedAtFromUrl(publications.at(-1).url),
  account: "@dogramaci",
  reconciledWithoutReupload: publications.filter((item) => item.reconciled).map((item) => ({
    batch: item.batch,
    country: item.country,
    postUrl: item.url
  })),
  newlyPublished: publications.filter((item) => !item.reconciled).map((item) => ({
    batch: item.batch,
    country: item.country,
    postUrl: item.url
  })),
  eligibleBacklogRemaining: 0,
  verification: "Every exact caption, attachment count, public status URL, and current home-timeline article was verified in the signed-in in-app browser."
};
ledger.pendingPost = null;
ledger.preparedPostQueue = [];
ledger.deferredPostCheckpoint = null;
ledger.posts ??= [];

for (const publication of publications) {
  if (ledger.posts.some((post) => post.postUrl === publication.url)) continue;
  ledger.posts.push({
    batch: publication.batch,
    postedAt: postedAtFromUrl(publication.url),
    postUrl: publication.url,
    caption: publication.caption,
    imageNumbers: publication.files.map((file) => Number(file.match(/^\d+/)?.[0])).filter(Number.isFinite),
    countries: [publication.country, publication.secondaryCountry],
    assets: await Promise.all(publication.files.map(async (file) => ({ file, sha256: await sha256(file) }))),
    mediaMode: "signed-in-in-app-browser",
    verification: `Exact caption, ${publication.files.length} attachments, public status URL, and photo endpoints verified.`,
    transmission: publication.reconciled
      ? "live-reconciled-no-duplicate"
      : "continuous-backlog-drain-user-authorized"
  });
}

await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  checkpointCount: publications.length,
  ledgerPostCount: ledger.posts.length,
  latestContinuousDrain: ledger.latestContinuousDrain
}, null, 2));
