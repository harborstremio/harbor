import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { Poster } from "@/components/poster";
import { useArtGlow } from "../big-picture/bp-art-color";
import "../ebook-book3d.css";

function openingLines(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function EBookBook3D({
  cover,
  seed,
  title,
  author,
  text,
  imprint,
  scale = 1,
  thickness = 9,
  lazy = false,
  mode = "open",
  children,
}: {
  cover?: string;
  seed: string;
  title: string;
  author?: string;
  text?: string;
  imprint?: string;
  scale?: number;
  thickness?: number;
  lazy?: boolean;
  mode?: "open" | "lift";
  children?: ReactNode;
}) {
  const art = useArtGlow(cover);
  const opening = text ? openingLines(text) : "";
  const titleFit = title.length > 78 ? 0.56 : title.length > 54 ? 0.68 : title.length > 34 ? 0.82 : 1;
  const root = useRef<HTMLDivElement>(null);
  const track = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const el = root.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      el.style.setProperty("--hbk-mx", String((event.clientX - box.left) / box.width - 0.5));
      el.style.setProperty("--hbk-my", String((event.clientY - box.top) / box.height - 0.5));
    },
    [],
  );
  const release = useCallback(() => {
    root.current?.style.setProperty("--hbk-mx", "0");
    root.current?.style.setProperty("--hbk-my", "0");
  }, []);
  return (
    <div
      ref={root}
      className="hbk"
      data-mode={mode}
      onPointerMove={mode === "lift" ? track : undefined}
      onPointerLeave={mode === "lift" ? release : undefined}
      style={
        {
          "--hbk-scale": scale,
          "--hbk-thick": `${thickness}px`,
          "--hbk-title": titleFit,
          ...(art ? { "--hbk-art": art } : null),
        } as CSSProperties
      }
    >
      <div className="hbk-block">
        <div className="hbk-spine" aria-hidden="true" />
        <div className="hbk-edge" aria-hidden="true" />

        <div className="hbk-paper">
          <div className="hbk-page">
            <p className="hbk-page-title">{title}</p>
            {author && <p className="hbk-page-by">{author}</p>}
            <span className="hbk-page-rule" aria-hidden="true" />
            {opening && (
              <div className="hbk-page-text">
                <p className="hbk-page-drift">{opening}</p>
              </div>
            )}
            {imprint && <p className="hbk-page-mark">{imprint}</p>}
          </div>
        </div>

        <div className="hbk-cover">
          <div className="hbk-face">
            <Poster src={cover} seed={seed} ratio="portrait" lazy={lazy} />
          </div>
          <div className="hbk-inside" aria-hidden="true" />
        </div>

        {children}
      </div>
    </div>
  );
}
