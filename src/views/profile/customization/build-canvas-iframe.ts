import { t } from "@/lib/i18n";
import { CANVAS_DEFAULT, CANVAS_MAX, CANVAS_MIN, MARKUP_CAP } from "./customization-types";

const STRIP_RE = /<script|<\/script|javascript:|<iframe|<object|<embed/gi;
const HANDLER_RE = /on[a-z]+\s*=/gi;

export function sanitizeMarkup(value: string): string {
  let out = String(value || "").slice(0, MARKUP_CAP);
  let prev: string;
  do {
    prev = out;
    out = out.replace(STRIP_RE, "").replace(HANDLER_RE, " ");
  } while (out !== prev);
  return out;
}

export function clampHeight(height: number | undefined): number {
  const n = Math.round(Number(height));
  if (!Number.isFinite(n)) return CANVAS_DEFAULT;
  return Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, n));
}

export function buildCanvasDoc(html: string, css: string): string {
  const userHtml = sanitizeMarkup(html);
  const userCss = sanitizeMarkup(css);
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; media-src https:; base-uri 'none'; form-action 'none'\">" +
    '<base target="_blank"><style>html,body{margin:0;padding:0;color-scheme:dark}img,video{max-width:100%}' +
    "html{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}body::-webkit-scrollbar,html::-webkit-scrollbar{width:8px;height:8px}body::-webkit-scrollbar-track,html::-webkit-scrollbar-track{background:transparent}body::-webkit-scrollbar-thumb,html::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:8px}body::-webkit-scrollbar-thumb:hover,html::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.3)}" +
    userCss +
    "</style></head><body>" +
    userHtml +
    "</body></html>"
  );
}

export function buildCanvasIframe(html: string, css: string, height?: number): string {
  const doc = buildCanvasDoc(html, css).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const h = clampHeight(height);
  const title = t("Custom profile").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return (
    `<iframe class="pw-canvas" title="${title}" sandbox="" referrerpolicy="no-referrer" loading="lazy" ` +
    `style="width:100%;height:${h}px;border:0;border-radius:14px;display:block;background:transparent" ` +
    `srcdoc="${doc}"></iframe>`
  );
}
