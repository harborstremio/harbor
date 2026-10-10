// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";

const KT_DIR = "../android-native/app/src/main/java/com/harbor/tv/";

export function drift(what: string): never {
  throw new Error(
    `tv-panel contract reader cannot read the TV source any more: ${what}. ` +
      "Teach tests/_tv-panel-kotlin.ts the new shape, then re-check model.ts by hand.",
  );
}

export function ktSource(name: string): string {
  return stripComments(readFileSync(new URL(KT_DIR + name, import.meta.url), "utf8"));
}

export function endOfString(src: string, open: number): number {
  let i = open + 1;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === '"') return i + 1;
    i += 1;
  }
  return drift("an unterminated string literal");
}

function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      const end = endOfString(src, i);
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

export function stripStrings(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      i = endOfString(src, i);
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

export function callAt(src: string, open: number): { body: string; end: number } {
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      i = endOfString(src, i);
      continue;
    }
    if (c === "(") depth += 1;
    if (c === ")") {
      depth -= 1;
      if (depth === 0) return { body: src.slice(open + 1, i), end: i + 1 };
    }
    i += 1;
  }
  return drift("an unbalanced call near " + src.slice(open, open + 40));
}

export function blockAfter(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) drift(`${anchor} is gone`);
  const open = src.indexOf("(", at);
  if (open < 0) drift(`${anchor} has no argument list`);
  return callAt(src, open).body;
}

export function splitArgs(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '"') {
      i = endOfString(body, i);
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth += 1;
    if (c === ")" || c === "}" || c === "]") depth -= 1;
    if (c === "," && depth === 0) {
      out.push(body.slice(start, i).trim());
      start = i + 1;
    }
    i += 1;
  }
  out.push(body.slice(start).trim());
  return out.filter((a) => a.length > 0);
}

export function literal(arg: string): string | null {
  const trimmed = arg.trim();
  if (!trimmed.startsWith('"') || endOfString(trimmed, 0) !== trimmed.length) return null;
  return JSON.parse(trimmed);
}

export function regionAfter(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) drift(`${anchor} is gone`);
  const stop = src.indexOf("\n\n", at);
  return src.slice(at, stop < 0 ? src.length : stop);
}
