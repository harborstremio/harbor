import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons/music-icons";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { MusicArtistCard } from "@/components/music/music-artist-card";
import { useMusicNavigate } from "@/components/music/music-navigate";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { artistIdentityKey, peekArtistIdentity, resolveArtist } from "@/lib/music/artist-authority";
import type { MusicArtistRef } from "@/lib/music/types";
import { safeFetch } from "@/lib/safe-fetch";
import { useInViewport } from "@/lib/visibility";
import { parseRockHall, ROCK_HALL_URL, type RockHallClass } from "@/lib/music/rock-hall";
import { xxlPortraits } from "@/lib/music/xxl-freshmen";
import "./music-xxl-freshmen.css";

let held: RockHallClass[] | null = null;
let loading: Promise<RockHallClass[]> | null = null;
let lastYear: number | null = null;
const portraits = new Map<number, Promise<Record<string, string>>>();

function loadPortraits(row: RockHallClass) {
  let pending = portraits.get(row.year);
  if (!pending) {
    const params = new URLSearchParams({ action: "query", prop: "pageimages|pageprops", ppprop: "disambiguation", piprop: "thumbnail", pithumbsize: "360", pilicense: "any", redirects: "1", titles: Object.values(row.pages).slice(0, 50).join("|"), format: "json", origin: "*" });
    pending = safeFetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(12_000) })
      .then(async response => {
        if (!response.ok) throw new Error("Inductee portraits unavailable");
        return xxlPortraits(await response.json(), row);
      }).catch(() => { portraits.delete(row.year); return {}; });
    portraits.set(row.year, pending);
  }
  return pending;
}

function loadClasses(): Promise<RockHallClass[]> {
  if (held) return Promise.resolve(held);
  loading ??= (async () => {
    // Shared across mounts; one consumer leaving must not cancel another's request.
    const response = await safeFetch(ROCK_HALL_URL, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("Hall of Fame unavailable");
    const raw = (await response.json()) as { parse?: { wikitext?: { "*"?: string } } };
    const classes = parseRockHall(raw.parse?.wikitext?.["*"] ?? "");
    if (classes.length === 0) throw new Error("Hall of Fame unavailable");
    held = classes;
    return classes;
  })();
  return loading.catch((reason) => {
    loading = null;
    throw reason;
  });
}

export function MusicRockHall({ active }: { active: boolean }) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const visible = useInViewport(root);
  const [classes, setClasses] = useState<RockHallClass[]>(held ?? []);
  const [year, setYear] = useState<number | null>(lastYear ?? held?.[0]?.year ?? null);
  useEffect(() => { if (year !== null) lastYear = year; }, [year]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || classes.length > 0) return;
    const controller = new AbortController();
    loadClasses()
      .then((rows) => {
        if (controller.signal.aborted) return;
        setClasses(rows);
        setYear((current) => current ?? rows[0]?.year ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [active, classes.length]);

  if (failed || (classes.length === 0 && !active)) return null;

  const selected = classes.find((row) => row.year === year) ?? classes[0];

  return (
    <section ref={root} className="music-xxl flex min-w-0 flex-col gap-4">
      <div className="music-xxl-heading">
        <MusicSectionHead title={t("music.rockHall.title")} subtitle={t("music.rockHall.subtitle")} />
        {selected && <div className="music-xxl-years">
          <HoverTooltip label={t("music.xxl.newer")}>
            <button type="button" className="music-xxl-year-step" aria-label={t("music.xxl.newer")}
              disabled={classes.indexOf(selected) === 0}
              onClick={() => setYear(classes[classes.indexOf(selected) - 1].year)}>
              <ChevronLeft size={18} className="dir-icon" aria-hidden />
            </button>
          </HoverTooltip>
          <Dropdown value={String(selected.year)} options={classes.map(row => ({ value: String(row.year), label: String(row.year) }))}
            onChange={value => setYear(Number(value))} ariaLabel={`${t("music.rockHall.title")} · ${t("music.explore.year")}`}
            className="music-xxl-year-picker" />
          <HoverTooltip label={t("music.xxl.older")}>
            <button type="button" className="music-xxl-year-step" aria-label={t("music.xxl.older")}
              disabled={classes.indexOf(selected) === classes.length - 1}
              onClick={() => setYear(classes[classes.indexOf(selected) + 1].year)}>
              <ChevronRight size={18} className="dir-icon" aria-hidden />
            </button>
          </HoverTooltip>
        </div>}
      </div>
      {classes.length === 0 ? (
        <div className="flex gap-5 overflow-hidden" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((slot) => (
            <div key={slot} className="size-36 shrink-0 rounded-full bg-elevated/45" />
          ))}
        </div>
      ) : (
        selected && <Inductees key={selected.year} inducted={selected} active={active && visible} />
      )}
    </section>
  );
}

function Inductees({ inducted, active }: { inducted: RockHallClass; active: boolean }) {
  const { goToArtist } = useMusicNavigate();
  const [artists, setArtists] = useState<MusicArtistRef[]>(() => inducted.artists.map(name => {
    const result = peekArtistIdentity(name).ranking;
    const artist = result?.canonical;
    return { name, id: `rockhall:${name}`, connectorId: "catalog", artwork: artist && !result?.ambiguous && artistIdentityKey(artist.name) === artistIdentityKey(name) ? artist.artwork : undefined };
  }));
  useEffect(() => {
    if (!active) return;
    let live = true, next = 0;
    // One exact-article portrait request per class; the shared identity resolver only
    // fills the gaps, three at a time, so a 14-name class stays polite to both services.
    void loadPortraits(inducted).then(async artwork => {
      if (!live) return;
      setArtists(previous => previous.map(artist => ({ ...artist, artwork: artwork[artist.name] || artist.artwork })));
      await Promise.all(Array.from({ length: Math.min(3, inducted.artists.length) }, async () => {
      while (live && next < inducted.artists.length) {
        const name = inducted.artists[next++];
        if (artwork[name]) continue;
        const result = await resolveArtist(name).catch(() => null);
        const artist = result?.canonical;
        if (live && artist && !result?.ambiguous && artistIdentityKey(artist.name) === artistIdentityKey(name)) {
          setArtists(previous => previous.map(row => row.name === name ? { ...artist, name } : row));
        }
      }
      }));
    });
    return () => { live = false; };
  }, [active, inducted]);
  return <Row min={136} shape="square" arrowsAlways scrollKey={`music:rockhall:${inducted.year}`} className="music-xxl-artists">
    {artists.map(artist => <MusicArtistCard key={artist.name} artist={artist} onOpen={() => goToArtist(artist.name)} />)}
  </Row>;
}
