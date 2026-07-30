import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAnilist } from "@/lib/anilist/provider";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { AnilistTab } from "@/views/library/anilist-tab";
import { FavoritesTab } from "@/views/library/favorites-tab";
import { HistoryTab } from "@/views/library/history-tab";
import { LetterboxdTab } from "@/views/library/letterboxd-tab";
import { LocalTab } from "@/views/library/local-tab";
import { MalTab } from "@/views/library/mal-tab";
import { MyListsTab } from "@/views/library/my-lists-tab";
import { SimklTab } from "@/views/library/simkl-tab";
import { TabBtn, type Tab } from "@/views/library/shared";
import { TraktTab } from "@/views/library/trakt-tab";
import { WatchlistTab } from "@/views/library/watchlist-tab";

const TAB_KEY = "harbor.library.tab";

function readSavedTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    const known: Tab[] = [
      "library",
      "watchlist",
      "history",
      "local",
      "lists",
      "favorites",
      "trakt",
      "anilist",
      "simkl",
      "letterboxd",
      "mal",
    ];
    if (v && (known as string[]).includes(v)) return v as Tab;
  } catch {}
  return "library";
}

export function LibraryPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>(readSavedTab);
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const { isConnected: simklConnected } = useSimkl();
  const lb = useLetterboxd();

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    if (tab === "trakt" && !traktConnected) setTab("library");
    else if (tab === "anilist" && !anilistConnected) setTab("library");
    else if (tab === "simkl" && !simklConnected) setTab("library");
    else if (tab === "letterboxd" && !lb.isActive) setTab("library");
    else if (tab === "mal" && !malConnected) setTab("library");
  }, [tab, traktConnected, anilistConnected, simklConnected, malConnected, lb.isActive]);

  return (
    <div className="flex flex-col gap-5 px-5 pb-8">
      <div className="flex flex-wrap items-center gap-1.5">
        <TabBtn active={tab === "library"} onClick={() => setTab("library")}>
          {t("Library")}
        </TabBtn>
        <TabBtn active={tab === "watchlist"} onClick={() => setTab("watchlist")}>
          {t("Watchlist")}
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
          {t("History")}
        </TabBtn>
        <TabBtn active={tab === "lists"} onClick={() => setTab("lists")}>
          {t("My lists")}
        </TabBtn>
        <TabBtn active={tab === "favorites"} onClick={() => setTab("favorites")}>
          {t("Favorites")}
        </TabBtn>
        <TabBtn active={tab === "local"} onClick={() => setTab("local")}>
          {t("Local")}
        </TabBtn>
        {traktConnected && (
          <TabBtn active={tab === "trakt"} onClick={() => setTab("trakt")}>
            Trakt
          </TabBtn>
        )}
        {anilistConnected && (
          <TabBtn active={tab === "anilist"} onClick={() => setTab("anilist")}>
            AniList
          </TabBtn>
        )}
        {malConnected && (
          <TabBtn active={tab === "mal"} onClick={() => setTab("mal")}>
            MyAnimeList
          </TabBtn>
        )}
        {simklConnected && (
          <TabBtn active={tab === "simkl"} onClick={() => setTab("simkl")}>
            Simkl
          </TabBtn>
        )}
        {lb.isActive && (
          <TabBtn active={tab === "letterboxd"} onClick={() => setTab("letterboxd")}>
            Letterboxd
          </TabBtn>
        )}
      </div>

      {tab === "library" && <WatchlistTab mode="library" />}
      {tab === "watchlist" && <WatchlistTab mode="watchlist" />}
      {tab === "history" && <HistoryTab />}
      {tab === "local" && <LocalTab />}
      {tab === "lists" && <MyListsTab />}
      {tab === "favorites" && <FavoritesTab />}
      {tab === "trakt" && traktConnected && <TraktTab />}
      {tab === "anilist" && anilistConnected && <AnilistTab />}
      {tab === "simkl" && simklConnected && <SimklTab />}
      {tab === "letterboxd" && lb.isActive && <LetterboxdTab />}
      {tab === "mal" && malConnected && <MalTab />}
    </div>
  );
}
