import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Diagnostics } from "@/lib/bug-report";
import { getDirection } from "@/lib/keyboard-navigation/geometry";
import { ModalButton, SettingRow, SettingsModal } from "../kit";
import { SButton } from "../ui";
import { useT } from "@/lib/i18n";

export function DiagnosticsCard({ diag }: { diag: Diagnostics | null }) {
  const [open, setOpen] = useState(false);
  const [scrolls, setScrolls] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const onListKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = bodyRef.current;
    const dir = getDirection(e.nativeEvent);
    if (!el || (dir !== "up" && dir !== "down")) return;
    const atStart = el.scrollTop <= 1;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (dir === "up" ? atStart : atEnd) return;
    e.preventDefault();
    el.scrollBy({ top: (dir === "down" ? 0.8 : -0.8) * el.clientHeight, behavior: "smooth" });
  };

  if (!diag) {
    return (
      <SettingRow
        icon={<ShieldCheck size={18} strokeWidth={1.9} />}
        label={t("What gets sent")}
        desc={t("Reading your environment details…")}
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
        icon={<ShieldCheck size={18} strokeWidth={1.9} />}
        label={t("What gets sent")}
        desc={compact}
      >
        <SButton onClick={() => setOpen(true)}>{t("Review")}</SButton>
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
        <div
          ref={bodyRef}
          tabIndex={scrolls ? 0 : undefined}
          onKeyDown={scrolls ? onListKey : undefined}
          className="max-h-[46vh] overflow-y-auto"
        >
          <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-5 gap-y-2 text-[15.5px] leading-[22px]">
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
          </dl>
        </div>
      </SettingsModal>
    </>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  const t = useT();
  return (
    <>
      <dt className="min-w-0 text-ink-subtle">{k}</dt>
      <dd className="m-0 min-w-0 break-words text-ink">{v || t("n/a")}</dd>
    </>
  );
}
