import { Globe, Library, Star } from "lucide-react";
import { useRef, useState } from "react";
import traktLogo from "@/assets/trakt.svg";
import { fireWebhook, type WebhookKind, type WebhookPayload } from "@/lib/calendar";
import { useAuth } from "@/lib/auth";
import { useSettings, type Settings } from "@/lib/settings";
import { useTrakt } from "@/lib/trakt/provider";
import { useT } from "@/lib/i18n";
import { Section } from "./shared";
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
    icon: () => <Library size={14} strokeWidth={2} />,
    prereq: (_s, { authKey }) => (authKey ? null : "Sign in to Stremio first."),
  },
  {
    id: "all",
    label: "All upcoming",
    description: "Everything releasing in the current month from TMDB.",
    icon: () => <Globe size={14} strokeWidth={2} />,
    prereq: (s) => (s.tmdbKey ? null : "Add a TMDB key in Library settings."),
  },
  {
    id: "trakt",
    label: "My Trakt",
    description: "Upcoming episodes and movies from your Trakt watchlist.",
    icon: () => <img src={traktLogo} alt="" className="h-3.5 w-3.5 object-contain" />,
    prereq: (_s, { traktConnected }) => (traktConnected ? null : "Connect Trakt first."),
  },
  {
    id: "anticipated",
    label: "Anticipated",
    description: "The most anticipated upcoming releases on Trakt. No login needed.",
    icon: () => <img src={traktLogo} alt="" className="h-3.5 w-3.5 object-contain" />,
    prereq: () => null,
  },
  {
    id: "custom",
    label: "Custom calendar",
    description:
      "Anything matching your Custom calendar: tracked people, genres, providers, countries.",
    icon: () => <Star size={14} strokeWidth={2} />,
    prereq: (s) => (s.tmdbKey ? null : "Add a TMDB key in Library settings."),
  },
];

export function WebhooksPanel() {
  const t = useT();
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
    setStatus({ state: "busy", message: "Sending…" });
    const testPayload: WebhookPayload = {
      text: `Harbor test message (${kind === "discord" ? "Discord" : "Telegram"}). If you can read this, your webhook is wired up.`,
      items: [],
    };
    try {
      const res = await fireWebhook(kind, url, testPayload);
      setStatus({
        state: res.ok ? "ok" : "error",
        message: res.ok ? "Sent. Check your channel." : (res.error ?? "Failed"),
      });
    } finally {
      inFlightRef.current[kind] = false;
    }
    setTimeout(() => setStatus(idleStatus), 4000);
  };

  return (
    <>
      <Section
        title={t("Where alerts go")}
        subtitle={t(
          "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Test to send yourself a sample first.",
        )}
      >
        <div className="flex flex-col gap-5">
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
        </div>
      </Section>

      <Section
        title={t("What to send")}
        subtitle={t(
          "Pick which calendars feed your alerts. Items are deduped across sources before sending.",
        )}
      >
        <div className="flex flex-col gap-2">
          {SOURCES.map((s) => {
            const blocker = s.prereq(settings, { authKey, traktConnected });
            const on = settings.webhooks.sources[s.id];
            return (
              <SourceToggle
                key={s.id}
                source={s}
                on={on}
                blocker={blocker}
                onChange={(v) => setSource(s.id, v)}
              />
            );
          })}
        </div>
      </Section>

      <Section
        title={t("Media types")}
        subtitle={t(
          "Filter by type after the sources merge. Leave them all on to send everything.",
        )}
      >
        <div className="flex flex-wrap gap-2">
          <ChipToggle
            label={t("Movies")}
            on={settings.webhooks.notifyMovies}
            onToggle={(v) => setNotify("notifyMovies", v)}
          />
          <ChipToggle
            label={t("TV")}
            on={settings.webhooks.notifyTv}
            onToggle={(v) => setNotify("notifyTv", v)}
          />
          <ChipToggle
            label={t("Anime")}
            on={settings.webhooks.notifyAnime}
            onToggle={(v) => setNotify("notifyAnime", v)}
          />
        </div>
      </Section>

      <RuleBuilder
        rules={settings.webhookRules}
        onChange={(rules) => update({ webhookRules: rules })}
        trackedPeople={settings.customCalendar.trackedPeople}
        canDiscord={!!settings.webhooks.discordUrl}
        canTelegram={!!settings.webhooks.telegramUrl}
      />
    </>
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
  const disabled = blocker !== null;
  const effective = on && !disabled;
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`flex items-center justify-between gap-4 rounded-lg border px-3.5 py-3 text-start transition-colors ${
        disabled
          ? "cursor-not-allowed border-edge-soft/50 bg-canvas/20 opacity-70"
          : effective
            ? "border-ink/40 bg-elevated/40"
            : "border-edge-soft hover:border-edge"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            effective ? "bg-ink text-canvas" : "bg-canvas/60 text-ink-muted"
          }`}
        >
          {source.icon()}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-ink">{t(source.label)}</span>
          <span className={`text-[12px] ${blocker ? "text-amber-200/85" : "text-ink-subtle"}`}>
            {blocker ? t(blocker) : t(source.description)}
          </span>
        </div>
      </div>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          effective ? "bg-ink" : "bg-edge"
        }`}
      >
        <span
          className={`absolute start-0 top-0.5 h-4 w-4 rounded-full bg-canvas transition-transform ${
            effective
              ? "translate-x-[18px] rtl:-translate-x-[18px]"
              : "translate-x-0.5 rtl:-translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ChipToggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  const t = useT();
  return (
    <button
      onClick={() => onToggle(!on)}
      className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
        on
          ? "bg-ink text-canvas"
          : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {t(label)}
    </button>
  );
}
