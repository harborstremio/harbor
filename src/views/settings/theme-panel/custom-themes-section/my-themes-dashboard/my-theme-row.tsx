import { useEffect, useState } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  History,
  Loader2,
  PencilLine,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { authToken } from "@/lib/theme-auth";
import { deleteUpload, setVisibility, themeVersions, type StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";

type Version = { v: number; changelog: string; createdAt: string };

const STATUS: Record<StoreTheme["status"], { label: string; className: string }> = {
  pending: { label: "In review", className: "bg-accent-soft text-accent" },
  approved: { label: "Approved", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-danger/15 text-danger" },
};

export function MyThemeRow({
  theme,
  onUpdate,
  onChanged,
}: {
  theme: StoreTheme;
  onUpdate: (t: StoreTheme) => void;
  onChanged: () => void;
}) {
  const tr = useT();
  const [t, setT] = useState(theme);
  const [busy, setBusy] = useState<null | "vis" | "del">(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [versionsBusy, setVersionsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setT(theme), [theme]);

  const versionsCount = t.versionsCount ?? 0;
  const badge = STATUS[t.status];

  const toggleVisibility = async () => {
    const next = t.visibility === "public" ? "unlisted" : "public";
    setBusy("vis");
    setError(null);
    try {
      await setVisibility(t.id, authToken() ?? "", next);
      setT({ ...t, visibility: next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    setBusy("del");
    setError(null);
    try {
      await deleteUpload(t.id, authToken() ?? "");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
      setConfirmDel(false);
    }
  };

  const openVersions = async () => {
    const next = !versionsOpen;
    setVersionsOpen(next);
    if (next && versions === null) {
      setVersionsBusy(true);
      try {
        setVersions(await themeVersions(t.id));
      } catch {
        setVersions([]);
      } finally {
        setVersionsBusy(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-elevated p-4">
      <div className="flex gap-4">
        <div className="relative h-[68px] w-28 shrink-0 overflow-hidden rounded-md bg-canvas">
          {t.cover ? (
            <img src={t.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full">
              {t.swatch.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{t.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${badge.className}`}
            >
              {tr(badge.label)}
            </span>
            {t.hasPendingUpdate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent">
                <RefreshCw size={12} strokeWidth={2.4} /> {tr("Update in review")}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[12.5px] text-ink-subtle">
            {t.downloads === 1 ? tr("1 download") : tr("{count} downloads", { count: t.downloads })}
            <span className="text-ink-subtle/60">·</span>
            <Star size={12} className="fill-accent text-accent" />
            {t.ratingAvg || "-"}
            <span className="text-ink-subtle/60">({t.ratingCount})</span>
          </span>
          {t.blurb && <span className="line-clamp-1 text-[12.5px] text-ink-muted">{t.blurb}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onUpdate(t)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          <PencilLine size={14} /> {tr("Update")}
        </button>
        <button
          onClick={toggleVisibility}
          disabled={busy === "vis"}
          className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink hover:ring-edge disabled:opacity-50"
        >
          {busy === "vis" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : t.visibility === "public" ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}
          {t.visibility === "public" ? tr("Public") : tr("Unlisted")}
        </button>
        <button
          onClick={openVersions}
          className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink hover:ring-edge"
        >
          <History size={14} />{" "}
          {versionsCount > 0 ? tr("Versions ({count})", { count: versionsCount }) : tr("Versions")}
          <ChevronDown
            size={14}
            className={`transition-transform ${versionsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className="ms-auto flex items-center gap-1.5">
          {confirmDel ? (
            <>
              <button
                onClick={del}
                disabled={busy === "del"}
                className="flex h-9 items-center gap-1.5 rounded-md bg-danger px-3 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy === "del" && <Loader2 size={14} className="animate-spin" />} {tr("Delete")}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="h-9 rounded-md px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {tr("Cancel")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              aria-label={tr("Delete theme")}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas text-ink-muted transition-colors hover:text-danger hover:ring-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      {versionsOpen && (
        <div className="flex flex-col gap-2.5 border-t border-edge-soft pt-3">
          {versionsBusy ? (
            <span className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
              <Loader2 size={14} className="animate-spin" /> {tr("Loading history")}
            </span>
          ) : versions && versions.length > 0 ? (
            versions
              .slice()
              .sort((a, b) => b.v - a.v)
              .map((v) => (
                <div key={v.v} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 shrink-0 items-center rounded-md bg-elevated px-2 text-[11.5px] font-bold text-ink-muted">
                    v{v.v}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[12.5px] text-ink">{v.changelog || tr("No notes")}</span>
                    <span className="text-[11.5px] text-ink-subtle">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
          ) : (
            <span className="text-[12.5px] text-ink-subtle">
              {tr("No previous versions yet. Your next update starts the history.")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
