import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import allDebridLogo from "@/assets/addon-logos/alldebrid.webp";
import debridLinkLogo from "@/assets/addon-logos/debridlink.png";
import premiumizeLogo from "@/assets/addon-logos/premiumize.png";
import realDebridLogo from "@/assets/addon-logos/realdebrid.png";
import torboxLogo from "@/assets/addon-logos/torbox.png";
import { useAuth } from "@/lib/auth";
import { userAddons, type Addon } from "@/lib/addons";
import { SERVICES } from "@/lib/providers/streaming";
import { useSettings, type StreamingService } from "@/lib/settings";
import {
  fetchAioStatusHealth,
  type AioStatusSnapshot,
  type ServiceHealth,
} from "@/lib/streams/aiostatus";
import { ExtLink, KeyField, Section } from "../shared";
import { ManualAddonCard, ServiceCard } from "../streaming-panel";
import { AioStatusModal } from "../aiostatus-modal";
import { useT } from "@/lib/i18n";

export type DebridKey = "rd" | "tb" | "ad" | "pm" | "dl";

export function DebridTab({
  rdDraft,
  tbDraft,
  adDraft,
  pmDraft,
  dlDraft,
  setRdDraft,
  setTbDraft,
  setAdDraft,
  setPmDraft,
  setDlDraft,
  savedKey,
  saveKey,
}: {
  rdDraft: string;
  tbDraft: string;
  adDraft: string;
  pmDraft: string;
  dlDraft: string;
  setRdDraft: (v: string) => void;
  setTbDraft: (v: string) => void;
  setAdDraft: (v: string) => void;
  setPmDraft: (v: string) => void;
  setDlDraft: (v: string) => void;
  savedKey: string | null;
  saveKey: (which: DebridKey, value: string) => void;
}) {
  const t = useT();
  const { settings, toggleStreaming } = useSettings();
  const aioHealth = useAioStatusHealth();
  return (
    <>
      <Section
        title={t("Debrid services")}
        subtitle={t(
          "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Cached streams play direct. Keys stay local.",
        )}
      >
        {aioHealth && <AioStatusBanner snapshot={aioHealth} />}
        <KeyField
          label={t("Real-Debrid API token")}
          placeholder={t("API token")}
          value={rdDraft}
          onChange={setRdDraft}
          onSave={() => saveKey("rd", rdDraft)}
          saved={savedKey === "rd"}
          iconSrc={realDebridLogo}
          help={
            <>
              {t("Get yours at")}{" "}
              <ExtLink href="https://real-debrid.com/apitoken">real-debrid.com/apitoken</ExtLink>.{" "}
              {t(
                "Used to check cache and unrestrict links. Harbor never adds or removes torrents on its own.",
              )}
            </>
          }
          headerExtra={
            aioHealth?.health.has("rd") ? (
              <HealthBadge health={aioHealth.health.get("rd")} logo={aioHealth.addonLogo} />
            ) : undefined
          }
        />
        <KeyField
          label={t("TorBox API key")}
          placeholder={t("API key")}
          value={tbDraft}
          onChange={setTbDraft}
          onSave={() => saveKey("tb", tbDraft)}
          saved={savedKey === "tb"}
          iconSrc={torboxLogo}
          help={
            <>
              {t("Get yours at")}{" "}
              <ExtLink href="https://torbox.app/settings">torbox.app/settings</ExtLink>.{" "}
              {t(
                "Same read-only usage as Real-Debrid. Also lets you queue uncached torrents from the play picker.",
              )}
            </>
          }
          headerExtra={
            aioHealth?.health.has("tb") ? (
              <HealthBadge health={aioHealth.health.get("tb")} logo={aioHealth.addonLogo} />
            ) : undefined
          }
        />
        <KeyField
          label={t("AllDebrid API key")}
          placeholder={t("API key")}
          value={adDraft}
          onChange={setAdDraft}
          onSave={() => saveKey("ad", adDraft)}
          saved={savedKey === "ad"}
          iconSrc={allDebridLogo}
          help={
            <>
              {t("Get yours at")}{" "}
              <ExtLink href="https://alldebrid.com/apikeys/">alldebrid.com/apikeys</ExtLink>.{" "}
              {t(
                "AllDebrid deprecated their cache-check endpoint, so streams may show as unknown until you actually hit Play.",
              )}
            </>
          }
          headerExtra={
            aioHealth?.health.has("ad") ? (
              <HealthBadge health={aioHealth.health.get("ad")} logo={aioHealth.addonLogo} />
            ) : undefined
          }
        />
        <KeyField
          label={t("Premiumize API key")}
          placeholder={t("API key")}
          value={pmDraft}
          onChange={setPmDraft}
          onSave={() => saveKey("pm", pmDraft)}
          saved={savedKey === "pm"}
          iconSrc={premiumizeLogo}
          help={
            <>
              {t("Get yours at")}{" "}
              <ExtLink href="https://www.premiumize.me/account">premiumize.me/account</ExtLink>.{" "}
              {t("Uses the directdl endpoint, which skips queueing for anything already cached.")}
            </>
          }
          headerExtra={
            aioHealth?.health.has("pm") ? (
              <HealthBadge health={aioHealth.health.get("pm")} logo={aioHealth.addonLogo} />
            ) : undefined
          }
        />
        <KeyField
          label={t("Debrid-Link API key")}
          placeholder={t("API key")}
          value={dlDraft}
          onChange={setDlDraft}
          onSave={() => saveKey("dl", dlDraft)}
          saved={savedKey === "dl"}
          iconSrc={debridLinkLogo}
          help={
            <>
              {t("Get yours at")}{" "}
              <ExtLink href="https://debrid-link.com/webapp/apikey">
                debrid-link.com/webapp/apikey
              </ExtLink>
              . {t("EU-hosted, fast cache check. Same read-only usage as the others.")}
            </>
          }
          headerExtra={
            aioHealth?.health.has("dl") ? (
              <HealthBadge health={aioHealth.health.get("dl")} logo={aioHealth.addonLogo} />
            ) : undefined
          }
        />
      </Section>

      <Section
        title={t("Usenet")}
        subtitle={t(
          "Faster and quieter than torrents if you already pay for Usenet. Configure on the addon page, paste the manifest URL it returns.",
        )}
      >
        <ManualAddonCard
          title="Easynews+"
          blurb={t(
            "Searches and streams directly off Easynews. No debrid needed. Just your Easynews login.",
          )}
          configureUrl="https://b89262c192b0-stremio-easynews-addon.baby-beamup.club/configure"
        />
      </Section>

      <Section
        title={t("Streaming catalogs")}
        subtitle={t("Top titles per service. Toggle off the ones you don't pay for.")}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(SERVICES) as StreamingService[]).map((svc) => (
            <ServiceCard
              key={svc}
              service={svc}
              active={settings.streaming[svc]}
              onToggle={() => toggleStreaming(svc)}
            />
          ))}
        </div>
        {!settings.tmdbKey && (
          <p className="mt-3 text-[13px] text-ink-subtle">
            {t("Save a TMDB key in Library & metadata to turn on streaming catalogs.")}
          </p>
        )}
      </Section>
    </>
  );
}

function useAioStatusHealth(): AioStatusSnapshot | null {
  const { authKey } = useAuth();
  const [snapshot, setSnapshot] = useState<AioStatusSnapshot | null>(null);
  useEffect(() => {
    if (!authKey) return;
    const ac = new AbortController();
    let cancelled = false;
    void (async () => {
      const list = await userAddons(authKey).catch(() => [] as Addon[]);
      if (cancelled || list.length === 0) return;
      const snap = await fetchAioStatusHealth(list, ac.signal);
      if (!cancelled) setSnapshot(snap);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [authKey]);
  return snapshot;
}

function AioStatusBanner({ snapshot }: { snapshot: AioStatusSnapshot }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const total = snapshot.services.length;
  if (total === 0) return null;
  const expiringSoon = snapshot.services.filter(
    (s) => s.status === "expiring" || s.status === "expired",
  );
  const hasWarning = expiringSoon.length > 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`animate-banner-in flex w-full items-center gap-2.5 rounded-md px-3.5 py-2.5 text-start text-[12.5px] transition-colors ${
          hasWarning
            ? "bg-accent-soft text-accent hover:bg-accent-soft"
            : "bg-elevated text-ink-muted hover:bg-raised"
        }`}
      >
        <span className="shrink-0 font-semibold tracking-wide">{snapshot.addonName}</span>
        <span className="text-ink-subtle">·</span>
        <span className="min-w-0 flex-1 truncate">
          {hasWarning
            ? expiringSoon.length === 1
              ? t("{n} service needs attention", { n: expiringSoon.length })
              : t("{n} services need attention", { n: expiringSoon.length })
            : total === 1
              ? t("Health for {n} service", { n: total })
              : t("Health for {n} services", { n: total })}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 font-semibold text-ink-subtle">
          {t("View all")}
          <ChevronRight size={14} strokeWidth={2.4} />
        </span>
      </button>
      {open && <AioStatusModal snapshot={snapshot} onClose={() => setOpen(false)} />}
    </>
  );
}

function HealthBadge({ health, logo }: { health: ServiceHealth | undefined; logo: string | null }) {
  const t = useT();
  if (!health) return null;
  const palette =
    health.status === "expired"
      ? "text-danger"
      : health.status === "expiring"
        ? "text-accent"
        : health.status === "active"
          ? "text-success"
          : "text-ink-subtle";
  const dot =
    health.status === "expired"
      ? "bg-danger"
      : health.status === "expiring"
        ? "bg-accent"
        : health.status === "active"
          ? "bg-success"
          : "bg-ink-subtle";
  const label = (() => {
    if (health.status === "expired") return t("Expired");
    if (health.daysLeft != null && health.status === "expiring")
      return t("{n}d left", { n: health.daysLeft });
    if (health.daysLeft != null) return t("{n}d left", { n: health.daysLeft });
    if (health.status === "active") return t("Active");
    return health.rawLine.slice(0, 40);
  })();
  return (
    <span className="flex items-center gap-2 text-[11.5px] font-medium">
      <span className={`flex items-center gap-1.5 ${palette}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>{label}</span>
        {health.quotaUsedPercent != null && (
          <span className="text-ink-subtle">· {health.quotaUsedPercent}%</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 text-ink-muted">
        {logo && (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas">
            <img
              src={logo}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              draggable={false}
            />
          </span>
        )}
        <span>AIOStatus</span>
      </span>
    </span>
  );
}
