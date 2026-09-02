import { useRef, useState } from "react";
import { RotateCcw, Upload } from "lucide-react";
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
import { useSettings } from "@/lib/settings";
import { Section, ToggleRow } from "../shared";
import { SettingRow } from "../kit";

const IDLE_MS_MIN = 1000;
const IDLE_MS_MAX = 10_000;
const IDLE_MS_STEP = 500;

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
  const [failed, setFailed] = useState(false);

  const current = settings.controllerCursor;
  const image = settings.controllerCursorImage;
  const size = settings.controllerCursorSize;
  const enabled = settings.controllerCursorEnabled;
  const hideMs = settings.controllerCursorHideMs;
  const hideSec = Math.round(hideMs / 100) / 10;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const url = await cursorImageFromFile(f);
    setFailed(!url);
    if (url) update({ controllerCursorImage: url, controllerCursor: "custom" });
  };

  const tiles: ControllerCursorId[] = [...CONTROLLER_CURSOR_PRESETS, "custom"];

  return (
    <Section
      title={t("Controller cursor")}
      subtitle={t("The pointer your right stick moves around Harbor. Pick a shape or use your own image.")}
    >
      <div className="flex flex-col gap-2">
        <ToggleRow
          label={t("Show cursor")}
          sub={t("When off, the right stick no longer shows a cursor on screen. Focus navigation still works.")}
          value={enabled}
          onChange={(v) => update({ controllerCursorEnabled: v })}
        />

        {enabled && (
          <>
            <div className="flex flex-wrap gap-2">
              {tiles.map((id) => {
                const on = current === id;
                const empty = id === "custom" && !image;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => (empty ? file.current?.click() : update({ controllerCursor: id }))}
                    aria-pressed={on}
                    className={`flex h-[84px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-lg transition-colors duration-150 ${
                      on
                        ? "bg-elevated text-ink ring-1 ring-accent/40"
                        : "bg-white/[0.04] text-ink-muted ring-1 ring-edge-soft hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center text-accent">
                      {empty ? (
                        <Upload size={17} strokeWidth={1.9} className="text-ink-subtle" />
                      ) : (
                        <GamepadCursor id={id} image={image} className="h-full w-full" />
                      )}
                    </span>
                    <span className="text-[11.5px] font-medium">{presetLabel(id, t)}</span>
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
              }}
            />

            <SettingRow
              label={t("Your own image")}
              desc={t("PNG, WEBP, SVG or GIF. Harbor shrinks it to 128px so it stays small on disk.")}
            >
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => file.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12.5px] font-medium text-ink transition-colors duration-150 hover:bg-white/[0.10]"
                >
                  <Upload size={14} strokeWidth={2} />
                  {image ? t("Replace") : t("Upload")}
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => update({ controllerCursorImage: "", controllerCursor: "dot" })}
                    aria-label={t("Remove image")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-ink-muted transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink"
                  >
                    <RotateCcw size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </SettingRow>

            {failed && (
              <p className="px-1 text-[12px] text-danger">
                {t("That image could not be used. Try a smaller PNG or WEBP.")}
              </p>
            )}

            <SettingRow
              label={t("Cursor size")}
              desc={t("Make it bigger for a TV across the room, smaller for a desk monitor.")}
            >
              <div className="flex w-[216px] shrink-0 items-center gap-3">
                <input
                  type="range"
                  min={CONTROLLER_CURSOR_SIZE_MIN}
                  max={CONTROLLER_CURSOR_SIZE_MAX}
                  step={2}
                  value={size}
                  onChange={(e) => update({ controllerCursorSize: parseInt(e.target.value, 10) })}
                  className="harbor-slider min-w-0 flex-1"
                  style={fillStyle(size, CONTROLLER_CURSOR_SIZE_MIN, CONTROLLER_CURSOR_SIZE_MAX)}
                />
                <span className="w-[56px] shrink-0 text-end text-[12.5px] font-semibold tabular-nums text-ink">
                  {t("{n} px", { n: size })}
                </span>
              </div>
            </SettingRow>

            <SettingRow
              label={t("Hide after idle")}
              desc={t("The cursor fades away when you stop moving the stick. Move it again to bring it back.")}
            >
              <div className="flex w-[216px] shrink-0 items-center gap-3">
                <input
                  type="range"
                  min={IDLE_MS_MIN}
                  max={IDLE_MS_MAX}
                  step={IDLE_MS_STEP}
                  value={hideMs}
                  onChange={(e) => update({ controllerCursorHideMs: parseInt(e.target.value, 10) })}
                  className="harbor-slider min-w-0 flex-1"
                  style={fillStyle(hideMs, IDLE_MS_MIN, IDLE_MS_MAX)}
                />
                <span className="w-[56px] shrink-0 text-end text-[12.5px] font-semibold tabular-nums text-ink">
                  {t("{n} s", { n: hideSec })}
                </span>
              </div>
            </SettingRow>

            <div className="flex items-center justify-center gap-3 rounded-lg bg-canvas/50 py-6 ring-1 ring-inset ring-edge-soft">
              <span
                className="flex items-center justify-center text-accent drop-shadow-lg"
                style={{ width: size, height: size }}
              >
                <GamepadCursor id={current} image={image} className="h-full w-full" />
              </span>
              <span className="text-[12px] text-ink-subtle">
                {t("Actual size on screen")}
                {size !== DEFAULT_CONTROLLER_CURSOR_SIZE && (
                  <button
                    type="button"
                    onClick={() => update({ controllerCursorSize: DEFAULT_CONTROLLER_CURSOR_SIZE })}
                    className="ms-2 font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    {t("Reset")}
                  </button>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
