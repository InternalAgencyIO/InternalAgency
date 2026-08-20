#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { runInNewContext } from "node:vm";

const PROJECT_LEDGER = "assets/lore/starlight-era/world-rejected-prompt-ledger.json";
const ACTIVE_CHECKPOINT = "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json";
const RECENT_CHECKPOINTS = [
  "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json",
  "assets/lore/starlight-era/batch-390-montenegro-polar-airship-checkpoint.json",
  "assets/lore/starlight-era/batch-391-malta-orbital-research-station-checkpoint.json",
];
const CONTRACT = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const CAMPAIGN = "assets/lore/starlight-era/world-195x4-campaign.json";
const LEGACY_BLOCKLIST = "tmp/world-195x4/batch-219/preflight/blocklist-transform-26657ff5e51a1e35ba5c6ebb2be73ece0996365d195716192cc9cdb9f05c069e.json";
const SESSION_ROOTS = process.env.CODEX_SESSION_ROOT
  ? [process.env.CODEX_SESSION_ROOT]
  : [
      path.join(process.env.USERPROFILE ?? "", ".codex", "sessions"),
      path.join(process.env.USERPROFILE ?? "", ".codex", "archived_sessions"),
    ];
const SESSION_LINE_LIMITS = new Map(
  (process.env.CODEX_SESSION_LINE_LIMITS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.lastIndexOf(":");
      if (separator < 1) throw new Error(`Invalid CODEX_SESSION_LINE_LIMITS entry: ${entry}`);
      const threadId = entry.slice(0, separator);
      const limit = Number(entry.slice(separator + 1));
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error(`Invalid session line limit: ${entry}`);
      return [threadId, limit];
    }),
);
const PROJECT_THREAD_MARKERS = [
  /InternalAgency/i,
  /Internal Agency/i,
  /World Series/i,
  /Radiance/i,
  /\bEllie\b/i,
  /\bAlia\b/i,
  /AI ECE/i,
  /STAR ASCENT/i,
  /Nightflight/i,
];
const BLOCKLIST_THREAD = "019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const PRETRACE_THREAD = "019fc83b-b7ab-7c70-a1b9-0953296a4666";
const RECOVERED_LEGACY_MISSING_TEXT = {
  batch207: {
    execCallId: "call_exjR4AoHDxMcUTfQlIaJTOTw",
    sourceIndexes: [217, 218, 219, 220],
    scenes: [848, 849, 850, 851],
    promptSha256: [
      "299EC03C7D7AA0DD5CE6448D39046041585DE8D112F3A5BC02D4E2259938D382",
      "312821E249BE9D8641856EB38D81BD1E75B9CF1164EB104BAF806C2D36637E34",
      "4E553FD5DE87770808389409AE94B8EE9EAF4615B174BC270C0499E9508407BB",
      "BE514B4E82C4D625473647316E4C55E1594C7C5BE139FF4B828D04B506E5B719",
    ],
  },
  batch209: {
    sourceLineByIndex: new Map([
      [221,3905],[222,4210],[223,4535],[225,3845],[226,3965],[227,4155],[228,4271],[229,4495],[230,4538],[231,4566],[232,4593],[233,5481],[234,5527],[235,5569],[236,5615],[237,5826],[238,5985],[239,6044],[240,3972],[241,4501],[242,4543],[243,4567],[244,5482],[245,5537],[246,5622],[247,5685],[248,5831],[249,5992],[250,6051],[252,6153],[253,3930],[254,4548],[255,4570],[256,5544],[257,5690],[258,5717],[259,5864],[260,5995],
    ]),
  },
};
const RECOVERED_B209_NO_TERMINAL_BANKS = [
  { execCallId: "call_GrSIAoaDQjpqdAkyKt4U1ZlJ", selector: "jobs", promptIndexes: [2, 3], scenes: [858, 859], promptSha256: ["CAA97941963CB12C4DE0320451FE9851D7CDB2C925F7BADD520E41AB792F4A03", "D10917C049A8C2FBD026D7D6C0C6F9D3522F1F78298F17C87B5181CC5A4783A3"], promptChars: [1084, 1038] },
  { execCallId: "call_iavirzSJX08LHyVinx39rvID", selector: "jobs.prompt", promptIndexes: [1, 2], scenes: [858, 859], promptSha256: ["14DCD12A4A10A91CBEC0631EF0A5FE30DB420AEFAF15763A9B4055F9707F13A9", "3458629AB53A388F130E585D68BAA06A18302716887B0ECF8CD203EBE1B4B636"], promptChars: [1044, 962] },
];
const RECOVERED_ARCHIVED_LAUNCHES = {
  batch211: {
    execCallId: "call_B34jJxPEDiWYnhR7WZFKlfrf",
    scenes: [864, 865, 866, 867],
    promptSha256: [
      "F54F86207B6A17AB9C0E7CBB3A37A9AB101DC87AA4A3F8B8C24F55E5292F24AD",
      "F9D499D5A155D6D280FCCE27D3DAB62998C971FB4FEC4B5D358FA3EE48A6EF2B",
      "0516361814DA9D71AAB738EBE499507E709A05CAD3D4EF86AB8EAD54C645668E",
      "8CC121D330C4BC51CBF599C925CACA70F4D8E16512E3691F201A445AD29AF618",
    ],
    requestId: "afbb4219-1b2c-410b-8cd7-5c7528b640b6",
  },
  batch213: {
    execCallId: "call_Dc72vdQFnapz6YYW0twXfsfn",
    scenes: [872, 873, 874],
    promptSha256: [
      "888ADF0A3709A96F001B118891CBF267BBCFD63E78BD6CA2A36FA6D45534AD8F",
      "1714B9A56CAC3994D4C8A70A29E5F0E94D0742699F3BCAAAF509E1598138B42D",
      "51853190A1B45D69565E22398A39F5F1EC929F9D859FE1BB3A808D39CC04E45E",
    ],
    requestId: "3ea3ced7-0409-4f89-9313-3433dc30d1db",
  },
  batch219: {
    execCallId: "call_XldjaxL3vXni7UCIccxJWQGn",
    scenes: [896, 897, 898, 899],
    promptSha256: [
      "774C3C0456C713A323ACE3F216D1B878AF558CF55C8F6B70EECC9E59AE0CED96",
      "97B6A7297D860C8739D497555E2030C532279A09C0F26761B4C37D9F197F922D",
      "AA11291EEB09DD74B39BA2438491DF805B682DB99188E3BC0D606E9D850911D7",
      "C6B8E4BFC2672B4A43179FEF4729A58CEB4C91C32DBDF88B28E018BB5814FB13",
    ],
    requestId: "83859e72",
  },
};
const RECOVERED_PROMISE_BANKS = [
  { batch: 240, bank: "initial", execCallId: "call_xzsJUZPOZh7khMJvr1xd3HOd", scenes: [980,981,982,983], promptSha256: ["B158FE16A0E1E7B8117B9FC45D716B7C13C30DDDB8059F2BA3DCDEED2643EC15","966D7705D8BEA7B2CDFEA7315309C32ECAC8CFF561FD3E91B71D999A4F135A9B","B045EEABB81B951929E1385208E26B01D31FE3CBB1A149000B345401FDAA4DEE","77014AF78CE26CA02A84F231D427729DCA0748874D07AA40009AE72CF5AE0D83"], promptChars: [1631,1643,1675,1629], noTerminalIndices: [1,2,3], mode: "vm:ps" },
  { batch: 240, bank: "retry", execCallId: "call_av2BnIH1JjyVDOsmWkGLcdSQ", scenes: [980,981,982,983], promptSha256: ["8FF23C4E6A598D04113929EA12CD1AA9F856631004DFC2AA4F5A55C33948EAFE","FA1F2AE20AB5044A0DB4E482ECDECFC08432366F1F0C4E9F63B95D851EF1A27E","434D84E7B073FAF6D4F1A7FEC0E0C9F756821F10C4730A98B98589A67FB00C41","EC8B0E236925AC439258F4E3FC47E2E93E05B4DD7C130495A61A9174764E5C62"], promptChars: [1301,1300,1345,1331], noTerminalIndices: [1,2,3], mode: "vm:ps" },
  { batch: 256, bank: "initial", execCallId: "call_R5u951HlKIPw9oGBEdmWE1aX", scenes: [1044,1045,1046,1047], promptSha256: [null,"07A1A9B8AE318F41107E939ADC5EB479A5D7984EE3CE125CB1C011319B9354C7","1E8CDEFEF9EB865D16B8DF7C6F193496D5EB6D6018790A981B4CAB26047EF550","6531FC2D49724AD92A3EFBC81CAEE7FFEB9EB0F337E5549A6D64A4FEB8CDA6B4"], promptChars: [null,2312,2323,2181], noTerminalIndices: [1,2,3], mode: "vm:prompts" },
  { batch: 268, bank: "initial", execCallId: "call_ozUXcSpmFcnuRWezjcGzMmEJ", scenes: [1092,1093,1094,1095], promptSha256: [null,"FD8C47C5561C8B680454763E6A6F0AFD8F5CFB3199CDF7ADE1F80A8C0396FFA4","796DC8D7E70C5B2275CD2394252C55C8ACD3A85F79CDD1E042A5E873F10C1951","13D13B71436F6C8C2C61F4521611D12DE0DB03218C61F9FC869D46320A4B0034"], promptChars: [null,2290,2293,2230], noTerminalIndices: [1,2,3], mode: "vm:prompts" },
  { batch: 272, bank: "initial", execCallId: "call_x1KfoPXkb6k9teiceAN1dl5a", scenes: [1108,1109,1110,1111], promptSha256: [null,null,"4170F94FC48AADADF9A2F1FF2ABD7AA146A583C9F1C92B0466CAF72085AA650B","D7158CF385782373B93B192D653F6E04F8462EBDBB8BD9B3CA6318C9B3E4FC56"], promptChars: [null,null,3192,3037], noTerminalIndices: [2,3], mode: "vm:prompts" },
  { batch: 274, bank: "initial", execCallId: "call_jpZ5d9KHnroxnLCeEBtUX5hl", scenes: [1116,1117,1118,1119], promptSha256: [null,"CE51F494486BF43A77B6389E465DFF5302C11EB03381BBF7AA698167898B02EF","A66E41EF98833549ED99E4304220BC7B230084C4E672D2F85AAFBF004A19E188","BDF57E82E650FE2E5B78D8D4B57C797C0F84733581F3F016705566F71EC3BA7D"], promptChars: [null,2997,3112,3096], noTerminalIndices: [1,2,3], mode: "vm:prompts" },
  { batch: 289, bank: "recovery", execCallId: "call_btk48O6IvFIalUVvG4ys6Rt5", scenes: [1176,1177,1178,1179], promptSha256: [null,"40C4A5AF7C146894D816D22599A175BE12F2A77E24AF718EAE89C0D52570EB22","02E18FC63F53647F59A463E080C36925470EDB1C4E5C8036DB2AC196502BB30C","C6C63B610772C4D0F3AD3B97D5FBC780A4606E8B8710FD73D4F2B3BF3A3C4A83"], promptChars: [null,3624,3716,4084], noTerminalIndices: [1,2,3], mode: "vm:p-vars" },
  { batch: 309, bank: "recovery", execCallId: "call_wlipHlVffeeV8iT4o1bantJV", scenes: [1256,1257,1258,1259], promptSha256: [null,"7EF3269DF5899E64BB174309173F489156E441B6AA7F01FF45B1DD877BA4D759","B3A25DE843399716D7FCDF549A69981637AF76D24FDDA2472BD4A667A67C5000","7D60B0A26BBBB21DAEDF173F4AAF7610D156D9A7C82CE53D7CF6B2468A7BC32E"], promptChars: [null,2590,2012,2037], noTerminalIndices: [1,2,3], mode: "file:batch309-recovery" },
  { batch: 323, bank: "raw", execCallId: "call_n93XSgsfRAw05v0WMVRWNQsF", scenes: [1312,1313,1314,1315], promptSha256: [null,null,"A20A6B5CE04AE736226E4DB15B7F0205D379E7A68CD2D261B6BEE9DB175C448B","06AF5E9FB9FF87C52B41A5979D4131A85C83E4E8D1BA5D34C9DBA24A8BFB7739"], promptChars: [null,null,9732,8743], noTerminalIndices: [2,3], mode: "file:batch323-raw" },
  { batch: 323, bank: "recovery", execCallId: "call_ZIU6c9smhvSBY60Zo0u6lffH", scenes: [1313,1314,1315], promptSha256: [null,"5FB58CF9FDBDC0A9652D48430DD81F430BAA7CF4B0BFD415B1A953CF54F50C1D","BE32B0CA4A2155DD2F5B97A2E8C70DB8F591B0D6ED203E1C0134688FEA005A1C"], promptChars: [null,10133,9144], noTerminalIndices: [1,2], mode: "file:batch323-recovery" },
  { batch: 331, bank: "raw", execCallId: "call_ApJ2eEHvvyeWN6zQy1J1P8Kd", scenes: [1344,1345,1346,1347], promptSha256: ["62BC8674A9407EE895032EBA2C8D5BD2BF33FA39DAC7954DF344BA3532079977",null,"BE2C8B9F4A76FED68FD37DE58AB70CD376500FEFAD7AC74016CC669F51F6EB73","936E3284F32A08B32B00750E035FF1BF781E359B2BE06FB5638A35EB4F8C6767"], promptChars: [9112,null,10014,9010], noTerminalIndices: [0,2,3], mode: "file:trim" },
  { batch: 360, bank: "raw", execCallId: "call_F2Ig7bgpUDPENQGiBcqlz8AE", scenes: [1460,1461,1462,1463], promptSha256: [null,"A32E388D4935AA414649646D2380FBCABD94643512F749642C67CFD0AB6DF01C","4113A4A98E30694879B8A06645817A03F7483D907CED8F0658463F086483C847","6F54E3208F0B58A111E680F1B370918447BEFAD89A0E2189676141490950FF5E"], promptChars: [null,9597,9510,9277], noTerminalIndices: [1,2,3], mode: "file:crlf" },
  { batch: 382, bank: "initial", execCallId: "call_bcM0VjN9LhMeLwIndBIX7PjE", scenes: [1548,1549,1550,1551], promptSha256: [null,"589D77BCCFC3DB57B4FF6BF8BA932EC65CCA971AF571FC6AF8449F3882FEBD03","344CC66758DCCC7BAE0184E6154878A2EF032D72FE95FEA493AF2FD24E661372","0D5728D6265BFA79519139DA28CEB9FBE7C3F3FC0CC681522C18A8EC4837E91D"], promptChars: [null,10373,11586,10836], noTerminalIndices: [1,2,3], mode: "file:strip-final-lf" },
];
const RECOVERED_COMPLETED_AMBIGUOUS_CALLS = [
  { batch: 215, scene: 881, callId: "exec-1d32a02d-df03-4137-adc0-31aa30d9680f", promptSha256: "E8A017FDA00B05E173E25D4B4702E639A033DF358FE873ADEE9C87D548B946F0" },
  { batch: 215, scene: 882, callId: "exec-f3c3311e-31e1-4a48-864c-28bce8b92d17", promptSha256: "6EA4D93B280637ACC9728F69EA2056321157B1041DD7C0D60BF066D33BA4B384" },
  { batch: 215, scene: 883, callId: "exec-ae46396e-dcb1-41bc-8b3f-3f892205114f", promptSha256: "A08066EC18CE9E2D6E46AE6ED8CC0F356EF92435CBEC4E381121A6989049A63B" },
];
const AUXILIARY_EXEC_CALL_IDS = new Set([...Object.values(RECOVERED_ARCHIVED_LAUNCHES), ...RECOVERED_PROMISE_BANKS, RECOVERED_LEGACY_MISSING_TEXT.batch207, ...RECOVERED_B209_NO_TERMINAL_BANKS].map((entry) => entry.execCallId));
const AUXILIARY_COMPLETED_CALL_IDS = new Set(RECOVERED_COMPLETED_AMBIGUOUS_CALLS.map((entry) => entry.callId));
const PREFLIGHT_FAILURES = [
  {
    entryId: "codex-preflight-failure-call-dvs3EXaYT2Va47TUlvBmJa9E",
    threadId: BLOCKLIST_THREAD,
    callId: "call_dvs3EXaYT2Va47TUlvBmJa9E",
    occurredAt: "2026-08-06T15:03:30.369Z",
    batch: 223,
    scene: 915,
    status: "preflight-failed-missing-reference-no-launch",
    promptSha256: "C552BA6EB3B0883B0CF9DF17171B44799EDAF81ED4D91328F8DD1B621F9DE259",
    sourceCallId: "call_dvs3EXaYT2Va47TUlvBmJa9E",
    reason: "The referenced Scene 907 file was missing, so the renderer never launched and no image_generation_end event or image bytes exist.",
  },
];
const historicalThreadIds = new Set(["019f9fcb-1f5d-7b21-b4ac-09fad254dfc3", "019fa2dd-5fd1-7921-b5e0-d8f5cd73a039", "019fad5d-9a2c-7b73-ad9f-242264cf3bb5", BLOCKLIST_THREAD]);

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verify = args.has("--verify");
const verifySources = args.has("--verify-sources");
if ([apply, verify, verifySources].filter(Boolean).length !== 1) throw new Error("Choose exactly one mode: --apply, --verify, or --verify-sources");

const root = process.cwd();
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const normalize = (value) => value.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();

function walk(directory, output = []) {
  if (!directory || !existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, output);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) output.push(target);
  }
  return output;
}

function threadIdFromPath(file) {
  const match = path.basename(file).match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.jsonl$/i);
  return match?.[1] ?? sha256(file).slice(0, 32).toLowerCase();
}

function promptsFromExecInput(input, name) {
  if (name === "batch219") {
    return [896, 897, 898, 899].map((scene) => readFileSync(path.join(root, `tmp/world-195x4/batch-219/prompts/${scene}-foundation.txt`), "utf8").trim().replace(/—/g, "\u00E2\u20AC\u201D"));
  }
  const start = input.indexOf("const prompts =");
  const end = input.indexOf("\nconst results", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate archived prompts array");
  const context = {};
  const fragment = input.slice(start, end).replace("const prompts =", "globalThis.prompts =");
  runInNewContext(fragment, context, { timeout: 1000 });
  if (!Array.isArray(context.prompts) || !context.prompts.every((value) => typeof value === "string")) throw new Error("Archived prompts array is invalid");
  return context.prompts;
}

function promptRecord(text, fidelity = "runtime-launch-byte-exact") {
  return {
    text,
    sha256: sha256(text),
    normalizedSha256: sha256(normalize(text)),
    encoding: "utf-8",
    bytes: Buffer.byteLength(text),
    chars: text.length,
    fidelity,
  };
}

function evaluateLiteralPromptBank(input, variableName) {
  const withoutPragma = input.replace(/^\/\/ @exec:[^\n]*\n?/, "");
  const terminalPatterns = [
    /\nconst rs\s*=\s*await Promise\.all/,
    /\nconst results\s*=\s*await Promise\.all/,
    /\nconst calls\s*=\s*prompts\.map/,
    /\nconst calls\s*=\s*\[/,
  ];
  let end = withoutPragma.length;
  for (const pattern of terminalPatterns) {
    const match = withoutPragma.match(pattern);
    if (match?.index >= 0) end = Math.min(end, match.index);
  }
  let fragment = withoutPragma.slice(0, end);
  fragment = fragment.replace(new RegExp(`\\bconst ${variableName}\\s*=`), `globalThis.${variableName} =`);
  const context = {};
  runInNewContext(fragment, context, { timeout: 1000 });
  const prompts = context[variableName];
  if (!Array.isArray(prompts) || !prompts.every((value) => typeof value === "string")) throw new Error(`Unable to evaluate ${variableName} prompt bank`);
  return prompts;
}

function evaluateNamedPromptVariables(input, names) {
  const withoutPragma = input.replace(/^\/\/ @exec:[^\n]*\n?/, "");
  const end = withoutPragma.search(/\nconst calls\s*=\s*\[/);
  let fragment = withoutPragma.slice(0, end < 0 ? withoutPragma.length : end);
  fragment = fragment.replace(/^const gen\s*=.*$/m, "");
  for (const name of names) fragment = fragment.replace(new RegExp(`\\bconst ${name}\\s*=`), `globalThis.${name} =`);
  const context = {};
  runInNewContext(fragment, context, { timeout: 1000 });
  const prompts = names.map((name) => context[name]);
  if (!prompts.every((value) => typeof value === "string")) throw new Error("Unable to evaluate named prompt variables");
  return prompts;
}

function evaluateB209NoTerminalBank(configuration, input) {
  if (configuration.selector === "jobs") {
    const start = input.indexOf("const base");
    const end = input.indexOf("\nconst rs=", start);
    let fragment = input.slice(start, end);
    fragment = fragment.replace(/\bconst base\s*=/, "globalThis.base =").replace(/\bconst jobs\s*=/, "globalThis.jobs =").replace(/\bconst common\s*=/, "globalThis.common =").replace(/\bconst tail\s*=/, "globalThis.tail =");
    const context = {};
    runInNewContext(fragment, context, { timeout: 1000 });
    return configuration.promptIndexes.map((index) => context.common + context.jobs[index].change + context.tail);
  }
  const start = input.indexOf("const jobs");
  const end = input.indexOf("\nconst results", start);
  let fragment = input.slice(start, end).replace(/\bconst jobs\s*=/, "globalThis.jobs =");
  const context = {};
  runInNewContext(fragment, context, { timeout: 1000 });
  return configuration.promptIndexes.map((index) => context.jobs[index].prompt);
}

function reconstructPromiseBankPrompts(configuration, input) {
  if (configuration.mode === "vm:ps") return evaluateLiteralPromptBank(input, "ps");
  if (configuration.mode === "vm:prompts") return evaluateLiteralPromptBank(input, "prompts");
  if (configuration.mode === "vm:p-vars") return evaluateNamedPromptVariables(input, configuration.scenes.map((scene) => `p${scene}`));
  if (configuration.mode === "file:batch309-recovery") {
    return configuration.scenes.map((scene) => readFileSync(path.join(root, `tmp/world-195x4/batch-309/scene-${scene}-recovery-prompt.txt`), "utf8"));
  }
  if (configuration.mode === "file:batch323-raw") {
    return configuration.scenes.map((scene) => `Exit code: 0\nWall time: 0.3 seconds\nOutput:\n${readFileSync(path.join(root, `tmp/world-195x4/batch-323/scene-${scene}-prompt.txt`), "utf8")}\r\n`);
  }
  if (configuration.mode === "file:batch323-recovery") {
    const safety = " Safety reset for the single recovery pass: all subjects are mature fictional adults over 30 in fully opaque lined public fashion with secure coverage, no cleavage emphasis, no lingerie styling, no nudity, no erotic framing, no sensual performance, no kissing, no nightclub interior, and no suggestive posing. The theme is expressed only through color, tailoring, posture, and public editorial polish.";
    return configuration.scenes.map((scene) => `Exit code: 0\nWall time: 0.2 seconds\nOutput:\n${readFileSync(path.join(root, `tmp/world-195x4/batch-323/scene-${scene}-prompt.txt`), "utf8")}\r\n${safety}`);
  }
  if (configuration.mode === "file:trim") {
    return configuration.scenes.map((scene) => readFileSync(path.join(root, `tmp/world-195x4/batch-331/scene-${scene}-prompt.txt`), "utf8").trim());
  }
  if (configuration.mode === "file:crlf") {
    return configuration.scenes.map((scene) => `${readFileSync(path.join(root, `tmp/world-195x4/batch-360/scene-${scene}-prompt.txt`), "utf8")}\r\n`);
  }
  if (configuration.mode === "file:strip-final-lf") {
    return configuration.scenes.map((scene) => readFileSync(path.join(root, `tmp/world-195x4/batch-382/scene-${scene}-prompt.txt`), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, ""));
  }
  throw new Error(`Unsupported recovered bank mode ${configuration.mode}`);
}

function isProjectPrompt(prompt) {
  return PROJECT_THREAD_MARKERS.some((pattern) => pattern.test(prompt));
}

function inferNumber(prompt, label) {
  const patterns = label === "batch"
    ? [/(?:^|\b)Batch\s*(\d+)\b/i, /(?:^|\b)batch[- ](\d+)\b/i]
    : [/(?:^|\b)scene\s*(\d+)\b/i, /(?:^|\b)image\s*(\d+)\b/i];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

async function collectRuntimeFailures() {
  const occurrences = new Map();
  const campaignRejectSha256 = new Set(collectCampaignRejectedOutputHashes());
  const completedCampaignRejectEvents = new Map();
  const auxiliaryExecInputs = new Map();
  const auxiliaryCompletedEvents = new Map();
  const legacyTerminalEventsByLine = new Map();
  let preflightPromptEvidence = null;
  let physicalFailedEvents = 0;
  const files = SESSION_ROOTS.flatMap((sessionRoot) => walk(sessionRoot)).sort();
  for (const file of files) {
    const threadId = threadIdFromPath(file);
    const lineLimit = SESSION_LINE_LIMITS.get(threadId) ?? null;
    const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    let lineNumber = 0;
    for await (const line of reader) {
      lineNumber += 1;
      if (lineLimit !== null && lineNumber > lineLimit) break;
      const isFailedEnd = line.includes('"image_generation_end"') && line.includes('"failed"');
      const isPreflightCall = line.includes(PREFLIGHT_FAILURES[0].callId);
      const auxiliaryExecCallId = line.includes('"custom_tool_call"') ? [...AUXILIARY_EXEC_CALL_IDS].find((callId) => line.includes(callId)) : null;
      const isCompletedEnd = line.includes('"image_generation_end"') && line.includes('"completed"');
      const auxiliaryCompletedCallId = isCompletedEnd ? [...AUXILIARY_COMPLETED_CALL_IDS].find((callId) => line.includes(callId)) : null;
      if (!isFailedEnd && !auxiliaryExecCallId && !isCompletedEnd && !isPreflightCall) continue;
      let record;
      try { record = JSON.parse(line); } catch { continue; }
      const event = record.payload ?? {};
      if (isPreflightCall && record.type === "response_item" && event.type === "function_call" && event.call_id === PREFLIGHT_FAILURES[0].callId) {
        const argumentsObject = JSON.parse(event.arguments ?? "{}");
        if (typeof argumentsObject.prompt === "string") preflightPromptEvidence = { threadId, timestamp: record.timestamp, line: lineNumber, prompt: argumentsObject.prompt };
      }
      if (auxiliaryExecCallId && event.call_id === auxiliaryExecCallId && record.type === "response_item" && event.type === "custom_tool_call" && event.name === "exec") {
        auxiliaryExecInputs.set(auxiliaryExecCallId, { threadId, timestamp: record.timestamp, line: lineNumber, input: event.input });
      }
      if (auxiliaryCompletedCallId && event.call_id === auxiliaryCompletedCallId && record.type === "event_msg" && event.type === "image_generation_end" && event.status === "completed") {
        auxiliaryCompletedEvents.set(auxiliaryCompletedCallId, {
          threadId,
          timestamp: record.timestamp,
          line: lineNumber,
          callId: event.call_id,
          revisedPrompt: event.revised_prompt,
          resultWasNonempty: typeof event.result === "string" && event.result.length > 0,
        });
      }
      if (isCompletedEnd && record.type === "event_msg" && event.type === "image_generation_end" && event.status === "completed" && typeof event.result === "string" && event.result) {
        const bytes = Buffer.from(event.result, "base64");
        const outputSha256 = sha256(bytes);
        if (campaignRejectSha256.has(outputSha256) && !completedCampaignRejectEvents.has(outputSha256)) {
          completedCampaignRejectEvents.set(outputSha256, {
            threadId,
            timestamp: record.timestamp,
            line: lineNumber,
            callId: event.call_id,
            revisedPrompt: event.revised_prompt,
            outputSha256,
            outputBytes: bytes.length,
          });
        }
      }
      if (threadId === PRETRACE_THREAD && RECOVERED_LEGACY_MISSING_TEXT.batch209.sourceLineByIndex && record.type === "event_msg" && event.type === "image_generation_end") {
        const wantedLines = new Set(RECOVERED_LEGACY_MISSING_TEXT.batch209.sourceLineByIndex.values());
        if (wantedLines.has(lineNumber)) {
          let outputSha256 = null;
          let outputBytes = null;
          if (event.status === "completed" && typeof event.result === "string" && event.result) {
            const bytes = Buffer.from(event.result, "base64");
            outputSha256 = sha256(bytes);
            outputBytes = bytes.length;
          }
          legacyTerminalEventsByLine.set(lineNumber, { threadId, timestamp: record.timestamp, line: lineNumber, callId: event.call_id, status: event.status, revisedPrompt: event.revised_prompt, outputSha256, outputBytes });
        }
      }
      if (record.type !== "event_msg" || event.type !== "image_generation_end" || event.status !== "failed") continue;
      if (typeof event.revised_prompt !== "string" || !event.revised_prompt) continue;
      physicalFailedEvents += 1;
      const promptSha256 = sha256(event.revised_prompt);
      const occurrenceKey = `${event.call_id}|${promptSha256}`;
      const sourceOccurrence = { threadId, timestamp: record.timestamp };
      const existing = occurrences.get(occurrenceKey);
      if (existing) {
        existing.observedIn.push(sourceOccurrence);
        if (record.timestamp < existing.occurredAt) {
          existing.threadId = threadId;
          existing.occurredAt = record.timestamp;
          existing.sourceAudit.threadId = threadId;
          existing.sourceAudit.timestamp = record.timestamp;
        }
        continue;
      }
      occurrences.set(occurrenceKey, {
        entryId: `codex-image-failure-${event.call_id}-${promptSha256.slice(0, 12).toLowerCase()}`,
        threadId,
        callId: event.call_id,
        occurredAt: record.timestamp,
        batch: inferNumber(event.revised_prompt, "batch"),
        scene: inferNumber(event.revised_prompt, "scene"),
        status: "failed-no-image-bytes",
        failureCause: event.call_id.startsWith("call_") ? "provider-failure-details-may-exist-in-session-output" : "not-exposed-by-image-generation-end-event",
        prompt: {
          text: event.revised_prompt,
          sha256: promptSha256,
          normalizedSha256: sha256(normalize(event.revised_prompt)),
          encoding: "utf-8",
          bytes: Buffer.byteLength(event.revised_prompt),
          chars: event.revised_prompt.length,
          fidelity: "runtime-launch-byte-exact",
        },
        rawOutput: { path: null, sha256: null, bytes: 0, state: "no-bytes" },
        sourceAudit: {
          sourceKind: "codex-session-image-generation-end",
          threadId,
          callId: event.call_id,
          timestamp: record.timestamp,
          terminalStatus: event.status,
          resultWasEmpty: event.result === "",
        },
        observationFingerprint: occurrenceKey,
        observedIn: [sourceOccurrence],
        immutable: true,
      });
    }
  }
  return {
    entries: [...occurrences.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.callId.localeCompare(b.callId)),
    physicalFailedEvents,
    auxiliaryExecInputs,
    auxiliaryCompletedEvents,
    completedCampaignRejectEvents,
    legacyTerminalEventsByLine,
    preflightPromptEvidence,
  };
}

function collectCampaignRejectedOutputHashes() {
  const campaign = JSON.parse(readFileSync(path.join(root, CAMPAIGN), "utf8"));
  const hashes = new Set();
  for (const batch of campaign.plannedBatches ?? []) {
    for (const scene of batch.scenes ?? []) {
      for (const record of scene.renderState?.rejectedCandidates ?? []) {
        if (record.sha256) hashes.add(record.sha256.toUpperCase());
      }
    }
  }
  const manifestPath = path.join(root, "progress-reports/codex-generated-media/manifest.jsonl");
  for (const line of readFileSync(manifestPath, "utf8").trimEnd().split(/\n/)) {
    const row = JSON.parse(line);
    if (row.status === "rejected" && row.sha256) hashes.add(row.sha256.toUpperCase());
  }
  return [...hashes];
}

function pointerToken(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function collectHistoricalRepositoryEvidence(runtimeEntries) {
  const sourcePath = path.join(root, LEGACY_BLOCKLIST);
  const sourceBuffer = readFileSync(sourcePath);
  const source = JSON.parse(sourceBuffer);
  const sceneRows = source.corpus?.sceneBlockedPrompts ?? [];
  const masterRows = source.corpus?.masterAttemptLog ?? [];
  const runtimeNormalizedHashes = new Set(runtimeEntries.map((entry) => entry.prompt.normalizedSha256));
  const exactPromptEntries = [];
  const unrecoverablePromptEvidence = [];
  const knownPromptHashes = new Set();
  const batch219CanonicalToLaunch = new Map([
    ["BFAEC241473014C9B340022D26A365005A14725C8562E8178ECBC99A04836967", "774C3C0456C713A323ACE3F216D1B878AF558CF55C8F6B70EECC9E59AE0CED96"],
    ["9B9D46D347CFBA395F336FFC5556D2EE95771F9B675BA7DDB09DB31F27988A2B", "97B6A7297D860C8739D497555E2030C532279A09C0F26761B4C37D9F197F922D"],
    ["8CCF3D05BFD8D4ABA67726CF111D02BB4B0D2BE27332110157340D1337A3AE50", "AA11291EEB09DD74B39BA2438491DF805B682DB99188E3BC0D606E9D850911D7"],
    ["6E4C7DBE5513131DD3CD7791AF324A30DDCA3E0522E00D73D9E340E998E2BB9B", "C6B8E4BFC2672B4A43179FEF4729A58CEB4C91C32DBDF88B28E018BB5814FB13"],
  ]);
  const canonicalSourceAliases = [];
  const recoveredMissingTextAliases = [];

  for (let index = 0; index < sceneRows.length; index += 1) {
    const row = sceneRows[index];
    const text = typeof row.prompt === "string" ? row.prompt : typeof row.entry?.exactPrompt === "string" ? row.entry.exactPrompt : null;
    const sourceAudit = {
      sourceKind: "checked-in-historical-blocklist-corpus",
      path: LEGACY_BLOCKLIST,
      jsonPointer: `/corpus/sceneBlockedPrompts/${index}`,
      sourceFileSha256: sha256(sourceBuffer),
      sourceRecordSha256: sha256(JSON.stringify(row)),
    };
    if (!text) {
      unrecoverablePromptEvidence.push({
        evidenceId: `legacy-blocklist-missing-text-${index}`,
        batch: row.batch ?? row.entry?.batch ?? null,
        scene: row.sceneNumber ?? row.entry?.sceneNumber ?? null,
        attempt: row.entry?.attempt ?? row.source ?? null,
        requestId: row.entry?.requestId ?? null,
        candidatePromptSha256: row.entry?.promptSha256 ?? null,
        reason: "The authoritative historical blocked-occurrence record exists, but no exact prompt text survived in the checked-in corpus.",
        sourceAudit,
        immutable: true,
      });
      continue;
    }
    const promptSha256 = sha256(text);
    const normalizedSha256 = sha256(normalize(text));
    if (batch219CanonicalToLaunch.has(promptSha256)) {
      canonicalSourceAliases.push({
        aliasId: `legacy-blocklist-canonical-source-alias-${index}`,
        batch: row.batch ?? row.entry?.batch ?? null,
        scene: row.sceneNumber ?? row.entry?.sceneNumber ?? null,
        canonicalSourcePrompt: promptRecord(text, "canonical-source-text-before-runtime-encoding-transform"),
        runtimeLaunchPromptSha256: batch219CanonicalToLaunch.get(promptSha256),
        reason: "The checked-in source uses one em dash that the historical PowerShell transport mojibaked before launch. This is an alias to the recovered runtime launch occurrence, not a second occurrence.",
        sourceAudit,
        immutable: true,
      });
      knownPromptHashes.add(normalizedSha256);
      continue;
    }
    knownPromptHashes.add(normalizedSha256);
    exactPromptEntries.push({
      entryId: `legacy-blocklist-${index}-${promptSha256.slice(0, 16).toLowerCase()}`,
      batch: row.batch ?? row.entry?.batch ?? null,
      scene: row.sceneNumber ?? row.entry?.sceneNumber ?? null,
      attempt: row.entry?.attempt ?? row.source ?? null,
      requestId: row.entry?.requestId ?? null,
      status: row.entry?.outcome ?? "historical-blocked-prompt",
      moderationStage: row.entry?.moderationStage ?? null,
      moderationCategory: row.entry?.moderationCategory ?? null,
      prompt: {
        text,
        sha256: promptSha256,
        normalizedSha256,
        encoding: "utf-8",
        bytes: Buffer.byteLength(text),
        chars: text.length,
        fidelity: "canonical-source-text",
      },
      rawOutput: { path: null, sha256: null, bytes: null, state: row.entry?.outcome === "blocked" ? "no-bytes" : "not-recorded" },
      runtimePromptMatch: runtimeNormalizedHashes.has(normalizedSha256),
      sourceAudit,
      immutable: true,
    });
  }

  for (let index = 0; index < masterRows.length; index += 1) {
    const row = masterRows[index];
    const statusText = `${row.outcome ?? ""} ${row.status ?? ""} ${row.reason ?? ""}`;
    const blocked = /block|moderation|failed|reject/i.test(statusText);
    if (!blocked || typeof row.exactPrompt !== "string") continue;
    const normalizedSha256 = sha256(normalize(row.exactPrompt));
    if (knownPromptHashes.has(normalizedSha256)) continue;
    const promptSha256 = sha256(row.exactPrompt);
    exactPromptEntries.push({
      entryId: `legacy-master-only-${index}-${promptSha256.slice(0, 16).toLowerCase()}`,
      batch: row.batch ?? null,
      scene: row.sceneNumber ?? row.scene ?? null,
      attempt: row.attempt ?? null,
      requestId: row.requestId ?? null,
      status: row.outcome ?? row.status ?? "historical-blocked-prompt",
      moderationStage: row.moderationStage ?? null,
      moderationCategory: row.moderationCategory ?? null,
      prompt: {
        text: row.exactPrompt,
        sha256: promptSha256,
        normalizedSha256,
        encoding: "utf-8",
        bytes: Buffer.byteLength(row.exactPrompt),
        chars: row.exactPrompt.length,
        fidelity: "canonical-source-text",
      },
      rawOutput: { path: null, sha256: null, bytes: null, state: "not-recorded" },
      runtimePromptMatch: runtimeNormalizedHashes.has(normalizedSha256),
      sourceAudit: {
        sourceKind: "checked-in-historical-blocklist-master-log",
        path: LEGACY_BLOCKLIST,
        jsonPointer: `/corpus/masterAttemptLog/${index}`,
        sourceFileSha256: sha256(sourceBuffer),
        sourceRecordSha256: sha256(JSON.stringify(row)),
      },
      immutable: true,
    });
    knownPromptHashes.add(normalizedSha256);
  }

  return { exactPromptEntries, unrecoverablePromptEvidence, canonicalSourceAliases };
}

function reconcileHistoricalMissingText(historicalEvidence, runtimeData, recoveredLaunchEvidence) {
  const sourceBuffer = readFileSync(path.join(root, LEGACY_BLOCKLIST));
  const source = JSON.parse(sourceBuffer);
  const runtimeByPromptSha = new Map(runtimeData.entries.map((entry) => [entry.prompt.sha256, entry]));
  const recoveredAliases = [];
  const completedVisualRejects = [];
  const noTerminalPromptEntries = [];

  const batch207Source = runtimeData.auxiliaryExecInputs.get(RECOVERED_LEGACY_MISSING_TEXT.batch207.execCallId);
  if (!batch207Source) throw new Error("Missing Batch 207 archived launch source");
  const batch207Prompts = promptsFromExecInput(batch207Source.input, "batch207");
  RECOVERED_LEGACY_MISSING_TEXT.batch207.sourceIndexes.forEach((sourceIndex, promptIndex) => {
    const prompt = promptRecord(batch207Prompts[promptIndex]);
    if (prompt.sha256 !== RECOVERED_LEGACY_MISSING_TEXT.batch207.promptSha256[promptIndex]) throw new Error(`Batch 207 prompt mismatch ${sourceIndex}`);
    const row = source.corpus.sceneBlockedPrompts[sourceIndex];
    const sourceAudit = { sourceKind: "checked-in-historical-blocklist-corpus", path: LEGACY_BLOCKLIST, jsonPointer: `/corpus/sceneBlockedPrompts/${sourceIndex}`, sourceFileSha256: sha256(sourceBuffer), sourceRecordSha256: sha256(JSON.stringify(row)) };
    const runtimeEntry = runtimeByPromptSha.get(prompt.sha256);
    const base = { batch: 207, scene: RECOVERED_LEGACY_MISSING_TEXT.batch207.scenes[promptIndex], prompt, sourceAudit, recoveredLaunchSourceAudit: { sourceKind: "archived-codex-exec-launch-array", threadId: batch207Source.threadId, execCallId: RECOVERED_LEGACY_MISSING_TEXT.batch207.execCallId, timestamp: batch207Source.timestamp, jsonlLine: batch207Source.line, selector: `payload.input prompts[${promptIndex}]` }, immutable: true };
    if (runtimeEntry) recoveredAliases.push({ ...base, aliasId: `legacy-missing-text-runtime-alias-${sourceIndex}`, status: "historical-record-reconciled-to-runtime-failure", runtimeEntryId: runtimeEntry.entryId });
    else noTerminalPromptEntries.push({ ...base, entryId: `legacy-missing-text-no-terminal-${sourceIndex}-${prompt.sha256.slice(0,12).toLowerCase()}`, status: "launched-in-promise-bank-no-terminal-event-no-bytes", rawOutput: { path: null, sha256: null, bytes: 0, state: "no-bytes" } });
  });

  for (const [sourceIndex, lineNumber] of RECOVERED_LEGACY_MISSING_TEXT.batch209.sourceLineByIndex) {
    const event = runtimeData.legacyTerminalEventsByLine.get(lineNumber);
    if (!event?.revisedPrompt) throw new Error(`Missing Batch 209 terminal event line ${lineNumber}`);
    const prompt = promptRecord(event.revisedPrompt);
    const row = source.corpus.sceneBlockedPrompts[sourceIndex];
    const sourceAudit = { sourceKind: "checked-in-historical-blocklist-corpus", path: LEGACY_BLOCKLIST, jsonPointer: `/corpus/sceneBlockedPrompts/${sourceIndex}`, sourceFileSha256: sha256(sourceBuffer), sourceRecordSha256: sha256(JSON.stringify(row)) };
    const base = { batch: row.batch ?? row.entry?.batch ?? 209, scene: row.sceneNumber ?? row.entry?.sceneNumber ?? null, attempt: row.entry?.attempt ?? null, prompt, sourceAudit, immutable: true };
    if (event.status === "failed") {
      const runtimeEntry = runtimeByPromptSha.get(prompt.sha256);
      if (!runtimeEntry) throw new Error(`Missing Batch 209 runtime alias line ${lineNumber}`);
      recoveredAliases.push({ ...base, aliasId: `legacy-missing-text-runtime-alias-${sourceIndex}`, status: "historical-record-reconciled-to-runtime-failure", runtimeEntryId: runtimeEntry.entryId, terminalSourceAudit: { sourceKind: "archived-codex-image-generation-end", threadId: event.threadId, callId: event.callId, timestamp: event.timestamp, jsonlLine: event.line, terminalStatus: "failed" } });
    } else if (event.status === "completed") {
      const mediaRow = findManifestRowBySha256(event.outputSha256);
      if (!mediaRow?.canonicalPath) throw new Error(`Batch 209 completed reject not archived ${sourceIndex}`);
      completedVisualRejects.push({ ...base, entryId: `legacy-missing-text-completed-reject-${sourceIndex}-${event.callId}`, status: "completed-output-rejected-visual-audit", rawOutput: { path: mediaRow.canonicalPath, sha256: event.outputSha256, bytes: mediaRow.bytes ?? event.outputBytes, state: "preserved-in-progress-archive" }, terminalSourceAudit: { sourceKind: "archived-codex-image-generation-end", threadId: event.threadId, callId: event.callId, timestamp: event.timestamp, jsonlLine: event.line, terminalStatus: "completed", outputSha256Matched: event.outputSha256 } });
    } else throw new Error(`Unexpected Batch 209 terminal status line ${lineNumber}`);
  }

  const resolvedIndexes = new Set([...RECOVERED_LEGACY_MISSING_TEXT.batch207.sourceIndexes, ...RECOVERED_LEGACY_MISSING_TEXT.batch209.sourceLineByIndex.keys()]);
  historicalEvidence.unrecoverablePromptEvidence = historicalEvidence.unrecoverablePromptEvidence.filter((entry) => {
    const match = entry.evidenceId.match(/-(\d+)$/);
    return !match || !resolvedIndexes.has(Number(match[1]));
  });
  return { recoveredAliases, completedVisualRejects, noTerminalPromptEntries };
}

function collectRecoveredNoTerminalPrompts(runtimeData, legacySourceBuffer) {
  const runtimeByPromptSha = new Map(runtimeData.entries.map((entry) => [entry.prompt.sha256, entry]));
  const exactNoTerminalPromptEntries = [];
  const runtimeAliases = [];

  for (const [name, configuration] of Object.entries(RECOVERED_ARCHIVED_LAUNCHES)) {
    const source = runtimeData.auxiliaryExecInputs.get(configuration.execCallId);
    if (!source) throw new Error(`Missing archived launch source ${configuration.execCallId}`);
    const prompts = promptsFromExecInput(source.input, name);
    if (prompts.length !== configuration.promptSha256.length) throw new Error(`Archived prompt count mismatch for ${name}`);
    prompts.forEach((text, promptIndex) => {
      const prompt = promptRecord(text);
      if (prompt.sha256 !== configuration.promptSha256[promptIndex]) throw new Error(`Archived prompt SHA mismatch for ${name}[${promptIndex}]`);
      const runtimeEntry = runtimeByPromptSha.get(prompt.sha256);
      const base = {
        batch: Number(name.replace("batch", "")),
        scene: configuration.scenes[promptIndex],
        promptIndex,
        requestId: configuration.requestId,
        prompt,
        sourceAudit: {
          sourceKind: "archived-codex-exec-launch-array",
          threadId: source.threadId,
          execCallId: configuration.execCallId,
          timestamp: source.timestamp,
          jsonlLine: source.line,
          selector: `payload.input prompts[${promptIndex}]`,
        },
        immutable: true,
      };
      if (runtimeEntry) {
        runtimeAliases.push({
          ...base,
          aliasId: `recovered-launch-alias-${name}-${promptIndex}-${prompt.sha256.slice(0, 12).toLowerCase()}`,
          status: "exact-launch-alias-to-runtime-failure",
          runtimeEntryId: runtimeEntry.entryId,
        });
      } else if ((name === "batch211" && promptIndex > 0) || (name === "batch213" && promptIndex === 2) || (name === "batch219" && promptIndex > 0)) {
        exactNoTerminalPromptEntries.push({
          ...base,
          entryId: `recovered-no-terminal-${name}-${promptIndex}-${prompt.sha256.slice(0, 12).toLowerCase()}`,
          status: "launched-in-promise-bank-no-terminal-event-no-bytes",
          rawOutput: { path: null, sha256: null, bytes: 0, state: "no-bytes" },
        });
      }
    });
  }

  for (const configuration of RECOVERED_PROMISE_BANKS) {
    const source = runtimeData.auxiliaryExecInputs.get(configuration.execCallId);
    if (!source) throw new Error(`Missing recovered Promise bank ${configuration.execCallId}`);
    const prompts = reconstructPromiseBankPrompts(configuration, source.input);
    if (prompts.length !== configuration.scenes.length) throw new Error(`Recovered Promise bank count mismatch ${configuration.execCallId}`);
    for (const promptIndex of configuration.noTerminalIndices) {
      const prompt = promptRecord(prompts[promptIndex]);
      if (prompt.sha256 !== configuration.promptSha256[promptIndex] || prompt.chars !== configuration.promptChars[promptIndex]) {
        throw new Error(`Recovered Promise bank prompt mismatch ${configuration.execCallId}[${promptIndex}]: ${prompt.sha256}/${prompt.chars}`);
      }
      exactNoTerminalPromptEntries.push({
        entryId: `recovered-no-terminal-batch${configuration.batch}-${configuration.bank}-${promptIndex}-${prompt.sha256.slice(0, 12).toLowerCase()}`,
        batch: configuration.batch,
        scene: configuration.scenes[promptIndex],
        bank: configuration.bank,
        promptIndex,
        status: "launched-in-promise-bank-no-terminal-event-no-bytes",
        prompt,
        rawOutput: { path: null, sha256: null, bytes: 0, state: "no-bytes" },
        sourceAudit: {
          sourceKind: "codex-exec-promise-bank-launch",
          threadId: source.threadId,
          execCallId: configuration.execCallId,
          timestamp: source.timestamp,
          jsonlLine: source.line,
          selector: `reconstructed launched prompt[${promptIndex}]`,
          reconstructionMode: configuration.mode,
          siblingTerminalHashValidated: true,
        },
        immutable: true,
      });
    }
  }

  for (const configuration of RECOVERED_B209_NO_TERMINAL_BANKS) {
    const source = runtimeData.auxiliaryExecInputs.get(configuration.execCallId);
    if (!source) throw new Error(`Missing Batch 209 no-terminal source ${configuration.execCallId}`);
    const prompts = evaluateB209NoTerminalBank(configuration, source.input);
    prompts.forEach((text, localIndex) => {
      const prompt = promptRecord(text);
      if (prompt.sha256 !== configuration.promptSha256[localIndex] || prompt.chars !== configuration.promptChars[localIndex]) throw new Error(`Batch 209 no-terminal prompt mismatch ${configuration.execCallId}[${localIndex}]`);
      const promptIndex = configuration.promptIndexes[localIndex];
      exactNoTerminalPromptEntries.push({
        entryId: `recovered-no-terminal-batch209-${configuration.execCallId}-${promptIndex}-${prompt.sha256.slice(0,12).toLowerCase()}`,
        batch: 209,
        scene: configuration.scenes[localIndex],
        promptIndex,
        status: "launched-in-promise-bank-no-terminal-event-no-bytes",
        prompt,
        rawOutput: { path: null, sha256: null, bytes: 0, state: "no-bytes" },
        sourceAudit: { sourceKind: "archived-codex-exec-promise-bank", threadId: source.threadId, execCallId: configuration.execCallId, timestamp: source.timestamp, jsonlLine: source.line, selector: `payload.input ${configuration.selector}[${promptIndex}]` },
        immutable: true,
      });
    });
  }

  const legacy = JSON.parse(legacySourceBuffer);
  const batch211Alias = legacy.corpus?.masterAttemptLog?.[110] ?? null;
  return {
    exactNoTerminalPromptEntries,
    runtimeAliases,
    batch211AggregateAlias: batch211Alias ? {
      sourceKind: "checked-in-historical-blocklist-master-log",
      path: LEGACY_BLOCKLIST,
      jsonPointer: "/corpus/masterAttemptLog/110",
      note: "This aggregate is reconciled to four exact archived launch prompts: one runtime failure plus three exact no-terminal occurrences. It is evidence aliasing those four prompts, not a fifth occurrence.",
    } : null,
  };
}

function collectCampaignVisualAndAmbiguousEvidence(runtimeData, recoveredNoTerminalPrompts) {
  const sourceBuffer = readFileSync(path.join(root, CAMPAIGN));
  const campaign = JSON.parse(sourceBuffer);
  const completedVisualRejects = [];
  const ambiguousAttemptAliases = [];
  const recoveredCompletedAmbiguous = [];
  for (let batchIndex = 0; batchIndex < (campaign.plannedBatches ?? []).length; batchIndex += 1) {
    const batch = campaign.plannedBatches[batchIndex];
    for (let sceneIndex = 0; sceneIndex < (batch.scenes ?? []).length; sceneIndex += 1) {
      const scene = batch.scenes[sceneIndex];
      const renderState = scene.renderState ?? {};
      for (let index = 0; index < (renderState.rejectedCandidates ?? []).length; index += 1) {
        const record = renderState.rejectedCandidates[index];
        const outputSha256 = record.sha256?.toUpperCase() ?? null;
        const completedEvent = outputSha256 ? runtimeData.completedCampaignRejectEvents.get(outputSha256) : null;
        if (!completedEvent) throw new Error(`Missing completed renderer event for campaign reject ${batch.batch}/${scene.number}/${index}`);
        const prompt = promptRecord(completedEvent.revisedPrompt);
        const mediaRow = findManifestRowBySha256(outputSha256);
        completedVisualRejects.push({
          entryId: `campaign-visual-reject-${batch.batch}-${scene.number}-${index}`,
          batch: batch.batch,
          scene: scene.number,
          attempt: record.attempt ?? index + 1,
          status: "completed-output-rejected-visual-audit",
          rawOutput: {
            path: mediaRow?.canonicalPath ?? record.asset ?? null,
            historicalSourceKind: record.asset ? "campaign-recorded-path" : null,
            sha256: outputSha256,
            bytes: mediaRow?.bytes ?? record.bytes ?? completedEvent.outputBytes,
            state: mediaRow?.canonicalPath ? "preserved-in-progress-archive" : "preserved-or-historically-referenced",
          },
          reason: record.reason ?? null,
          prompt,
          terminalSourceAudit: {
            sourceKind: "codex-session-completed-image-generation-end",
            threadId: completedEvent.threadId,
            callId: completedEvent.callId,
            timestamp: completedEvent.timestamp,
            jsonlLine: completedEvent.line,
            outputSha256Matched: outputSha256,
          },
          sourceAudit: {
            sourceKind: "world-campaign-completed-visual-reject",
            path: CAMPAIGN,
            jsonPointer: `/plannedBatches/${batchIndex}/scenes/${sceneIndex}/renderState/rejectedCandidates/${index}`,
            sourceFileSha256: sha256(sourceBuffer),
            sourceRecordSha256: sha256(JSON.stringify(record)),
          },
          immutable: true,
        });
      }
      for (let index = 0; index < (renderState.ambiguousAttempts ?? []).length; index += 1) {
        const record = renderState.ambiguousAttempts[index];
        const base = {
          batch: batch.batch,
          scene: scene.number,
          attempt: record.attempt ?? null,
          requestId: record.requestId ?? null,
          sourceAudit: {
            sourceKind: "world-campaign-ambiguous-attempt",
            path: CAMPAIGN,
            jsonPointer: `/plannedBatches/${batchIndex}/scenes/${sceneIndex}/renderState/ambiguousAttempts/${index}`,
            sourceFileSha256: sha256(sourceBuffer),
            sourceRecordSha256: sha256(JSON.stringify(record)),
          },
          immutable: true,
        };
        const candidatePromptSha256 = record.candidatePromptSha256?.toUpperCase() ?? null;
        const runtimeAlias = candidatePromptSha256 ? runtimeData.entries.find((entry) => entry.prompt.sha256 === candidatePromptSha256) : null;
        if (runtimeAlias) {
          ambiguousAttemptAliases.push({
            ...base,
            aliasId: `campaign-ambiguous-runtime-alias-${batch.batch}-${scene.number}-${index}`,
            status: "campaign-ambiguous-record-reconciled-to-runtime-failure",
            runtimeEntryId: runtimeAlias.entryId,
            candidatePromptSha256,
          });
          continue;
        }
        const noTerminalAlias = candidatePromptSha256
          ? recoveredNoTerminalPrompts.exactNoTerminalPromptEntries.find((entry) => entry.prompt.sha256 === candidatePromptSha256)
          : null;
        if (noTerminalAlias) {
          ambiguousAttemptAliases.push({
            ...base,
            aliasId: `campaign-ambiguous-no-terminal-alias-${batch.batch}-${scene.number}-${index}`,
            status: "campaign-ambiguous-record-reconciled-to-exact-no-terminal-launch",
            recoveredEntryId: noTerminalAlias.entryId,
            candidatePromptSha256,
          });
          continue;
        }
        const completedConfiguration = RECOVERED_COMPLETED_AMBIGUOUS_CALLS.find((item) => item.batch === batch.batch && item.scene === scene.number);
        if (completedConfiguration) {
          const event = runtimeData.auxiliaryCompletedEvents.get(completedConfiguration.callId);
          if (!event || !event.resultWasNonempty) throw new Error(`Missing completed ambiguous event ${completedConfiguration.callId}`);
          const prompt = promptRecord(event.revisedPrompt);
          if (prompt.sha256 !== completedConfiguration.promptSha256) throw new Error(`Completed ambiguous prompt SHA mismatch ${completedConfiguration.callId}`);
          const mediaRow = findManifestRowByCallId(completedConfiguration.callId);
          recoveredCompletedAmbiguous.push({
            ...base,
            entryId: `campaign-completed-ambiguous-${batch.batch}-${scene.number}-${completedConfiguration.callId}`,
            status: "completed-output-recorded-as-ambiguous-and-not-accepted",
            callId: completedConfiguration.callId,
            occurredAt: event.timestamp,
            prompt,
            rawOutput: {
              path: mediaRow?.canonicalPath ?? null,
              sha256: mediaRow?.sha256?.toUpperCase() ?? null,
              bytes: mediaRow?.bytes ?? null,
              state: mediaRow?.canonicalPath ? "preserved-in-progress-archive" : "completed-result-not-yet-mapped",
            },
            terminalSourceAudit: {
              sourceKind: "archived-codex-image-generation-end",
              threadId: event.threadId,
              callId: event.callId,
              timestamp: event.timestamp,
              jsonlLine: event.line,
              terminalStatus: "completed",
              resultWasNonempty: true,
            },
          });
          continue;
        }
        throw new Error(`Unreconciled campaign ambiguous attempt at batch ${batch.batch} scene ${scene.number}`);
      }
    }
  }
  return { completedVisualRejects, ambiguousAttemptAliases, recoveredCompletedAmbiguous };
}

function findManifestRowByCallId(callId) {
  const manifestPath = path.join(root, "progress-reports/codex-generated-media/manifest.jsonl");
  for (const line of readFileSync(manifestPath, "utf8").trimEnd().split(/\n/)) {
    if (!line.includes(callId)) continue;
    const row = JSON.parse(line);
    if (row.sourceKind === "codex-generated-images") return row;
  }
  return null;
}

function findManifestRowBySha256(sha) {
  const manifestPath = path.join(root, "progress-reports/codex-generated-media/manifest.jsonl");
  for (const line of readFileSync(manifestPath, "utf8").trimEnd().split(/\n/)) {
    if (!line.toUpperCase().includes(sha)) continue;
    const row = JSON.parse(line);
    if (row.sha256?.toUpperCase() === sha && row.sourceKind === "codex-generated-images") return row;
  }
  return null;
}

function collectMediaManifestRejectedEvidence(runtimeData, campaignRepositoryEvidence) {
  const manifestPath = "progress-reports/codex-generated-media/manifest.jsonl";
  const lines = readFileSync(path.join(root, manifestPath), "utf8").trimEnd().split(/\n/);
  const exactPromptEntries = [];
  const unrecoverablePromptEvidence = [];
  const campaignAliases = [];
  const campaignByOutputSha = new Map(
    campaignRepositoryEvidence.completedVisualRejects.map((entry) => [entry.rawOutput.sha256, entry]),
  );
  for (let index = 0; index < lines.length; index += 1) {
    const row = JSON.parse(lines[index]);
    if (row.status !== "rejected") continue;
    const outputSha256 = row.sha256?.toUpperCase() ?? null;
    const sourceAudit = {
      sourceKind: "generated-media-manifest-rejected-occurrence",
      path: manifestPath,
      line: index + 1,
      occurrenceId: row.occurrenceId,
      sourceRecordSha256: sha256(lines[index]),
    };
    const campaignEntry = campaignByOutputSha.get(outputSha256);
    if (campaignEntry) {
      campaignAliases.push({
        aliasId: `media-manifest-rejected-alias-${row.occurrenceId}`,
        status: "manifest-rejected-output-reconciled-to-campaign-visual-reject",
        campaignEntryId: campaignEntry.entryId,
        rawOutputSha256: outputSha256,
        sourceAudit,
        immutable: true,
      });
      continue;
    }
    const completedEvent = outputSha256 ? runtimeData.completedCampaignRejectEvents.get(outputSha256) : null;
    const base = {
      entryId: `media-manifest-rejected-${row.occurrenceId}`,
      batch: row.batch ?? null,
      scene: row.scene ?? null,
      observedAt: row.observedAtUtc ?? null,
      rawOutput: {
        path: row.canonicalPath ?? null,
        sha256: outputSha256,
        bytes: row.bytes ?? null,
        state: "preserved",
      },
      sourceAudit,
      immutable: true,
    };
    if (completedEvent) {
      exactPromptEntries.push({
        ...base,
        status: "completed-output-rejected-exact-runtime-prompt-recovered",
        prompt: promptRecord(completedEvent.revisedPrompt),
        terminalSourceAudit: {
          sourceKind: "codex-session-completed-image-generation-end",
          threadId: completedEvent.threadId,
          callId: completedEvent.callId,
          timestamp: completedEvent.timestamp,
          jsonlLine: completedEvent.line,
          outputSha256Matched: outputSha256,
        },
      });
    } else {
      unrecoverablePromptEvidence.push({
        ...base,
        status: "completed-output-rejected-prompt-unrecoverable",
        prompt: { text: null, sha256: null, fidelity: "not-recovered" },
      });
    }
  }
  return { exactPromptEntries, unrecoverablePromptEvidence, campaignAliases };
}

function activeCheckpointBinding() {
  const checkpointPath = path.join(root, ACTIVE_CHECKPOINT);
  const buffer = readFileSync(checkpointPath);
  const checkpoint = JSON.parse(buffer);
  const ledger = checkpoint.rejectedPromptLedger;
  if (!ledger?.entries?.length) throw new Error("Active Batch 382 rejectedPromptLedger is missing");
  return {
    path: ACTIVE_CHECKPOINT,
    fileSha256: sha256(buffer),
    ledgerSha256: sha256(JSON.stringify(ledger)),
    entryCount: ledger.entries.length,
    exactPromptShaPasses: ledger.entries.filter((entry) => sha256(entry.prompt?.text ?? "") === entry.prompt?.sha256).length,
    coverage: "All Batch 382 rejected, failed, and zero-byte occurrences remain canonical in the active checkpoint; this binding avoids duplicating their full text while retaining global audit coverage.",
  };
}

function activeCheckpointCompletedRejects(runtimeEntries) {
  const checkpoint = JSON.parse(readFileSync(path.join(root, ACTIVE_CHECKPOINT), "utf8"));
  const runtimeNormalized = new Set(runtimeEntries.map((entry) => entry.prompt.normalizedSha256));
  return checkpoint.rejectedPromptLedger.entries
    .filter((entry) => !runtimeNormalized.has(sha256(normalize(entry.prompt.text))))
    .map((entry) => ({
      ...entry,
      rawOutput: {
        ...entry.rawOutput,
        path: entry.rawOutput?.path?.replace(/^C:[/\\]Users[/\\]A[/\\]\.codex[/\\]generated_images[/\\]/i, ".codex/generated_images/") ?? entry.rawOutput?.path ?? null,
      },
      sourceAudit: {
        sourceKind: "active-batch-rejected-prompt-ledger",
        path: ACTIVE_CHECKPOINT,
        entryId: entry.entryId,
      },
    }));
}

function collectRecentCheckpointRejectedEvidence() {
  const bindings = [];
  const entries = [];
  for (const checkpointRelativePath of RECENT_CHECKPOINTS) {
    const checkpointPath = path.join(root, checkpointRelativePath);
    const checkpointBuffer = readFileSync(checkpointPath);
    const checkpoint = JSON.parse(checkpointBuffer);
    const rejectedLedger = checkpoint.rejectedPromptLedger;
    if (!rejectedLedger?.entries?.length) throw new Error(`Recent checkpoint rejectedPromptLedger is missing: ${checkpointRelativePath}`);
    const checkpointSha256 = sha256(checkpointBuffer);
    const ledgerSha256 = sha256(JSON.stringify(rejectedLedger));
    let exactPromptShaPasses = 0;
    for (const entry of rejectedLedger.entries) {
      if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) {
        throw new Error(`Recent checkpoint prompt SHA mismatch: ${checkpointRelativePath} ${entry.entryId}`);
      }
      exactPromptShaPasses += 1;
      const raw = entry.rawOutput ?? {};
      if (raw.state === "preserved") {
        const rawPath = path.join(root, raw.path);
        if (!existsSync(rawPath)) throw new Error(`Recent checkpoint raw is missing: ${entry.entryId}`);
        const rawBuffer = readFileSync(rawPath);
        if (sha256(rawBuffer) !== raw.sha256 || rawBuffer.length !== raw.bytes) {
          throw new Error(`Recent checkpoint raw provenance mismatch: ${entry.entryId}`);
        }
      } else if (raw.state === "no-bytes" && (raw.bytes !== 0 || raw.path !== null || raw.sha256 !== null)) {
        throw new Error(`Recent checkpoint no-byte provenance mismatch: ${entry.entryId}`);
      }
      entries.push({
        ...entry,
        sourceAudit: {
          sourceKind: "recent-checkpoint-rejected-prompt-ledger",
          path: checkpointRelativePath,
          checkpointSha256,
          ledgerSha256,
          entryId: entry.entryId,
        },
      });
    }
    bindings.push({
      path: checkpointRelativePath,
      batch: checkpoint.batch,
      country: checkpoint.country,
      checkpointSha256,
      ledgerSha256,
      entryCount: rejectedLedger.entries.length,
      exactPromptShaPasses,
    });
  }
  return {
    status: "recent-checkpoint-exact-prompt-and-raw-provenance-bound",
    note: "These immutable checkpoint entries retain exact launch text for completed, rejected, interrupted, and explicit no-byte occurrences. Cross-source appearances are evidence aliases and do not imply acceptance.",
    bindings,
    entryCount: entries.length,
    entries,
  };
}

function validateIntrinsic(ledger) {
  const errors = [];
  if (ledger?.schemaVersion !== 1 || ledger?.appendOnly !== true) errors.push("invalid ledger header");
  if (ledger?.runtimeFailures?.entryCount !== ledger?.runtimeFailures?.entries?.length) errors.push("runtime section count mismatch");
  if (ledger?.summary?.runtimeFailureOccurrenceCount !== ledger?.runtimeFailures?.entries?.length) errors.push("summary runtime count mismatch");
  const seen = new Set();
  for (const entry of ledger?.runtimeFailures?.entries ?? []) {
    if (seen.has(entry.entryId)) errors.push(`duplicate entryId ${entry.entryId}`);
    seen.add(entry.entryId);
    if (!entry.prompt?.text) errors.push(`missing prompt text ${entry.entryId}`);
    if (sha256(entry.prompt?.text ?? "") !== entry.prompt?.sha256) errors.push(`prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state !== "no-bytes" || entry.rawOutput?.bytes !== 0) errors.push(`invalid no-byte state ${entry.entryId}`);
    if (entry.sourceAudit?.terminalStatus !== "failed" || entry.sourceAudit?.resultWasEmpty !== true) errors.push(`invalid source evidence ${entry.entryId}`);
  }
  for (const entry of ledger?.historicalRepositoryEvidence?.exactPromptEntries ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`historical prompt SHA mismatch ${entry.entryId}`);
    const source = JSON.parse(readFileSync(path.join(root, entry.sourceAudit.path), "utf8"));
    const resolved = entry.sourceAudit.jsonPointer.slice(1).split("/").reduce((value, token) => value?.[token.replace(/~1/g, "/").replace(/~0/g, "~")], source);
    if (resolved === undefined || sha256(JSON.stringify(resolved)) !== entry.sourceAudit.sourceRecordSha256) errors.push(`historical source pointer mismatch ${entry.entryId}`);
  }
  for (const entry of ledger?.recoveredArchivedLaunchEvidence?.exactNoTerminalPromptEntries ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`recovered no-terminal prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state !== "no-bytes" || entry.rawOutput?.bytes !== 0) errors.push(`invalid recovered no-terminal state ${entry.entryId}`);
  }
  for (const entry of ledger?.recoveredHistoricalMissingText?.noTerminalPromptEntries ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`recovered historical no-terminal prompt SHA mismatch ${entry.entryId}`);
  }
  for (const entry of ledger?.recoveredHistoricalMissingText?.completedVisualRejects ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`recovered historical completed prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state !== "preserved-in-progress-archive") errors.push(`recovered historical output is not archived ${entry.entryId}`);
  }
  for (const entry of ledger?.campaignRepositoryEvidence?.recoveredCompletedAmbiguous ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`recovered completed prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state !== "preserved-in-progress-archive") errors.push(`recovered completed output is not archived ${entry.entryId}`);
  }
  for (const entry of ledger?.campaignRepositoryEvidence?.completedVisualRejects ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`campaign visual reject prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state !== "preserved-in-progress-archive") errors.push(`campaign visual reject output is not archived ${entry.entryId}`);
    if (entry.terminalSourceAudit?.outputSha256Matched !== entry.rawOutput?.sha256) errors.push(`campaign visual reject terminal/output mismatch ${entry.entryId}`);
  }
  for (const entry of ledger?.mediaManifestRejectedEvidence?.exactPromptEntries ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`manifest reject prompt SHA mismatch ${entry.entryId}`);
    if (entry.terminalSourceAudit?.outputSha256Matched !== entry.rawOutput?.sha256) errors.push(`manifest reject terminal/output mismatch ${entry.entryId}`);
  }
  if (ledger?.recentCheckpointRejectedEvidence?.entryCount !== ledger?.recentCheckpointRejectedEvidence?.entries?.length) errors.push("recent checkpoint section count mismatch");
  for (const entry of ledger?.recentCheckpointRejectedEvidence?.entries ?? []) {
    if (!entry.prompt?.text || sha256(entry.prompt.text) !== entry.prompt.sha256) errors.push(`recent checkpoint prompt SHA mismatch ${entry.entryId}`);
    if (entry.rawOutput?.state === "preserved") {
      const rawPath = path.join(root, entry.rawOutput.path);
      if (!existsSync(rawPath)) errors.push(`recent checkpoint raw missing ${entry.entryId}`);
      else {
        const rawBuffer = readFileSync(rawPath);
        if (sha256(rawBuffer) !== entry.rawOutput.sha256 || rawBuffer.length !== entry.rawOutput.bytes) errors.push(`recent checkpoint raw mismatch ${entry.entryId}`);
      }
    }
    if (entry.rawOutput?.state === "no-bytes" && (entry.rawOutput.bytes !== 0 || entry.rawOutput.path !== null || entry.rawOutput.sha256 !== null)) errors.push(`recent checkpoint invalid no-byte state ${entry.entryId}`);
  }
  for (const binding of ledger?.recentCheckpointRejectedEvidence?.bindings ?? []) {
    const buffer = readFileSync(path.join(root, binding.path));
    const checkpoint = JSON.parse(buffer);
    if (sha256(buffer) !== binding.checkpointSha256) errors.push(`recent checkpoint binding hash mismatch ${binding.path}`);
    if (sha256(JSON.stringify(checkpoint.rejectedPromptLedger)) !== binding.ledgerSha256) errors.push(`recent checkpoint ledger binding mismatch ${binding.path}`);
    if (binding.entryCount !== binding.exactPromptShaPasses) errors.push(`recent checkpoint prompt count mismatch ${binding.path}`);
  }
  if (ledger?.activeCheckpointBinding?.entryCount !== ledger?.activeCheckpointBinding?.exactPromptShaPasses) errors.push("active checkpoint prompt SHA failure");
  return errors;
}

function validateSources(ledger, expected) {
  const errors = validateIntrinsic(ledger);
  if (JSON.stringify(ledger) !== JSON.stringify(expected)) errors.push("ledger differs from complete local source reconstruction");
  return errors;
}

const ledgerPath = path.join(root, PROJECT_LEDGER);
if (verify) {
  const actual = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const errors = validateIntrinsic(actual);
  console.log(JSON.stringify({ mode: "verify", runtimeFailures: actual.runtimeFailures?.entries?.length ?? 0, promptRecords: actual.summary?.exactPromptRecordCountAcrossSectionsBeforeCrossSourceOccurrenceReconciliation ?? null, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
  process.exit();
}

const runtimeFailures = await collectRuntimeFailures();
const projectRuntimeEntries = runtimeFailures.entries.filter((entry) => isProjectPrompt(entry.prompt.text));
const nonProjectRuntimeEntries = runtimeFailures.entries.length - projectRuntimeEntries.length;
const historicalRepositoryEvidence = collectHistoricalRepositoryEvidence(runtimeFailures.entries);
const projectScopeEntries = runtimeFailures.entries;
const excludedUnrelatedEntries = 0;
const activeCheckpoint = activeCheckpointBinding();
const activeCheckpointCompleted = activeCheckpointCompletedRejects(projectScopeEntries);
const legacySourceBuffer = readFileSync(path.join(root, LEGACY_BLOCKLIST));
const recoveredArchivedLaunchEvidence = collectRecoveredNoTerminalPrompts(runtimeFailures, legacySourceBuffer);
const recoveredHistoricalMissingText = reconcileHistoricalMissingText(historicalRepositoryEvidence, runtimeFailures, recoveredArchivedLaunchEvidence);
const campaignRepositoryEvidence = collectCampaignVisualAndAmbiguousEvidence(runtimeFailures, recoveredArchivedLaunchEvidence);
const mediaManifestRejectedEvidence = collectMediaManifestRejectedEvidence(runtimeFailures, campaignRepositoryEvidence);
const recentCheckpointRejectedEvidence = collectRecentCheckpointRejectedEvidence();
if (!runtimeFailures.preflightPromptEvidence) throw new Error("Missing exact Batch 223 preflight prompt evidence");
const preflightPrompt = promptRecord(runtimeFailures.preflightPromptEvidence.prompt);
if (preflightPrompt.sha256 !== PREFLIGHT_FAILURES[0].promptSha256) throw new Error("Batch 223 preflight prompt SHA mismatch");
const preflightFailuresWithoutTerminalEvent = PREFLIGHT_FAILURES.map((entry) => ({
  ...entry,
  prompt: preflightPrompt,
  sourceAudit: { sourceKind: "codex-session-imagegen-preflight-call", threadId: runtimeFailures.preflightPromptEvidence.threadId, callId: entry.callId, timestamp: runtimeFailures.preflightPromptEvidence.timestamp, jsonlLine: runtimeFailures.preflightPromptEvidence.line, selector: "payload.arguments.prompt" },
  immutable: true,
}));
const contractSha256 = sha256(readFileSync(path.join(root, CONTRACT)));
const expected = {
  schemaVersion: 1,
  appendOnly: true,
  updatedAt: "2026-08-20T08:23:45.898Z",
  coverageStatus: "runtime-complete-for-locally-available-active-and-archived-codex-sessions-plus-deduplicated-pre-batch-220-repository-corpus-plus-bound-active-and-recent-checkpoints-and-reconciled-campaign-visual-rejects",
  policy: {
    oneEntryPerFailedRuntimeOccurrence: true,
    occurrenceKey: "The observation fingerprint is image_generation_end.call_id plus exact prompt SHA-256. Cross-thread fork copies sharing that pair are collapsed into one runtime occurrence; the earliest observation supplies canonical time/thread fields and every observed thread remains in observedIn.",
    exactRuntimePromptRequired: true,
    outputState: "A failed image_generation_end event with empty result is recorded as no-bytes. The terminal event alone does not prove moderation; failureCause remains honest unless separate provider evidence is joined.",
    activeCheckpointRemainsCanonical: true,
    appendOnlySemantics: "The committed ledger is an append-only public history. Local --apply rebuilds a deterministic snapshot from all available local sources and refuses to shrink an existing ledger; use --verify for intrinsic clone-safe checks and --verify-sources for full local-source reconciliation.",
    appendBeforeNextRenderOrAdvance: true,
  },
  sourceScan: {
    sessionRootPolicy: "Read every locally available Codex session JSONL below USERPROFILE/.codex/sessions and USERPROFILE/.codex/archived_sessions (or CODEX_SESSION_ROOT) and retain failed image_generation_end events.",
    sessionLineLimits: Object.fromEntries(SESSION_LINE_LIMITS),
    sessionLineLimitPolicy: "An optional per-thread limit may stop before later browser/image payload lines only when the retained prefix already covers that thread's Codex image-generation terminal events and later provider output is preserved through checked-in Meta checkpoints and the generated-media manifest.",
    physicalFailedEventsScanned: runtimeFailures.physicalFailedEvents,
    uniqueRuntimeFailureOccurrences: runtimeFailures.entries.length,
    projectMarkerMatchedOccurrences: projectRuntimeEntries.length,
    projectThreadOrMarkerMatchedOccurrences: runtimeFailures.entries.filter((entry) => isProjectPrompt(entry.prompt.text) || historicalThreadIds.has(entry.threadId)).length,
    excludedUnrelatedOccurrences: excludedUnrelatedEntries,
    note: "All failed image-generation prompts are retained, including unrelated image requests, because the public-build directive explicitly covers every Codex image/video output and rejected prompt. Marker counts are informational only and never filter the tracker.",
  },
  summary: {
    runtimeFailureOccurrenceCount: projectScopeEntries.length,
    runtimePromptShaPassCount: projectScopeEntries.length,
    noByteRuntimeOccurrenceCount: projectScopeEntries.length,
    physicalFailedEventsScanned: runtimeFailures.physicalFailedEvents,
    activeCheckpointBoundOccurrenceCount: activeCheckpoint.entryCount,
    activeCheckpointEntriesWithoutNormalizedFailedRuntimePromptMatchCount: activeCheckpointCompleted.length,
    exactPromptRecordCountAcrossSectionsBeforeCrossSourceOccurrenceReconciliation:
      projectScopeEntries.length
      + historicalRepositoryEvidence.exactPromptEntries.length
      + activeCheckpointCompleted.length
      + recoveredArchivedLaunchEvidence.exactNoTerminalPromptEntries.length
      + recoveredHistoricalMissingText.noTerminalPromptEntries.length
      + recoveredHistoricalMissingText.completedVisualRejects.length
      + campaignRepositoryEvidence.completedVisualRejects.length
      + campaignRepositoryEvidence.recoveredCompletedAmbiguous.length
      + mediaManifestRejectedEvidence.exactPromptEntries.length
      + preflightFailuresWithoutTerminalEvent.length
      + recentCheckpointRejectedEvidence.entries.length,
    historicalExactPromptOccurrenceCount: historicalRepositoryEvidence.exactPromptEntries.length,
    historicalCanonicalSourceAliasCount: historicalRepositoryEvidence.canonicalSourceAliases.length,
    knownTextMissingHistoricalEvidenceCount: historicalRepositoryEvidence.unrecoverablePromptEvidence.length,
    recoveredHistoricalMissingTextAliasCount: recoveredHistoricalMissingText.recoveredAliases.length,
    recoveredHistoricalMissingTextNoTerminalCount: recoveredHistoricalMissingText.noTerminalPromptEntries.length,
    recoveredHistoricalMissingTextCompletedRejectCount: recoveredHistoricalMissingText.completedVisualRejects.length,
    knownPreflightNoLaunchFailureCount: PREFLIGHT_FAILURES.length,
    campaignCompletedVisualRejectEvidenceCount: campaignRepositoryEvidence.completedVisualRejects.length,
    recoveredExactNoTerminalPromptCount: recoveredArchivedLaunchEvidence.exactNoTerminalPromptEntries.length,
    recoveredLaunchAliasCount: recoveredArchivedLaunchEvidence.runtimeAliases.length,
    campaignAmbiguousAliasCount: campaignRepositoryEvidence.ambiguousAttemptAliases.length,
    campaignRecoveredCompletedAmbiguousCount: campaignRepositoryEvidence.recoveredCompletedAmbiguous.length,
    mediaManifestRejectedExactPromptCount: mediaManifestRejectedEvidence.exactPromptEntries.length,
    mediaManifestRejectedPromptUnrecoverableCount: mediaManifestRejectedEvidence.unrecoverablePromptEvidence.length,
    mediaManifestCampaignAliasCount: mediaManifestRejectedEvidence.campaignAliases.length,
    recentCheckpointRejectedPromptCount: recentCheckpointRejectedEvidence.entries.length,
  },
  activeCheckpointBinding: activeCheckpoint,
  activeCheckpointCompletedRejects: {
    entryCount: activeCheckpointCompleted.length,
    note: "These Batch 382 rejected, failed, or zero-byte ledger entries have no exact normalized match to a failed runtime terminal event in the local session scan. They remain separate occurrences; aggregate/no-byte provenance stays as recorded by the active checkpoint.",
    entries: activeCheckpointCompleted,
  },
  runtimeFailures: {
    entryCount: projectScopeEntries.length,
    entries: projectScopeEntries,
  },
  historicalRepositoryEvidence: {
    status: "pre-batch-220-canonical-corpus-imported",
    rule: "Checked-in campaign/checkpoint evidence predating or missing from Codex session terminal events must be imported only after one underlying occurrence is reconciled. Compiled blocklist snapshots and repeated summaries are evidence aliases, never new occurrences.",
    exactPromptEntries: historicalRepositoryEvidence.exactPromptEntries,
    unrecoverablePromptEvidence: historicalRepositoryEvidence.unrecoverablePromptEvidence,
    canonicalSourceAliases: historicalRepositoryEvidence.canonicalSourceAliases,
  },
  preflightFailuresWithoutTerminalEvent,
  recoveredArchivedLaunchEvidence,
  recoveredHistoricalMissingText,
  campaignRepositoryEvidence,
  mediaManifestRejectedEvidence,
  recentCheckpointRejectedEvidence,
  contractSha256AtScan: contractSha256,
};

if (apply && existsSync(ledgerPath)) {
  const previous = JSON.parse(readFileSync(ledgerPath, "utf8"));
  if ((expected.runtimeFailures?.entries?.length ?? 0) < (previous.runtimeFailures?.entries?.length ?? 0)) throw new Error("Refusing to shrink append-only runtime history; restore missing session sources or use intrinsic --verify");
  const priorIds = new Set((previous.runtimeFailures?.entries ?? []).map((entry) => entry.entryId));
  const nextIds = new Set((expected.runtimeFailures?.entries ?? []).map((entry) => entry.entryId));
  const missingIds = [...priorIds].filter((entryId) => !nextIds.has(entryId));
  if (missingIds.length) throw new Error(`Refusing to remove ${missingIds.length} append-only runtime entries`);
  const priorRecentIds = new Set((previous.recentCheckpointRejectedEvidence?.entries ?? []).map((entry) => entry.entryId));
  const nextRecentIds = new Set((expected.recentCheckpointRejectedEvidence?.entries ?? []).map((entry) => entry.entryId));
  const missingRecentIds = [...priorRecentIds].filter((entryId) => !nextRecentIds.has(entryId));
  if (missingRecentIds.length) throw new Error(`Refusing to remove ${missingRecentIds.length} append-only recent-checkpoint entries`);
}
if (apply) writeFileSync(ledgerPath, `${JSON.stringify(expected, null, 2)}\n`, "utf8");
const actual = JSON.parse(readFileSync(ledgerPath, "utf8"));
const projectRuntimeFailures = { entries: projectScopeEntries, physicalFailedEvents: runtimeFailures.physicalFailedEvents };
const errors = validateSources(actual, expected);
console.log(JSON.stringify({
  mode: apply ? "apply" : "verify-sources",
  physicalFailedEventsScanned: runtimeFailures.physicalFailedEvents,
  uniqueRuntimeFailureOccurrences: projectScopeEntries.length,
  uniqueRuntimeFailuresAcrossAllLocalProjects: runtimeFailures.entries.length,
  projectMarkerMatchedOccurrences: projectRuntimeEntries.length,
  excludedUnrelatedOccurrences: excludedUnrelatedEntries,
  activeCheckpointBoundOccurrences: activeCheckpoint.entryCount,
  activeCheckpointEntriesWithoutNormalizedFailedRuntimePromptMatch: activeCheckpointCompleted.length,
  historicalExactPromptOccurrences: historicalRepositoryEvidence.exactPromptEntries.length,
  historicalMissingTextTombstones: historicalRepositoryEvidence.unrecoverablePromptEvidence.length,
  preflightFailuresWithoutTerminalEvent: PREFLIGHT_FAILURES.length,
  recoveredExactNoTerminalPrompts: recoveredArchivedLaunchEvidence.exactNoTerminalPromptEntries.length,
  recoveredLaunchAliases: recoveredArchivedLaunchEvidence.runtimeAliases.length,
  recoveredHistoricalMissingTextAliases: recoveredHistoricalMissingText.recoveredAliases.length,
  recoveredHistoricalMissingTextNoTerminalPrompts: recoveredHistoricalMissingText.noTerminalPromptEntries.length,
  recoveredHistoricalMissingTextCompletedRejects: recoveredHistoricalMissingText.completedVisualRejects.length,
  campaignCompletedVisualRejectEvidence: campaignRepositoryEvidence.completedVisualRejects.length,
  campaignAmbiguousAliases: campaignRepositoryEvidence.ambiguousAttemptAliases.length,
  campaignRecoveredCompletedAmbiguous: campaignRepositoryEvidence.recoveredCompletedAmbiguous.length,
  mediaManifestRejectedExactPrompts: mediaManifestRejectedEvidence.exactPromptEntries.length,
  mediaManifestRejectedUnrecoverablePrompts: mediaManifestRejectedEvidence.unrecoverablePromptEvidence.length,
  mediaManifestCampaignAliases: mediaManifestRejectedEvidence.campaignAliases.length,
  recentCheckpointRejectedPrompts: recentCheckpointRejectedEvidence.entries.length,
  promptShaPasses: actual.runtimeFailures?.entries?.filter((entry) => sha256(entry.prompt?.text ?? "") === entry.prompt?.sha256).length ?? 0,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
