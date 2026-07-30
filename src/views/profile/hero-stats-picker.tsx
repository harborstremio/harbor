import { Check, X } from "lucide-react";
import { useState } from "react";
import { socialPatch } from "@/lib/social/client";
import { useT } from "@/lib/i18n";
import { STAT_LABELS, STAT_ORDER, sanitizeStatLayout, type StatKey } from "@/lib/profile-card-layout";
import { compactNumber, formatWatchTime } from "./profile-bits";
import type { ProfileCounts, ProfileSummary } from "./profile-types";

function watchMinutes(counts: ProfileCounts): number {
  if ((counts.minutesWatched ?? 0) > 0) return counts.minutesWatched ?? 0;
  if ((counts.hoursWatched ?? 0) > 0) return counts.hoursWatched * 60;
  return (counts.moviesWatched ?? 0) * 120 + (counts.episodesWatched ?? 0) * 45;
}

function watchLabel(minutes: number): string {
  const f = formatWatchTime(minutes);
  const parts: Array<[number, string]> = [[f.aVal, f.a], [f.bVal, f.b], [f.cVal, f.c]];
  const kept = parts.filter(([v]) => v > 0).slice(0, 2);
  if (!kept.length) return `0${f.c}`;
  return kept.map(([v, u]) => `${v}${u}`).join(" ");
}

function statValue(counts: ProfileCounts, key: StatKey): string {
  if (key === "watchTime") return watchLabel(watchMinutes(counts));
  if (key === "episodes") return compactNumber(counts.episodesWatched ?? 0);
  if (key === "movies") return compactNumber(counts.moviesWatched ?? 0);
  if (key === "read") return compactNumber(counts.mangaRead ?? 0);
  if (key === "friends") return compactNumber(counts.friends);
  return compactNumber(counts.badges);
}

function StatTile({
  label,
  value,
  visible,
  locked,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      aria-pressed={visible}
      className={`relative flex flex-col items-center rounded-[14px] px-3 py-3.5 ring-1 transition-colors disabled:cursor-default ${
        visible ? "bg-elevated ring-edge" : "ring-edge-soft hover:bg-elevated"
      }`}
    >
      {visible && (
        <span className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-canvas">
          <Check size={12} strokeWidth={3.2} />
        </span>
      )}
      <span className={`flex flex-col items-center gap-1 ${visible ? "" : "opacity-45"}`}>
        <span className="whitespace-nowrap text-[16px] font-semibold tabular-nums text-ink">{value}</span>
        <span className="line-clamp-2 text-center text-[11px] uppercase leading-tight tracking-[0.1em] text-ink-subtle">
          {label}
        </span>
      </span>
    </button>
  );
}

export function HeroStatsPicker({
  summary,
  onClose,
  onSaved,
}: {
  summary: ProfileSummary;
  onClose: () => void;
  onSaved: (next: ProfileSummary) => void;
}) {
  const t = useT();
  const [hidden, setHidden] = useState<StatKey[]>(() => {
    const saved = sanitizeStatLayout((summary as { statLayout?: unknown }).statLayout).hidden ?? [];
    return STAT_ORDER.filter((k) => saved.includes(k));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = STAT_ORDER.filter((k) => !hidden.includes(k));

  const toggle = (key: StatKey) => {
    setHidden((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (STAT_ORDER.length - cur.length <= 1) return cur;
      return [...cur, key];
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const statLayout = { hidden };
      const next = await socialPatch<ProfileSummary>("/social/me/profile", { statLayout });
      onSaved(Object.assign({}, next, { statLayout }));
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
          <h2 className="font-display text-[20px] text-ink">{t("Hero stats")}</h2>
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
            {t("Pick the stats that show in the row at the top of your public profile. At least one has to stay visible.")}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {STAT_ORDER.map((k) => {
              const visible = !hidden.includes(k);
              return (
                <StatTile
                  key={k}
                  label={t(STAT_LABELS[k])}
                  value={statValue(summary.counts, k)}
                  visible={visible}
                  locked={visible && shown.length === 1}
                  onToggle={() => toggle(k)}
                />
              );
            })}
          </div>
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("{count} of {total} showing", { count: shown.length, total: STAT_ORDER.length })}
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
