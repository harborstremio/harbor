import { useEffect, useState } from "react";
import { CoverImg } from "@/components/cover-img";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { collectionsForTitle } from "@/lib/manga/collections";
import { hasAnyMangaSource } from "@/lib/manga/sources";
import { useView } from "@/lib/view";

const BADGE_ART: Record<string, string> = {
  popular: "/awards/most-popular-clean.webp",
  acclaimed: "/awards/critically-acclaimed.webp",
  "anime-expo": "/awards/featured-anime-expo.webp",
  eisner: "/awards/eisner.webp",
  harvey: "/awards/harvey.webp",
  seiun: "/awards/seiun.webp",
};

export function badgeArtFor(id: string): string | undefined {
  return BADGE_ART[id];
}

const AWARD_LABEL: Record<string, string> = {
  eisner: "Eisner Winning Manga",
  harvey: "Harvey Award Winning Manga",
  seiun: "Seiun Award Winning Manga",
};

export function MangaAwardCorner({
  title,
  fallbackPoster,
}: {
  title?: string;
  fallbackPoster?: string;
}) {
  const t = useT();
  const { openManga } = useView();
  const award = collectionsForTitle(title).find((c) => c.award && BADGE_ART[c.id]);
  const [poster, setPoster] = useState<string | null>(null);
  const [mangaId, setMangaId] = useState<string | null>(null);
  useEffect(() => {
    if (!award || !title) return;
    let cancelled = false;
    void import("@/lib/manga/api")
      .then(({ searchManga }) => searchManga(title, 0))
      .then((list) => {
        if (cancelled) return;
        setPoster(list?.[0]?.cover ?? null);
        setMangaId(list?.[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [award, title]);
  if (!award) return null;
  const label = t(AWARD_LABEL[award.id] ?? `${award.badge} Manga`);
  const canOpen = !!mangaId && hasAnyMangaSource();
  const shownPoster = poster ?? fallbackPoster ?? null;
  const inner = (
    <>
      {shownPoster && (
        <span className="relative shrink-0">
          <CoverImg
            src={shownPoster}
            alt=""
            draggable={false}
            className="h-14 w-[38px] rounded-md object-cover shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-1 ring-edge-soft"
          />
          <img
            src={BADGE_ART[award.id]}
            alt=""
            draggable={false}
            className="absolute -end-2 -bottom-2 h-7 w-7 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)]"
          />
        </span>
      )}
      {!shownPoster && (
        <img
          src={BADGE_ART[award.id]}
          alt=""
          draggable={false}
          className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
        />
      )}
      <div className="flex flex-col text-end">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink/55">
          {t("Source")}
        </span>
        <span className="text-[13px] font-medium leading-snug text-ink/80">{label}</span>
      </div>
    </>
  );
  return (
    <HoverTooltip
      label={t(award.name)}
      sublabel={award.subtitle ? t(award.subtitle) : undefined}
      side="top"
      align="center"
      large
    >
      {canOpen ? (
        <button
          type="button"
          onClick={() => mangaId && openManga(mangaId)}
          aria-label={t("Open manga details")}
          className="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-canvas/45"
        >
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-canvas/45">
          {inner}
        </div>
      )}
    </HoverTooltip>
  );
}

export function CollectionBadges({
  title,
  size = 48,
  side = "top",
  awardsOnly = false,
}: {
  title?: string;
  size?: number;
  side?: "top" | "bottom";
  awardsOnly?: boolean;
}) {
  const t = useT();
  let withArt = collectionsForTitle(title).filter((c) => BADGE_ART[c.id]);
  if (awardsOnly) {
    const seenArt = new Set<string>();
    withArt = withArt.filter((c) => {
      if (!c.award && c.id !== "anime-expo") return false;
      if (seenArt.has(BADGE_ART[c.id])) return false;
      seenArt.add(BADGE_ART[c.id]);
      return true;
    });
  }
  if (withArt.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {withArt.map((c) => (
        <HoverTooltip
          key={c.id}
          label={t(c.name)}
          sublabel={c.subtitle ? t(c.subtitle) : undefined}
          side={side}
          align="center"
          large
          className="shrink-0"
        >
          <img
            src={BADGE_ART[c.id]}
            alt={t(c.name)}
            draggable={false}
            style={{ width: size, height: size }}
            className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
          />
        </HoverTooltip>
      ))}
    </div>
  );
}
