import { ArrowDownToLine, CalendarClock, Check, Download, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { toggleAutoDownload, useIsAutoDownloaded } from "@/lib/auto-download";
import { pendingSeasonEpisodes } from "@/lib/download/season-download";
import { useDownloads } from "@/lib/download/downloads-store";
import { useView } from "@/lib/view";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";

export function EpisodeDownloadsMenu({ meta, episodes }: { meta: Meta; episodes: PlayEpisode[] }) {
  const t = useT();
  const { openPicker, setView } = useView();
  useDownloads();
  const autoOn = useIsAutoDownloaded(meta.id);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pendingEpisodes = pendingSeasonEpisodes(meta.id, episodes);
  const pending = pendingEpisodes.length;

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({
      x: Math.max(8, Math.min(r.right - 240, window.innerWidth - 248)),
      y: Math.min(r.bottom + 8, window.innerHeight - 180),
    });
  };

  const startSeason = () => {
    setMenu(null);
    const firstEpisode = pendingEpisodes[0];
    if (!firstEpisode) return;
    openPicker(meta, firstEpisode, {
      intent: "download",
      seasonEpisodes: pendingEpisodes,
    });
  };

  return (
    <>
      <HoverTooltip
        label={autoOn ? t("Auto-downloading new episodes") : t("Download")}
        side="top"
        align="center"
      >
        <button
          ref={btnRef}
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => (menu ? setMenu(null) : openMenu())}
          aria-label={t("Download")}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            autoOn
              ? "bg-accent/12 text-accent"
              : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
          }`}
        >
          <ArrowDownToLine size={16} strokeWidth={2} />
        </button>
      </HoverTooltip>
      {menu &&
        createPortal(
          <div
            role="menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[320] flex w-[236px] flex-col rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            <MenuItem
              icon={<Download size={15} strokeWidth={2} />}
              label={pending > 0 ? t("Download this season") : t("Season saved offline")}
              sub={pending > 0 ? t("{n} episodes", { n: pending }) : undefined}
              disabled={pending === 0}
              onClick={startSeason}
            />
            <div className="my-1 h-px bg-edge-soft" />
            <MenuItem
              icon={
                autoOn ? (
                  <Check size={15} strokeWidth={2.4} />
                ) : (
                  <CalendarClock size={15} strokeWidth={2} />
                )
              }
              label={t("Auto-download new episodes")}
              sub={
                autoOn
                  ? t("On. New episodes grab themselves.")
                  : t("Grab each new episode as it airs")
              }
              active={autoOn}
              onClick={() => {
                toggleAutoDownload(meta);
                setMenu(null);
              }}
            />
            {autoOn && (
              <MenuItem
                icon={<SlidersHorizontal size={15} strokeWidth={2} />}
                label={t("Schedule & options")}
                onClick={() => {
                  setView("downloads");
                  setMenu(null);
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-start transition-colors ${
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-raised"
      }`}
    >
      <span className={`mt-0.5 ${active ? "text-accent" : "text-ink-muted"}`}>{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className={`text-[13px] font-medium ${active ? "text-accent" : "text-ink"}`}>
          {label}
        </span>
        {sub && <span className="text-[11.5px] leading-snug text-ink-subtle">{sub}</span>}
      </span>
    </button>
  );
}
