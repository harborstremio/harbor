import { TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { isPublicRelay, REQUIRED_RELAY_VERSION } from "@/lib/together/relay-version";
import { useView } from "@/lib/view";

const DISMISS_KEY = "harbor.relayBannerDismissed";

export function TogetherRelayBanner() {
  const { relayOutdated, closeModal } = useTogether();
  const { settings } = useSettings();
  const { openSettings } = useView();
  const t = useT();
  const pub = isPublicRelay(settings.togetherRelayUrl);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === String(REQUIRED_RELAY_VERSION);
    } catch {
      return false;
    }
  });
  if (!relayOutdated) return null;
  if (pub && dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(REQUIRED_RELAY_VERSION));
    } catch {
      /* private mode */
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-edge-soft bg-elevated px-3.5 py-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
        <TriangleAlert size={12} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12.5px] font-medium text-ink">
          {pub
            ? t("Harbor's public relay has not rolled out the latest protocol yet.")
            : t("Relay outdated. Your self-hosted relay is running an older version.")}
        </span>
        <span className="text-[11.5px] leading-snug text-ink-muted">
          {pub
            ? t("It updates automatically; nothing to do.")
            : t(
                "Redeploy it to get the latest Watch Together fixes. Harbor's public relay updates on its own.",
              )}
        </span>
        {!pub && (
          <button
            onClick={() => {
              closeModal();
              openSettings("relay");
            }}
            className="mt-1 w-fit rounded-lg border border-edge px-2.5 py-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {t("Open relay settings")}
          </button>
        )}
      </div>
      {pub && (
        <button
          onClick={dismiss}
          aria-label={t("Dismiss")}
          className="-me-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
