import { Check, Download, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { installAddon, isInstalled } from "@/lib/addon-store";
import { useT } from "@/lib/i18n";
import { JL_TORRENTIO_ADDON_ID, JL_TORRENTIO_MANIFEST_URL } from "@/lib/jl/onboarding";
import { useSettings } from "@/lib/settings";

export function TorrentioStep() {
  const { settings } = useSettings();
  const t = useT();
  const [installed, setInstalled] = useState(() => isInstalled(JL_TORRENTIO_ADDON_ID));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDebrid = !!(settings.rdKey.trim() || settings.tbKey.trim());

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      await installAddon(JL_TORRENTIO_ADDON_ID, JL_TORRENTIO_MANIFEST_URL);
      setInstalled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Install failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Movies & Shows · Sources")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Add Torrentio")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Torrentio is a third-party addon that lists sources for movies and shows. Nothing is installed until you choose to.",
          )}
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
        <span className="text-[13px] leading-relaxed text-ink-muted">
          {t(
            "JL Media Vision installs Torrentio's standard address, without your debrid key in it. You can remove it anytime from Addons.",
          )}
        </span>
      </div>
      {!hasDebrid && (
        <p className="text-[13px] text-amber-300">
          {t("Connect Real-Debrid or TorBox in the previous step for instant playback.")}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={() => void install()}
          disabled={installed || busy}
          className={`flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-opacity ${
            installed ? "bg-accent-soft text-accent" : "bg-ink text-canvas hover:opacity-90 disabled:opacity-50"
          }`}
        >
          {installed ? (
            <>
              <Check size={15} strokeWidth={2.6} />
              {t("Installed")}
            </>
          ) : busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("Installing")}
            </>
          ) : (
            <>
              <Download size={15} strokeWidth={2.2} />
              {t("Install Torrentio")}
            </>
          )}
        </button>
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
      </div>
      <p className="text-[12px] text-ink-subtle">
        {t("Only stream content you have the right to watch.")}
      </p>
    </div>
  );
}
