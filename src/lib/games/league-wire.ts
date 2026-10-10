/** OP.GG's documented MCP returns JSON or compact, class-declared data. Never execute it. */
export function parseLeagueWire(raw: unknown): unknown {
  const envelope = raw as { error?: unknown; result?: { isError?: boolean; structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> } };
  if (!envelope?.result || envelope.error || envelope.result.isError) throw Error("League source unavailable");
  if (envelope.result.structuredContent) return envelope.result.structuredContent;
  const text = envelope.result.content?.find(item => item.type === "text")?.text;
  if (!text || text.length > 1_000_000) throw Error("Invalid League response");
  if (text.trimStart().startsWith("{")) return JSON.parse(text);
  const classes = new Map<string, string[]>();
  let offset = 0;
  for (const line of text.split("\n")) {
    const match = /^class ([A-Za-z][A-Za-z0-9]*): ([a-zA-Z0-9_,]+)$/.exec(line);
    if (!match) break;
    const keys = match[2]!.split(",");
    if (classes.size > 80 || keys.length > 80 || keys.some(key => ["__proto__", "constructor", "prototype"].includes(key)) || new Set(keys).size !== keys.length) throw Error("Invalid League schema");
    classes.set(match[1]!, keys); offset += line.length + 1;
  }
  let count = 0;
  const whitespace = () => { while (/\s/.test(text[offset] ?? "") && offset < text.length) offset++; };
  const expect = (char: string) => { whitespace(); if (text[offset++] !== char) throw Error("Invalid League data"); };
  const value = (depth = 0): unknown => {
    if (depth > 24 || ++count > 100_000) throw Error("League response too complex");
    whitespace(); const start = offset;
    if (text[offset] === '"') {
      offset++; let escaped = false;
      while (offset < text.length) { const char = text[offset++]; if (char === '"' && !escaped) return JSON.parse(text.slice(start, offset)); escaped = char === "\\" && !escaped; }
      throw Error("Unterminated League text");
    }
    if (text[offset] === "[") {
      offset++; const list: unknown[] = []; whitespace();
      if (text[offset] !== "]") { while (true) { list.push(value(depth + 1)); whitespace(); if (text[offset] !== ",") break; offset++; } }
      expect("]"); return list;
    }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(offset));
    if (primitive) { offset += primitive[0].length; const result: unknown = JSON.parse(primitive[0]); if (typeof result === "number" && !Number.isFinite(result)) throw Error("Invalid League number"); return result; }
    const name = /^[A-Za-z][A-Za-z0-9]*/.exec(text.slice(offset))?.[0], keys = name && classes.get(name);
    if (!name || !keys) throw Error("Unknown League data type");
    offset += name.length; expect("("); const item: Record<string, unknown> = {};
    keys.forEach((key, index) => { if (index) expect(","); item[key] = value(depth + 1); });
    expect(")"); return item;
  };
  const result = value(); whitespace();
  if (offset !== text.length) throw Error("Unexpected League data");
  return result;
}
