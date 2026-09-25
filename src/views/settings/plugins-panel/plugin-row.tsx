import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Settings2, Trash2 } from "../icons";
import { AddonLogo } from "@/components/addon-logo";
import { relativeTime } from "@/lib/dates";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { CheckResult, KindAdapter, PluginView } from "@/lib/plugins";
import { Nested, ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { RowControl, RowDesc, RowNote, RowText, RowTitle } from "../shared";
import { SButton, SRow } from "../ui";
import { BARE_ICON, Chip, Switch, languageNames } from "./bits";
import { errorText, healthErrorText, stateCopy } from "./copy";
import { PluginSettingsModal } from "./plugin-settings-modal";

type Busy = "toggle" | "update" | "revert" | "remove" | "check" | null;

export function PluginRow({
  plugin,
  adapter,
  masterOff,
}: {
  plugin: PluginView;
  adapter: KindAdapter;
  masterOff: boolean;
}) {
  const t = useT();
  const uiLang = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const confirmTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const copy = stateCopy(t, plugin);
  const locked = !!copy.lock;
  const sub = [
    `v${plugin.version}`,
    plugin.kind === "stream" && plugin.types.length >= 2 ? t("Movies and series") : null,
    languageNames(plugin.lang, uiLang, t("All languages")),
    plugin.author,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = async (kind: Busy, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      confirmTimer.current = window.setTimeout(() => setConfirmRemove(false), 3000);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmRemove(false);
    void run("remove", () => adapter.uninstall(plugin.id));
  };

  const health = adapter.health?.(plugin.id) ?? null;
  const log = adapter.log?.(plugin.id) ?? [];
  const activity = health?.lastError
    ? healthErrorText(t, health.lastError)
    : health?.lastSkip
      ? t("Skipped: {reason}", { reason: health.lastSkip })
      : health?.lastCount != null && health.lastTitle
      ? health.lastCount > 0
        ? t("Found {count} streams for {title} in {seconds}s", {
            count: health.lastCount,
            title: health.lastTitle,
            seconds: ((health.lastMs ?? 0) / 1000).toFixed(1),
          })
        : t("No streams for {title}", { title: health.lastTitle })
      : t("Nothing yet. Kept on this computer only.");

  const checkText = check
    ? check.error
      ? t("Failed: {error}", { error: check.error })
      : check.count > 0
        ? `${t("Found {count} streams in {seconds}s.", { count: check.count, seconds: (check.ms / 1000).toFixed(1) })} ${t("{requests} requests", { requests: check.requests })}`
        : t("No streams came back.")
    : t("Runs this plugin on a real title and shows what came back.");

  const filesDesc = plugin.installedAt
    ? t("v{version} from {repo}, installed {when}.", {
        version: plugin.version,
        repo: plugin.repoName,
        when: relativeTime(plugin.installedAt),
      })
    : plugin.repoName;

  return (
    <>
      <div className={`hset-row ${locked ? "opacity-60" : ""}`} data-settings-row>
        <RowText
          lead={<AddonLogo addonId={plugin.id} addonName={plugin.name} manifestLogo={plugin.icon} size="lg" />}
          onClick={() => setOpen((v) => !v)}
          expanded={open}
        >
          <RowTitle>
            <span className="min-w-0">{plugin.name}</span>
            {plugin.nsfw && <Chip>18+</Chip>}
            {plugin.format === "provider-script" && <Chip>{t("Script")}</Chip>}
            {plugin.format === "android-extension" && <Chip>{t("Android")}</Chip>}
            {plugin.verified && <Chip accent>{t("Verified")}</Chip>}
          </RowTitle>
          <RowDesc accent={!!copy.lock}>{copy.lock ?? sub}</RowDesc>
          {copy.desc && <RowDesc accent>{copy.desc}</RowDesc>}
          {masterOff && !locked && <RowDesc>{t("Plugins are paused. Turn on Use plugins above to run them.")}</RowDesc>}
          {(error ?? copy.warn) && <RowNote>{error ?? copy.warn}</RowNote>}
        </RowText>
        <RowControl>
          {plugin.hasSettings && adapter.settingsFields && (
            <button
              type="button"
              className={`${BARE_ICON} text-ink-subtle hover:text-ink`}
              aria-label={t("Settings")}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={19} />
            </button>
          )}
          <button
            type="button"
            className={`${BARE_ICON} ${confirmRemove ? "scale-110 text-danger" : "text-danger/75 hover:text-danger"}`}
            aria-label={confirmRemove ? t("Remove and uninstall {count}?", { count: 1 }) : t("Remove")}
            title={confirmRemove ? t("Remove and uninstall {count}?", { count: 1 }) : t("Remove")}
            disabled={busy === "remove"}
            onClick={remove}
          >
            {busy === "remove" ? <Loader2 size={19} className="animate-spin" /> : <Trash2 size={19} />}
          </button>
          <Switch
            value={plugin.enabled}
            locked={locked}
            label={plugin.name}
            onChange={(v) => void run("toggle", () => adapter.setEnabled(plugin.id, v))}
          />
        </RowControl>
      </div>

      {open && (
        <Nested>
          <SettingRow label={t("Plugin files")} desc={filesDesc}>
            {plugin.updateVersion && adapter.update && (
              <button
                type="button"
                className={ROW_ACTION_PRIMARY}
                disabled={!!busy}
                onClick={() => void run("update", () => adapter.update!(plugin.id))}
              >
                {busy === "update" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {t("Update to v{version}", { version: plugin.updateVersion })}
              </button>
            )}
            {plugin.canRevert && plugin.previousVersion && adapter.revert && (
              <SButton disabled={!!busy} onClick={() => void run("revert", () => adapter.revert!(plugin.id))}>
                {t("Revert to v{version}", { version: plugin.previousVersion })}
              </SButton>
            )}
            {plugin.hasSettings && adapter.settingsFields && (
              <SButton onClick={() => setSettingsOpen(true)}>{t("Settings")}</SButton>
            )}
          </SettingRow>

          {plugin.kind === "stream" && (
            <SettingRow
              label={t("Reaches")}
              desc={
                <>
                  {plugin.hosts.length > 0
                    ? plugin.hosts.join(", ")
                    : t("Any public website. This plugin did not say which sites it uses.")}
                  {plugin.learnedHosts.length > 0 && (
                    <>
                      <br />
                      {t("Seen so far: {hosts}", { hosts: plugin.learnedHosts.join(", ") })}
                    </>
                  )}
                </>
              }
            />
          )}

          {adapter.log && plugin.kind === "stream" && (
            <>
              <SRow
                title={t("Recent activity")}
                description={activity}
                onClick={() => setLogOpen((v) => !v)}
                selected={logOpen}
              />
              {logOpen && (
                <pre
                  dir="ltr"
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[10px] bg-elevated px-4 py-3 font-mono text-[12.5px] leading-[18px] text-ink-muted"
                >
                  {log.length === 0
                    ? t("Nothing yet. Kept on this computer only.")
                    : log.map((l) => `${new Date(l.at).toLocaleTimeString()} ${l.level} ${l.text}`).join("\n")}
                </pre>
              )}
            </>
          )}

          {plugin.checkable && adapter.check && (
            <SettingRow label={t("Check it works")} desc={checkText}>
              <SButton
                disabled={busy === "check"}
                onClick={() =>
                  void run("check", async () => {
                    setCheck(await adapter.check!(plugin.id));
                  })
                }
              >
                {busy === "check" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("Checking…")}
                  </>
                ) : (
                  t("Check it works")
                )}
              </SButton>
            </SettingRow>
          )}
        </Nested>
      )}

      {settingsOpen && (
        <PluginSettingsModal plugin={plugin} adapter={adapter} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
