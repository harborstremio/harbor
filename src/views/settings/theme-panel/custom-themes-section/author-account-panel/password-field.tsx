import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Field, inputClass } from "../field";
import { passwordStrength, strengthColor } from "./password-strength";

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  showStrength = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [reveal, setReveal] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;
  const filled = strength ? strength.score : 0;

  return (
    <Field label={label}>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          autoFocus={autoFocus}
          autoComplete="new-password"
          autoCapitalize="off"
          spellCheck={false}
          className={`${inputClass} w-full pe-11`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? t("Hide password") : t("Show password")}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-ink-subtle transition duration-150 hover:text-ink active:scale-90"
        >
          {reveal ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-1 flex items-center gap-2.5">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((seg) => (
              <span
                key={seg}
                className="h-[3px] flex-1 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: seg <= filled ? strengthColor(filled) : "var(--color-edge-soft)",
                }}
              />
            ))}
          </div>
          <span
            className="w-16 text-end text-[11.5px] font-semibold tabular-nums transition-colors duration-300"
            style={{ color: strengthColor(filled) }}
          >
            {strength?.label ? t(strength.label) : ""}
          </span>
        </div>
      )}
    </Field>
  );
}
