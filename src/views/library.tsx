import {
  BarChart3,
  Bookmark,
  Clock,
  Eye,
  EyeOff,
  HardDrive,
  Library,
  Server,
  Star,
} from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import traktLogo from "@/assets/trakt.svg";
import anilistLogo from "@/assets/anilist.png";
import simklLogo from "@/assets/simkl.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import { MalLogo } from "@/components/icons/mal-logo";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { useScrollMemory, useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { useContentDrag } from "@/lib/window-drag";
import { useT } from "@/lib/i18n";
import { watchlistHas } from "@/lib/watchlist";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { AnilistTab } from "./library/anilist-tab";
import { HistoryTab } from "./library/history-tab";
import { LocalTab } from "./library/local-tab";
import { MalTab } from "./library/mal-tab";
import { MyListsTab } from "./library/my-lists-tab";
import { FavoritesTab } from "./library/favorites-tab";
import { TabBtn, type Tab } from "./library/shared";
import { SimklTab } from "./library/simkl-tab";
import { TraktTab } from "./library/trakt-tab";
import { WatchlistTab } from "./library/watchlist-tab";
import { LetterboxdTab } from "./library/letterboxd-tab";
import { MediaServersTab } from "./library/media-servers-tab";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { HeroCarousel } from "@/components/hero-carousel";
import { LibraryFeaturedProvider, useLibraryFeatured } from "./library/featured-context";
import { pickFeatured } from "./library/featured-picks";

const LIBRARY_TAB_KEY = "harbor.library.tab";

function readSavedTab(): Tab {
  try {
    let v = localStorage.getItem(LIBRARY_TAB_KEY);
    const migrated = "harbor.library.tab.split.v1";
    if (!localStorage.getItem(migrated)) {
      localStorage.setItem(migrated, "1");
      if (v === "watchlist") {
        localStorage.setItem(LIBRARY_TAB_KEY, "library");
        v = "library";
      }
    }
    if (
      v === "library" ||
      v === "watchlist" ||
      v === "history" ||
      v === "local" ||
      v === "media-servers" ||
      v === "lists" ||
      v === "favorites" ||
      v === "trakt" ||
      v === "anilist" ||
      v === "simkl" ||
      v === "letterboxd" ||
      v === "mal"
    )
      return v;
  } catch {}
  return "library";
}

export function LibraryView({ active }: { active: boolean }) {
  const [tab, setTab] = useState<Tab>(readSavedTab);
  const { settings } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const { isConnected: simklConnected } = useSimkl();
  const lb = useLetterboxd();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("library", scrollRef, active);
  const contentDrag = useContentDrag();

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_TAB_KEY, tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    if (tab === "trakt" && !traktConnected) setTab("library");
  }, [tab, traktConnected]);

  useEffect(() => {
    if (tab === "anilist" && !anilistConnected) setTab("library");
  }, [tab, anilistConnected]);

  useEffect(() => {
    if (tab === "simkl" && !simklConnected) setTab("library");
  }, [tab, simklConnected]);

  useEffect(() => {
    if (tab === "letterboxd" && !lb.isActive) setTab("library");
  }, [tab, lb.isActive]);

  useEffect(() => {
    if (tab === "mal" && !malConnected) setTab("library");
  }, [tab, malConnected]);

  useEffect(() => {
    if (!active) return;
    const label =
      tab === "watchlist"
        ? "Browsing their watchlist"
        : tab === "history"
          ? "Browsing their watch history"
          : tab === "lists"
            ? "Browsing their lists"
            : tab === "trakt"
              ? "Browsing their Trakt library"
              : tab === "simkl"
                ? "Browsing their Simkl library"
                : tab === "letterboxd"
                  ? "Browsing their Letterboxd library"
                  : tab === "mal"
                    ? "Browsing their MyAnimeList library"
                    : "Browsing their Stremio library";
    return pushActivityHint({ details: label, state: "Library" });
  }, [active, tab]);

  return (
    <main
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 pt-24 pb-14 sm:px-8 lg:px-12 lg:pt-28"
    >
      <LibraryFeaturedProvider>
        <div {...contentDrag} className="flex flex-col gap-7">
          {settings.libraryHero && <LibraryHero tabKey={tab} />}
          <Header
            tab={tab}
            onTab={setTab}
            traktConnected={traktConnected}
            anilistConnected={anilistConnected}
            malConnected={malConnected}
            simklConnected={simklConnected}
            lbConnected={lb.isActive}
          />
          {tab === "library" && <WatchlistTab mode="library" />}
          {tab === "watchlist" && <WatchlistTab mode="watchlist" />}
          {tab === "history" && <HistoryTab />}
          {tab === "local" && <LocalTab scrollRef={scrollRef} />}
          {tab === "media-servers" && <MediaServersTab scrollRef={scrollRef} />}
          {tab === "lists" && <MyListsTab />}
          {tab === "favorites" && <FavoritesTab />}
          {tab === "trakt" && traktConnected && <TraktTab />}
          {tab === "anilist" && anilistConnected && <AnilistTab />}
          {tab === "simkl" && simklConnected && <SimklTab />}
          {tab === "letterboxd" && lb.isActive && <LetterboxdTab />}
          {tab === "mal" && malConnected && <MalTab />}
        </div>
      </LibraryFeaturedProvider>
    </main>
  );
}

/**
 * Featured carousel above the tab bar, drawn from whatever the open tab is
 * showing. Hidden below two slides so a small or unhydrated tab doesn't render
 * a dead carousel.
 */
function LibraryHero({ tabKey }: { tabKey: Tab }) {
  const metas = useLibraryFeatured();
  const slides = useMemo(
    () => pickFeatured(metas, tabKey).map((meta) => ({ meta })),
    [metas, tabKey],
  );
  if (slides.length < 2) return null;
  return <HeroCarousel slides={slides} />;
}

function Header({
  tab,
  onTab,
  traktConnected,
  anilistConnected,
  malConnected,
  simklConnected,
  lbConnected,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  traktConnected: boolean;
  anilistConnected: boolean;
  malConnected: boolean;
  simklConnected: boolean;
  lbConnected: boolean;
}) {
  const t = useT();
  const { setView } = useView();
  const { settings, update } = useSettings();
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("My library")}
          </span>
          <h1 className="font-display text-[44px] font-medium leading-[1.05] text-ink">
            {t("Your collection.")}
          </h1>
          <p className="text-[14px] leading-snug text-ink-muted">
            {t(
              "Library is everything from Stremio, Trakt, and this device. Watchlist is only titles you haven't watched yet. History is what you've watched. Local is files on your computer.",
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 self-center">
          <button
            type="button"
            onClick={() => update({ libraryHero: !settings.libraryHero })}
            title={t("Show a featured banner at the top of your library")}
            className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors ${
              settings.libraryHero ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {settings.libraryHero ? (
              <Eye size={15} strokeWidth={2} />
            ) : (
              <EyeOff size={15} strokeWidth={2} />
            )}
            {t("Featured")}
          </button>
          {settings.wrappedButton && (
            <button
              type="button"
              onClick={() => setView("wrapped")}
              className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <BarChart3 size={15} strokeWidth={2} />
              {t("Stats")}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-edge-soft">
        <TabBtn active={tab === "library"} onClick={() => onTab("library")}>
          <Library size={14} strokeWidth={2.2} />
          {t("Library")}
        </TabBtn>
        <TabBtn active={tab === "watchlist"} onClick={() => onTab("watchlist")}>
          <Bookmark size={14} strokeWidth={2.2} />
          {t("Watchlist")}
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => onTab("history")}>
          <Clock size={14} strokeWidth={2.2} />
          {t("History")}
        </TabBtn>
        <TabBtn active={tab === "local"} onClick={() => onTab("local")}>
          <HardDrive size={14} strokeWidth={2.2} />
          {t("Local")}
        </TabBtn>
        <TabBtn active={tab === "media-servers"} onClick={() => onTab("media-servers")}>
          <Server size={14} strokeWidth={2.2} />
          {t("Media Servers")}
        </TabBtn>
        <TabBtn active={tab === "lists"} onClick={() => onTab("lists")}>
          <UiIcon name="list" className="h-3.5 w-3.5" />
          {t("My Lists")}
        </TabBtn>
        <TabBtn active={tab === "favorites"} onClick={() => onTab("favorites")}>
          <Star size={14} strokeWidth={2.2} />
          {t("Favorites")}
        </TabBtn>
        {traktConnected && (
          <TabBtn active={tab === "trakt"} onClick={() => onTab("trakt")}>
            <img src={traktLogo} alt="" className="h-3.5 w-3.5 object-contain" />
            Trakt
          </TabBtn>
        )}
        {anilistConnected && (
          <TabBtn active={tab === "anilist"} onClick={() => onTab("anilist")}>
            <img src={anilistLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
            AniList
          </TabBtn>
        )}
        {malConnected && (
          <TabBtn active={tab === "mal"} onClick={() => onTab("mal")}>
            <MalLogo className="h-3.5 w-3.5" />
            MAL
          </TabBtn>
        )}
        {simklConnected && (
          <TabBtn active={tab === "simkl"} onClick={() => onTab("simkl")}>
            <img src={simklLogo} alt="" className="h-3.5 w-3.5 object-contain" />
            Simkl
          </TabBtn>
        )}
        {lbConnected && (
          <TabBtn active={tab === "letterboxd"} onClick={() => onTab("letterboxd")}>
            <img src={letterboxdLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
            Letterboxd
          </TabBtn>
        )}
      </div>
    </header>
  );
}

void watchlistHas;
