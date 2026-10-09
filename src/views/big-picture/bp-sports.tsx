import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SportsGame } from "@/lib/sports/espn-types";
import {
  getSportsConsentServerSnapshot,
  getSportsConsentSnapshot,
  subscribeSportsConsent,
} from "@/lib/sports/consent";
import { useView } from "@/lib/view";
import { usePageVisible } from "@/lib/visibility";
import { forceBpMeta, unpinBpMeta } from "./bp-focus-meta";
import { useBpT } from "./bp-i18n";
import { BP_CHIP_EDGE_MASK } from "./bp-library-chips";
import { BpRail, type BpRailEntry } from "./bp-rail";
import { BpSportsBackdrop } from "./sports/bp-sports-backdrop";
import { BpSportsWatchProvider } from "./sports/bp-sports-card";
import { BpSportsChips } from "./sports/bp-sports-chips";
import { BpSportsConsent } from "./sports/bp-sports-consent";
import { BpSportsDateBand } from "./sports/bp-sports-date-band";
import { BpSportsEmpty } from "./sports/bp-sports-empty";
import { BpSportsExplore } from "./sports/bp-sports-explore";
import { BpSportsHero } from "./sports/bp-sports-hero";
import { BpSportsPersonalize } from "./sports/bp-sports-personalize";
import { BpSportsRow } from "./sports/bp-sports-row";
import { BpSportsWatchLoader } from "./sports/bp-sports-watch";
import { useBpSports } from "./sports/use-bp-sports";
import { useBpRail } from "./use-bp-rail";
import { recoverBpFocus } from "./use-bp-focus";
import { bpRailSignature, useBpLayoutReflow } from "./use-bp-row-layout";
import { HUB_LEAGUES } from "@/lib/sports/hub-data";

const BAND_TOP = "calc(var(--bp-bar-h) + clamp(20px,2.6vh,36px))";

type BpSportsWatchFn = ((game: SportsGame) => boolean) | null;

export function BpSports() {
  const consent = useSyncExternalStore(
    subscribeSportsConsent,
    getSportsConsentSnapshot,
    getSportsConsentServerSnapshot,
  );
  if (consent.status !== "accepted") return <BpSportsConsent />;
  return <BpSportsPage />;
}

function BpSportsPage() {
  const t = useBpT();
  const pageVisible = usePageVisible();
  const { stackKinds } = useView();
  const active = pageVisible && !stackKinds.includes("player");
  const sports = useBpSports(active);
  const { mode, group, rows, status, heroes, open, empty, setMode } = sports;
  const [focused, setFocused] = useState<SportsGame | null>(null);
  const [browsed, setBrowsed] = useState("");
  const [tuning, setTuning] = useState(false);
  const [watch, setWatch] = useState<BpSportsWatchFn>(null);

  useEffect(() => {
    unpinBpMeta();
    forceBpMeta(null);
  }, []);

  useEffect(() => {
    setFocused(null);
    setBrowsed("");
  }, [mode, group]);

  const publishWatch = useCallback((next: BpSportsWatchFn) => setWatch(() => next), []);

  const closeTuning = useCallback(() => {
    setTuning(false);
    window.requestAnimationFrame(() => recoverBpFocus());
  }, []);

  const signature = bpRailSignature([sports.signature, tuning ? "tune" : ""]);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  useBpLayoutReflow({ railRef, signature, routeKey: "sports" });

  const anyLive = useMemo(
    () => rows.some((row) => row.games.some((game) => game.state === "in")),
    [rows],
  );

  const seedRow = mode === "schedule" ? -1 : rows.findIndex((row) => row.games.length > 0);
  const entries = useMemo<BpRailEntry[]>(() => {
    const list: BpRailEntry[] = [
      {
        key: "hero",
        node: (
          <BpSportsHero
            games={heroes}
            active={active}
            onSelect={open}
            onFocusGame={setFocused}
            autofocus={heroes.length > 0}
          />
        ),
      },
    ];
    for (const [index, row] of rows.entries()) {
      list.push({
        key: row.key,
        node: (
          <BpSportsRow
            row={row}
            onSelect={open}
            autofocusFirst={index === seedRow && heroes.length === 0}
            onFocusGame={setFocused}
          />
        ),
      });
    }
    list.push({
      key: "empty",
      node: empty ? (
        <BpSportsEmpty
          busy={status.busy}
          mode={mode}
          onToday={() => sports.setDay(sports.today)}
          personalized={sports.personalized}
          autofocus={seedRow < 0 && mode !== "schedule"}
          onExplore={() => setMode("explore")}
          onPersonalize={() => setTuning(true)}
        />
      ) : null,
    });
    return list;
  }, [
    rows,
    seedRow,
    heroes,
    open,
    empty,
    setMode,
    active,
    status.busy,
    mode,
    sports.personalized,
    sports.setDay,
    sports.today,
  ]);

  const brokenList = [...new Set(status.failedKeys.map((key) => key.split("@")[0]))].map((key) =>
    key === "SOCCER_ALL" ? "Soccer" : (HUB_LEAGUES.find((l) => l.key === key)?.labelEn ?? key),
  );
  const brokenNames =
    brokenList.slice(0, 3).join(", ") + (brokenList.length > 3 ? ` +${brokenList.length - 3}` : "");
  const note = status.busy
    ? ""
    : status.stale
      ? t("Showing saved schedules while feeds reconnect.")
      : status.failed
        ? `${t("Some feeds did not respond. Available events are still shown.")}${brokenNames ? ` · ${brokenNames}` : ""}`
        : "";

  return (
    <BpSportsWatchProvider watch={watch}>
      <div className="relative flex h-full flex-col">
        <BpSportsBackdrop
          subject={{ game: focused, group: mode === "explore" && browsed !== "" ? browsed : group }}
        />
        {anyLive && !tuning && <BpSportsWatchLoader onReady={publishWatch} />}

        {tuning ? (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <BpSportsPersonalize onClose={closeTuning} />
          </div>
        ) : (
          <>
            <div
              className="relative z-10 flex shrink-0 flex-col gap-[clamp(7px,0.9vh,15px)] px-[var(--bp-gutter)] pb-[clamp(7px,0.96vh,16px)]"
              style={{
                paddingTop: BAND_TOP,
                maskImage: BP_CHIP_EDGE_MASK,
                WebkitMaskImage: BP_CHIP_EDGE_MASK,
              }}
            >
              <BpSportsChips
                mode={mode}
                onMode={sports.setMode}
                group={group}
                groups={sports.groups}
                onGroup={sports.setGroup}
                showGroups={sports.showGroups}
                onPersonalize={() => setTuning(true)}
                status={status}
                onRefresh={sports.refresh}
              />
              {mode === "schedule" && (
                <BpSportsDateBand
                  day={sports.day}
                  today={sports.today}
                  liveDays={sports.liveDays}
                  onSelect={sports.setDay}
                />
              )}
              {note !== "" && (
                <p
                  role="status"
                  className="text-[calc(clamp(11.5px,1.5vh,17px)*var(--bp-up,1))] font-medium text-ink-subtle"
                >
                  {note}
                </p>
              )}
            </div>

            {mode === "explore" ? (
              <BpSportsExplore onSport={sports.browse} onFocusGroup={setBrowsed} />
            ) : (
              <BpRail
                railRef={railRef}
                entries={entries}
                activeRow={activeRow}
                railShift={railShift}
              />
            )}
          </>
        )}
      </div>
    </BpSportsWatchProvider>
  );
}
