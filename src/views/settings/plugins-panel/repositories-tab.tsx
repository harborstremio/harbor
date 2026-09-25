import { useState } from "react";
import { Link2, Loader2, Package } from "../icons";
import { useT } from "@/lib/i18n";
import { addRepoAnyKind, pluginKinds, usePluginKindsVersion, type RepoView } from "@/lib/plugins";
import { useSettings } from "@/lib/settings";
import { splitRepoLinks } from "@/lib/streams/plugins";
import { ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { Section, ToggleRow } from "../shared";
import { errorText } from "./copy";
import { RepoGroup } from "./repo-group";

export function RepositoriesTab() {
  const t = useT();
  const { settings, update } = useSettings();
  usePluginKindsVersion();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const add = async () => {
    const links = splitRepoLinks(link);
    if (!links.length || busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    let last: RepoView | null = null;
    let lastError: string | null = null;
    for (const l of links) {
      try {
        last = await addRepoAnyKind(l);
      } catch (e) {
        lastError = errorText(t, e);
      }
    }
    setBusy(false);
    if (last) {
      setLink("");
      setAdded(t("Added {repo} with {count} providers.", { repo: last.name, count: last.entries.length }));
      window.setTimeout(() => setAdded(null), 5000);
    }
    if (lastError) setError(lastError);
  };

  const repos = pluginKinds().flatMap((adapter) => adapter.repos().map((repo) => ({ repo, adapter })));

  return (
    <>
      <Section
        title={t("Add a repository")}
        subtitle={t(
          "Paste the manifest link of a repository you trust. Harbor reads its own plugin repositories, provider-script repositories and Android extension repositories as they are, and installs nothing until you choose to.",
        )}
      >
        <SettingRow
          wide
          icon={<Link2 size={18} strokeWidth={2} />}
          label={t("Repository link")}
          desc={
            added ?? t("Any GitHub link works, raw or not. Harbor adds /manifest.json when it is missing. Paste several to add them all.")
          }
          warn={error ?? undefined}
        >
          <div className="flex w-full min-w-0 gap-2.5">
            <div className="hset-field min-w-0 flex-1" dir="ltr">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void add();
                  }
                }}
                onPaste={() => window.setTimeout(() => setLink((v) => v.trim()), 0)}
                placeholder="https://github.com/user/repo"
                inputMode="url"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-[15px]"
              />
            </div>
            <button
              type="button"
              className={ROW_ACTION_PRIMARY}
              disabled={busy || !link.trim()}
              onClick={() => void add()}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("Checking…")}
                </>
              ) : (
                t("Add")
              )}
            </button>
          </div>
        </SettingRow>
      </Section>

      <Section title={t("Your repositories")}>
        {repos.length === 0 ? (
          <SettingRow
            icon={<Package size={18} strokeWidth={2} />}
            label={t("No repositories yet")}
            desc={t("Add one above. Nothing installs until you pick a plugin.")}
          />
        ) : (
          repos.map(({ repo, adapter }) => (
            <RepoGroup key={`${repo.kind}|${repo.url}`} repo={repo} adapter={adapter} />
          ))
        )}
      </Section>

      <Section title={t("Checking for updates")}>
        <ToggleRow
          label={t("Check repositories daily")}
          sub={t(
            "Once a day, look for newer versions and show an Update button here. Harbor never installs an update by itself.",
          )}
          value={settings.pluginsAutoCheck}
          onChange={(v) => update({ pluginsAutoCheck: v })}
        />
      </Section>
    </>
  );
}
