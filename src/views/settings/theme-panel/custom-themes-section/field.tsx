export const inputClass =
  "h-11 rounded-md bg-canvas px-3.5 text-[15.5px] leading-[22px] text-ink placeholder:text-ink-subtle transition-colors focus:bg-elevated focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="harbor-settings-label">{label}</span>
      {children}
      {hint && <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  hint,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={inputClass}
      />
    </Field>
  );
}
