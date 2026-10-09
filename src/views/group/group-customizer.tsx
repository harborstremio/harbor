import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { editGroup, type GroupCustomization, type GroupDetail } from "@/lib/social/groups";
import {
  CANVAS_MAX,
  CANVAS_MIN,
  MARKUP_CAP,
  SUGGESTED_FONTS,
  validColor,
  validFont,
  validImage,
} from "@/views/profile/customization/customization-types";

const inputCls =
  "w-full min-h-11 rounded-md bg-elevated px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";
const codeCls =
  "harbor-scroll w-full resize-y rounded-md bg-elevated p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

type Form = {
  groupFont: string;
  pageBgColor: string;
  pageBgImage: string;
  customHtml: string;
  customCss: string;
  canvasHeight: number;
  customEnabled: boolean;
};

function fromDetail(d: GroupDetail): Form {
  return {
    groupFont: d.groupFont ?? "",
    pageBgColor: d.pageBgColor ?? "",
    pageBgImage: d.pageBgImage ?? "",
    customHtml: d.customHtml ?? "",
    customCss: d.customCss ?? "",
    canvasHeight: d.canvasHeight ?? 520,
    customEnabled: !!d.customEnabled,
  };
}

function validate(f: Form, t: (k: string) => string): string | null {
  if (f.groupFont.trim() && !validFont(f.groupFont.trim()))
    return t("Font name can only use letters, numbers, and spaces.");
  if (f.pageBgColor.trim() && !validColor(f.pageBgColor.trim()))
    return t("Background color must be a hex or rgb/hsl value.");
  if (f.pageBgImage.trim() && !validImage(f.pageBgImage.trim()))
    return t("Background image must be an https URL.");
  if (f.customHtml.length > MARKUP_CAP || f.customCss.length > MARKUP_CAP)
    return t("Custom code is too large.");
  return null;
}

export function GroupCustomizer({
  detail,
  onApply,
}: {
  detail: GroupDetail;
  onApply: (d: GroupDetail) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<Form>(() => fromDetail(detail));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    const bad = validate(form, t);
    if (bad) {
      setError(bad);
      return;
    }
    setSaving(true);
    setError(null);
    const patch: GroupCustomization = {
      groupFont: form.groupFont.trim(),
      pageBgColor: form.pageBgColor.trim(),
      pageBgImage: form.pageBgImage.trim(),
      customHtml: form.customHtml,
      customCss: form.customCss,
      canvasHeight: form.canvasHeight,
      customEnabled: form.customEnabled,
    };
    try {
      onApply(await editGroup(detail.id, patch));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message || t("Could not save changes."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink">{t("Show customization to members")}</div>
          <div className="text-[12px] text-ink-subtle">
            {t("Off keeps your font, background, and canvas as a private preview.")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.customEnabled}
          aria-label={t("Show customization to members")}
          onClick={() => set("customEnabled", !form.customEnabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            form.customEnabled ? "bg-accent" : "bg-raised"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
              form.customEnabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <Row label={t("Group font")} hint={SUGGESTED_FONTS.slice(0, 3).join(", ")}>
        <input
          value={form.groupFont}
          onChange={(e) => set("groupFont", e.target.value)}
          placeholder="Fraunces"
          className={inputCls}
        />
      </Row>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label={t("Background color")}>
          <input
            value={form.pageBgColor}
            onChange={(e) => set("pageBgColor", e.target.value)}
            placeholder="#0d1117"
            className={inputCls}
          />
        </Row>
        <Row label={t("Background image")} hint="https">
          <input
            value={form.pageBgImage}
            onChange={(e) => set("pageBgImage", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Row>
      </div>

      <Row label={t("Custom HTML")} hint={`${form.customHtml.length}/${MARKUP_CAP}`}>
        <textarea
          value={form.customHtml}
          onChange={(e) => set("customHtml", e.target.value.slice(0, MARKUP_CAP))}
          rows={5}
          spellCheck={false}
          placeholder="<h1>Welcome</h1>"
          className={codeCls}
        />
      </Row>

      <Row label={t("Custom CSS")} hint={`${form.customCss.length}/${MARKUP_CAP}`}>
        <textarea
          value={form.customCss}
          onChange={(e) => set("customCss", e.target.value.slice(0, MARKUP_CAP))}
          rows={5}
          spellCheck={false}
          placeholder="body { color: #fff }"
          className={codeCls}
        />
      </Row>

      <Row label={t("Canvas height")} hint={`${form.canvasHeight}px`}>
        <input
          type="range"
          min={CANVAS_MIN}
          max={CANVAS_MAX}
          step={20}
          value={form.canvasHeight}
          onChange={(e) => set("canvasHeight", Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
      </Row>

      <p className="text-[12px] leading-relaxed text-ink-subtle">
        {t("Your canvas runs in a sandbox with no scripts, so use HTML and CSS for layout and art.")}
      </p>

      {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="flex h-10 w-fit items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saved && !saving ? t("Saved") : t("Save customization")}
      </button>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="truncate text-[12px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
