declare module "gifenc" {
  type Palette = number[][];
  interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette;
        delay?: number;
        transparent?: boolean;
        repeat?: number;
        first?: boolean;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(opts?: { auto?: boolean }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean; clearAlpha?: boolean },
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string,
  ): Uint8Array;
}
