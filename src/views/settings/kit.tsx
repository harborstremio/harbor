import { AlertTriangle, HelpCircle, Lock, X } from "lucide-react";
import { type ReactNode } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { settingsAnchor } from "./shared";

const BLOCK = "flex items-center gap-3 rounded-md bg-elevated px-4 py-3.5";

export function InfoTip({ text, sub }: { text: string; sub?: string }) {
  return (
    <HoverTooltip label={text} sublabel={sub} side="top" align="start">
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:text-ink">
        <HelpCircle size={14} strokeWidth={2.2} />
      </span>
    </HoverTooltip>
  );
}

export function SettingRow({
  label,
  desc,
  icon,
  tip,
  warn,
  lockReason,
  wide,
  children,
}: {
  label: ReactNode;
  desc?: ReactNode;
  icon?: ReactNode;
  tip?: string;
  warn?: string;
  lockReason?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  const locked = !!lockReason;
  const prose = desc ?? lockReason;
  const dim = locked ? "opacity-60" : "";

  if (wide) {
    return (
      <div className={`${BLOCK} w-full flex-col items-start gap-1 ${dim}`}>
        <span className="flex items-center gap-2.5">
          {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
          <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
            {label}
            {tip && <InfoTip text={tip} />}
          </span>
        </span>
        {prose && (
          <span className="max-w-[70ch] text-[12.5px] leading-relaxed text-ink-subtle">{prose}</span>
        )}
        {children && <div className="mt-2.5 w-full">{children}</div>}
      </div>
    );
  }

  if (prose || warn) {
    return (
      <div className={`${BLOCK} w-full items-center gap-4 ${dim}`}>
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium leading-snug text-ink">
            {label}
            {locked && <Lock size={12} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />}
            {tip && <InfoTip text={tip} />}
          </span>
          {prose && (
            <span
              className={`max-w-[70ch] text-[12.5px] leading-relaxed ${
                lockReason ? "text-accent" : "text-ink-subtle"
              }`}
            >
              {prose}
            </span>
          )}
          {warn && (
            <span className="flex max-w-[70ch] items-start gap-1.5 text-[12.5px] text-danger">
              <AlertTriangle size={14} strokeWidth={2.4} className="mt-[2px] shrink-0" />
              {warn}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-stretch gap-1.5 ${dim}`}>
      <div className={`${BLOCK} w-[268px] shrink-0`}>
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] font-medium leading-snug text-ink">
          {label}
          {locked && <Lock size={12} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />}
          {tip && <InfoTip text={tip} />}
        </span>
      </div>
      <div className={`${BLOCK} min-w-0 flex-1 flex-wrap justify-end gap-x-4 gap-y-3`}>
        {children}
      </div>
    </div>
  );
}

export function OptionScale<T extends string | number>({
  value,
  options,
  onChange,
  caption,
  format,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  caption?: string;
  format?: (v: T) => string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {caption && (
        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {caption}
        </span>
      )}
      <span className="flex min-w-0 items-center gap-0.5 rounded-md bg-canvas p-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            className={`h-7 min-w-[38px] rounded-[4px] px-2 text-[11.5px] font-semibold tabular-nums transition-colors ${
              o === value ? "bg-ink text-canvas" : "text-ink-subtle hover:text-ink"
            }`}
          >
            {format ? format(o) : String(o)}
          </button>
        ))}
      </span>
    </span>
  );
}

export function SettingGroup({ label, children }: { label?: string; children: ReactNode }) {
  if (!label) return <div className="flex flex-col gap-1.5">{children}</div>;
  return (
    <section
      id={settingsAnchor(label)}
      className="scroll-mt-28 mt-4 flex flex-col gap-1.5 first:mt-0"
    >
      <span className="px-1 pb-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </span>
      {children}
    </section>
  );
}

export function SettingsModal({
  open,
  onClose,
  title,
  sub,
  actions,
  width,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <SettingsModalBody onClose={onClose} title={title} sub={sub} actions={actions} width={width}>
      {children}
    </SettingsModalBody>
  );
}

function SettingsModalBody({
  onClose,
  title,
  sub,
  actions,
  width,
  children,
}: {
  onClose: () => void;
  title: string;
  sub?: string;
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const t = useT();
  const { closing, close } = useModalExit(onClose);
  return (
    <ModalShell closing={closing} onDismiss={close} width={width}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
          {sub && <p className="text-[12.5px] leading-relaxed text-ink-subtle">{sub}</p>}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("Close")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-6">{children}</div>
      {actions && <div className="flex items-center justify-end gap-2 px-6 pb-6">{actions}</div>}
    </ModalShell>
  );
}

export function ModalButton({
  onClick,
  ghost,
  children,
}: {
  onClick?: () => void;
  ghost?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`harbor-press-pop h-9 rounded-md px-4 text-[12.5px] font-semibold transition-colors ${
        ghost ? "bg-elevated text-ink-muted hover:text-ink" : "bg-ink text-canvas hover:opacity-90"
      }`}
    >
      {children}
    </button>
  );
}

export const ROW_ACTION =
  "harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50";

export const ROW_ACTION_PRIMARY =
  "harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40";

export const ROW_ACTION_DANGER =
  "harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-danger disabled:opacity-50";

export function Nested({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 ps-6">{children}</div>;
}
