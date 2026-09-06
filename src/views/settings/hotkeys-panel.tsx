import { useSubTabs } from "./sub-tabs";
import { Keyboard, RotateCcw } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { SEEK_STEP_OPTIONS } from "@/lib/seek-step";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import { Section, ToggleRow } from "./shared";
import { ROW_DESC, SettingRow } from "./kit";
import { SSection } from "./ui";
import { usePageActions } from "./page-actions";

type Tab = "keys" | "behaviour";

const BADGE =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const GROUP_LABEL =
  "text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle";

const QUIET_ACTION =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[15.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BINDING_CHIP =
  "flex h-11 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-edge-soft bg-elevated px-4 text-[15.5px] font-semibold text-ink-muted";

const BINDING_BUTTON =
  "harbor-press-pop flex h-11 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-edge-soft bg-elevated px-4 text-[15.5px] font-semibold text-ink transition-colors hover:border-edge hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BINDING_CAPTURING =
  "flex h-11 min-w-[152px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border border-accent bg-accent-soft px-4 text-[15.5px] font-semibold text-accent";

const DPAD_KEYCODES = new Set([19, 20, 21, 22, 23]);

export function HotkeysPanel() {
  const [tab, setTab] = useState<Tab>("keys");
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
      if (isBackKey(e)) {
        setCapturing(null);
        setConflict(null);
        return;
      }
      if (DPAD_KEYCODES.has(e.keyCode)) return;
      if (isModifierOnly(e)) return;
      const binding = eventToBinding(e);
      const dupe = HOTKEYS.find(
        (h) => h.id !== capturing && h.scope === HOTKEY_MAP[capturing].scope && effectiveBinding(h.id, overrides) === binding,
      );
      setBinding(capturing, binding);
      setConflict(dupe ? dupe.id : null);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, overrides]);

  const overrideCount = Object.keys(overrides).length;

  usePageActions(
    tab === "keys" && overrideCount > 0
      ? [
          {
            id: "hotkeys-reset-all",
            label: t("Reset all ({n})", { n: overrideCount }),
            tone: "danger",
            onSelect: resetAll,
            icon: <RotateCcw size={18} strokeWidth={2.2} />,
          },
        ]
      : [],
    tab === "keys" && overrideCount > 0 ? "Resetting cannot be undone." : undefined,
  );

  useSubTabs(
    [
      { id: "keys", label: t("Shortcuts"), count: overrideCount },
      { id: "behaviour", label: t("Behaviour") },
    ],
    tab,
    (id) => setTab(id as Tab),
  );

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "keys" && (
        <>
          <p className={`max-w-[70ch] ${ROW_DESC}`}>
            {t("Click any binding to rebind it. Press Esc while capturing to cancel. Letters ignore Shift (so K and Shift+K trigger the same action).")}
          </p>

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
                {Array.from(subgroups.entries()).map(([groupName, items]) => (
                  <SSection key={groupName} label={t(groupName)}>
                    {items.map((def) => (
                      <HotkeyRow
                        key={def.id}
                        def={def}
                        binding={effectiveBinding(def.id, overrides)}
                        isCustom={def.id in overrides}
                        isCapturing={capturing === def.id}
                        conflict={conflict === def.id}
                        onStartCapture={() => {
                          setConflict(null);
                          setCapturing(def.id);
                        }}
                        onReset={() => setBinding(def.id, null)}
                      />
                    ))}
                    {scope === "Global" && groupName === "Interface" && (
                      <ReadOnlyHotkeyRow
                        label={t("Adjust interface scale with wheel")}
                        description={t("Hold Ctrl or Cmd and scroll to resize Harbor's interface smoothly. This one cannot be changed.")}
                        binding="Ctrl / ⌘ + Scroll"
                      />
                    )}
                  </SSection>
                ))}
              </Section>
            );
          })}

        </>
      )}
      {tab === "behaviour" && (
        <>
          <Section
            title={t("Big Picture")}
            subtitle={t("A full screen, couch friendly Harbor for TVs, handhelds and big monitors.")}
          >
            <ToggleRow
              label={t("Show the Big Picture button")}
              sub={t("Puts a Big Picture button in the top bar so you can switch to the ten-foot layout in one click. The keyboard shortcut keeps working either way.")}
              value={settings.bigPictureButton}
              onChange={(bigPictureButton) => update({ bigPictureButton })}
            />
          </Section>

          <Section title={t("Navigation")} subtitle={t("Move focus with the keyboard, like a TV remote.")}>
            <ToggleRow
              label={t("TV navigation")}
              sub={t("Use the arrow keys and Enter to move focus through Harbor. Turn this off to keep arrow keys free and disable focus navigation everywhere.")}
              value={settings.tvNavigation}
              onChange={(v) => update({ tvNavigation: v })}
            />
            <ToggleRow
              label={t("TV navigation in player")}
              sub={t("Use arrows and Select/Space to move focus between player controls. Turn this off to keep arrows for seeking and Space for play/pause.")}
              value={settings.playerTvNavigation}
              onChange={(v) => update({ playerTvNavigation: v })}
              lockReason={
                !settings.tvNavigation
                  ? t("Enable TV navigation above to use focus navigation in the player.")
                  : undefined
              }
            />
          </Section>

          <Section title={t("Behavior")} subtitle={t("How keys behave during playback.")}>
            <ToggleRow
              label={t("Esc exits fullscreen first")}
              sub={t("When in fullscreen, Esc leaves fullscreen instead of closing the player. Press Esc again to close. Turn off to make Esc always close.")}
              value={settings.playerEscExitsFullscreen}
              onChange={(v) => update({ playerEscExitsFullscreen: v })}
            />
            <ToggleRow
              label={t("Ask before leaving")}
              sub={t("When Esc would close the player, show a quick confirm first. You can tick \"Don't ask me again\" in that prompt to always leave on Esc.")}
              value={settings.playerConfirmLeave}
              onChange={(v) => update({ playerConfirmLeave: v })}
            />
            <SeekStepRow
              label={t("Seek step")}
              sub={t("Choose how far the keyboard arrows and player seek buttons jump.")}
              back={settings.seekBackStepSec}
              forward={settings.seekForwardStepSec}
              onBack={(seekBackStepSec) => update({ seekBackStepSec })}
              onForward={(seekForwardStepSec) => update({ seekForwardStepSec })}
            />
            <SeekStepRow
              label={t("Short seek (Shift + arrows)")}
              sub={t("A shorter jump on Shift plus the arrow keys, for nudging a few seconds at a time.")}
              back={settings.seekBackStepShortSec}
              forward={settings.seekForwardStepShortSec}
              onBack={(seekBackStepShortSec) => update({ seekBackStepShortSec })}
              onForward={(seekForwardStepShortSec) => update({ seekForwardStepShortSec })}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function SeekStepRow({
  label,
  sub,
  back,
  forward,
  onBack,
  onForward,
}: {
  label: string;
  sub: string;
  back: number;
  forward: number;
  onBack: (seconds: number) => void;
  onForward: (seconds: number) => void;
}) {
  const t = useT();
  return (
    <SettingRow label={label} desc={sub} wide>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <SeekStepPicker label={t("Back")} value={back} onChange={onBack} />
        <SeekStepPicker label={t("Forward")} value={forward} onChange={onForward} />
      </div>
    </SettingRow>
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
  const t = useT();
  const options = SEEK_STEP_OPTIONS.map((seconds) => ({
    value: String(seconds),
    label: seconds === 1 ? t("1 second") : t("{n} seconds", { n: seconds }),
  }));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={GROUP_LABEL}>{label}</span>
      <div className="w-[220px] max-w-full">
        <Dropdown
          value={String(value)}
          options={options}
          onChange={(next) => onChange(Number(next))}
          size="md"
        />
      </div>
    </div>
  );
}

function ReadOnlyHotkeyRow({
  label,
  description,
  binding,
}: {
  label: string;
  description: string;
  binding: string;
}) {
  return (
    <SettingRow label={label} desc={description}>
      <span className={BINDING_CHIP}>{binding}</span>
    </SettingRow>
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
  const pillRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isCapturing) pillRef.current?.scrollIntoView({ block: "nearest" });
  }, [isCapturing]);
  return (
    <SettingRow
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{t(def.label)}</span>
          {isCustom && !isCapturing && (
            <span className={`${BADGE} bg-accent-soft text-accent`}>{t("Custom")}</span>
          )}
        </span>
      }
      desc={t(def.description)}
      warn={
        conflict
          ? t("Another shortcut in this list now uses the same key. Change one of them.")
          : undefined
      }
    >
      {isCustom && !isCapturing && (
        <button type="button" onClick={onReset} className={QUIET_ACTION}>
          <RotateCcw size={17} strokeWidth={2.2} />
          {t("Default")}
        </button>
      )}
      <button
        ref={pillRef}
        type="button"
        onClick={onStartCapture}
        aria-label={t("Change the shortcut for {name}", { name: t(def.label) })}
        className={isCapturing ? BINDING_CAPTURING : BINDING_BUTTON}
      >
        {isCapturing ? (
          <>
            <Keyboard size={18} strokeWidth={2.2} />
            {t("Press a key…")}
          </>
        ) : (
          formatBindingForDisplay(binding)
        )}
      </button>
    </SettingRow>
  );
}
