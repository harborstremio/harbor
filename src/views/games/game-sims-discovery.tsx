import type { SimsMtsProject } from "@/lib/games/sims";
import { useT, useUiLanguage } from "@/lib/i18n";
import { modCategory } from "@/lib/games/mod-workspace";
import { simsDescriptionPreview } from "@/lib/games/sims-description";
import { SimsMtsArt } from "./game-sims-mts-art";
import { ModStats } from "./mod-stats";
import { ModProviderLogo } from "./mod-identity";
import "./game-sims-discovery.css";

/** A small, original icon family built around the Sims' faceted plumbob. */
export function SimsDiscoveryIcon({ kind = "sims", size = 24 }: { kind?: string; size?: number }) {
  const name = kind.toLowerCase();
  const gem = <><path d="m16 3 7 12-7 14-7-14Z"/><path d="m16 3-2 12 2 14 2-14Zm-7 12h14"/></>;
  let drawing = gem;
  if (name === "popular") drawing = <><path d="m11 3 6 9-6 10-6-10Z"/><path d="m11 3-1 9 1 10 2-10Zm-6 9h12M23 10v15m-5-5 5 5 5-5M17 29h12"/></>;
  else if (name === "open") drawing = <><path d="m10 4 6 10-6 11-6-11Z"/><path d="m10 4-1 10 1 11 2-11ZM4 14h12M19 11h9v9m-12 3 12-12"/></>;
  else if (name === "updated") drawing = <><path d="m16 8 4 7-4 8-4-8Z"/><path d="M6 10a12 12 0 0 1 21 4M26 22A12 12 0 0 1 5 18M6 4v6h6m14 18v-6h-6"/></>;
  else if (name === "newest") drawing = <><path d="m13 6 6 10-6 11-6-11Z"/><path d="m13 6-1 10 1 11 2-11ZM7 16h12M24 3v8m-4-4h8m-2 10v6m-3-3h6"/></>;
  else if (/lot|hous/.test(name)) drawing = <><path d="m3 15 13-11 13 11M7 12v16h18V12M13 28V18h6v10"/><path d="M23 9V5h4v7M13 12h6"/></>;
  else if (/cas|create|body|hair|cloth|accessor|makeup/.test(name)) drawing = <><path d="M4 5h24v24H4Zm12 0v24M13 17v3m6-3v3"/><path d="m8 9 2 3-2 3-2-3Zm16 0 2 3-2 3-2-3Z"/></>;
  else if (/buy|furnish|furniture/.test(name)) drawing = <><path d="M7 17V9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8M7 25v4m18-4v4M6 25h20a3 3 0 0 0 3-3v-6a2 2 0 0 0-4 0v4H7v-4a2 2 0 0 0-4 0v6a3 3 0 0 0 3 3ZM16 6v14"/></>;
  else if (/build|construct/.test(name)) drawing = <><path d="m4 28 9-23 5 2-9 23ZM8 17l4 2M20 6l7 2-4 16-7-2Zm-3 15-3 7 5 1 3-7"/></>;
  else if (/pet/.test(name)) drawing = <><path d="M9 21c3-1 3-6 7-6s4 5 7 6c4 5-2 8-7 5-5 3-11 0-7-5Z"/><ellipse cx="7" cy="13" rx="2.5" ry="3.5"/><ellipse cx="13" cy="7" rx="2.5" ry="3.5"/><ellipse cx="20" cy="7" rx="2.5" ry="3.5"/><ellipse cx="26" cy="13" rx="2.5" ry="3.5"/></>;
  else if (/career/.test(name)) drawing = <><path d="M4 11h24v17H4Zm7 0V5h10v6M4 18l12 4 12-4M13 18h6v6h-6Z"/></>;
  else if (/trait/.test(name)) drawing = <><path d="m16 3 5 8-5 9-5-9ZM7 16C1 20 9 27 16 30c7-3 15-10 9-14"/></>;
  else if (/tool|program|utilit/.test(name)) drawing = <><path d="m5 26 12-12a8 8 0 0 1 9-10l-5 5 2 3 6-5a8 8 0 0 1-10 11L7 30Zm0 0 2 4"/></>;
  else if (/mod|core|script/.test(name)) drawing = <><path d="m21 3 5 8-5 8-5-8Z"/><path d="M11 8H4v20h20v-6M4 17h8m0-9v20m0-5h12"/></>;
  return <svg className="sims-discovery-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawing}</svg>;
}

export function SimsDiscoveryCategory({ category }: { category: string }) {
  const leaf = modCategory(category), label = leaf === "Other" ? category.split(/&raquo;|[»›]/)[0].trim().replaceAll("&amp;", "&") : leaf;
  return label ? <span className="sims-discovery-category"><SimsDiscoveryIcon kind={category}/><span>{label}</span></span> : null;
}

export function SimsDiscoveryProject({ project, disabled, open, source = "Mod The Sims" }: { project: SimsMtsProject; disabled: boolean; open: (origin: HTMLButtonElement) => void; source?: "Mod The Sims" | "CurseForge" }) {
  const t = useT(), language = useUiLanguage();
  const count = project.metrics?.downloads;
  const downloads = typeof count === "number" && Number.isFinite(count) && count >= 0 ? new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(count) : project.metrics?.rounded?.downloads ?? "—";
  const otherMetrics = project.metrics ? { ...project.metrics, downloads: undefined, rounded: { ...project.metrics.rounded, downloads: undefined } } : undefined;
  return <button className="games-sims-mts-card sims-discovery-project" aria-label={project.title} disabled={disabled} onClick={event => open(event.currentTarget)}>
    <span className="sims-discovery-project-art"><SimsMtsArt key={project.image} src={project.image} lazy skeleton/>{project.picked && <span className="mod-card-pick">{t("games.modHub.picked")}</span>}</span>
    <span className="sims-discovery-project-copy">
      <span className="sims-discovery-card-heading"><SimsDiscoveryCategory category={project.category}/><ModProviderLogo source={source} iconOnly/></span>
      <strong className="sims-discovery-project-title" dir="auto">{project.title}</strong>
      <span className="sims-discovery-creator" dir="auto">{project.creator}</span>
      {project.description && <span className="sims-discovery-description" dir="auto">{simsDescriptionPreview(project.description)}</span>}
      {project.updated && <span className="sims-discovery-updated"><SimsDiscoveryIcon kind="updated" size={20}/><span dir="auto">{project.updated}</span></span>}
      <span className="sims-discovery-project-bottom">
        <span className="sims-discovery-downloads" title={`${typeof count === "number" ? count.toLocaleString(language) : downloads} ${t("games.minecraft.catalog.downloads")}`}><SimsDiscoveryIcon kind="popular" size={28}/><span><strong>{downloads}</strong><span>{t("games.minecraft.catalog.downloads")}</span></span></span>
        <ModStats values={otherMetrics} compact/>
        <span className="sims-discovery-cta"><span>{t("games.modHub.viewProject")}</span><SimsDiscoveryIcon kind="open" size={28}/></span>
      </span>
    </span>
  </button>;
}

export function SimsDiscoveryLoading() {
  return <div className="sims-discovery-loading games-sims-mts-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="games-sims-mts-card sims-discovery-project" key={index}>
    <span className="sims-discovery-project-art"><span className="games-sims-mts-art sims-discovery-skeleton"/></span>
    <span className="sims-discovery-project-copy"><i className="sims-discovery-skeleton sims-discovery-category-line"/><i className="sims-discovery-skeleton sims-discovery-title-line"/><i className="sims-discovery-skeleton sims-discovery-author-line"/><i className="sims-discovery-skeleton sims-discovery-description-lines"/><span className="sims-discovery-project-bottom"><i className="sims-discovery-skeleton sims-discovery-count-line"/><i className="sims-discovery-skeleton sims-discovery-button-line"/></span></span>
  </div>)}</div>;
}
