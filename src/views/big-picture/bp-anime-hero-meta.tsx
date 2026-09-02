import { Check } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { MalLogo } from "@/components/icons/mal-logo";
import { findTopAward, parseAwardYear, type AwardWin } from "@/lib/anime-awards";
import { useAwardMasterVersion } from "@/lib/anime-awards-source";
import type { Meta } from "@/lib/cinemeta";
import { useMalScore } from "@/lib/mal-rating";
import {
  animeHasDub,
  dubSetReady,
  ensureDubSet,
  subscribeDubSet,
} from "@/lib/providers/anime-dub-sub";
import { useSettings } from "@/lib/settings";
import type { LibraryItem } from "@/lib/stremio";
import { bpAwardShortLabel } from "./bp-card-marks";
import { useBpT } from "./bp-i18n";

type T = (key: string, vars?: Record<string, string | number>) => string;

const PILL_TOP =
  "inline-flex h-[20px] max-w-full shrink-0 items-center rounded-sm bg-ink px-[9px] text-[9.8px] font-bold uppercase leading-none tracking-[0.04em] text-[var(--color-canvas)]";

const PILL_GREY =
  "inline-flex h-[19px] shrink-0 items-center rounded-sm bg-[var(--bp-edge-2)] px-[8px] text-[10.7px] font-semibold leading-none tracking-[0.02em] text-ink";

const FORMATS: Record<string, string> = {
  TV: "Series",
  MOVIE: "Film",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
};

function bpFormat(meta: Meta | null, t: T): string {
  const label = FORMATS[(meta?.animeFormat ?? "").toUpperCase()];
  return label ? t(label) : "";
}

function bpCountry(meta: Meta | null): string {
  const c = meta?.country ?? "";
  return c.length > 3 && c !== "Japan" ? c : "";
}

function bpEpisode(item: LibraryItem, t: T): string {
  const s = item.state?.season ?? 0;
  const e = item.state?.episode ?? 0;
  if (e <= 0) return "";
  return s > 0 ? t("S{s} E{e}", { s, e }) : t("E{e}", { e });
}

function bpMinutesLeft(item: LibraryItem, t: T): string {
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  if (dur <= 0) return "";
  const n = Math.round((dur - off) / 60000);
  return n >= 1 ? t("{n} min left", { n }) : "";
}

function useBpHeroDub(metaId: string | undefined): boolean {
  const { settings } = useSettings();
  const want = settings.showDubBadge && Boolean(metaId);
  const ready = useSyncExternalStore(subscribeDubSet, dubSetReady);
  useEffect(() => {
    if (want) ensureDubSet();
  }, [want]);
  return want && ready && animeHasDub(metaId ?? "");
}

function bpAwardPill(win: AwardWin, t: T): string {
  if (win.isAOTY) return t("Anime of the year");
  return t("Best {label}", { label: bpAwardShortLabel(win, t) });
}

function bpTopLine(hero: Meta | null, t: T): string {
  if (!hero) return "";
  const win = findTopAward(hero.name ?? "", parseAwardYear(hero.releaseInfo), hero.id);
  if (win) return bpAwardPill(win, t);
  if (hero.releaseInfo && hero.releaseInfo === String(new Date().getFullYear())) return t("New");
  return "";
}

export function BpAnimeHeroMeta({
  hero,
  resume,
}: {
  hero: Meta | null;
  resume: LibraryItem | null;
}) {
  const t = useBpT();
  const mal = useMalScore(hero ?? undefined);
  useAwardMasterVersion();

  const score = mal.score ? (
    <span className="flex items-center gap-[6px] text-ink">
      {mal.fromMal && <MalLogo className="h-[13px] w-auto" />}
      <span className="tabular-nums">{mal.score}</span>
    </span>
  ) : (
    ""
  );

  const slots: ReactNode[] = resume
    ? [bpEpisode(resume, t), bpMinutesLeft(resume, t), hero?.releaseInfo ?? ""]
    : [hero?.genres?.[0] ?? "", score, hero?.releaseInfo ?? "", bpCountry(hero)];

  const shown = slots.filter(Boolean);
  const format = bpFormat(hero, t);
  const top = bpTopLine(hero, t);
  const facts = shown.length > 0 || Boolean(format);

  if (!top && !facts) return null;

  return (
    <div className="mt-[12px]">
      {top && <span data-bp-anime-pill-top className={PILL_TOP}>{top}</span>}
      {facts && (
        <div
          data-bp-anime-facts
          className={`flex h-[20px] items-center gap-x-[16px] overflow-hidden whitespace-nowrap text-[13.4px] font-semibold tracking-[0.015em] text-ink-subtle ${
            top ? "mt-[13px]" : ""
          }`}
        >
          {shown.map((slot, i) => (
            <span key={i} className="flex items-center">
              {slot}
            </span>
          ))}
          {format && <span data-bp-anime-pill-grey className={PILL_GREY}>{format}</span>}
        </div>
      )}
    </div>
  );
}

export function BpAnimeHeroAvailability({ hero, fade }: { hero: Meta | null; fade: string }) {
  const t = useBpT();
  const dub = useBpHeroDub(hero?.id);
  if (!dub) return null;

  return (
    <div
      data-bp-xfade
      data-bp-anime-avail
      className={`mt-[10px] flex items-center gap-[7px] text-[12.5px] font-medium text-[color-mix(in_oklab,var(--color-ink)_68%,transparent)] ${fade}`}
    >
      <Check className="h-[13px] w-[13px] shrink-0" strokeWidth={3} />
      {t("Sub and Dub")}
    </div>
  );
}
