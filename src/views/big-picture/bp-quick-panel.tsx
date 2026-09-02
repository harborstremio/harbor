import { useEffect, useRef } from "react";
import { LogOut, Volume2, VolumeX, Images, Plus, Check, Info, EyeOff } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Search } from "@/components/icons/search-icon";
import { useGamepads } from "@/lib/gamepad/store";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { exitBigPicture, pushBigPicture } from "@/lib/big-picture";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { forceBpMeta, readBpCwItem, useBpFocusedMeta } from "./bp-focus-meta";
import { pushBpBack } from "./bp-back";
import { requestBpPlay } from "./bp-play-request";
import { dismissCw } from "@/lib/cw-dismiss";
import { useAuth } from "@/lib/auth";
import { useBpT } from "./bp-i18n";
import { bpSoundLabel } from "./bp-settings-catalog";
import { setBpFocus } from "./use-bp-focus";

type Binding = { id: string; pad: string; key: string; label: string };

function useBindings(): Binding[] {
  const t = useBpT();
  return [
    { id: "move", pad: "D-pad / Stick", key: "Arrows", label: t("Move") },
    { id: "select", pad: "A", key: "Enter", label: t("Select") },
    { id: "back", pad: "B", key: "Esc", label: t("Back") },
    { id: "quick", pad: "Y", key: "Tab", label: t("Quick panel") },
    { id: "tabs", pad: "LB / RB", key: "PgUp / PgDn", label: t("Switch tab") },
  ];
}

function BpQuickAction({
  icon,
  label,
  detail,
  onPress,
  autofocus,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  autofocus?: boolean;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-autofocus={autofocus ? "true" : undefined}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className="flex w-full items-center gap-3.5 rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(13px,1.2vw,20px)] py-[clamp(11px,1.3vh,18px)] text-start transition-colors duration-[var(--bp-dur-fast)]"
    >
      <span className="flex h-[clamp(30px,3.6vh,42px)] w-[clamp(30px,3.6vh,42px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-panel-2)] text-ink-muted">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[clamp(13.5px,1.9vh,21px)] font-bold text-ink">{label}</span>
        {detail && (
          <span className="truncate text-[clamp(11px,1.5vh,17px)] font-medium text-ink-subtle">
            {detail}
          </span>
        )}
      </span>
    </button>
  );
}

export function BpQuickPanel({ onClose }: { onClose: () => void }) {
  const t = useBpT();
  const bindings = useBindings();
  const { settings, update } = useSettings();
  const pads = useGamepads();
  const usingPad = pads.length > 0;
  const focused = useBpFocusedMeta();
  const saved = useInWatchlist(focused?.id ?? "");
  const { authKey } = useAuth();
  const cwItem = focused ? readBpCwItem() : null;
  const ref = useRef<HTMLDivElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  useEffect(() => {
    restore.current = document.querySelector<HTMLElement>(
      "[data-bp-focusable][data-bp-focus='true']",
    );
    const id = window.setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-bp-focusable]");
      if (first) setBpFocus(first, { silent: true });
    }, 30);
    return () => {
      window.clearTimeout(id);
      if (restore.current?.isConnected) setBpFocus(restore.current, { silent: true });
    };
  }, []);

  const soundOn = settings.bigPictureSound !== "none";

  return (
    <div
      className="absolute inset-0 z-40 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[var(--bp-void)]/55 [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      />
      <div
        ref={ref}
        role="dialog"
        data-bp-dialog
        data-bp-scroll-y
        aria-label={t("Quick panel")}
        className="relative flex h-full w-[clamp(320px,29vw,470px)] flex-col gap-[clamp(9px,1.1vh,17px)] overflow-y-auto border-s border-[var(--bp-edge)] bg-[var(--bp-panel)] ps-[clamp(16px,1.5vw,28px)] pe-[calc(clamp(16px,1.5vw,28px)_+_var(--bp-safe-x,0px))] pt-[calc(clamp(20px,2.6vh,40px)_+_var(--bp-safe-y,0px))] pb-[calc(clamp(20px,2.6vh,40px)_+_var(--bp-safe-y,0px))] shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.9)] [animation:bp-slide-in_var(--bp-dur)_var(--bp-ease)_both] [-ms-overflow-style:none] [scrollbar-width:none] motion-reduce:[animation:none] [&::-webkit-scrollbar]:hidden"
      >
        {focused ? (
          <>
            <h2 className="line-clamp-2 text-[clamp(15px,2.2vh,26px)] font-bold leading-tight text-ink">
              {focused.name}
            </h2>
            <BpQuickAction
              icon={<Play size={17} className="fill-current" strokeWidth={0} />}
              label={t("Play")}
              onPress={() => {
                onClose();
                // openPicker would hide the whole 10-foot UI behind the mouse-only
                // desktop frame, so play lands on the detail route instead.
                const metaId = `${focused.type}:${focused.id}`;
                forceBpMeta(focused);
                requestBpPlay(metaId);
                pushBigPicture({ kind: "detail", metaId });
              }}
              autofocus
            />
            <BpQuickAction
              icon={saved ? <Check size={17} strokeWidth={2.4} /> : <Plus size={17} strokeWidth={2.4} />}
              label={saved ? t("Saved") : t("Watchlist")}
              onPress={() =>
                toggleWatchlist({
                  id: focused.id,
                  type: focused.type,
                  name: focused.name,
                  poster: focused.poster,
                })
              }
            />
            <BpQuickAction
              icon={<Info size={17} strokeWidth={2.2} />}
              label={t("Details")}
              onPress={() => {
                onClose();
                pushBigPicture({ kind: "detail", metaId: `${focused.type}:${focused.id}` });
              }}
            />
            {cwItem && (
              <BpQuickAction
                icon={<EyeOff size={17} strokeWidth={2.2} />}
                label={t("Remove from Continue watching")}
                onPress={() => {
                  dismissCw(cwItem, authKey);
                  onClose();
                }}
              />
            )}
            <div className="my-[clamp(4px,0.6vh,9px)] h-px w-full bg-[var(--bp-edge)]" />
          </>
        ) : (
          <h2 className="text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Quick panel")}
          </h2>
        )}

        <BpQuickAction
          icon={<Search size={17} strokeWidth={2.2} />}
          label={t("Search")}
          onPress={() => {
            onClose();
            pushBigPicture({ kind: "search" });
          }}
          autofocus={!focused}
        />
        <BpQuickAction
          icon={soundOn ? <Volume2 size={17} strokeWidth={2.2} /> : <VolumeX size={17} strokeWidth={2.2} />}
          label={t("Interface sounds")}
          detail={
            soundOn
              ? t("Sound pack: {name}", { name: bpSoundLabel(t, settings.bigPictureSound) })
              : t("Off")
          }
          onPress={() => {
            const next = soundOn ? "none" : "glass";
            update({ bigPictureSound: next });
            SFX.setTheme(next);
          }}
        />
        <BpQuickAction
          icon={<Images size={17} strokeWidth={2.2} />}
          label={t("Animated backdrop")}
          detail={settings.bigPictureMosaic ? t("On") : t("Off")}
          onPress={() => update({ bigPictureMosaic: !settings.bigPictureMosaic })}
        />
        <BpQuickAction
          icon={<LogOut size={17} strokeWidth={2.2} />}
          label={t("Leave Big Picture")}
          onPress={() => {
            SFX.close();
            exitBigPicture();
          }}
        />

        <div className="mt-auto flex flex-col gap-[clamp(6px,0.8vh,11px)] pt-[clamp(14px,1.8vh,28px)]">
          <h3 className="text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Controls")}
          </h3>
          {bindings.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <span className="text-[clamp(12px,1.65vh,19px)] font-medium text-ink-muted">
                {b.label}
              </span>
              <span className="shrink-0 rounded-full border border-[var(--bp-edge-2)] px-2.5 py-1 text-[clamp(10px,1.3vh,14.5px)] font-bold text-ink">
                {usingPad ? b.pad : b.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
