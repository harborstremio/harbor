import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Upload } from "lucide-react";
import { GamepadCursor } from "@/components/gamepad-cursor";
import { fillStyle } from "@/components/slider";
import {
  CONTROLLER_CURSOR_PRESETS,
  CONTROLLER_CURSOR_SIZE_MAX,
  CONTROLLER_CURSOR_SIZE_MIN,
  DEFAULT_CONTROLLER_CURSOR_SIZE,
  cursorImageFromFile,
  type ControllerCursorId,
} from "@/lib/gamepad/cursor";
import { useT } from "@/lib/i18n";
import { captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { SettingRow } from "../kit";
import { SButton } from "../ui";

function presetLabel(id: ControllerCursorId, t: (s: string) => string): string {
  if (id === "ring") return t("Ring");
  if (id === "arrow") return t("Pointer");
  if (id === "harbor") return t("Harbor");
  if (id === "custom") return t("Custom");
  return t("Dot");
}

export function CursorSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const file = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLSpanElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const restore = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);

  const current = settings.controllerCursor;
  const image = settings.controllerCursorImage;
  const size = settings.controllerCursorSize;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const url = await cursorImageFromFile(f);
    setFailed(!url);
    if (url) update({ controllerCursorImage: url, controllerCursor: "custom" });
  };

  const openPicker = () => {
    restore.current = captureFocusReturn();
    file.current?.click();
  };

  const closePicker = useCallback(() => {
    restore.current?.();
    restore.current = null;
  }, []);

  useEffect(() => {
    const el = file.current;
    if (!el) return;
    el.addEventListener("cancel", closePicker);
    return () => el.removeEventListener("cancel", closePicker);
  }, [closePicker]);

  const handOff = (to: HTMLElement | null | undefined) => {
    const active = document.activeElement;
    if (!to || !(active instanceof HTMLElement) || !navOwnsFocus(active)) return;
    tvFocus(to);
  };

  const tiles: ControllerCursorId[] = [...CONTROLLER_CURSOR_PRESETS, "custom"];

  return (
    <Section
      title={t("Controller cursor")}
      subtitle={t(
        "The pointer your right stick moves around Harbor. Pick a shape or use your own image.",
      )}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {tiles.map((id) => {
          const on = current === id;
          const empty = id === "custom" && !image;
          return (
            <button
              key={id}
              type="button"
              onClick={() => update({ controllerCursor: id })}
              aria-pressed={on}
              className={`flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[10px] border bg-elevated px-3 py-4 transition-colors duration-150 ${
                on ? "border-accent text-ink" : "border-edge-soft text-ink-muted hover:border-edge"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center text-accent">
                {empty ? (
                  <Upload size={22} strokeWidth={1.9} className="text-ink-subtle" />
                ) : (
                  <GamepadCursor id={id} image={image} className="h-full w-full" />
                )}
              </span>
              <span className="flex items-center gap-1.5 text-center text-[15.5px] font-medium leading-[22px]">
                {presetLabel(id, t)}
                {on && <Check size={18} strokeWidth={2.4} className="shrink-0 text-accent" />}
              </span>
            </button>
          );
        })}
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
          closePicker();
        }}
      />

      <SettingRow
        label={t("Your own image")}
        desc={t("PNG, WEBP, SVG or GIF. Harbor shrinks it to 128px so it stays small on disk.")}
        warn={failed ? t("That image could not be used. Try a smaller PNG or WEBP.") : undefined}
      >
        <span ref={upload} className="contents">
          <SButton onClick={openPicker}>
            <Upload size={17} strokeWidth={2} />
            {image ? t("Replace") : t("Upload")}
          </SButton>
        </span>
        {image && (
          <SButton
            onClick={() => {
              update({ controllerCursorImage: "", controllerCursor: "dot" });
              handOff(upload.current?.querySelector("button"));
            }}
          >
            <RotateCcw size={17} strokeWidth={2} />
            {t("Remove image")}
          </SButton>
        )}
      </SettingRow>

      <SettingRow
        wide
        label={t("Cursor size")}
        desc={t("Make it bigger for a TV across the room, smaller for a desk monitor.")}
      >
        <div className="flex w-full flex-wrap items-center gap-4">
          <div className="flex h-11 min-w-[260px] max-w-[520px] flex-1 items-center gap-4">
            <input
              ref={slider}
              type="range"
              aria-label={t("Cursor size")}
              min={CONTROLLER_CURSOR_SIZE_MIN}
              max={CONTROLLER_CURSOR_SIZE_MAX}
              step={2}
              value={size}
              onChange={(e) => update({ controllerCursorSize: parseInt(e.target.value, 10) })}
              className="harbor-slider min-w-0 flex-1"
              style={fillStyle(size, CONTROLLER_CURSOR_SIZE_MIN, CONTROLLER_CURSOR_SIZE_MAX, 2)}
            />
            <span className="w-[64px] shrink-0 text-end text-[15.5px] font-medium tabular-nums text-ink">
              {t("{n} px", { n: size })}
            </span>
          </div>
          {size !== DEFAULT_CONTROLLER_CURSOR_SIZE && (
            <SButton
              onClick={() => {
                update({ controllerCursorSize: DEFAULT_CONTROLLER_CURSOR_SIZE });
                handOff(slider.current);
              }}
            >
              <RotateCcw size={17} strokeWidth={2} />
              {t("Reset size")}
            </SButton>
          )}
        </div>
      </SettingRow>

      <div className="flex flex-wrap items-center justify-center gap-4 rounded-[10px] border border-edge-soft bg-elevated px-4 py-6">
        <span
          className="flex shrink-0 items-center justify-center text-accent"
          style={{ width: size, height: size }}
        >
          <GamepadCursor id={current} image={image} className="h-full w-full" />
        </span>
        <span className="text-[15.5px] font-normal leading-[22px] text-ink-muted">
          {t("Actual size on screen")}
        </span>
      </div>
    </Section>
  );
}
