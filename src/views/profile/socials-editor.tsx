import { Check, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getService,
  HANDLE_MAX,
  iconColor,
  MAX_SOCIALS,
  normalizeHandle,
  resolveUrl,
  SERVICES,
  SocialIcon,
  type SocialKey,
} from "@/lib/social/socials";
import { useT } from "@/lib/i18n";
import { saveSocials } from "./profile-api";
import type { ProfileSummary, SocialEntry } from "./profile-types";

function ServiceTile({
  service,
  active,
  added,
  onSelect,
}: {
  service: SocialKey;
  active: boolean;
  added: boolean;
  onSelect: (k: SocialKey) => void;
}) {
  const svc = getService(service);
  const color = iconColor(service);
  if (!svc) return null;
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      title={svc.label}
      aria-pressed={active}
      className={`relative grid h-10 w-10 place-items-center rounded-md ring-1 transition-colors ${
        active ? "bg-raised ring-accent" : "bg-surface ring-edge-soft hover:bg-raised"
      }`}
    >
      <span className={color ? "" : "text-ink-muted"} style={color ? { color } : undefined}>
        <SocialIcon service={service} size={18} />
      </span>
      {added && (
        <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-success text-canvas ring-2 ring-elevated">
          <Check size={9} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function AddedRow({ entry, onRemove }: { entry: SocialEntry; onRemove: () => void }) {
  const t = useT();
  const svc = getService(entry.service);
  const color = iconColor(entry.service);
  if (!svc) return null;
  const url = resolveUrl(entry.service, entry.value);
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface px-3 py-2 ring-1 ring-edge-soft">
      <span className={color ? "shrink-0" : "shrink-0 text-ink-muted"} style={color ? { color } : undefined}>
        <SocialIcon service={entry.service} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{svc.label}</div>
        <div className="truncate text-[12px] text-ink-subtle">
          {url ? url.replace(/^https:\/\//, "") : entry.value}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("Remove {label}", { label: svc.label })}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function SocialsEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: SocialEntry[];
  onClose: () => void;
  onSaved: (summary: ProfileSummary) => void;
}) {
  const t = useT();
  const [list, setList] = useState<SocialEntry[]>(() => initial.slice(0, MAX_SOCIALS));
  const [active, setActive] = useState<SocialKey>(SERVICES[0].key);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeSvc = getService(active);
  const activeColor = iconColor(active);
  const cleaned = normalizeHandle(active, value);
  const existing = list.find((e) => e.service === active);
  const atCap = list.length >= MAX_SOCIALS && !existing;
  const canAdd = cleaned.length > 0 && !atCap;

  const selectService = (k: SocialKey) => {
    setActive(k);
    setValue(list.find((e) => e.service === k)?.value ?? "");
  };

  const add = () => {
    if (!canAdd) return;
    setList((prev) => [...prev.filter((e) => e.service !== active), { service: active, value: cleaned }]);
    setValue("");
  };

  const remove = (k: SocialKey) => {
    setList((prev) => prev.filter((e) => e.service !== k));
    if (k === active) setValue("");
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const summary = await saveSocials(list);
      onSaved(summary);
      onClose();
    } catch (e) {
      setError((e as Error).message || t("Could not save your links."));
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-start justify-center bg-canvas/80 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-[min(94vw,480px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-[19px] font-medium text-ink">{t("Social links")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-5 pt-1 text-[12.5px] text-ink-muted">
          {t("Add up to {max} profiles. Enter your handle only, not the full link.", { max: MAX_SOCIALS })}
        </p>

        <div className="flex flex-col gap-3 px-5 pb-2 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {SERVICES.map((svc) => (
              <ServiceTile
                key={svc.key}
                service={svc.key}
                active={active === svc.key}
                added={list.some((e) => e.service === svc.key)}
                onSelect={selectService}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-md bg-surface px-3 ring-1 ring-edge-soft focus-within:ring-edge">
              <span className={activeColor ? "shrink-0" : "shrink-0 text-ink-subtle"} style={activeColor ? { color: activeColor } : undefined}>
                <SocialIcon service={active} size={16} />
              </span>
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(normalizeHandle(active, e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder={activeSvc?.placeholder}
                maxLength={HANDLE_MAX}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
              />
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!canAdd}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={15} /> {existing ? t("Update") : t("Add")}
            </button>
          </div>
          <div className="flex items-center justify-between px-1 text-[11px] text-ink-subtle">
            <span>{atCap ? t("You have reached the {max} link limit", { max: MAX_SOCIALS }) : t("{label} handle", { label: activeSvc?.label ?? "" })}</span>
            <span className="tabular-nums">
              {value.length}/{HANDLE_MAX}
            </span>
          </div>

          {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">{t("Your links")}</span>
            <span className="text-[12px] tabular-nums text-ink-subtle">
              {list.length}/{MAX_SOCIALS}
            </span>
          </div>
          <div className="flex max-h-[34vh] flex-col gap-1.5 overflow-y-auto">
            {list.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-subtle">{t("No links added yet.")}</p>
            ) : (
              list.map((entry) => (
                <AddedRow key={entry.service} entry={entry} onRemove={() => remove(entry.service)} />
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3">
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t("Saving") : t("Save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
