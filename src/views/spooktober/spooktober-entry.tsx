import { ArrowRight, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import "./spooktober-entry.css";

export function SpooktoberInvitation({ onOpen, onDismiss, onPrepare, collapsed = false }: { onOpen: () => void; onDismiss: () => void; onPrepare?: () => void; collapsed?: boolean }) {
  const t = useT();
  // Dismissing collapses this to a chip rather than removing it: it is the only way into
  // the festival, so removing it would make the season unreachable.
  if (collapsed)
    return (
      <button type="button" data-spooktober-invitation="collapsed" className="spooktober-invitation-chip" onClick={onOpen} onPointerEnter={onPrepare} onFocus={onPrepare} title={t("spooktober.enter")}>
        <img className="spooktober-invitation-chip-art" src="/spooktober/assets/art/pumpkin-grin.svg" alt="" aria-hidden />
        <span>Spooktober</span>
      </button>
    );
  return (
    <div className="spooktober-invitation-shell">
    <button type="button" data-spooktober-invitation className="spooktober-invitation" onClick={onOpen} onPointerEnter={onPrepare} onFocus={onPrepare}>
      <span className="spooktober-invitation-landscape" aria-hidden="true">
        <svg viewBox="0 0 1200 126" preserveAspectRatio="none">
          <path d="M0 82C180 59 330 85 490 78S805 48 960 62S1120 75 1200 66V126H0Z" fill="var(--spook-hill)" />
          <path d="M0 106C250 82 400 103 615 94S1000 76 1200 92V126H0Z" fill="var(--spook-field)" />
        </svg>
        <span className="spooktober-invitation-stone stone-round" />
        <span className="spooktober-invitation-stone stone-cross" />
        <span className="spooktober-invitation-grass grass-one" />
        <span className="spooktober-invitation-grass grass-two" />
        <span className="spooktober-invitation-grass grass-three" />
      </span>
      <span className="spooktober-invitation-pumpkin" aria-hidden="true">
        <img className="spooktober-invitation-pumpkin-art" src="/spooktober/assets/art/pumpkin-grin.svg" alt="" />
      </span>
      <span className="spooktober-invitation-copy"><strong>Spooktober</strong><span>{t("spooktober.cta.description")}</span></span>
      <span className="spooktober-invitation-action">{t("spooktober.enter")}<ArrowRight size={17} aria-hidden /></span>
    </button>
    <span className="spooktober-invitation-dismiss-zone">
      <button type="button" className="spooktober-invitation-dismiss group/x" onClick={onDismiss} aria-label={t("spooktober.dismiss")} title={t("spooktober.dismiss")}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas/85 text-ink-muted ring-1 ring-white/12 backdrop-blur-sm transition-colors group-hover/x:bg-canvas group-hover/x:text-ink"><X size={14} strokeWidth={2} aria-hidden /></span></button>
    </span>
    </div>
  );
}
