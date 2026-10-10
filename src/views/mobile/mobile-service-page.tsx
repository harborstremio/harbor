import { useCallback, useState } from "react";
import { ChevronLeft, Film } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { ServiceLogo } from "@/components/service-logo";
import { SERVICES, providerIdsFor } from "@/lib/providers/streaming";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { useSettings, type StreamingService } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { MobileDetail } from "./mobile-detail";
import {
  GENRES,
  ServiceFilters,
  genreAvailable,
  genreParam,
  type Genre,
  type ServiceMedia,
} from "./mobile-service-filters";
import {
  MAX_PAGE,
  MobileCatalogGrid,
  TMDB_PAGE_SIZE,
  type CatalogPage,
} from "./mobile-catalog-page";

const INITIAL_PAGES = 2;

const PAGE_MOTION_CSS = `
.harbor-svc-page {
  animation: harbor-svc-page 320ms var(--ease-out) both;
}
@keyframes harbor-svc-page {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-svc-page { animation: none; }
}
`;

async function fetchServicePage(
  key: string,
  providerIds: string,
  region: string,
  media: ServiceMedia,
  genreId: string | undefined,
  page: number,
): Promise<CatalogPage> {
  const params: Record<string, string> = {
    with_watch_providers: providerIds,
    watch_region: region || "US",
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: "false",
    page: String(page),
  };
  if (genreId) params.with_genres = genreId;
  const metas = await tmdbDiscover(key, media, params);
  return { metas, more: metas.length >= TMDB_PAGE_SIZE && page < MAX_PAGE };
}

export function MobileServicePage({
  service,
  onBack,
}: {
  service: StreamingService;
  onBack: () => void;
}) {
  const { settings } = useSettings();
  const meta = SERVICES[service];
  const providerIds = providerIdsFor(meta);
  const [media, setMedia] = useState<ServiceMedia>("movie");
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const genreId = genreParam(genre, media);
  const key = settings.tmdbKey;
  const region = settings.region;

  const fetchPage = useCallback(
    (page: number) => fetchServicePage(key, providerIds, region, media, genreId, page),
    [key, providerIds, region, media, genreId],
  );

  const changeMedia = (next: ServiceMedia) => {
    if (next === media) return;
    if (!genreAvailable(genre, next)) setGenre(GENRES[0]);
    setMedia(next);
  };

  return (
    <div
      className="harbor-svc-page flex flex-col gap-6 pb-[env(safe-area-inset-bottom,0px)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)" }}
    >
      <style>{PAGE_MOTION_CSS}</style>
      <ServiceHero service={service} name={meta.name} tint={meta.tint} onBack={onBack} />
      <ServiceFilters
        media={media}
        genre={genre}
        onMediaChange={changeMedia}
        onGenreChange={setGenre}
      />
      <MobileCatalogGrid
        fetchPage={fetchPage}
        resetKey={`${service}:${media}:${genreId ?? "all"}:${region}:${key ? 1 : 0}`}
        enabled={!!key}
        initialPages={INITIAL_PAGES}
        emptyState={<EmptyState name={meta.name} hasKey={!!key} />}
        onOpenDetail={setDetailMeta}
      />

      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function ServiceHero({
  service,
  name,
  tint,
  onBack,
}: {
  service: StreamingService;
  name: string;
  tint: string;
  onBack: () => void;
}) {
  const t = useT();
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background: `radial-gradient(125% 85% at 50% -8%, ${tint}33 0%, transparent 60%)`,
        }}
      />
      <div
        className="relative flex flex-col gap-4 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Back")}
          className="-ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-[0.96]"
        >
          <ChevronLeft size={24} strokeWidth={2.4} />
        </button>
        <div className="flex flex-col gap-2.5 pb-1">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-ink-subtle">
            {t("Popular on")}
          </span>
          <div className="flex h-11 items-center">
            <ServiceLogo service={service} height={44} />
          </div>
          <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
            {t("The most-watched movies and series on {service} right now.", { service: name })}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ name, hasKey }: { name: string; hasKey: boolean }) {
  const t = useT();
  const message = hasKey
    ? t(
        "Nothing from {service} is available in your region right now. Try another genre or switch between Movies and Shows.",
        { service: name },
      )
    : t("Add a TMDB key in Settings to browse service catalogs.");
  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
        <Film size={26} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[19px] font-medium text-ink">
          {t("Nothing to show yet")}
        </h2>
        <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
