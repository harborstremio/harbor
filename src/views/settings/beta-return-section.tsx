import { useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { readBetaReturnContext } from "@/lib/updater/beta-return";
import { isWindowsDesktop } from "@/lib/platform";
import {
  clearStagedUpdate,
  downloadUpdate,
  installUpdate,
  prepareBetaReturn,
  updateChannelLocked,
  useUpdate,
} from "@/lib/updater/use-update";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "./kit";

const FOCUS =
  " focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function BetaReturnSection() {
  const t = useT();
  const u = useUpdate();
  const [expanded, setExpanded] = useState(false);
  const [choice, setChoice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const context = readBetaReturnContext(__APP_VERSION__);
  const active = u.intent === "return-beta";
  const busy = updateChannelLocked() || u.status === "checking";
  const supported = isWindowsDesktop();
  const selected = active ? context?.targets.find((target) => target.version === u.version) : null;

  function cancel() {
    if (busy) return;
    if (active) clearStagedUpdate();
    setExpanded(false);
    trigger.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-edge pt-3">
      <div>
        <button
          ref={trigger}
          type="button"
          disabled={busy}
          aria-expanded={expanded}
          aria-controls={id}
          className={ROW_ACTION + FOCUS}
          onClick={() => (expanded ? cancel() : setExpanded(true))}
        >
          {t("Return to beta")}
        </button>
      </div>
      <div id={id} hidden={!expanded}>
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {t(
              "Replace this experimental installation with a tested beta. Compatible settings and watch progress stay in place. Beta updates resume after a successful restart.",
            )}
          </p>
          {!supported || !context ? (
            <p className="text-[12.5px] text-ink-muted">
              {supported
                ? t("No tested return to beta is available for this build.")
                : t("Automatic return to beta is not available for this platform yet.")}
            </p>
          ) : (
            <>
              <label htmlFor={`${id}-version`} className="text-[12.5px] text-ink">
                {t("Beta version")}
              </label>
              <select
                id={`${id}-version`}
                value={choice}
                disabled={busy}
                onChange={(event) => {
                  setChoice(event.target.value);
                  if (active) clearStagedUpdate();
                }}
                className="min-h-10 max-w-full rounded-md border border-edge bg-elevated px-3 text-[13px] text-ink"
              >
                <option value="">{t("Choose a tested beta")}</option>
                {context.targets.map((target) => (
                  <option key={target.version} value={target.version}>
                    {t("Beta {version}", { version: target.version })}
                  </option>
                ))}
              </select>
              <p className="text-[12px] leading-relaxed text-ink-subtle">
                {t(
                  "Harbor saves a local recovery backup before installing. It can contain account details. Old backups are not restored automatically, and recovery files use extra disk space.",
                )}
              </p>
              {selected && u.status === "downloaded" && (
                <p className="text-[12.5px] text-ink">
                  {t(
                    "Install beta {version} and restart? This replaces the experimental app, not your current settings.",
                    { version: selected.version },
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {selected && u.status === "downloaded" ? (
                  <button
                    type="button"
                    onClick={() => void installUpdate()}
                    className={ROW_ACTION_PRIMARY + FOCUS}
                  >
                    {t("Install beta {version} and restart", { version: selected.version })}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !choice}
                    onClick={() => {
                      void (async () => {
                        await prepareBetaReturn(choice);
                        await downloadUpdate();
                      })();
                    }}
                    className={ROW_ACTION_PRIMARY + FOCUS}
                  >
                    {t("Download and verify beta")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancel}
                  className={ROW_ACTION + FOCUS}
                >
                  {t("Cancel")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p role="status" className="text-[12.5px] leading-relaxed text-ink-muted">
        {active
          ? (u.error ??
            (u.status === "downloading"
              ? t("Downloading beta: {pct}%", { pct: Math.round(u.progress * 100) })
              : u.status === "installing"
                ? t("Saving recovery files and installing beta…")
                : u.status === "downloaded"
                  ? t("Beta download verified. Ready to install.")
                  : u.status === "checking"
                    ? t("Checking the selected beta…")
                    : ""))
          : ""}
      </p>
    </div>
  );
}
