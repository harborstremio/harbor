import { RotateCcw, Shuffle } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CodeLang } from "@/components/code-editor";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_CUSTOM_COLORS,
  THEME_PRESETS,
  type ChromeConfig,
  type ThemeButtonStyle,
  type ThemeCardStyle,
  type ThemePreset,
} from "@/lib/theme";
import { CardCssPopout } from "./card-css-popout";
import { CodeSection } from "./code-section";
import { ColorsGrid } from "./colors-grid";
import { CustomChromeBuilder } from "./custom-chrome-builder";
import { FontPicker } from "./font-picker";
import { IdentityRow } from "./identity-row";
import { LayoutPicker } from "./layout-picker";
import { NavEditor } from "./nav-editor";
import { PresetGallery } from "./preset-gallery";
import { StylePicker } from "./style-picker";
import { StudioSection } from "./controls/studio-section";
import type { Draft } from "./studio-types";

type Tab = "look" | "layout" | "code";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "look", label: "Look" },
  { id: "layout", label: "Layout" },
  { id: "code", label: "Code" },
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
  const t = useT();

  const shuffle = () => {
    const list = Object.values(THEME_PRESETS);
    if (list.length) onSeed(list[Math.floor(Math.random() * list.length)]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pb-1 pt-4">
        <div className="flex items-center gap-1 rounded-md bg-raised p-1">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`harbor-studio-tab flex h-10 flex-1 items-center justify-center rounded-md text-[13.5px] font-semibold transition-colors ${
                  active
                    ? "bg-canvas text-ink ring-1 ring-edge"
                    : "text-ink-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <span
                  key={active ? "on" : "off"}
                  className={active ? "harbor-studio-pop" : undefined}
                >
                  {t(item.label)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div key={tab} className="harbor-studio-body px-5 py-4">
          {tab === "look" && (
            <div className="flex flex-col">
              <IdentityRow name={draft.name} blurb={draft.blurb} onChange={(p) => onPatch(p)} />
              <div className="h-5" />
              <StudioSection
                title={t("Start from")}
                action={
                  <HeaderAction
                    icon={<Shuffle size={14} strokeWidth={2.2} />}
                    label={t("Shuffle")}
                    onClick={shuffle}
                  />
                }
              >
                <PresetGallery onSeed={onSeed} />
              </StudioSection>
              <Hairline />
              <StudioSection
                title={t("Palette")}
                action={
                  <HeaderAction
                    icon={<RotateCcw size={14} strokeWidth={2.2} />}
                    label={t("Reset")}
                    onClick={() => onPatch({ colors: { ...DEFAULT_CUSTOM_COLORS } })}
                  />
                }
              >
                <ColorsGrid colors={draft.colors} onChange={(colors) => onPatch({ colors })} />
              </StudioSection>
              <Hairline />
              <StudioSection title={t("Type")}>
                <FontPicker
                  pairValue={draft.fontPair}
                  customValue={draft.customFontId}
                  onPickPair={(fontPair) => onPatch({ fontPair, customFontId: null })}
                  onPickCustom={(id) => onPatch({ customFontId: id })}
                />
              </StudioSection>
              <StudioSection title={t("Surfaces")}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[12.5px] text-ink-subtle">{t("Cards")}</span>
                    <StylePicker
                      kind="card"
                      value={draft.cardStyle}
                      onChange={(v) => onPatch({ cardStyle: v as ThemeCardStyle })}
                      onEditCustom={() => setCardCssOpen(true)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[12.5px] text-ink-subtle">{t("Buttons")}</span>
                    <StylePicker
                      kind="button"
                      value={draft.buttonStyle}
                      onChange={(v) => onPatch({ buttonStyle: v as ThemeButtonStyle })}
                    />
                  </div>
                  <BokehToggle value={draft.bokeh} onChange={(bokeh) => onPatch({ bokeh })} />
                </div>
              </StudioSection>
            </div>
          )}

          {tab === "layout" && (
            <div className="flex flex-col">
              <StudioSection
                title={t("Layout")}
                hint={t("Where the navigation lives. Pick one to see it live.")}
              >
                <LayoutPicker value={draft.layout} onChange={(layout) => onPatch({ layout })} />
              </StudioSection>
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
                <StudioSection
                  title={t("Navigation items")}
                  hint={t("Reorder, rename, or hide what appears in your nav.")}
                >
                  <NavEditor layout={draft.layout} />
                </StudioSection>
              )}
            </div>
          )}

          {tab === "code" && (
            <StudioSection
              title={t("Code")}
              collapsible
              hint={t(
                "CSS, HTML and JS layered over the whole app. Optional for built-in layouts, required for custom chrome.",
              )}
            >
              <CodeSection css={draft.css} js={draft.js} html={draft.html} onExpand={onExpand} />
            </StudioSection>
          )}
        </div>
      </div>

      {cardCssOpen && (
        <CardCssPopout css={draft.css} onChange={onPatch} onClose={() => setCardCssOpen(false)} />
      )}
    </div>
  );
}

function Hairline() {
  return <div className="mb-6 h-px bg-edge-soft" />;
}

function HeaderAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
    >
      {icon}
      {label}
    </button>
  );
}

function BokehToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <label className="-mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1 transition-colors hover:bg-elevated">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13.5px] font-semibold text-ink">{t("Bokeh background")}</span>
        <span className="text-[13px] text-ink-muted">{t("Floating orbs over the canvas.")}</span>
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
          className="absolute h-5 w-5 rounded-full bg-canvas shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-transform"
          style={{ transform: value ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </label>
  );
}
