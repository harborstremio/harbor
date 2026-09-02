import { AlertTriangle, Check, ExternalLink, Eye, Key, Lock } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useKnobAnim } from "@/lib/knob-anim";
import { openUrl } from "@/lib/window";
import { sourceTranslationKey, useT } from "@/lib/i18n";
import { HoverPreviewCard } from "./setting-preview";
import { NewBadge } from "./new-badge";

export type SectionId =
  | "basics"
  | "account"
  | "library"
  | "trakt"
  | "anilist"
  | "mal"
  | "simkl"
  | "letterboxd"
  | "relay"
  | "streaming"
  | "streamFilters"
  | "p2p"
  | "language"
  | "subtitles"
  | "player"
  | "mpv"
  | "anime"
  | "shaders"
  | "playerLayout"
  | "hotkeys"
  | "controllers"
  | "theme"
  | "badges"
  | "awardIcons"
  | "webhooks"
  | "bug"
  | "support"
  | "remotes"
  | "tv"
  | "storage"
  | "trackers"
  | "updates"
  | "advanced";

export const SettingsActiveContext = createContext<{ setActive: (s: SectionId) => void } | null>(
  null,
);

export function useSettingsActiveContext() {
  const v = useContext(SettingsActiveContext);
  if (!v) throw new Error("SettingsActiveContext missing");
  return v;
}

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => openUrl(href)}
      className="inline-flex items-center gap-1 text-ink underline-offset-4 hover:underline"
    >
      {children} <ExternalLink size={12} />
    </button>
  );
}

export function settingsAnchor(title: string): string {
  return (
    "set-" +
    sourceTranslationKey(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
  );
}

export function Section({
  title,
  subtitle: _subtitle,
  newId,
  bare,
  children,
}: {
  title: string;
  subtitle?: string;
  newId?: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={settingsAnchor(title)}
      className={bare ? "scroll-mt-28" : "scroll-mt-28 flex flex-col gap-2"}
    >
      {!bare && (
        <div className="flex items-center gap-2 px-1 pb-0.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
          {newId && <NewBadge id={newId} />}
        </div>
      )}
      {children}
    </section>
  );
}

export function KeyField({
  label,
  placeholder,
  value,
  onChange,
  onSave,
  saved,
  help,
  iconSrc,
  iconBg,
  iconNode,
  headerExtra,
  badge,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saved: boolean;
  help: React.ReactNode;
  iconSrc?: string;
  iconBg?: string;
  iconNode?: React.ReactNode;
  headerExtra?: React.ReactNode;
  badge?: string;
}) {
  const t = useT();
  const [reveal, setReveal] = useState(false);
  const [focused, setFocused] = useState(false);
  const [initialValue, setInitialValue] = useState(value);
  useEffect(() => {
    if (saved) setInitialValue(value);
  }, [saved, value]);
  const dirty = value.trim() !== initialValue.trim();
  const showSave = dirty;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const stateRef = useRef({ dirty, value });
  stateRef.current = { dirty, value };

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      if (stateRef.current.dirty) onSaveRef.current();
    }, 700);
    return () => window.clearTimeout(t);
  }, [dirty, value]);

  useEffect(() => {
    return () => {
      if (stateRef.current.dirty) onSaveRef.current();
    };
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {label}
          </label>
          {badge && (
            <span className="rounded-full bg-accent-soft px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-accent">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          {value.length > 0 && !showSave && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-subtle transition-colors">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {saved ? t("Saved") : t("Active")}
            </span>
          )}
        </div>
      </div>
      <div
        className={`flex h-14 items-center gap-3 rounded-md px-4 transition-colors ${
          focused ? "bg-raised" : "bg-elevated"
        }`}
      >
        {iconNode ? (
          iconNode
        ) : iconSrc ? (
          iconBg ? (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md p-1"
              style={{ backgroundColor: iconBg }}
            >
              <img
                src={iconSrc}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
              />
            </span>
          ) : (
            <img
              src={iconSrc}
              alt=""
              draggable={false}
              className="h-7 w-7 shrink-0 rounded-md object-contain"
            />
          )
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle">
            <Key size={14} />
          </span>
        )}
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (stateRef.current.dirty) onSaveRef.current();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty) {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="h-full flex-1 bg-transparent text-[15px] tracking-wide text-ink placeholder:text-ink-subtle/55 outline-none"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? t("Hide") : t("Show")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
          >
            {reveal ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M4 4l16 16"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </button>
        )}
        <div
          className={`flex shrink-0 items-center transition-all ${
            showSave || saved ? "ms-1 w-auto opacity-100" : "w-0 overflow-hidden opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={onSave}
            disabled={!showSave && !saved}
            className={`relative flex h-10 items-center justify-center overflow-hidden rounded-md px-4 text-[13.5px] font-semibold transition ${
              saved
                ? "bg-accent-soft text-accent"
                : "bg-ink text-canvas hover:scale-[1.02] active:scale-[0.97]"
            }`}
          >
            <span
              className={`flex items-center gap-1.5 transition ${
                saved ? "translate-y-0 opacity-100" : "absolute translate-y-3 opacity-0"
              }`}
            >
              <Check size={14} strokeWidth={2.6} />
              {t("Saved")}
            </span>
            <span
              className={`flex items-center transition ${
                saved ? "absolute -translate-y-3 opacity-0" : "translate-y-0 opacity-100"
              }`}
            >
              {t("Save")}
            </span>
          </button>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-subtle">{help}</p>
    </div>
  );
}

export function ToggleRow({
  label,
  sub,
  value,
  onChange,
  leading,
  lockReason,
  note,
  preview,
  newId,
  warn,
}: {
  label: string;
  sub?: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  leading?: React.ReactNode;
  lockReason?: string;
  note?: string;
  preview?: React.ReactNode;
  newId?: string;
  warn?: string;
}) {
  const locked = !!lockReason;
  const effective = value && !locked;
  const subText: React.ReactNode = lockReason ?? note ?? sub;
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [hover, setHover] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const openPreview = () => {
    if (!preview) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHover(true), 200);
  };
  const closePreview = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHover(false);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    },
    [],
  );
  const knobAnim = useKnobAnim(effective);
  return (
    <button
      ref={btnRef}
      onClick={() => !locked && onChange(!value)}
      onMouseEnter={openPreview}
      onMouseLeave={closePreview}
      onFocus={openPreview}
      onBlur={closePreview}
      disabled={locked}
      className={`group relative flex w-full items-center gap-4 rounded-md px-4 py-3.5 text-start transition-colors ${
        locked ? "cursor-not-allowed bg-elevated opacity-60" : "bg-elevated hover:bg-raised"
      }`}
    >
      {preview && (
        <HoverPreviewCard open={hover} anchorRef={btnRef}>
          {preview}
        </HoverPreviewCard>
      )}
      {leading && (
        <span className={`relative shrink-0 ${locked ? "saturate-50 opacity-70" : ""}`}>
          {leading}
          {locked && (
            <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas ring-1 ring-edge text-ink-subtle">
              <Lock size={9} strokeWidth={2.4} />
            </span>
          )}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium leading-snug text-ink">
          {label}
          {newId && <NewBadge id={newId} />}
          {locked && !leading && (
            <Lock size={12} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
          )}
        </span>
        {subText && (
          <span
            className={`max-w-[70ch] text-[12.5px] leading-relaxed ${
              lockReason ? "text-accent" : note ? "text-ink-muted" : "text-ink-subtle"
            }`}
          >
            {subText}
          </span>
        )}
        {warn && (
          <span className="flex max-w-[70ch] items-start gap-1.5 text-[12.5px] text-danger">
            <AlertTriangle size={14} strokeWidth={2.4} className="mt-[2px] shrink-0" />
            {warn}
          </span>
        )}
      </span>
      {preview && (
        <Eye
          size={14}
          className={`shrink-0 transition-colors ${hover ? "text-accent" : "text-ink-subtle/55"}`}
        />
      )}
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          effective ? "bg-ink" : "bg-edge"
        }`}
      >
        <span
          className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas ${
            effective ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          } ${knobAnim}`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  sub,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label?: string;
  sub?: string;
}) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const prevIndex = useRef(-1);
  const activeIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const to = btnRefs.current[activeIndex];
    if (!thumb || !to) return;
    const place = (el: HTMLButtonElement) => {
      thumb.style.left = `${el.offsetLeft}px`;
      thumb.style.top = `${el.offsetTop}px`;
      thumb.style.width = `${el.offsetWidth}px`;
      thumb.style.height = `${el.offsetHeight}px`;
      thumb.style.opacity = "1";
    };
    const from = prevIndex.current >= 0 ? btnRefs.current[prevIndex.current] : null;
    prevIndex.current = activeIndex;
    place(to);
    if (!from || from === to) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (from.offsetTop === to.offsetTop) {
      const edge = Math.min(from.offsetLeft, to.offsetLeft);
      const far = Math.max(from.offsetLeft + from.offsetWidth, to.offsetLeft + to.offsetWidth);
      thumb.animate(
        [
          { left: `${from.offsetLeft}px`, width: `${from.offsetWidth}px` },
          { left: `${edge}px`, width: `${far - edge}px`, offset: 0.5 },
          { left: `${to.offsetLeft}px`, width: `${to.offsetWidth}px` },
        ],
        { duration: 420, easing: "ease-in-out" },
      );
    } else {
      thumb.animate(
        [
          { left: `${from.offsetLeft}px`, top: `${from.offsetTop}px`, width: `${from.offsetWidth}px` },
          { left: `${to.offsetLeft}px`, top: `${to.offsetTop}px`, width: `${to.offsetWidth}px` },
        ],
        { duration: 320, easing: "ease-in-out" },
      );
    }
  }, [activeIndex, options.length]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const thumb = thumbRef.current;
      const el = btnRefs.current[activeIndex];
      if (!thumb || !el) return;
      thumb.style.left = `${el.offsetLeft}px`;
      thumb.style.top = `${el.offsetTop}px`;
      thumb.style.width = `${el.offsetWidth}px`;
      thumb.style.height = `${el.offsetHeight}px`;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [activeIndex]);

  const control = (
    <div
      ref={wrapRef}
      className="relative flex w-fit flex-wrap gap-0.5 rounded-md bg-canvas p-1"
    >
      <span
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute rounded-[4px] bg-ink opacity-0"
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative z-10 rounded-[4px] px-4 py-2 text-[12.5px] font-bold tracking-[0.04em] transition-colors duration-200 ${
            value === o.value ? "text-canvas" : "text-ink-subtle hover:text-ink"
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
  if (!label && !sub) return control;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-medium text-ink">{label}</span>}
      {sub && <span className="max-w-[62ch] text-[12.5px] leading-snug text-ink-subtle">{sub}</span>}
      {control}
    </div>
  );
}
