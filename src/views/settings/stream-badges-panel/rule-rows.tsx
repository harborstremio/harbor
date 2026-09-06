import { Trash2 } from "../icons";
import {
  badgeLabel,
  FormatBadge,
  RuleBadgeChip,
  type BadgeKind,
} from "@/components/format-badge";
import { setBadgeRules, type CustomBadgeRule } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_DANGER, SettingRow } from "../kit";
import { Segmented } from "../shared";
import { SButton } from "../ui";
import { handoffFocus } from "./focus-handoff";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const TITLE_LINE = "inline-flex min-w-0 flex-wrap items-center gap-2";

const ON_OFF = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

function ruleSource(r: CustomBadgeRule): string | null {
  const id = r.id.startsWith("nuvio-") ? r.id.slice(6) : r.id;
  if (id.startsWith("minimal-")) return "Minimal";
  if (id.startsWith("abstract-")) return "Abstract";
  if (id.startsWith("harborlight-")) return "Harbor Light";
  if (id.startsWith("harborcolor-")) return "Harbor Color";
  return r.id.startsWith("nuvio-") ? "Nuvio" : null;
}

export function RuleRow({ rule, all }: { rule: CustomBadgeRule; all: CustomBadgeRule[] }) {
  const t = useT();
  const source = ruleSource(rule);
  return (
    <SettingRow
      label={
        <span className={TITLE_LINE}>
          <span data-tv-skip className="contents">
            <RuleBadgeChip rule={rule} size="lg" />
          </span>
          <span className="min-w-0">{rule.name}</span>
          {source && <span className={`${QUAL} bg-elevated text-ink-subtle`}>{source}</span>}
        </span>
      }
      desc={<span className="break-words font-mono">{rule.pattern}</span>}
    >
      <Segmented
        value={rule.enabled ? "on" : "off"}
        options={ON_OFF}
        onChange={(v) =>
          setBadgeRules(
            all.map((r) => (r.id === rule.id ? { ...r, enabled: v === "on" } : r)),
          )
        }
      />
      <SButton
        variant="danger"
        onClick={() => handoffFocus(() => setBadgeRules(all.filter((r) => r.id !== rule.id)))}
      >
        <Trash2 size={18} />
        {t("Delete")}
      </SButton>
    </SettingRow>
  );
}

export function RemapRow({
  kind,
  hidden,
  onEdit,
  onRemove,
  resetRef,
}: {
  kind: BadgeKind;
  hidden: boolean;
  onEdit: () => void;
  onRemove: () => void;
  resetRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useT();
  return (
    <SettingRow
      label={
        <span className={TITLE_LINE}>
          {!hidden && (
            <span data-tv-skip className="contents">
              <FormatBadge kind={kind} size="md" />
            </span>
          )}
          <span className="min-w-0">{badgeLabel(kind)}</span>
          <span className={`${QUAL} bg-elevated text-ink-subtle`}>
            {hidden ? t("Hidden") : t("Custom art")}
          </span>
        </span>
      }
      desc={
        hidden
          ? t("This badge is hidden everywhere streams show format chips.")
          : t("This badge uses art you picked instead of Harbor's default.")
      }
    >
      <SButton onClick={onEdit}>{t("Edit")}</SButton>
      <button ref={resetRef} type="button" onClick={onRemove} className={ROW_ACTION_DANGER}>
        {t("Reset")}
      </button>
    </SettingRow>
  );
}
