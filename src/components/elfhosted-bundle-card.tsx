import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import elfLogo from "@/assets/elfhosted.svg";
import { loadInstalled } from "@/lib/addon-store";
import { ELF_BUNDLE, elfProductFor } from "@/lib/addons-store/elfhosted";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";

const DISMISS_KEY = "harbor.elfhosted.bundle.dismissedUntil";
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 30;

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* storage blocked */
  }
}

export function ElfHostedBundleCard() {
  const t = useT();
  const [hidden, setHidden] = useState(() => snoozed());
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      setIds(loadInstalled().map((e) => e.id ?? ""));
    } catch {
      setIds([]);
    }
  }, []);

  const yours = useMemo(() => {
    for (const id of ids) {
      const p = elfProductFor({ id, name: id });
      if (p) return p.label;
    }
    return null;
  }, [ids]);

  if (hidden) return null;

  return (
    <div className="-mb-6 flex w-full items-center gap-3 rounded-full border border-edge-soft bg-elevated/30 py-2 pe-2 ps-3">
      <img src={elfLogo} alt="" draggable={false} className="h-5 w-5 shrink-0 object-contain" />
      <p
        className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted"
        title={t("Includes Comet, MediaFusion, AIOStreams, StremThru, Jackettio and more, plus TorBox and Usenet accounts. No Docker, no server, no config.")}
      >
        <span className="font-semibold text-ink">
          {yours
            ? t("Get {name} hosted, plus {n} more addons.", {
                name: yours,
                n: String(ELF_BUNDLE.addonCount - 1),
              })
            : t("Rather not set any of this up?")}
        </span>{" "}
        {t("{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.", {
          n: String(ELF_BUNDLE.addonCount),
        })}
      </p>
      <button
        type="button"
        onClick={() => openUrl(ELF_BUNDLE.url)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Try it for ${n}", { n: String(ELF_BUNDLE.trialUsd) })}
        <ArrowUpRight size={12} strokeWidth={2.4} />
      </button>
      <button
        type="button"
        onClick={() => {
          snooze();
          setHidden(true);
        }}
        aria-label={t("Hide this")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
