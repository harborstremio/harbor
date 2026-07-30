import { ArrowDown, ArrowUp, Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { socialPatch } from "@/lib/social/client";
import { useT } from "@/lib/i18n";
import {
  CARD_LABELS,
  CARD_ORDER_DEFAULT,
  effectiveOrder,
  moveCard,
  sanitizeLayout,
  type CardKey,
} from "@/lib/profile-card-layout";
import type { ProfileSummary } from "./profile-types";

const iconBtn =
  "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-30";

function CardRow({
  label,
  position,
  first,
  last,
  hidden,
  onMove,
  onToggleHide,
}: {
  label: string;
  position: number;
  first: boolean;
  last: boolean;
  hidden: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggleHide: () => void;
}) {
  const t = useT();
  return (
    <li className="flex items-center gap-1 rounded-[14px] py-1.5 pe-1.5 ps-3 ring-1 ring-edge-soft">
      <span className={`flex min-w-0 flex-1 items-baseline gap-2.5 ${hidden ? "opacity-45" : ""}`}>
        <span className="text-[12px] tabular-nums text-ink-subtle">{position}</span>
        <span className="truncate text-[14px] font-medium text-ink">{label}</span>
      </span>
      <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label={t("Move up")} className={iconBtn}>
        <ArrowUp size={16} />
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)} aria-label={t("Move down")} className={iconBtn}>
        <ArrowDown size={16} />
      </button>
      <button
        type="button"
        onClick={onToggleHide}
        aria-label={hidden ? t("Show card") : t("Hide card")}
        className={iconBtn}
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </li>
  );
}

export function ProfileCardsPicker({
  summary,
  onClose,
  onSaved,
}: {
  summary: ProfileSummary;
  onClose: () => void;
  onSaved: (next: ProfileSummary) => void;
}) {
  const t = useT();
  const [order, setOrder] = useState<CardKey[]>(() =>
    effectiveOrder(sanitizeLayout(summary.cardLayout), CARD_ORDER_DEFAULT),
  );
  const [hidden, setHidden] = useState<string[]>(() => sanitizeLayout(summary.cardLayout).hidden ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = order.filter((k) => !hidden.includes(k));

  const toggleHide = (key: CardKey) => {
    setHidden((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const cardLayout = { order, hidden };
      const next = await socialPatch<ProfileSummary>("/social/me/profile", { cardLayout });
      onSaved({ ...next, cardLayout });
      onClose();
    } catch (e) {
      setError((e as Error).message || t("Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] bg-surface ring-1 ring-edge">
        <div className="flex items-center justify-between border-b border-edge-soft px-6 py-4">
          <h2 className="font-display text-[20px] text-ink">{t("Profile cards")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-muted hover:bg-elevated"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="pb-4 text-[13px] text-ink-muted">
            {t("These cards run down your public profile. Set the order they appear in, and hide any you would rather keep to yourself.")}
          </p>
          <ul className="flex flex-col gap-2">
            {order.map((k, i) => (
              <CardRow
                key={k}
                label={t(CARD_LABELS[k])}
                position={i + 1}
                first={i === 0}
                last={i === order.length - 1}
                hidden={hidden.includes(k)}
                onMove={(dir) => setOrder((cur) => moveCard(cur, k, dir))}
                onToggleHide={() => toggleHide(k)}
              />
            ))}
          </ul>
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("{count} of {total} showing", { count: shown.length, total: order.length })}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink-muted hover:bg-elevated"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Check size={20} /> {saving ? t("Saving") : t("Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
