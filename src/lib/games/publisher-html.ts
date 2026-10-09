import { gameImage } from "./steam-data";

const allowed = new Set(["p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "ul", "ol", "li", "blockquote", "div", "span", "a", "img", "video", "source", "table", "thead", "tbody", "tr", "th", "td"]);
const discarded = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "svg", "math", "link", "meta", "template"]);

/** Rebuild publisher markup in an inert template. Never retain remote styles or executable attributes. */
export function sanitizePublisherHtml(html: string): string {
  const input = document.createElement("template"), output = document.createElement("template");
  input.innerHTML = html.slice(0, 512 * 1024);
  let visited = 0;
  const copy = (node: Node, parent: Node, depth: number) => {
    if (++visited > 8000 || depth > 60) return;
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent ?? "")); return; }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.localName;
    if (discarded.has(tag)) return;
    if (!allowed.has(tag)) { node.childNodes.forEach(child => copy(child, parent, depth + 1)); return; }
    const target = document.createElement(/^h[12]$/.test(tag) ? "h3" : tag);
    if (tag === "a") {
      try {
        const url = new URL(node.getAttribute("href") ?? "");
        if (url.protocol === "https:" && !url.username && !url.password) {
          target.setAttribute("href", url.href); target.setAttribute("target", "_blank"); target.setAttribute("rel", "noopener noreferrer");
        }
      } catch { /* A malformed link remains readable text. */ }
    }
    if (tag === "img" || tag === "source") {
      const src = gameImage(node.getAttribute("src"));
      if (!src) return;
      target.setAttribute(tag === "source" ? "data-src" : "src", src);
      if (tag === "img") {
        target.setAttribute("alt", (node.getAttribute("alt") ?? "").slice(0, 500));
        target.setAttribute("loading", "lazy"); target.setAttribute("decoding", "async");
      } else if (/^video\/(mp4|webm)(;.*)?$/.test(node.getAttribute("type") ?? "")) target.setAttribute("type", node.getAttribute("type")!);
    }
    if (tag === "video") {
      const src = gameImage(node.getAttribute("src")), poster = gameImage(node.getAttribute("poster"));
      if (src) target.setAttribute("data-src", src);
      if (poster) target.setAttribute("poster", poster);
      target.setAttribute("muted", ""); target.setAttribute("loop", ""); target.setAttribute("playsinline", ""); target.setAttribute("preload", "none");
    }
    if (tag === "img" || tag === "video") for (const dimension of ["width", "height"]) {
      const value = Number(node.getAttribute(dimension));
      if (Number.isInteger(value) && value > 0 && value <= 10000) target.setAttribute(dimension, String(value));
    }
    if (tag === "td" || tag === "th") for (const attribute of ["colspan", "rowspan"]) {
      const value = Number(node.getAttribute(attribute));
      if (Number.isInteger(value) && value > 0 && value <= 20) target.setAttribute(attribute, String(value));
    }
    node.childNodes.forEach(child => copy(child, target, depth + 1));
    parent.appendChild(target);
  };
  input.content.childNodes.forEach(node => copy(node, output.content, 0));
  return output.innerHTML;
}
