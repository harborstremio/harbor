import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import { PitchView } from "./pitch/pitch-view";
import { SportIcon } from "./sport-icon";
import "./field-preview.css";

export function SoccerPreview({
  game,
  detail,
  loading = false,
  defaultOpen = false,
  failed = false,
  hideScore = false,
}: {
  game: SportsGame;
  detail: SportsMatchDetail | null;
  loading?: boolean;
  defaultOpen?: boolean;
  failed?: boolean;
  hideScore?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const display: SportsMatchDetail = detail ?? {
    ...game,
    homeRoster: [],
    awayRoster: [],
    homeStats: {},
    awayStats: {},
    allStats: [],
    events: [],
  };
  return (
    <details
      className="sh-field-preview"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <SportIcon name="soccer" size={24} />
        <span>
          <strong>{t("On the pitch")}</strong>
          <small>{display.state === "pre" ? t("Lineups") : display.detail}</small>
        </span>
        {!hideScore && (
          <b
            className={
              display.state === "in" && !failed && display.savedAt === undefined ? "is-live" : ""
            }
          >
            {display.state === "pre"
              ? t("Upcoming")
              : `${display.home.score} : ${display.away.score}`}
          </b>
        )}
        <ChevronDown size={18} />
      </summary>
      {open && (
        <div className="sh-field-body">
          <PitchView detail={display} />
          {loading && (
            <p className="sh-muted" role="status">
              {t("Loading lineups…")}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
