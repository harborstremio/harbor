import { createPortal } from "react-dom";
import { Award, Check, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { socialPost } from "@/lib/social/client";
import { useT } from "@/lib/i18n";
import { useEscape } from "@/components/modal-shell";
import { badgeKey, SHOWN_BADGE_KEY_RE } from "./badge-catalog";
import type { Badge, ProfileSummary } from "./profile-types";

export const MAX_SHOWN_BADGES = 6;

export function pickableBadges(badges: Badge[]): Badge[] {
  const seen = new Set<string>();
  const out: Badge[] = [];
  for (const b of badges) {
    const k = badgeKey(b.name);
    if (k === "verified" || seen.has(k) || !SHOWN_BADGE_KEY_RE.test(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

function BadgeOption({
  badge,
  order,
  disabled,
  onToggle,
  selected: selectedOverride,
  mark,
}: {
  badge: Badge;
  order: number;
  disabled: boolean;
  onToggle: () => void;
  selected?: boolean;
  mark?: ReactNode;
}) {
  const selected = selectedOverride ?? order > 0;
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-2 rounded-lg p-3 text-center ring-1 transition-colors disabled:opacity-40 ${
        selected ? "bg-elevated ring-edge" : "ring-edge-soft hover:bg-elevated"
      }`}
    >
      {selected && (
        <span className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold tabular-nums text-canvas">
          {mark ?? order}
        </span>
      )}
      <div className="flex h-14 w-14 items-center justify-center">
        {badge.iconUrl ? (
          <img
            src={badge.iconUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
          />
        ) : (
          <Award size={28} className="text-ink-muted" />
        )}
      </div>
      <span className="line-clamp-2 text-[11px] leading-tight text-ink-muted">{badge.name}</span>
    </button>
  );
}

export function ShownBadgesPicker({
  badges,
  current,
  hideVerified = false,
  onClose,
  onSaved,
}: {
  badges: Badge[];
  current: string[];
  hideVerified?: boolean;
  onClose: () => void;
  onSaved: (next: ProfileSummary) => void;
}) {
  const t = useT();
  useEscape(onClose);
  const options = useMemo(() => pickableBadges(badges), [badges]);
  const verifiedBadge = useMemo(() => badges.find((b) => badgeKey(b.name) === "verified"), [badges]);
  const [showVerified, setShowVerified] = useState(!hideVerified);
  const [selected, setSelected] = useState<string[]>(() => {
    const valid = new Set(options.map((b) => badgeKey(b.name)));
    const out: string[] = [];
    for (const s of current) {
      const k = badgeKey(s);
      if (valid.has(k) && !out.includes(k)) out.push(k);
    }
    return out.slice(0, MAX_SHOWN_BADGES);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= MAX_SHOWN_BADGES) return cur;
      return [...cur, key];
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { shownBadges: selected };
      if (verifiedBadge) body.hideVerified = !showVerified;
      const next = await socialPost<ProfileSummary>("/social/profile/customization", body);
      onSaved(next);
      onClose();
    } catch (e) {
      setError((e as Error).message || t("Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[185] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-edge">
        <div className="flex items-center justify-between border-b border-edge-soft px-6 py-4">
          <h2 className="font-display text-[20px] text-ink">{t("Shown badges")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-elevated"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="pb-3 text-[13px] text-ink-muted">
            {t("Pick up to {max} badges to show by your name. Tap in the order you want them to appear.", { max: MAX_SHOWN_BADGES })}
          </p>
          {options.length === 0 && !verifiedBadge ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge py-12 text-center">
              <Award size={24} className="text-ink-subtle" />
              <p className="mt-2 text-[14px] text-ink-muted">{t("No badges to show yet")}</p>
              <p className="mt-1 text-[12px] text-ink-subtle">{t("Earn badges and they will appear here to feature")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {verifiedBadge && (
                <BadgeOption
                  key={verifiedBadge.id}
                  badge={verifiedBadge}
                  order={0}
                  selected={showVerified}
                  mark={<Check size={12} strokeWidth={3.2} />}
                  disabled={false}
                  onToggle={() => setShowVerified((v) => !v)}
                />
              )}
              {options.map((b) => {
                const key = badgeKey(b.name);
                return (
                  <BadgeOption
                    key={b.id}
                    badge={b}
                    order={selected.indexOf(key) + 1}
                    disabled={!selected.includes(key) && selected.length >= MAX_SHOWN_BADGES}
                    onToggle={() => toggle(key)}
                  />
                );
              })}
            </div>
          )}
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("{count}/{max} selected", { count: selected.length, max: MAX_SHOWN_BADGES })}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted hover:bg-elevated"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Check size={20} /> {saving ? t("Saving") : t("Save")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
