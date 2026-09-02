import QRCode from "qrcode";

/**
 * A QR is a machine-readable image, not chrome. A phone camera reads contrast,
 * not design tokens, so the modules are literal black on literal white. Both
 * are overridable for a caller that has measured something better.
 */
export const QR_DARK = "#000000";
export const QR_LIGHT = "#ffffff";

/** Four modules is the quiet zone the QR spec requires. Below that, scans fail. */
const QUIET = 4;

export type HandoffQr = {
  /** Module count including the quiet zone, i.e. the viewBox extent. */
  extent: number;
  /** Single merged path covering every dark module, in module units. */
  path: string;
  viewBox: string;
  /** Standalone markup, for a caller that would rather not build the element. */
  svg: string;
};

export type HandoffQrOptions = {
  dark?: string;
  light?: string;
  quiet?: number;
  title?: string;
};

function runsToPath(get: (r: number, c: number) => number, size: number, quiet: number): string {
  let d = "";
  for (let r = 0; r < size; r += 1) {
    let c = 0;
    while (c < size) {
      if (!get(r, c)) {
        c += 1;
        continue;
      }
      let end = c;
      while (end + 1 < size && get(r, end + 1)) end += 1;
      const w = end - c + 1;
      d += `M${c + quiet} ${r + quiet}h${w}v1h-${w}z`;
      c = end + 1;
    }
  }
  return d;
}

/**
 * Synchronous on purpose. The async data-URL path flashes an empty panel on
 * first paint, which on a ten-foot screen reads as a broken code.
 */
export function buildHandoffQr(text: string, opts: HandoffQrOptions = {}): HandoffQr | null {
  const quiet = opts.quiet ?? QUIET;
  const qr = (() => {
    try {
      return QRCode.create(text, { errorCorrectionLevel: "M" });
    } catch {
      return null;
    }
  })();
  if (!qr) return null;
  const size = qr.modules.size;
  const extent = size + quiet * 2;
  const path = runsToPath((r, c) => qr.modules.get(r, c), size, quiet);
  const viewBox = `0 0 ${extent} ${extent}`;
  const dark = opts.dark ?? QR_DARK;
  const light = opts.light ?? QR_LIGHT;
  const title = opts.title
    ? `<title>${opts.title.replace(/[<>&]/g, "")}</title>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges" role="img">` +
    `${title}<rect width="${extent}" height="${extent}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/></svg>`;
  return { extent, path, viewBox, svg };
}
