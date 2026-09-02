import { useEffect, useState } from "react";
import { Bookmark, Eye, Hash, MoveVertical, Popcorn } from "lucide-react";
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
import { useT } from "@/lib/i18n";
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
  topStart: "top-1.5 start-1.5",
  topEnd: "top-1.5 end-1.5",
  bottomStart: "bottom-1.5 start-1.5",
  bottomEnd: "bottom-1.5 end-1.5",
};

function previewExtras(f: PreviewFlags): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (f.showPopcorn)
    out.push(
      <span className="flex items-center gap-0.5">
        <Popcorn size={12} strokeWidth={2.4} className="text-accent" />
        <span>85%</span>
      </span>,
    );
  if (f.showMetacritic)
    out.push(
      <span className="flex h-[12px] min-w-[14px] items-center justify-center rounded-[3px] bg-success px-0.5 text-[8px] font-bold text-white">
        78
      </span>,
    );
  if (f.showLetterboxd)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={letterboxdLogo} alt="" className="h-[10px] w-[10px] rounded-[2px] object-cover" />
        <span>4.2</span>
      </span>,
    );
  if (f.showMdblist)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={mdblistLogo} alt="" className="h-[10px] w-[10px] rounded-[2px] object-contain" />
        <span>76</span>
      </span>,
    );
  if (f.showTrakt)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={traktLogo} alt="" className="h-[10px] w-[10px] object-contain" />
        <span>88%</span>
      </span>,
    );
  if (f.showSimkl)
    out.push(
      <span className="flex items-center gap-0.5">
        <img src={simklLogo} alt="" className="h-[10px] w-[10px] rounded-[2px] object-contain" />
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
  if (nodes.length === 0) return null;
  const scale = nodes.length <= 3 ? 1 : nodes.length === 4 ? 0.88 : nodes.length === 5 ? 0.78 : 0.7;
  return (
    <div
      style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "right" } : undefined}
      className={`absolute end-1.5 flex items-center gap-1 whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 text-[9px] font-semibold text-ink transition-opacity duration-700 ease-in-out ${badgePos} ${
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
        <ImdbIcon className="h-[10px] w-auto rounded-[2px]" />
        <span>8.4</span>
      </span>,
    );
  else if (flags.showTmdb)
    normal.push(
      <span className="flex items-center gap-1">
        <img src={tmdbLogo} alt="" className="h-[11px] w-auto object-contain" />
        <span>7.9</span>
      </span>,
    );
  if (flags.showRt)
    normal.push(
      <span className="flex items-center gap-0.5">
        <RtFresh className="h-[11px] w-auto" />
        <span>92%</span>
      </span>,
    );
  normal.push(...extras);

  const anime: React.ReactNode[] = [];
  if (flags.showMal)
    anime.push(
      <span className="flex items-center gap-0.5">
        <MalLogo className="h-[10px] w-auto text-ink-muted" />
        <span>8.7</span>
      </span>,
    );
  anime.push(...extras);

  const cap = Math.max(1, limit);
  const badgePos = position === "top" ? "top-1.5" : "bottom-1.5";
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
          className={`absolute z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-canvas text-ink ${WL_PREVIEW_POS[watchlistBadge]}`}
        >
          <Bookmark size={9} strokeWidth={2.6} fill="currentColor" />
        </span>
      )}
    </div>
  );
}

function Choice({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative z-10 min-w-[34px] rounded-[4px] px-3 py-2 text-[12.5px] font-bold tracking-[0.04em] transition-colors ${
        disabled
          ? "cursor-not-allowed text-ink-subtle opacity-40"
          : active
            ? "bg-ink text-canvas"
            : "text-ink-subtle hover:text-ink"
      }`}
    >
      {children}
    </button>
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
  const on = value !== "off";
  const [last, setLast] = useState<Exclude<WatchlistPos, "off">>(value !== "off" ? value : "topEnd");
  const corners: Array<{ value: Exclude<WatchlistPos, "off">; label: string }> = [
    { value: "topStart", label: t("Top left") },
    { value: "topEnd", label: t("Top right") },
    { value: "bottomStart", label: t("Bottom left") },
    { value: "bottomEnd", label: t("Bottom right") },
  ];
  return (
    <>
      <ToggleRow
        label={t("Watchlist bookmark")}
        sub={t("Show a bookmark on saved titles")}
        leading={<Bookmark size={16} strokeWidth={2.2} className="text-ink-muted" />}
        value={on}
        onChange={(v) => onChange(v ? last : "off")}
      />
      {on && (
        <Nested>
          <SettingRow
            label={t("Bookmark corner")}
            desc={t("Where the bookmark sits on the poster.")}
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
    <div className="flex flex-col gap-1.5">
      <SettingRow
        wide
        icon={<Eye size={16} strokeWidth={2.2} />}
        label={t("Live preview")}
        desc={t("A real poster with your scores on it. It swaps to an anime title every few seconds so you can check both sets.")}
      >
        <div className="mx-auto w-36">
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
        icon={<MoveVertical size={16} strokeWidth={2.2} />}
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
        icon={<Hash size={16} strokeWidth={2.2} />}
        label={t("Max scores per card")}
        desc={t("{n} enabled", { n: enabledBadgeCount })}
        tip={t("Extra scores are dropped from the end of the chip. Turn scores on or off in the list above.")}
      >
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 rounded-md bg-canvas p-1">
          {[2, 3, 4, 5, 6].map((n) => (
            <Choice
              key={n}
              active={effLimit === n}
              disabled={n > maxN}
              onClick={() => update({ cardBadgeLimit: n })}
            >
              {n}
            </Choice>
          ))}
        </div>
      </SettingRow>

    </div>
  );
}
