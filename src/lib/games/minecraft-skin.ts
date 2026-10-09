/** Minecraft Java's 64 × 64 skin atlas. Pixel operations stay independent of WebGL. */
export type SkinModel = "classic" | "slim";
export const SKIN_PARTS = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"] as const;
export const SKIN_FACES = ["front", "back", "left", "right", "top", "bottom"] as const;
export type SkinPart = typeof SKIN_PARTS[number];
export type SkinFace = typeof SKIN_FACES[number];
export type SkinTool = "brush" | "erase" | "fill" | "pick";
export type SkinRect = { x: number; y: number; width: number; height: number };
export const SKIN_BYTES = 64 * 64 * 4;

export function skinFaceRect(part: SkinPart, face: SkinFace, outer: boolean, model: SkinModel): SkinRect {
  const arm = model === "slim" ? 3 : 4;
  const dimensions: Record<SkinPart, [number, number, number, number, number]> = {
    head: [outer ? 32 : 0, 0, 8, 8, 8],
    body: [16, outer ? 32 : 16, 8, 12, 4],
    rightArm: [40, outer ? 32 : 16, arm, 12, 4],
    leftArm: [outer ? 48 : 32, 48, arm, 12, 4],
    rightLeg: [0, outer ? 32 : 16, 4, 12, 4],
    leftLeg: [outer ? 0 : 16, 48, 4, 12, 4],
  };
  const [x, y, w, h, d] = dimensions[part];
  switch (face) {
    case "top": return { x: x + d, y, width: w, height: d };
    case "bottom": return { x: x + d + w, y, width: w, height: d };
    case "right": return { x, y: y + d, width: d, height: h };
    case "front": return { x: x + d, y: y + d, width: w, height: h };
    case "left": return { x: x + d + w, y: y + d, width: d, height: h };
    case "back": return { x: x + 2 * d + w, y: y + d, width: w, height: h };
  }
}

export function skinColor(hex: string): [number, number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("skin_color");
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
export function skinHex(pixels: Uint8ClampedArray, x: number, y: number): string {
  const offset = (y * 64 + x) * 4;
  return "#" + [...pixels.slice(offset, offset + 3)].map(n => n.toString(16).padStart(2, "0")).join("");
}
function validPixels(pixels: Uint8ClampedArray) {
  if (pixels.length !== SKIN_BYTES) throw new Error("skin_size");
}

/** Flood fill is restricted to the selected face, so adjacent UV islands stay intact. */
export function paintSkin(pixels: Uint8ClampedArray, rect: SkinRect, x: number, y: number, tool: SkinTool, color: string): Uint8ClampedArray {
  validPixels(pixels);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= rect.width || y >= rect.height || tool === "pick") return pixels;
  const rgba = tool === "erase" ? [0, 0, 0, 0] : skinColor(color);
  const result = new Uint8ClampedArray(pixels);
  const offset = ((rect.y + y) * 64 + rect.x + x) * 4;
  const original = [...pixels.slice(offset, offset + 4)];
  if (rgba.every((n, i) => n === original[i])) return pixels;
  if (tool !== "fill") { result.set(rgba, offset); return result; }
  const stack = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    if (px < 0 || py < 0 || px >= rect.width || py >= rect.height) continue;
    const at = ((rect.y + py) * 64 + rect.x + px) * 4;
    if (!original.every((n, i) => result[at + i] === n)) continue;
    result.set(rgba, at);
    stack.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  return result;
}

/** Interpolated points prevent gaps when the pointer moves faster than the pixel grid. */
export function skinStroke(from: [number, number], to: [number, number]): [number, number][] {
  let [x, y] = from;
  const dx = Math.abs(to[0] - x), dy = -Math.abs(to[1] - y), sx = x < to[0] ? 1 : -1, sy = y < to[1] ? 1 : -1;
  let error = dx + dy;
  const points: [number, number][] = [];
  while (true) {
    points.push([x, y]); if (x === to[0] && y === to[1]) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return points;
}

/** An original, unbranded mannequin; never presented as the user's account skin. */
export function blankSkin(model: SkinModel): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SKIN_BYTES);
  for (const part of SKIN_PARTS) for (const face of SKIN_FACES) {
    const rect = skinFaceRect(part, face, false, model);
    const base = part === "head" ? "#bcbeb8" : part === "body" || part.endsWith("Arm") ? "#668478" : "#394b48";
    for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) pixels.set(skinColor(base), ((rect.y + y) * 64 + rect.x + x) * 4);
  }
  return pixels;
}

export function convertSkinModel(pixels: Uint8ClampedArray, from: SkinModel, to: SkinModel): Uint8ClampedArray {
  validPixels(pixels); if (from === to) return pixels;
  const result = new Uint8ClampedArray(pixels);
  for (const part of ["leftArm", "rightArm"] as const) for (const outer of [false, true]) {
    for (const face of SKIN_FACES) {
      const old = skinFaceRect(part, face, outer, from);
      for (let y = 0; y < old.height; y++) for (let x = 0; x < old.width; x++) result.fill(0, ((old.y + y) * 64 + old.x + x) * 4, ((old.y + y) * 64 + old.x + x) * 4 + 4);
    }
    for (const face of SKIN_FACES) {
      const a = skinFaceRect(part, face, outer, from), b = skinFaceRect(part, face, outer, to);
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
        const at = ((a.y + y) * 64 + a.x + Math.min(x, a.width - 1)) * 4;
        result.set(pixels.slice(at, at + 4), ((b.y + y) * 64 + b.x + x) * 4);
      }
    }
  }
  return result;
}

/** PNG carries no model metadata; slim skins leave the extra arm columns transparent. */
export function inferSkinModel(pixels: Uint8ClampedArray): SkinModel {
  validPixels(pixels);
  for (const [x, y, width, height] of [[50, 16, 2, 4], [54, 20, 2, 12], [42, 48, 2, 4], [46, 52, 2, 12]]) {
    for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) if (pixels[(row * 64 + col) * 4 + 3] > 0) return "classic";
  }
  return "slim";
}

/** Convert old Java skins by mirroring their shared arms/legs into modern UV islands. */
export function normalizeSkin(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (width !== 64 || (height !== 32 && height !== 64) || pixels.length !== width * height * 4) throw new Error("skin_size");
  const result = new Uint8ClampedArray(SKIN_BYTES); result.set(pixels);
  if (height === 64) return result;
  for (const [source, target] of [["rightArm", "leftArm"], ["rightLeg", "leftLeg"]] as const) for (const face of SKIN_FACES) {
    const sourceFace = face === "left" ? "right" : face === "right" ? "left" : face;
    const a = skinFaceRect(source, sourceFace, false, "classic"), b = skinFaceRect(target, face, false, "classic");
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
      const at = ((a.y + y) * 64 + a.x + a.width - x - 1) * 4;
      result.set(pixels.slice(at, at + 4), ((b.y + y) * 64 + b.x + x) * 4);
    }
  }
  // Legacy base layers are opaque, including historically transparent pixels.
  for (const part of SKIN_PARTS) for (const face of SKIN_FACES) {
    const r = skinFaceRect(part, face, false, "classic");
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) result[((r.y + y) * 64 + r.x + x) * 4 + 3] = 255;
  }
  return result;
}

export type SkinDraft = { id: string; name: string; model: SkinModel; texture: string; updated: number };
const draftKey = (profile: string) => `harbor.games.minecraft.skins.v1.${profile}`;
export function skinDrafts(profile: string): SkinDraft[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(draftKey(profile)) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.slice(0, 40).filter((v): v is SkinDraft => v && typeof v.id === "string" && /^[a-zA-Z0-9-]{1,60}$/.test(v.id) && typeof v.name === "string" && v.name.length <= 80 && (v.model === "classic" || v.model === "slim") && typeof v.texture === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.texture) && v.texture.length < 100_000 && Number.isFinite(v.updated));
  } catch { return []; }
}
export function saveSkinDraft(profile: string, draft: SkinDraft): SkinDraft[] {
  const previous = skinDrafts(profile).filter(v => v.id !== draft.id);
  if (previous.length >= 40) throw new Error("skin_library_full");
  const next = [draft, ...previous];
  localStorage.setItem(draftKey(profile), JSON.stringify(next)); return next;
}
export function removeSkinDraft(profile: string, id: string): SkinDraft[] {
  const next = skinDrafts(profile).filter(v => v.id !== id);
  localStorage.setItem(draftKey(profile), JSON.stringify(next)); return next;
}
