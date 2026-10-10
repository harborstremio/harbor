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
} from "../../../icons";
import { authToken } from "@/lib/theme-auth";
import { deleteUpload, setVisibility, themeVersions, type StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_DANGER, ROW_DESC, ROW_TITLE } from "../../../kit";
import { RowNote } from "../../../shared";
import { SButton, SRow } from "../../../ui";

type Version = { v: number; changelog: string; createdAt: string };

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

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
    <div className="flex flex-col gap-4 rounded-md bg-surface p-4 ring-1 ring-edge-soft">
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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`min-w-0 truncate ${ROW_TITLE}`}>{t.name}</span>
            <span className={`${QUAL} ${badge.className}`}>{tr(badge.label)}</span>
            {t.hasPendingUpdate && (
              <span className={`${QUAL} bg-accent-soft text-accent`}>
                <RefreshCw size={13} strokeWidth={2.4} /> {tr("Update in review")}
              </span>
            )}
          </div>
          <span className={`flex flex-wrap items-center gap-1.5 ${ROW_DESC}`}>
            {t.downloads === 1 ? tr("1 download") : tr("{count} downloads", { count: t.downloads })}
            <span className="text-ink-subtle">·</span>
            <Star size={15} className="fill-accent text-accent" />
            {t.ratingAvg || "-"}
            <span className="text-ink-subtle">({t.ratingCount})</span>
          </span>
          {t.blurb && (
            <span className={`line-clamp-1 max-w-[66ch] ${ROW_DESC}`}>{t.blurb}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SButton variant="primary" onClick={() => onUpdate(t)}>
          <PencilLine size={17} /> {tr("Update")}
        </SButton>
        <SButton onClick={toggleVisibility} disabled={busy === "vis"}>
          {busy === "vis" ? (
            <Loader2 size={17} className="animate-spin" />
          ) : t.visibility === "public" ? (
            <Eye size={17} />
          ) : (
            <EyeOff size={17} />
          )}
          {t.visibility === "public" ? tr("Public") : tr("Unlisted")}
        </SButton>
        <SButton onClick={openVersions}>
          <History size={17} />
          {versionsCount > 0 ? tr("Versions ({count})", { count: versionsCount }) : tr("Versions")}
          <ChevronDown
            size={17}
            className={`transition-transform ${versionsOpen ? "rotate-180" : ""}`}
          />
        </SButton>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {confirmDel ? (
            <>
              <SButton variant="danger" onClick={del} disabled={busy === "del"}>
                {busy === "del" && <Loader2 size={17} className="animate-spin" />}
                <Trash2 size={17} /> {tr("Delete")}
              </SButton>
              <SButton onClick={() => setConfirmDel(false)}>{tr("Cancel")}</SButton>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              aria-label={tr("Delete theme")}
              className={ROW_ACTION_DANGER}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>

      {error && <RowNote>{error}</RowNote>}

      {versionsOpen && (
        <div className="border-t border-edge-soft pt-2">
          {versionsBusy ? (
            <span className={`flex items-center gap-2 pt-2 ${ROW_DESC}`}>
              <Loader2 size={17} className="animate-spin" /> {tr("Loading history")}
            </span>
          ) : versions && versions.length > 0 ? (
            <div className="harbor-settings-group">
              {versions
                .slice()
                .sort((a, b) => b.v - a.v)
                .map((v) => (
                  <SRow
                    key={v.v}
                    title={
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                        <span className={`${QUAL} bg-elevated text-ink-subtle`}>v{v.v}</span>
                        <span className="min-w-0">{v.changelog || tr("No notes")}</span>
                      </span>
                    }
                    description={new Date(v.createdAt).toLocaleDateString()}
                  />
                ))}
            </div>
          ) : (
            <span className={`block max-w-[66ch] pt-2 ${ROW_DESC}`}>
              {tr("No previous versions yet. Your next update starts the history.")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
