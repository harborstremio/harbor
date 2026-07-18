import { ChevronDown, Code2, Layout as LayoutIcon, Palette } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CodeLang } from "@/components/code-editor";
import type { ChromeConfig, ThemeButtonStyle, ThemeCardStyle, ThemePreset } from "@/lib/theme";
import { CardCssPopout } from "./card-css-popout";
import { CodeSection } from "./code-section";
import { ColorsGrid } from "./colors-grid";
import { CustomChromeBuilder } from "./custom-chrome-builder";
import { FontPicker } from "./font-picker";
import { IdentityRow } from "./identity-row";
import { LayoutPicker } from "./layout-picker";
import { NavEditor } from "./nav-editor";
import { StylePicker } from "./style-picker";
import { StyleSpecimen } from "./style-specimen";
import type { Draft } from "./studio-types";

type Tab = "look" | "layout" | "code";

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: "look", label: "Look", icon: <Palette size={18} strokeWidth={2.2} /> },
  { id: "layout", label: "Layout", icon: <LayoutIcon size={18} strokeWidth={2.2} /> },
  { id: "code", label: "Code", icon: <Code2 size={18} strokeWidth={2.2} /> },
];

export function Inspector({
  draft,
  onPatch,
  onSeed,
  onChromeChange,
  onRegenerateChrome,
  onExpand,
}: {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onSeed: (theme: ThemePreset) => void;
  onChromeChange: (config: ChromeConfig) => void;
  onRegenerateChrome: () => void;
  onExpand: (tab: CodeLang) => void;
}) {
  const [tab, setTab] = useState<Tab>("look");
  const [cardCssOpen, setCardCssOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-edge-soft px-5 py-2.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold transition-colors ${
                active
                  ? "bg-accent-soft text-ink ring-1 ring-inset ring-accent"
                  : "text-ink-muted hover:bg-elevated/50 hover:text-ink"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div key={tab} className="animate-[studioTabIn_220ms_ease-out]">
          {tab === "look" && (
            <div className="flex flex-col">
              <Group title="Identity" sub="What this theme is called.">
                <IdentityRow
                  name={draft.name}
                  blurb={draft.blurb}
                  onChange={(p) => onPatch(p)}
                  onSeed={onSeed}
                />
              </Group>
              <Group title="Colors" sub="Every surface in Harbor maps to one of these.">
                <ColorsGrid colors={draft.colors} onChange={(colors) => onPatch({ colors })} />
                <StyleSpecimen colors={draft.colors} />
              </Group>
              <Group title="Cards" sub="How thumbnails and panels render." defaultOpen={false}>
                <StylePicker
                  kind="card"
                  value={draft.cardStyle}
                  onChange={(v) => onPatch({ cardStyle: v as ThemeCardStyle })}
                  onEditCustom={() => setCardCssOpen(true)}
                />
              </Group>
              <Group
                title="Buttons"
                sub="Surface treatment for action buttons."
                defaultOpen={false}
              >
                <StylePicker
                  kind="button"
                  value={draft.buttonStyle}
                  onChange={(v) => onPatch({ buttonStyle: v as ThemeButtonStyle })}
                />
              </Group>
              <Group title="Typography" sub="Display + body type pairing, or upload your own font.">
                <FontPicker
                  pairValue={draft.fontPair}
                  customValue={draft.customFontId}
                  onPickPair={(fontPair) => onPatch({ fontPair, customFontId: null })}
                  onPickCustom={(id) => onPatch({ customFontId: id })}
                />
              </Group>
              <Group title="Ambience" defaultOpen={false}>
                <BokehToggle value={draft.bokeh} onChange={(bokeh) => onPatch({ bokeh })} />
              </Group>
            </div>
          )}

          {tab === "layout" && (
            <div className="flex flex-col">
              <Group title="Layout" sub="Where the navigation lives. Pick one to see it live.">
                <LayoutPicker value={draft.layout} onChange={(layout) => onPatch({ layout })} />
              </Group>
              {draft.layout === "custom" && (
                <CustomChromeBuilder
                  config={draft.chrome}
                  dirty={draft.chromeDirty}
                  onChange={onChromeChange}
                  onRegenerate={onRegenerateChrome}
                  onOpenCode={() => onExpand("html")}
                />
              )}
              {draft.layout !== "custom" && (
                <Group
                  title="Navigation items"
                  sub="Reorder, rename, or hide what appears in your nav."
                >
                  <NavEditor layout={draft.layout} />
                </Group>
              )}
            </div>
          )}

          {tab === "code" && (
            <Group
              title="Code"
              sub="CSS, HTML and JS layered over the whole app. Optional for built-in layouts, required for custom chrome."
            >
              <CodeSection css={draft.css} js={draft.js} html={draft.html} onExpand={onExpand} />
            </Group>
          )}
        </div>
      </div>

      {cardCssOpen && (
        <CardCssPopout css={draft.css} onChange={onPatch} onClose={() => setCardCssOpen(false)} />
      )}
    </div>
  );
}

function Group({
  title,
  sub,
  defaultOpen = true,
  children,
}: {
  title: string;
  sub?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-edge-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[52px] w-full items-center gap-2 px-5 text-start transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex-1 text-[13px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {title}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2.4}
          className={`shrink-0 text-ink-subtle/70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
          {sub && <p className="text-[13px] leading-snug text-ink-muted">{sub}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

function BokehToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="-mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.03]">
      <div className="flex min-w-0 flex-col">
        <span className="text-[14px] font-semibold text-ink">Bokeh background</span>
        <span className="text-[13px] text-ink-muted">Floating orbs over the canvas.</span>
      </div>
      <span
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        style={{ background: value ? "var(--color-accent)" : "var(--color-edge)" }}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className="absolute h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-transform"
          style={{ transform: value ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </label>
  );
}
