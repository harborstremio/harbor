import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HarborMark } from "@/components/icons/harbor-mark";
import { dispatchTvNav, tvHover } from "@/lib/keyboard-navigation";
import { getLiveGamepad, subscribeLiveGamepad, useLiveButtons } from "@/lib/gamepad/live";
import { useGamepad } from "@/lib/gamepad/use-gamepad";
import { useSettings } from "@/lib/settings";

function hoverCss(rules: CSSRuleList): string {
  return Array.from(rules)
    .map((rule) =>
      rule instanceof CSSStyleRule && rule.selectorText.includes(":hover")
        ? `${rule.selectorText.replaceAll(":hover", "[data-gamepad-hover]")}{${rule.style.cssText}${hoverCss(rule.cssRules)}}`
        : "cssRules" in rule && rule.type !== CSSRule.KEYFRAMES_RULE
          ? `${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{${hoverCss((rule as CSSGroupingRule).cssRules)}}`
          : "style" in rule
            ? (rule as CSSNestedDeclarations).style.cssText
            : "",
    )
    .join("");
}

type TextField = HTMLInputElement | HTMLTextAreaElement;
const isTextField = (el: unknown): el is TextField =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement &&
    ["text", "search", "email", "url", "tel", "password", "number"].includes(el.type));

export function GamepadRunner() {
  useGamepad();
  const buttons = useLiveButtons();
  const { settings } = useSettings();
  const cursor = useRef<HTMLDivElement>(null);
  const position = useRef({ x: innerWidth / 2, y: innerHeight / 2 });
  const axes = useRef(getLiveGamepad().axes);
  const motion = useRef(settings);
  const active = useRef(false);
  const lastMove = useRef(performance.now());
  const lastRangeStep = useRef(0);
  const hovered = useRef<HTMLElement>(null);
  const hoverPath = useRef<HTMLElement[]>([]);
  const controllerField = useRef<TextField | null>(null);
  const wake = useRef<() => void>(() => {});
  const [keyboard, setKeyboard] = useState<TextField | null>(null);
  motion.current = settings;

  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-gamepad-hover-styles", "");
    document.head.appendChild(style);
    let frame = 0;
    const apply = () => {
      const css = Array.from(document.styleSheets)
        .filter((sheet) => sheet.ownerNode !== style)
        .map((sheet) => {
          try {
            return hoverCss(sheet.cssRules);
          } catch {
            return "";
          }
        })
        .join("");
      if (style.textContent !== css) style.textContent = css;
    };
    apply();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    });
    observer.observe(document.head, { childList: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      style.remove();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let idleTimer: number | null = null;
    let previous = performance.now();
    let refreshHover = false;
    let tick: FrameRequestCallback;
    const request = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const refresh = () => {
      refreshHover = true;
      request();
    };
    window.addEventListener("blur", refresh);
    tick = (now: number) => {
      frame = 0;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const { lx, ly, rx, ry } = axes.current;
      const settings = motion.current;
      const deadzone = settings.controllerDeadzone;
      const x = Math.abs(rx) < deadzone ? 0 : rx;
      const y = Math.abs(ry) < deadzone ? 0 : ry;
      let moving = !!(x || y);
      if (x || y) {
        active.current = true;
        lastMove.current = now;
        position.current.x = Math.max(
          0,
          Math.min(innerWidth, position.current.x + x * settings.controllerCursorSpeed * dt),
        );
        position.current.y = Math.max(
          0,
          Math.min(innerHeight, position.current.y + y * settings.controllerCursorSpeed * dt),
        );
        const hit = document.elementFromPoint(
          position.current.x,
          position.current.y,
        ) as HTMLElement | null;
        if (refreshHover || hit !== hoverPath.current[0]) {
          refreshHover = false;
          const previousHit = hoverPath.current[0];
          const nextPath: HTMLElement[] = [];
          for (let el = hit; el; el = el.parentElement) nextPath.push(el);
          let shared = 0;
          while (
            shared < hoverPath.current.length &&
            shared < nextPath.length &&
            hoverPath.current[hoverPath.current.length - 1 - shared] ===
              nextPath[nextPath.length - 1 - shared]
          )
            shared++;
          for (let i = 0; i < hoverPath.current.length - shared; i++)
            hoverPath.current[i].removeAttribute("data-gamepad-hover");
          for (let i = 0; i < nextPath.length - shared; i++)
            nextPath[i].setAttribute("data-gamepad-hover", "");
          hoverPath.current = nextPath;
          previousHit?.dispatchEvent(
            new PointerEvent("pointerout", { bubbles: true, relatedTarget: hit }),
          );
          previousHit?.dispatchEvent(new PointerEvent("pointerleave", { relatedTarget: hit }));
          previousHit?.dispatchEvent(
            new MouseEvent("mouseout", { bubbles: true, relatedTarget: hit }),
          );
          previousHit?.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: hit }));
          hit?.dispatchEvent(
            new PointerEvent("pointerover", { bubbles: true, relatedTarget: previousHit }),
          );
          hit?.dispatchEvent(new PointerEvent("pointerenter", { relatedTarget: previousHit }));
          hit?.dispatchEvent(
            new MouseEvent("mouseover", { bubbles: true, relatedTarget: previousHit }),
          );
          hit?.dispatchEvent(new MouseEvent("mouseenter", { relatedTarget: previousHit }));
        }
        const pointerTarget = hit?.closest<HTMLElement>(
          "[data-player-seekbar],[data-gamepad-pointermove]",
        );
        pointerTarget?.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: position.current.x,
            clientY: position.current.y,
          }),
        );
        hit?.closest<HTMLElement>("[data-gamepad-mousemove]")?.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: position.current.x,
            clientY: position.current.y,
          }),
        );
        const target =
          hit?.closest<HTMLElement>(
            "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1']),[data-focusable='true']",
          ) ?? null;
        if (target && document.activeElement !== target) target.focus({ preventScroll: true });
        if (target !== hovered.current) {
          tvHover((hovered.current = target));
        }
        cursor.current?.style.setProperty(
          "transform",
          `translate(${position.current.x}px,${position.current.y}px) translate(-50%,-50%)`,
        );
      }
      const idle =
        settings.controllerCursorHideIdle &&
        now - lastMove.current >= settings.controllerCursorHideDelaySec * 1000;
      if (idle && hoverPath.current.length) {
        const hit = hoverPath.current[0];
        for (const el of hoverPath.current) el.removeAttribute("data-gamepad-hover");
        hoverPath.current = [];
        hovered.current = null;
        tvHover(null);
        hit.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
        hit.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      }
      const opacity =
        active.current &&
        !idle &&
        !(
          document.documentElement.hasAttribute("data-player-chrome-mounted") &&
          !document.documentElement.hasAttribute("data-player-chrome-visible")
        )
          ? "1"
          : "0";
      if (cursor.current && cursor.current.style.opacity !== opacity)
        cursor.current.style.opacity = opacity;
      if (Math.abs(ly) >= deadzone) {
        moving = true;
        let el = document.elementFromPoint(
          position.current.x,
          position.current.y,
        ) as HTMLElement | null;
        while (
          el &&
          el !== document.body &&
          (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) ||
            el.scrollHeight <= el.clientHeight)
        )
          el = el.parentElement;
        (el ?? document.scrollingElement)?.scrollBy({ top: ly * 600 * dt });
      }
      if (
        Math.abs(lx) >= deadzone &&
        document.activeElement?.hasAttribute("data-gamepad-adjusting")
      ) {
        moving = true;
        if (now - lastRangeStep.current > 120) {
          lastRangeStep.current = now;
          dispatchTvNav(lx < 0 ? "left" : "right");
        }
      }
      if (moving) request();
      else if (active.current && settings.controllerCursorHideIdle && !idle)
        idleTimer = window.setTimeout(
          request,
          Math.max(0, settings.controllerCursorHideDelaySec * 1000 - (now - lastMove.current)),
        );
    };
    wake.current = request;
    const observer = new MutationObserver(request);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-player-chrome-mounted", "data-player-chrome-visible"],
    });
    return () => {
      wake.current = () => {};
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (idleTimer !== null) clearTimeout(idleTimer);
      window.removeEventListener("blur", refresh);
    };
  }, []);

  useEffect(
    () =>
      subscribeLiveGamepad(() => {
        axes.current = getLiveGamepad().axes;
        const { lx, ly, rx, ry } = axes.current;
        const deadzone = motion.current.controllerDeadzone;
        if (
          Math.abs(rx) >= deadzone ||
          Math.abs(ry) >= deadzone ||
          Math.abs(ly) >= deadzone ||
          (Math.abs(lx) >= deadzone &&
            document.activeElement?.hasAttribute("data-gamepad-adjusting"))
        )
          wake.current();
      }),
    [],
  );

  useEffect(
    () => wake.current(),
    [
      settings.controllerDeadzone,
      settings.controllerCursorSpeed,
      settings.controllerCursorHideIdle,
      settings.controllerCursorHideDelaySec,
    ],
  );

  useEffect(() => {
    if (!buttons.south) return;
    const selectedField =
      document.activeElement === controllerField.current ? controllerField.current : null;
    if (!active.current && !selectedField) return;
    if (
      keyboard &&
      document.activeElement instanceof HTMLButtonElement &&
      document.activeElement.closest("[data-controller-keyboard]")
    ) {
      document.activeElement.click();
      return;
    }
    const target = document.elementFromPoint(position.current.x, position.current.y);
    document
      .querySelectorAll("[data-gamepad-adjusting]")
      .forEach((el) => el.removeAttribute("data-gamepad-adjusting"));
    const field = isTextField(target) ? target : selectedField;
    if (field) {
      setKeyboard(field);
      return;
    }
    if (target?.closest("[data-settings]")) {
      const range = target.closest<HTMLInputElement>('input[type="range"]');
      if (range) {
        range.setAttribute("data-gamepad-adjusting", "");
        range.focus({ preventScroll: true });
        wake.current();
        return;
      }
      const select = target.closest<HTMLSelectElement>("select");
      if (select) {
        const options = [...select.options].filter((o) => !o.disabled),
          next = options[(options.indexOf(select.selectedOptions[0]) + 1) % options.length];
        if (next) {
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
            select,
            next.value,
          );
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
    }
    const seek = target?.closest<HTMLElement>("[data-player-seekbar]");
    if (seek) {
      seek.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: position.current.x,
          clientY: position.current.y,
        }),
      );
      return;
    }
    const stage = target?.closest<HTMLElement>("[data-player-click-stage]");
    if (stage) {
      stage.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          clientX: position.current.x,
          clientY: position.current.y,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", {
          button: 0,
          clientX: position.current.x,
          clientY: position.current.y,
        }),
      );
      return;
    }
    const clickable = target?.closest<HTMLElement>(
      "button,a,input,select,textarea,[role='button'],[tabindex]",
    );
    (clickable ?? (target instanceof HTMLElement ? target : null))?.click();
  }, [buttons.south]);

  useEffect(() => {
    if (buttons.west && keyboard) typeInto(keyboard, "Backspace");
  }, [buttons.west, keyboard]);

  useEffect(() => {
    if (buttons.north && keyboard) typeInto(keyboard, " ");
  }, [buttons.north, keyboard]);

  useEffect(() => {
    if (!keyboard) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKeyboard(null);
    };
    const observer = new MutationObserver(() => {
      if (!keyboard.isConnected) setKeyboard(null);
    });
    window.addEventListener("keydown", close);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("keydown", close);
      observer.disconnect();
    };
  }, [keyboard]);

  useEffect(() => {
    const select = (e: Event) => {
      controllerField.current = isTextField(e.target) ? e.target : null;
    };
    document.addEventListener("harbor-controller-focus", select);
    return () => document.removeEventListener("harbor-controller-focus", select);
  }, []);

  useEffect(() => {
    if (
      buttons.west &&
      !keyboard &&
      document.documentElement.hasAttribute("data-player-chrome-mounted")
    )
      document.querySelector<HTMLElement>("[data-player-subtitles]")?.click();
  }, [buttons.west, keyboard]);

  return createPortal(
    <>
      {keyboard?.isConnected && (
        <ControllerKeyboard
          input={keyboard}
          size={settings.controllerKeyboardSize}
          onClose={() => setKeyboard(null)}
        />
      )}
      <div
        ref={cursor}
        className="pointer-events-none fixed left-0 top-0 z-[2147483647] h-10 w-10 text-accent opacity-0 drop-shadow-lg"
      >
        <HarborMark className="h-full w-full" />
      </div>
    </>,
    document.body,
  );
}

const KEYS = {
  English: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
  العربية: ["ضصثقفغعهخحجد", "شسيبلاتنمكط", "ئءؤرلاىةوزظ"],
};

function ControllerKeyboard({
  input,
  size,
  onClose,
}: {
  input: TextField;
  size: number;
  onClose: () => void;
}) {
  const [language, setLanguage] = useState<keyof typeof KEYS>("English");
  const [pressed, setPressed] = useState("");
  const flash = (key: string) => {
    setPressed(key);
    window.setTimeout(() => setPressed(""), 120);
  };
  const tap = (key: string) => {
    flash(key);
    typeInto(input, key);
  };
  return (
    <div
      data-controller-keyboard
      className="fixed inset-x-0 bottom-0 z-[2147483646] flex flex-col items-center gap-2 border-t border-edge bg-canvas/95 p-4 shadow-2xl backdrop-blur-xl"
      style={{ transform: `scale(${size / 100})`, transformOrigin: "bottom center" }}
    >
      <div className="flex gap-2">
        {"1234567890".split("").map((key) => (
          <button
            key={key}
            onClick={() => tap(key)}
            className={`h-12 w-12 rounded-full bg-elevated text-lg font-semibold text-ink transition hover:bg-accent/20 hover:ring-4 hover:ring-accent/30 ${pressed === key ? "scale-75 bg-accent text-canvas" : ""}`}
          >
            {key}
          </button>
        ))}
      </div>
      {KEYS[language].map((row) => (
        <div key={row} className="flex gap-2">
          {[...row].map((key) => (
            <button
              key={key}
              onClick={() => tap(key)}
              className={`h-12 w-12 rounded-full bg-elevated text-lg font-semibold text-ink transition hover:bg-accent/20 hover:ring-4 hover:ring-accent/30 ${pressed === key ? "scale-75 bg-accent text-canvas" : ""}`}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={() => {
            flash("Language");
            setLanguage(language === "English" ? "العربية" : "English");
          }}
          className={`h-12 px-6 rounded-xl bg-elevated font-semibold text-ink transition hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${pressed === "Language" ? "scale-90 bg-accent text-canvas" : ""}`}
        >
          {language === "English" ? "العربية" : "English"}
        </button>
        <button
          onClick={() => tap(" ")}
          className={`h-12 w-64 rounded-xl bg-elevated font-semibold text-ink transition hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${pressed === " " ? "scale-90 bg-accent text-canvas" : ""}`}
        >
          Space
        </button>
        <button
          onClick={() => tap("Backspace")}
          className={`h-12 px-6 rounded-xl bg-elevated font-semibold text-ink transition hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 ${pressed === "Backspace" ? "scale-90 bg-accent text-canvas" : ""}`}
        >
          Backspace
        </button>
        <button
          onClick={() => tap("Enter")}
          className={`h-12 px-6 rounded-xl bg-accent font-semibold text-canvas transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${pressed === "Enter" ? "scale-90 brightness-75" : ""}`}
        >
          Search
        </button>
        <button
          onClick={onClose}
          className="h-12 px-6 rounded-xl bg-elevated font-semibold text-ink transition hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 active:scale-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function typeInto(input: TextField, key: string) {
  if (key === "Enter")
    input.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }));
  else {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value =
      key === "Backspace"
        ? input.value.slice(0, Math.max(0, start - 1)) + input.value.slice(end)
        : input.value.slice(0, start) + key + input.value.slice(end);
    Object.getOwnPropertyDescriptor(
      input instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.setSelectionRange(
      key === "Backspace" ? Math.max(0, start - 1) : start + key.length,
      key === "Backspace" ? Math.max(0, start - 1) : start + key.length,
    );
  }
}
