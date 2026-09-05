import { AlertTriangle, Check, ExternalLink, Eye, Key, Lock } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useKnobAnim } from "@/lib/knob-anim";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { getDirection, isRtl } from "@/lib/keyboard-navigation/geometry";
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
  | "licenses"
  | "icons"
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

const ROW_DESC_BASE = "text-[15.5px] font-normal leading-[22px] tracking-[-0.02px]";

export const ROW_TITLE = "text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink";
export const ROW_DESC = `${ROW_DESC_BASE} text-ink-muted`;

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => openUrl(href)}
      className="inline-flex items-center gap-1 text-[15.5px] text-ink underline-offset-4 hover:underline"
    >
      {children} <ExternalLink size={14} />
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

type SectionRegistry = {
  addGroup: (id: string) => void;
  removeGroup: (id: string) => void;
  addRow: (id: string, title: string) => void;
  removeRow: (id: string) => void;
};

const SectionRegistryContext = createContext<SectionRegistry | null>(null);
const SectionFlagsContext = createContext<{ multiGroup: boolean }>({ multiGroup: true });

export function useRegisterRowTitle(label: React.ReactNode) {
  const reg = useContext(SectionRegistryContext);
  const id = useId();
  const title = typeof label === "string" ? label : "";
  useLayoutEffect(() => {
    if (!reg || !title) return;
    reg.addRow(id, title);
    return () => reg.removeRow(id);
  }, [reg, id, title]);
}

export function useGroupHeadingVisible(label?: string) {
  const reg = useContext(SectionRegistryContext);
  const flags = useContext(SectionFlagsContext);
  const id = useId();
  useLayoutEffect(() => {
    if (!reg || !label) return;
    reg.addGroup(id);
    return () => reg.removeGroup(id);
  }, [reg, id, label]);
  return !!label && (!reg || flags.multiGroup);
}

export function stripArrowKeys(
  refs: { current: (HTMLButtonElement | null)[] },
  commit: (index: number) => void,
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    const dir = getDirection(e.nativeEvent);
    if (dir !== "left" && dir !== "right") return;
    const from = refs.current.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const next = from + ((dir === "right") !== isRtl(e.currentTarget) ? 1 : -1);
    const el = refs.current[next];
    if (!el) return;
    e.preventDefault();
    advanceFocus(el, dir);
    commit(next);
  };
}

export function RowText({ lead, children }: { lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="hset-row-text flex min-w-0 items-start gap-3">
      {lead && <span className="hset-row-lead shrink-0 text-ink-muted">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
    </span>
  );
}

export function RowTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className={`hset-row-title flex min-w-0 flex-wrap items-center gap-2 ${ROW_TITLE}`}>
      {children}
    </span>
  );
}

export function RowDesc({ accent, children }: { accent?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`hset-row-desc block max-w-[66ch] ${ROW_DESC_BASE} ${
        accent ? "text-accent" : "text-ink-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function RowNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="hset-row-note flex max-w-[66ch] items-start gap-2 text-[14px] leading-[20px] text-danger">
      <AlertTriangle size={15} strokeWidth={2.4} className="mt-[2px] shrink-0" />
      {children}
    </span>
  );
}

export function RowControl({ span, children }: { span?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`hset-row-control flex min-h-11 min-w-0 flex-wrap items-center gap-2.5 ${
        span ? "w-full justify-start" : "justify-end"
      }`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  subtitle,
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
  const groups = useRef<Set<string>>(new Set());
  const rows = useRef<Map<string, string>>(new Map());
  const [multiGroup, setMultiGroup] = useState(false);
  const [echo, setEcho] = useState(false);
  const titleRef = useRef(title);
  titleRef.current = title;

  const registry = useMemo<SectionRegistry>(() => {
    const sync = () => {
      setMultiGroup(groups.current.size > 1);
      const only = rows.current.size === 1 ? [...rows.current.values()][0] : undefined;
      setEcho(
        groups.current.size <= 1 &&
          !!only &&
          settingsAnchor(only) === settingsAnchor(titleRef.current),
      );
    };
    return {
      addGroup: (id) => {
        groups.current.add(id);
        sync();
      },
      removeGroup: (id) => {
        groups.current.delete(id);
        sync();
      },
      addRow: (id, rowTitle) => {
        rows.current.set(id, rowTitle);
        sync();
      },
      removeRow: (id) => {
        rows.current.delete(id);
        sync();
      },
    };
  }, []);

  const flags = useMemo(() => ({ multiGroup }), [multiGroup]);
  const showHeading = !bare && !echo;

  return (
    <SectionRegistryContext.Provider value={registry}>
      <SectionFlagsContext.Provider value={flags}>
        <section
          id={settingsAnchor(title)}
          className={
            bare
              ? "scroll-mt-[72px]"
              : "harbor-settings-section scroll-mt-[72px] flex flex-col gap-[11px]"
          }
        >
          {showHeading && (
            <div className="flex items-center gap-2">
              <h2 className="harbor-settings-label">{title}</h2>
              {newId && <NewBadge id={newId} />}
            </div>
          )}
          {!bare && subtitle && (
            <p className={`-mt-0.5 max-w-[70ch] ${ROW_DESC}`}>{subtitle}</p>
          )}
          <div className={bare ? undefined : "harbor-settings-group"}>{children}</div>
        </section>
      </SectionFlagsContext.Provider>
    </SectionRegistryContext.Provider>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="harbor-settings-label">
            {label}
          </label>
          {badge && (
            <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent-soft px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-accent">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          {value.length > 0 && !showSave && (
            <span className="flex items-center gap-2 text-[15.5px] font-medium text-ink-subtle transition-colors">
              <span className="h-2 w-2 rounded-full bg-success" />
              {saved ? t("Saved") : t("Active")}
            </span>
          )}
        </div>
      </div>
      <div
        data-settings-row
        className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-[10px] border px-3 transition-colors ${
          focused ? "border-edge bg-raised" : "border-edge-soft bg-elevated"
        }`}
      >
        {iconNode ? (
          iconNode
        ) : iconSrc ? (
          iconBg ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md p-1.5"
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
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
          )
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle">
            <Key size={17} />
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
          className="h-11 min-w-0 flex-1 bg-transparent text-[16.5px] tracking-wide text-ink placeholder:text-ink-subtle/55 outline-none"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? t("Hide") : t("Show")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
          >
            {reveal ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
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
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
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
            className={`relative flex h-11 items-center justify-center overflow-hidden rounded-md px-4 text-[15px] font-semibold transition ${
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
              <Check size={15} strokeWidth={2.6} />
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
      <p className={`max-w-[70ch] ${ROW_DESC_BASE} text-ink-subtle`}>{help}</p>
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
  useRegisterRowTitle(label);
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
      data-settings-row
      data-interactive=""
      data-ctl="switch"
      role="switch"
      aria-checked={effective}
      className={`hset-row group relative ${locked ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {preview && (
        <HoverPreviewCard open={hover} anchorRef={btnRef}>
          <span data-tv-skip className="contents">
            {preview}
          </span>
        </HoverPreviewCard>
      )}
      <RowText
        lead={
          leading ? (
            <span className={`relative block ${locked ? "saturate-50 opacity-70" : ""}`}>
              {leading}
              {locked && (
                <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas ring-1 ring-edge text-ink-subtle">
                  <Lock size={9} strokeWidth={2.4} />
                </span>
              )}
            </span>
          ) : undefined
        }
      >
        <RowTitle>
          <span className="min-w-0">{label}</span>
          {newId && <NewBadge id={newId} />}
          {locked && !leading && (
            <Lock size={14} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
          )}
        </RowTitle>
        {subText && <RowDesc accent={!!lockReason}>{subText}</RowDesc>}
        {warn && <RowNote>{warn}</RowNote>}
      </RowText>
      <RowControl>
        {preview && (
          <Eye
            size={17}
            className={`shrink-0 transition-colors ${hover ? "text-accent" : "text-ink-subtle/55"}`}
          />
        )}
        <span
          aria-hidden
          className={`relative block h-8 w-12 shrink-0 rounded-full transition-colors ${
            effective ? "bg-ink" : "bg-edge"
          }`}
        >
          <span
            className={`absolute start-[3px] top-[3px] h-[26px] w-[26px] rounded-full bg-canvas ${
              effective ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
            } ${knobAnim}`}
          />
        </span>
      </RowControl>
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
      onKeyDown={stripArrowKeys(btnRefs, (i) => onChange(options[i].value))}
      className="relative flex w-fit flex-wrap gap-0.5 rounded-[10px] bg-canvas p-1"
    >
      <span
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute rounded-[6px] bg-ink opacity-0"
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex h-11 items-center rounded-[6px] px-4 text-[15px] font-semibold tracking-[0.01em] transition-colors duration-200 ${
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
    <div className="flex flex-col gap-2">
      {label && <span className={ROW_TITLE}>{label}</span>}
      {sub && <span className={`max-w-[66ch] ${ROW_DESC_BASE} text-ink-subtle`}>{sub}</span>}
      {control}
    </div>
  );
}
