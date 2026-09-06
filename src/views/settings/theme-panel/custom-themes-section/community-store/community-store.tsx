import { useState } from "react";
import { AlertCircle, RefreshCw, Sparkles, Upload } from "../../../icons";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { getTheme, type StoreTheme } from "@/lib/theme-store";
import type { Mood } from "./color-rank";
import { ThemeDetail } from "./theme-detail";
import { NotificationBell } from "./notifications/notification-bell";
import { ThemeUploadFlow } from "../theme-upload-flow";
import { useStoreThemes } from "./use-store-themes";
import { StoreTabs, type StoreTab } from "./store-tabs";
import { StoreDiscover } from "./store-discover";
import { StoreBrowse } from "./store-browse";
import { StoreSkeleton } from "./store-skeleton";
import { BundleBrowse } from "./bundle-browse";
import { BundleUploadFlow } from "./bundle-upload-flow";
import type { BundleKind } from "@/lib/bundle-store";

export function CommunityStore({ initialTab = "discover" }: { initialTab?: StoreTab } = {}) {
  const t = useT();
  const { data, loading, error, reload } = useStoreThemes();
  const [tab, setTab] = useState<StoreTab>(initialTab);
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [selected, setSelected] = useState<StoreTheme | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bundleUpload, setBundleUpload] = useState<BundleKind | null>(null);

  const ready = !!data && !loading && !error;
  const empty = ready && data.all.length === 0;
  const interactive = ready && !empty;
  const themeTab = tab === "discover" || tab === "themes";
  const bundleKind: BundleKind | null =
    tab === "badges" ? "badge" : tab === "awards" ? "award" : null;

  const onTab = (t: StoreTab) => {
    setTab(t);
    if (t === "discover") {
      setQuery("");
      setMood(null);
    }
  };
  const onSearch = (v: string) => {
    setQuery(v);
    if (v && tab === "discover") setTab("themes");
  };
  const onPickMood = (m: Mood) => {
    setMood(m);
    setQuery("");
    setTab("themes");
  };
  const onBrowseAll = () => {
    setMood(null);
    setTab("themes");
  };
  const onAuthor = (author: string) => {
    setMood(null);
    setQuery(author);
    setTab("themes");
  };
  const openThemeById = (themeId: string) => {
    const t = data?.all.find((x) => x.id === themeId);
    if (t) {
      setSelected(t);
      return;
    }
    getTheme(themeId)
      .then(setSelected)
      .catch(() => {});
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ps-[9px] pb-1">
        <StoreTabs active={tab} onSelect={onTab} />
        {themeTab && (
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-11 items-center gap-2 rounded-full bg-elevated px-4 transition-opacity ${
                interactive ? "" : "pointer-events-none opacity-40"
              }`}
            >
              <Search size={18} className="text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t("Search themes")}
                className="w-48 bg-transparent text-[15.5px] leading-[22px] text-ink placeholder:text-ink-subtle focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <Upload size={16} strokeWidth={2.2} /> {t("Share a theme")}
            </button>
            <NotificationBell onOpenTheme={openThemeById} />
          </div>
        )}
        {bundleKind && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBundleUpload(bundleKind)}
              className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <Upload size={16} strokeWidth={2.2} /> {t("Share a pack")}
            </button>
            <NotificationBell onOpenTheme={openThemeById} />
          </div>
        )}
      </div>

      {bundleKind ? (
        <BundleBrowse kind={bundleKind} onShare={() => setBundleUpload(bundleKind)} />
      ) : loading ? (
        <StoreSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.all.length === 0 ? (
        <EmptyState onShare={() => setUploadOpen(true)} />
      ) : tab === "discover" ? (
        <StoreDiscover
          data={data}
          onOpen={setSelected}
          onAuthor={onAuthor}
          onBrowseAll={onBrowseAll}
          onPickMood={onPickMood}
          onShare={() => setUploadOpen(true)}
        />
      ) : (
        <StoreBrowse
          themes={data.all}
          query={query}
          mood={mood}
          onOpen={setSelected}
          onClearMood={() => setMood(null)}
        />
      )}

      {selected && <ThemeDetail theme={selected} onClose={() => setSelected(null)} />}
      {uploadOpen && <ThemeUploadFlow onClose={() => setUploadOpen(false)} />}
      {bundleUpload && (
        <BundleUploadFlow initialKind={bundleUpload} onClose={() => setBundleUpload(null)} />
      )}
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-md bg-surface px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-danger/15 text-danger">
        <AlertCircle size={22} />
      </span>
      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <RefreshCw size={16} strokeWidth={2.2} /> {t("Try again")}
      </button>
    </div>
  );
}

function EmptyState({ onShare }: { onShare: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-dashed border-edge bg-surface px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
        <Sparkles size={26} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[18px] font-semibold tracking-tight text-ink">
          {t("No community themes yet")}
        </h3>
        <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
          {t("Be the first to share a look. Publish a theme and it shows up here for everyone.")}
        </p>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[15.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <Upload size={16} strokeWidth={2.2} /> {t("Share a theme")}
      </button>
    </div>
  );
}
