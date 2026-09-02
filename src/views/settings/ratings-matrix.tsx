import { AlignLeft, Image as ImageIcon, Popcorn, Sparkles } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useKnobAnim } from "@/lib/knob-anim";
import { InfoTip, SettingRow } from "./kit";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { RtFresh } from "@/components/icons/rt-fresh";
import { RtRotten } from "@/components/icons/rt-rotten";
import type { Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export function ImdbBadge({ compact = false }: { compact?: boolean } = {}) {
  return (
    <ImdbIcon
      className={`shrink-0 rounded-[3px] ${compact ? "h-[18px]" : "h-7"} w-auto`}
    />
  );
}

export function MalBadge({ compact = false }: { compact?: boolean } = {}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md text-white ${
        compact ? "h-[18px] w-10 px-1.5" : "h-7 w-[52px] px-2.5"
      }`}
      style={{ background: "#2E51A2" }}
    >
      <MalLogo className={compact ? "h-2.5 w-auto" : "h-[14px] w-auto"} />
    </span>
  );
}

function TmdbBadge() {
  return <img src={tmdbLogo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />;
}

function RtPairBadge() {
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-canvas">
        <RtFresh className="h-4 w-4" />
      </span>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-canvas">
        <RtRotten className="h-4 w-4" />
      </span>
    </span>
  );
}

function PopcornBadge() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas">
      <Popcorn size={16} strokeWidth={2.2} className="text-accent" />
    </span>
  );
}

function MetacriticBadge() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success text-[13.5px] font-bold text-white">
      M
    </span>
  );
}

function LetterboxdBadge() {
  return <img src={letterboxdLogo} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />;
}

function MdblistBadge() {
  return <img src={mdblistLogo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />;
}

function TraktBadge() {
  return <img src={traktLogo} alt="" className="h-7 w-7 shrink-0 object-contain" />;
}

function SimklBadge() {
  return <img src={simklLogo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />;
}

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

type Source = {
  id: string;
  name: string;
  badge: React.ReactNode;
  cardKey: BoolKey;
  detailKey?: BoolKey;
  lockKey?: "tmdb" | "omdb" | "mdblist";
  anime?: boolean;
  note?: string;
  tip?: string;
};

function MiniToggle({
  on,
  disabled,
  label,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  const knob = useKnobAnim(on);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
        disabled ? "cursor-not-allowed bg-canvas opacity-60" : on ? "bg-ink" : "bg-edge"
      }`}
    >
      <span
        className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas ${
          on ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
        } ${knob}`}
      />
    </button>
  );
}

function ColumnHead({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <HoverTooltip side="top" align="center" label={hint}>
      <span className="flex w-10 cursor-help flex-col items-center gap-1 text-ink-subtle">
        {icon}
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em]">{label}</span>
      </span>
    </HoverTooltip>
  );
}

export function RatingsMatrix({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const t = useT();

  const lockReason = (key?: "tmdb" | "omdb" | "mdblist"): string | null => {
    if (key === "tmdb") return settings.tmdbKey ? null : t("Add a TMDB key above to unlock.");
    if (key === "omdb") return settings.omdbKey ? null : t("Add an OMDb key above to unlock.");
    if (key === "mdblist") return settings.mdblistKey ? null : t("Add an MDBList key above to unlock.");
    return null;
  };

  const sources: Source[] = [
    { id: "imdb", name: "IMDb", badge: <ImdbBadge />, cardKey: "showImdbBadge", detailKey: "showImdbDetail", lockKey: "tmdb" },
    { id: "tmdb", name: "TMDB", badge: <TmdbBadge />, cardKey: "showTmdbBadge", detailKey: "showTmdbDetail", lockKey: "tmdb", note: t("The TMDB community score.") },
    { id: "rt", name: t("Rotten Tomatoes"), badge: <RtPairBadge />, cardKey: "showRtBadge", detailKey: "showRtDetail", lockKey: "omdb" },
    { id: "audience", name: t("Audience"), badge: <PopcornBadge />, cardKey: "showPopcornBadge", detailKey: "showRtAudienceDetail", lockKey: "mdblist", tip: t("Rotten Tomatoes Popcornmeter, the audience score (%).") },
    { id: "metacritic", name: "Metacritic", badge: <MetacriticBadge />, cardKey: "showMetacriticBadge", detailKey: "showMetacriticDetail", lockKey: "mdblist" },
    { id: "letterboxd", name: "Letterboxd", badge: <LetterboxdBadge />, cardKey: "showLetterboxdBadge", detailKey: "showLetterboxdDetail", lockKey: "mdblist" },
    { id: "mdblist", name: "MDBList", badge: <MdblistBadge />, cardKey: "showMdblistBadge", detailKey: "showMdblistDetail", lockKey: "mdblist" },
    { id: "trakt", name: "Trakt", badge: <TraktBadge />, cardKey: "showTraktBadge", detailKey: "showTraktDetail", lockKey: "mdblist" },
    { id: "simkl", name: "SIMKL", badge: <SimklBadge />, cardKey: "showSimklBadge", detailKey: "showSimklDetail" },
    { id: "mal", name: "MAL", badge: <MalBadge />, cardKey: "showMalBadge", detailKey: "showMalDetail", anime: true },
  ];

  const setCard = (src: Source, next: boolean) => {
    if (src.id === "simkl") update({ showSimklBadge: next, simklShowCommunityRatings: next });
    else update({ [src.cardKey]: next } as Partial<Settings>);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1 px-1 pb-0.5">
        <span className="text-[13.5px] font-semibold text-ink">{t("Where scores appear")}</span>
        <span className="max-w-[74ch] text-[12.5px] leading-snug text-ink-subtle">
          {t("Give each score a home: on poster cards, on the detail page, or both. Flip the switch in each column.")}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] leading-snug text-ink-subtle">
          <Sparkles size={12} strokeWidth={2.2} className="shrink-0" />
          <span>{t("Native to Harbor. No RPDB or ratings addon needed.")}</span>
          <InfoTip
            text={t("These badges are drawn on posters as you browse. RPDB, in the keys above, is a separate option that bakes scores into the poster image itself.")}
          />
        </span>
      </div>

      <div className="flex items-end gap-1.5">
        <span className="w-[268px] shrink-0 px-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Rating")}
        </span>
        <div className="flex min-w-0 flex-1 items-end justify-end gap-4 px-4">
          <ColumnHead
            icon={<ImageIcon size={14} strokeWidth={2} />}
            label={t("Cards")}
            hint={t("The little score chip printed on poster cards across your rows and grids.")}
          />
          <ColumnHead
            icon={<AlignLeft size={14} strokeWidth={2} />}
            label={t("Details")}
            hint={t("The ratings row on a title's detail page, next to runtime and genre.")}
          />
        </div>
      </div>

      {sources.map((src) => {
        const lock = lockReason(src.lockKey);
        const cardVal = settings[src.cardKey] === true;
        const detailVal = src.detailKey ? settings[src.detailKey] === true : false;
        return (
          <SettingRow
            key={src.id}
            icon={
              <span className={`flex w-16 justify-center ${lock ? "saturate-50" : ""}`}>
                {src.badge}
              </span>
            }
            label={
              <>
                {src.name}
                {src.anime && (
                  <span className="rounded-full bg-raised px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {t("Anime")}
                  </span>
                )}
              </>
            }
            desc={src.note}
            tip={src.tip}
            lockReason={lock ?? undefined}
          >
            <MiniToggle
              on={cardVal && !lock}
              disabled={!!lock}
              label={`${src.name} ${t("Cards")}`}
              onClick={() => setCard(src, !cardVal)}
            />
            {src.detailKey ? (
              <MiniToggle
                on={detailVal}
                label={`${src.name} ${t("Details")}`}
                onClick={() => update({ [src.detailKey!]: !detailVal, showDetailRatings: true } as Partial<Settings>)}
              />
            ) : (
              <HoverTooltip
                side="top"
                align="center"
                label={t("This score only appears on cards.")}
              >
                <span className="flex h-6 w-10 shrink-0 cursor-help items-center justify-center rounded-full bg-canvas">
                  <span className="h-[3px] w-3 rounded-full bg-ink-subtle" />
                </span>
              </HoverTooltip>
            )}
          </SettingRow>
        );
      })}
    </div>
  );
}
