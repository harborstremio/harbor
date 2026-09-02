import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { readNumber, readRow, type TvDoc } from "./model";
import { SUB_FAMILY_CSS, SUB_LOOK_ROWS, tintCss } from "./model-look";

const STILL = "https://image.tmdb.org/t/p/w780/eGX66zonvc4bXg3rM08RUxdYSDx.jpg";
const TV_BASE_PX = 32;
const TV_WIDTH = 1920;
const LEGIBILITY_LIFT = 1.55;

function rowOf(key: string) {
  const row = SUB_LOOK_ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`unknown sub look row ${key}`);
  return row;
}

function num(doc: TvDoc, key: string): number {
  const row = rowOf(key);
  if (row.kind !== "step") return 0;
  return readNumber(doc, row);
}

function pick(doc: TvDoc, key: string): string {
  const v = readRow(doc, rowOf(key));
  return typeof v === "string" ? v : "";
}

function flag(doc: TvDoc, key: string): boolean {
  return readRow(doc, rowOf(key)) === true;
}

function rgba(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, pct)) / 100})`;
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(672);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 672));
    ro.observe(el);
    setW(el.clientWidth || 672);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function SubPreview({ doc }: { doc: TvDoc }) {
  const t = useT();
  const [ref, width] = useWidth();

  const sizePct = num(doc, "subLookSize");
  const opacity = num(doc, "subLookOpacity");
  const outline = num(doc, "subLookOutline");
  const boxOpacity = num(doc, "subLookBoxOpacity");
  const bottom = num(doc, "subLookBottom");
  const gap = num(doc, "subLookGap");
  const edge = pick(doc, "subLookEdge");
  const align = pick(doc, "subLookAlign");
  const bold = flag(doc, "subLookBold");

  const ink = tintCss(pick(doc, "subLookTint"));
  const edgeInk = tintCss(pick(doc, "subLookEdgeTint"));
  const boxInk = tintCss(pick(doc, "subLookBoxTint"));

  const fontPx = (width / TV_WIDTH) * TV_BASE_PX * (sizePct / 100) * LEGIBILITY_LIFT;
  const strokePx = outline * fontPx * 0.012;

  const shadow =
    edge === "Shadow"
      ? `0 ${(strokePx * 0.6).toFixed(2)}px ${(strokePx * 1.8).toFixed(2)}px ${edgeInk}`
      : edge === "Outline"
        ? [
            `${strokePx.toFixed(2)}px 0 0 ${edgeInk}`,
            `-${strokePx.toFixed(2)}px 0 0 ${edgeInk}`,
            `0 ${strokePx.toFixed(2)}px 0 ${edgeInk}`,
            `0 -${strokePx.toFixed(2)}px 0 ${edgeInk}`,
          ].join(", ")
        : "none";

  const justify =
    align === "Left" ? "flex-start" : align === "Right" ? "flex-end" : "center";

  return (
    <div
      ref={ref}
      className="relative aspect-video w-full overflow-hidden rounded-md bg-canvas"
    >
      <img
        src={STILL}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div
        className="absolute inset-x-0 flex flex-col"
        style={{
          bottom: `${bottom}%`,
          alignItems: justify,
          gap: `${gap * fontPx * 0.02}px`,
          paddingInline: "6%",
        }}
      >
        {[t("They said the harbour would be quiet tonight."), t("Nobody told the sea.")].map(
          (line, i) => (
            <span
              key={i}
              style={{
                fontSize: `${fontPx.toFixed(2)}px`,
                lineHeight: 1.2,
                fontFamily: SUB_FAMILY_CSS[pick(doc, "subLookFamily")] ?? SUB_FAMILY_CSS.Sans,
                fontWeight: bold ? 700 : 400,
                color: rgba(ink, opacity),
                textShadow: shadow,
                backgroundColor: edge === "Box" ? rgba(boxInk, boxOpacity) : "transparent",
                padding: edge === "Box" ? `${fontPx * 0.12}px ${fontPx * 0.4}px` : undefined,
                borderRadius: edge === "Box" ? `${fontPx * 0.14}px` : undefined,
                textAlign: align === "Left" ? "left" : align === "Right" ? "right" : "center",
              }}
            >
              {line}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
