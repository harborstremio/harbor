import { ArrowLeft, BookmarkPlus, Check, GalleryVerticalEnd, Plus, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useScrollMemory, useView } from "@/lib/view";
import { BackToTop } from "@/components/back-to-top";
import { posterPlate } from "@/components/poster";
import { ResultPoster } from "@/components/search/result-poster";
import { Avatar } from "@/components/together-modal/avatar";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { requestOpenProfile } from "@/lib/social/open-profile";
import type { MetaType } from "@/lib/cinemeta";
import {
  MAX_COLLECTIONS,
  createCollection,
  deleteCollection,
  readCollections,
  saveCommunityCollection,
  useCollections,
  type CollectionItem,
} from "@/lib/collections";
import { useCurrentHandle } from "./community-share-button";
import {
  COMMUNITY_COLLECTIONS_EVENT,
  fetchCommunityCollections,
  notifyCommunityChanged,
  publishCollections,
  type CommunityCollection,
} from "@/lib/social/collections-sync";
import { purgeCollectionFromPages } from "@/lib/page-collection-rows";
import { CommunityCollectionCard } from "./community-collection-card";
import { CommunityCollectionEditor } from "./community-editor";
import { CommunityCollectionPage } from "./community-collection-page";

type Screen =
  | { kind: "grid" }
  | { kind: "editor"; id: string }
  | { kind: "page"; id: string }
  | { kind: "community"; collection: CommunityCollection };

export function CommunityCollectionsView({ active }: { active: boolean }) {
  const [screen, setScreen] = useState<Screen>({ kind: "grid" });

  if (screen.kind === "editor") {
    return (
      <CommunityCollectionEditor
        id={screen.id}
        onBack={() => setScreen({ kind: "grid" })}
        onViewPage={(id) => setScreen({ kind: "page", id })}
      />
    );
  }

  if (screen.kind === "page") {
    return (
      <CommunityCollectionPage
        id={screen.id}
        onBack={() => setScreen({ kind: "grid" })}
        onEdit={(id) => setScreen({ kind: "editor", id })}
      />
    );
  }

  if (screen.kind === "community") {
    return (
      <CommunityDetail
        collection={screen.collection}
        onBack={() => setScreen({ kind: "grid" })}
      />
    );
  }

  return (
    <HubGrid
      active={active}
      onOpen={(id) => setScreen({ kind: "page", id })}
      onEdit={(id) => setScreen({ kind: "editor", id })}
      onOpenCommunity={(collection) => setScreen({ kind: "community", collection })}
    />
  );
}

function HubGrid({
  active,
  onOpen,
  onEdit,
  onOpenCommunity,
}: {
  active: boolean;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onOpenCommunity: (collection: CommunityCollection) => void;
}) {
  const t = useT();
  const collections = useCollections();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("collections-hub", scrollRef, active);
  const [community, setCommunity] = useState<CommunityCollection[] | null>(null);
  const [communityFailed, setCommunityFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommunity = useCallback((signal?: AbortSignal) => {
    setRefreshing(true);
    return fetchCommunityCollections(signal)
      .then((list) => {
        setCommunity(list);
        setCommunityFailed(false);
      })
      .catch(() => {
        if (signal?.aborted) return;
        setCommunityFailed(true);
        setCommunity((prev) => prev ?? []);
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadCommunity(ctrl.signal);
    const onChanged = () => void loadCommunity();
    window.addEventListener(COMMUNITY_COLLECTIONS_EVENT, onChanged);
    return () => {
      ctrl.abort();
      window.removeEventListener(COMMUNITY_COLLECTIONS_EVENT, onChanged);
    };
  }, [loadCommunity]);

  const atMax = collections.length >= MAX_COLLECTIONS;

  const create = () => {
    if (atMax) return;
    const id = createCollection(t("Untitled collection"));
    if (id) onEdit(id);
  };

  const remove = (id: string) => {
    deleteCollection(id);
    purgeCollectionFromPages(id);
    void publishCollections(readCollections())
      .then(() => notifyCommunityChanged())
      .catch(() => {});
  };

  return (
    <main
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 pt-24 pb-20 sm:px-8 lg:px-12 lg:pt-28"
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-10">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
              {t("Showcase")}
            </span>
            <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-tight text-ink">
              {t("Collections")}
            </h1>
            <p className="max-w-xl text-[14px] leading-snug text-ink-muted">
              {t(
                "Curated, themed sets you can make beautiful and share by link. A Studio Ghibli shelf, the best heist movies, a marathon for a rainy weekend.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={atMax}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={17} strokeWidth={2.4} />
            {t("New collection")}
          </button>
        </header>

        <section className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[16px] font-semibold text-ink">{t("My collections")}</h2>
            {collections.length > 0 && (
              <span className="text-[12px] tabular-nums text-ink-muted">
                {t("{n} / {max}", { n: collections.length, max: MAX_COLLECTIONS })}
              </span>
            )}
          </div>

          {collections.length === 0 ? (
            <EmptyCollections onCreate={create} />
          ) : (
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {collections.map((collection) => (
                <CommunityCollectionCard
                  key={collection.id}
                  collection={collection}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onDelete={remove}
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[16px] font-semibold text-ink">{t("From the community")}</h2>
            <button
              type="button"
              onClick={() => void loadCommunity()}
              disabled={refreshing}
              aria-label={t("Refresh")}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                strokeWidth={2.2}
                className={refreshing ? "animate-spin" : ""}
              />
              {t("Refresh")}
            </button>
          </div>
          {community === null ? (
            <CommunityLoading />
          ) : communityFailed ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/40 px-8 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
                <Users size={24} strokeWidth={1.6} />
              </span>
              <p className="font-display text-[19px] font-medium text-ink">
                {t("Community collections are coming soon")}
              </p>
              <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
                {t("Shared collections from across Harbor will show up here soon.")}
              </p>
            </div>
          ) : community.length === 0 ? (
            <CommunityEmpty />
          ) : (
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {community.map((c) => (
                <CommunityCard
                  key={`${c.handle}/${c.id}`}
                  collection={c}
                  onOpen={onOpenCommunity}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function EmptyCollections({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
        <GalleryVerticalEnd size={24} strokeWidth={1.6} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[20px] font-medium text-ink">{t("Make your first collection")}</h3>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
          {t("Give it a cover, a background, and the titles you want to show off. Then share the link.")}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
      >
        <Plus size={17} strokeWidth={2.2} />
        {t("New collection")}
      </button>
    </div>
  );
}

function CommunityLoading() {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="aspect-[16/9] w-full animate-pulse rounded-2xl border border-edge-soft bg-elevated/40"
        />
      ))}
    </div>
  );
}

function CommunityEmpty() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/40 px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
        <Users size={24} strokeWidth={1.6} />
      </span>
      <p className="font-display text-[19px] font-medium text-ink">{t("No shared collections yet")}</p>
      <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
        {t(
          "When people share a collection it shows up here. Build one you love and share it, that is how it starts.",
        )}
      </p>
    </div>
  );
}

function CommunityCard({
  collection,
  onOpen,
}: {
  collection: CommunityCollection;
  onOpen: (collection: CommunityCollection) => void;
}) {
  const t = useT();
  const cover = collection.coverImage || collection.items.find((it) => it.poster)?.poster;
  const count = collection.items.length;

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => onOpen(collection)}
        className="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border border-edge-soft text-start shadow-[0_6px_22px_-14px_rgba(0,0,0,0.6)] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-edge"
        style={cover ? undefined : { background: posterPlate(collection.id + collection.name) }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <span className="absolute start-3.5 top-3 inline-flex items-center rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
          {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
        </span>
        <h3 className="absolute inset-x-4 bottom-3.5 line-clamp-2 font-display text-[20px] font-medium leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
          {collection.name}
        </h3>
      </button>
      <div className="flex items-center gap-2 px-0.5">
        <Avatar name={collection.displayName} src={collection.avatarUrl} size={22} />
        <span className="truncate text-[12.5px] font-medium text-ink-muted">
          {collection.displayName}
        </span>
      </div>
    </div>
  );
}

function SaveCollectionButton({ collection }: { collection: CommunityCollection }) {
  const t = useT();
  const collections = useCollections();
  const currentHandle = useCurrentHandle();
  const saved = collections.some(
    (c) => c.sourceHandle === collection.handle && c.sourceId === collection.id,
  );
  const isOwn =
    !!currentHandle && currentHandle.toLowerCase() === collection.handle.toLowerCase();
  if (isOwn) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!saved) saveCommunityCollection(collection);
      }}
      disabled={saved}
      className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-transform duration-200 ${
        saved
          ? "cursor-default border border-edge-soft bg-elevated/60 text-ink-muted"
          : "bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:scale-[1.03] active:scale-[0.98]"
      }`}
    >
      {saved ? (
        <Check size={17} strokeWidth={2.4} />
      ) : (
        <BookmarkPlus size={17} strokeWidth={2.2} />
      )}
      {saved ? t("Saved to your collections") : t("Save to my collections")}
    </button>
  );
}

function CommunityDetail({
  collection,
  onBack,
}: {
  collection: CommunityCollection;
  onBack: () => void;
}) {
  const t = useT();
  const { openMeta, openManga } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const items = collection.items;
  const seed = collection.id + collection.name;
  const poster = items.find((it) => it.poster)?.poster;
  const backdrop = collection.bgImage || poster;
  const backdropSharp = !!collection.bgImage;
  const count = items.length;

  const open = (item: CollectionItem) => {
    if (item.type === "manga") {
      openManga(item.id);
      return;
    }
    const type: MetaType = item.type === "series" ? "series" : "movie";
    openMeta({ id: item.id, type, name: item.name, poster: item.poster });
  };

  return (
    <main ref={scrollRef} className="relative flex-1 overflow-y-auto">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[62vh]">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            draggable={false}
            className={`h-full w-full object-cover ${backdropSharp ? "" : "scale-110 blur-2xl"}`}
          />
        ) : (
          <div className="h-full w-full" style={{ background: posterPlate(seed) }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-canvas/85 to-canvas" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-9 px-5 pb-24 pt-24 sm:px-8 lg:px-12 lg:pt-28">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 ps-3.5 pe-5 text-[14px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-raised"
          >
            <ArrowLeft size={17} strokeWidth={2.2} className="dir-icon" />
            {t("Collections")}
          </button>
          <SaveCollectionButton collection={collection} />
        </div>

        <header className="flex min-w-0 max-w-4xl flex-col gap-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("Collection")}
          </span>
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.25rem)] font-medium leading-[1.02] tracking-tight text-ink">
            {collection.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <UserHoverCard handle={collection.handle}>
              <button
                type="button"
                onClick={() => requestOpenProfile(collection.handle)}
                aria-label={t("Open {alias} profile", { alias: collection.displayName })}
                className="inline-flex items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 py-1 ps-1 pe-3 backdrop-blur-md transition-colors hover:bg-raised"
              >
                <Avatar name={collection.displayName} src={collection.avatarUrl} size={24} />
                <span className="text-[13px] font-semibold text-ink">@{collection.handle}</span>
              </button>
            </UserHoverCard>
            <span className="text-[13px] tabular-nums text-ink-subtle">
              {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
            </span>
          </div>
          {collection.description && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
              {collection.description}
            </p>
          )}
        </header>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/40 px-8 py-16 text-center">
            <p className="font-display text-[19px] font-medium text-ink">{t("Nothing here yet")}</p>
            <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
              {t("This collection does not have any titles in it right now.")}
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => open(item)}
                title={item.name}
                className="group/poster flex flex-col gap-2 text-start"
              >
                <div className="relative transition-transform duration-200 ease-out group-hover/poster:-translate-y-0.5">
                  <ResultPoster
                    id={item.id}
                    poster={item.poster}
                    className="ring-1 ring-transparent transition-all duration-200 group-hover/poster:ring-edge"
                  />
                </div>
                <span className="line-clamp-2 text-[12.5px] leading-tight text-ink-muted">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
