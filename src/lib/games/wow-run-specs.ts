// Raider.IO's original specialization sprite and positions, observed 2026-10-01.
// Exact specialization/class IDs prevent display-name collisions (e.g. Frost).
// The bundled original sprite keeps these coordinates stable across CDN updates.
export const WOW_SPEC_SPRITE_SIZE = [448, 384] as const;
const specs: Record<number, readonly [number, number, number]> = {
  71: [1, -384, -128],
  72: [1, -384, -192],
  73: [1, -384, -256],
  65: [2, -128, -256],
  66: [2, -192, -256],
  70: [2, -256, -256],
  253: [3, -64, -192],
  254: [3, -128, -192],
  255: [3, -192, -192],
  259: [4, -320, -192],
  260: [4, 0, -320],
  261: [4, -64, -320],
  256: [5, -320, 0],
  257: [5, -320, -64],
  258: [5, -320, -128],
  250: [6, 0, 0],
  251: [6, -64, 0],
  252: [6, 0, -64],
  262: [7, -128, -320],
  263: [7, -192, -320],
  264: [7, -256, -320],
  62: [8, -256, 0],
  63: [8, -256, -64],
  64: [8, -256, -128],
  265: [9, -320, -320],
  266: [9, -384, 0],
  267: [9, -384, -64],
  268: [10, -256, -192],
  270: [10, 0, -256],
  269: [10, -64, -256],
  102: [11, 0, -128],
  103: [11, -64, -128],
  104: [11, -128, -128],
  105: [11, -192, 0],
  1480: [12, -64, -64],
  577: [12, -128, 0],
  581: [12, -128, -64],
  1473: [13, -192, -64],
  1467: [13, -192, -128],
  1468: [13, 0, -192],
};
export function wowSpecPosition(id: number, classId: number) {
  const value = specs[id];
  return value?.[0] === classId ? [value[1], value[2]] as const : null;
}
