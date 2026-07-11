import {
  HOTKEYS,
  HOTKEY_MAP,
  effectiveBinding,
  eventToBinding,
  formatBindingForDisplay,
  isModifierOnly,
  type HotkeyDef,
  type HotkeyId,
  type HotkeyScope,
} from "@/lib/hotkeys";
import { useT } from "@/lib/i18n";
import { SEEK_STEP_OPTIONS } from "@/lib/seek-step";
import { useSettings } from "@/lib/settings";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Section, ToggleRow } from "./shared";

export function HotkeysPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const overrides = settings.hotkeys ?? {};
  const [capturing, setCapturing] = useState<HotkeyId | null>(null);
  const [conflict, setConflict] = useState<HotkeyId | null>(null);

  const grouped = useMemo(() => {
    const scopes: Record<HotkeyScope, HotkeyDef[]> = { Global: [], Player: [] };
    for (const def of HOTKEYS) scopes[def.scope].push(def);
    return scopes;
  }, []);

  const setBinding = (id: HotkeyId, binding: string | null) => {
    const next = { ...overrides };
    if (binding === null || binding === HOTKEY_MAP[id].defaultBinding) delete next[id];
    else next[id] = binding;
    update({ hotkeys: next });
  };

  const resetAll = () => update({ hotkeys: {} });

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Physical Escape — same key under every OS layout
      if (e.code === "Escape" || e.key === "Escape") {
        setCapturing(null);
        setConflict(null);
        return;
      }
      if (isModifierOnly(e)) return;
      // Capture via eventToBinding → US-QWERTY physical key (works in Arabic, etc.)
      const binding = eventToBinding(e);
      const dupe = HOTKEYS.find(
        (h) =>
          h.id !== capturing &&
          h.scope === HOTKEY_MAP[capturing].scope &&
          effectiveBinding(h.id, overrides) === binding,
      );
      setBinding(capturing, binding);
      setConflict(dupe ? dupe.id : null);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, overrides]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-subtle">
          {t(
            "Click any binding to rebind it. Press Esc while capturing to cancel. Letters ignore Shift (so K and Shift+K trigger the same action).",
          )}
        </p>
        {overrideCount > 0 && (
          <button
            onClick={resetAll}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/80 px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <RotateCcw size={13} strokeWidth={2.2} />
            {t("Reset all ({n})", { n: overrideCount })}
          </button>
        )}
      </div>

      <Section title={t("Behavior")} subtitle={t("How keys behave during playback.")}>
        <ToggleRow
          label={t("Esc exits fullscreen first")}
          sub={t(
            "When in fullscreen, Esc leaves fullscreen instead of closing the player. Press Esc again to close. Turn off to make Esc always close.",
          )}
          value={settings.playerEscExitsFullscreen}
          onChange={(v) => update({ playerEscExitsFullscreen: v })}
        />
        <ToggleRow
          label={t("Ask before leaving")}
          sub={t(
            'When Esc would close the player, show a quick confirm first. You can tick "Don\'t ask me again" in that prompt to always leave on Esc.',
          )}
          value={settings.playerConfirmLeave}
          onChange={(v) => update({ playerConfirmLeave: v })}
        />
        <SeekStepRow
          back={settings.seekBackStepSec}
          forward={settings.seekForwardStepSec}
          onBack={(seekBackStepSec) => update({ seekBackStepSec })}
          onForward={(seekForwardStepSec) => update({ seekForwardStepSec })}
        />
      </Section>

      {(Object.keys(grouped) as HotkeyScope[]).map((scope) => {
        const defs = grouped[scope];
        if (defs.length === 0) return null;
        const subgroups = new Map<string, HotkeyDef[]>();
        for (const d of defs) {
          const g = d.group ?? "Other";
          const arr = subgroups.get(g) ?? [];
          arr.push(d);
          subgroups.set(g, arr);
        }
        return (
          <Section
            key={scope}
            title={t(scope)}
            subtitle={scope === "Player" ? t("Inside the playback view.") : t("Anywhere in Harbor.")}
          >
            <div className="flex flex-col gap-6">
              {Array.from(subgroups.entries()).map(([groupName, items]) => (
                <div key={groupName} className="flex flex-col gap-1.5">
                  <h4 className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    {t(groupName)}
                  </h4>
                  {items.map((def) => {
                    const binding = effectiveBinding(def.id, overrides);
                    const isCustom = def.id in overrides;
                    const isCapturing = capturing === def.id;
                    const flaggedConflict = conflict === def.id;
                    return (
                      <HotkeyRow
                        key={def.id}
                        def={def}
                        binding={binding}
                        isCustom={isCustom}
                        isCapturing={isCapturing}
                        conflict={flaggedConflict}
                        onStartCapture={() => {
                          setConflict(null);
                          setCapturing(def.id);
                        }}
                        onReset={() => setBinding(def.id, null)}
                      />
                    );
                  })}
                  {scope === "Global" && groupName === "Interface" && (
                    <ReadOnlyHotkeyRow
                      label={t("Adjust interface scale with wheel")}
                      description={t("Hold Ctrl or Cmd and scroll to resize Harbor's interface smoothly.")}
                      binding="Ctrl / ⌘ + Scroll"
                    />
                  )}
                </div>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}

function SeekStepRow({
  back,
  forward,
  onBack,
  onForward,
}: {
  back: number;
  forward: number;
  onBack: (seconds: number) => void;
  onForward: (seconds: number) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 xl:grid-cols-[minmax(220px,1fr)_minmax(0,640px)] xl:items-center">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{t("Seek step")}</span>
        <span className="text-[12.5px] text-ink-subtle">
          {t("Choose how far the keyboard arrows and player seek buttons jump.")}
        </span>
      </div>
      <div className="grid min-w-0 gap-2">
        <SeekStepPicker label={t("Back")} value={back} onChange={onBack} />
        <SeekStepPicker label={t("Forward")} value={forward} onChange={onForward} />
      </div>
    </div>
  );
}

function SeekStepPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-edge-soft bg-elevated/55 p-1.5">
      <span className="ps-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
      <div className="grid min-w-0 grid-cols-6 gap-1 rounded-md bg-canvas/45 p-0.5">
        {SEEK_STEP_OPTIONS.map((seconds) => {
          const selected = seconds === value;
          return (
            <button
              key={seconds}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(seconds)}
              className={`h-7 min-w-0 rounded-[6px] px-1 font-mono text-[11.5px] font-bold tabular-nums transition-colors ${
                selected ? "bg-ink text-canvas shadow-sm" : "text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {seconds}s
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyHotkeyRow({ label, description, binding }: { label: string; description: string; binding: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{label}</span>
        <span className="text-[12.5px] text-ink-subtle">{description}</span>
      </div>
      <div className="flex h-8 min-w-[128px] items-center justify-center rounded-lg border border-edge bg-elevated px-3 text-[12.5px] font-semibold text-ink">
        {binding}
      </div>
      <span className="sr-only">{t("Fixed shortcut")}</span>
    </div>
  );
}

function HotkeyRow({
  def,
  binding,
  isCustom,
  isCapturing,
  conflict,
  onStartCapture,
  onReset,
}: {
  def: HotkeyDef;
  binding: string;
  isCustom: boolean;
  isCapturing: boolean;
  conflict: boolean;
  onStartCapture: () => void;
  onReset: () => void;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCapturing) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [isCapturing]);
  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-4 rounded-xl border bg-canvas/40 px-4 py-3 transition-colors ${
        isCapturing ? "border-accent bg-accent/8" : "border-edge-soft"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-ink">{t(def.label)}</span>
          {isCustom && !isCapturing && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-accent">
              {t("Custom")}
            </span>
          )}
          {conflict && (
            <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-danger">
              {t("Conflict")}
            </span>
          )}
        </div>
        <span className="text-[12.5px] text-ink-subtle">{t(def.description)}</span>
      </div>
      {isCapturing ? (
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-accent/60 bg-accent/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
            <Keyboard size={12} strokeWidth={2.4} className="me-1.5 inline-block" />
            {t("Press a key…")}
          </span>
          <button onClick={onStartCapture} className="hidden" aria-hidden />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {isCustom && (
            <button
              onClick={onReset}
              title={t("Reset to default")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={onStartCapture}
            className="flex h-8 min-w-[88px] items-center justify-center rounded-lg border border-edge bg-elevated px-3 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink hover:bg-raised"
          >
            {formatBindingForDisplay(binding)}
          </button>
        </div>
      )}
    </div>
  );
}
