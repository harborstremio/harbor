import { Puzzle } from "../icons";
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
            "Ask every enabled plugin for streams when you press Play. Turn this off to pause them all without removing anything.",
          )}
          value={settings.pluginsEnabled}
          onChange={(v) => update({ pluginsEnabled: v })}
          newId="plugins:use-plugins"
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
            "Let auto-download and the next-episode prefetch ask plugins too. Off keeps plugins to the moment you press Play.",
          )}
          value={settings.pluginsBackground}
          onChange={(v) => update({ pluginsBackground: v })}
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
