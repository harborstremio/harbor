import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, X } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { openUrl } from "@/lib/window";
import {
  esportsExternalUrl,
  esportsPlayback,
  type EsportsStream,
} from "@/lib/sports/esports-streams";
import { StreamPlatform } from "@/views/sports/esports-broadcast";
import { BP_ACTION_RING } from "../bp-action-style";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { bpFirstVisible } from "../bp-visible";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";

const BAR_SCOPE = {
  paddingInline: 0,
  marginInline: 0,
  containIntrinsicSize: "auto 100px",
} as const;

const BAR_BUTTON = `flex h-[clamp(52px,6vh,74px)] shrink-0 items-center gap-[clamp(8px,0.7vw,14px)] rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] bg-[color-mix(in_oklab,var(--bp-void)_62%,transparent)] px-[clamp(18px,1.5vw,30px)] text-[calc(clamp(15px,2vh,24px)*var(--bp-up,1))] font-bold text-ink ${BP_ACTION_RING}`;

function autoplaying(embed: string, platform: EsportsStream["platform"]): string {
  return embed.replace(
    /autoplay=(?:false|0)/,
    platform === "youtube" ? "autoplay=1" : "autoplay=true",
  );
}

// Twitch refuses every iframe at Harbor's packaged origin, so it plays as its own document.
function openBroadcastWindow(url: string) {
  if (!("__TAURI_INTERNALS__" in window)) {
    openUrl(url);
    return;
  }
  void invoke("browser_open", { url }).catch(() => openUrl(url));
}

export function BpSportsBroadcastStage({
  stream,
  others,
  onSelect,
  onClose,
}: {
  stream: EsportsStream;
  others: EsportsStream[];
  onSelect: (next: EsportsStream) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const openRef = useRef<HTMLButtonElement | null>(null);
  const playback = esportsPlayback(stream, window.location.hostname);
  const embed = playback?.mode === "iframe" ? playback.url : null;
  const windowUrl = playback?.mode === "window" ? playback.url : null;
  const external = esportsExternalUrl(stream.url);

  useEffect(() => {
    const previous = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    // openRef is only attached in window mode, where nothing plays until it is pressed.
    const seed = openRef.current || seedRef.current;
    if (seed) setBpFocus(seed, { silent: true });
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  return (
    <div
      role="dialog"
      aria-label={stream.title}
      data-bp-dialog
      className="absolute inset-0 z-[80] flex flex-col bg-[var(--bp-void)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="relative min-h-0 flex-1">
        {embed ? (
          <iframe
            key={embed}
            title={stream.title}
            src={autoplaying(embed, stream.platform)}
            tabIndex={-1}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-[clamp(8px,1vh,16px)] px-[var(--bp-gutter)] text-center">
            <p className="font-display text-[calc(clamp(24px,3.4vh,42px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
              {t("This broadcast only plays on its own channel.")}
            </p>
            <p className="text-[calc(clamp(15px,2vh,24px)*var(--bp-up,1))] leading-[1.5] text-ink-muted">
              {t("Open it in a browser to watch, then come back here.")}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 bg-[linear-gradient(to_top,var(--bp-void),color-mix(in_oklab,var(--bp-void)_86%,transparent))] px-[var(--bp-gutter)] pb-[clamp(18px,2.4vh,40px)] pt-[clamp(14px,1.8vh,30px)]">
        <div className="flex items-baseline gap-[clamp(10px,0.9vw,18px)] pb-[clamp(10px,1.2vh,20px)]">
          <span className="truncate font-display text-[calc(clamp(20px,2.8vh,34px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {stream.title}
          </span>
          <span className="shrink-0 text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Official broadcast")}
          </span>
        </div>
        {embed && external && (
          <p className="pb-[clamp(8px,1vh,16px)] text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-medium leading-[1.45] text-ink-subtle">
            {t("If the broadcast asks you to sign in or confirm your age, open it in a browser.")}
          </p>
        )}

        <div data-bp-row style={BAR_SCOPE}>
          <div
            data-bp-scroll-x
            className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              ref={seedRef}
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.close();
                onClose();
              }}
              className={BAR_BUTTON}
            >
              <X size={20} strokeWidth={2.4} />
              <span>{t("Close")}</span>
            </button>
            {external && (
              <button
                ref={windowUrl ? openRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-chip
                onClick={() => {
                  SFX.click();
                  if (windowUrl) openBroadcastWindow(windowUrl);
                  else openUrl(external);
                }}
                className={BAR_BUTTON}
              >
                <ExternalLink size={19} strokeWidth={2.3} />
                <span>{t("Open broadcast")}</span>
              </button>
            )}
            {others.map((option) => (
              <button
                key={option.url}
                type="button"
                data-bp-focusable
                data-bp-chip
                onClick={() => {
                  SFX.click();
                  onSelect(option);
                }}
                className={BAR_BUTTON}
              >
                <StreamPlatform platform={option.platform} size={19} />
                <span className="max-w-[clamp(160px,18vw,340px)] truncate">{option.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
