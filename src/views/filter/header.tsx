import { useEffect, useRef, useState } from "react";
import { Building2, Calendar, ChevronDown, Clock, Globe, Languages, Tag, Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { useView, type MetaFilter } from "@/lib/view";
import { runtimeRange } from "./rails-config";
import { BrandHero, useBrandArt } from "./brand-hero";

export function Header({ filter }: { filter: MetaFilter }) {
  const t = useT();
  const { kicker, title, subtitle, Icon } = describe(filter, t);
  const branded = filter.kind === "studio" || filter.kind === "network";
  const art = useBrandArt(
    branded ? filter.id : 0,
    filter.mediaType,
    filter.kind === "network" ? "network" : "studio",
  );
  if (branded) {
    return (
      <BrandHero art={art} kicker={kicker} title={title} subtitle={subtitle}>
        <MediaTypeToggle filter={filter} />
      </BrandHero>
    );
  }
  return (
    <div className="relative px-12 pb-10 pt-28">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted">
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="text-[12.5px] font-medium uppercase tracking-[0.22em] text-ink-subtle">
          {kicker}
        </span>
      </div>
      {filter.kind === "genre" ? (
        <GenreSwitcher activeName={title} mediaType={filter.mediaType} />
      ) : (
        <h1 className="mt-3 font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ink">
          {title}
        </h1>
      )}
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>
      {filter.kind === "country" && <MediaTypeToggle filter={filter} />}
    </div>
  );
}

function MediaTypeToggle({ filter }: { filter: MetaFilter }) {
  const t = useT();
  const { openFilter } = useView();
  const set = (mediaType: "movie" | "tv") => {
    if (mediaType === filter.mediaType) return;
    openFilter({ ...filter, mediaType });
  };
  return (
    <div className="mt-5 inline-flex gap-1 rounded-full bg-elevated/50 p-1 ring-1 ring-edge-soft/60">
      {(["tv", "movie"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => set(m)}
          className={`rounded-full px-5 py-1.5 text-[13px] font-semibold transition-colors ${
            filter.mediaType === m
              ? "bg-ink text-canvas"
              : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {m === "tv" ? t("Shows") : t("Movies")}
        </button>
      ))}
    </div>
  );
}

function GenreSwitcher({
  activeName,
  mediaType,
}: {
  activeName: string;
  mediaType: "movie" | "tv";
}) {
  const t = useT();
  const { openFilter } = useView();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const names = Object.keys(MOVIE_GENRES);
  return (
    <div ref={wrapRef} className="relative mt-3 inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-3 text-start transition-colors"
      >
        <span className="font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ink">
          {t(activeName)}
        </span>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-[transform,background-color,color] ${
            open ? "rotate-180 bg-elevated text-ink" : "group-hover:bg-elevated/70 group-hover:text-ink"
          }`}
        >
          <ChevronDown size={18} strokeWidth={2.2} />
        </span>
      </button>
      {open && (
        <div className="absolute start-0 top-[calc(100%+12px)] z-30 grid max-h-[420px] w-[440px] grid-cols-2 gap-1 overflow-y-auto rounded-2xl border border-edge bg-surface/98 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {names.map((name) => {
            const isActive = name === activeName;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setOpen(false);
                  openFilter({ kind: "genre", mediaType, name, id: MOVIE_GENRES[name] });
                }}
                className={`rounded-xl px-3.5 py-2.5 text-start text-[14px] font-medium transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {t(name)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function describe(
  f: MetaFilter,
  t: (key: string, vars?: Record<string, string | number>) => string,
): {
  kicker: string;
  title: string;
  subtitle: string;
  Icon: typeof Tag;
} {
  const mediaWord = f.mediaType === "movie" ? t("Movies") : t("Shows");
  if (f.kind === "year") {
    return {
      kicker: f.mediaType === "movie" ? t("Movies") : t("TV Shows"),
      title: `${f.value}`,
      subtitle: t("Everything from {year}, sorted across trending, top rated, and hidden gems.", {
        year: f.value,
      }),
      Icon: Calendar,
    };
  }
  if (f.kind === "runtime") {
    const range = runtimeRange(f.value);
    return {
      kicker: t("Runtime"),
      title: t("Around {min} min", { min: f.value }),
      subtitle: t(
        "{media} between {lo}-{hi} minutes. Pick a length, not a wall of options.",
        { media: mediaWord, lo: range.lo, hi: range.hi },
      ),
      Icon: Clock,
    };
  }
  if (f.kind === "studio") {
    return {
      kicker: t("Studio"),
      title: f.name,
      subtitle: t("{media} produced by {name}, ranked from biggest hits to overlooked gems.", {
        media: mediaWord,
        name: f.name,
      }),
      Icon: Building2,
    };
  }
  if (f.kind === "country") {
    return {
      kicker: t("Country"),
      title: f.name,
      subtitle: t("{media} from {name}: popular, acclaimed, and hidden alike.", {
        media: mediaWord,
        name: f.name,
      }),
      Icon: Globe,
    };
  }
  if (f.kind === "language") {
    return {
      kicker: t("Language"),
      title: f.name,
      subtitle: t(
        "Everything originally in {name}: movies and series across every genre, era, and hidden gems.",
        { name: f.name },
      ),
      Icon: Languages,
    };
  }
  if (f.kind === "network") {
    return {
      kicker: t("Network"),
      title: f.name,
      subtitle: t("Series from {name}: current hits, classics, and the deep cuts.", {
        name: f.name,
      }),
      Icon: Tv,
    };
  }
  return {
    kicker: f.mediaType === "movie" ? t("Genre") : t("TV Genre"),
    title: f.name,
    subtitle: t(
      "The best {genre} {media}, layered by mood. Browse trending, dive into a director's run, sort by decade, find quiet gems.",
      { genre: f.name.toLowerCase(), media: mediaWord.toLowerCase() },
    ),
    Icon: Tag,
  };
}
