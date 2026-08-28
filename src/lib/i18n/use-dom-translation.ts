import { useEffect } from "react";
import domKeys from "./locales/hu/dom";
import { t, useUiLanguage } from "./translate";

const TRANSLATABLE_ATTRIBUTES = ["title", "aria-label", "placeholder", "alt"] as const;
const SKIP_SELECTOR = "code, pre, script, style, textarea, [data-no-auto-i18n]";
const SETTINGS_SELECTOR = "[data-settings-root]";

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isKnownUiCopy(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(domKeys, value);
}

function isSkipped(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(SKIP_SELECTOR) != null;
}

function isSettingsCopy(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return false;
  if (element.closest(SETTINGS_SELECTOR)) return true;
  // Settings dialogs often render through a body-level portal.
  return document.querySelector(SETTINGS_SELECTOR) != null && element.closest('[role="dialog"]') != null;
}

/**
 * Harbor still contains older components whose visible JSX copy bypasses t().
 * Keep those strings localizable in Hungarian mode without touching metadata,
 * API responses, user copy, code samples, or arbitrary page content.
 */
export function useHungarianDomTranslation(): void {
  const language = useUiLanguage();

  useEffect(() => {
    if (language !== "hu" || typeof document === "undefined" || !document.body) return;

    const originalText = new Map<Text, string>();
    const originalAttributes = new Map<Element, Map<string, string>>();

    const translateText = (node: Text) => {
      if (isSkipped(node) || !isSettingsCopy(node)) return;
      const source = normalized(node.data);
      if (!source || !isKnownUiCopy(source)) return;
      const translated = t(source);
      if (!translated || translated === source) return;
      if (!originalText.has(node)) originalText.set(node, node.data);
      const leading = node.data.match(/^\s*/)?.[0] ?? "";
      const trailing = node.data.match(/\s*$/)?.[0] ?? "";
      node.data = `${leading}${translated}${trailing}`;
    };

    const translateAttributes = (element: Element) => {
      if (isSkipped(element) || !isSettingsCopy(element)) return;
      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const raw = element.getAttribute(attribute);
        if (!raw) continue;
        const source = normalized(raw);
        if (!isKnownUiCopy(source)) continue;
        const translated = t(source);
        if (!translated || translated === source) continue;
        let originals = originalAttributes.get(element);
        if (!originals) {
          originals = new Map();
          originalAttributes.set(element, originals);
        }
        if (!originals.has(attribute)) originals.set(attribute, raw);
        element.setAttribute(attribute, translated);
      }
    };

    const isRelevantRoot = (root: Node): boolean => {
      if (root instanceof Text) return isSettingsCopy(root);
      if (!(root instanceof Element)) return false;
      if (root.matches(SETTINGS_SELECTOR) || root.closest(SETTINGS_SELECTOR)) return true;
      if (root.querySelector(SETTINGS_SELECTOR)) return true;
      // A small number of settings modals use a body portal. Do not touch
      // unrelated dialogs unless Settings is actually open.
      return (
        document.querySelector(SETTINGS_SELECTOR) != null &&
        (root.matches('[role="dialog"]') || root.closest('[role="dialog"]') != null || root.querySelector('[role="dialog"]') != null)
      );
    };

    const translateTree = (root: Node) => {
      // The old implementation walked every new node in the application. In
      // Hungarian this made the player and animated pages pay for a legacy
      // Settings-only translator. Limit the work to Settings and its portals.
      if (root === document.body) {
        for (const target of document.querySelectorAll<HTMLElement>(`${SETTINGS_SELECTOR}, [role="dialog"]`)) {
          if (isRelevantRoot(target)) translateTree(target);
        }
        return;
      }
      if (!isRelevantRoot(root)) return;
      if (root instanceof Text) {
        translateText(root);
        return;
      }
      if (!(root instanceof Element) && root !== document.body) return;
      if (root instanceof Element) translateAttributes(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current instanceof Text) translateText(current);
        else if (current instanceof Element) translateAttributes(current);
        current = walker.nextNode();
      }
    };

    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTree(mutation.target);
        else if (mutation.type === "attributes") translateAttributes(mutation.target as Element);
        else for (const node of mutation.addedNodes) translateTree(node);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      // Text and attributes inside Settings are handled when their containing
      // subtree is mounted. Avoid a global observer for player progress and
      // all other frequently changing UI.
    });

    return () => {
      observer.disconnect();
      for (const [node, value] of originalText) {
        if (node.isConnected) node.data = value;
      }
      for (const [element, attributes] of originalAttributes) {
        if (!element.isConnected) continue;
        for (const [name, value] of attributes) element.setAttribute(name, value);
      }
    };
  }, [language]);
}
