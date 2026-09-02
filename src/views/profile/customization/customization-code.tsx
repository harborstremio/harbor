import { useT } from "@/lib/i18n";
import type { CustomizationInput } from "../profile-types";
import { MARKUP_CAP } from "./customization-types";

const areaCls =
  "w-full rounded-md bg-elevated px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

function CodeField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const over = value.length > MARKUP_CAP;
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className={`text-[12px] ${over ? "text-danger" : "text-ink-subtle"}`}>
          {value.length}/{MARKUP_CAP}
        </span>
      </div>
      <textarea
        value={value}
        rows={8}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.slice(0, MARKUP_CAP))}
        className={`${areaCls} resize-y`}
        placeholder={placeholder}
      />
    </label>
  );
}

export function CustomizationCode({
  form,
  set,
}: {
  form: CustomizationInput;
  set: <K extends keyof CustomizationInput>(k: K, v: CustomizationInput[K]) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <CodeField
        label={t("Custom HTML")}
        value={form.customHtml}
        placeholder={
          '<div class="card">\n  <h2>Welcome to my corner</h2>\n  <p>Late-night sci-fi and slow mornings.</p>\n</div>'
        }
        onChange={(v) => set("customHtml", v)}
      />
      <CodeField
        label={t("Custom CSS")}
        value={form.customCss}
        placeholder={".card{padding:24px;border-radius:16px;background:#12151b;color:#e8e8ea}"}
        onChange={(v) => set("customCss", v)}
      />
    </div>
  );
}
