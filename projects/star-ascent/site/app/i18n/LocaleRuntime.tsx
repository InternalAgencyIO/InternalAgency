"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { htmlLanguageTag, localePath, locales, type LocaleCode } from "./config";
import { localePayloadContract, localePayloadPath } from "./payload-contract";

export type LocaleCatalog = Record<string, string>;
export type PromptCopy = { eyebrow: string; title: string; body: string; stay: string; english: string; close: string; timeout: string };
type LocalePayload = {
  schema: string;
  catalogSha256: string;
  sourceCount: number;
  locale: LocaleCode;
  messages: LocaleCatalog;
};

const translatableAttributes = ["alt", "aria-label", "placeholder", "title"] as const;
const legacyLanguageLabels = new Set(["TR", "EN", "TÜRKÇE", "ENGLISH"]);
const hydrationQuietWindowMs = 100;

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

export function LocaleRuntime({ locale, promptCopy, publicPath, turkishHost }: { locale: LocaleCode; promptCopy: PromptCopy; publicPath: string; turkishHost: boolean }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const definition = useMemo(() => locales.find((entry) => entry.code === locale) ?? locales[0], [locale]);
  useLayoutEffect(() => {
    document.documentElement.dataset.localeReady = "false";
    document.documentElement.lang = htmlLanguageTag(locale);
    document.documentElement.dir = definition.dir;
    let active = true;
    let observer: MutationObserver | null = null;
    let readinessTimer: number | null = null;
    const localizedTextValues = new WeakMap<Text, string>();
    const nativeTurkishHost = locale === "tr" && window.location.hostname.includes("ileriakil");
    const routeLocale: LocaleCode = nativeTurkishHost ? "en" : locale;

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
          for (const node of change.addedNodes) localizeTree(node, locale, catalog, routeLocale, localizedTextValues);
          if (change.type === "characterData") localizeTree(change.target, locale, catalog, routeLocale, localizedTextValues);
        }
        armReadiness();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      localizeTree(document.body, locale, catalog, routeLocale, localizedTextValues);
      armReadiness();
    };

    if (locale === "en" || nativeTurkishHost) activate({});
    else {
      fetch(localePayloadPath(locale), { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Locale payload failed: ${response.status}`);
          return response.json() as Promise<LocalePayload>;
        })
        .then((payload) => {
          if (payload.locale !== locale) throw new Error("Locale payload mismatch");
          if (
            payload.schema !== localePayloadContract.schema
            || payload.catalogSha256 !== localePayloadContract.catalogSha256
            || payload.sourceCount !== localePayloadContract.sourceCount
            || Object.keys(payload.messages ?? {}).length !== localePayloadContract.sourceCount
          ) throw new Error("Locale payload contract mismatch");
          activate(payload.messages);
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
  }, [definition.dir, locale]);

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
          {definition.nativeName} <span aria-hidden="true">⌄</span>
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
                hrefLang={htmlLanguageTag(entry.code)}
                lang={htmlLanguageTag(entry.code)}
              >
                <span>{entry.nativeName}</span><small>{entry.name}</small>
              </a>;
            })}
          </div>
      </div>
    </>
  );
}
