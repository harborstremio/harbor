import { ArrowUpCircle, Download, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  installPlugin,
  setPluginEnabled,
  uninstallPlugin,
  type InstalledPlugin,
  type PluginManifest,
} from "@/lib/manga/plugins";
import { languageName } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";

function PluginIcon({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-edge-soft">
      {src && !failed ? (
        <img src={src} alt="" className="h-6 w-6 object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[12px] font-bold text-ink-muted">{initials}</span>
      )}
    </span>
  );
}

function EnableSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="shrink-0"
    >
      <span
        aria-hidden
        className={`relative block h-6 w-10 rounded-full transition-colors ${on ? "bg-ink" : "bg-edge"}`}
      >
        <span
          className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export function PluginRow({
  manifest,
  repoUrl,
  installed,
}: {
  manifest: PluginManifest;
  repoUrl: string;
  installed?: InstalledPlugin;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      await installPlugin(manifest, repoUrl);
    } catch {
      setError(t("Install failed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    await uninstallPlugin(manifest.id).catch(() => {});
    setBusy(false);
  };

  const outdated = !!installed && installed.version !== manifest.version;

  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <PluginIcon src={manifest.icon} name={manifest.name} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{manifest.name}</span>
          <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-ink-subtle ring-1 ring-edge-soft">
            v{manifest.version}
          </span>
          {manifest.nsfw && (
            <span className="shrink-0 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-danger">
              18+
            </span>
          )}
        </div>
        <span className="truncate text-[12.5px] text-ink-muted">
          {languageName(manifest.lang)}
          {outdated && (
            <span className="text-accent"> · {t("update to v{version}", { version: manifest.version })}</span>
          )}
          {error && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {installed ? (
        <div className="flex shrink-0 items-center gap-3">
          {outdated && (
            <button
              type="button"
              onClick={install}
              disabled={busy}
              aria-label={t("Update plugin")}
              className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent ring-1 ring-edge-soft transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={17} />}
            </button>
          )}
          <EnableSwitch
            on={installed.enabled}
            onToggle={() => void setPluginEnabled(installed.id, !installed.enabled)}
          />
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={t("Uninstall {name}", { name: manifest.name })}
            className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="flex h-9 min-w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Download size={15} strokeWidth={2.4} />
              {t("Install")}
            </>
          )}
        </button>
      )}
    </div>
  );
}
