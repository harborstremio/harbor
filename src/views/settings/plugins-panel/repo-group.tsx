import { PackageOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "../icons";
import { AddonLogo } from "@/components/addon-logo";
import { relativeTime } from "@/lib/dates";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { EntryView, KindAdapter, RepoView } from "@/lib/plugins";
import { Nested, SettingGroup, SettingRow } from "../kit";
import { RowControl, RowDesc, RowNote, RowText, RowTitle } from "../shared";
import { SButton } from "../ui";
import { BARE_ICON, Chip, languageNames } from "./bits";
import { errorText, kindLabel } from "./copy";

function foreignText(t: (k: string) => string, kind: RepoView["foreign"]): string {
  if (kind === "tachiyomi") {
    return t(
      "This is a Tachiyomi / Mihon repo. Those are Android (APK) extensions, so Harbor can't run them directly. To use these sources on desktop, run a Suwayomi server and connect Harbor to it from the Servers section.",
    );
  }
  if (kind === "paperback") {
    return t(
      "This is a Paperback (iOS) repo, which Harbor can't use. For desktop sources, connect a Suwayomi server from the Servers section.",
    );
  }
  return t(
    "This does not look like a plugin repository. Harbor reads its own plugin manifests, provider-script manifests and Android extension repositories.",
  );
}

type Confirm = "remove" | "remove-all" | null;

export function RepoGroup({ repo, adapter }: { repo: RepoView; adapter: KindAdapter }) {
  const t = useT();
  const uiLang = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const confirmTimer = useRef<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErrors((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
    try {
      await fn();
    } catch (e) {
      setErrors((cur) => ({ ...cur, [key]: errorText(t, e) }));
    } finally {
      setBusy(null);
    }
  };

  const arm = (what: Exclude<Confirm, null>, action: () => void) => {
    if (confirm !== what) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirm(what);
      confirmTimer.current = window.setTimeout(() => setConfirm(null), 3000);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirm(null);
    action();
  };

  const pending = repo.entries.filter((e) => !e.installed && !e.repoDisabled);
  const installed = repo.entries.filter((e) => e.installed && e.installedId);
  const updatable = repo.entries.filter((e) => e.updateAvailable && e.installedId);

  const installAll = () =>
    run("install-all", async () => {
      setProgress({ done: 0, total: pending.length });
      try {
        if (adapter.installAll) {
          await adapter.installAll(repo.url, (done, total) => setProgress({ done, total }));
          return;
        }
        let done = 0;
        let installed = 0;
        let failure: unknown = null;
        for (const e of pending) {
          try {
            await adapter.install(repo.url, e.id);
            installed += 1;
          } catch (e2) {
            failure ??= e2;
          }
          done += 1;
          setProgress({ done, total: pending.length });
        }
        // One bad entry shows on its own row, but a run where nothing landed needs to say why.
        if (!installed && failure) throw failure;
      } finally {
        setProgress(null);
      }
    });

  const updateAll = () =>
    run("update-all", async () => {
      for (const e of updatable) await adapter.update!(e.installedId!);
    });

  const removeAll = () =>
    run("remove-all", async () => {
      for (const e of installed) await adapter.uninstall(e.installedId!);
    });

  const headerDesc =
    repo.updates > 0
      ? t("{count} updates available", { count: repo.updates })
      : `${repo.host}${repo.checkedAt ? ` · ${t("checked {when}", { when: relativeTime(repo.checkedAt) })}` : ""}`;
  const warn = repo.error
    ? t("Could not reach this repository. Installed plugins keep working.")
    : (errors.remove ?? errors.refresh ?? errors["install-all"] ?? errors["update-all"] ?? errors["remove-all"]);

  return (
    <SettingGroup>
      <div className="hset-row" data-settings-row>
        <RowText lead={<PackageOpen size={18} strokeWidth={2} />} onClick={() => setOpen((v) => !v)} expanded={open}>
          <RowTitle>
            <span className="min-w-0">{repo.name}</span>
            <Chip>{kindLabel(t, repo.kind)}</Chip>
            {repo.format === "provider-script" && <Chip>{t("Script")}</Chip>}
            {repo.format === "android-extension" && <Chip>{t("Android")}</Chip>}
            {repo.entries.length > 0 && <Chip>{t("{count} plugins", { count: repo.entries.length })}</Chip>}
            {repo.installedCount > 0 && (
              <Chip accent>{t("{count} installed", { count: repo.installedCount })}</Chip>
            )}
          </RowTitle>
          <RowDesc accent={repo.updates > 0}>{progress ? t("Installing {done} of {total}", progress) : headerDesc}</RowDesc>
          {warn && <RowNote>{warn}</RowNote>}
        </RowText>
        <RowControl>
          {updatable.length > 0 && adapter.update && (
            <SButton variant="primary" disabled={!!busy} onClick={() => void updateAll()}>
              {busy === "update-all" ? <Loader2 size={16} className="animate-spin" /> : t("Update all")}
            </SButton>
          )}
          {pending.length > 0 && !repo.foreign && (
            <SButton variant="primary" disabled={!!busy} onClick={() => void installAll()}>
              {busy === "install-all" ? <Loader2 size={16} className="animate-spin" /> : t("Install all")}
            </SButton>
          )}
          {installed.length > 0 && (
            <SButton
              variant="danger"
              disabled={!!busy}
              onClick={() => arm("remove-all", () => void removeAll())}
            >
              {busy === "remove-all" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : confirm === "remove-all" ? (
                t("Remove and uninstall {count}?", { count: installed.length })
              ) : (
                t("Remove all")
              )}
            </SButton>
          )}
          <button
            type="button"
            className={`${BARE_ICON} text-ink-subtle hover:text-ink`}
            aria-label={repo.error ? t("Retry") : t("Refresh")}
            title={repo.error ? t("Retry") : t("Refresh")}
            disabled={!!busy}
            onClick={() => void run("refresh", () => adapter.refreshRepo(repo.url))}
          >
            <RefreshCw
              size={19}
              className={busy === "refresh" || repo.loading ? "animate-spin" : undefined}
            />
          </button>
          <button
            type="button"
            className={`${BARE_ICON} ${confirm === "remove" ? "scale-110 text-danger" : "text-danger/75 hover:text-danger"}`}
            aria-label={confirm === "remove" ? t("Remove and uninstall {count}?", { count: repo.installedCount }) : t("Remove")}
            title={confirm === "remove" ? t("Remove and uninstall {count}?", { count: repo.installedCount }) : t("Remove")}
            disabled={!!busy && busy !== "remove"}
            onClick={() => arm("remove", () => void run("remove", () => adapter.removeRepo(repo.url)))}
          >
            {busy === "remove" ? <Loader2 size={19} className="animate-spin" /> : <Trash2 size={19} />}
          </button>
        </RowControl>
      </div>

      {open && (
        <Nested>
          {repo.foreign && <SettingRow label={repo.host} desc={foreignText(t, repo.foreign)} />}

          {repo.loading && repo.entries.length === 0 && !repo.foreign && (
            <SettingRow icon={<Loader2 size={18} className="animate-spin" />} label={t("Loading plugins...")} />
          )}

          {!repo.loading && !repo.error && !repo.foreign && repo.entries.length === 0 && (
            <SettingRow label={t("This repository lists no plugins.")} />
          )}

          {repo.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              repo={repo}
              adapter={adapter}
              busy={busy}
              error={errors[entry.id]}
              uiLang={uiLang}
              run={run}
            />
          ))}
        </Nested>
      )}
    </SettingGroup>
  );
}

function EntryRow({
  entry,
  repo,
  adapter,
  busy,
  error,
  uiLang,
  run,
}: {
  entry: EntryView;
  repo: RepoView;
  adapter: KindAdapter;
  busy: string | null;
  error: string | undefined;
  uiLang: string;
  run: (key: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const desc = [entry.description, entry.note, languageNames(entry.lang, uiLang, t("All languages"))]
    .filter(Boolean)
    .join(" · ");
  const working = busy === entry.id;
  return (
    <SettingRow
      icon={<AddonLogo addonId={entry.id} addonName={entry.name} manifestLogo={entry.icon} size="md" />}
      label={
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{entry.name}</span>
          <Chip>v{entry.version}</Chip>
          {entry.installed && <Chip accent>{t("Installed")}</Chip>}
          {entry.nsfw && <Chip>18+</Chip>}
        </span>
      }
      desc={desc || undefined}
      lockReason={entry.repoDisabled ? t("Turned off by its repository.") : undefined}
      warn={error}
    >
      {entry.installed ? (
        <>
          {entry.updateAvailable && entry.installedId && adapter.update && (
            <SButton
              variant="primary"
              disabled={!!busy}
              onClick={() => void run(entry.id, () => adapter.update!(entry.installedId!))}
            >
              {working ? <Loader2 size={16} className="animate-spin" /> : t("Update")}
            </SButton>
          )}
          {entry.installedId && (
            <button
              type="button"
              className={`${BARE_ICON} text-danger/75 hover:text-danger`}
              aria-label={t("Remove")}
              title={t("Remove")}
              disabled={!!busy}
              onClick={() => void run(entry.id, () => adapter.uninstall(entry.installedId!))}
            >
              {working ? <Loader2 size={19} className="animate-spin" /> : <Trash2 size={19} />}
            </button>
          )}
        </>
      ) : (
        <SButton
          variant="primary"
          disabled={!!busy || entry.repoDisabled}
          onClick={() => void run(entry.id, () => adapter.install(repo.url, entry.id))}
        >
          {working ? <Loader2 size={16} className="animate-spin" /> : t("Install")}
        </SButton>
      )}
    </SettingRow>
  );
}
