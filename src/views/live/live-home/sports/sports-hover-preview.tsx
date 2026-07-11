import { useT } from "@/lib/i18n";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import { fetchMatchSummary } from "@/lib/sports/espn";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function SportsHoverPreview({
  game,
  children,
  onSelect,
}: {
  game: SportsGame;
  children: React.ReactNode;
  onSelect?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [detail, setDetail] = useState<SportsMatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hovered) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    let active = true;
    timerRef.current = window.setTimeout(() => {
      setLoading(true);
      fetchMatchSummary(game.league, game.id).then((res) => {
        if (!active) return;
        if (res) setDetail(res);
        setLoading(false);
      });
    }, 400); // 400ms hover delay before fetching

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hovered, game.id, game.league]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      {children}
      {hovered && <PreviewPortal container={containerRef.current} game={game} detail={detail} loading={loading} />}
    </div>
  );
}

function PreviewPortal({
  container,
  game,
  detail,
  loading,
}: {
  container: HTMLDivElement | null;
  game: SportsGame;
  detail: SportsMatchDetail | null;
  loading: boolean;
}) {
  const t = useT();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!container) return;
    const updatePos = () => {
      const rect = container.getBoundingClientRect();
      setPos({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [container]);

  if (!container) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] flex w-[300px] -translate-x-1/2 -translate-y-[calc(100%+12px)] flex-col gap-3 overflow-hidden rounded-xl bg-elevated p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.78)] ring-1 ring-edge-soft animate-preview-in"
      style={{ top: pos.top, left: pos.left, transformOrigin: "bottom" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">{game.league}</span>
        <span className="text-[11px] font-bold text-ink-muted">{game.detail || t("Upcoming")}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2">
          {game.home.logo ? (
            <img src={game.home.logo} className="h-10 w-10 object-contain" alt="" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-canvas/50" />
          )}
          <span className="text-[12px] font-bold">{game.home.abbr || game.home.name}</span>
        </div>
        <div className="text-[22px] font-black tracking-tight">
          {game.home.score || "0"} - {game.away.score || "0"}
        </div>
        <div className="flex flex-col items-center gap-2">
          {game.away.logo ? (
            <img src={game.away.logo} className="h-10 w-10 object-contain" alt="" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-canvas/50" />
          )}
          <span className="text-[12px] font-bold">{game.away.abbr || game.away.name}</span>
        </div>
      </div>

      {loading && (
        <div className="flex h-12 items-center justify-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-subtle border-t-transparent" />
        </div>
      )}

      {detail && detail.events && detail.events.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-edge-soft/40 pt-3">
          {detail.events.slice(0, 3).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="font-bold text-ink-muted">{e.time}</span>
              <span className="flex-1 truncate text-ink">{e.text}</span>
            </div>
          ))}
          {detail.events.length > 3 && (
            <span className="text-center text-[10px] font-semibold text-ink-subtle">
              +{detail.events.length - 3} {t("more events")}
            </span>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
