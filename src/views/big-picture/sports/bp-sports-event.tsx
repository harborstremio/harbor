import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Plug, RotateCw, Tv } from "lucide-react";
import type { SportsGame } from "@/lib/sports/espn-types";
import type { SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { runBpBack } from "../bp-back";
import { forceBpMeta, unpinBpMeta } from "../bp-focus-meta";
import { useBpT } from "../bp-i18n";
import { BpPageMessage } from "../bp-page-message";
import type { BpDetailAction } from "../use-bp-detail-actions";
import { useBpGroundFade } from "../detail/use-bp-ground-fade";
import { BpSportsAddonPanel } from "./bp-sports-addon-panel";
import { BpSportsAddonRow } from "./bp-sports-addon-row";
import { useBpSportsAddonSources } from "./bp-sports-addon-sources";
import { BpSportsBackdrop } from "./bp-sports-backdrop";
import { BpSportsEventHero } from "./bp-sports-event-hero";
import {
  BpSportsFactsRow,
  BpSportsLineupsRow,
  BpSportsStandingsRow,
  BpSportsStatsRow,
  BpSportsWhereRow,
} from "./bp-sports-event-rows";
import { BpSportsWatchPicker, useBpSportsWatch, type BpSportsWatchAddons } from "./bp-sports-watch";
import { useBpSportsEvent, useBpSportsEventActions } from "./use-bp-sports-event";

export function BpSportsEvent({ game }: { game: SportsGame }) {
  const t = useBpT();
  const data = useBpSportsEvent(game);
  const actions = useBpSportsEventActions(data);
  const addonSources = useBpSportsAddonSources(data.game);
  const [addonPick, setAddonPick] = useState<{ row: SportsAddonListing | null } | null>(null);

  const openAddons = useCallback((row: SportsAddonListing | null) => {
    setAddonPick({ row });
  }, []);

  const watchAddons = useMemo<BpSportsWatchAddons>(
    () => ({
      available: addonSources.available,
      matched: addonSources.matched,
      open: () => openAddons(null),
    }),
    [addonSources.available, addonSources.matched, openAddons],
  );

  const watch = useBpSportsWatch(data.game, watchAddons);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useBpGroundFade(scrollRef, game.id);

  useEffect(() => {
    unpinBpMeta();
    forceBpMeta(null);
  }, []);

  const { failed, retry, summary } = data;
  const finished = !watch.available;
  const canPick = watch.available && watch.canPick;
  const canRetry = failed && summary;
  const { pickLabel, openPicker, addonPrimary } = watch;
  const showAddonAction = addonSources.available && !addonPrimary;

  const heroActions = useMemo(() => {
    const out: BpDetailAction[] = [];
    if (canPick) {
      out.push({ key: "channels", label: pickLabel, icon: Tv, onPress: openPicker });
    }
    if (showAddonAction) {
      out.push({
        key: "addons",
        label: t("Addon sources"),
        icon: Plug,
        onPress: () => openAddons(null),
      });
    }
    if (canRetry) {
      out.push({ key: "retry", label: t("Try again"), icon: RotateCw, onPress: retry });
    }
    if (out.length === 0 && actions.length === 0 && finished) {
      out.push({
        key: "back",
        label: t("Go back"),
        icon: ArrowLeft,
        onPress: () => {
          runBpBack();
        },
      });
    }
    return [...out, ...actions];
  }, [
    canPick,
    pickLabel,
    openPicker,
    showAddonAction,
    openAddons,
    canRetry,
    retry,
    actions,
    finished,
    t,
  ]);

  if (!game.id) {
    return (
      <BpPageMessage
        title={t("Couldn't load this event.")}
        body={t(
          "Harbor couldn't reach the sports servers. Check the connection and open the event again.",
        )}
        action={t("Go back")}
        onAction={() => runBpBack()}
      />
    );
  }

  const bare =
    (data.detail?.allStats.length ?? 0) === 0 &&
    (data.detail?.homeRoster.length ?? 0) === 0 &&
    (data.detail?.awayRoster.length ?? 0) === 0 &&
    !data.standingsGroup;

  const rows: Array<{ key: string; node: ReactNode }> = [
    { key: "stats", node: <BpSportsStatsRow detail={data.detail} /> },
    { key: "lineups", node: <BpSportsLineupsRow game={data.game} detail={data.detail} /> },
    {
      key: "standings",
      node: (
        <BpSportsStandingsRow
          group={data.standingsGroup}
          highlight={[data.game.home.id, data.game.away.id]}
        />
      ),
    },
    {
      key: "addons",
      node: <BpSportsAddonRow sources={addonSources} onOpen={openAddons} />,
    },
    { key: "where", node: <BpSportsWhereRow game={data.game} /> },
    { key: "facts", node: bare ? <BpSportsFactsRow data={data} /> : null },
  ];

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[-20]">
        <BpSportsBackdrop subject={{ game: data.game, group: data.group }} />
      </div>
      <div
        ref={scrollRef}
        data-bp-scroll-y
        className="relative h-full overflow-y-auto pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={groundRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />
        <BpSportsEventHero
          data={data}
          playLabel={watch.label}
          onPlay={watch.press}
          actions={heroActions}
        />

        <div className="mt-[clamp(44px,5.5vh,88px)] flex flex-col gap-[var(--bp-row-gap)]">
          {rows.map((r, i) => (
            <div key={r.key} data-bp-rail-row={i} className="empty:hidden">
              {r.node}
            </div>
          ))}
        </div>
      </div>

      {watch.picking && <BpSportsWatchPicker {...watch.pickerProps} />}

      {addonPick && (
        <BpSportsAddonPanel
          sources={addonSources}
          initial={addonPick.row}
          onClose={() => setAddonPick(null)}
        />
      )}
    </>
  );
}
