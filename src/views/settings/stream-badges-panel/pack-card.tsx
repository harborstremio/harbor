import { useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { type CommunityPack } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "../kit";
import { ROW_DESC } from "../shared";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

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
    <div className="flex flex-col gap-3 rounded-[10px] border border-edge-soft bg-elevated p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">
          <span className="min-w-0">{pack.name}</span>
          <span className={`${QUAL} bg-raised text-ink-subtle`}>
            {pack.kind === "art" ? t("Art remap") : t("Ruleset")}
          </span>
        </span>
        <span className="text-[15.5px] leading-[22px] text-ink-muted">
          {t("by {name}", { name: pack.author })} · {pack.count}
        </span>
      </div>
      {pack.previews.length > 0 && (
        <div className="flex h-11 items-center gap-3 overflow-hidden rounded-[10px] bg-canvas px-3">
          {pack.previews.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="h-7 w-auto max-w-[80px] shrink-0 object-contain"
              draggable={false}
            />
          ))}
        </div>
      )}
      <p className={`min-h-[44px] ${ROW_DESC}`}>{pack.description}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (!busy) onInstall();
          }}
          aria-busy={busy}
          className={`${installed ? ROW_ACTION : ROW_ACTION_PRIMARY} flex-1 justify-center`}
        >
          {installed ? <Check size={18} strokeWidth={2.6} /> : <Download size={18} />}
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
            className={`${ROW_ACTION} ${copied ? "border-accent/45 text-accent" : ""}`}
          >
            {copied ? <Check size={18} strokeWidth={2.6} /> : <Link2 size={18} />}
            {copied ? t("Copied") : t("Use in Nuvio")}
          </button>
        )}
      </div>
    </div>
  );
}
