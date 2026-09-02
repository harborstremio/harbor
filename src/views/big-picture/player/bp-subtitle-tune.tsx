import { useMemo } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { loadSubPresets } from "@/lib/player/sub-presets";
import { useSettings } from "@/lib/settings";
import { useBpT } from "../bp-i18n";
import { Chip, LABEL, NOTE, Row, SPIN, Stepper, offsetLabel } from "./bp-subtitle-parts";

const DELAY_STEPS = [-1, -0.1, 0.1, 1];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function BpSubtitleSync({
  canSync,
  delaySec,
  onDelay,
}: {
  canSync: boolean;
  delaySec: number;
  onDelay: (sec: number) => void;
}) {
  const t = useBpT();
  const autoSync = useAutoSyncHandle();
  const busy = autoSync?.status === "analyzing";
  const offset = offsetLabel(delaySec, t);

  return (
    <>
      <Row>
        <span className={LABEL}>{t("Auto sync")}</span>
        <Chip
          label={busy ? t("Cancel sync") : t("Auto sync")}
          on={busy}
          seed
          icon={busy ? <Loader2 size={19} className={SPIN} /> : <Wand2 size={19} strokeWidth={2.2} />}
          onPress={() => {
            if (!canSync || !autoSync) return;
            if (busy) autoSync.stop();
            else autoSync.run();
          }}
        />
        {autoSync && autoSync.offer !== null && (
          <Chip label={t("Use it")} onPress={() => autoSync.applyOffer()} />
        )}
        {autoSync && autoSync.status === "synced" && (
          <Chip label={t("Revert")} onPress={() => autoSync.revert()} />
        )}
      </Row>
      {!canSync && <p className={NOTE}>{t("Needs an external subtitle")}</p>}
      <Row>
        <span className={LABEL}>{t("Manual offset")}</span>
        {DELAY_STEPS.map((step) => (
          <Chip
            key={step}
            label={t("{sign}{n}s", { sign: step > 0 ? "+" : "", n: step.toFixed(1) })}
            onPress={() => onDelay(Number((delaySec + step).toFixed(1)))}
          />
        ))}
        <span className="shrink-0 px-[clamp(10px,1vw,20px)] font-display text-[clamp(24px,4vh,52px)] font-semibold tabular-nums text-ink">
          {offset}
        </span>
        <Chip label={t("Reset")} onPress={() => onDelay(0)} />
      </Row>
      <p className={NOTE}>{t("Subtitles late? Nudge plus. Early? Nudge minus.")}</p>
    </>
  );
}

export function BpSubtitleLook() {
  const t = useBpT();
  const { settings, update } = useSettings();
  const presets = useMemo(() => loadSubPresets(), []);

  return (
    <>
      <Row>
        <span className={LABEL}>{t("Presets")}</span>
        {presets.map((p, i) => (
          <Chip key={p.id} label={p.name} seed={i === 0} onPress={() => update(p.values)} />
        ))}
      </Row>
      <Row>
        <Stepper
          label={t("Size")}
          value={String(settings.subFontSize)}
          t={t}
          onReset={() => update({ subFontSize: 32 })}
          onStep={(d) => update({ subFontSize: clamp(settings.subFontSize + d * 4, 16, 120) })}
        />
        <Stepper
          label={t("Height")}
          value={String(settings.subMarginY)}
          t={t}
          onReset={() => update({ subMarginY: 10 })}
          onStep={(d) => update({ subMarginY: clamp(settings.subMarginY + d * 2, 0, 100) })}
        />
        <Stepper
          label={t("Opacity")}
          value={`${Math.round(settings.subOpacity * 100)}%`}
          t={t}
          onReset={() => update({ subOpacity: 1 })}
          onStep={(d) => update({ subOpacity: clamp(settings.subOpacity + d * 0.1, 0.1, 1) })}
        />
      </Row>
      <Row>
        <span className={LABEL}>{t("Backing")}</span>
        <Chip
          label={t("Shadow")}
          on={settings.subStyle === "shadow"}
          onPress={() => update({ subStyle: "shadow" })}
        />
        <Chip
          label={t("Outline")}
          on={settings.subStyle === "outline"}
          onPress={() => update({ subStyle: "outline" })}
        />
        <Chip
          label={t("Box")}
          on={settings.subStyle === "box"}
          onPress={() => update({ subStyle: "box" })}
        />
        <Chip
          label={t("Bold")}
          on={settings.subBold}
          onPress={() => update({ subBold: !settings.subBold })}
        />
      </Row>
      {/* The sample approximates mpv with CSS. The colours are user data written
          straight to the renderer, not UI styling, which is why they are the one
          place a raw value belongs. */}
      <div className="mt-auto flex items-end justify-center rounded-[var(--bp-r-md)] bg-[var(--bp-void)] p-[clamp(20px,3vh,48px)]">
        <span
          className="text-center leading-tight"
          style={{
            color: settings.subFontColor,
            opacity: settings.subOpacity,
            fontWeight: settings.subBold ? 800 : 600,
            fontSize: `clamp(16px, ${settings.subFontSize / 18}vh, ${settings.subFontSize * 1.6}px)`,
            textShadow: settings.subStyle === "shadow" ? "0 2px 6px rgba(0,0,0,0.9)" : undefined,
            WebkitTextStroke:
              settings.subStyle === "outline"
                ? `${settings.subBorderSize || 2}px ${settings.subBorderColor}`
                : undefined,
            backgroundColor: settings.subStyle === "box" ? settings.subBoxColor : undefined,
            padding: settings.subStyle === "box" ? "0.15em 0.4em" : undefined,
          }}
        >
          {t("This is how your subtitles will look.")}
        </span>
      </div>
    </>
  );
}
