import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import ts from "typescript";

const scriptPath = fileURLToPath(import.meta.url);
const defaultSiteRoot = resolve(dirname(scriptPath), "..");
const defaultActiveAuditReport = "public/audits/localization-qa-20260803/report.json";

const jsExtensions = new Set([".js", ".mjs", ".cjs"]);
const tsExtensions = new Set([".ts", ".tsx"]);
const jsonExtensions = new Set([".json", ".webmanifest"]);
const markupExtensions = new Set([".html", ".htm", ".svg", ".xml"]);
const lineTextExtensions = new Set([".css", ".md", ".txt"]);
const sourceExtensions = new Set([
  ...jsExtensions, ...tsExtensions, ...jsonExtensions, ...markupExtensions, ...lineTextExtensions,
]);
const buildExtensions = new Set([
  ...jsExtensions, ...jsonExtensions, ...markupExtensions, ...lineTextExtensions,
]);
const publicRuntimeExtensions = new Set([".svg", ".html", ".htm", ".xml", ".txt", ".webmanifest"]);

const targetLanguageRules = [
  { label: "Turkish-specific letters", pattern: /[\u011e\u011f\u0130\u0131\u015e\u015f]/u },
  {
    label: "target-language script",
    pattern: /[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Georgian}\p{Script=Thai}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  },
  {
    label: "quarantined Turkish vocabulary",
    pattern: /\b(?:t[uü]rk[cç]e|hay[iı]r|ana\s+a[gğ]|lansman|c[uü]zdan|operatör|g[oö]rev|kan[iı]t|yay[iı]nlanmam[iı][sş]|t[oö]ren|haz[iı]rl[iı]k|otomatik\s+i[sş]lemler)\b/iu,
  },
  {
    label: "quarantined Spanish vocabulary",
    pattern: /\b(?:no\s+hay|lanzamiento|red\s+principal|no\s+publicado|transacciones?\s+autom[aá]ticas?|billetera|hora\s+de\s+la\s+ceremonia)\b/iu,
  },
  {
    label: "encoding-corrupted text",
    pattern: /(?:Ã[\u0080-\u024F\u2000-\u206F]|Â[\u0080-\u024F]|â(?:€|„|†|œ|˜|Œ|ˆ|‰|™)|ï¿½|\uFFFD)/u,
  },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizeDisplayValue = (value) => value.normalize("NFC").replace(/[\u202A-\u202E\u2066-\u2069]/gu, "");

function keyName(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  return null;
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (["parent", "loc", "start", "end"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, visitor));
    else if (value && typeof value === "object") walk(value, visitor);
  }
}

function nodeStaticStrings(node) {
  const values = [];
  function visit(candidate, parent = null, parentKey = null) {
    if (!candidate || typeof candidate !== "object") return;
    if (candidate.type === "Literal" && typeof candidate.value === "string") {
      const isStaticPropertyKey = parent?.type === "Property" && parentKey === "key" && !parent.computed;
      if (!isStaticPropertyKey) values.push(candidate.value);
    } else if (candidate.type === "TemplateElement") {
      values.push(candidate.value?.cooked ?? candidate.value?.raw ?? "");
    }
    for (const [key, value] of Object.entries(candidate)) {
      if (["parent", "loc", "start", "end"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((entry) => visit(entry, candidate, key));
      else if (value && typeof value === "object") visit(value, candidate, key);
    }
  }
  visit(node);
  return values;
}

function isLocaleReference(node) {
  if (!node || typeof node !== "object") return false;
  if (node.type === "Identifier") return /(?:locale|language|lang)/iu.test(node.name);
  if (node.type === "MemberExpression") {
    return isLocaleReference(node.object) || /(?:locale|language|lang)/iu.test(keyName(node.property) ?? "");
  }
  if (node.type === "CallExpression") return isLocaleReference(node.callee);
  if (node.type === "ChainExpression") return isLocaleReference(node.expression);
  return false;
}

function localeCodesInSelector(node, localeCodes) {
  const found = new Set();
  walk(node, (candidate) => {
    if (candidate.type === "BinaryExpression" && ["==", "===", "!=", "!=="].includes(candidate.operator)) {
      const left = candidate.left?.type === "Literal" && typeof candidate.left.value === "string"
        ? candidate.left.value.toLowerCase() : null;
      const right = candidate.right?.type === "Literal" && typeof candidate.right.value === "string"
        ? candidate.right.value.toLowerCase() : null;
      if (left && localeCodes.has(left) && isLocaleReference(candidate.right)) found.add(left);
      if (right && localeCodes.has(right) && isLocaleReference(candidate.left)) found.add(right);
    }
    if (
      candidate.type === "CallExpression"
      && candidate.callee?.type === "MemberExpression"
      && keyName(candidate.callee.property) === "includes"
      && candidate.callee.object?.type === "ArrayExpression"
      && candidate.arguments.some(isLocaleReference)
    ) {
      for (const element of candidate.callee.object.elements) {
        if (element?.type !== "Literal" || typeof element.value !== "string") continue;
        const code = element.value.toLowerCase();
        if (localeCodes.has(code)) found.add(code);
      }
    }
  });
  return found;
}

function isLikelyCopyValue(value, localeCodes) {
  const text = value.trim();
  if (!text || localeCodes.has(text.toLowerCase())) return false;
  if (/^(?:[./#?]|https?:|data:|mailto:)/iu.test(text)) return false;
  if (/^[a-z]{2,3}(?:-[a-z]{2,8})?$/iu.test(text)) return false;
  // Content digests are locale-indexed integrity metadata, never display copy.
  if (/^[a-f0-9]{64}$/iu.test(text)) return false;
  if (/^[A-Z][A-Z0-9_:.\-/]*$/u.test(text)) return false;
  if (!/[\p{L}]/u.test(text)) return false;
  return /\s/u.test(text) || text.length >= 4;
}

function copyValuesForNode(node, localeCodes) {
  return nodeStaticStrings(node).filter((value) => isLikelyCopyValue(value, localeCodes));
}

function allValuesReviewed(values, reviewedValues) {
  return values.length > 0 && values.every((value) => reviewedValues.has(normalizeDisplayValue(value)));
}

function valuesMatchCanonicalFallback(values, canonicalValues) {
  return values.length > 0
    && values.length === canonicalValues.length
    && values.every((value, index) => normalizeDisplayValue(value) === normalizeDisplayValue(canonicalValues[index]));
}

function locationSuffix(node) {
  return node?.loc?.start?.line ? `:${node.loc.start.line}:${node.loc.start.column + 1}` : "";
}

function branchViolations(ast, { label, localeCodes, reviewedValues }) {
  const violations = [];
  const record = (node, codes, values, kind) => {
    if (values.length === 0 || allValuesReviewed(values, reviewedValues)) return;
    const preview = values.find((value) => !reviewedValues.has(normalizeDisplayValue(value))) ?? values[0];
    violations.push(
      `${label}${locationSuffix(node)}: unreviewed locale copy ${kind} for ${[...codes].sort().join(",")}`
      + ` (${JSON.stringify(preview.slice(0, 100))})`,
    );
  };

  walk(ast, (node) => {
    if (node.type === "ObjectExpression") {
      const englishProperty = node.properties.find((property) => (
        property.type === "Property"
        && property.kind === "init"
        && !property.computed
        && (keyName(property.key) ?? "").toLowerCase() === "en"
      ));
      const canonicalFallbackValues = englishProperty
        ? copyValuesForNode(englishProperty.value, localeCodes)
        : [];
      const localeProperties = node.properties.filter((property) => {
        if (property.type !== "Property" || property.kind !== "init" || property.computed) return false;
        const code = (keyName(property.key) ?? "").toLowerCase();
        return code !== "en" && localeCodes.has(code);
      });
      const ambiguousIdentifierCodes = new Set(["be", "id", "is", "it", "no"]);
      for (const property of localeProperties) {
        const code = keyName(property.key).toLowerCase();
        if (property.key.type !== "Literal" && ambiguousIdentifierCodes.has(code) && localeProperties.length < 2) continue;
        const values = copyValuesForNode(property.value, localeCodes);
        if (valuesMatchCanonicalFallback(values, canonicalFallbackValues)) continue;
        record(property, new Set([code]), values, "object branch");
      }
      return;
    }

    if (node.type === "ConditionalExpression" || node.type === "LogicalExpression") {
      const selector = node.type === "ConditionalExpression" ? node.test : node.left;
      const codes = new Set([...localeCodesInSelector(selector, localeCodes)].filter((code) => code !== "en"));
      if (codes.size === 0) return;
      const copyNode = node.type === "ConditionalExpression"
        ? { type: "Synthetic", consequent: node.consequent, alternate: node.alternate }
        : node.right;
      record(node, codes, copyValuesForNode(copyNode, localeCodes), "conditional branch");
      return;
    }

    if (node.type === "IfStatement") {
      const codes = new Set([...localeCodesInSelector(node.test, localeCodes)].filter((code) => code !== "en"));
      if (codes.size === 0) return;
      record(
        node,
        codes,
        copyValuesForNode({ type: "Synthetic", consequent: node.consequent, alternate: node.alternate }, localeCodes),
        "if branch",
      );
      return;
    }

    if (node.type === "SwitchStatement" && isLocaleReference(node.discriminant)) {
      for (const switchCase of node.cases) {
        const code = switchCase.test?.type === "Literal" && typeof switchCase.test.value === "string"
          ? switchCase.test.value.toLowerCase() : null;
        if (!code || code === "en" || !localeCodes.has(code)) continue;
        record(switchCase, new Set([code]), copyValuesForNode(switchCase, localeCodes), "switch branch");
      }
    }
  });
  return violations;
}

export function deriveReviewedValueExceptions(policy) {
  const reviewedValues = new Set();
  const reviews = Array.isArray(policy?.reviews) ? policy.reviews : [];
  for (const [locale, translations] of Object.entries(policy?.translations ?? {})) {
    if (!["PARTIAL_REVIEW", "REVIEWED"].includes(policy?.localeStatus?.[locale])) continue;
    for (const [source, value] of Object.entries(translations ?? {})) {
      if (typeof value !== "string") continue;
      const normalized = normalizeDisplayValue(value);
      const review = reviews.find((candidate) => candidate?.locale === locale && candidate?.source === source);
      if (
        review?.status !== "APPROVED"
        || review.machineGenerated !== false
        || review.origin !== "HUMAN_AUTHORED_OR_CORRECTED"
        || review.sourceSha256 !== sha256(source)
        || review.translationSha256 !== sha256(normalized)
      ) continue;
      reviewedValues.add(normalized);
    }
  }
  return reviewedValues;
}

export function scanDisplayValue(value, { label = "value", reviewedValues = new Set() } = {}) {
  if (typeof value !== "string") return [];
  const normalized = normalizeDisplayValue(value);
  if (!normalized.trim() || reviewedValues.has(normalized)) return [];
  return targetLanguageRules.flatMap((rule) => {
    const match = normalized.match(rule.pattern);
    return match ? [`${label}: ${rule.label} (${JSON.stringify(match[0])})`] : [];
  });
}

function parseJavaScript(text, label) {
  const options = { ecmaVersion: "latest", locations: true, allowAwaitOutsideFunction: true, allowHashBang: true };
  try {
    return parse(text, { ...options, sourceType: "module" });
  } catch (moduleError) {
    try {
      return parse(text, { ...options, sourceType: "script", allowReturnOutsideFunction: true });
    } catch (scriptError) {
      throw new Error(`${label}: JavaScript parse failure (${scriptError.message}; module parse: ${moduleError.message})`);
    }
  }
}

export function scanJavaScriptText({
  text,
  label = "javascript",
  localeCodes,
  reviewedValues = new Set(),
  typescript = false,
  jsx = false,
}) {
  const javascript = typescript || jsx
    ? ts.transpileModule(text, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        verbatimModuleSyntax: true,
      },
      fileName: jsx ? `${label}.tsx` : `${label}.ts`,
      reportDiagnostics: false,
    }).outputText
    : text;
  let ast;
  try {
    ast = parseJavaScript(javascript, label);
  } catch (error) {
    return [error.message];
  }
  const codes = localeCodes instanceof Set ? localeCodes : new Set(localeCodes ?? []);
  const violations = [];
  walk(ast, (node) => {
    if (node.type === "Literal" && typeof node.value === "string") {
      violations.push(...scanDisplayValue(node.value, {
        label: `${label}${locationSuffix(node)}`,
        reviewedValues,
      }));
    } else if (node.type === "TemplateElement") {
      violations.push(...scanDisplayValue(node.value?.cooked ?? node.value?.raw ?? "", {
        label: `${label}${locationSuffix(node)}`,
        reviewedValues,
      }));
    }
  });
  violations.push(...branchViolations(ast, { label, localeCodes: codes, reviewedValues }));
  return [...new Set(violations)];
}

function scanJsonValue(value, context, path = "$") {
  if (typeof value === "string") {
    return scanDisplayValue(value, { ...context, label: `${context.label}:${path}` });
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => scanJsonValue(entry, context, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  const violations = [];
  for (const [key, entry] of Object.entries(value)) {
    if (context.detectLocaleBranches && context.localeCodes.has(key.toLowerCase()) && key.toLowerCase() !== "en") {
      const values = [];
      const gather = (candidate) => {
        if (typeof candidate === "string") values.push(candidate);
        else if (Array.isArray(candidate)) candidate.forEach(gather);
        else if (candidate && typeof candidate === "object") Object.values(candidate).forEach(gather);
      };
      gather(entry);
      const copyValues = values.filter((candidate) => isLikelyCopyValue(candidate, context.localeCodes));
      if (copyValues.length > 0 && !allValuesReviewed(copyValues, context.reviewedValues)) {
        violations.push(`${context.label}:${path}.${key}: unreviewed locale copy object branch for ${key}`);
      }
    }
    violations.push(...scanJsonValue(entry, context, `${path}.${key}`));
  }
  return violations;
}

function markupValues(text) {
  const values = [];
  for (const match of text.matchAll(/(?:^|\s)[\w:-]+\s*=\s*(["'])([\s\S]*?)\1/gu)) values.push(match[2]);
  for (const match of text.matchAll(/>([^<]+)</gu)) values.push(match[1]);
  return values;
}

function lineTextValues(text) {
  return text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

async function scanFile(path, { label, localeCodes, reviewedValues, detectLocaleBranches = false }) {
  const extension = extname(path).toLowerCase();
  const text = await readFile(path, "utf8");
  if (jsExtensions.has(extension)) return scanJavaScriptText({ text, label, localeCodes, reviewedValues });
  if (tsExtensions.has(extension)) {
    return scanJavaScriptText({
      text, label, localeCodes, reviewedValues, typescript: true, jsx: extension === ".tsx",
    });
  }
  if (jsonExtensions.has(extension)) {
    try {
      return [...new Set(scanJsonValue(JSON.parse(text), {
        label, localeCodes, reviewedValues, detectLocaleBranches,
      }))];
    } catch (error) {
      return [`${label}: JSON parse failure (${error.message})`];
    }
  }
  const values = markupExtensions.has(extension) ? markupValues(text) : lineTextValues(text);
  return [...new Set(values.flatMap((value, index) => scanDisplayValue(value, {
    label: `${label}:text-${index + 1}`,
    reviewedValues,
  })))];
}

async function filesUnder(root, extensions, { skipDirectories = new Set() } = {}) {
  if (!existsSync(root)) return [];
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) await visit(path);
      } else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) files.push(path);
    }
  }
  await visit(root);
  return files.sort();
}

function checkedPublicPath(siteRoot, path) {
  if (typeof path !== "string" || isAbsolute(path)) return null;
  const normalized = path.replaceAll("\\", "/");
  if (!normalized.startsWith("public/")) return null;
  const absolute = resolve(siteRoot, normalized);
  const fromRoot = relative(siteRoot, absolute);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  return absolute;
}

async function activePublicArtifactPaths(siteRoot, policy) {
  const configured = policy?.bundleQuarantine?.activePublicArtifacts ?? policy?.activePublicArtifacts;
  const selected = new Set(Array.isArray(configured) ? configured : []);
  if (selected.size === 0) {
    const reportPath = checkedPublicPath(siteRoot, defaultActiveAuditReport);
    if (reportPath && existsSync(reportPath)) {
      selected.add(defaultActiveAuditReport);
      try {
        const report = JSON.parse(await readFile(reportPath, "utf8"));
        Object.keys(report?.files ?? {}).filter((path) => path.startsWith("public/")).forEach((path) => selected.add(path));
      } catch {
        // The invalid report itself is selected and will fail JSON parsing below.
      }
    }
  }
  return [...selected].map((path) => {
    const checked = checkedPublicPath(siteRoot, path);
    if (!checked) throw new Error(`Invalid policy-selected public quarantine artifact: ${JSON.stringify(path)}`);
    return checked;
  });
}

function relativeLabel(siteRoot, path, prefix) {
  return `${prefix}:${relative(siteRoot, path).replaceAll("\\", "/")}`;
}

export async function runBundleQuarantine({ siteRoot = defaultSiteRoot } = {}) {
  const policy = JSON.parse(await readFile(resolve(siteRoot, "app/i18n/reviewed-localization-policy.json"), "utf8"));
  if (
    policy.schema !== "iat-reviewed-localization-policy/v1"
    || policy.mode !== "GLOBAL_FAIL_CLOSED"
    || policy.machineDraftRuntimeAllowed !== false
    || policy.unreviewedTargetLanguageBundleAllowed !== false
    || policy.unreviewedLocaleAutonymsAllowed !== false
    || policy.directComponentReviewBundleComplete !== false
  ) throw new Error("Reviewed-localization policy does not fail closed for production bundles and locale labels");

  const localeCodes = new Set(Object.keys(policy.localeStatus ?? {}).map((code) => code.toLowerCase()));
  if (localeCodes.size !== 50 || !localeCodes.has("en") || policy.localeStatus?.en !== "SOURCE") {
    throw new Error("Reviewed-localization policy must define the exact 50-locale roster with English as SOURCE");
  }
  const reviewedValues = deriveReviewedValueExceptions(policy);
  const catalog = JSON.parse(await readFile(resolve(siteRoot, "app/i18n/messages.json"), "utf8"));
  const quarantinedJson = new Set(
    (catalog.meta?.quarantinedDirectComponentSourceFiles ?? []).map((path) => resolve(siteRoot, path)),
  );
  const appRoot = resolve(siteRoot, "app");
  const workerPath = resolve(siteRoot, "worker/index.ts");
  const clientRoot = resolve(siteRoot, "dist/client");
  const serverRoot = resolve(siteRoot, "dist/server");
  const publicRoot = resolve(siteRoot, "public");
  const files = [
    ...(await filesUnder(appRoot, sourceExtensions)).map((path) => ({
      path,
      label: relativeLabel(siteRoot, path, "source"),
      detectLocaleBranches: extname(path).toLowerCase() !== ".json" || quarantinedJson.has(path),
    })),
    ...(existsSync(workerPath) ? [{ path: workerPath, label: relativeLabel(siteRoot, workerPath, "worker"), detectLocaleBranches: true }] : []),
    ...(await filesUnder(clientRoot, buildExtensions)).map((path) => ({ path, label: relativeLabel(siteRoot, path, "client") })),
    ...(await filesUnder(serverRoot, buildExtensions)).map((path) => ({ path, label: relativeLabel(siteRoot, path, "server") })),
    ...(await filesUnder(publicRoot, publicRuntimeExtensions, {
      skipDirectories: new Set(["audits", "evidence", "i18n-v2"]),
    })).map((path) => ({ path, label: relativeLabel(siteRoot, path, "public-runtime") })),
    ...(await activePublicArtifactPaths(siteRoot, policy)).map((path) => ({ path, label: relativeLabel(siteRoot, path, "active-public-audit") })),
  ];

  const violations = [];
  const seenPaths = new Set();
  for (const file of files) {
    if (seenPaths.has(file.path)) continue;
    seenPaths.add(file.path);
    if (!existsSync(file.path)) {
      violations.push(`${file.label}: selected active artifact is missing`);
      continue;
    }
    violations.push(...await scanFile(file.path, { ...file, localeCodes, reviewedValues }));
  }
  return {
    violations: [...new Set(violations)],
    scannedFiles: seenPaths.size,
    reviewedExceptionCount: reviewedValues.size,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await runBundleQuarantine();
  if (result.violations.length > 0) {
    const displayed = result.violations.slice(0, 200);
    const omitted = result.violations.length - displayed.length;
    throw new Error(
      `Unreviewed target-language copy escaped quarantine (${result.violations.length} violation(s)):\n`
      + displayed.join("\n")
      + (omitted > 0 ? `\n... ${omitted} additional violation(s) omitted` : ""),
    );
  }
  console.log(
    `i18n bundle quarantine PASS: ${result.scannedFiles} production source/build/public files; `
    + `${result.reviewedExceptionCount} exact evidence-bound reviewed exception(s).`,
  );
}
