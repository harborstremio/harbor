import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import {
  FormatBadge,
  RuleBadgeChip,
  streamBadges,
  type BadgeKind,
} from "@/components/format-badge";
import { parseStream } from "@/lib/streams/parser/parser-stream";
import { emitListToast } from "@/components/lists/list-toast";
import { matchRules, setBadgeOverride, setBadgeRules, useBadgeState } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingGroup, SettingRow } from "../kit";
import { ConfirmButton } from "./confirm-button";
import { KindEditorModal } from "./kind-editor-modal";
import { RemapRow, RuleRow } from "./rule-rows";

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
  const [sample, setSample] = useState("Movie.2026.2160p.WEB-DL.DV.Atmos.x265-GROUP");
  const matched = matchRules(sample);
  const previewKinds = useMemo(() => {
    try {
      return streamBadges(
        parseStream({ name: sample, title: sample, addonId: "preview", addonName: "preview" }),
      );
    } catch {
      return [] as BadgeKind[];
    }
  }, [sample]);

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

  const setAll = (enabled: boolean) => {
    const ids = new Set(filtered.map((r) => r.id));
    setBadgeRules(rules.map((r) => (ids.has(r.id) ? { ...r, enabled } : r)));
  };

  const add = () => {
    if (!name.trim() || !pattern.trim()) return;
    setBadgeRules([
      {
        id: `user-${Date.now()}`,
        name: name.trim(),
        pattern: pattern.trim(),
        enabled: true,
        image: image.trim() || undefined,
        tagColor: image.trim() ? undefined : "#2a2a2a",
        textColor: image.trim() ? undefined : "#ffffff",
        tagStyle: "filled",
      },
      ...rules,
    ]);
    setName("");
    setPattern("");
    setImage("");
  };

  return (
    <Section
      title={t("Custom rules")}
      subtitle={t("Your own badges, matched against the stream's name with a pattern. Great for release groups, providers, or anything the built-in badges don't cover. Imported packs land here too.")}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-elevated px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search rules by name or pattern…")}
            className="h-10 w-full rounded-md bg-canvas ps-10 pe-3.5 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>
        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-subtle">
          {t("{n} rules · {m} on", { n: rules.length, m: enabledCount })}
        </span>
        {filtered.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setAll(true)}
              className="h-9 rounded-md px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              {t("Enable all")}
            </button>
            <button
              onClick={() => setAll(false)}
              className="h-9 rounded-md px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              {t("Disable all")}
            </button>
          </div>
        )}
        {rules.length > 0 && (
          <ConfirmButton
            label={t("Clear all")}
            confirmLabel={t("Tap again to delete {n} rules", { n: rules.length })}
            onConfirm={() => {
              setBadgeRules([]);
              emitListToast(t("All custom rules removed"));
            }}
          />
        )}
      </div>

      {remaps.length > 0 && (
        <SettingGroup label={`${t("Badge remaps")} · ${remaps.length}`}>
          <div className="flex justify-end">
            <ConfirmButton
              label={t("Reset all")}
              confirmLabel={t("Tap again to reset {n}", { n: remaps.length })}
              onConfirm={() => {
                for (const k of remaps) setBadgeOverride(k, null);
                emitListToast(t("Badge art back to default"));
              }}
            />
          </div>
          <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
            {remaps.map((k) => (
              <RemapRow
                key={k}
                kind={k}
                hidden={!!overrides[k]?.hidden}
                onEdit={() => setEditKind(k)}
                onRemove={() => setBadgeOverride(k, null)}
              />
            ))}
          </div>
        </SettingGroup>
      )}

      {editKind && <KindEditorModal kind={editKind} onClose={() => setEditKind(null)} />}

      {rules.length === 0 ? (
        <p className="rounded-md bg-elevated px-4 py-6 text-center text-[13px] text-ink-subtle">
          {t("No custom rules yet. Add one below, or install a pack to bring some in.")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md bg-elevated px-4 py-6 text-center text-[13px] text-ink-subtle">
          {t("No rules match your search.")}
        </p>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
          {filtered.map((r) => (
            <RuleRow key={r.id} rule={r} all={rules} />
          ))}
        </div>
      )}

      <SettingRow wide label={t("New rule")}>
        <div className="flex w-full flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Name (e.g. REMUX)")}
            className="h-10 w-40 rounded-md bg-canvas px-3.5 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t("Pattern (e.g. \\bremux\\b)")}
            className="h-10 min-w-0 flex-1 rounded-md bg-canvas px-3.5 font-mono text-[12.5px] text-ink outline-none placeholder:font-sans placeholder:text-ink-subtle"
          />
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder={t("Image URL (optional)")}
            className="h-10 w-48 rounded-md bg-canvas px-3.5 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
          <button
            onClick={add}
            disabled={!name.trim() || !pattern.trim()}
            className="harbor-press-pop inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2.4} />
            {t("Add rule")}
          </button>
        </div>
      </SettingRow>

      <SettingRow wide label={t("Try it")}>
        <div className="flex w-full flex-col gap-2">
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="h-10 w-full rounded-md bg-canvas px-3.5 font-mono text-[12.5px] text-ink outline-none"
          />
          <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
            {previewKinds.length === 0 && matched.length === 0 ? (
              <span className="text-[12.5px] text-ink-subtle">{t("No badges match this title.")}</span>
            ) : (
              <>
                {previewKinds.map((k) => (
                  <FormatBadge key={k} kind={k} size="md" />
                ))}
                {matched.map((r) => (
                  <RuleBadgeChip key={r.id} rule={r} size="md" />
                ))}
              </>
            )}
          </div>
        </div>
      </SettingRow>
    </Section>
  );
}
