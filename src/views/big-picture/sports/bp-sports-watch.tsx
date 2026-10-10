import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { goBigPictureTab } from "@/lib/big-picture";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import type { SportsGame } from "@/lib/sports/espn-types";
import { matchChannelsForGameAsync, type ChannelMatch } from "@/lib/sports/iptv-match";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import { setAttachedStream, useAttachments } from "@/views/sports/source-store";
import { fixtureLabelOf } from "@/views/sports/watch-flow";
import { useSportsChannelIndex } from "@/views/sports/watch-sources";
import { useBpT } from "../bp-i18n";
import {
  setBpWatchFixture,
  useBpSportsPlayChannel,
  useBpSportsPlayStream,
  useBpWatchGame,
} from "./bp-sports-broadcast-play";
import { useBpOfficialBroadcasts } from "./bp-sports-broadcast-source";
import type { BpSportsPickerProps } from "./bp-sports-broadcast-picker";

export { BpSportsWatchPicker } from "./bp-sports-broadcast-picker";
export type { BpSportsPickerProps } from "./bp-sports-broadcast-picker";

export type BpSportsWatchAddons = {
  available: boolean;
  matched: boolean;
  open: () => void;
};

export type BpSportsWatchPlan =
  | "finished"
  | "stream"
  | "broadcast"
  | "channel"
  | "addons"
  | "loading"
  | "picker"
  | "setup";

export type BpSportsWatchState = {
  addonPrimary: boolean;
  label: string;
  press: () => void;
  picking: boolean;
  available: boolean;
  canPick: boolean;
  pickLabel: string;
  openPicker: () => void;
  pickerProps: BpSportsPickerProps;
};

export function useBpSportsWatch(
  game: SportsGame,
  addons?: BpSportsWatchAddons,
): BpSportsWatchState {
  const t = useBpT();
  const sources = usePlaylists();
  const index = useSportsChannelIndex();
  const attachments = useAttachments();
  const playChannel = useBpSportsPlayChannel();
  const playStream = useBpSportsPlayStream();
  const broadcasts = useBpOfficialBroadcasts(game);
  const [matches, setMatches] = useState<ChannelMatch[]>([]);
  const [picking, setPicking] = useState(false);
  const [auto, setAuto] = useState<EsportsStream | null>(null);

  const addonsRef = useRef(addons);
  addonsRef.current = addons;

  const attachedIds = useMemo(
    () => attachments.channels[game.league] ?? [],
    [attachments, game.league],
  );
  const stream = attachments.streams[game.id] ?? null;
  const label = fixtureLabelOf(game);

  useEffect(() => {
    setBpWatchFixture(game);
    return () => setBpWatchFixture(null);
  }, [game]);

  useEffect(() => {
    const controller = new AbortController();
    void matchChannelsForGameAsync(
      game,
      index,
      { attachedIds, broadcastNames: game.broadcasts, limit: 8 },
      controller.signal,
    )
      .then((found) => {
        if (!controller.signal.aborted) setMatches(found);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [game, index, attachedIds]);

  const selected = matches.find((m) => m.tier === "exact" || m.attached) ?? null;
  const hasSources = sources.length > 0;
  const shows = broadcasts.list;
  const pickCount = shows.length + matches.length + (stream ? 1 : 0);
  const matchedAddon = addons?.matched ?? false;
  const anyAddon = addons?.available ?? false;

  const plan: BpSportsWatchPlan =
    game.state === "post"
      ? "finished"
      : stream
        ? "stream"
        : shows.length > 0
          ? "broadcast"
          : selected
            ? "channel"
            : matchedAddon
              ? "addons"
              : index.loading
                ? "loading"
                : hasSources && matches.length > 0
                  ? "picker"
                  : anyAddon
                    ? "addons"
                    : hasSources
                      ? "picker"
                      : "setup";

  const pick = useCallback(
    (match: ChannelMatch) => {
      setPicking(false);
      setAttachedStream(game.id, null);
      playChannel(match.channel, label);
    },
    [playChannel, label, game.id],
  );

  const playSearched = useCallback(
    (channel: Parameters<typeof playChannel>[0]) => {
      setPicking(false);
      setAttachedStream(game.id, null);
      playChannel(channel, label);
    },
    [playChannel, label, game.id],
  );

  const openSetup = useCallback(() => {
    setPicking(false);
    goBigPictureTab("live");
  }, []);

  const openPicker = useCallback(() => {
    setAuto(null);
    setPicking(true);
  }, []);

  const openAddons = useCallback(() => {
    setAuto(null);
    setPicking(false);
    addonsRef.current?.open();
  }, []);

  const close = useCallback(() => {
    setAuto(null);
    setPicking(false);
  }, []);

  const press = useCallback(() => {
    if (plan === "stream" && stream) {
      playStream(stream, label);
      return;
    }
    if (plan === "broadcast") {
      setAuto(pickCount > 1 ? null : shows[0]);
      setPicking(true);
      return;
    }
    if (plan === "channel" && selected) {
      playChannel(selected.channel, label);
      return;
    }
    if (plan === "addons") {
      addonsRef.current?.open();
      return;
    }
    if (plan === "setup") {
      goBigPictureTab("live");
      return;
    }
    setAuto(null);
    setPicking(true);
  }, [plan, stream, shows, pickCount, selected, playStream, playChannel, label]);

  const copy = useMemo(() => {
    if (plan === "finished") return t("Game finished");
    if (plan === "stream") return t("Watch");
    if (plan === "broadcast") return pickCount > 1 ? t("Where to watch") : t("Watch the broadcast");
    if (plan === "channel") return game.state === "pre" ? t("Preview channel") : t("Watch");
    if (plan === "addons") return t("Addon sources");
    if (plan === "loading") return t("Checking your channels…");
    if (plan === "picker")
      return matches.length > 0 ? t("Choose a channel") : t("No channel found");
    return t("Set up Live TV");
  }, [plan, pickCount, game.state, matches.length, t]);

  const pickerProps = useMemo<BpSportsPickerProps>(
    () => ({
      matches,
      onPick: pick,
      onSetup: openSetup,
      onClose: close,
      game,
      broadcasts: shows,
      autoBroadcast: auto,
      onChannel: playSearched,
      onAddons: addons?.available ? openAddons : undefined,
    }),
    [
      matches,
      pick,
      openSetup,
      close,
      game,
      shows,
      auto,
      playSearched,
      addons?.available,
      openAddons,
    ],
  );

  return {
    addonPrimary: plan === "addons",
    label: copy,
    press,
    picking,
    available: game.state !== "post",
    canPick: pickCount > 1 || stream !== null,
    pickLabel: t("Choose a channel"),
    openPicker,
    pickerProps,
  };
}

export function BpSportsWatchLoader({
  onReady,
}: {
  onReady: (watch: ((game: SportsGame) => boolean) | null) => void;
}) {
  const index = useSportsChannelIndex();
  const watch = useBpWatchGame(index);
  const live = useRef(watch);
  live.current = watch;
  const stable = useMemo(() => (game: SportsGame) => live.current(game), []);
  useEffect(() => {
    onReady(stable);
    return () => onReady(null);
  }, [stable, onReady]);
  return null;
}
