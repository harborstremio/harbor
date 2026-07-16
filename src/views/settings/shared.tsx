import { Check, ExternalLink, Eye, Key, Lock } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { openUrl } from "@/lib/window";
import { sourceTranslationKey, useT } from "@/lib/i18n";
import { HoverPreviewCard } from "./setting-preview";

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
  | "player"
  | "mpv"
  | "anime"
  | "playerLayout"
  | "hotkeys"
  | "theme"
  | "webhooks"
  | "bug"
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
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={settingsAnchor(title)}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[19px] font-medium tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-[13.5px] leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
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
          <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {label}
          </label>
          {badge && (
            <span className="rounded-full bg-accent/15 px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-accent">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          {!headerExtra && value.length > 0 && !showSave && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent transition-colors">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,200,140,0.5)]" />
              {saved ? t("Saved") : t("Active")}
            </span>
          )}
        </div>
      </div>
      <div
        className={`flex h-14 items-center gap-3 rounded-2xl border bg-elevated px-4 transition-all ${
          focused
            ? "border-ink shadow-[0_0_0_3px_rgba(255,255,255,0.04)]"
            : "border-edge hover:border-edge"
        }`}
      >
        {iconSrc ? (
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle ring-1 ring-edge-soft">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas/40 hover:text-ink"
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
            className={`relative flex h-10 items-center justify-center overflow-hidden rounded-xl px-4 text-[13.5px] font-semibold transition-all ${
              saved
                ? "bg-accent/15 text-accent"
                : "bg-ink text-canvas hover:scale-[1.02] active:scale-[0.97]"
            }`}
          >
            <span
              className={`flex items-center gap-1.5 transition-all ${
                saved ? "translate-y-0 opacity-100" : "absolute translate-y-3 opacity-0"
              }`}
            >
              <Check size={14} strokeWidth={2.6} />
              {t("Saved")}
            </span>
            <span
              className={`flex items-center transition-all ${
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
}: {
  label: string;
  sub?: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  leading?: React.ReactNode;
  lockReason?: string;
  note?: string;
  preview?: React.ReactNode;
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
  return (
    <button
      ref={btnRef}
      onClick={() => !locked && onChange(!value)}
      onMouseEnter={openPreview}
      onMouseLeave={closePreview}
      onFocus={openPreview}
      onBlur={closePreview}
      disabled={locked}
      className={`relative flex items-center justify-between gap-4 rounded-xl border bg-canvas/40 px-4 py-3 text-start transition-colors ${
        locked
          ? "cursor-not-allowed border-edge-soft/40 opacity-60"
          : "border-edge-soft hover:border-edge"
      }`}
    >
      {preview && (
        <HoverPreviewCard open={hover} anchorRef={btnRef}>
          {preview}
        </HoverPreviewCard>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className={`relative ${locked ? "saturate-50 opacity-70" : ""}`}>
          {leading}
          {locked && (
            <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas ring-1 ring-edge text-ink-subtle">
              <Lock size={9} strokeWidth={2.4} />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">{label}</span>
          {subText && (
            <span
              className={`text-[12.5px] ${
                lockReason ? "text-accent/85" : note ? "text-ink-muted" : "text-ink-subtle"
              }`}
            >
              {subText}
            </span>
          )}
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-2.5">
        {preview && (
          <Eye
            size={13}
            className={`transition-colors ${hover ? "text-accent" : "text-ink-subtle/55"}`}
          />
        )}
        <span
          aria-hidden
          className={`relative h-6 w-10 rounded-full transition-colors ${
            effective ? "bg-ink" : "bg-edge"
          }`}
        >
          <span
            className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
              effective ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const t = useT();
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-2xl bg-elevated/40 p-1 ring-1 ring-edge-soft/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.value
              ? "bg-ink text-canvas"
              : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
