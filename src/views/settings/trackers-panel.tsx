import { lazy, Suspense, useState } from "react";
import anilistLogo from "@/assets/anilist.png";
import malLogo from "@/assets/mal.png";
import simklLogo from "@/assets/simkl.png";
import traktLogo from "@/assets/trakt.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { consumeTracker } from "./tracker-request";
import { useSubTabs } from "./sub-tabs";

const TraktPanel = lazy(() => import("./trakt-panel").then((m) => ({ default: m.TraktPanel })));
const AnilistPanel = lazy(() => import("./anilist-panel").then((m) => ({ default: m.AnilistPanel })));
const MalPanel = lazy(() => import("./mal-panel").then((m) => ({ default: m.MalPanel })));
const SimklPanel = lazy(() => import("./simkl-panel").then((m) => ({ default: m.SimklPanel })));
const LetterboxdPanel = lazy(() =>
  import("./letterboxd-panel").then((m) => ({ default: m.LetterboxdPanel })),
);

type TrackerId = "trakt" | "simkl" | "anilist" | "mal" | "letterboxd";

const TRACKERS: Array<{ id: TrackerId; name: string; logo: string; blurb: string }> = [
  {
    id: "trakt",
    name: "Trakt",
    logo: traktLogo,
    blurb: "Scrobbles what you play, syncs your watchlist, and powers recommendations.",
  },
  {
    id: "simkl",
    name: "Simkl",
    logo: simklLogo,
    blurb: "Marks finished shows as watched and keeps plan-to-watch in step across apps.",
  },
  {
    id: "anilist",
    name: "AniList",
    logo: anilistLogo,
    blurb: "Shows your anime lists as rails and keeps episode progress up to date.",
  },
  {
    id: "mal",
    name: "MyAnimeList",
    logo: malLogo,
    blurb: "Syncs anime progress and lets you browse your MAL list inside Harbor.",
  },
  {
    id: "letterboxd",
    name: "Letterboxd",
    logo: letterboxdLogo,
    blurb: "Brings your watchlist, diary, likes and lists in through the Stremboxd bridge.",
  },
];

export function TrackersPanel() {
  const t = useT();
  const [active, setActive] = useState<TrackerId>(() => {
    const req = consumeTracker();
    return (TRACKERS.some((s) => s.id === req) ? req : "trakt") as TrackerId;
  });
  const { settings } = useSettings();
  const trakt = useTrakt();
  const simkl = useSimkl();
  const anilist = useAnilist();
  const mal = useMal();
  const connected: Record<TrackerId, boolean> = {
    trakt: trakt.isConnected,
    simkl: simkl.isConnected,
    anilist: anilist.isConnected,
    mal: mal.isConnected,
    letterboxd: !!settings.letterboxd?.enabled && !!settings.letterboxd?.username,
  };
  const total = TRACKERS.filter((s) => connected[s.id]).length;

  useSubTabs(
    TRACKERS.map((s) => ({ id: s.id, label: s.name, icon: s.logo, dot: connected[s.id] })),
    active,
    (id) => setActive(id as TrackerId),
  );

  return (
    <>
      {total > 0 && (
        <p className="px-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("{n} of {total} connected", { n: total, total: TRACKERS.length })}
        </p>
      )}

      <div key={active} className="harbor-cascade flex flex-col gap-10">
        <Suspense fallback={<div className="h-40 rounded-md bg-elevated" />}>
          {active === "trakt" && <TraktPanel />}
          {active === "simkl" && <SimklPanel />}
          {active === "anilist" && <AnilistPanel />}
          {active === "mal" && <MalPanel />}
          {active === "letterboxd" && <LetterboxdPanel />}
        </Suspense>
      </div>
    </>
  );
}
