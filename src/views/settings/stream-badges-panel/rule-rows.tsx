import { Check, Trash2 } from "lucide-react";
import {
  badgeLabel,
  FormatBadge,
  RuleBadgeChip,
  type BadgeKind,
} from "@/components/format-badge";
import { setBadgeRules, type CustomBadgeRule } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";

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
    <div className="flex items-center gap-3 rounded-md bg-elevated px-4 py-3">
      <span className="w-28 shrink-0 overflow-hidden">
        <RuleBadgeChip rule={rule} size="md" />
      </span>
      <span className="w-32 shrink-0 truncate text-[13px] font-medium text-ink" title={rule.name}>
        {rule.name}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-subtle" title={rule.pattern}>
        {rule.pattern}
      </span>
      {source && (
        <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">
          {source}
        </span>
      )}
      <button
        onClick={() =>
          setBadgeRules(all.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
        }
        aria-label={rule.enabled ? t("Disable rule") : t("Enable rule")}
        title={rule.enabled ? t("On") : t("Off")}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
          rule.enabled ? "bg-accent-soft text-accent" : "text-ink-subtle hover:bg-raised hover:text-ink"
        }`}
      >
        <Check size={14} strokeWidth={2.6} />
      </button>
      <button
        onClick={() => setBadgeRules(all.filter((r) => r.id !== rule.id))}
        aria-label={t("Delete rule")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function RemapRow({
  kind,
  hidden,
  onEdit,
  onRemove,
}: {
  kind: BadgeKind;
  hidden: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-md bg-elevated pe-4">
      <button
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-4 py-3 text-start transition-colors hover:bg-raised"
      >
        <span className="flex w-24 shrink-0 items-center overflow-hidden">
          {hidden ? (
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-subtle">
              {t("Hidden")}
            </span>
          ) : (
            <FormatBadge kind={kind} size="md" />
          )}
        </span>
        <span className="w-32 shrink-0 truncate text-[13px] font-medium text-ink" title={badgeLabel(kind)}>
          {badgeLabel(kind)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-subtle">
          {hidden ? t("Hidden") : t("Custom art")}
        </span>
        <span className="shrink-0 rounded-md bg-canvas px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Remap")}
        </span>
      </button>
      <button
        onClick={onRemove}
        aria-label={t("Remove remap")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
