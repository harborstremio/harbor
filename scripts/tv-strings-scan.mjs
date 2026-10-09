const QUOTE = String.fromCharCode(34);
const BSLASH = String.fromCharCode(92);
const APOS = String.fromCharCode(39);
const TRIPLE = QUOTE + QUOTE + QUOTE;
const OPENS = "([{";
const CLOSES = ")]}";

export function scanKotlin(sourceRaw) {
  const src = sourceRaw.split("\r\n").join("\n");
  const n = src.length;
  const strings = [];
  const codeMask = new Uint8Array(n);
  const lineIndex = new Int32Array(n + 1);
  let line = 1;
  for (let k = 0; k < n; k += 1) {
    lineIndex[k] = line;
    if (src[k] === "\n") line += 1;
  }
  lineIndex[n] = line;
  let i = 0;
  let block = 0;
  while (i < n) {
    if (block > 0) {
      if (src.startsWith("/*", i)) { block += 1; i += 2; continue; }
      if (src.startsWith("*/", i)) { block -= 1; i += 2; continue; }
      i += 1;
      continue;
    }
    if (src.startsWith("//", i)) {
      while (i < n && src[i] !== "\n") i += 1;
      continue;
    }
    if (src.startsWith("/*", i)) { block = 1; i += 2; continue; }
    if (src[i] === APOS) {
      let j = i + 1;
      while (j < n && src[j] !== APOS && src[j] !== "\n") j += src[j] === BSLASH ? 2 : 1;
      i = j + 1;
      continue;
    }
    if (src.startsWith(TRIPLE, i)) {
      let j = i + 3;
      while (j < n && !src.startsWith(TRIPLE, j)) j += 1;
      i = Math.min(j + 3, n);
      continue;
    }
    if (src[i] === QUOTE) {
      const start = i;
      let j = i + 1;
      let buf = "";
      let escaped = false;
      let closed = false;
      while (j < n) {
        if (src[j] === BSLASH) { buf += src.slice(j, j + 2); escaped = true; j += 2; continue; }
        if (src[j] === QUOTE) { closed = true; break; }
        if (src[j] === "\n") break;
        buf += src[j];
        j += 1;
      }
      if (!closed) { i = start + 1; continue; }
      strings.push({ value: buf, start, end: j + 1, line: lineIndex[start], escaped });
      i = j + 1;
      continue;
    }
    codeMask[i] = 1;
    i += 1;
  }
  return { src, strings, codeMask, lines: src.split("\n") };
}

function openBefore(sc, pos) {
  let depth = 0;
  for (let k = pos - 1; k >= 0; k -= 1) {
    if (sc.codeMask[k] !== 1) continue;
    const c = sc.src[k];
    if (c === ")" || c === "]") depth += 1;
    else if (c === "(" || c === "[") {
      if (depth === 0) return k;
      depth -= 1;
    }
  }
  return -1;
}

function braceBefore(sc, pos) {
  let depth = 0;
  for (let k = pos - 1; k >= 0; k -= 1) {
    if (sc.codeMask[k] !== 1) continue;
    const c = sc.src[k];
    if (c === "}") depth += 1;
    else if (c === "{") {
      if (depth === 0) return k;
      depth -= 1;
    }
  }
  return -1;
}

function closeFor(sc, open) {
  let depth = 0;
  for (let k = open; k < sc.src.length; k += 1) {
    if (sc.codeMask[k] !== 1) continue;
    const c = sc.src[k];
    if (c === "(" || c === "[") depth += 1;
    else if (c === ")" || c === "]") {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return -1;
}

function argSlots(sc, open, close) {
  const slots = [];
  let depth = 0;
  let start = open + 1;
  for (let k = open + 1; k < close; k += 1) {
    if (sc.codeMask[k] !== 1) continue;
    const c = sc.src[k];
    if (OPENS.includes(c)) depth += 1;
    else if (CLOSES.includes(c)) depth -= 1;
    else if (c === "," && depth === 0) { slots.push([start, k]); start = k + 1; }
  }
  slots.push([start, close]);
  return slots;
}

const FALLBACK_LAMBDA = /(ifEmpty|ifBlank)$/;
const LITERAL_SLOT = /^\s*(?:[A-Za-z_]\w*\s*=\s*)?"(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*\s*,\s*$/;
const RES_SLOT = /^\s*(?:[A-Za-z_]\w*\s*=\s*)?R\.(?:string|plurals)\.\w+\s*,\s*$/;

function receiverCarriesResource(sc, brace) {
  let p = brace - 1;
  while (p >= 0 && /\s/.test(sc.src[p])) p -= 1;
  const tail = sc.src.slice(Math.max(0, p - 8), p + 1);
  const m = tail.match(FALLBACK_LAMBDA);
  if (!m) return false;
  let q = p - m[0].length + 1;
  while (q > 0 && /[\s.]/.test(sc.src[q - 1])) q -= 1;
  let depth = 0;
  let chain = "";
  for (let k = q - 1; k >= Math.max(0, q - 4000); k -= 1) {
    const c = sc.src[k];
    if (c === ")" || c === "]") depth += 1;
    else if (c === "(" || c === "[") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && !/[\w.$"']/.test(c) && !/\s/.test(c)) break;
    chain = c + chain;
  }
  return chain.includes("R.string") || chain.includes("R.plurals");
}

export function boundToResource(sc, tok) {
  const brace = braceBefore(sc, tok.start);
  if (brace >= 0 && receiverCarriesResource(sc, brace)) return "fallback lambda";
  const open = openBefore(sc, tok.start);
  if (open < 0) return null;
  const close = closeFor(sc, open);
  if (close < 0) return null;
  const slots = argSlots(sc, open, close);
  let mine = -1;
  for (let a = 0; a < slots.length; a += 1) if (tok.start >= slots[a][0] && tok.end <= slots[a][1]) { mine = a; break; }
  if (mine < 0) return null;
  if (!LITERAL_SLOT.test(sc.src.slice(slots[mine][0], slots[mine][1]) + ",")) return null;
  for (let a = 0; a < slots.length; a += 1) {
    if (a === mine) continue;
    if (RES_SLOT.test(sc.src.slice(slots[a][0], slots[a][1]) + ",")) return "sibling argument";
  }
  return null;
}

const COLLECTIONS = /(?:^|[^\w.])(mapOf|listOf|setOf|arrayOf|mutableListOf|mutableMapOf|mutableSetOf|linkedMapOf|hashMapOf|sortedMapOf|buildList|buildMap|listOfNotNull|persistentListOf)\s*\($/;
const COMPARE = /(?:startsWith|endsWith|contains|equals|indexOf|removePrefix|removeSuffix|substringAfter|substringBefore|split|replace)\s*\($/;
const AUTH = /^(Bearer|Basic|Token|Digest|Bot|OAuth) /;

export function classifyKind(sc, tok) {
  if (AUTH.test(tok.value)) return "header";
  let cur = tok.start;
  const heads = [];
  for (let n = 0; n < 8; n += 1) {
    const open = openBefore(sc, cur);
    const brace = braceBefore(sc, cur);
    const pick = Math.max(open, brace);
    if (pick < 0) break;
    heads.push(sc.src.slice(Math.max(0, pick - 40), pick + 1));
    cur = pick;
  }
  for (const h of heads) if (COMPARE.test(h)) return "match key";
  for (const h of heads) if (COLLECTIONS.test(h)) return "data table";
  return "copy";
}

const SHAPE = /^[A-Z(][^<>=]*$/;
const PROSE_STRICT = /\s[a-z]{2,}\s/;
const PROSE_WIDE = /(^|\s)[A-Za-z][a-z]{1,}[.,!?:;']?($|\s)/;
const CODEISH = /[_$]\w+\(|\bfun\b|\bval\b|application\/|text\//;

function unbalancedTemplate(v) {
  let depth = 0;
  for (let i = 0; i < v.length; i += 1) {
    if (v[i] === "$" && v[i + 1] === "{") { depth += 1; i += 1; continue; }
    if (v[i] === "}" && depth > 0) depth -= 1;
  }
  return depth > 0;
}

export const STRICT = { floor: 12, minWords: 3, prose: PROSE_STRICT };
export const WIDE = { floor: 6, minWords: 2, prose: PROSE_WIDE };

export function hitsFor(sc, tier) {
  const out = [];
  for (const tok of sc.strings) {
    if (tok.escaped) continue;
    const v = tok.value;
    if (v.length < tier.floor || v.length > 200) continue;
    if (unbalancedTemplate(v)) continue;
    if ((sc.lines[tok.line - 1] || "").includes("Log.")) continue;
    if (boundToResource(sc, tok)) continue;
    if (v.split(/\s+/).length < tier.minWords) continue;
    if (!SHAPE.test(v)) continue;
    if (v.startsWith("http") || v.includes("://") || v.slice(0, 12).includes("/")) continue;
    if (v.includes("KHTML")) continue;
    if (CODEISH.test(v)) continue;
    if (!tier.prose.test(v)) continue;
    out.push({ line: tok.line, value: v, kind: classifyKind(sc, tok) });
  }
  return out;
}
