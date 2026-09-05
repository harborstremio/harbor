import { BookOpen, X } from "lucide-react";
import { useModalExit } from "@/components/modal-shell";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
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
  WINDOW_HARBOR,
  Z_INDEX_MAP,
  type TokenRow,
} from "./cheat-sheet-data";
import { RECIPES } from "./cheat-sheet-recipes";
import { SUITE_CHROME } from "./suite-theme";

const RECIPE_EXT: Record<string, string> = {
  css: "css",
  js: "js",
  harborstyle: "harborstyle",
  html: "html",
};

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
  { id: "api", label: "window.harbor API" },
  { id: "data-attrs", label: "Root data-attrs" },
  { id: "utilities", label: "Tailwind utilities" },
  { id: "selectors", label: "Stable selectors" },
  { id: "z-index", label: "Z-index map" },
  { id: "events", label: "Window events" },
  { id: "views", label: "View identifiers" },
  { id: "recipes", label: "Recipes" },
] as const;

export function CheatSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { closing, close } = useModalExit(onClose);
  const [active, setActive] = useState<(typeof SECTIONS)[number]["id"]>("tokens-color");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

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
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] flex flex-col bg-surface animate-[editorIn_220ms_ease-out]`}
      style={SUITE_CHROME}
      role="dialog"
      aria-label={t("Theme cheat sheet")}
    >
      <header data-tauri-drag-region className="flex shrink-0 items-start gap-4 px-6 pb-5 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">
            <BookOpen size={16} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
            {t("Cheat sheet")}
          </h2>
          <span className="hidden max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle md:block">
            {t("Every variable, selector, hook, and recipe for building custom Harbor themes.")}
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("Done")}
          title={t("Done")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 px-3 pb-6 pt-2 lg:block">
          <span className="block px-3 pb-2 text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">
            {t("Contents")}
          </span>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className={`relative flex min-h-11 items-center rounded-md px-3 py-2 text-start text-[15.5px] font-medium leading-[22px] transition-colors ${
                  active === s.id
                    ? "bg-elevated text-ink"
                    : "text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {t(s.label)}
              </button>
            ))}
          </nav>
        </aside>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[960px] flex-col gap-12 px-6 pb-16 pt-2 lg:px-10">
            <Section
              id="tokens-color"
              title={t("Color tokens")}
              sub={t("Every surface in Harbor maps to one of these 12 variables.")}
            >
              <TokenTable rows={COLOR_TOKENS} swatch />
            </Section>

            <Section
              id="tokens-font"
              title={t("Font tokens")}
              sub={t("Set on the root. Override any to swap typography.")}
            >
              <TokenTable rows={FONT_TOKENS} />
            </Section>

            <Section
              id="tokens-easing"
              title={t("Easing tokens")}
              sub={t("Shared transition curves. Use anywhere you transition.")}
            >
              <TokenTable rows={EASING_TOKENS} />
            </Section>

            <Section
              id="api"
              title={t("window.harbor API")}
              sub={t(
                "Call these from onclick handlers or your theme JS. They are stable and safe: each one drives the real Harbor feature, so your chrome never goes stale when Harbor adds menu items.",
              )}
            >
              <div className="flex flex-col gap-1.5">
                {WINDOW_HARBOR.map((a) => (
                  <div key={a.call} className="rounded-md bg-canvas px-3.5 py-2.5">
                    <CopyName text={a.call} />
                    <p className="mt-1 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t(a.desc)}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="data-attrs"
              title={t("Root data attributes")}
              sub={t(
                "Set on <html>. Use them to scope styles to a specific layout/card/button choice.",
              )}
            >
              <div className="flex flex-col gap-2.5">
                {ROOT_DATA_ATTRS.map((d) => (
                  <div key={d.attr} className="rounded-md bg-canvas p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <CopyName text={d.attr} />
                      <span className="text-[15.5px] leading-[22px] text-ink-subtle">·</span>
                      <span className="flex flex-wrap gap-1">
                        {d.values.map((v) => (
                          <code
                            key={v}
                            className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[15.5px] leading-[22px] text-ink-muted"
                          >
                            {v}
                          </code>
                        ))}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t(d.desc)}</p>
                    <CodeBlock code={d.example} compact />
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="utilities"
              title={t("Tailwind utility shortcuts")}
              sub={t(
                "The Tailwind classes that already exist on every component. Override one of these in CSS and you change everywhere it's used.",
              )}
            >
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TAILWIND_UTILITIES.map((u) => (
                  <div
                    key={u.class}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2"
                  >
                    <code className="font-mono text-[15.5px] font-semibold leading-[22px] text-ink">
                      .{u.class}
                    </code>
                    <code className="truncate text-end font-mono text-[15.5px] leading-[22px] text-ink-subtle">
                      {u.mapsTo}
                    </code>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="selectors"
              title={t("Stable selectors")}
              sub={t(
                "Class names and data attributes that won't change between releases. Safe to target from your CSS.",
              )}
            >
              <div className="flex flex-col gap-1.5">
                {STABLE_SELECTORS.map((s) => (
                  <div key={s.selector} className="rounded-md bg-canvas px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <CopyName text={s.selector} />
                      <span className="text-[15.5px] leading-[22px] text-ink-muted">{t(s.where)}</span>
                    </div>
                    {s.tip && (
                      <p className="mt-1 max-w-[66ch] text-[15.5px] italic leading-[22px] text-ink-subtle">{t(s.tip)}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="z-index"
              title={t("Z-index map")}
              sub={t("Pick a z-index for your overlays that sits where you want it.")}
            >
              <div className="flex flex-col gap-1">
                {Z_INDEX_MAP.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center gap-3 rounded-md bg-canvas px-3.5 py-2"
                  >
                    <code className="w-14 shrink-0 text-center font-mono text-[15.5px] font-bold leading-[22px] text-accent">
                      {l.z}
                    </code>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[15.5px] font-semibold leading-[22px] text-ink">{t(l.name)}</span>
                      <span className="text-[15.5px] leading-[22px] text-ink-subtle">{t(l.what)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="events"
              title={t("Window events")}
              sub={t(
                "Dispatched on window. Listen from your theme JS to react to Harbor's lifecycle.",
              )}
            >
              <div className="flex flex-col gap-1.5">
                {WINDOW_EVENTS.map((e) => (
                  <div key={e.name} className="rounded-md bg-canvas px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <CopyName text={e.name} />
                      {e.payload && (
                        <code className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[15.5px] leading-[22px] text-ink-muted">
                          {e.payload}
                        </code>
                      )}
                    </div>
                    <p className="mt-1 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t(e.when)}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="views"
              title={t("View identifiers")}
              sub={t("Use these strings if you wire a custom navbar that needs to navigate.")}
            >
              <div className="flex flex-wrap gap-1.5">
                {VIEW_NAMES.map((v) => (
                  <span
                    key={v.id}
                    className="flex items-center gap-2 rounded-full bg-canvas py-1 pe-3 ps-1.5"
                  >
                    <code className="rounded-full bg-elevated px-2.5 py-0.5 font-mono text-[15.5px] leading-[22px] text-ink">
                      {v.id}
                    </code>
                    <span className="text-[15.5px] leading-[22px] text-ink-muted">{t(v.label)}</span>
                  </span>
                ))}
              </div>
            </Section>

            <Section
              id="recipes"
              title={t("Recipes")}
              sub={t("Copy-paste starters for common customizations.")}
            >
              <div className="flex flex-col gap-3">
                {RECIPES.map((r) => (
                  <div key={r.title} className="rounded-md bg-canvas p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-accent">
                        {r.lang}
                      </span>
                      <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">
                        {t(r.title)}
                      </span>
                    </div>
                    <p className="mb-2 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t(r.why)}</p>
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

      <div className="pointer-events-auto fixed bottom-6 end-6 z-[50] flex flex-col items-center rounded-md bg-elevated p-1 harbor-float lg:hidden">
        {SECTIONS.map((s) => (
          <HoverTip key={s.id} label={t(s.label)} side="left">
            <button
              type="button"
              onClick={() => jump(s.id)}
              aria-label={t(s.label)}
              className="flex h-11 w-11 items-center justify-center rounded-md"
            >
              <span
                className="block h-2 w-2 rounded-full transition"
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

function Section({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section id={`cs-${id}`} className="flex flex-col gap-4 scroll-mt-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[19px] font-semibold tracking-tight text-ink">{title}</h3>
        {sub && <span className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function TokenTable({ rows, swatch }: { rows: TokenRow[]; swatch?: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div
          key={r.name}
          className="grid items-center gap-3 rounded-md bg-canvas px-4 py-2.5"
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
            <code className="truncate font-mono text-[15.5px] leading-[22px] text-ink-subtle">
              {r.defaultValue}
            </code>
          </div>
          <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t(r.desc)}</span>
        </div>
      ))}
    </div>
  );
}
