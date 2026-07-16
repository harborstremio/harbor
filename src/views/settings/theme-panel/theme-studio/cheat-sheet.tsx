import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CodeBlock, CopyName, HoverTip } from "./cheat-sheet-parts";
import {
  COLOR_TOKENS,
  EASING_TOKENS,
  FONT_TOKENS,
  ROOT_DATA_ATTRS,
  STABLE_SELECTORS,
  TAILWIND_UTILITIES,
  VIEW_NAMES,
  WINDOW_EVENTS,
  Z_INDEX_MAP,
  type TokenRow,
} from "./cheat-sheet-data";
import { RECIPES } from "./cheat-sheet-recipes";
import { SUITE_CHROME } from "./suite-theme";

const RECIPE_EXT: Record<string, string> = { css: "css", js: "js", harborstyle: "harborstyle", html: "html" };

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "snippet"
  );
}

const SECTIONS = [
  { id: "tokens-color", label: "Color tokens" },
  { id: "tokens-font", label: "Font tokens" },
  { id: "tokens-easing", label: "Easing tokens" },
  { id: "data-attrs", label: "Root data-attrs" },
  { id: "utilities", label: "Tailwind utilities" },
  { id: "selectors", label: "Stable selectors" },
  { id: "z-index", label: "Z-index map" },
  { id: "events", label: "Window events" },
  { id: "views", label: "View identifiers" },
  { id: "recipes", label: "Recipes" },
] as const;

export function CheatSheet({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<(typeof SECTIONS)[number]["id"]>("tokens-color");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = el.scrollTop + 96;
        let cur: (typeof SECTIONS)[number]["id"] = SECTIONS[0].id;
        for (const s of SECTIONS) {
          const sec = document.getElementById(`cs-${s.id}`);
          if (sec && sec.offsetTop <= y) cur = s.id;
        }
        setActive(cur);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(`cs-${id}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
      setActive(id as never);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex flex-col bg-canvas animate-[editorIn_220ms_ease-out]"
      style={SUITE_CHROME}
      role="dialog"
      aria-label="Theme cheat sheet"
      data-tv-focus-scope
    >
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center gap-3 border-b border-edge-soft bg-surface px-6"
      >
        <div className="flex items-center gap-2.5 text-ink">
          <BookOpen size={20} strokeWidth={2} />
          <span className="text-[17px] font-semibold tracking-tight">Cheat sheet</span>
        </div>
        <span className="ms-2 hidden text-[13px] text-ink-muted md:inline">
          Every variable, selector, hook, and recipe for building custom Harbor themes.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ms-auto flex h-11 items-center rounded-lg px-5 text-[14.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          style={{ background: "var(--color-accent)" }}
        >
          Done
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-e border-edge-soft bg-surface px-2.5 py-4 lg:block">
          <span className="block px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
            Contents
          </span>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className={`relative rounded-lg px-3 py-2.5 text-start text-[14px] font-medium transition-colors ${
                  active === s.id
                    ? "bg-white/[0.06] text-ink"
                    : "text-ink-muted hover:bg-white/[0.03] hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[960px] flex-col gap-12 px-6 py-9 lg:px-10">
            <Section id="tokens-color" title="Color tokens" sub="Every surface in Harbor maps to one of these 12 variables.">
              <TokenTable rows={COLOR_TOKENS} swatch />
            </Section>

            <Section id="tokens-font" title="Font tokens" sub="Set on the root. Override any to swap typography.">
              <TokenTable rows={FONT_TOKENS} />
            </Section>

            <Section id="tokens-easing" title="Easing tokens" sub="Shared transition curves. Use anywhere you transition.">
              <TokenTable rows={EASING_TOKENS} />
            </Section>

            <Section id="data-attrs" title="Root data attributes" sub="Set on <html>. Use them to scope styles to a specific layout/card/button choice.">
              <div className="flex flex-col gap-2.5">
                {ROOT_DATA_ATTRS.map((d) => (
                  <div key={d.attr} className="rounded-lg border border-edge-soft bg-elevated/15 p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <CopyName text={d.attr} />
                      <span className="text-[11px] text-ink-subtle">·</span>
                      <span className="flex flex-wrap gap-1">
                        {d.values.map((v) => (
                          <code
                            key={v}
                            className="rounded bg-canvas/70 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                          >
                            {v}
                          </code>
                        ))}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{d.desc}</p>
                    <CodeBlock code={d.example} compact />
                  </div>
                ))}
              </div>
            </Section>

            <Section id="utilities" title="Tailwind utility shortcuts" sub="The Tailwind classes that already exist on every component. Override one of these in CSS and you change everywhere it's used.">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TAILWIND_UTILITIES.map((u) => (
                  <div
                    key={u.class}
                    className="flex items-center justify-between gap-3 rounded-lg border border-edge-soft bg-elevated/15 px-3 py-1.5"
                  >
                    <code className="font-mono text-[11.5px] font-semibold text-ink">.{u.class}</code>
                    <code className="truncate text-end font-mono text-[11px] text-ink-subtle">{u.mapsTo}</code>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="selectors" title="Stable selectors" sub="Class names and data attributes that won't change between releases. Safe to target from your CSS.">
              <div className="flex flex-col gap-1.5">
                {STABLE_SELECTORS.map((s) => (
                  <div
                    key={s.selector}
                    className="rounded-lg border border-edge-soft bg-elevated/15 px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline gap-3">
                      <CopyName text={s.selector} />
                      <span className="text-[11.5px] text-ink-muted">{s.where}</span>
                    </div>
                    {s.tip && (
                      <p className="mt-1 text-[11px] italic text-ink-subtle">{s.tip}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section id="z-index" title="Z-index map" sub="Pick a z-index for your overlays that sits where you want it.">
              <div className="flex flex-col gap-1">
                {Z_INDEX_MAP.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center gap-3 rounded-lg border border-edge-soft bg-elevated/15 px-3.5 py-2"
                  >
                    <code className="w-12 shrink-0 text-center font-mono text-[12.5px] font-bold text-accent">
                      {l.z}
                    </code>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[12.5px] font-semibold text-ink">{l.name}</span>
                      <span className="text-[11px] text-ink-subtle">{l.what}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="events" title="Window events" sub="Dispatched on window. Listen from your theme JS to react to Harbor's lifecycle.">
              <div className="flex flex-col gap-1.5">
                {WINDOW_EVENTS.map((e) => (
                  <div
                    key={e.name}
                    className="rounded-lg border border-edge-soft bg-elevated/15 px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <CopyName text={e.name} />
                      {e.payload && (
                        <code className="rounded bg-canvas/70 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-muted">
                          {e.payload}
                        </code>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink-muted">{e.when}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="views" title="View identifiers" sub="Use these strings if you wire a custom navbar that needs to navigate.">
              <div className="flex flex-wrap gap-1.5">
                {VIEW_NAMES.map((v) => (
                  <span
                    key={v.id}
                    className="flex items-center gap-2 rounded-full border border-edge-soft bg-elevated/20 py-1 ps-1.5 pe-3"
                  >
                    <code className="rounded-full bg-canvas/70 px-2 py-0.5 font-mono text-[11px] text-ink">
                      {v.id}
                    </code>
                    <span className="text-[11.5px] text-ink-muted">{v.label}</span>
                  </span>
                ))}
              </div>
            </Section>

            <Section id="recipes" title="Recipes" sub="Copy-paste starters for common customizations.">
              <div className="flex flex-col gap-3">
                {RECIPES.map((r) => (
                  <div key={r.title} className="rounded-lg border border-edge-soft bg-elevated/15 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                        {r.lang}
                      </span>
                      <span className="text-[13px] font-semibold text-ink">{r.title}</span>
                    </div>
                    <p className="mb-2 text-[12.5px] text-ink-muted">{r.why}</p>
                    <CodeBlock
                      code={r.code}
                      filename={`${slug(r.title)}.${RECIPE_EXT[r.lang.toLowerCase()] ?? "txt"}`}
                    />
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto fixed bottom-6 end-6 z-[50] flex flex-col items-center gap-1 rounded-xl border border-edge-soft bg-surface/90 p-1.5 backdrop-blur-md">
        {SECTIONS.map((s) => (
          <HoverTip key={s.id} label={s.label} side="left">
            <button
              type="button"
              onClick={() => jump(s.id)}
              aria-label={s.label}
              className="flex h-5 w-5 items-center justify-center"
            >
              <span
                className="block h-2 w-2 rounded-full transition-all"
                style={{
                  background: active === s.id ? "var(--color-accent)" : "var(--color-edge)",
                  transform: active === s.id ? "scale(1.6)" : "scale(1)",
                }}
              />
            </button>
          </HoverTip>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={`cs-${id}`} className="flex flex-col gap-4 scroll-mt-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[21px] font-semibold tracking-tight text-ink">{title}</h3>
        {sub && <span className="text-[13.5px] leading-snug text-ink-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function TokenTable({ rows, swatch }: { rows: TokenRow[]; swatch?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div
          key={r.name}
          className="grid items-center gap-3 rounded-lg border border-edge-soft bg-elevated/15 px-4 py-2.5"
          style={{ gridTemplateColumns: swatch ? "auto 1fr 1.4fr" : "1fr 1.4fr" }}
        >
          {swatch && (
            <span
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-md ring-1 ring-edge-soft"
              style={{ background: `var(${r.name})` }}
            />
          )}
          <div className="flex min-w-0 flex-col">
            <CopyName text={r.name} />
            <code className="truncate font-mono text-[12px] text-ink-subtle">{r.defaultValue}</code>
          </div>
          <span className="text-[13px] leading-snug text-ink-muted">{r.desc}</span>
        </div>
      ))}
    </div>
  );
}

