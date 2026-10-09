import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "@/components/icons/music-icons";
import { MusicCoverCard } from "./music-cover-card";
import { useMusicItemMenu } from "./music-item-menu";
import { useMusicCatalogPlayback } from "./use-music-catalog-playback";
import { MusicSectionEmpty, MusicSectionError, MusicSectionHead } from "./music-track-grid";
import { MusicDiscoveryIcon } from "./music-discovery-icon";
import { MusicServiceLogo } from "./music-service-logo";
import { Row } from "@/components/row";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import {
  BILLBOARD_HOT_100_URL,
  loadBillboardHot100,
  type MusicBillboardChart,
} from "@/lib/music/discovery-billboard";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";

export function MusicDiscoveryChartRow({
  tracks,
  positions,
  loading,
  error,
  onRetry,
  onOpen,
  genreId = 0,
  title,
  source = "Deezer",
  sourceLogo,
  rowId,
}: {
  tracks: MusicTrack[];
  positions: (number | null)[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  genreId?: number;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  title?: string;
  source?: string;
  sourceLogo?: string;
  rowId?: string;
}) {
  const t = useT();
  const playback = useMusicCatalogPlayback();
  const items: MusicCatalogItem[] = tracks.map((track) => ({ ...track, kind: "track" }));
  const itemMenu = useMusicItemMenu({
    onOpen: (item) => onOpen(item, items),
    onPlay: (item) => { void playback.play(item, items); },
  });
  const heading = title ?? t("music.row.charts");
  const sourceLabel = (
    <span className="inline-flex items-center gap-2">
      {sourceLogo && <MusicServiceLogo source={sourceLogo} size={16} />}
      <span>{source}</span>
    </span>
  );
  const head = (
    <span className="flex flex-col gap-1">
      <span className="text-[20px] font-semibold tracking-tight text-ink">{heading}</span>
      <span className="text-[13px] text-ink-muted">{sourceLabel}</span>
    </span>
  );
  if (error || (!loading && !items.length))
    return (
      <section className="flex flex-col gap-4">
        <MusicSectionHead title={heading} subtitle={sourceLabel} />
        {error ? <MusicSectionError onRetry={onRetry} /> : <MusicSectionEmpty />}
      </section>
    );
  return (
    <>
      <Row
        title={head}
        shape="square"
        min={160}
        scrollKey={rowId ?? `music-discovery-chart:${genreId}`}
      >
        {loading
          ? Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="aspect-square rounded-md bg-elevated/40"
                aria-hidden="true"
              />
            ))
          : items.map((item, index) => (
              <div key={item.id} className="music-discovery-chart-card">
                <MusicCoverCard
                  item={item}
                  badge={null}
                  onOpen={() => onOpen(item, items)}
                  onPlay={() => { void playback.play(item, items); }}
                  playing={playback.pending?.id === item.id && playback.pending?.connectorId === item.connectorId}
                  onMenu={itemMenu.openFor(item, index)}
                />
                {positions[index] !== null && positions[index] !== undefined && (
                  <span className="music-discovery-chart-rank">
                    {String(positions[index]).padStart(2, "0")}
                  </span>
                )}
              </div>
            ))}
      </Row>
      {itemMenu.menu}
      {playback.error && <p role="alert" className="text-[13px] text-ink-muted">{playback.error}</p>}
    </>
  );
}

const billboardCharts = [
  { title: "Hot 100", url: "https://www.billboard.com/charts/hot-100/", mark: "100" },
  { title: "Billboard 200", url: "https://www.billboard.com/charts/billboard-200/", mark: "200" },
  {
    title: "Global 200",
    url: "https://www.billboard.com/charts/billboard-global-200/",
    mark: "200",
  },
];

export function MusicBillboardCharts({
  onOpen,
  onBrowse,
  title = "Billboard Hot 100",
}: {
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  title?: string;
  onBrowse?: (chartId?: string) => void;
}) {
  const t = useT();
  const language = useUiLanguage();
  const [chart, setChart] = useState<MusicBillboardChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadBillboardHot100()
      .then((value) => {
        if (!cancelled) setChart(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const date = chart
    ? new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(
        new Date(`${chart.date}T12:00:00Z`),
      )
    : "";
  return (
    <section className="flex flex-col gap-4">
      {chart ? (
        <>
          <MusicDiscoveryChartRow
            tracks={chart.tracks}
            positions={chart.positions}
            loading={false}
            error={false}
            onRetry={() => setRetry((value) => value + 1)}
            onOpen={onOpen}
            title={title}
            source={`Billboard · ${date}`}
            sourceLogo="billboard"
            rowId={`music-discovery-billboard:${chart.date}`}
          />
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 self-start text-[13px] text-ink-muted hover:text-ink"
            onClick={() => openUrl(BILLBOARD_HOT_100_URL)}
          >
            <MusicServiceLogo source="billboard" size={16} />
            billboard.com
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <MusicSectionHead
            title={title}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <MusicServiceLogo source="billboard" size={16} />
                billboard.com
              </span>
            }
          />
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-[13px] text-ink-muted">
              <LoaderCircle
                size={16}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t("music.loading")}
            </p>
          ) : (
            error && (
              <div className="flex items-center gap-3 text-[13px] text-ink-muted">
                <p>{t("music.error.load")}</p>
                <button
                  className="min-h-11 underline underline-offset-4 hover:text-ink"
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  {t("common.retry")}
                </button>
              </div>
            )
          )}
        </>
      )}
      {onBrowse && (
        <button type="button" className="music-home-text" onClick={() => onBrowse("hot-100")}>
          {t("music.row.viewAll")} · Billboard Hot 100
        </button>
      )}
      <div className="music-discovery-billboard">
        {billboardCharts.map((chart) => (
          <button
            key={chart.url}
            type="button"
            onClick={() =>
              onBrowse
                ? onBrowse(new URL(chart.url).pathname.split("/")[2])
                : void openUrl(chart.url)
            }
            aria-label={t("music.card.openItem", { title: chart.title })}
          >
            <span className="music-discovery-chart-mark">
              <MusicDiscoveryIcon />
              <b>{chart.mark}</b>
            </span>
            <span className="min-w-0 flex-1">
              <strong>{chart.title}</strong>
              <small>Billboard · {t("music.row.charts")}</small>
            </span>
            <ExternalLink size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
