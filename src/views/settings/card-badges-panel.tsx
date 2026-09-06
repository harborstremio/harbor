import { useEffect, useState } from "react";
import { Bookmark, Eye, Hash, MoveVertical, Popcorn } from "./icons";
import { useHydratedPoster, useSampleArtwork } from "@/lib/sample-artwork";
import previewPoster3 from "@/assets/preview/poster3.webp";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { RtFresh } from "@/components/icons/rt-fresh";
import type { Settings } from "@/lib/settings";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { Segmented, ToggleRow } from "./shared";
import { SettingRow, Nested } from "./kit";

export type PreviewFlags = {
  showImdb: boolean;
  showTmdb: boolean;
  showRt: boolean;
  showPopcorn: boolean;
  showMetacritic: boolean;
  showLetterboxd: boolean;
  showMdblist: boolean;
  showTrakt: boolean;
  showMal: boolean;
  showSimkl: boolean;
};

type WatchlistPos = "off" | "topStart" | "topEnd" | "bottomStart" | "bottomEnd";

const WL_PREVIEW_POS: Record<string, string> = {
  topStart: "top-2 start-2",
  topEnd: "top-2 end-2",
  bottomStart: "bottom-2 start-2",
  bottomEnd: "bottom-2 end-2",
};

function useIsRtl(): boolean {
  return isRtl(useUiLanguage());
}

function previewExtras(f: PreviewFlags): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (f.showPopcorn)
    out.push(
      <span className="flex items-center gap-0.5">
        <Popcorn size={15} strokeWidth={2.4} className="text-accent" />
        <span>85%</span>
      </span>,
    );
  if (f.showMetacritic)
    out.push(
      <span className="flex h-[15px] min-w-[18px] items-center justify-center rounded-sm bg-success px-1 text-[10px] font-bold text-canvas">
        78
      </span>,
    );
  if (f.showLetterboxd)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={letterboxdLogo} alt="" className="h-[13px] w-[13px] rounded-sm object-cover" />
        <span>4.2</span>
      </span>,
    );
  if (f.showMdblist)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={mdblistLogo} alt="" className="h-[13px] w-[13px] rounded-sm object-contain" />
        <span>76</span>
      </span>,
    );
  if (f.showTrakt)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={traktLogo} alt="" className="h-[13px] w-[13px] object-contain" />
        <span>88%</span>
      </span>,
    );
  if (f.showSimkl)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={simklLogo} alt="" className="h-[13px] w-[13px] rounded-sm object-contain" />
        <span>8.5</span>
      </span>,
    );
  return out;
}

function PreviewBadgeRow({
  nodes,
  badgePos,
  visible,
}: {
  nodes: React.ReactNode[];
  badgePos: string;
  visible: boolean;
}) {
  const rtl = useIsRtl();
  if (nodes.length === 0) return null;
  const scale = nodes.length <= 3 ? 1 : nodes.length === 4 ? 0.88 : nodes.length === 5 ? 0.78 : 0.7;
  return (
    <div
      style={
        scale < 1
          ? { transform: `scale(${scale})`, transformOrigin: rtl ? "left" : "right" }
          : undefined
      }
      className={`absolute end-2 flex items-center gap-1 whitespace-nowrap rounded-sm bg-canvas px-2 py-1 text-[11px] font-semibold text-ink transition-opacity duration-700 ease-in-out ${badgePos} ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {nodes.map((node, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="opacity-30">·</span>}
          {node}
        </span>
      ))}
    </div>
  );
}

function PreviewCard({
  position,
  phase,
  flags,
  watchlistBadge,
  limit,
}: {
  position: "top" | "bottom";
  phase: "normal" | "anime";
  flags: PreviewFlags;
  watchlistBadge: WatchlistPos;
  limit: number;
}) {
  const normalPoster = useSampleArtwork().poster;
  const animePoster = useHydratedPoster("tt0245429", previewPoster3);
  const extras = previewExtras(flags);
  const normal: React.ReactNode[] = [];
  if (flags.showImdb)
    normal.push(
      <span className="flex items-center gap-1">
        <ImdbIcon className="h-[13px] w-auto" />
        <span>8.4</span>
      </span>,
    );
  else if (flags.showTmdb)
    normal.push(
      <span className="flex items-center gap-1">
        <img src={tmdbLogo} alt="" className="h-[14px] w-auto object-contain" />
        <span>7.9</span>
      </span>,
    );
  if (flags.showRt)
    normal.push(
      <span className="flex items-center gap-0.5">
        <RtFresh className="h-[14px] w-auto" />
        <span>92%</span>
      </span>,
    );
  normal.push(...extras);

  const anime: React.ReactNode[] = [];
  if (flags.showMal)
    anime.push(
      <span className="flex items-center gap-0.5">
        <MalLogo className="h-[13px] w-auto text-ink-muted" />
        <span>8.7</span>
      </span>,
    );
  anime.push(...extras);

  const cap = Math.max(1, limit);
  const badgePos = position === "top" ? "top-2" : "bottom-2";
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-raised">
      <img
        src={normalPoster}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
          phase === "normal" ? "opacity-100" : "opacity-0"
        }`}
      />
      <img
        src={animePoster}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
          phase === "anime" ? "opacity-100" : "opacity-0"
        }`}
      />
      <PreviewBadgeRow nodes={normal.slice(0, cap)} badgePos={badgePos} visible={phase === "normal"} />
      <PreviewBadgeRow nodes={anime.slice(0, cap)} badgePos={badgePos} visible={phase === "anime"} />
      {watchlistBadge !== "off" && (
        <span
          className={`absolute z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-canvas text-ink ${WL_PREVIEW_POS[watchlistBadge]}`}
        >
          <Bookmark size={11} strokeWidth={2.6} fill="currentColor" />
        </span>
      )}
    </div>
  );
}

function LimitScale({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-0.5 rounded-[10px] bg-canvas p-1">
      {[2, 3, 4, 5, 6].map((n) => {
        const disabled = n > max;
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(n)}
            className={`h-11 min-w-[44px] rounded-[6px] px-3 text-[16.5px] font-semibold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              disabled
                ? "cursor-not-allowed text-ink-subtle opacity-40"
                : active
                  ? "bg-ink text-canvas"
                  : "text-ink-subtle hover:text-ink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function WatchlistControl({
  value,
  onChange,
}: {
  value: WatchlistPos;
  onChange: (v: WatchlistPos) => void;
}) {
  const t = useT();
  const rtl = useIsRtl();
  const on = value !== "off";
  const [last, setLast] = useState<Exclude<WatchlistPos, "off">>(value !== "off" ? value : "topEnd");
  const corners: Array<{ value: Exclude<WatchlistPos, "off">; label: string }> = [
    { value: "topStart", label: rtl ? t("Top right") : t("Top left") },
    { value: "topEnd", label: rtl ? t("Top left") : t("Top right") },
    { value: "bottomStart", label: rtl ? t("Bottom right") : t("Bottom left") },
    { value: "bottomEnd", label: rtl ? t("Bottom left") : t("Bottom right") },
  ];
  return (
    <>
      <ToggleRow
        label={t("Watchlist bookmark")}
        sub={t("Puts a small bookmark on posters you have already saved.")}
        leading={<Bookmark size={18} strokeWidth={2.2} className="text-ink-muted" />}
        value={on}
        onChange={(v) => onChange(v ? last : "off")}
      />
      {on && (
        <Nested>
          <SettingRow
            wide
            label={t("Bookmark corner")}
            desc={t("Pick which corner of the poster the bookmark sits in.")}
          >
            <Segmented
              value={value}
              options={corners}
              onChange={(v) => {
                const c = v as Exclude<WatchlistPos, "off">;
                setLast(c);
                onChange(c);
              }}
            />
          </SettingRow>
        </Nested>
      )}
    </>
  );
}

export function CardBadgesPanel({
  settings,
  update,
  flags,
  enabledBadgeCount,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  flags: PreviewFlags;
  enabledBadgeCount: number;
}) {
  const t = useT();
  const [phase, setPhase] = useState<"normal" | "anime">("normal");
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p === "normal" ? "anime" : "normal")), 4000);
    return () => window.clearInterval(id);
  }, []);
  const placement: "top" | "bottom" = settings.badgePlacement === "top" ? "top" : "bottom";
  const maxN = Math.max(2, enabledBadgeCount);
  const effLimit = Math.min(settings.cardBadgeLimit, maxN);

  return (
    <>
      <SettingRow
        wide
        icon={<Eye size={18} strokeWidth={2.2} />}
        label={t("Live preview")}
        desc={t(
          "A real poster with your scores on it. It swaps to an anime title every few seconds so you can check both sets.",
        )}
      >
        <div className="w-[200px] max-w-full">
          <PreviewCard
            position={placement}
            phase={phase}
            flags={flags}
            watchlistBadge={settings.watchlistBadge}
            limit={effLimit}
          />
        </div>
      </SettingRow>

      <SettingRow
        icon={<MoveVertical size={18} strokeWidth={2.2} />}
        label={t("Score position")}
        desc={t("Which end of the poster the score chip rides on.")}
      >
        <Segmented
          value={placement}
          options={[
            { value: "top", label: t("Top") },
            { value: "bottom", label: t("Bottom") },
          ]}
          onChange={(v) => update({ badgePlacement: v as "top" | "bottom" })}
        />
      </SettingRow>

      <SettingRow
        icon={<Hash size={18} strokeWidth={2.2} />}
        label={t("Max scores per card")}
        desc={t(
          "Caps how many score chips a poster shows. Extras drop off the end of the chip. You have {n} turned on.",
          { n: enabledBadgeCount },
        )}
      >
        <LimitScale value={effLimit} max={maxN} onChange={(n) => update({ cardBadgeLimit: n })} />
      </SettingRow>
    </>
  );
}
