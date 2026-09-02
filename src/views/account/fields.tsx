import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";

export const inputClass =
  "h-11 w-full rounded-md bg-canvas px-3.5 text-[14px] text-ink placeholder:text-ink-subtle transition-colors duration-150 focus:bg-elevated focus:outline-none";

export function Field({
  label,
  hint,
  tone,
  children,
}: {
  label: string;
  hint?: string;
  tone?: "muted" | "danger";
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
      {hint && (
        <span className={`text-[11.5px] ${tone === "danger" ? "text-danger" : "text-ink-subtle"}`}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  tone,
  placeholder,
  maxLength,
  autoFocus,
  autoComplete = "off",
  inputMode,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  tone?: "muted" | "danger";
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email";
  onEnter?: () => void;
}) {
  return (
    <Field label={label} hint={hint} tone={tone}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        inputMode={inputMode}
        className={inputClass}
      />
    </Field>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const t = useT();
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          placeholder={placeholder}
          maxLength={200}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`${inputClass} pe-11`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? t("Hide password") : t("Show password")}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-ink-subtle transition-all duration-150 hover:text-ink active:scale-90"
        >
          {reveal ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </button>
      </div>
    </Field>
  );
}
