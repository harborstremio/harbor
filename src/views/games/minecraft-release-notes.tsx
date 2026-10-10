import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { minecraftCatalogRequest, minecraftProjectUrl, minecraftReleaseNotes, type MinecraftProject, type MinecraftReleaseNotes, type MinecraftVersion } from "@/lib/games/minecraft-catalog";
import { MinecraftProjectLink } from "./minecraft-project-link";
import { MinecraftProjectProse } from "./minecraft-project-prose";
import { MinecraftVersionIdentity } from "./minecraft-project-versions";

function Notes({ project, version, ready }: { project: MinecraftProject; version: MinecraftVersion; ready: () => void }) {
  const t = useT(), [notes, setNotes] = useState<MinecraftReleaseNotes | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const onReady = useRef(ready); onReady.current = ready;
  useLayoutEffect(() => { if (notes) onReady.current(); }, [notes]);
  useEffect(() => {
    const controller = new AbortController(); setFailed(false); setNotes(null);
    void minecraftCatalogRequest({ kind: "version", query: version.id }, controller.signal, retry > 0)
      .then(raw => minecraftReleaseNotes(raw, project.id, version.id))
      .then(value => { if (!controller.signal.aborted) setNotes(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [project.id, version.id, retry]);
  return <>
    {failed ? <div className="mc-catalog-error" role="alert"><span>{t("games.minecraft.notes.error")}</span><button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div> : !notes ? <p className="mc-release-status" role="status">{t("common.loading")}</p> : notes.body.trim() ? <MinecraftProjectProse>{notes.body}</MinecraftProjectProse> : <p className="mc-release-status">{t("games.minecraft.notes.empty")}</p>}
    {notes?.truncated && <p className="mc-release-status">{t("games.minecraft.notes.truncated")}</p>}
    <div className="mc-notes-source"><MinecraftProjectLink url={minecraftProjectUrl(project, version.id)}>{t("games.minecraft.notes.source")}</MinecraftProjectLink></div>
  </>;
}

export function MinecraftReleaseNotesView({ project, versions, selected, choose, loading, error, retry, showVersions, ready }: { project: MinecraftProject; versions: MinecraftVersion[] | null; selected: MinecraftVersion | null; choose: (id: string) => void; loading: boolean; error: string; retry: () => void; showVersions: () => void; ready: () => void }) {
  const t = useT();
  return <section className="mc-release-notes" aria-label={t("games.minecraft.notes.title")}>
    <div className="mc-notes-toolbar"><h3>{t("games.minecraft.notes.version")}</h3>{!loading && !error && selected && <Dropdown className="mc-notes-selector" ariaLabel={t("games.minecraft.notes.version")} value={selected.id} onChange={choose} options={(versions ?? []).map(v => ({ value: v.id, label: [v.number, v.loaders.join(" / "), v.games.slice(0, 2).join(", ") + (v.games.length > 2 ? "…" : "")].filter(Boolean).join(" · ") }))}/>}</div>
    {error ? <div className="mc-catalog-error" role="alert"><span>{t(error)}</span><button className="games-button" onClick={retry}>{t("common.retry")}</button></div> : loading ? <p className="mc-release-status" role="status">{t("common.loading")}</p> : selected ? <><div className="mc-notes-version"><div><MinecraftVersionIdentity version={selected} showChannel /></div>{selected.date && Number.isFinite(Date.parse(selected.date)) && <time dateTime={selected.date}>{new Date(selected.date).toLocaleDateString(document.documentElement.lang || "en")}</time>}</div><Notes key={`${project.id}:${selected.id}`} project={project} version={selected} ready={ready}/></> : <p className="mc-release-status">{t("games.minecraft.catalog.noVersion")}</p>}
    <button className="games-button mc-notes-versions" onClick={showVersions}>{t("games.minecraft.notes.filter")}</button>
  </section>;
}
