import { createAddonCatalogFetcher, gatherCatalogAddons } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import type { SourceFolder } from "@/lib/custom-sources";
import { useT } from "@/lib/i18n";
import { tmdbDiscover, tmdbCollection } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { hydrateTraktItems } from "@/lib/trakt/hydrate";
import { fetchTraktList } from "@/lib/trakt/lists";
import { useView } from "@/lib/view";
import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { EditFolderImagesModal } from "./edit-folder-images-modal";

export function SourceFolderCard({
  folder,
  editMode,
  sourceId,
  onEditFolderImages,
}: {
  folder: SourceFolder;
  editMode?: boolean;
  sourceId?: string;
  onEditFolderImages?: (sourceId: string, folderId: string, cover: string, gif: string) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openGrid } = useView();
  const { authKey } = useAuth();
  const [hover, setHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorAddon, setErrorAddon] = useState<string | null>(null);
  const [missingTmdbKey, setMissingTmdbKey] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    if (folder.sources && folder.sources.length > 0) {
      const source = folder.sources[0];
      if (source.provider === "tmdb") {
        if (!settings.tmdbKey) {
          setMissingTmdbKey(true);
          return;
        }

        if (source.tmdbSourceType === "DISCOVER" || source.tmdbSourceType === "COMPANY") {
          const params: Record<string, string> = {};
          if (source.sortBy) params["sort_by"] = source.sortBy;
          if (source.filters) {
            for (const [k, v] of Object.entries(source.filters)) {
              if (k === "year") {
                params[source.mediaType === "TV" ? "first_air_date_year" : "primary_release_year"] = String(v);
              } else if (k === "voteCountGte") {
                params["vote_count.gte"] = String(v);
              } else if (k === "voteAverageGte") {
                params["vote_average.gte"] = String(v);
              } else {
                const snake = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
                params[snake] = String(v);
              }
            }
          }

          if (source.tmdbSourceType === "COMPANY" && source.tmdbId) {
            params["with_companies"] = String(source.tmdbId);
          }

          openGrid({
            title: source.title || folder.title,
            fetcher: async (page: number) => {
              return tmdbDiscover(settings.tmdbKey!, source.mediaType.toLowerCase() as "movie" | "tv", {
                ...params,
                page: String(page),
              });
            },
          });
          return;
        }

        if (source.tmdbSourceType === "COLLECTION" && source.tmdbId) {
          openGrid({
            title: source.title || folder.title,
            fetcher: async (page: number) => {
              if (page > 1) return [];
              const coll = await tmdbCollection(settings.tmdbKey!, Number(source.tmdbId));
              return coll?.parts || [];
            },
          });
          return;
        }
      } else if (source.provider === "trakt" && source.traktListId) {
        if (!settings.tmdbKey) {
          setMissingTmdbKey(true);
          return;
        }

        openGrid({
          title: source.title || folder.title,
          fetcher: async (page: number) => {
            const items = await fetchTraktList(source.traktListId!, page, 20);
            return hydrateTraktItems(items, settings.tmdbKey!);
          },
        });
        return;
      }
    }

    if (!folder.catalogSources || folder.catalogSources.length === 0) return;

    const source = folder.catalogSources[0];

    setLoading(true);
    try {
      const addons = await gatherCatalogAddons(authKey);
      const addon = addons.find((a) => a.manifest.id === source.addonId);

      if (!addon) {
        setErrorAddon(source.addonId);
        return;
      }

      openGrid({
        title: folder.title,
        fetcher: createAddonCatalogFetcher({
          base: addon.transportUrl.replace(/\/manifest\.json$/, ""),
          type: source.type,
          id: source.catalogId,
        }),
      });
    } finally {
      setLoading(false);
    }
  };

  const isPoster = folder.tileShape === "POSTER";
  const aspectRatio = isPoster ? "aspect-[2/3]" : "aspect-[16/9]";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        disabled={loading}
        className={`group/card relative ${aspectRatio} w-full flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-edge-soft bg-surface text-start shadow-[0_4px_18px_-10px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/0 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-edge hover:ring-white/15 disabled:opacity-50`}
      >
        {folder.coverImageUrl && (
          <img
            src={folder.coverImageUrl}
            alt=""
            loading="lazy"
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              hover && folder.focusGifUrl ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        {folder.focusGifUrl && (
          <img
            src={folder.focusGifUrl}
            alt=""
            loading="lazy"
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              hover ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        <div
          aria-hidden
          className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover/card:bg-black/0"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />

        {!folder.hideTitle && (
          <h3 className="absolute inset-x-4 bottom-3.5 font-display text-[21px] font-medium leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
            {folder.title}
          </h3>
        )}

        {editMode && sourceId && onEditFolderImages && (
          <div
            className="absolute end-3 top-3 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditModalOpen(true);
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-accent">
              <Pencil className="h-4 w-4" />
            </div>
          </div>
        )}
      </button>

      {errorAddon &&
        createPortal(
          <div
            className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setErrorAddon(null);
            }}
          >
            <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[24px] border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Addon not installed")}</h2>
                <button
                  onClick={() => setErrorAddon(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="text-center text-ink-muted">
                <p className="mb-4 text-[15px]">
                  {t("This section depends on the addon")}{" "}
                  <strong className="text-ink" dir="ltr">
                    {errorAddon}
                  </strong>
                  .
                </p>
                <p className="mb-6 text-[15px] leading-relaxed">
                  {t("You must install this addon in your Stremio account first so Harbor can fetch its works.")}
                </p>
                <button
                  onClick={() => setErrorAddon(null)}
                  className="w-full rounded-full bg-accent px-6 py-2.5 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  {t("OK")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {missingTmdbKey &&
        createPortal(
          <div
            className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMissingTmdbKey(false);
            }}
          >
            <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[24px] border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Missing TMDB Key")}</h2>
                <button
                  onClick={() => setMissingTmdbKey(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="text-center text-ink-muted">
                <p className="mb-4 text-[15px]">{t("This section relies on TMDB discovery features.")}</p>
                <p className="mb-6 text-[15px] leading-relaxed">
                  {t("Please add your TMDB API key in the Library & Metadata settings to view this folder.")}
                </p>
                <button
                  onClick={() => setMissingTmdbKey(false)}
                  className="w-full rounded-full bg-accent px-6 py-2.5 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  {t("OK")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {editMode && sourceId && onEditFolderImages && (
        <EditFolderImagesModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialCover={folder.coverImageUrl}
          initialGif={folder.focusGifUrl}
          onSave={(cover, gif) => {
            onEditFolderImages(sourceId, folder.id, cover, gif);
          }}
        />
      )}
    </>
  );
}
