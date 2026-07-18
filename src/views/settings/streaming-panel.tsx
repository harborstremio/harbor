import { Check, Download, ExternalLink, Key, Loader2, Search, Trash2, X, Zap } from "lucide-react";
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
import { useSettings, type StreamingService } from "@/lib/settings";

export function pickDebridForAddon(
  s: ReturnType<typeof useSettings>["settings"],
): { service: string; key: string; label: string } | null {
  if (s.tbKey) return { service: "torbox", key: s.tbKey, label: "TorBox" };
  if (s.rdKey) return { service: "realdebrid", key: s.rdKey, label: "Real-Debrid" };
  if (s.adKey) return { service: "alldebrid", key: s.adKey, label: "AllDebrid" };
  if (s.pmKey) return { service: "premiumize", key: s.pmKey, label: "Premiumize" };
  if (s.dlKey) return { service: "debridlink", key: s.dlKey, label: "Debrid-Link" };
  return null;
}

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
    const stale =
      !current || current.service !== debrid.service || current.apiKey !== debrid.key.trim();
    if (!stale) return;
    installAddon(id, urlBuilder(debrid.service, debrid.key)).catch(() => {});
  }, [
    id,
    debrid,
    urlBuilder,
    settings.tbKey,
    settings.rdKey,
    settings.adKey,
    settings.pmKey,
    settings.dlKey,
  ]);

  const onInstall = async () => {
    if (!debrid) return;
    setBusy(true);
    setError(null);
    try {
      await installAddon(id, urlBuilder(debrid.service, debrid.key));
      setInstalled(true);
    } catch (e: any) {
      setError(e?.message ?? "Install failed");
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = () => {
    void uninstallAddon(id);
    setInstalled(false);
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      <AddonLogo addonId={id} addonName={title} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium text-ink">{title}</span>
          {installed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent ring-1 ring-accent/40">
              <Zap size={9} fill="currentColor" strokeWidth={0} />
              Installed via {debrid?.label ?? "debrid"}
            </span>
          )}
        </div>
        <span className="text-[12.5px] leading-relaxed text-ink-muted">{blurb}</span>
        {error && <span className="text-[12px] text-danger">{error}</span>}
        {!debrid && !installed && (
          <span className="text-[12px] text-ink-subtle">
            Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to
            enable this.
          </span>
        )}
      </div>
      {installed ? (
        <button
          onClick={onUninstall}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-danger/60 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          Remove
        </button>
      ) : (
        <button
          onClick={onInstall}
          disabled={!debrid || busy}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} strokeWidth={2.2} />
          )}
          Install
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
      setError(e?.message ?? "Couldn't install. Double-check the URL and try again.");
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = () => {
    void uninstallAddon(localId);
    setInstalledId(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      <div className="flex items-start gap-4">
        <AddonLogo addonId={localId} addonName={title} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium text-ink">{title}</span>
            {installedId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent ring-1 ring-accent/40">
                <Check size={9} strokeWidth={3} />
                Installed
              </span>
            )}
          </div>
          <span className="text-[12.5px] leading-relaxed text-ink-muted">{blurb}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => openUrl(configureUrl)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
          >
            <ExternalLink size={13} strokeWidth={2.2} />
            Configure
          </button>
          {installedId && (
            <button
              onClick={onUninstall}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-danger/60 hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={13} strokeWidth={2.2} />
              Remove
            </button>
          )}
        </div>
      </div>
      {!installedId && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-edge bg-canvas px-3.5 transition-colors focus-within:border-ink-subtle">
            <Key size={15} className="text-ink-subtle" />
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
              placeholder="Paste the manifest URL the configure page gave you"
              spellCheck={false}
              autoComplete="off"
              className="h-11 flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-ink-subtle/60 outline-none"
            />
          </div>
          <button
            onClick={onInstall}
            disabled={!draft.trim() || busy}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-ink px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} strokeWidth={2.2} />
            )}
            Install
          </button>
        </div>
      )}
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}

const LANGUAGE_OPTIONS = ALL_LANGUAGE_NAMES;

export function LanguagesPicker({
  value,
  onChange,
  options = LANGUAGE_OPTIONS,
  placeholder = "Search languages (Tamil, Telugu, ...)",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options?: string[];
  placeholder?: string;
}) {
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
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-edge-soft bg-canvas/40 px-3 py-2.5">
          {value.map((lang) => (
            <button
              key={lang}
              onClick={() => toggle(lang)}
              className="group inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12.5px] font-semibold text-accent transition-colors hover:bg-accent/25"
            >
              <Flag language={lang} size="sm" showLabel={false} />
              <span>{lang}</span>
              <X size={11} strokeWidth={2.4} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search
          size={15}
          strokeWidth={2.2}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="h-10 w-full rounded-xl border border-edge bg-canvas ps-9 pe-3 text-[13.5px] text-ink outline-none transition-colors focus:border-ink placeholder:text-ink-subtle/60"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((lang) => (
          <button
            key={lang}
            onClick={() => toggle(lang)}
            className="inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/30 px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <Flag language={lang} size="sm" showLabel={false} />
            <span>{lang}</span>
          </button>
        ))}
        {moreCount > 0 && (
          <span className="inline-flex items-center px-2 py-1.5 text-[12px] text-ink-subtle">
            +{moreCount} more, search to find yours
          </span>
        )}
        {q.length > 0 && matches.length === 0 && (
          <span className="inline-flex items-center px-2 py-1.5 text-[12px] text-ink-subtle">
            No language matches that search.
          </span>
        )}
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
      className={`relative flex h-20 items-center justify-center overflow-hidden rounded-xl border px-4 transition-all ${
        active
          ? "border-ink-subtle/50 bg-raised opacity-100"
          : "border-edge-soft bg-canvas opacity-55 hover:opacity-90"
      }`}
    >
      <ServiceLogo service={service} height={26} />
      {active && (
        <span className="absolute end-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-ink">
          <Check size={11} strokeWidth={3} className="text-canvas" />
        </span>
      )}
    </button>
  );
}
