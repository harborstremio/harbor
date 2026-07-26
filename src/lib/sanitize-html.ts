/**
 * HTML sanitizer for untrusted markup — AniList comment bodies, theme overlays.
 *
 * Allowlist, not blocklist: anything not named here is removed or unwrapped, so
 * a tag or attribute nobody thought about fails closed. A blocklist has to
 * enumerate every carrier (`<svg>`, `<math>`, `<template>`, whatever ships next
 * year) and silently passes the ones it misses.
 *
 * Serialised output is re-parsed by the browser when it lands in the DOM, so
 * elements whose content model changes on a parse round-trip (`<template>`,
 * foreign content, raw-text elements) are dropped outright rather than cleaned.
 */

/** Kept, with their children. */
const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

/**
 * Removed along with everything inside them. Either they execute, they load
 * something, or they carry a parsing quirk that survives re-serialisation.
 */
const DROP_WITH_CONTENT = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "form",
  "frame",
  "frameset",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "script",
  "select",
  "slot",
  "style",
  "svg",
  "template",
  "textarea",
  "title",
  "track",
  "video",
]);

/** Attributes kept per tag. Everything else — including every `on*` — is dropped. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title"]),
};

/** Attributes whose value is a URL, so it has to be scheme-checked. */
const URL_ATTRS = new Set(["href", "src"]);

/**
 * Only http(s). `javascript:` is the obvious one; `data:` can carry an HTML
 * document and `blob:`/`filesystem:` resolve against this origin, which for the
 * desktop build is the app itself.
 */
export function isSafeUrl(value: string): boolean {
  // Entity-decoded by the parser before we see it; strip the whitespace and
  // control characters browsers tolerate inside a scheme.
  // eslint-disable-next-line no-control-regex
  const normalized = value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return true;
  // Relative and protocol-relative URLs carry no scheme of their own.
  return !/^[a-z][a-z0-9+.-]*:/.test(normalized);
}

export function isAllowedTag(tag: string): boolean {
  return ALLOWED_TAGS.has(tag.toLowerCase());
}

export function isDroppedTag(tag: string): boolean {
  return DROP_WITH_CONTENT.has(tag.toLowerCase());
}

export function isAllowedAttribute(tag: string, attr: string): boolean {
  return ALLOWED_ATTRS[tag.toLowerCase()]?.has(attr.toLowerCase()) ?? false;
}

export function isUrlAttribute(attr: string): boolean {
  return URL_ATTRS.has(attr.toLowerCase());
}

function clean(node: Element): void {
  for (const child of [...node.children]) {
    const tag = child.tagName.toLowerCase();
    if (isDroppedTag(tag)) {
      child.remove();
      continue;
    }
    clean(child);
    if (!isAllowedTag(tag)) {
      // Unknown but harmless wrapper: keep the text, lose the element.
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attr of [...child.attributes]) {
      if (!isAllowedAttribute(tag, attr.name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (isUrlAttribute(attr.name) && !isSafeUrl(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}
