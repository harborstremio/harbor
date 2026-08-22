const REFERENCE_HEIGHT = 720;
const MIN_SCALE = 0.2;
const MAX_SCALE = 6;
const MIN_FONT_FRACTION = 0.02;
const MAX_FONT_FRACTION = 0.22;
const SIGN_TAGS = /\\(?:pos|move|i?clip|p[1-9])/i;
const DIALOGUE_STYLE_NAME = /^(?:default|dialogue|dialog|main|regular)$/i;

export type AssStyle = {
  size: number;
  order: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function section(text: string, heading: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start < 0) return null;
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[.+\]\s*$/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join("\n");
}

function integerValue(text: string, key: RegExp): number {
  const match = key.exec(text);
  if (!match) return 0;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : 0;
}

function splitEventFields(line: string, columnCount: number): string[] {
  if (columnCount <= 0) return line.split(",");
  const fields: string[] = [];
  let remainder = line;
  for (let index = 0; index < columnCount - 1; index += 1) {
    const comma = remainder.indexOf(",");
    if (comma < 0) {
      fields.push(remainder);
      remainder = "";
      continue;
    }
    fields.push(remainder.slice(0, comma));
    remainder = remainder.slice(comma + 1);
  }
  fields.push(remainder);
  return fields;
}

function visibleLength(text: string): number {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\[Nnh]/g, " ")
    .trim().length;
}

export function inferPlayResY(text: string): number {
  const explicitY = integerValue(text, /^PlayResY:\s*(\d+)/im);
  if (explicitY > 0) return explicitY;
  const explicitX = integerValue(text, /^PlayResX:\s*(\d+)/im);
  if (explicitX > 0) return explicitX === 1280 ? 1024 : Math.floor((explicitX * 3) / 4);
  return 288;
}

export function parseAssStyles(text: string): Map<string, AssStyle> {
  const styles = new Map<string, AssStyle>();
  const body = section(text, /^\[v4\+? styles\]$/i);
  if (!body) return styles;
  let nameColumn = -1;
  let sizeColumn = -1;
  let order = 0;
  for (const line of body.split(/\r?\n/)) {
    const format = /^Format:\s*(.*)$/i.exec(line);
    if (format) {
      const columns = format[1].split(",").map((column) => column.trim().toLowerCase());
      nameColumn = columns.indexOf("name");
      sizeColumn = columns.indexOf("fontsize");
      continue;
    }
    const style = /^Style:\s*(.*)$/i.exec(line);
    if (!style || nameColumn < 0 || sizeColumn < 0) continue;
    const fields = style[1].split(",");
    const name = (fields[nameColumn] ?? "").trim();
    const size = Number.parseFloat((fields[sizeColumn] ?? "").trim());
    if (!name || !Number.isFinite(size)) continue;
    const previous = styles.get(name);
    styles.set(name, { size, order: previous?.order ?? order++ });
  }
  return styles;
}

function fallbackStyle(styles: Map<string, AssStyle>): string {
  let first = "";
  let firstPositive = "";
  for (const [name, style] of styles) {
    if (!first) first = name;
    if (style.size <= 0) continue;
    if (/^default$/i.test(name)) return name;
    if (!firstPositive) firstPositive = name;
  }
  return firstPositive || first;
}

export function dominantDialogueStyle(text: string, styles: Map<string, AssStyle>): string {
  const body = section(text, /^\[events\]$/i);
  const tally = new Map<string, { count: number; characters: number }>();
  if (body) {
    let styleColumn = -1;
    let textColumn = -1;
    let columnCount = 0;
    for (const line of body.split(/\r?\n/)) {
      const format = /^Format:\s*(.*)$/i.exec(line);
      if (format) {
        const columns = format[1].split(",").map((column) => column.trim().toLowerCase());
        columnCount = columns.length;
        styleColumn = columns.indexOf("style");
        textColumn = columns.indexOf("text");
        continue;
      }
      const dialogue = /^Dialogue:\s*(.*)$/i.exec(line);
      if (!dialogue || styleColumn < 0 || textColumn < 0) continue;
      const fields = splitEventFields(dialogue[1], columnCount);
      const styleName = (fields[styleColumn] ?? "").trim();
      const dialogueText = fields[textColumn] ?? "";
      if (SIGN_TAGS.test(dialogueText) || !styles.has(styleName)) continue;
      const current = tally.get(styleName) ?? { count: 0, characters: 0 };
      current.count += 1;
      current.characters += visibleLength(dialogueText);
      tally.set(styleName, current);
    }
  }

  const names = [...tally.keys()];
  names.sort((left, right) => {
    const leftTally = tally.get(left) as { count: number; characters: number };
    const rightTally = tally.get(right) as { count: number; characters: number };
    if (rightTally.count !== leftTally.count) return rightTally.count - leftTally.count;
    if (rightTally.characters !== leftTally.characters) {
      return rightTally.characters - leftTally.characters;
    }
    const leftIsDialogue = DIALOGUE_STYLE_NAME.test(left) ? 1 : 0;
    const rightIsDialogue = DIALOGUE_STYLE_NAME.test(right) ? 1 : 0;
    if (rightIsDialogue !== leftIsDialogue) return rightIsDialogue - leftIsDialogue;
    return (styles.get(left)?.order ?? 0) - (styles.get(right)?.order ?? 0);
  });
  return names[0] ?? fallbackStyle(styles);
}

export function computeAssBaseFactor(text: string): number | null {
  const styles = parseAssStyles(text);
  if (styles.size === 0) return null;
  const playResY = inferPlayResY(text);
  const style = styles.get(dominantDialogueStyle(text, styles));
  if (!style || style.size <= 0) return null;
  const fraction = style.size / playResY;
  if (fraction < MIN_FONT_FRACTION || fraction > MAX_FONT_FRACTION) return null;
  const factor = playResY / (REFERENCE_HEIGHT * style.size);
  return Number.isFinite(factor) && factor > 0 ? factor : null;
}

export function assScaleFromFactor(factor: number, targetFontSize: number): number {
  const target = Number.isFinite(targetFontSize) ? targetFontSize : 32;
  return clamp(factor * target, MIN_SCALE, MAX_SCALE);
}
