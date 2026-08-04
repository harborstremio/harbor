import { ArrowUpCircle, Download, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  extensionIconUrl,
  installExtension,
  uninstallExtension,
  updateExtension,
  type ServerConfig,
  type SuwayomiExtension,
} from "@/lib/manga/sources/suwayomi/provider";
import { notifyMangaDataChanged } from "@/lib/manga/refresh";
import { languageName } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";
import { initials } from "./types";

function ExtIcon({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-edge-soft">
      {src && !failed ? (
        <img src={src} alt="" className="h-6 w-6 object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[12px] font-bold text-ink-muted">{initials(name)}</span>
      )}
    </span>
  );
}

export function ExtensionRow({
  config,
  ext,
  onChanged,
}: {
  config: ServerConfig;
  ext: SuwayomiExtension;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      notifyMangaDataChanged();
      onChanged();
    } catch {
      setError(t("Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const icon = ext.iconUrl ?? extensionIconUrl(config, ext.apkName);

  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <ExtIcon src={icon} name={ext.name} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{ext.name}</span>
          <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-ink-subtle ring-1 ring-edge-soft">
            v{ext.versionName}
          </span>
          {ext.isNsfw && (
            <span className="shrink-0 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-danger">
              18+
            </span>
          )}
        </div>
        <span className="truncate text-[12.5px] text-ink-muted">
          {languageName(ext.lang)}
          {ext.hasUpdate && <span className="text-accent"> · {t("update available")}</span>}
          {ext.obsolete && <span className="text-danger"> · {t("obsolete")}</span>}
          {error && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {ext.installed ? (
        <div className="flex shrink-0 items-center gap-3">
          {ext.hasUpdate && (
            <button
              type="button"
              onClick={() => void run(() => updateExtension(config, ext.pkgName))}
              disabled={busy}
              aria-label={t("Update {name}", { name: ext.name })}
              className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent ring-1 ring-edge-soft transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={17} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => void run(() => uninstallExtension(config, ext.pkgName))}
            disabled={busy}
            aria-label={t("Uninstall {name}", { name: ext.name })}
            className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void run(() => installExtension(config, ext.pkgName))}
          disabled={busy}
          className="flex h-9 min-w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100"
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
