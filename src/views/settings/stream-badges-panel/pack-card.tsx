import { useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { type CommunityPack } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";

export function PackCard({
  pack,
  busy,
  installed,
  onInstall,
}: {
  pack: CommunityPack;
  busy: boolean;
  installed: boolean;
  onInstall: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-md bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[14.5px] font-semibold text-ink">{pack.name}</span>
          <span className="text-[12.5px] text-ink-subtle">
            {t("by {name}", { name: pack.author })} · {pack.count}
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">
          {pack.kind === "art" ? t("Art remap") : t("Ruleset")}
        </span>
      </div>
      {pack.previews.length > 0 && (
        <div className="flex h-9 items-center gap-3 overflow-hidden rounded-md bg-canvas px-3">
          {pack.previews.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="h-6 w-auto max-w-[72px] shrink-0 object-contain"
              draggable={false}
            />
          ))}
        </div>
      )}
      <p className="min-h-[34px] text-[12.5px] leading-snug text-ink-muted">{pack.description}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onInstall}
          disabled={busy}
          className={`harbor-press-pop inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
            installed ? "bg-raised text-ink-muted" : "bg-ink text-canvas"
          }`}
        >
          {installed ? <Check size={14} strokeWidth={2.6} /> : <Download size={14} />}
          {busy ? t("Installing…") : installed ? t("Reinstall") : t("Install")}
        </button>
        {pack.kind === "nuvio" && pack.author === "Harbor" && (
          <button
            type="button"
            title={pack.url}
            onClick={() => {
              void navigator.clipboard?.writeText(pack.url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors ${
              copied ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted hover:text-ink"
            }`}
          >
            {copied ? <Check size={14} strokeWidth={2.6} /> : <Link2 size={14} />}
            {copied ? t("Copied") : t("Use in Nuvio")}
          </button>
        )}
      </div>
    </div>
  );
}
