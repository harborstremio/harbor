export function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-accent">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function PillToggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold transition-colors ${
        on
          ? "border-ink bg-ink text-canvas"
          : "border-edge-soft bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ChipMultiselect({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    selected: boolean;
    onToggle: () => void;
    leading?: React.ReactNode;
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onToggle}
          className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors ${
            item.selected
              ? "border-accent/55 bg-accent/15 text-accent"
              : "border-edge-soft/70 bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink"
          }`}
        >
          {item.leading}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({
  label,
  sub,
  on,
  onToggle,
  disabled,
  icon,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-start transition-colors ${
        disabled
          ? "cursor-not-allowed border-edge-soft/40 opacity-60"
          : "border-edge-soft hover:border-edge"
      }`}
    >
      {icon && <span className="text-ink-muted">{icon}</span>}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        {sub && <span className="text-[12px] text-ink-subtle">{sub}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-edge"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
            on
              ? "translate-x-[22px] rtl:-translate-x-[22px]"
              : "translate-x-0.5 rtl:-translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
