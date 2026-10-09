import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "@/views/settings/icons";
import { useT } from "@/lib/i18n";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";

export const inputClass =
  "h-12 w-full rounded-lg border border-edge-soft bg-canvas px-3.5 text-[16px] text-ink placeholder:text-ink-subtle transition-colors duration-150 focus:border-accent focus:outline-none";

export function Field({
  label,
  id,
  hint,
  tone,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  tone?: "muted" | "danger";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium text-ink">{label}</label>
      {children}
      {hint && (
        <span className={`text-[13px] leading-5 ${tone === "danger" ? "text-danger" : "text-ink-muted"}`}>
          {hint}
        </span>
      )}
    </div>
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
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} tone={tone}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter && !navOwnsFocus(e.currentTarget)) {
            e.preventDefault();
            e.stopPropagation();
            onEnter();
          }
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
  const id = useId();
  const t = useT();
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <input
          id={id}
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter && !navOwnsFocus(e.currentTarget)) {
              e.preventDefault();
              e.stopPropagation();
              onEnter();
            }
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
