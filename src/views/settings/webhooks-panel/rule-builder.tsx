import { Check, ChevronRight, Info, Plus, Trash2 } from "../icons";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useT } from "@/lib/i18n";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { Dropdown } from "@/components/dropdown";
import type { Settings, WebhookTrigger } from "@/lib/settings";
import { ROW_DESC, Section, Segmented, ToggleRow } from "../shared";
import { ModalButton, ROW_ACTION_DANGER, SettingGroup, SettingRow, SettingsModal } from "../kit";
import { usePageActions } from "../page-actions";
import { SButton, SRow } from "../ui";

type Rule = Settings["webhookRules"][number];
type TrackedPerson = Settings["customCalendar"]["trackedPeople"][number];
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const CHIP_BASE =
  "harbor-press-pop flex h-11 shrink-0 items-center gap-2 rounded-[8px] border px-4 text-[15.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const TEXT_INPUT =
  "h-11 w-full min-w-0 max-w-[520px] rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

const LEAD_MINUTES = [5, 10, 15, 30, 60, 120];

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

function leadLabel(m: number, t: Translate): string {
  if (m < 60) return t("{n} minutes before", { n: m });
  if (m === 60) return t("1 hour before");
  return t("{n} hours before", { n: m / 60 });
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
      return t("Live TV, {scope}, {minutes} min lead", {
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
  onSetUp,
}: {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  trackedPeople: TrackedPerson[];
  canDiscord: boolean;
  canTelegram: boolean;
  onSetUp: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<Rule | null>(null);
  const noChannel = !canDiscord && !canTelegram;

  const listRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ring = useRef(false);
  const returnId = useRef<string | null>(null);
  const editingId = editing?.id ?? null;

  const arm = (id: string | null) => {
    const el = document.activeElement;
    ring.current = el instanceof HTMLElement && navOwnsFocus(el);
    returnId.current = id;
  };

  useLayoutEffect(() => {
    if (!ring.current) return;
    ring.current = false;
    if (editingId) {
      if (nameRef.current) tvFocus(nameRef.current);
      return;
    }
    const at = rules.findIndex((r) => r.id === returnId.current);
    const rows = listRef.current?.parentElement?.querySelectorAll<HTMLElement>(".harbor-rule-row");
    const target =
      (at >= 0 ? rows?.[at] : null) ??
      listRef.current?.querySelector<HTMLElement>("button:not([disabled])") ??
      rows?.[0];
    if (target) tvFocus(target);
  }, [editingId, rules]);

  const upsert = (rule: Rule) => {
    const exists = rules.some((r) => r.id === rule.id);
    arm(rule.id);
    onChange(exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]);
    setEditing(null);
  };
  const remove = (id: string) => {
    arm(null);
    onChange(rules.filter((r) => r.id !== id));
    setEditing(null);
  };
  const cancel = () => {
    arm(editingId);
    setEditing(null);
  };

  const startEdit = (rule: Rule) => {
    arm(rule.id);
    setEditing(rule);
  };

  const startNew = () => {
    arm(null);
    setEditing({
      id: genId(),
      name: "",
      enabled: true,
      trigger: { event: "newMovie" },
      channels: { discord: canDiscord, telegram: !canDiscord && canTelegram },
    });
  };

  return (
    <Section
      title={t("Automations")}
      subtitle={t(
        "Choose which releases trigger an alert and where each alert goes.",
      )}
    >
      {editing ? (
        <RuleEditor
          rule={editing}
          isNew={!rules.some((r) => r.id === editing.id)}
          trackedPeople={trackedPeople}
          canDiscord={canDiscord}
          canTelegram={canTelegram}
          nameRef={nameRef}
          onSave={upsert}
          onDelete={() => remove(editing.id)}
          onCancel={cancel}
        />
      ) : (
        <>
          {noChannel && (
            <Callout>
              {t(
                "Add a Discord or Telegram destination first. Rules need somewhere to send their alerts.",
              )}
            </Callout>
          )}
          {rules.length === 0 ? (
            <p className={`max-w-[70ch] ${ROW_DESC}`}>
              {t(
                "No rules yet. Add one to choose which releases you hear about.",
              )}
            </p>
          ) : (
            rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                trackedPeople={trackedPeople}
                onEdit={() => startEdit(r)}
              />
            ))
          )}
          <div ref={listRef} className="flex">
            {noChannel ? <SButton variant="primary" onClick={onSetUp}>{t("Set up a destination")}</SButton> : <SButton variant="primary" onClick={startNew}>
              <Plus size={18} strokeWidth={2.4} className="shrink-0" />
              {t("New rule")}
            </SButton>}
          </div>
        </>
      )}
    </Section>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-[66ch] items-start gap-2.5">
      <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
      <p className={ROW_DESC}>{children}</p>
    </div>
  );
}

function RuleRow({
  rule,
  trackedPeople,
  onEdit,
}: {
  rule: Rule;
  trackedPeople: TrackedPerson[];
  onEdit: () => void;
}) {
  const t = useT();
  const name = rule.name || t(EVENT_LABELS[rule.trigger.event]);
  const channels =
    [rule.channels.discord && "Discord", rule.channels.telegram && "Telegram"]
      .filter(Boolean)
      .join(" + ") || t("nowhere yet");
  return (
    <SRow
      title={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{name}</span>
          {!rule.enabled && (
            <span className={`${QUAL} bg-elevated text-ink-subtle`}>{t("Paused")}</span>
          )}
        </span>
      }
      description={t("{trigger}. Sends to {channels}.", {
        trigger: describeTrigger(rule.trigger, trackedPeople, t),
        channels,
      })}
      trailing={<ChevronRight size={18} className="text-ink-subtle rtl:-scale-x-100" />}
      onClick={onEdit}
      className="harbor-rule-row"
    />
  );
}

function RuleEditor({
  rule,
  isNew,
  trackedPeople,
  canDiscord,
  canTelegram,
  nameRef,
  onSave,
  onDelete,
  onCancel,
}: {
  rule: Rule;
  isNew: boolean;
  trackedPeople: TrackedPerson[];
  canDiscord: boolean;
  canTelegram: boolean;
  nameRef: RefObject<HTMLInputElement | null>;
  onSave: (rule: Rule) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Rule>(rule);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const t = useT();

  const noChannel = !(draft.channels.discord && canDiscord) && !(draft.channels.telegram && canTelegram);
  const live = useRef({ draft, onSave, onDelete, onCancel });
  live.current = { draft, onSave, onDelete, onCancel };

  usePageActions(
    [
      ...(isNew
        ? []
        : [
            {
              id: "webhook-rule-delete",
              label: "Delete rule",
              tone: "danger" as const,
              icon: <Trash2 size={18} strokeWidth={2.2} />,
              onSelect: () => setConfirmDelete(true),
            },
          ]),
      {
        id: "webhook-rule-cancel",
        label: "Cancel",
        onSelect: () => live.current.onCancel(),
      },
      {
        id: "webhook-rule-save",
        label: "Save rule",
        tone: "primary" as const,
        disabled: noChannel,
        onSelect: () => live.current.onSave(live.current.draft),
      },
    ],
    noChannel ? "Pick at least one channel to notify." : undefined,
  );

  const setEvent = (event: WebhookTrigger["event"]) =>
    setDraft((d) => ({ ...d, trigger: defaultTrigger(event) }));

  const genre = draft.trigger.event === "fromGenre" ? draft.trigger : null;
  const provider = draft.trigger.event === "fromProvider" ? draft.trigger : null;
  const country = draft.trigger.event === "fromCountry" ? draft.trigger : null;
  const person = draft.trigger.event === "fromTrackedPerson" ? draft.trigger : null;
  const liveTv = draft.trigger.event === "liveTvEvent" ? draft.trigger : null;

  const setTrigger = (trigger: WebhookTrigger) => setDraft((d) => ({ ...d, trigger }));

  return (
    <>
      <SettingsModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("Delete this rule?")}
        sub={t("{name} will be removed. Alerts from your other rules will continue.", { name: rule.name || t(EVENT_LABELS[rule.trigger.event]) })}
        actions={<><ModalButton ghost onClick={() => setConfirmDelete(false)}>{t("Keep rule")}</ModalButton><button type="button" className={ROW_ACTION_DANGER} onClick={onDelete}>{t("Delete rule")}</button></>}
      >
        <p className={ROW_DESC}>{t("You can also turn off Rule is active to pause it without deleting it.")}</p>
      </SettingsModal>
      <SettingGroup label={isNew ? t("New rule") : t("Edit rule")}>
        <SettingRow
          wide
          label={t("Rule name")}
          desc={t(
            "What this rule is called in your list. Leave it empty and Harbor names it after the trigger.",
          )}
        >
          <input
            aria-label={t("Rule name")}
            ref={nameRef}
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t(EVENT_LABELS[draft.trigger.event])}
            maxLength={80}
            spellCheck={false}
            className={TEXT_INPUT}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Trigger")}
          desc={t("The release Harbor watches for. Everything else on this page narrows it down.")}
        >
          <div className="w-full max-w-[420px]">
            <Dropdown
              size="md"
              value={draft.trigger.event}
              options={EVENT_ORDER.map((ev) => ({ value: ev, label: t(EVENT_LABELS[ev]) }))}
              onChange={(v) => setEvent(v as WebhookTrigger["event"])}
            />
          </div>
        </SettingRow>

        {genre && (
          <SettingRow
            label={t("Media type")}
            desc={t("Decide whether the genres below apply to movies or to series.")}
          >
            <Segmented
              value={genre.mediaType}
              options={[
                { value: "movie", label: t("Movies") },
                { value: "tv", label: t("Series") },
              ]}
              onChange={(v) => setTrigger({ ...genre, mediaType: v })}
            />
          </SettingRow>
        )}

        {liveTv && (
          <ToggleRow
            label={t("Only my favorited channels")}
            sub={t(
              "Turn this on and Harbor watches just the Live TV channels you starred. Off means every channel in your playlists.",
            )}
            value={liveTv.favoritesOnly !== false}
            onChange={(v) => setTrigger({ ...liveTv, favoritesOnly: v })}
          />
        )}

        {liveTv && (
          <SettingRow
            label={t("Heads-up time")}
            desc={t(
              "How far ahead of the start time Harbor pings you. It scans your playlist EPG every 30 minutes.",
            )}
          >
            <div className="w-[280px] max-w-full">
              <Dropdown
                size="md"
                value={String(liveTv.leadMinutes ?? 15)}
                options={LEAD_MINUTES.map((m) => ({ value: String(m), label: leadLabel(m, t) }))}
                onChange={(v) => setTrigger({ ...liveTv, leadMinutes: Number(v) })}
              />
            </div>
          </SettingRow>
        )}
      </SettingGroup>

      {genre && (
        <ChipPicker
          label={t("Genres")}
          hint={t("Pick as many as you like. With none picked, every genre counts.")}
          items={Object.entries(MOVIE_GENRES).map(([name, id]) => ({
            key: String(id),
            label: name,
            selected: genre.genreIds.includes(id),
            onToggle: () =>
              setTrigger({
                ...genre,
                genreIds: genre.genreIds.includes(id)
                  ? genre.genreIds.filter((x) => x !== id)
                  : [...genre.genreIds, id],
              }),
          }))}
        />
      )}

      {provider && (
        <ChipPicker
          label={t("Streamers")}
          hint={t("Pick the services you care about. With none picked, every service counts.")}
          items={PROVIDERS.map((p) => ({
            key: String(p.id),
            label: p.name,
            selected: provider.providerIds.includes(p.id),
            onToggle: () =>
              setTrigger({
                ...provider,
                providerIds: provider.providerIds.includes(p.id)
                  ? provider.providerIds.filter((x) => x !== p.id)
                  : [...provider.providerIds, p.id],
              }),
          }))}
        />
      )}

      {country && (
        <ChipPicker
          label={t("Countries")}
          hint={t("Pick the countries of origin you follow. With none picked, every country counts.")}
          items={COUNTRIES.map((c) => ({
            key: c.code,
            label: c.name,
            selected: country.countryCodes.includes(c.code),
            onToggle: () =>
              setTrigger({
                ...country,
                countryCodes: country.countryCodes.includes(c.code)
                  ? country.countryCodes.filter((x) => x !== c.code)
                  : [...country.countryCodes, c.code],
              }),
          }))}
        />
      )}

      {person && trackedPeople.length === 0 && (
        <Callout>
          {t("Add people in the Custom calendar manager first, then come back to this rule.")}
        </Callout>
      )}

      {person && trackedPeople.length > 0 && (
        <ChipPicker
          label={t("People")}
          hint={t("Pick who this rule watches. With nobody picked, everyone you track counts.")}
          items={trackedPeople.map((p) => {
            const cur = person.personIds ?? [];
            return {
              key: String(p.id),
              label: p.name,
              selected: cur.includes(p.id),
              onToggle: () =>
                setTrigger({
                  ...person,
                  personIds: cur.includes(p.id)
                    ? cur.filter((x) => x !== p.id)
                    : [...cur, p.id],
                }),
            };
          })}
        />
      )}

      <SettingGroup label={t("Then notify")}>
        <ToggleRow
          label="Discord"
          sub={t("Post the alert to the Discord channel set up on the Destinations tab.")}
          value={draft.channels.discord}
          onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, discord: v } })}
          lockReason={
            canDiscord ? undefined : t("Add a Discord webhook URL on the Destinations tab first.")
          }
        />
        <ToggleRow
          label="Telegram"
          sub={t("Send the alert through the Telegram bot set up on the Destinations tab.")}
          value={draft.channels.telegram}
          onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, telegram: v } })}
          lockReason={
            canTelegram ? undefined : t("Add a Telegram bot token on the Destinations tab first.")
          }
        />
      </SettingGroup>

      {!isNew && (
        <SettingGroup label={t("Manage this rule")}>
          <ToggleRow
            label={t("Rule is active")}
            sub={t("Turn this off to keep the rule but stop it sending anything for now.")}
            value={draft.enabled}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
          />
        </SettingGroup>
      )}
    </>
  );
}

function ChipPicker({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: Array<{ key: string; label: string; selected: boolean; onToggle: () => void }>;
}) {
  return (
    <SettingGroup label={label}>
      <p className={`max-w-[70ch] ${ROW_DESC}`}>{hint}</p>
      <div className="flex flex-wrap gap-2.5">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={it.onToggle}
            aria-pressed={it.selected}
            className={`${CHIP_BASE} ${
              it.selected
                ? "border-accent bg-accent-soft text-accent"
                : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {it.selected && <Check size={17} strokeWidth={2.6} className="shrink-0" />}
            {it.label}
          </button>
        ))}
      </div>
    </SettingGroup>
  );
}
