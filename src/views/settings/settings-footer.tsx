import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY } from "./kit";
import type { PageActionReg } from "./page-actions";

export function SettingsFooter({ reg }: { reg: NonNullable<PageActionReg> }) {
  const t = useT();
  const leading = reg.actions.filter((a) => a.tone === "danger");
  const trailing = reg.actions.filter((a) => a.tone !== "danger");
  const cls = (tone?: string) =>
    tone === "primary" ? ROW_ACTION_PRIMARY : tone === "danger" ? ROW_ACTION_DANGER : ROW_ACTION;

  return (
    <div className="hset-footer">
      {leading.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onSelect}
          disabled={a.disabled}
          className={cls(a.tone)}
        >
          {a.icon}
          {t(a.label)}
        </button>
      ))}
      {reg.note && (
        <span className="hset-footer-note min-w-0 truncate text-[15.5px] text-ink-subtle">
          {t(reg.note)}
        </span>
      )}
      <span className="hset-footer-spacer" />
      {trailing.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onSelect}
          disabled={a.disabled}
          className={cls(a.tone)}
        >
          {a.icon}
          {t(a.label)}
        </button>
      ))}
    </div>
  );
}
