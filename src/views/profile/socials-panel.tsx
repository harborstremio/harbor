import { AtSign, Check, Copy, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { openLinkOut } from "@/lib/social/link-out";
import { getService, iconColor, resolveUrl, SocialIcon, type SocialKey } from "@/lib/social/socials";
import type { ProfileSummary, SocialEntry } from "./profile-types";
import { SocialsEditor } from "./socials-editor";

function ChipIcon({ service }: { service: SocialKey }) {
  const color = iconColor(service);
  return (
    <span
      className={`relative inline-flex shrink-0 ${color ? "" : "text-ink-muted transition-colors group-hover:text-ink"}`}
      style={color ? { color } : undefined}
    >
      <SocialIcon service={service} size={16} />
    </span>
  );
}

function ChipShell({ children, service }: { children: React.ReactNode; service: SocialKey }) {
  const svc = getService(service);
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-[0.14]"
        style={{ backgroundColor: svc?.brand }}
      />
      {children}
    </>
  );
}

function LinkChip({ service, value }: SocialEntry) {
  const svc = getService(service);
  const url = svc ? resolveUrl(service, value) : null;
  if (!svc || !url) return null;
  return (
    <button
      type="button"
      onClick={() => openLinkOut(url)}
      title={svc.label}
      className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full bg-elevated px-3 ring-1 ring-edge-soft transition-colors hover:bg-raised"
    >
      <ChipShell service={service}>
        <ChipIcon service={service} />
        <span className="relative max-w-[168px] truncate text-[13px] font-medium text-ink">{value}</span>
      </ChipShell>
    </button>
  );
}

function CopyChip({ service, value }: SocialEntry) {
  const t = useT();
  const svc = getService(service);
  const [copied, setCopied] = useState(false);
  if (!svc) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={t("Copy {label} handle", { label: svc.label })}
      className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full bg-elevated px-3 ring-1 ring-edge-soft transition-colors hover:bg-raised"
    >
      <ChipShell service={service}>
        <ChipIcon service={service} />
        <span className="relative max-w-[168px] truncate text-[13px] font-medium text-ink">{value}</span>
        <span className="relative text-ink-subtle">
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </span>
      </ChipShell>
    </button>
  );
}

export function SocialsPanel({
  socials,
  isOwner,
  onSaved,
}: {
  socials?: readonly SocialEntry[];
  isOwner: boolean;
  onSaved: (summary: ProfileSummary) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const entries = (socials ?? [])
    .filter((s) => !!getService(s.service))
    .slice(0, 12)
    .map((s) => ({ service: s.service as SocialKey, value: s.value }));

  if (!isOwner && entries.length === 0) return null;

  return (
    <section aria-label={t("Socials")} className="rounded-lg bg-surface p-4 ring-1 ring-edge-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <AtSign size={20} /> {t("Socials")}
        </div>
        {isOwner && entries.length > 0 && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-elevated px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
          >
            <Pencil size={14} /> {t("Edit")}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        isOwner ? (
          <button
            onClick={() => setEditing(true)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-dashed border-edge text-[13px] font-medium text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <Plus size={16} /> {t("Add your social links")}
          </button>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((s, i) =>
            resolveUrl(s.service, s.value) ? (
              <LinkChip key={`${s.service}-${i}`} service={s.service} value={s.value} />
            ) : (
              <CopyChip key={`${s.service}-${i}`} service={s.service} value={s.value} />
            ),
          )}
        </div>
      )}

      {editing && (
        <SocialsEditor
          initial={entries}
          onClose={() => setEditing(false)}
          onSaved={(summary) => {
            onSaved(summary);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}
