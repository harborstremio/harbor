import { Lock, X } from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import { useEffect, useRef, type ReactNode } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { useT } from "@/lib/i18n";
import {
  ROW_DESC,
  ROW_TITLE,
  RowControl,
  RowDesc,
  RowNote,
  RowText,
  RowTitle,
  settingsAnchor,
  stripArrowKeys,
  useGroupHeadingVisible,
  useRegisterRowTitle,
} from "./shared";

export { ROW_DESC, ROW_TITLE };

const CTL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const CTL_BASE = `harbor-press-pop flex h-11 shrink-0 items-center gap-2 rounded-[8px] border px-4 text-[15px] font-semibold ${CTL_FOCUS}`;

export function InfoTip({ text, sub }: { text: string; sub?: string }) {
  return (
    <HoverTooltip label={text} sublabel={sub} side="top" align="start">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:text-ink">
        <UiIcon name="help" className="h-4 w-4" />
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
  useRegisterRowTitle(label);

  return (
    <div
      className={`hset-row ${locked ? "opacity-60" : ""}`}
      data-span={wide ? "" : undefined}
    >
      <RowText lead={icon}>
        <RowTitle>
          <span className="min-w-0">{label}</span>
          {locked && <Lock size={14} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />}
          {tip && <InfoTip text={tip} />}
        </RowTitle>
        {prose && <RowDesc accent={!desc && locked}>{prose}</RowDesc>}
        {warn && <RowNote>{warn}</RowNote>}
      </RowText>
      {children && (
        <RowControl span={wide}>
          {wide ? <div className="w-full min-w-0">{children}</div> : children}
        </RowControl>
      )}
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
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2.5">
      {caption && (
        <span className="harbor-settings-label shrink-0">
          {caption}
        </span>
      )}
      <span
        onKeyDown={stripArrowKeys(btnRefs, (i) => onChange(options[i]))}
        className="flex min-w-0 items-center gap-0.5 rounded-[10px] bg-canvas p-1"
      >
        {options.map((o, i) => (
          <button
            key={String(o)}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`h-11 min-w-[48px] rounded-[6px] px-3 text-[15px] font-semibold tabular-nums transition-colors ${
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
  const showHeading = useGroupHeadingVisible(label);
  if (!label) return <div className="harbor-settings-group">{children}</div>;
  return (
    <section
      id={settingsAnchor(label)}
      className="harbor-settings-section scroll-mt-[72px] flex flex-col gap-[11px]"
    >
      {showHeading && <h2 className="harbor-settings-label">{label}</h2>}
      <div className="harbor-settings-group">{children}</div>
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
  useEffect(() => captureFocusReturn(), []);
  return (
    <ModalShell closing={closing} onDismiss={close} width={width}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="text-[19px] font-semibold leading-[26px] tracking-tight text-ink">
            {title}
          </h2>
          {sub && <p className={`max-w-[66ch] ${ROW_DESC}`}>{sub}</p>}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("Close")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">{children}</div>
      {actions && (
        <div className="flex items-center justify-end gap-2.5 px-6 pb-6">{actions}</div>
      )}
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
    <button type="button" onClick={onClick} className={ghost ? ROW_ACTION : ROW_ACTION_PRIMARY}>
      {children}
    </button>
  );
}

export const ROW_ACTION = `${CTL_BASE} border-edge-soft bg-elevated text-ink-muted transition-colors hover:border-edge hover:bg-raised hover:text-ink disabled:cursor-default disabled:opacity-45`;

export const ROW_ACTION_PRIMARY = `${CTL_BASE} border-transparent bg-ink text-canvas transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40`;

export const ROW_ACTION_DANGER = `${CTL_BASE} border-edge-soft bg-elevated text-ink-subtle transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-default disabled:opacity-45`;

export function Nested({ children }: { children: ReactNode }) {
  return <div className="harbor-settings-group ps-4">{children}</div>;
}
