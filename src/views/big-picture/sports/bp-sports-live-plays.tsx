import { useState } from "react";
import type { MatchEvent, SportsMatchDetail } from "@/lib/sports/espn-types";
import { playIcon } from "@/lib/sports/play-icon";
import { PlayEventIcon } from "@/views/sports/play-event-icon";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_MICRO,
  BP_SPORTS_NAME,
  BP_SPORTS_NOTE,
  BP_SPORTS_TIP,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
} from "./bp-sports-extra-kit";

const WIDE = "clamp(360px,42vw,860px)";

const COLLAPSED = 6;

const OPENED = 24;

const RISE = "[animation:bp-rise_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]";

const ROW =
  "flex w-full items-start gap-[clamp(11px,1.05vw,20px)] rounded-[var(--bp-r-sm)] px-[clamp(9px,0.8vw,16px)] py-[clamp(8px,0.95vh,15px)]";

const TIME = `${BP_SPORTS_MICRO} w-[clamp(52px,5.4vw,104px)] shrink-0 pt-[0.2em]`;

const GLYPH =
  "flex h-[clamp(30px,3.6vh,50px)] w-[clamp(30px,3.6vh,50px)] shrink-0 items-center justify-center rounded-full [&>svg]:h-[62%] [&>svg]:w-[62%]";

const SCORED = new Set(["goal", "touchdown", "homerun", "three", "score", "finish"]);

function scored(event: MatchEvent): boolean {
  const kind = playIcon(event);
  if (SCORED.has(kind)) return true;
  if (kind !== "kick") return false;
  if (/\bno\s*good\b|\bmissed\b|\bblocked\b/i.test(event.text)) return false;
  if (!/field goal|extra point|\bpat\b/i.test(event.text)) return false;
  return /\bgood\b/i.test(event.text);
}

export function bpSportsHasPlays(detail: SportsMatchDetail | null): boolean {
  return (detail?.events.length ?? 0) > 0;
}

export function BpSportsLivePlaysCell({
  detail,
  caption,
}: {
  detail: SportsMatchDetail;
  caption: string;
}) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const newest = [...detail.events].reverse();
  const shown = newest.slice(0, expanded ? OPENED : COLLAPSED);
  const rest = newest.length - shown.length;

  return (
    <BpSportsPanelCell
      restoreKey="sports-plays"
      width={WIDE}
      expanded={expanded}
      onPress={rest > 0 || expanded ? () => setExpanded(!expanded) : undefined}
      foot={
        expanded
          ? t("Show less")
          : rest > 0
            ? t("Show all {n}", { n: Math.min(newest.length, OPENED) })
            : ""
      }
    >
      {caption !== "" && <span className={`${BP_SPORTS_TIP} truncate`}>{caption}</span>}
      {shown.map((event, index) => {
        const loud = scored(event);
        return (
          <span
            key={event.id || `${event.time}:${event.text}`}
            style={{ animationDelay: `${Math.min(index, 8) * 38}ms` }}
            className={`${ROW} ${RISE} ${loud ? "bg-[var(--bp-on)]" : ""}`}
          >
            <span className={TIME}>{event.time}</span>
            <span
              className={`${GLYPH} ${
                loud
                  ? "bg-ink text-[var(--color-canvas)]"
                  : "bg-[var(--bp-void)]/60 text-ink-subtle"
              }`}
            >
              <PlayEventIcon event={event} size={24} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span
                className={`${loud ? BP_SPORTS_VALUE : BP_SPORTS_NAME} line-clamp-2 ${
                  loud ? "" : "text-ink-muted"
                }`}
              >
                {event.text}
              </span>
              {event.participantName ? (
                <span className={`${BP_SPORTS_NOTE} truncate`}>{event.participantName}</span>
              ) : null}
            </span>
          </span>
        );
      })}
    </BpSportsPanelCell>
  );
}
