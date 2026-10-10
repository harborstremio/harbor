import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT, useUiLanguage } from "@/lib/i18n";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { rpdbPoster } from "@/lib/providers/rpdb";
import { useSettings } from "@/lib/settings";
import { claimUniqueArt, releaseUniqueArt } from "@/lib/unique-art";
import { useView } from "@/lib/view";
import { Row } from "./row";
import { Poster } from "./poster";

const ISO = [
  "JP",
  "KR",
  "EG",
  "IN",
  "FR",
  "RU",
  "TR",
  "IT",
  "IR",
  "MX",
  "BR",
  "ES",
  "HK",
  "DE",
  "SE",
  "NG",
  "AR",
  "DK",
  "PL",
  "TH",
];

const FALLBACK: Record<string, string> = {
  JP: "Japan",
  KR: "South Korea",
  EG: "Egypt",
  IN: "India",
  FR: "France",
  RU: "Russia",
  TR: "Turkey",
  IT: "Italy",
  IR: "Iran",
  MX: "Mexico",
  BR: "Brazil",
  ES: "Spain",
  HK: "Hong Kong",
  DE: "Germany",
  SE: "Sweden",
  NG: "Nigeria",
  AR: "Argentina",
  DK: "Denmark",
  PL: "Poland",
  TH: "Thailand",
};

export function CountryTiles({ title }: { title?: string }) {
  const t = useT();
  const uiLang = useUiLanguage();
  const regionName = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([uiLang], { type: "region", style: "short" });
      return (iso: string) => names.of(iso) ?? FALLBACK[iso] ?? iso;
    } catch {
      return (iso: string) => FALLBACK[iso] ?? iso;
    }
  }, [uiLang]);
  return (
    <Row title={title ?? t("Browse by Country")} min={210} shape="tile" alwaysActive>
      {ISO.map((iso) => (
        <CountryTile key={iso} iso={iso} name={regionName(iso)} />
      ))}
    </Row>
  );
}

function CountryTile({ iso, name }: { iso: string; name: string }) {
  const { settings } = useSettings();
  const { openFilter } = useView();
  const [art, setArt] = useState<Meta[]>([]);

  useEffect(() => {
    let cancelled = false;
    const key = `country:${iso}`;
    tmdbDiscover(settings.tmdbKey, "movie", {
      with_origin_country: iso,
      sort_by: "popularity.desc",
      "vote_count.gte": "20",
    })
      .then((list) => {
        if (cancelled) return;
        const pool = list.filter((m) => m.background);
        setArt(claimUniqueArt(key, pool, (m) => m.id, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      releaseUniqueArt(key);
    };
  }, [iso, settings.tmdbKey]);

  return (
    <button
      type="button"
      onClick={() => openFilter({ kind: "country", mediaType: "movie", name, iso })}
      className="group relative aspect-[5/4] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft bg-elevated text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
    >
      <Collage art={art} rpdbKey={settings.rpdbKey} />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-canvas/40 via-canvas/65 to-canvas/85"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent"
      />
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-2">
        <h3 className="min-w-0 truncate font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
          {name}
        </h3>
        <span
          className="dir-icon shrink-0 text-[18px] text-ink-muted transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}

function Collage({ art, rpdbKey }: { art: Meta[]; rpdbKey: string }) {
  if (art.length === 0) return null;
  return (
    <div className="absolute inset-0 grid grid-cols-3">
      {art.slice(0, 3).map((m, i) => (
        <div
          key={m.id}
          className="relative overflow-hidden"
          style={{ transform: `skewX(-8deg) translateX(${(i - 1) * 6}px)` }}
        >
          <Poster
            src={rpdbPoster(rpdbKey, m.id, m.background ?? m.poster)}
            seed={m.id}
            ratio="landscape"
            lazy="release"
            className="h-full rounded-none [transform:skewX(8deg)_scale(1.4)]"
          />
        </div>
      ))}
    </div>
  );
}
