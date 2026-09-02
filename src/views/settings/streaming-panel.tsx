import { Check, Download, ExternalLink, Key, Loader2, Trash2, X, Zap } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useState } from "react";
import { AddonLogo } from "@/components/addon-logo";
import { Flag } from "@/components/flag";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { ServiceLogo } from "@/components/service-logo";
import {
  cometKeyFromUrl,
  installAddon,
  isInstalled,
  transportUrlFor,
  uninstallAddon,
} from "@/lib/addon-store";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { useSettings, type StreamingService } from "@/lib/settings";

export function pickDebridForAddon(s: ReturnType<typeof useSettings>["settings"]):
  | { service: string; key: string; label: string }
  | null {
  if (s.tbKey) return { service: "torbox", key: s.tbKey, label: "TorBox" };
  if (s.rdKey) return { service: "realdebrid", key: s.rdKey, label: "Real-Debrid" };
  if (s.adKey) return { service: "alldebrid", key: s.adKey, label: "AllDebrid" };
  if (s.pmKey) return { service: "premiumize", key: s.pmKey, label: "Premiumize" };
  if (s.dlKey) return { service: "debridlink", key: s.dlKey, label: "Debrid-Link" };
  return null;
}

const PILL = "inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent";
const GHOST_BUTTON =
  "harbor-press-pop flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-raised px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink";
const SOLID_BUTTON =
  "harbor-press-pop flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export function RecommendedAddonCard({
  id,
  title,
  blurb,
  urlBuilder,
  settings,
}: {
  id: string;
  title: string;
  blurb: string;
  urlBuilder: (service: string, apiKey: string) => string;
  settings: ReturnType<typeof useSettings>["settings"];
}) {
  const t = useT();
  const [installed, setInstalled] = useState(() => isInstalled(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debrid = pickDebridForAddon(settings);

  useEffect(() => {
    setInstalled(isInstalled(id));
    if (!debrid) return;
    const url = transportUrlFor(id);
    if (!url) return;
    const current = cometKeyFromUrl(url);
    const stale = !current || current.service !== debrid.service || current.apiKey !== debrid.key.trim();
    if (!stale) return;
    installAddon(id, urlBuilder(debrid.service, debrid.key)).catch(() => {});
  }, [id, debrid, urlBuilder, settings.tbKey, settings.rdKey, settings.adKey, settings.pmKey, settings.dlKey]);

  const onInstall = async () => {
    if (!debrid) return;
    setBusy(true);
    setError(null);
    try {
      await installAddon(id, urlBuilder(debrid.service, debrid.key));
      setInstalled(true);
    } catch (e: any) {
      setError(e?.message ?? t("Install failed"));
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = () => {
    void uninstallAddon(id);
    setInstalled(false);
  };

  return (
    <div className="flex items-center gap-4 rounded-md bg-elevated px-4 py-3.5">
      <AddonLogo addonId={id} addonName={title} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium text-ink">{title}</span>
          {installed && (
            <span className={PILL}>
              <Zap size={9} fill="currentColor" strokeWidth={0} />
              {t("Installed via {name}", { name: debrid?.label ?? t("debrid") })}
            </span>
          )}
        </div>
        <span className="text-[12.5px] leading-relaxed text-ink-subtle">{blurb}</span>
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
        {!debrid && !installed && (
          <span className="text-[12.5px] text-ink-subtle">
            {t(
              "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.",
            )}
          </span>
        )}
      </div>
      {installed ? (
        <button onClick={onUninstall} className={`${GHOST_BUTTON} hover:bg-danger/25 hover:text-danger`}>
          <Trash2 size={14} strokeWidth={2.2} />
          {t("Remove")}
        </button>
      ) : (
        <button onClick={onInstall} disabled={!debrid || busy} className={SOLID_BUTTON}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.2} />}
          {t("Install")}
        </button>
      )}
    </div>
  );
}

function normalizeManifestUrl(raw: string): string {
  let url = raw.trim();
  if (url.startsWith("stremio://")) url = "https://" + url.slice("stremio://".length);
  url = url.replace(/\/#\/configure\/?$/, "");
  url = url.replace(/\/configure\/?$/, "");
  if (/manifest\.json(\?.*)?$/.test(url)) return url;
  return url.replace(/\/+$/, "") + "/manifest.json";
}

export function ManualAddonCard({
  title,
  blurb,
  configureUrl,
}: {
  title: string;
  blurb: string;
  configureUrl: string;
}) {
  const t = useT();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const localId = `harbor-manual-${slug}`;
  const [installedId, setInstalledId] = useState<string | null>(() => {
    const fromAlias = transportUrlFor(localId) ? localId : null;
    return fromAlias;
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onInstall = async () => {
    const url = draft.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const manifestUrl = normalizeManifestUrl(url);
      const installed = await installAddon(localId, manifestUrl);
      setInstalledId(installed.manifest.id || localId);
      setDraft("");
    } catch (e: any) {
      setError(e?.message ?? t("Couldn't install. Double-check the URL and try again."));
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = () => {
    void uninstallAddon(localId);
    setInstalledId(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-4 rounded-md bg-elevated px-4 py-3.5">
        <AddonLogo addonId={localId} addonName={title} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-ink">{title}</span>
            {installedId && (
              <span className={PILL}>
                <Check size={9} strokeWidth={3} />
                {t("Installed")}
              </span>
            )}
          </div>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">{blurb}</span>
        </div>
        <button onClick={() => openUrl(configureUrl)} className={GHOST_BUTTON}>
          <ExternalLink size={14} strokeWidth={2.2} />
          {t("Configure")}
        </button>
        {installedId && (
          <button onClick={onUninstall} className={`${GHOST_BUTTON} hover:bg-danger/25 hover:text-danger`}>
            <Trash2 size={14} strokeWidth={2.2} />
            {t("Remove")}
          </button>
        )}
      </div>
      {!installedId && (
        <div className="flex items-center gap-1.5 rounded-md bg-elevated p-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md bg-canvas px-3.5">
            <Key size={16} className="shrink-0 text-ink-subtle" />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text").trim();
                if (text) {
                  e.preventDefault();
                  setDraft(text);
                }
              }}
              placeholder={t("Paste the manifest URL the configure page gave you")}
              spellCheck={false}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle/60 outline-none"
            />
          </div>
          <button onClick={onInstall} disabled={!draft.trim() || busy} className={`${SOLID_BUTTON} h-11`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.2} />}
            {t("Install")}
          </button>
        </div>
      )}
      {error && <span className="px-1 text-[12.5px] text-danger">{error}</span>}
    </div>
  );
}

const LANGUAGE_OPTIONS = ALL_LANGUAGE_NAMES;

export function LanguagesPicker({
  value,
  onChange,
  options = LANGUAGE_OPTIONS,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options?: string[];
  placeholder?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const toggle = (lang: string) => {
    const next = new Set(selected);
    if (next.has(lang)) next.delete(lang);
    else next.add(lang);
    onChange([...next]);
  };
  const q = query.trim().toLowerCase();
  const available = options.filter((l) => !selected.has(l));
  const matches = q ? available.filter((l) => l.toLowerCase().includes(q)) : available;
  const COMMON = 24;
  const shown = q ? matches : matches.slice(0, COMMON);
  const moreCount = q ? 0 : matches.length - shown.length;

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md bg-elevated px-3 py-3">
          {value.map((lang) => (
            <button
              key={lang}
              onClick={() => toggle(lang)}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Flag language={lang} size="sm" showLabel={false} />
              <span>{lang}</span>
              <X size={12} strokeWidth={2.4} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2.5 rounded-md bg-elevated p-3">
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2.2}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? t("Search languages (Tamil, Telugu, ...)")}
            spellCheck={false}
            className="h-10 w-full rounded-md bg-canvas ps-9 pe-3 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {shown.map((lang) => (
            <button
              key={lang}
              onClick={() => toggle(lang)}
              className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Flag language={lang} size="sm" showLabel={false} />
              <span>{lang}</span>
            </button>
          ))}
          {moreCount > 0 && (
            <span className="inline-flex items-center px-2 py-1.5 text-[12.5px] text-ink-subtle">
              {t("+{n} more, search to find yours", { n: moreCount })}
            </span>
          )}
          {q.length > 0 && matches.length === 0 && (
            <span className="inline-flex items-center px-2 py-1.5 text-[12.5px] text-ink-subtle">
              {t("No language matches that search.")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


export function ServiceCard({
  service,
  active,
  onToggle,
}: {
  service: StreamingService;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={`relative flex h-16 items-center justify-center overflow-hidden rounded-md px-3 transition-colors ${
        active ? "bg-raised" : "bg-elevated hover:bg-raised"
      }`}
    >
      <span className={active ? "" : "opacity-40"}>
        <ServiceLogo service={service} height={22} />
      </span>
      {active && (
        <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink">
          <Check size={12} strokeWidth={3} className="text-canvas" />
        </span>
      )}
    </button>
  );
}
