"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { htmlLanguageTag, localePath, locales, runtimeContentLocale, type LocaleCode } from "./config";
import { localePayloadContract, localePayloadPath } from "./payload-contract";

export type LocaleCatalog = Record<string, string>;
export type PromptCopy = { eyebrow: string; title: string; body: string; stay: string; english: string; close: string; timeout: string };
type LocalePayload = {
  schema: string;
  catalogSha256: string;
  sourceCount: number;
  locale: LocaleCode;
  sourceKeysSha256: string;
  contentSha256: string;
  messages: LocaleCatalog;
};

const translatableAttributes = ["alt", "aria-label", "placeholder", "title"] as const;
const legacyLanguageLabels = new Set(["TR", "EN", "ENGLISH"]);
const hydrationQuietWindowMs = 100;
const payloadFields = ["catalogSha256", "contentSha256", "locale", "messages", "schema", "sourceCount", "sourceKeysSha256"].sort();

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyLocalePayloadIntegrity(payload: LocalePayload, locale: LocaleCode): Promise<LocaleCatalog> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Locale payload is not an object");
  if (JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(payloadFields)) {
    throw new Error("Locale payload fields mismatch");
  }
  if (!payload.messages || typeof payload.messages !== "object" || Array.isArray(payload.messages)) {
    throw new Error("Locale payload messages are invalid");
  }
  if (payload.locale !== locale) throw new Error("Locale payload mismatch");
  const sourceKeys = Object.keys(payload.messages);
  if (
    payload.schema !== localePayloadContract.schema
    || payload.catalogSha256 !== localePayloadContract.catalogSha256
    || payload.sourceCount !== localePayloadContract.sourceCount
    || sourceKeys.length !== localePayloadContract.sourceCount
    || payload.sourceKeysSha256 !== localePayloadContract.sourceKeysSha256
  ) throw new Error("Locale payload contract mismatch");

  const computedSourceKeysSha256 = await sha256Hex(JSON.stringify(sourceKeys));
  if (computedSourceKeysSha256 !== payload.sourceKeysSha256) throw new Error("Locale payload source-key digest mismatch");
  const computedContentSha256 = await sha256Hex(JSON.stringify({
    schema: payload.schema,
    catalogSha256: payload.catalogSha256,
    sourceCount: payload.sourceCount,
    locale: payload.locale,
    sourceKeysSha256: payload.sourceKeysSha256,
    messages: payload.messages,
  }));
  const expectedContentSha256 = localePayloadContract.localeContentSha256[locale];
  if (payload.contentSha256 !== expectedContentSha256 || computedContentSha256 !== expectedContentSha256) {
    throw new Error("Locale payload content digest mismatch");
  }
  return payload.messages;
}

function translate(catalog: LocaleCatalog, locale: LocaleCode, source: string): string {
  if (locale === "en") return source;
  return catalog[source] ?? source;
}

function translateTextNode(node: Text, locale: LocaleCode, catalog: LocaleCatalog, localizedTextValues: WeakMap<Text, string>) {
  if (node.parentElement?.closest("script, style, code, pre, [data-no-translate]")) return;
  const value = node.nodeValue ?? "";
  if (localizedTextValues.get(node) === value) return;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const source = value.trim().replace(/\s+/g, " ");
  if (!source) return;
  const localized = translate(catalog, locale, source);
  if (localized !== source) node.nodeValue = `${leading}${localized}${trailing}`;
  localizedTextValues.set(node, node.nodeValue ?? "");
}

function shouldLocalizeHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (href.startsWith("/_") || href.startsWith("/api/") || href.startsWith("/disclosures/")) return false;
  if (/\.[a-z0-9]{2,5}(?:[?#]|$)/i.test(href)) return false;
  return true;
}

function localizeElement(element: Element, locale: LocaleCode, catalog: LocaleCatalog, routeLocale: LocaleCode) {
  if (element.closest("script, style, code, pre, [data-no-translate]")) return;

  for (const attribute of translatableAttributes) {
    const source = element.getAttribute(attribute)?.trim().replace(/\s+/g, " ");
    if (!source) continue;
    const localized = translate(catalog, locale, source);
    if (localized !== source) element.setAttribute(attribute, localized);
  }

  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href");
    if (href && shouldLocalizeHref(href)) element.setAttribute("href", localePath(routeLocale, href));
  }

  if (element instanceof HTMLButtonElement && legacyLanguageLabels.has(element.textContent?.trim().toUpperCase() ?? "")) {
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
    element.tabIndex = -1;
  }
}

function localizeTree(
  root: Node,
  locale: LocaleCode,
  catalog: LocaleCatalog,
  routeLocale: LocaleCode,
  localizedTextValues: WeakMap<Text, string>,
) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale, catalog, localizedTextValues);
    return;
  }
  if (!(root instanceof Element || root instanceof Document)) return;
  if (root instanceof Element) localizeElement(root, locale, catalog, routeLocale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, locale, catalog, localizedTextValues);
    else localizeElement(current as Element, locale, catalog, routeLocale);
    current = walker.nextNode();
  }
}

function returnToEnglish() {
  document.cookie = "ia_language=en; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
  const destination = localePath("en", window.location.pathname);
  const host = window.location.hostname.includes("ileriakil") ? "https://internalagency.io" : "";
  window.location.assign(`${host}${destination}${window.location.search}${window.location.hash}`);
}

function switchLocale(locale: LocaleCode) {
  document.cookie = `ia_language=${locale}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
}

function reviewedLocaleLabel(entry: { code: LocaleCode; name: string; nativeName: string }) {
  return runtimeContentLocale(entry.code) === entry.code
    ? entry.nativeName
    : `${entry.name} (${entry.code.toUpperCase()})`;
}

export function LocaleRuntime({ locale, contentLocale, promptCopy, publicPath, turkishHost }: { locale: LocaleCode; contentLocale: LocaleCode; promptCopy: PromptCopy; publicPath: string; turkishHost: boolean }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const definition = useMemo(() => locales.find((entry) => entry.code === locale) ?? locales[0], [locale]);
  const contentDefinition = useMemo(() => locales.find((entry) => entry.code === contentLocale) ?? locales[0], [contentLocale]);
  useLayoutEffect(() => {
    document.documentElement.dataset.localeReady = "false";
    document.documentElement.lang = htmlLanguageTag(contentLocale);
    document.documentElement.dir = contentDefinition.dir;
    let active = true;
    let observer: MutationObserver | null = null;
    let readinessTimer: number | null = null;
    const localizedTextValues = new WeakMap<Text, string>();
    const routeLocale: LocaleCode = turkishHost && locale === "tr" ? "en" : locale;

    const armReadiness = () => {
      if (document.documentElement.dataset.localeReady === "true") return;
      document.documentElement.dataset.localeReady = "false";
      if (readinessTimer !== null) window.clearTimeout(readinessTimer);
      readinessTimer = window.setTimeout(() => {
        readinessTimer = null;
        if (!active) return;
        document.documentElement.dataset.localeReady = "true";
        delete document.documentElement.dataset.localeError;
      }, hydrationQuietWindowMs);
    };

    const activate = (catalog: LocaleCatalog) => {
      if (!active) return;
      observer = new MutationObserver((changes) => {
        for (const change of changes) {
          for (const node of change.addedNodes) localizeTree(node, contentLocale, catalog, routeLocale, localizedTextValues);
          if (change.type === "characterData") localizeTree(change.target, contentLocale, catalog, routeLocale, localizedTextValues);
        }
        armReadiness();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      localizeTree(document.body, contentLocale, catalog, routeLocale, localizedTextValues);
      armReadiness();
    };

    if (contentLocale === "en") activate({});
    else {
      fetch(localePayloadPath(locale), { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Locale payload failed: ${response.status}`);
          return response.json() as Promise<LocalePayload>;
        })
        .then(async (payload) => {
          const messages = await verifyLocalePayloadIntegrity(payload, locale);
          activate(messages);
        })
        .catch(() => {
          if (active) document.documentElement.dataset.localeError = "payload-contract-failed";
        });
    }

    return () => {
      active = false;
      if (readinessTimer !== null) window.clearTimeout(readinessTimer);
      observer?.disconnect();
    };
  }, [contentDefinition.dir, contentLocale, locale, turkishHost]);

  useEffect(() => {
    if (locale === "en" || sessionStorage.getItem("ia-language-prompt-seen") === locale) return;
    sessionStorage.setItem("ia-language-prompt-seen", locale);
    setShowPrompt(true);
    const timer = window.setTimeout(() => setShowPrompt(false), 15_000);
    return () => window.clearTimeout(timer);
  }, [locale]);

  return (
    <>
      {showPrompt && (
        <aside className="locale-prompt" role="dialog" aria-live="polite" aria-label={promptCopy.title}>
          <button className="locale-prompt-close" onClick={() => setShowPrompt(false)} aria-label={promptCopy.close}>×</button>
          <p>{promptCopy.eyebrow}</p>
          <h2>{promptCopy.title}</h2>
          <span>{promptCopy.body}</span>
          <div>
            <button onClick={() => setShowPrompt(false)}>{promptCopy.stay}</button>
            <button onClick={returnToEnglish}>{promptCopy.english}</button>
          </div>
          <small>{promptCopy.timeout}</small>
        </aside>
      )}

      <div className="locale-switcher" data-no-translate>
        <button
          type="button"
          aria-expanded={showMenu}
          aria-controls="locale-menu"
          onClick={() => setShowMenu((open) => !open)}
        >
          {reviewedLocaleLabel(definition)}
          {contentLocale === locale ? null : ` · ${promptCopy.title}`} <span aria-hidden="true">⌄</span>
        </button>
          <div id="locale-menu" role="menu" hidden={!showMenu} aria-hidden={!showMenu}>
            {locales.map((entry) => {
              const path = turkishHost && entry.code === "tr" ? localePath("en", publicPath) : localePath(entry.code, publicPath);
              const href = turkishHost && entry.code !== "tr" ? `https://internalagency.io${path}` : path;
              return <a
                key={entry.code}
                role="menuitem"
                aria-current={entry.code === locale ? "true" : undefined}
                onClick={() => switchLocale(entry.code)}
                href={href}
                hrefLang={runtimeContentLocale(entry.code) === entry.code ? htmlLanguageTag(entry.code) : undefined}
                lang={htmlLanguageTag(runtimeContentLocale(entry.code))}
              >
                <span>{reviewedLocaleLabel(entry)}</span><small>Locale code {entry.code.toUpperCase()}</small>
              </a>;
            })}
          </div>
      </div>
    </>
  );
}
