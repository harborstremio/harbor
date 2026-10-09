import { useState } from "react";
import { Loader2, Puzzle, RefreshCw } from "../icons";
import { useT } from "@/lib/i18n";
import { pluginKinds, usePluginKindsVersion, type KindAdapter, type PluginKind, type PluginView } from "@/lib/plugins";
import { useSettings } from "@/lib/settings";
import { SettingGroup, SettingRow } from "../kit";
import { Section, ToggleRow } from "../shared";
import { SButton } from "../ui";
import { kindLabel } from "./copy";
import { PluginRow } from "./plugin-row";

type Group = { key: string; repoName: string; kind: PluginKind; adapter: KindAdapter; plugins: PluginView[] };

function groupByRepo(): Group[] {
  const map = new Map<string, Group>();
  for (const adapter of pluginKinds()) {
    for (const p of adapter.plugins()) {
      const key = `${adapter.kind}|${p.repoUrl}`;
      const g = map.get(key) ?? { key, repoName: p.repoName, kind: adapter.kind, adapter, plugins: [] };
      g.plugins.push(p);
      map.set(key, g);
    }
  }
  return [...map.values()];
}

export function InstalledTab({ onAddRepository }: { onAddRepository: () => void }) {
  const t = useT();
  const { settings, update } = useSettings();
  usePluginKindsVersion();
  const groups = groupByRepo();
  const waitSeconds = Math.max(8, Math.min(120, settings.addonTimeoutSec ?? 30));
  const [refreshing, setRefreshing] = useState(false);
  // Only a plugin Harbor stood down has anything to gain from a run: one that answers comes back,
  // and the rest are already asked when Play is pressed. Nothing is offered while every plugin is
  // paused, because then there is nothing to try.
  const stoodDown = groups.flatMap((g) =>
    g.plugins
      .filter((p) => p.state === "auto-paused")
      .map((p) => ({ plugin: p, adapter: g.adapter })),
  );

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const waitMs = waitSeconds * 1000;
      // The same run a row's Try again makes, one per plugin. They go together: the gate holds the
      // whole of it to its own limit, so this costs the runtime what a search would.
      await Promise.allSettled(
        stoodDown.map(({ plugin, adapter }) => adapter.check?.(plugin.id, waitMs)),
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Section
        title={t("Use plugins")}
        subtitle={t(
          "Plugins look for streams on sites Harbor does not know about. Everything here was installed by you, from repositories you chose.",
        )}
        newId="plugins:use-plugins"
      >
        <ToggleRow
          label={t("Use plugins")}
          sub={t(
            "Pause or resume every plugin at once, without removing anything. The switch below decides where they are asked.",
          )}
          value={settings.pluginsEnabled}
          onChange={(v) => update({ pluginsEnabled: v })}
          newId="plugins:use-plugins"
        />
        <ToggleRow
          label={t("Use plugins outside the Plugins page")}
          sub={t(
            "Let Android extensions, which stand up rows of their own, be asked from Home, Discover, Catalogs, search and the Play button too. A plugin with no rows of its own has nowhere else to be found, so it is asked either way.",
          )}
          value={settings.pluginsOutsideTab}
          onChange={(v) => update({ pluginsOutsideTab: v })}
          newId="plugins:outside-tab"
        />
        <ToggleRow
          label={t("Group by repository")}
          sub={t(
            "Show one source per repository in the picker instead of one per plugin. Useful when a repository ships many small providers.",
          )}
          value={settings.pluginsGroupByRepo}
          onChange={(v) => update({ pluginsGroupByRepo: v })}
        />
        <ToggleRow
          label={t("Also use plugins for background checks")}
          sub={t(
            "Let auto-download and the next-episode prefetch ask plugins too. Off keeps plugins out of background work.",
          )}
          value={settings.pluginsBackground}
          onChange={(v) => update({ pluginsBackground: v })}
        />
        <ToggleRow
          label={t("Show languages on plugin posters")}
          sub={t(
            "Some plugins name a listing after everything it carries, so its languages are in the title. Harbor reads them back out and badges the poster. Shown only when the plugin provides it.",
          )}
          value={settings.pluginsPosterLanguages}
          onChange={(v) => update({ pluginsPosterLanguages: v })}
          newId="plugins:poster-languages"
        />
        <ToggleRow
          label={t("Show quality on plugin posters")}
          sub={t(
            "Badge the resolutions a plugin's listing names, best first, and count the rest. Shown only when the plugin provides it.",
          )}
          value={settings.pluginsPosterQuality}
          onChange={(v) => update({ pluginsPosterQuality: v })}
          newId="plugins:poster-quality"
        />
        <SettingRow
          label={t("Wait time")}
          desc={t(
            "Plugins share the addon wait time, {n} seconds unless you changed it under Streaming sources.",
            { n: waitSeconds },
          )}
        />
      </Section>

      <Section
        title={t("Installed plugins")}
        subtitle={
          settings.pluginsEnabled ? undefined : t("Plugins are paused. Turn on Use plugins above to run them.")
        }
      >
        {stoodDown.length > 0 && settings.pluginsEnabled && (
          <SettingRow
            icon={<RefreshCw size={18} strokeWidth={2} />}
            label={t("Refresh all")}
            desc={t(
              "Runs every plugin Harbor stood down. One that answers comes back; the others stay paused.",
            )}
          >
            <SButton disabled={refreshing} onClick={() => void refreshAll()}>
              {refreshing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("Checking…")}
                </>
              ) : (
                t("Refresh all")
              )}
            </SButton>
          </SettingRow>
        )}
        {groups.length === 0 ? (
          <SettingRow
            icon={<Puzzle size={18} strokeWidth={2} />}
            label={t("Nothing installed yet")}
            desc={t("Add a repository, then install the providers you want. They show up here.")}
          >
            <SButton onClick={onAddRepository}>{t("Add a repository")}</SButton>
          </SettingRow>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="harbor-settings-section flex flex-col gap-[11px]">
              <h2 className="harbor-settings-label">{`${g.repoName} · ${kindLabel(t, g.kind)}`}</h2>
              <SettingGroup>
                {g.plugins.map((p) => (
                  <PluginRow
                    key={p.id}
                    plugin={p}
                    adapter={g.adapter}
                    masterOff={g.kind === "stream" && !settings.pluginsEnabled}
                  />
                ))}
              </SettingGroup>
            </section>
          ))
        )}
      </Section>
    </>
  );
}
