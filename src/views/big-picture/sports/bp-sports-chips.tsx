import { useMemo } from "react";
import { RefreshCw, Star } from "lucide-react";
import { useUiLanguage } from "@/lib/i18n";
import { SportIcon } from "@/views/sports/sport-icon";
import { useBpT } from "../bp-i18n";
import { BpChip, BpChipDivider, BpChipRow } from "../bp-library-chips";
import type { BpSportsMode } from "./bp-sports-types";
import type { BpSportsStatus } from "./use-bp-sports";

const ALL_GROUPS = "all";

const MODES: { key: BpSportsMode; label: string }[] = [
  { key: "for-you", label: "For you" },
  { key: "live", label: "Live now" },
  { key: "schedule", label: "Schedule" },
  { key: "hot", label: "Hot" },
  { key: "explore", label: "Explore" },
];

const STATUS =
  "ms-auto shrink-0 ps-[clamp(10px,1vw,20px)] text-[calc(clamp(11px,1.5vh,17px)*var(--bp-up,1))] font-semibold uppercase tracking-[0.16em] text-ink-subtle";

type BpSportsGroup = { key: string; label: string };

export function BpSportsChips({
  mode,
  onMode,
  group,
  groups,
  onGroup,
  showGroups,
  onPersonalize,
  status,
  onRefresh,
}: {
  mode: BpSportsMode;
  onMode: (mode: BpSportsMode) => void;
  group: string;
  groups: BpSportsGroup[];
  onGroup: (key: string) => void;
  showGroups: boolean;
  onPersonalize?: () => void;
  status: BpSportsStatus;
  onRefresh: () => void;
}) {
  const t = useBpT();
  const locale = useUiLanguage();
  const shown = groups;
  const rest = 0;

  const stamp = useMemo(
    () =>
      status.at > 0
        ? new Date(status.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
        : "",
    [status.at, locale],
  );
  const note =
    mode === "explore"
      ? ""
      : status.busy
        ? t("Updating schedules…")
        : stamp !== ""
          ? t("Updated {time}", { time: stamp })
          : "";
  const again = !status.busy && (status.failed || status.stale);

  return (
    <>
      <BpChipRow trailing={note === "" ? undefined : <span className={STATUS}>{note}</span>}>
        {MODES.map((item) => (
          <BpChip
            key={item.key}
            label={t(item.label)}
            selected={mode === item.key}
            restoreKey={`sports-mode:${item.key}`}
            onSelect={() => onMode(item.key)}
          />
        ))}
        <BpChipDivider />
        {onPersonalize && (
          <BpChip
            label={t("Make it yours")}
            icon={<Star size={18} strokeWidth={2.3} />}
            restoreKey="sports-personalize"
            onSelect={onPersonalize}
          />
        )}
        <BpChip
          label={again ? t("Retry") : t("Refresh")}
          icon={
            <RefreshCw
              size={18}
              strokeWidth={2.3}
              className={status.busy ? "animate-spin motion-reduce:[animation-duration:2.4s]" : ""}
            />
          }
          restoreKey="sports-refresh"
          onSelect={onRefresh}
        />
      </BpChipRow>

      {showGroups && (
        <BpChipRow>
          <BpChip
            label={t("Your sports")}
            selected={group === ALL_GROUPS}
            restoreKey={`sports-group:${ALL_GROUPS}`}
            onSelect={() => onGroup(ALL_GROUPS)}
          />
          {shown.map((item) => (
            <BpChip
              key={item.key}
              label={item.label}
              selected={group === item.key}
              icon={<SportIcon name={item.key} size={20} />}
              restoreKey={`sports-group:${item.key}`}
              onSelect={() => onGroup(item.key)}
            />
          ))}
          <BpChip
            label={t("All sports")}
            count={rest > 0 ? rest : undefined}
            ariaLabel={rest > 0 ? t("All sports, {n} more", { n: rest }) : undefined}
            restoreKey="sports-group:explore"
            onSelect={() => onMode("explore")}
          />
        </BpChipRow>
      )}
    </>
  );
}
