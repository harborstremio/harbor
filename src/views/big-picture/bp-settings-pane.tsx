import { useEffect, useState } from "react";
import { flagSrc } from "@/components/flag";
import { ServiceLogo } from "@/components/service-logo";
import { LANGUAGES } from "@/lib/i18n";
import type { StreamingService } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import {
  bpOverscanLabel,
  bpServiceItems,
  bpSoundLabel,
  type BpCatId,
  type BpT,
} from "./bp-settings-catalog";

const STILL = "https://image.tmdb.org/t/p/w780/eGX66zonvc4bXg3rM08RUxdYSDx.jpg";

// The player renders at panel height; the preview box is a fifth of that, so a
// proportional subtitle is four pixels tall and unreadable. Linear keeps the
// ratio between the four sizes exact while staying legible at ten feet.
const SUB_PREVIEW_SCALE = 0.55;

function useAppVersion(): string {
  const [version, setVersion] = useState("");
  useEffect(() => {
    let alive = true;
    import("@tauri-apps/api/app")
      .then((m) => m.getVersion())
      .then((v) => {
        if (alive) setVersion(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return version;
}

// Capped by viewport HEIGHT, not width. As a bare w-full 16:9 box the preview
// took the full pane width, so on a 1920 window the ~1300px pane drew it 731px
// tall and it swallowed the screen while ignoring how tall the screen was. The
// max-width is the height cap expressed through the aspect ratio: width can never
// exceed 42vh*16/9, so height never exceeds 42vh, and on a narrow pane it shrinks
// to fit instead. Left aligned with the title rather than centred.
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full max-w-[calc(clamp(220px,42vh,460px)*16/9)] overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-void)] ring-1 ring-[var(--bp-edge)]"
      style={{ aspectRatio: "16 / 9" }}
    >
      {children}
    </div>
  );
}

function Lines({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="flex flex-col gap-[clamp(6px,0.9vh,13px)]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-[clamp(10px,1vw,20px)]">
          <span className="truncate text-[clamp(12px,1.6vh,17px)] font-medium text-ink-subtle">
            {k}
          </span>
          <span className="shrink-0 text-[clamp(13px,1.8vh,19px)] font-bold text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

function PicturePreview({ overscan, t }: { overscan: number; t: BpT }) {
  const inset = `${overscan * 100}%`;
  return (
    <Screen>
      <img
        src={STILL}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <span
        aria-hidden
        className="absolute rounded-[4px] border-2 border-dashed border-[var(--bp-focus-stroke)]"
        style={{ inset }}
      />
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-[6%]">
        <span className="rounded-full bg-[var(--bp-void)]/80 px-[clamp(10px,1vw,18px)] py-[clamp(3px,0.5vh,7px)] text-[clamp(11px,1.5vh,16px)] font-bold text-ink">
          {bpOverscanLabel(t, overscan)}
        </span>
      </span>
    </Screen>
  );
}

function SubtitlePreview({ s, t }: { s: Settings; t: BpT }) {
  const marks = s.preferredSubLangs.map(flagSrc).filter((v): v is string => v !== null);
  return (
    <>
      <Screen>
        <img
          src={STILL}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg, var(--bp-void) 4%, transparent 46%)" }}
        />
        <span className="absolute inset-x-0 bottom-[9%] flex justify-center px-[8%]">
          <span
            className="text-center font-semibold leading-snug text-ink"
            style={{
              fontSize: `${Math.round(s.subFontSize * SUB_PREVIEW_SCALE)}px`,
              textShadow: "0 2px 6px rgba(0,0,0,0.9)",
            }}
          >
            {t("This is how a subtitle will look.")}
          </span>
        </span>
      </Screen>
      {marks.length > 0 && (
        <div className="flex items-center gap-[clamp(5px,0.5vw,10px)]">
          {marks.slice(0, 8).map((src, i) => (
            <span
              key={src}
              className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--bp-edge)]"
              style={{ width: "clamp(22px,2.4vw,36px)", aspectRatio: "1" }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[clamp(8px,1vh,12px)] font-bold text-ink"
                  style={{ background: "color-mix(in oklab, var(--bp-void) 62%, transparent)" }}
                >
                  1
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Bars({ count, tall }: { count: number; tall?: boolean }) {
  return (
    <span className="flex w-full gap-[3px]">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`flex-1 rounded-[2px] bg-[var(--bp-panel-2)] ${tall ? "h-[34px]" : "h-[22px]"}`}
        />
      ))}
    </span>
  );
}

function HomePreview({ mode }: { mode: Settings["homeMode"] }) {
  return (
    <Screen>
      <span className="absolute inset-0 flex flex-col gap-[6px] p-[5%]">
        {mode === "harbor" ? (
          <>
            <span
              className="w-full flex-1 rounded-[4px]"
              style={{
                background: "var(--bp-on)",
              }}
            />
            <Bars count={7} />
          </>
        ) : (
          <>
            <span className="h-[6px] w-[30%] rounded-full bg-[var(--bp-panel-2)]" />
            <Bars count={5} tall />
            <span className="h-[6px] w-[22%] rounded-full bg-[var(--bp-panel-2)]" />
            <Bars count={7} />
          </>
        )}
      </span>
    </Screen>
  );
}

function ServicesPreview({ s, t }: { s: Settings; t: BpT }) {
  const on = bpServiceItems(s).filter((i) => i.on);
  if (on.length === 0) {
    return (
      <p className="text-[clamp(13px,1.8vh,19px)] font-medium text-ink-subtle">
        {t("Turn off what you do not have")}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-[clamp(7px,0.8vw,14px)]">
      {on.slice(0, 18).map((item) => (
        <span
          key={item.value}
          className="flex h-[clamp(38px,4.8vh,54px)] items-center justify-center rounded-[var(--bp-r-sm)] bg-[var(--bp-panel)] px-[clamp(10px,1vw,18px)]"
        >
          <ServiceLogo service={item.value as StreamingService} height={20} />
        </span>
      ))}
    </div>
  );
}

export function BpSettingsPane({
  cat,
  title,
  s,
  t,
  overscan,
  connected,
}: {
  cat: BpCatId;
  title: string;
  s: Settings;
  t: BpT;
  overscan: number;
  connected: string[];
}) {
  const version = useAppVersion();
  const language = LANGUAGES.find((l) => l.code === s.uiLanguage);

  return (
    <section
      aria-hidden
      className="pointer-events-none flex min-w-0 flex-1 flex-col justify-center gap-[clamp(10px,1.6vh,24px)]"
    >
      <h2 className="font-display text-[clamp(20px,3.2vh,42px)] font-semibold leading-tight text-ink">
        {title}
      </h2>

      {cat === "picture" && <PicturePreview overscan={overscan} t={t} />}
      {cat === "subtitles" && <SubtitlePreview s={s} t={t} />}
      {cat === "home" && <HomePreview mode={s.homeMode} />}
      {cat === "services" && <ServicesPreview s={s} t={t} />}

      {cat === "language" && language && (
        <div className="flex flex-col gap-[clamp(4px,0.7vh,10px)]">
          <span
            lang={language.code}
            dir={language.rtl ? "rtl" : "ltr"}
            className={`text-[clamp(34px,6.2vh,76px)] font-semibold leading-none text-ink ${
              language.rtl ? "font-arabic" : "font-display"
            }`}
          >
            {language.greeting}
          </span>
          <span className="text-[clamp(13px,1.8vh,19px)] font-medium text-ink-subtle">
            {language.nativeLabel}
          </span>
        </div>
      )}

      {cat === "playback" && (
        <Lines
          rows={[
            [t("Player engine"), s.playerEngine === "auto" ? t("Auto") : s.playerEngine],
            [
              t("Play button behavior"),
              t(
                s.playbackSourcePreference === "ask"
                  ? "Ask every time"
                  : s.playbackSourcePreference === "local"
                    ? "Local Library"
                    : s.playbackSourcePreference === "online"
                      ? "Online streams"
                      : "Home server",
              ),
            ],
            [
              t("Hardware acceleration"),
              t(s.mpvHwdec === "auto" ? "Auto" : s.mpvHwdec === "on" ? "On" : "Off"),
            ],
            [t("Skip intros"), t(s.autoSkipIntro ? "On" : "Off")],
            [t("Auto-play next episode"), t(s.autoPlayNextEpisode ? "On" : "Off")],
            [t("Instant play"), t(s.instantPlay ? "On" : "Off")],
          ]}
        />
      )}

      {cat === "setup" && (
        <Lines
          rows={[
            ["TMDB", s.tmdbKey.trim() ? t("On") : t("None")],
            [t("Live TV playlists"), String(s.iptvPlaylists.length)],
            [t("Setup"), connected.length > 0 ? connected.join(", ") : t("None")],
          ]}
        />
      )}

      {cat === "interface" && (
        <Lines
          rows={[
            [t("Interface sounds"), bpSoundLabel(t, s.bigPictureSound)],
            [t("Controller navigation"), t(s.tvNavigation ? "On" : "Off")],
            [t("Open in Big Picture"), t(s.bigPictureAutoStart ? "On" : "Off")],
            ...(version ? ([[t("Version"), version]] as Array<[string, string]>) : []),
          ]}
        />
      )}
    </section>
  );
}
