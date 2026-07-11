import { openInstallerViewport } from "@/components/installer-viewport";
import {
  fetchManifestAt,
  findHostnameMatch,
  isInstalled,
  manifestToConfigureUrl,
  parseAddonUrl,
} from "@/lib/addon-store";
import type { Addon } from "@/lib/addons";
import { useT } from "@/lib/i18n";
import { isWeb } from "@/lib/platform";
import { Check, Loader2, Settings2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Mode =
  | { kind: "install"; url: string }
  | { kind: "manage"; existing: { id: string; name: string; logo?: string | null; transportUrl: string } };

type ResolveMatch = {
  manifest: Addon["manifest"];
  url: string;
  matchKind: "fresh" | "id-match" | "hostname-match";
  replaceId: string | null;
  replaceName: string | null;
};

type InstallStage = { label: string; done: boolean };

export function AddonInstallModal({
  mode,
  onClose,
  onInstall,
}: {
  mode: Mode;
  onClose: () => void;
  onInstall: (rawUrl: string, opts: { replaceId?: string }) => Promise<{ replaced: boolean; addon: Addon } | null>;
}) {
  const t = useT();
  const [pasted, setPasted] = useState(mode.kind === "install" ? mode.url : "");
  const [resolved, setResolved] = useState<ResolveMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installStage, setInstallStage] = useState<InstallStage[] | null>(null);
  const [done, setDone] = useState<{ replaced: boolean; manifest: Addon["manifest"] } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const tryResolve = async (rawUrl: string) => {
    setLoading(true);
    setError(null);
    setResolved(null);
    try {
      const parsed = parseAddonUrl(rawUrl);
      if (parsed.kind === "error") throw new Error(parsed.message);
      const manifest = await fetchManifestAt(parsed.url);
      let matchKind: ResolveMatch["matchKind"] = "fresh";
      let replaceId: string | null = null;
      let replaceName: string | null = null;
      if (mode.kind === "manage" && mode.existing.id) {
        if (mode.existing.id === manifest.id) {
          matchKind = "id-match";
        } else {
          matchKind = "hostname-match";
          replaceId = mode.existing.id;
          replaceName = mode.existing.name;
        }
      } else if (isInstalled(manifest.id)) {
        matchKind = "id-match";
      } else {
        const host = findHostnameMatch(parsed.url);
        if (host) {
          matchKind = "hostname-match";
          replaceId = host.id;
          replaceName = host.manifest?.name ?? host.id;
        }
      }
      setResolved({ manifest, url: parsed.url, matchKind, replaceId, replaceName });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Couldn't read that addon URL."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode.kind === "install" && mode.url && !resolved && !loading && !error) {
      void tryResolve(mode.url);
    }
  }, [mode]);

  const onSubmit = async () => {
    if (!resolved) {
      void tryResolve(pasted.trim());
      return;
    }
    const stages: InstallStage[] = [
      { label: resolved.matchKind === "fresh" ? t("Reading manifest") : t("Reading new manifest"), done: true },
      { label: resolved.matchKind === "fresh" ? t("Saving to library") : t("Swapping configuration"), done: false },
      { label: t("Syncing to Stremio"), done: false },
    ];
    setInstallStage(stages);
    await new Promise((r) => setTimeout(r, 220));
    setInstallStage((s) => (s ? s.map((x, i) => (i === 1 ? { ...x, done: true } : x)) : s));
    try {
      const result = await onInstall(resolved.url, {
        replaceId: resolved.replaceId ?? undefined,
      });
      setInstallStage((s) => (s ? s.map((x, i) => (i === 2 ? { ...x, done: true } : x)) : s));
      await new Promise((r) => setTimeout(r, 280));
      if (result) setDone({ replaced: result.replaced, manifest: resolved.manifest });
      else setInstallStage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Install failed."));
      setInstallStage(null);
    }
  };

  const isUpdate = resolved && resolved.matchKind !== "fresh";

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (!installStage && !done && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-[min(92vw,560px)] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated/97 shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-150 backdrop-blur-xl">
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {mode.kind === "manage" && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised ring-1 ring-edge-soft">
                {mode.existing.logo ? (
                  <img
                    src={mode.existing.logo}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    draggable={false}
                  />
                ) : (
                  <span className="text-[14px] font-display text-ink-subtle">
                    {mode.existing.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
                {mode.kind === "manage" ? t("Manage addon") : t("Install addon")}
              </span>
              <span className="truncate text-[15px] font-medium text-ink">
                {mode.kind === "manage" ? mode.existing.name : t("Add from URL")}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!installStage && !done}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-ink-muted transition-colors hover:bg-canvas/55 hover:text-ink disabled:opacity-40 disabled:hover:bg-raised disabled:hover:text-ink-muted"
            aria-label={t("Close")}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done ? (
            <SuccessPane manifest={done.manifest} replaced={done.replaced} onClose={onClose} />
          ) : installStage ? (
            <InstallingPane stages={installStage} manifest={resolved?.manifest ?? null} isUpdate={!!isUpdate} />
          ) : (
            <>
              {mode.kind === "manage" && (
                <ManageStep1
                  name={mode.existing.name}
                  hasResolved={!!resolved}
                  onOpenSetup={() => {
                    openInstallerViewport(
                      manifestToConfigureUrl(mode.existing.transportUrl),
                      mode.existing.name,
                      mode.existing.logo ?? null,
                    );
                    onClose();
                  }}
                />
              )}

              <PasteRow
                value={pasted}
                onChange={(v) => {
                  setPasted(v);
                  setResolved(null);
                  setError(null);
                }}
                loading={loading}
                onResolve={() => tryResolve(pasted.trim())}
                step={mode.kind === "manage" ? 2 : 1}
                managing={mode.kind === "manage"}
              />

              {error && (
                <p className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-[12.5px] text-danger ring-1 ring-danger/30">
                  {error}
                </p>
              )}

              {resolved && (
                <ManifestPreview
                  manifest={resolved.manifest}
                  matchKind={resolved.matchKind}
                  replaceName={resolved.replaceName}
                />
              )}
            </>
          )}
        </div>

        {!done && !installStage && (
          <footer className="flex items-center justify-end gap-2 border-t border-edge-soft px-6 py-4">
            <button
              onClick={onClose}
              className="flex h-10 items-center gap-1.5 rounded-full bg-raised px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-canvas/55 hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={onSubmit}
              disabled={(!resolved && !pasted.trim()) || loading}
              className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!resolved ? (loading ? t("Reading") : t("Continue")) : isUpdate ? t("Update") : t("Install")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function ManageStep1({
  name,
  hasResolved,
  onOpenSetup,
}: {
  name: string;
  hasResolved: boolean;
  onOpenSetup: () => void;
}) {
  const t = useT();
  return (
    <div
      className={`mb-5 flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4 transition-opacity ${
        hasResolved ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-canvas">
          1
        </span>
        <p className="text-[13.5px] font-semibold text-ink">{t("Configure on the addon's setup page")}</p>
      </div>
      <p className="ps-7 text-[12.5px] leading-relaxed text-ink-muted">
        {isWeb()
          ? t(
              "Click below to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.",
              { name },
            )
          : t(
              "Click below to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.",
              { name },
            )}
      </p>
      <button
        type="button"
        onClick={onOpenSetup}
        className="ms-7 flex h-9 w-fit items-center gap-1.5 rounded-full bg-raised px-3.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <Settings2 size={12} strokeWidth={2.2} />
        {t("Open setup page")}
      </button>
      <p className="mt-1 ps-7 text-[11.5px] leading-relaxed text-ink-subtle">
        {t(
          'Heads-up: a few addons (like AIOStatus) don\'t pre-fill from the URL. If the form loads blank, paste the existing manifest URL into their "Import from URL" field to restore your settings.',
        )}
      </p>
    </div>
  );
}

function PasteRow({
  value,
  onChange,
  loading,
  onResolve,
  step,
  managing,
}: {
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  onResolve: () => void;
  step: number;
  managing: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2.5">
      {managing && (
        <div className="flex items-baseline gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-canvas">
            {step}
          </span>
          <p className="text-[13.5px] font-semibold text-ink">{t("Or paste the install link manually")}</p>
        </div>
      )}
      <div className={managing ? "ps-7" : ""}>
        <div className="flex items-center gap-2 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5 ring-1 ring-transparent focus-within:border-ink-subtle focus-within:ring-edge">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim() && !loading) onResolve();
            }}
            placeholder="https://...manifest.json or stremio://..."
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle outline-none"
          />
          {value.trim().length > 0 && (
            <button
              type="button"
              onClick={onResolve}
              disabled={loading}
              className="flex h-7 items-center gap-1 rounded-full bg-raised px-2.5 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-50"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : null}
              {loading ? "" : t("Read")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ManifestPreview({
  manifest,
  matchKind,
  replaceName,
}: {
  manifest: Addon["manifest"];
  matchKind: ResolveMatch["matchKind"];
  replaceName: string | null;
}) {
  const t = useT();
  const types = manifest.types ?? [];
  const resources = (manifest.resources ?? []).map((r) => (typeof r === "string" ? r : r.name));
  return (
    <div className="mt-5 flex flex-col gap-4 rounded-xl border border-edge bg-canvas/30 p-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-raised ring-1 ring-edge-soft">
          {manifest.logo ? (
            <img src={manifest.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[22px] font-display text-ink-subtle">{manifest.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold text-ink">{manifest.name}</h3>
            {matchKind !== "fresh" && (
              <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 ring-1 ring-amber-300/30">
                {t("Update")}
              </span>
            )}
          </div>
          {manifest.version && (
            <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              v{manifest.version}
            </span>
          )}
          {manifest.description && <p className="text-[13px] leading-relaxed text-ink-muted">{manifest.description}</p>}
        </div>
      </div>
      {matchKind === "hostname-match" && replaceName && (
        <p className="rounded-lg bg-amber-300/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200 ring-1 ring-amber-300/20">
          {t(
            "Looks like a re-configure of {name}. We'll replace the existing entry so you don't end up with two copies.",
            { name: replaceName },
          )}
        </p>
      )}
      {(types.length > 0 || resources.length > 0) && (
        <div className="flex flex-wrap gap-1.5 border-t border-edge-soft pt-3">
          {types.map((type) => (
            <span
              key={`t-${type}`}
              className="rounded-full bg-raised px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
            >
              {type}
            </span>
          ))}
          {resources.map((r) => (
            <span
              key={`r-${r}`}
              className="rounded-full bg-elevated px-2.5 py-0.5 text-[10.5px] font-medium text-ink-subtle"
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InstallingPane({
  stages,
  manifest,
  isUpdate,
}: {
  stages: InstallStage[];
  manifest: Addon["manifest"] | null;
  isUpdate: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-ink/15" />
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-raised ring-1 ring-edge-soft">
          {manifest?.logo ? (
            <img src={manifest.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <Loader2 size={22} className="animate-spin text-ink-muted" />
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[15px] font-semibold text-ink">
          {isUpdate
            ? t("Updating {name}", { name: manifest?.name ?? t("addon") })
            : t("Installing {name}", { name: manifest?.name ?? t("addon") })}
        </p>
        <p className="text-[12.5px] text-ink-subtle">{t("Hang tight, won't be a sec.")}</p>
      </div>
      <ul className="flex w-full max-w-xs flex-col gap-2 pt-2">
        {stages.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[12.5px]">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-300 ${
                s.done
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-raised text-ink-subtle ring-1 ring-edge-soft"
              }`}
            >
              {s.done ? <Check size={11} strokeWidth={2.6} /> : <Loader2 size={10} className="animate-spin" />}
            </span>
            <span className={s.done ? "text-ink" : "text-ink-muted"}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuccessPane({
  manifest,
  replaced,
  onClose,
}: {
  manifest: Addon["manifest"] | null;
  replaced: boolean;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40">
          <Check size={28} strokeWidth={2.6} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[18px] font-semibold text-ink">{replaced ? t("Updated") : t("Installed")}</h3>
        {manifest && (
          <p className="text-[13px] text-ink-muted">
            <span className="font-semibold text-ink">{manifest.name}</span>{" "}
            {replaced
              ? t("is now using your new configuration.")
              : t("is ready. Open Discover or hit Play on a title to use it.")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Done")}
      </button>
    </div>
  );
}
