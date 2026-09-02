import { useT } from "@/lib/i18n";
import type { CustomizationInput, ProfileSummary } from "../profile-types";
import { CANVAS_MAX, CANVAS_MIN, IMAGE_URL_MAX, SUGGESTED_FONTS } from "./customization-types";
import { FaviconField } from "./favicon-field";

const inputCls =
  "w-full min-h-11 rounded-md bg-elevated px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[12px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function CustomizationEditors({
  form,
  set,
  onSaved,
}: {
  form: CustomizationInput;
  set: <K extends keyof CustomizationInput>(k: K, v: CustomizationInput[K]) => void;
  onSaved?: (next: ProfileSummary) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">
            {t("Show customization to visitors")}
          </div>
          <div className="text-[12px] text-ink-subtle">
            {t("Off keeps your font, background, and canvas as a private preview.")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.customEnabled}
          aria-label={t("Show customization to visitors")}
          onClick={() => set("customEnabled", !form.customEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.customEnabled ? "bg-accent" : "bg-edge"}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.customEnabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>

      <Row label={t("Profile font")} hint={t("Google Fonts family")}>
        <input
          value={form.profileFont}
          maxLength={48}
          onChange={(e) => set("profileFont", e.target.value)}
          className={inputCls}
          placeholder="Space Grotesk"
          autoCapitalize="off"
          spellCheck={false}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_FONTS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("profileFont", f)}
              className={`rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors ${form.profileFont === f ? "bg-accent text-canvas ring-transparent" : "text-ink-muted ring-edge-soft hover:bg-elevated"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </Row>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label={t("Page background color")} hint={t("hex or rgb/hsl")}>
          <input
            value={form.pageBgColor}
            maxLength={64}
            onChange={(e) => set("pageBgColor", e.target.value)}
            className={inputCls}
            placeholder="#101318"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Row>
        <Row label={t("Canvas height")} hint={`${CANVAS_MIN}-${CANVAS_MAX}px`}>
          <input
            type="number"
            min={CANVAS_MIN}
            max={CANVAS_MAX}
            value={form.canvasHeight}
            onChange={(e) => set("canvasHeight", Number(e.target.value))}
            className={inputCls}
          />
        </Row>
      </div>

      <Row label={t("Page background image")} hint={t("https URL, optional")}>
        <input
          value={form.pageBgImage}
          maxLength={IMAGE_URL_MAX}
          onChange={(e) => set("pageBgImage", e.target.value)}
          className={inputCls}
          placeholder="https://example.com/backdrop.jpg"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Row>

      <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">{t("Hide top banner")}</div>
          <div className="text-[12px] text-ink-subtle">
            {t("Let your full page background show without the top cover.")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.hideTopBanner}
          aria-label={t("Hide top banner")}
          onClick={() => set("hideTopBanner", !form.hideTopBanner)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.hideTopBanner ? "bg-accent" : "bg-edge"}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.hideTopBanner ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">{t("Hide card titles")}</div>
          <div className="text-[12px] text-ink-subtle">
            {t("Drop the About and Custom labels so an embed fills the card cleanly.")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.hideCardTitles}
          aria-label={t("Hide card titles")}
          onClick={() => set("hideCardTitles", !form.hideCardTitles)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.hideCardTitles ? "bg-accent" : "bg-edge"}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.hideCardTitles ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>

      <FaviconField form={form} set={set} onSaved={onSaved} />
    </div>
  );
}
