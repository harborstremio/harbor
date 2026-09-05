import { useMemo, useRef, useState } from "react";
import { Info, Plus } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { setBadgeOverride, setBadgeRules, useBadgeState } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section } from "../shared";
import { ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { SButton, SSection } from "../ui";
import { usePageActions, type PageAction } from "../page-actions";
import { handoffFocus } from "./focus-handoff";
import { KindEditorModal } from "./kind-editor-modal";
import { RemapRow, RuleRow } from "./rule-rows";
import { SAMPLE_TITLE, StreamRowPreview } from "./stream-row-preview";

const FIELD =
  "h-11 min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const COUNT_TAG = "harbor-settings-label tabular-nums";

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 py-3">
      <Info size={18} className="shrink-0 text-ink-subtle" />
      <p className={`max-w-[66ch] ${ROW_DESC}`}>{children}</p>
    </div>
  );
}

export function RulesTab() {
  const t = useT();
  const { rules, overrides } = useBadgeState();
  const [editKind, setEditKind] = useState<BadgeKind | null>(null);
  const remaps = useMemo(
    () =>
      (Object.keys(overrides) as BadgeKind[]).filter(
        (k) => overrides[k]?.image || overrides[k]?.hidden,
      ),
    [overrides],
  );
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [image, setImage] = useState("");
  const [sample, setSample] = useState(SAMPLE_TITLE);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const resetRefs = useRef(new Map<BadgeKind, HTMLButtonElement>());

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? rules.filter(
            (r) => r.name.toLowerCase().includes(q) || r.pattern.toLowerCase().includes(q),
          )
        : rules,
    [rules, q],
  );
  const enabledCount = rules.filter((r) => r.enabled).length;
  const [armed, setArmed] = useState<string | null>(null);

  const arm = (id: string, run: () => void) => {
    if (armed !== id) {
      setArmed(id);
      window.setTimeout(() => setArmed((a) => (a === id ? null : a)), 3000);
      return;
    }
    setArmed(null);
    run();
  };

  const actions: PageAction[] = [];
  if (rules.length > 0) {
    actions.push({
      id: "rules-clear",
      tone: "danger",
      label: armed === "rules-clear" ? "Tap again to clear" : "Delete every rule",
      onSelect: () =>
        arm("rules-clear", () =>
          handoffFocus(() => {
            setBadgeRules([]);
            emitListToast(t("All custom rules removed"));
          }, searchRef.current),
        ),
    });
  }
  if (remaps.length > 0) {
    actions.push({
      id: `remaps-reset-${remaps.length}`,
      tone: "danger",
      label: armed === "remaps-reset" ? "Tap again to reset" : "Reset every remap",
      onSelect: () =>
        arm("remaps-reset", () =>
          handoffFocus(() => {
            for (const k of remaps) setBadgeOverride(k, null);
            emitListToast(t("Badge art back to default"));
          }, nameRef.current),
        ),
    });
  }
  usePageActions(actions, armed ? "There is no undo for this." : undefined);

  const setAll = (enabled: boolean) => {
    const ids = new Set(filtered.map((r) => r.id));
    setBadgeRules(rules.map((r) => (ids.has(r.id) ? { ...r, enabled } : r)));
  };

  const ready = !!name.trim() && !!pattern.trim();

  const add = () => {
    if (!ready) return;
    handoffFocus(() => {
      setBadgeRules([
        {
          id: `user-${Date.now()}`,
          name: name.trim(),
          pattern: pattern.trim(),
          enabled: true,
          image: image.trim() || undefined,
          tagColor: image.trim() ? undefined : "var(--color-raised)",
          textColor: image.trim() ? undefined : "var(--color-ink)",
          tagStyle: "filled",
        },
        ...rules,
      ]);
      setName("");
      setPattern("");
      setImage("");
    }, nameRef.current);
  };

  const closeEditor = (kind: BadgeKind) => {
    if (remaps.includes(kind)) {
      setEditKind(null);
      return;
    }
    const next = remaps[0] ? resetRefs.current.get(remaps[0]) : null;
    handoffFocus(() => setEditKind(null), next ?? nameRef.current);
  };

  return (
    <Section
      title={t("Custom rules")}
      subtitle={t("Your own badges, matched against the stream's name with a pattern. Great for release groups, providers, or anything the built-in badges don't cover. Imported packs land here too.")}
    >
      <SSection
        action={
          rules.length > 0 ? (
            <span className={COUNT_TAG}>
              {t("{m} of {n} on", { m: enabledCount, n: rules.length })}
            </span>
          ) : undefined
        }
      >
        <SettingRow
          wide
          label={t("Search rules")}
          desc={t("Narrow the list below by rule name or by the pattern text.")}
        >
          <div className="relative w-full max-w-[520px]">
            <Search
              size={18}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Name or pattern")}
              className={`${FIELD} w-full ps-12`}
            />
          </div>
        </SettingRow>

        {rules.length > 0 && (
          <SettingRow
            label={t("All listed rules")}
            desc={t("Switch every rule the list currently shows. With a search active this only touches the matches.")}
          >
            <SButton onClick={() => setAll(true)}>{t("Enable all")}</SButton>
            <SButton onClick={() => setAll(false)}>{t("Disable all")}</SButton>
          </SettingRow>
        )}

        {rules.length === 0 ? (
          <Callout>
            {t("No custom rules yet. Add one below, or install a pack to bring some in.")}
          </Callout>
        ) : filtered.length === 0 ? (
          <Callout>{t("No rules match your search.")}</Callout>
        ) : (
          filtered.map((r) => <RuleRow key={r.id} rule={r} all={rules} />)
        )}
      </SSection>

      {remaps.length > 0 && (
        <SSection
          label={t("Badge remaps")}
          action={<span className={COUNT_TAG}>{remaps.length}</span>}
        >
          {remaps.map((k) => (
            <RemapRow
              key={k}
              kind={k}
              hidden={!!overrides[k]?.hidden}
              resetRef={(el) => {
                if (el) resetRefs.current.set(k, el);
                else resetRefs.current.delete(k);
              }}
              onEdit={() => setEditKind(k)}
              onRemove={() => handoffFocus(() => setBadgeOverride(k, null))}
            />
          ))}
        </SSection>
      )}

      {editKind && <KindEditorModal kind={editKind} onClose={() => closeEditor(editKind)} />}

      <SSection label={t("Add a rule")}>
        <SettingRow
          wide
          label={t("Rule name")}
          desc={t("The text Harbor prints on the badge, for example REMUX.")}
        >
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Name of the badge")}
            className={`${FIELD} w-full max-w-[520px]`}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Pattern to match")}
          desc={t("A regular expression Harbor tests against each stream title. Every stream that matches gets this badge.")}
        >
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\bremux\b"
            spellCheck={false}
            className={`${FIELD} w-full max-w-[520px] font-mono`}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Image address")}
          desc={t("Optional. Point at a png, webp, or svg to show a picture instead of a text badge.")}
        >
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/remux.png"
            spellCheck={false}
            className={`${FIELD} w-full max-w-[520px]`}
          />
        </SettingRow>

        <SettingRow
          label={t("Save the rule")}
          desc={t("Adds it to the top of your list, already switched on.")}
        >
          <button
            type="button"
            onClick={add}
            aria-disabled={!ready}
            className={`${ROW_ACTION_PRIMARY} ${ready ? "" : "opacity-40"}`}
          >
            <Plus size={18} strokeWidth={2.4} />
            {t("Add rule")}
          </button>
        </SettingRow>
      </SSection>

      <SSection label={t("Test a stream title")}>
        <SettingRow
          wide
          label={t("Sample title")}
          desc={t("Type any release name here to see what Harbor would badge it with.")}
        >
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            spellCheck={false}
            className={`${FIELD} w-full max-w-[520px] font-mono`}
          />
        </SettingRow>

        <StreamRowPreview
          sample={sample}
          detail={sample}
          caption={t("Built-in format chips first, then any of your rules that match.")}
        />
      </SSection>
    </Section>
  );
}

