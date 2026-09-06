import { useSubTabs } from "./sub-tabs";
import { Globe, Library, Star } from "./icons";
import { useRef, useState } from "react";
import traktLogo from "@/assets/trakt.svg";
import { fireWebhook, type WebhookKind, type WebhookPayload } from "@/lib/calendar";
import { useAuth } from "@/lib/auth";
import { useSettings, type Settings } from "@/lib/settings";
import { useTrakt } from "@/lib/trakt/provider";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { RuleBuilder } from "./webhooks-panel/rule-builder";
import {
  DiscordMark,
  DiscordTutorial,
  WebhookField,
  type FieldStatus,
} from "./webhooks-panel/webhook-field";
import { TelegramComposedField } from "./webhooks-panel/telegram-field";

const idleStatus: FieldStatus = { state: "idle", message: null };

type SourceKey = keyof Settings["webhooks"]["sources"];

type SourceMeta = {
  id: SourceKey;
  label: string;
  description: string;
  icon: () => React.ReactNode;
  prereq: (s: Settings, opts: { authKey: string | null; traktConnected: boolean }) => string | null;
};

const SOURCES: SourceMeta[] = [
  {
    id: "library",
    label: "My library",
    description: "Episodes and movies from shows you've saved on Stremio.",
    icon: () => <Library size={19} strokeWidth={2} />,
    prereq: (_s, { authKey }) => (authKey ? null : "Sign in to Stremio first."),
  },
  {
    id: "all",
    label: "All upcoming",
    description: "Everything releasing in the current month from TMDB.",
    icon: () => <Globe size={19} strokeWidth={2} />,
    prereq: (s) => (s.tmdbKey ? null : "Add a TMDB key in Library settings."),
  },
  {
    id: "trakt",
    label: "My Trakt",
    description: "Upcoming episodes and movies from your Trakt watchlist.",
    icon: () => <img src={traktLogo} alt="" className="h-[19px] w-[19px] object-contain" />,
    prereq: (_s, { traktConnected }) => (traktConnected ? null : "Connect Trakt first."),
  },
  {
    id: "anticipated",
    label: "Anticipated",
    description: "The most anticipated upcoming releases on Trakt. No login needed.",
    icon: () => <img src={traktLogo} alt="" className="h-[19px] w-[19px] object-contain" />,
    prereq: () => null,
  },
  {
    id: "custom",
    label: "Custom calendar",
    description:
      "Anything matching your Custom calendar: tracked people, genres, providers, countries.",
    icon: () => <Star size={19} strokeWidth={2} />,
    prereq: (s) => (s.tmdbKey ? null : "Add a TMDB key in Library settings."),
  },
];

type Tab = "destinations" | "what" | "rules";

export function WebhooksPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("destinations");
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const { isConnected: traktConnected } = useTrakt();
  const [discordStatus, setDiscordStatus] = useState<FieldStatus>(idleStatus);
  const [telegramStatus, setTelegramStatus] = useState<FieldStatus>(idleStatus);
  const inFlightRef = useRef<{ discord: boolean; telegram: boolean }>({
    discord: false,
    telegram: false,
  });

  const setUrl = (which: "discordUrl" | "telegramUrl", v: string) =>
    update({ webhooks: { ...settings.webhooks, [which]: v.trim() } });

  const setSource = (key: SourceKey, on: boolean) =>
    update({
      webhooks: {
        ...settings.webhooks,
        sources: { ...settings.webhooks.sources, [key]: on },
      },
    });

  const setNotify = (key: "notifyMovies" | "notifyTv" | "notifyAnime", on: boolean) =>
    update({ webhooks: { ...settings.webhooks, [key]: on } });

  const send = async (kind: WebhookKind) => {
    if (inFlightRef.current[kind]) return;
    const url = kind === "discord" ? settings.webhooks.discordUrl : settings.webhooks.telegramUrl;
    const setStatus = kind === "discord" ? setDiscordStatus : setTelegramStatus;
    if (!url) return;
    inFlightRef.current[kind] = true;
    setStatus({ state: "busy", message: t("Sending…") });
    const service = kind === "discord" ? "Discord" : "Telegram";
    const testPayload: WebhookPayload = {
      text: t("Harbor test message ({service}). If you can read this, your webhook is wired up.", {
        service,
      }),
      items: [],
    };
    try {
      const res = await fireWebhook(kind, url, testPayload);
      setStatus({
        state: res.ok ? "ok" : "error",
        message: res.ok ? t("Sent. Check your channel.") : (res.error ?? t("Failed")),
      });
    } finally {
      inFlightRef.current[kind] = false;
    }
    setTimeout(() => setStatus(idleStatus), 4000);
  };

  useSubTabs(
    [
      { id: "destinations", label: t("Destinations") },
      { id: "what", label: t("Sources") },
      { id: "rules", label: t("Rules") },
    ],
    tab,
    (id) => setTab(id as Tab),
  );

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "destinations" && (
        <Section
          title={t("Where alerts go")}
          subtitle={t(
            "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Send test to send yourself a sample first.",
          )}
        >
          <WebhookField
            label={t("Discord webhook URL")}
            logo={<DiscordMark />}
            placeholder="https://discord.com/api/webhooks/…"
            value={settings.webhooks.discordUrl}
            onChange={(v) => setUrl("discordUrl", v)}
            onTest={() => send("discord")}
            status={discordStatus}
            help={<DiscordTutorial />}
          />
          <TelegramComposedField
            fullUrl={settings.webhooks.telegramUrl}
            onUrlChange={(v) => setUrl("telegramUrl", v)}
            onTest={() => send("telegram")}
            status={telegramStatus}
          />
        </Section>
      )}
      {tab === "what" && (
        <>
          <Section
            title={t("What to send")}
            subtitle={t(
              "Pick which calendars feed your alerts. Items are deduped across sources before sending.",
            )}
          >
            {SOURCES.map((s) => (
              <SourceToggle
                key={s.id}
                source={s}
                on={settings.webhooks.sources[s.id]}
                blocker={s.prereq(settings, { authKey, traktConnected })}
                onChange={(v) => setSource(s.id, v)}
              />
            ))}
          </Section>

          <Section
            title={t("Media types")}
            subtitle={t(
              "Filter by type after the sources merge. Leave them all on to send everything.",
            )}
          >
            <ToggleRow
              label={t("Movies")}
              sub={t("Include film releases from every source you turned on above.")}
              value={settings.webhooks.notifyMovies}
              onChange={(v) => setNotify("notifyMovies", v)}
            />
            <ToggleRow
              label={t("TV")}
              sub={t("Include series premieres and new episodes. Anime is counted separately.")}
              value={settings.webhooks.notifyTv}
              onChange={(v) => setNotify("notifyTv", v)}
            />
            <ToggleRow
              label={t("Anime")}
              sub={t("Include anime episodes and seasons, even when TV is turned off.")}
              value={settings.webhooks.notifyAnime}
              onChange={(v) => setNotify("notifyAnime", v)}
            />
          </Section>
        </>
      )}
      {tab === "rules" && (
        <RuleBuilder
          rules={settings.webhookRules}
          onChange={(rules) => update({ webhookRules: rules })}
          trackedPeople={settings.customCalendar.trackedPeople}
          canDiscord={!!settings.webhooks.discordUrl}
          canTelegram={!!settings.webhooks.telegramUrl}
        />
      )}
    </div>
  );
}

function SourceToggle({
  source,
  on,
  blocker,
  onChange,
}: {
  source: SourceMeta;
  on: boolean;
  blocker: string | null;
  onChange: (v: boolean) => void;
}) {
  const t = useT();
  return (
    <ToggleRow
      label={t(source.label)}
      sub={t(source.description)}
      value={on}
      onChange={onChange}
      lockReason={blocker ? t(blocker) : undefined}
      leading={source.icon()}
    />
  );
}
