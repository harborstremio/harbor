import type { MatchEvent } from "@/lib/sports/espn";
import { playIcon } from "@/lib/sports/play-icon";

// Original 24px event glyphs share Harbor's rounded, single-weight sports strokes.
const paths: Record<string, string> = {
  timeout: "M8 3h8M12 3v3M8 11v6m8-6v6M19 5l2 2 M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  interception: "M3 7h11l4 4-4 4H8m0 0 4 4m-4-4 4-4M18 3l3 3-3 3",
  fumble: "m5 4 3 4M3 12h4m10 8 2 2M15 5c8 1 8 9 1 14-8-1-8-9-1-14Zm-3 8 5-4m-4 1 3 4",
  touchdown: "M5 21v-9L2 5m17 16v-9l3-7M9 10v9m6-9v9M9 4h6v4H9z",
  kick: "M5 3v8h14V3M12 11v10M8 21h8M3 17l4-2",
  sack: "m4 5 6 6m-6 0 6-6M15 4l5 7-4 8m-3-5 7 6M3 20h8",
  incomplete: "M3 7h9l5 5m-3-6 4 7-7-1M15 17l6 6m0-6-6 6",
  pass: "M3 17c3-8 9-9 17-9m-5-5 5 5-5 5M3 21h5",
  penalty: "M6 22V3l13 2-3 5 3 5-13-2",
  homerun: "m2 12 10-9 10 9-10 9Zm7-1 3-2 3 2v4H9z",
  strikeout: "M6 4v16m0-8 10-8M6 12l10 8",
  three: "M7 4h7l4 4-4 4 4 4-4 4H7M3 3v18",
  score: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  goal: "M3 20V6h18v14M3 6l5 5h8l5-5M8 11v9m8-9v9M3 15h18",
  save: "m12 3 8 3v7l-8 8-8-8V6Zm-4 9 3 3 5-6",
  run: "m14 5 3 1 2 4m-4-3-5 5 4 3-3 6m-1-9-4 7M3 4h5m-7 4h5M16 2h1",
  finish: "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z",
  period: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 7v5l4 3",
  substitution: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
  play: "M5 20V5h5m-5 9h9l6-6m-6 0h6v6",
};
export function PlayEventIcon({ event, size = 22 }: { event: MatchEvent; size?: number }) {
  const kind = playIcon(event);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-play-icon={kind}
    >
      {kind === "yellow_card" || kind === "red_card" ? (
        <rect
          x="6"
          y="3"
          width="12"
          height="18"
          rx="2"
          fill={kind === "yellow_card" ? "#f3c84d" : "#e43a44"}
          stroke="none"
        />
      ) : (
        <path d={paths[kind] ?? paths.play} />
      )}
    </svg>
  );
}
