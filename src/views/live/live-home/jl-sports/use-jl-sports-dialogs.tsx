import { useCallback, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import type { JlFavoritePlayer } from "@/lib/jl/sports/favorites";
import type { SportsGame } from "@/lib/sports/espn";
import { FollowPanel } from "./follow-panel";
import { JlDialog } from "./jl-dialog";
import { PregameInsightView } from "./pregame-insight";
import type { JlHubGame } from "./use-jl-sports";
import { WatchChooser } from "./watch-chooser";

type Open = { kind: "watch"; item: JlHubGame } | { kind: "pregame"; item: JlHubGame } | { kind: "follow" } | null;

export type JlSportsActions = {
  watch: (item: JlHubGame) => void;
  pregame: (item: JlHubGame) => void;
  follow: () => void;
};

/** One place for the Sports Hub's dialogs, shared by the hero and the hub rows. */
export function useJlSportsDialogs(params: {
  players: JlFavoritePlayer[];
  onPlay: (channel: IptvChannel) => void;
  onOpenGame: (game: SportsGame) => void;
}): { actions: JlSportsActions; dialogs: ReactNode } {
  const { players, onPlay, onOpenGame } = params;
  const t = useT();
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const actions: JlSportsActions = {
    watch: (item) => setOpen({ kind: "watch", item }),
    pregame: (item) => setOpen({ kind: "pregame", item }),
    follow: () => setOpen({ kind: "follow" }),
  };
  let dialogs: ReactNode = null;
  if (open?.kind === "watch") {
    dialogs = <WatchChooser item={open.item} onPlay={onPlay} onOpenGame={onOpenGame} onClose={close} />;
  } else if (open?.kind === "pregame") {
    const g = open.item.game;
    dialogs = (
      <JlDialog title={t("Pre-game: {away} at {home}", { away: g.away.abbr || g.away.name, home: g.home.abbr || g.home.name })} onClose={close} wide>
        <PregameInsightView game={g} players={players} />
      </JlDialog>
    );
  } else if (open?.kind === "follow") {
    dialogs = <FollowPanel onClose={close} />;
  }
  return { actions, dialogs };
}
