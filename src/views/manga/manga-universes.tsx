import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { usePageVisible } from "@/lib/visibility";
import { useT } from "@/lib/i18n";
import { mangaBackdrop } from "@/lib/manga/backdrop";
import { topCharacterImage } from "@/lib/manga/character";
import { universeLogo } from "@/lib/manga/universe-logo";
import { searchManga } from "@/lib/manga/api";
import { MANGA_UNIVERSES, type MangaUniverse } from "@/lib/manga/universes";

const AMES = '"QR Ames Beta", var(--font-display), serif';
const NEUTRAL = "linear-gradient(135deg, oklch(0.3 0.02 260), oklch(0.21 0.02 260))";
const CYCLE_MS = 7000;
const MASK = "linear-gradient(to right, transparent, black 62%)";

function useBackdrop(name: string, baked?: string): string | null {
  const [url, setUrl] = useState<string | null>(baked ?? null);
  useEffect(() => {
    if (baked || !name) return;
    let cancelled = false;
    void mangaBackdrop(name).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [name, baked]);
  return baked ?? url;
}

function useTopCharacter(name: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    void topCharacterImage(name).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);
  return url;
}

function useUniverseLogo(query: string, baked?: string): string | null {
  const [url, setUrl] = useState<string | null>(baked ?? null);
  useEffect(() => {
    if (baked || !query) return;
    let cancelled = false;
    void universeLogo(query).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [query, baked]);
  return baked ?? url;
}

function BannerLayer({
  name,
  backdrop,
  active,
}: {
  name: string;
  backdrop?: string;
  active: boolean;
}) {
  const [seen, setSeen] = useState(active);
  useEffect(() => {
    if (active) setSeen(true);
  }, [active]);
  const banner = useBackdrop(seen ? name : "", backdrop);
  if (!banner) return null;
  return (
    <img
      src={banner}
      alt=""
      className={`pointer-events-none absolute inset-y-0 right-0 h-full w-3/5 object-cover transition-opacity duration-1000 ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
      style={{ objectPosition: "center 22%", maskImage: MASK, WebkitMaskImage: MASK }}
    />
  );
}

function CharLayer({ name, active }: { name: string; active: boolean }) {
  const [seen, setSeen] = useState(active);
  useEffect(() => {
    if (active) setSeen(true);
  }, [active]);
  const img = useTopCharacter(seen ? name : "");
  if (!img) return null;
  return (
    <img
      src={img}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
      style={{ objectPosition: "center 12%" }}
    />
  );
}

export function UniversesCta({ onClick }: { onClick: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const pageVisible = usePageVisible();
  useEffect(() => {
    if (!pageVisible) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % MANGA_UNIVERSES.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [pageVisible]);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[84px] items-center gap-4 overflow-hidden rounded-2xl border border-edge-soft bg-elevated/40 px-6 py-4 text-start transition-all duration-300 hover:bg-elevated/70 active:scale-[0.99]"
    >
      {MANGA_UNIVERSES.map((u, idx) => (
        <BannerLayer key={u.id} name={u.query} backdrop={u.backdrop} active={idx === i} />
      ))}
      <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-elevated ring-1 ring-edge-soft">
        <Users size={20} className="text-ink-subtle" />
        {MANGA_UNIVERSES.map((u, idx) => (
          <CharLayer key={u.id} name={u.query} active={idx === i} />
        ))}
      </span>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <span className="text-[15.5px] font-semibold text-ink">{t("Universes")}</span>
        <span className="truncate text-[13px] text-ink-muted">
          {t("One Piece, Naruto and more worlds")}
        </span>
      </div>
      <ChevronRight
        size={22}
        className="dir-icon relative shrink-0 text-ink-subtle drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
      />
    </button>
  );
}

function UniverseCard({ universe, onSelect }: { universe: MangaUniverse; onSelect: () => void }) {
  const art = useBackdrop(universe.query, universe.backdrop);
  const logo = useUniverseLogo(universe.noLogo ? "" : universe.query, universe.logo);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative aspect-[16/10] overflow-hidden rounded-2xl ring-1 ring-edge-soft transition-shadow duration-200 [clip-path:inset(0_round_1rem)] hover:ring-edge active:scale-[0.98]"
    >
      <div className="absolute inset-0" style={{ background: NEUTRAL }} />
      {art && (
        <img
          src={art}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ease-out group-hover:brightness-110"
          style={{ objectPosition: "center 24%" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
      {logo ? (
        <img
          src={logo}
          alt={universe.name}
          className="absolute left-1/2 top-1/2 max-h-[46%] w-[74%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]"
        />
      ) : (
        <span
          className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[28px] font-semibold uppercase leading-[1.05] tracking-tight text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: AMES }}
        >
          {universe.name}
        </span>
      )}
    </button>
  );
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type Candidate = { id: string; title: string; lastChapter?: string };

function pickBestMatch(results: Candidate[], query: string, name: string): Candidate | null {
  if (!results.length) return null;
  const keys = [normTitle(query), normTitle(name)].filter(Boolean);
  let best = results[0];
  let bestScore = -Infinity;
  for (const r of results) {
    const t = normTitle(r.title);
    let score = 0;
    if (keys.some((k) => t === k)) score += 100;
    else if (keys.some((k) => t.startsWith(k))) score += 55;
    else if (keys.some((k) => k.includes(t) || t.includes(k))) score += 25;
    score += Math.min(Number(r.lastChapter) || 0, 2000) / 100;
    score -= Math.min(...keys.map((k) => Math.abs(t.length - k.length))) / 25;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function MangaUniverses({
  onOpen,
  onBack,
}: {
  onOpen: (mangaId: string) => void;
  onBack: () => void;
}) {
  const t = useT();
  const select = async (u: MangaUniverse) => {
    const results = await searchManga(u.query, 0).catch(() => []);
    const found = pickBestMatch(results, u.query, u.name);
    if (found) onOpen(found.id);
  };
  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-elevated px-4 py-2.5 text-[15px] font-medium text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-edge-soft transition-all hover:bg-raised active:scale-[0.97]"
      >
        <ChevronLeft size={19} strokeWidth={2.4} className="dir-icon" />
        {t("Back")}
      </button>
      <div className="flex flex-col gap-1.5">
        <h1
          className="text-[34px] font-medium tracking-tight text-ink"
          style={{ fontFamily: AMES }}
        >
          {t("Universes")}
        </h1>
        <p className="text-[15px] text-ink-muted">
          {t("Pick a world and dive into everything in it.")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {MANGA_UNIVERSES.map((u) => (
          <UniverseCard key={u.id} universe={u} onSelect={() => void select(u)} />
        ))}
      </div>
    </div>
  );
}
