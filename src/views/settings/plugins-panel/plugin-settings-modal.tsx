import { useEffect, useRef, useState } from "react";
import { Loader2 } from "../icons";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import type { KindAdapter, PluginView, SettingsField } from "@/lib/plugins";
import { ModalButton, SettingGroup, SettingRow, SettingsModal } from "../kit";
import { ToggleRow } from "../shared";
import { errorText } from "./copy";

type Values = Record<string, string | boolean>;

function defaultsOf(fields: SettingsField[], current: Values): Values {
  const out: Values = { ...current };
  for (const f of fields) {
    if (f.type === "header" || f.type === "info") continue;
    if (out[f.key] !== undefined) continue;
    if (f.type === "toggle") out[f.key] = f.defaultValue === true;
    else if (f.type === "select") out[f.key] = f.defaultValue ?? f.options[0]?.value ?? "";
    else out[f.key] = f.defaultValue ?? "";
  }
  return out;
}

export function PluginSettingsModal({
  plugin,
  adapter,
  onClose,
}: {
  plugin: PluginView;
  adapter: KindAdapter;
  onClose: () => void;
}) {
  const t = useT();
  // `useT` hands back a new function on every render, so it cannot be a dependency of the read
  // below: showing what came back renders again, that new function is a changed dependency, and the
  // read starts over — which puts the form back to its loading state and never settles. Held in a
  // ref instead, since it is only needed to report a failure that has already happened.
  const tRef = useRef(t);
  tRef.current = t;
  const [fields, setFields] = useState<SettingsField[] | null>(null);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFields(null);
    setError(null);
    adapter
      .settingsFields?.(plugin.id)
      .then((list) => {
        if (cancelled) return;
        setFields(list);
        setValues(defaultsOf(list, adapter.settingsValues?.(plugin.id) ?? {}));
      })
      .catch((e) => {
        if (cancelled) return;
        setFields([]);
        const say = tRef.current;
        setError(say("This plugin's settings form failed to load: {error}", { error: errorText(say, e) }));
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, plugin.id]);

  const save = async () => {
    if (!fields || !adapter.saveSettings) return;
    setSaving(true);
    try {
      await adapter.saveSettings(plugin.id, values, fields);
      onClose();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, v: string | boolean) => setValues((cur) => ({ ...cur, [key]: v }));

  let group: { label?: string; items: SettingsField[] }[] = [];
  for (const f of fields ?? []) {
    if (f.type === "header") {
      group.push({ label: f.label, items: [] });
      continue;
    }
    if (group.length === 0) group.push({ items: [] });
    group[group.length - 1].items.push(f);
  }
  group = group.filter((g) => g.items.length > 0 || g.label);

  return (
    <SettingsModal
      open
      onClose={onClose}
      title={plugin.name}
      sub={t("Settings this plugin asked for. Stored on this computer only.")}
      width={560}
      actions={
        <>
          <ModalButton ghost onClick={onClose}>
            {t("Cancel")}
          </ModalButton>
          <ModalButton onClick={() => void save()}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save")}
          </ModalButton>
        </>
      }
    >
      {fields === null && (
        <div className="flex items-center gap-2.5 py-6 text-ink-subtle">
          <Loader2 size={17} className="animate-spin" />
          <span className="text-[15px]">{t("Loading plugins...")}</span>
        </div>
      )}
      {error && <p className="text-[14px] leading-[20px] text-danger">{error}</p>}
      {group.map((g, gi) => (
        <SettingGroup key={gi} label={g.label}>
          {g.items.map((f, fi) => {
            if (f.type === "header") return null;
            if (f.type === "info") return <SettingRow key={fi} label={f.label} />;
            if (f.type === "toggle") {
              return (
                <ToggleRow
                  key={f.key}
                  label={f.label}
                  sub={f.description}
                  value={values[f.key] === true}
                  onChange={(v) => set(f.key, v)}
                />
              );
            }
            if (f.type === "select") {
              return (
                <SettingRow key={f.key} label={f.label} desc={f.description}>
                  <Dropdown
                    value={String(values[f.key] ?? "")}
                    options={f.options.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => set(f.key, v)}
                  />
                </SettingRow>
              );
            }
            return (
              <SettingRow key={f.key} wide label={f.label} desc={f.description}>
                <div className="hset-field" dir="ltr">
                  <input
                    type={f.isPassword ? "password" : "text"}
                    value={String(values[f.key] ?? "")}
                    placeholder={f.placeholder}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </div>
              </SettingRow>
            );
          })}
        </SettingGroup>
      ))}
    </SettingsModal>
  );
}
