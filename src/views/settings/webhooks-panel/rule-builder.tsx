import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import type { Settings, WebhookTrigger } from "@/lib/settings";
import { settingsAnchor } from "../shared";

function AutomationsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="4" cy="4.2" r="2.1" />
      <path d="M4 6.3v2.5a2.6 2.6 0 0 0 2.6 2.6h3.2" />
      <circle cx="12" cy="11.4" r="2.1" />
    </svg>
  );
}

type Rule = Settings["webhookRules"][number];
type TrackedPerson = Settings["customCalendar"]["trackedPeople"][number];
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const EVENT_LABELS: Record<WebhookTrigger["event"], string> = {
  newMovie: "A new movie comes out",
  newSeries: "A new series comes out",
  newAnime: "A new anime comes out",
  fromTrackedPerson: "Someone I track has a new release",
  fromGenre: "A specific genre releases",
  fromProvider: "A streamer releases something",
  fromCountry: "A country releases something",
  fromTraktAnticipated: "Trakt anticipated picks up something",
  fromTraktWatchlist: "My Trakt watchlist updates",
  liveTvEvent: "A Live TV program is about to start",
};

const EVENT_ORDER: WebhookTrigger["event"][] = [
  "newMovie",
  "newSeries",
  "newAnime",
  "fromTrackedPerson",
  "fromGenre",
  "fromProvider",
  "fromCountry",
  "liveTvEvent",
  "fromTraktAnticipated",
  "fromTraktWatchlist",
];

const PROVIDERS: Array<{ id: number; name: string }> = [
  { id: 8, name: "Netflix" },
  { id: 9, name: "Prime" },
  { id: 337, name: "Disney+" },
  { id: 384, name: "Max" },
  { id: 15, name: "Hulu" },
  { id: 350, name: "Apple TV+" },
  { id: 531, name: "Paramount+" },
  { id: 386, name: "Peacock" },
  { id: 283, name: "Crunchyroll" },
];

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IN", name: "India" },
];

function defaultTrigger(event: WebhookTrigger["event"]): WebhookTrigger {
  switch (event) {
    case "fromGenre":
      return { event: "fromGenre", genreIds: [], mediaType: "movie" };
    case "fromProvider":
      return { event: "fromProvider", providerIds: [] };
    case "fromCountry":
      return { event: "fromCountry", countryCodes: [] };
    case "fromTrackedPerson":
      return { event: "fromTrackedPerson", personIds: [] };
    case "liveTvEvent":
      return { event: "liveTvEvent", favoritesOnly: true, leadMinutes: 15 };
    default:
      return { event } as WebhookTrigger;
  }
}

function describeTrigger(
  trigger: WebhookTrigger,
  trackedPeople: TrackedPerson[],
  t: Translate,
): string {
  switch (trigger.event) {
    case "newMovie":
      return t("Any new movie");
    case "newSeries":
      return t("Any new series");
    case "newAnime":
      return t("Any new anime");
    case "fromTrackedPerson": {
      const ids = trigger.personIds ?? [];
      if (ids.length === 0)
        return t("Any of your {count} tracked people", { count: trackedPeople.length });
      const names = ids
        .map((id) => trackedPeople.find((person) => person.id === id)?.name)
        .filter(Boolean) as string[];
      return names.join(", ") || t("Tracked people");
    }
    case "fromGenre": {
      if (trigger.genreIds.length === 0) return t("Any genre");
      const names = trigger.genreIds
        .map((id) => Object.entries(MOVIE_GENRES).find(([, genreId]) => genreId === id)?.[0])
        .filter(Boolean)
        .join(", ");
      return t("{mediaType}: {names}", {
        mediaType: trigger.mediaType === "movie" ? t("Movies") : t("Series"),
        names,
      });
    }
    case "fromProvider":
      return trigger.providerIds.length === 0
        ? t("Any streamer")
        : trigger.providerIds
            .map((id) => PROVIDERS.find((provider) => provider.id === id)?.name)
            .filter(Boolean)
            .join(", ");
    case "fromCountry":
      return trigger.countryCodes.length === 0
        ? t("Any country")
        : trigger.countryCodes
            .map((code) => COUNTRIES.find((country) => country.code === code)?.name ?? code)
            .join(", ");
    case "fromTraktAnticipated":
      return t("Trakt anticipated");
    case "fromTraktWatchlist":
      return t("Your Trakt watchlist");
    case "liveTvEvent":
      return t("Live TV · {scope} · {minutes} min lead", {
        scope: trigger.favoritesOnly ? t("favorites") : t("all channels"),
        minutes: trigger.leadMinutes ?? 15,
      });
  }
}

function genId(): string {
  return `rule-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function RuleBuilder({
  rules,
  onChange,
  trackedPeople,
  canDiscord,
  canTelegram,
}: {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  trackedPeople: TrackedPerson[];
  canDiscord: boolean;
  canTelegram: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState<Rule | null>(null);

  const upsert = (rule: Rule) => {
    const exists = rules.some((r) => r.id === rule.id);
    onChange(exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]);
    setEditing(null);
  };
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));
  const toggleEnabled = (id: string) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const startNew = () =>
    setEditing({
      id: genId(),
      name: "",
      enabled: true,
      trigger: { event: "newMovie" },
      channels: { discord: canDiscord, telegram: false },
    });

  return (
    <section
      id={settingsAnchor(t("Automations"))}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl bg-elevated p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-[19px] font-medium tracking-tight text-ink">
            <AutomationsIcon className="text-ink-muted" />
            {t("Automations")}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {t("Each rule fires independently. Define what triggers a ping and where it goes.")}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startNew}
            disabled={!canDiscord && !canTelegram}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2.4} />
            {t("New rule")}
          </button>
        )}
      </div>
      {editing ? (
        <RuleEditor
          rule={editing}
          isNew={!rules.some((r) => r.id === editing.id)}
          trackedPeople={trackedPeople}
          canDiscord={canDiscord}
          canTelegram={canTelegram}
          onSave={upsert}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {!canDiscord && !canTelegram && (
            <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-[11.5px] text-accent/85">
              {t("Add a Discord or Telegram URL above before creating rules.")}
            </div>
          )}
          {rules.length === 0 ? (
            <div className="harbor-rise rounded-md border border-dashed border-edge-soft/60 bg-canvas px-3 py-7 text-center text-[12.5px] text-ink-subtle">
              {t("No automations yet. Hit New rule to wire one up.")}
            </div>
          ) : (
            <ul className="harbor-rise flex flex-col">
              {rules.map((r) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  trackedPeople={trackedPeople}
                  onToggle={() => toggleEnabled(r.id)}
                  onEdit={() => setEditing(r)}
                  onRemove={() => remove(r.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RuleRow({
  rule,
  trackedPeople,
  onToggle,
  onEdit,
  onRemove,
}: {
  rule: Rule;
  trackedPeople: TrackedPerson[];
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const t = useT();
  const del = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onRemove, 200);
  };
  return (
    <li
      className={`harbor-rise grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
        leaving
          ? "[grid-template-rows:0fr] -translate-x-1 opacity-0"
          : "[grid-template-rows:1fr] opacity-100"
      }`}
    >
      <div className="overflow-hidden">
        <div
          className={`mb-2 flex items-center gap-3 rounded-md border px-3.5 py-2.5 transition-colors ${
            rule.enabled ? "border-edge-soft bg-canvas" : "border-edge-soft/40 bg-canvas opacity-60"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={rule.enabled ? t("Disable rule") : t("Enable rule")}
            className="shrink-0"
          >
            <span
              className={`relative block h-5 w-9 rounded-full transition-colors ${
                rule.enabled ? "bg-ink" : "bg-edge"
              }`}
            >
              <span
                className={`absolute start-0 top-0.5 block h-4 w-4 rounded-full bg-canvas transition-transform ${
                  rule.enabled
                    ? "translate-x-[18px] rtl:-translate-x-[18px]"
                    : "translate-x-0.5 rtl:-translate-x-0.5"
                }`}
              />
            </span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold text-ink">
              {rule.name || t(EVENT_LABELS[rule.trigger.event])}
            </span>
            <span className="truncate text-[11.5px] text-ink-subtle">
              {describeTrigger(rule.trigger, trackedPeople, t)} →{" "}
              {[rule.channels.discord && "Discord", rule.channels.telegram && "Telegram"]
                .filter(Boolean)
                .join(" + ") || t("no channel")}
            </span>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-ink-muted hover:bg-canvas hover:text-ink"
          >
            {t("Edit")}
          </button>
          <button
            type="button"
            onClick={del}
            aria-label={t("Delete rule")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
          >
            <Trash2 size={12} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </li>
  );
}

function RuleEditor({
  rule,
  isNew,
  trackedPeople,
  canDiscord,
  canTelegram,
  onSave,
  onCancel,
}: {
  rule: Rule;
  isNew: boolean;
  trackedPeople: TrackedPerson[];
  canDiscord: boolean;
  canTelegram: boolean;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Rule>(rule);
  const t = useT();

  const setEvent = (event: WebhookTrigger["event"]) => {
    setDraft((d) => ({ ...d, trigger: defaultTrigger(event) }));
  };

  return (
    <div className="harbor-rise flex flex-col gap-5 rounded-md bg-canvas p-5">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        {isNew ? t("New rule") : t("Edit rule")}
      </span>

      <Field label={t("Name")}>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={t(EVENT_LABELS[draft.trigger.event])}
          maxLength={80}
          className="h-11 w-full rounded-md bg-canvas px-3.5 text-[13px] text-ink placeholder:text-ink-subtle outline-none transition-colors focus:bg-elevated"
        />
      </Field>

      <Field label={t("WHEN")}>
        <select
          value={draft.trigger.event}
          onChange={(e) => setEvent(e.target.value as WebhookTrigger["event"])}
          className="h-11 w-full rounded-md bg-canvas px-3 text-[13px] text-ink outline-none transition-colors focus:bg-elevated"
        >
          {EVENT_ORDER.map((ev) => (
            <option key={ev} value={ev}>
              {t(EVENT_LABELS[ev])}
            </option>
          ))}
        </select>
      </Field>

      {draft.trigger.event === "fromGenre" && (
        <TriggerSubFields>
          <SubSelect
            label={t("Media type")}
            value={draft.trigger.mediaType}
            options={[
              { value: "movie", label: t("Movies") },
              { value: "tv", label: t("Series") },
            ]}
            onChange={(v) =>
              setDraft({
                ...draft,
                trigger: {
                  ...(draft.trigger as Extract<WebhookTrigger, { event: "fromGenre" }>),
                  mediaType: v as "movie" | "tv",
                },
              })
            }
          />
          <SubChips
            label={t("Genres")}
            items={Object.entries(MOVIE_GENRES).map(([name, id]) => ({
              key: String(id),
              label: name,
              selected: (
                draft.trigger as Extract<WebhookTrigger, { event: "fromGenre" }>
              ).genreIds.includes(id),
              onToggle: () => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "fromGenre" }>;
                const next = t.genreIds.includes(id)
                  ? t.genreIds.filter((x) => x !== id)
                  : [...t.genreIds, id];
                setDraft({ ...draft, trigger: { ...t, genreIds: next } });
              },
            }))}
          />
        </TriggerSubFields>
      )}

      {draft.trigger.event === "fromProvider" && (
        <TriggerSubFields>
          <SubChips
            label={t("Streamers")}
            items={PROVIDERS.map((p) => ({
              key: String(p.id),
              label: p.name,
              selected: (
                draft.trigger as Extract<WebhookTrigger, { event: "fromProvider" }>
              ).providerIds.includes(p.id),
              onToggle: () => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "fromProvider" }>;
                const next = t.providerIds.includes(p.id)
                  ? t.providerIds.filter((x) => x !== p.id)
                  : [...t.providerIds, p.id];
                setDraft({ ...draft, trigger: { ...t, providerIds: next } });
              },
            }))}
          />
        </TriggerSubFields>
      )}

      {draft.trigger.event === "fromCountry" && (
        <TriggerSubFields>
          <SubChips
            label={t("Countries")}
            items={COUNTRIES.map((c) => ({
              key: c.code,
              label: c.name,
              selected: (
                draft.trigger as Extract<WebhookTrigger, { event: "fromCountry" }>
              ).countryCodes.includes(c.code),
              onToggle: () => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "fromCountry" }>;
                const next = t.countryCodes.includes(c.code)
                  ? t.countryCodes.filter((x) => x !== c.code)
                  : [...t.countryCodes, c.code];
                setDraft({ ...draft, trigger: { ...t, countryCodes: next } });
              },
            }))}
          />
        </TriggerSubFields>
      )}

      {draft.trigger.event === "liveTvEvent" && (
        <TriggerSubFields>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={
                (draft.trigger as Extract<WebhookTrigger, { event: "liveTvEvent" }>)
                  .favoritesOnly !== false
              }
              onChange={(e) => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "liveTvEvent" }>;
                setDraft({ ...draft, trigger: { ...t, favoritesOnly: e.target.checked } });
              }}
              className="h-4 w-4 accent-ink"
            />
            <span className="text-[12.5px] text-ink">{t("Only my favorited channels")}</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-[140px] shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("Heads up")}
            </span>
            <select
              value={String(
                (draft.trigger as Extract<WebhookTrigger, { event: "liveTvEvent" }>).leadMinutes ??
                  15,
              )}
              onChange={(e) => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "liveTvEvent" }>;
                setDraft({ ...draft, trigger: { ...t, leadMinutes: Number(e.target.value) } });
              }}
              className="h-9 flex-1 rounded-md bg-canvas px-3 text-[12.5px] text-ink outline-none focus:border-ink"
            >
              {[5, 10, 15, 30, 60, 120].map((m) => (
                <option key={m} value={m}>
                  {m < 60
                    ? t("{n} minutes before", { n: m })
                    : m === 60
                      ? t("1 hour before")
                      : t("{n} hours before", { n: m / 60 })}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11.5px] text-ink-subtle">
            {t("Harbor scans your IPTV playlists' EPG every 30 min for programs about to start.")}
          </p>
        </TriggerSubFields>
      )}

      {draft.trigger.event === "fromTrackedPerson" && trackedPeople.length === 0 && (
        <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px] text-accent/85">
          {t("Add people in the Custom calendar manager first, then come back here.")}
        </div>
      )}

      {draft.trigger.event === "fromTrackedPerson" && trackedPeople.length > 0 && (
        <TriggerSubFields>
          <SubChips
            label={t("People (empty = all tracked)")}
            items={trackedPeople.map((p) => ({
              key: String(p.id),
              label: p.name,
              selected: (
                (draft.trigger as Extract<WebhookTrigger, { event: "fromTrackedPerson" }>)
                  .personIds ?? []
              ).includes(p.id),
              onToggle: () => {
                const t = draft.trigger as Extract<WebhookTrigger, { event: "fromTrackedPerson" }>;
                const cur = t.personIds ?? [];
                const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id];
                setDraft({ ...draft, trigger: { ...t, personIds: next } });
              },
            }))}
          />
        </TriggerSubFields>
      )}

      <Field label={t("THEN notify on")}>
        <div className="flex gap-2">
          <ChannelToggle
            label="Discord"
            on={draft.channels.discord}
            disabled={!canDiscord}
            onToggle={() =>
              setDraft({
                ...draft,
                channels: { ...draft.channels, discord: !draft.channels.discord },
              })
            }
          />
          <ChannelToggle
            label="Telegram"
            on={draft.channels.telegram}
            disabled={!canTelegram}
            onToggle={() =>
              setDraft({
                ...draft,
                channels: { ...draft.channels, telegram: !draft.channels.telegram },
              })
            }
          />
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!draft.channels.discord && !draft.channels.telegram}
          className="h-10 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("Save rule")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

function TriggerSubFields({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-md /60 bg-canvas p-3.5">{children}</div>;
}

function SubSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[100px] shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 flex-1 rounded-md bg-canvas px-3 text-[12.5px] text-ink outline-none focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubChips({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; label: string; selected: boolean; onToggle: () => void }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={it.onToggle}
            className={`h-7 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
              it.selected
                ? "border-accent bg-accent-soft text-accent"
                : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChannelToggle({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      aria-pressed={on}
      className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[12.5px] font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed border-edge-soft/40 text-ink-subtle opacity-60"
          : on
            ? "border-ink bg-ink text-canvas"
            : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
      }`}
      title={disabled ? t("Configure URL above first") : undefined}
    >
      {label}
    </button>
  );
}
