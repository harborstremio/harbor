import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import anilistLogo from "@/assets/anilist.png";
import malLogo from "@/assets/mal.png";
import simklLogo from "@/assets/simkl.png";
import traktLogo from "@/assets/trakt.svg";
import { useAnilist } from "@/lib/anilist/provider";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { useT } from "@/lib/i18n";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { useScrollMemory } from "@/lib/view";
import { watchlistHas } from "@/lib/watchlist";
import { Bookmark, Clock, HardDrive, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnilistTab } from "./library/anilist-tab";
import { HistoryTab } from "./library/history-tab";
import { LetterboxdTab } from "./library/letterboxd-tab";
import { LocalTab } from "./library/local-tab";
import { MalTab } from "./library/mal-tab";
import { MyListsTab } from "./library/my-lists-tab";
import { TabBtn, type Tab } from "./library/shared";
import { SimklTab } from "./library/simkl-tab";
import { TraktTab } from "./library/trakt-tab";
import { WatchlistTab } from "./library/watchlist-tab";

const LIBRARY_TAB_KEY = "harbor.library.tab";

function readSavedTab(): Tab {
  try {
    const v = localStorage.getItem(LIBRARY_TAB_KEY);
    if (
      v === "watchlist" ||
      v === "history" ||
      v === "local" ||
      v === "lists" ||
      v === "trakt" ||
      v === "anilist" ||
      v === "simkl" ||
      v === "letterboxd" ||
      v === "mal"
    )
      return v;
  } catch {}
  return "watchlist";
}

export function LibraryView({ active }: { active: boolean }) {
  const [tab, setTab] = useState<Tab>(readSavedTab);
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const { isConnected: simklConnected } = useSimkl();
  const lb = useLetterboxd();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("library", scrollRef, active);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_TAB_KEY, tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    if (tab === "trakt" && !traktConnected) setTab("watchlist");
  }, [tab, traktConnected]);

  useEffect(() => {
    if (tab === "anilist" && !anilistConnected) setTab("watchlist");
  }, [tab, anilistConnected]);

  useEffect(() => {
    if (tab === "simkl" && !simklConnected) setTab("watchlist");
  }, [tab, simklConnected]);

  useEffect(() => {
    if (tab === "letterboxd" && !lb.isActive) setTab("watchlist");
  }, [tab, lb.isActive]);

  useEffect(() => {
    if (tab === "mal" && !malConnected) setTab("watchlist");
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
    <main ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-24 pb-14 sm:px-8 lg:px-12 lg:pt-28">
      <div data-tauri-drag-region className="flex flex-col gap-7">
        <Header
          tab={tab}
          onTab={setTab}
          traktConnected={traktConnected}
          anilistConnected={anilistConnected}
          malConnected={malConnected}
          simklConnected={simklConnected}
          lbConnected={lb.isActive}
        />
        {tab === "watchlist" && <WatchlistTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "local" && <LocalTab />}
        {tab === "lists" && <MyListsTab />}
        {tab === "trakt" && traktConnected && <TraktTab />}
        {tab === "anilist" && anilistConnected && <AnilistTab />}
        {tab === "simkl" && simklConnected && <SimklTab />}
        {tab === "letterboxd" && lb.isActive && <LetterboxdTab />}
        {tab === "mal" && malConnected && <MalTab />}
      </div>
    </main>
  );
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
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">{t("My library")}</span>
          <h1 className="font-display text-[44px] font-medium leading-[1.05] text-ink">{t("Your collection.")}</h1>
          <p className="text-[14px] leading-snug text-ink-muted">
            {t(
              "Watchlist is what you've saved for later. History is everything you've watched. Local is files on your computer.",
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-edge-soft">
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
        <TabBtn active={tab === "lists"} onClick={() => onTab("lists")}>
          <Layers size={14} strokeWidth={2.2} />
          {t("My Lists")}
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
            <img src={malLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
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
