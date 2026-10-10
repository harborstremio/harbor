import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, LoaderCircle } from "@/components/icons/music-icons";
import { useT, useUiLanguage } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import { openUrl } from "@/lib/window";
import {
  BILLBOARD_CHARTS,
  billboardChartUrl,
  loadBillboardChart,
  resolveBillboardItem,
  type BillboardRanking,
} from "@/lib/music/discovery-billboard";
import type { MusicCatalogItem } from "@/lib/music/types";
import { MusicServiceLogo } from "./music-service-logo";
import { useMusicItemMenu } from "./music-item-menu";
import { MusicArtistLink } from "./music-artist-link";
import "./music-billboard-page.css";
import { MusicTrackPlaybackMark } from "./music-now-playing-mark";
export type MusicBillboardPageProps = {
  onBack: () => void;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  initialChart?: string;
  onChartChange?: (chartId: string) => void;
};
const positions = new Map<string, number>();
export function MusicBillboardPage({
  onBack,
  onOpen,
  initialChart = "hot-100",
  onChartChange,
}: MusicBillboardPageProps) {
  const t = useT(),
    language = useUiLanguage();
  const root = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const [id, setId] = useState(initialChart),
    [country, setCountry] = useState("all"),
    [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0);
  const [result, setResult] = useState<BillboardRanking | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [unmatched, setUnmatched] = useState<string | null>(null);
  const chart = BILLBOARD_CHARTS.find((c) => c.id === id) ?? BILLBOARD_CHARTS[0];
  const regions = new Intl.DisplayNames([language], { type: "region" });
  const region = (code: string) =>
    code === "global"
      ? t("music.billboard.world")
      : code === "arabic"
        ? (new Intl.DisplayNames([language], { type: "language" }).of("ar") ?? "Arabic")
        : (regions.of(code) ?? code);
  const available = BILLBOARD_CHARTS.filter((c) => country === "all" || c.country === country);
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    setResult(null);
    setError(false);
    setBusy(null);
    setUnmatched(null);
    loadBillboardChart(id, controller.signal, revision > 0)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => {
      controller.abort();
      generation.current++;
    };
  }, [id, revision]);
  useEffect(() => {
    if (!result) return;
    const scroll = root.current?.closest<HTMLElement>("[data-music-view]");
    const frame = requestAnimationFrame(() => {
      if (scroll) scroll.scrollTop = positions.get(id) ?? 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [result, id]);
  const select = (next: string) => {
    setId(next);
    onChartChange?.(next);
    setQuery("");
    positions.delete(next);
    root.current?.closest<HTMLElement>("[data-music-view]")?.scrollTo({ top: 0 });
  };
  const open = async (item: MusicCatalogItem) => {
    const run = ++generation.current;
    setBusy(item.id);
    setUnmatched(null);
    try {
      const resolved = await resolveBillboardItem(item);
      if (run !== generation.current) return;
      if (resolved) {
        positions.set(id, root.current?.closest<HTMLElement>("[data-music-view]")?.scrollTop ?? 0);
        onOpen(resolved, result?.entries.map((e) => e.item) ?? []);
      } else setUnmatched(item.id);
    } catch {
      if (run === generation.current) setUnmatched(item.id);
    } finally {
      if (run === generation.current) setBusy(null);
    }
  };
  const itemMenu = useMusicItemMenu({ onOpen: (item) => void open(item) });
  const entries =
    result?.entries.filter(({ item }) =>
      (item.kind === "track" || item.kind === "album" ? `${item.title} ${item.artist}` : item.name)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    ) ?? [];
  return (
    <section ref={root} className="music-billboard-page">
      <button type="button" className="music-home-text" data-music-inner-back onClick={onBack}>
        <ChevronLeft size={18} />
        {t("music.watch.back")}
      </button>
      <header>
        <MusicServiceLogo source="billboard" size={38} />
        <div>
          <h1>Billboard</h1>
          <p>{t("music.row.charts")}</p>
        </div>
        <button
          type="button"
          className="music-home-text"
          onClick={() => openUrl(billboardChartUrl(id))}
        >
          billboard.com
          <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="music-billboard-filters">
        <label>
          {t("music.billboard.country")}
          <Dropdown
            value={country}
            ariaLabel={t("music.billboard.country")}
            options={[
              { value: "all", label: t("music.filter.all") },
              ...[...new Set(BILLBOARD_CHARTS.map((c) => c.country))]
                .map((code) => ({ value: code, label: region(code) }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            ]}
            onChange={(value) => {
              setCountry(value);
              if (value !== "all" && chart.country !== value)
                select(BILLBOARD_CHARTS.find((c) => c.country === value)!.id);
            }}
          />
        </label>
        <label>
          {t("music.row.charts")}
          <Dropdown
            value={id}
            ariaLabel={t("music.row.charts")}
            options={available.map((c) => ({ value: c.id, label: c.name }))}
            onChange={select}
          />
        </label>
        <label>
          {t("music.search.tracks")}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("music.filter.tracks")}
          />
        </label>
      </div>
      <div className="music-billboard-heading">
        <h2>{chart.name}</h2>
        {result && (
          <p>
            <time dateTime={result.date}>
              {new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(
                new Date(`${result.date}T12:00:00Z`),
              )}
            </time>{" "}
            · {result.entries.length}
          </p>
        )}
      </div>
      {error ? (
        <div role="alert" className="music-billboard-empty">
          <p>{t("music.billboard.unavailable")}</p>
          <button type="button" onClick={() => setRevision((v) => v + 1)}>
            {t("common.retry")}
          </button>
          <button type="button" onClick={() => openUrl(billboardChartUrl(id))}>
            billboard.com
            <ArrowUpRight size={14} />
          </button>
        </div>
      ) : !result ? (
        <p role="status">
          <LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} />
          {t("music.loading")}
        </p>
      ) : (
        <ol>
          {entries.map(({ rank, item }, index) => (
            <li key={item.id} onContextMenu={itemMenu.openFor(item, index)}>
              <span className="music-billboard-rank">{String(rank).padStart(2, "0")}</span>
              <button
                type="button"
                className="music-billboard-art"
                onClick={() => void open(item)}
                aria-label={t("music.card.openItem", {
                  title: item.kind === "track" || item.kind === "album" ? item.title : item.name,
                })}
              >
                {item.artwork && (
                  <img
                    src={Array.isArray(item.artwork) ? item.artwork[0] : item.artwork}
                    alt=""
                    loading="lazy"
                  />
                )}
                {item.kind === "track" && <MusicTrackPlaybackMark track={item} loading={busy === item.id}/>}
              </button>
              <div className="music-billboard-copy">
                <button type="button" disabled={busy === item.id} onClick={() => void open(item)}>
                  {item.kind === "track" || item.kind === "album" ? item.title : item.name}
                </button>
                {(item.kind === "track" || item.kind === "album") && (
                  <MusicArtistLink
                    name={item.artist}
                    track={item.kind === "track" ? item : undefined}
                  />
                )}
                {unmatched === item.id && <span>{t("music.billboard.match")}</span>}
              </div>
              <button
                type="button"
                className="music-billboard-source"
                aria-label={t("music.billboard.source")}
                onClick={() => openUrl(`${billboardChartUrl(id)}${result.date}/`)}
              >
                {busy === item.id ? <LoaderCircle size={17} /> : <ArrowUpRight size={17} />}
              </button>
            </li>
          ))}
        </ol>
      )}
      {itemMenu.menu}
    </section>
  );
}
