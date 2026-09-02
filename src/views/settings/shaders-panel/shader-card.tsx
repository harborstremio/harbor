import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { downloadShader } from "@/lib/shaders";
import type { ShaderCatalogEntry } from "@/lib/player/shader-catalog";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ExtLink, Segmented, ToggleRow } from "../shared";
import { SettingRow } from "../kit";
import { BeforeAfter } from "./before-after";

const CONTENT_LABEL: Record<ShaderCatalogEntry["content"], string> = {
  all: "All video",
  anime: "Anime",
  hdr: "HDR only",
  live: "Live action",
};

const TIER_LABEL: Record<ShaderCatalogEntry["tier"], string> = {
  fast: "Light",
  quality: "Quality",
  heavy: "Heavy",
};

export function ShaderCard({ entry }: { entry: ShaderCatalogEntry }) {
  const t = useT();
  const { settings, update } = useSettings();
  const state = settings.playerShaders?.[entry.id];
  const installed = !!state?.dir;
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockReason = entry.conflictsWith?.some((c) =>
    c === "hdrToSdr" ? settings.playerHdrToSdr : c === "rtxHdr" ? settings.playerRtxHdr : false,
  )
    ? t(
        "Harbor's built-in HDR to SDR conversion is on. Turn it off in Video tuning to use this instead. Running both double-processes the picture.",
      )
    : undefined;

  const patch = (next: { enabled?: boolean; variant?: string; dir?: string }) => {
    const prev = settings.playerShaders?.[entry.id] ?? { enabled: false };
    update({ playerShaders: { ...settings.playerShaders, [entry.id]: { ...prev, ...next } } });
  };

  const install = async (force = false) => {
    setBusy(true);
    setError(null);
    setJustUpdated(false);
    try {
      const dir = await downloadShader(entry.id, force);
      patch({ dir, enabled: force ? state?.enabled : true });
      if (force) {
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2200);
      }
    } catch (e) {
      setError(
        typeof e === "string" ? e : t("Download failed. Check your connection and try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const variantId = state?.variant ?? entry.variants?.[0]?.id;

  return (
    <div className="flex flex-col gap-1.5">
      {entry.demo && <BeforeAfter demo={entry.demo} />}

      <div className="flex flex-col gap-1 rounded-md bg-elevated px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">{entry.name}</span>
          <span className="rounded-full bg-raised px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
            {t(CONTENT_LABEL[entry.content])}
          </span>
          <span className="rounded-full bg-raised px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
            {t(TIER_LABEL[entry.tier])}
          </span>
          {entry.verify && (
            <span className="rounded-full bg-accent-soft px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wider text-accent">
              {t("Verify")}
            </span>
          )}
        </div>
        <span className="text-[12.5px] leading-snug text-ink-subtle">{entry.description}</span>
        <span className="text-[11.5px] text-ink-muted">
          <ExtLink href={entry.source.url}>{entry.source.label}</ExtLink>
        </span>
      </div>

      {error && (
        <span className="rounded-md bg-elevated px-4 py-3.5 text-[12.5px] text-danger">
          {error}
        </span>
      )}

      {!installed ? (
        <button
          type="button"
          onClick={() => install(false)}
          disabled={busy}
          className="harbor-press-pop flex h-11 w-fit items-center gap-2 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin motion-reduce:hidden" />
          ) : (
            <Download size={16} strokeWidth={2.2} />
          )}
          {busy ? t("Downloading…") : t("Download shader")}
        </button>
      ) : (
        <>
          <ToggleRow
            label={t("Enable")}
            sub={
              entry.content === "hdr"
                ? t("Applies only to HDR sources when you play them.")
                : entry.content === "anime"
                  ? t("Applies to anime when you play it.")
                  : t(
                      "Applies when you play something. Only visibly changes the picture when the video is being scaled.",
                    )
            }
            value={!!state?.enabled}
            onChange={(v) => patch({ enabled: v })}
            lockReason={lockReason}
          />

          {entry.variants && entry.variants.length > 1 && (
            <SettingRow
              label={t("Variant")}
              desc={entry.variants.find((v) => v.id === variantId)?.sub}
            >
              <Segmented
                value={variantId ?? entry.variants[0].id}
                options={entry.variants.map((v) => ({ value: v.id, label: v.label }))}
                onChange={(v) => patch({ variant: v })}
              />
            </SettingRow>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-4 py-3">
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
              <Check size={14} className="text-success" strokeWidth={2.6} />
              {t("Installed")}
            </span>
            <button
              type="button"
              onClick={() => install(true)}
              disabled={busy}
              className={`flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-70 ${
                justUpdated ? "text-success" : "text-ink-subtle hover:text-ink"
              }`}
            >
              {busy ? (
                <>
                  <Loader2
                    size={12}
                    className="animate-spin motion-reduce:hidden"
                    strokeWidth={2.6}
                  />
                  {t("Updating…")}
                </>
              ) : justUpdated ? (
                <>
                  <Check size={12} strokeWidth={3} />
                  {t("Updated")}
                </>
              ) : (
                <>
                  <RefreshCw size={12} strokeWidth={2.4} />
                  {t("Re-download")}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
