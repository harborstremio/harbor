import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Diagnostics } from "@/lib/bug-report";
import { ModalButton, SettingRow, SettingsModal } from "../kit";
import { useT } from "@/lib/i18n";

export function DiagnosticsCard({ diag }: { diag: Diagnostics | null }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!diag) {
    return (
      <SettingRow
        icon={<ShieldCheck size={14} strokeWidth={1.9} />}
        label={t("What gets sent")}
        desc={t("Loading environment details…")}
      />
    );
  }
  const compact = `Harbor ${diag.appVersion} · ${diag.os}${diag.osVersion ? ` ${diag.osVersion}` : ""} · ${diag.viewport} · ${diag.locale}`;
  const mpv = diag.mpvProbe;
  const mpvLine = !mpv
    ? t("not probed")
    : mpv.available
      ? mpv.version || t("available")
      : t("unavailable: {error}", { error: mpv.error || t("unknown") });
  return (
    <>
      <SettingRow
        icon={<ShieldCheck size={14} strokeWidth={1.9} />}
        label={t("What gets sent")}
        desc={compact}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-raised px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {t("Review")}
        </button>
      </SettingRow>
      <SettingsModal
        open={open}
        onClose={() => setOpen(false)}
        title={t("What gets sent")}
        sub={t(
          "Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go faster.",
        )}
        actions={
          <ModalButton ghost onClick={() => setOpen(false)}>
            {t("Close")}
          </ModalButton>
        }
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-elevated px-4 py-3.5 font-mono text-[11.5px] text-ink-muted">
          <Pair k={t("App")} v={diag.appVersion} />
          <Pair k={t("OS")} v={`${diag.os} ${diag.osVersion}`} />
          <Pair k={t("Viewport")} v={diag.viewport} />
          <Pair k={t("Locale")} v={diag.locale} />
          <Pair k={t("Player")} v={diag.flags.playerEngine} />
          <Pair k="libmpv" v={mpvLine} />
          <Pair k={t("Region")} v={diag.flags.region} />
          <Pair k={t("TMDB key")} v={diag.flags.hasTmdb ? t("yes") : t("no")} />
          <Pair k={t("RPDB key")} v={diag.flags.hasRpdb ? t("yes") : t("no")} />
          <Pair k="Trakt" v={diag.flags.hasTrakt ? t("yes") : t("no")} />
          <Pair k="Stremio" v={diag.flags.hasStremio ? t("signed in") : t("guest")} />
          <Pair k={t("Debrid keys")} v={String(diag.flags.debridCount)} />
          <Pair k={t("Addons")} v={String(diag.flags.addonCount)} />
          <Pair k={t("IPTV lists")} v={String(diag.flags.iptvCount)} />
          <Pair k={t("Recent errors")} v={String(diag.recentErrors.length)} />
        </div>
      </SettingsModal>
    </>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  const t = useT();
  return (
    <>
      <span className="text-ink-subtle">{k}</span>
      <span className="truncate text-ink">{v || t("n/a")}</span>
    </>
  );
}
