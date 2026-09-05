import { Check, Download, ExternalLink, Key, Loader2, Trash2, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useState } from "react";
import { AddonLogo } from "@/components/addon-logo";
import { Flag } from "@/components/flag";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { ServiceLogo } from "@/components/service-logo";
import { SERVICES } from "@/lib/providers/streaming";
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
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, SettingRow } from "./kit";

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

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const FIELD =
  "h-11 min-w-[240px] max-w-[520px] flex-1 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
    <SettingRow
      icon={<AddonLogo addonId={id} addonName={title} size="md" />}
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{title}</span>
          {installed && (
            <span className={`${QUAL} bg-accent-soft text-accent`}>
              {t("Installed via {name}", { name: debrid?.label ?? t("debrid") })}
            </span>
          )}
        </span>
      }
      desc={
        !debrid && !installed ? (
          <>
            {blurb}{" "}
            {t(
              "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.",
            )}
          </>
        ) : (
          blurb
        )
      }
      warn={error ?? undefined}
    >
      {installed ? (
        <button type="button" onClick={onUninstall} className={ROW_ACTION_DANGER}>
          <Trash2 size={16} strokeWidth={2.2} />
          {t("Remove")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onInstall}
          disabled={!debrid || busy}
          className={ROW_ACTION_PRIMARY}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.2} />}
          {t("Install")}
        </button>
      )}
    </SettingRow>
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
    <>
      <SettingRow
        icon={<AddonLogo addonId={localId} addonName={title} size="md" />}
        label={
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0">{title}</span>
            {installedId && (
              <span className={`${QUAL} bg-accent-soft text-accent`}>{t("Installed")}</span>
            )}
          </span>
        }
        desc={blurb}
      >
        <button type="button" onClick={() => openUrl(configureUrl)} className={ROW_ACTION}>
          <ExternalLink size={16} strokeWidth={2.2} />
          {t("Configure")}
        </button>
        {installedId && (
          <button type="button" onClick={onUninstall} className={ROW_ACTION_DANGER}>
            <Trash2 size={16} strokeWidth={2.2} />
            {t("Remove")}
          </button>
        )}
      </SettingRow>
      {!installedId && (
        <SettingRow
          wide
          icon={<Key size={18} strokeWidth={2} />}
          label={t("Manifest URL")}
          desc={t(
            "Finish the setup on the configure page, then paste the manifest URL it hands back here.",
          )}
          warn={error ?? undefined}
        >
          <div className="flex w-full flex-wrap items-center gap-2.5">
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
              className={FIELD}
            />
            <button
              type="button"
              onClick={onInstall}
              disabled={!draft.trim() || busy}
              className={ROW_ACTION_PRIMARY}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.2} />}
              {t("Install")}
            </button>
          </div>
        </SettingRow>
      )}
    </>
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
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-edge-soft bg-elevated p-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {value.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggle(lang)}
              className="group inline-flex h-11 items-center gap-2 rounded-[8px] bg-ink px-3.5 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Flag language={lang} size="md" showLabel={false} />
              <span>{lang}</span>
              <X size={16} strokeWidth={2.4} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
      <div className="flex h-11 items-center gap-2.5 rounded-[10px] bg-canvas px-3.5">
        <Search size={18} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t("Search languages (Tamil, Telugu, ...)")}
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55"
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        {shown.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => toggle(lang)}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-canvas px-3.5 text-[15.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Flag language={lang} size="md" showLabel={false} />
            <span>{lang}</span>
          </button>
        ))}
        {moreCount > 0 && (
          <span className="inline-flex h-11 max-w-[66ch] items-center text-[15.5px] leading-[22px] text-ink-subtle">
            {t("+{n} more, search to find yours", { n: moreCount })}
          </span>
        )}
        {q.length > 0 && matches.length === 0 && (
          <span className="inline-flex h-11 max-w-[66ch] items-center text-[15.5px] leading-[22px] text-ink-subtle">
            {t("No language matches that search.")}
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
  const name = SERVICES[service]?.name ?? service;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={name}
      title={name}
      className={`relative flex min-h-[84px] items-center justify-center rounded-[10px] border bg-elevated px-4 py-3 transition-colors ${
        active ? "border-accent" : "border-edge-soft hover:bg-raised"
      }`}
    >
      <span className={active ? "" : "opacity-40"}>
        <ServiceLogo service={service} height={26} />
      </span>
      {active && (
        <span className="absolute end-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-soft text-accent">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
