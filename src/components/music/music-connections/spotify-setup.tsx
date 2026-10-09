import { useState } from "react";
import { Check, Copy, ExternalLink } from "@/components/icons/music-icons";
import { copyText } from "@/components/player/copy-link-button";
import { useT } from "@/lib/i18n";
import "@/components/music/music-connect-field.css";
import { SPOTIFY_DASHBOARD_URL, SPOTIFY_REDIRECT_URI } from "@/lib/music/spotify-setup";
import { openUrl } from "@/lib/window";

export function SpotifySetupFields({
  clientId,
  onChange,
  disabled,
}: {
  clientId: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useT();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const stepClass = "grid grid-cols-[24px_minmax(0,1fr)] gap-3";
  const numberClass =
    "grid size-6 place-items-center rounded-full bg-elevated text-[12px] font-semibold text-ink-muted";
  const titleClass = "text-[13px] font-semibold leading-6 text-ink";
  const bodyClass = "mt-1 text-[13px] leading-5 text-ink-muted";

  return (
    <ol className="grid max-w-2xl gap-5">
      <li className={stepClass}>
        <span className={numberClass} aria-hidden="true">
          1
        </span>
        <div>
          <p className={titleClass}>{t("music.spotifySetup.createTitle")}</p>
          <p className={bodyClass}>{t("music.spotifySetup.createBody")}</p>
          <button
            type="button"
            onClick={() => void openUrl(SPOTIFY_DASHBOARD_URL)}
            className="inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-ink hover:underline"
          >
            {t("music.spotifySetup.dashboard")}
            <ExternalLink size={15} aria-hidden="true" />
          </button>
        </div>
      </li>
      <li className={stepClass}>
        <span className={numberClass} aria-hidden="true">
          2
        </span>
        <div className="min-w-0">
          <p className={titleClass}>{t("music.spotifySetup.redirectTitle")}</p>
          <p className={bodyClass}>{t("music.spotifySetup.redirectBody")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={SPOTIFY_REDIRECT_URI}
              aria-label={t("music.spotifySetup.redirectLabel")}
              onFocus={(event) => event.currentTarget.select()}
              dir="ltr"
              className="h-11 min-w-0 flex-[1_1_240px] select-text rounded-md border border-edge bg-canvas px-3 font-mono text-[12px] text-ink outline-none focus:border-ink-muted"
            />
            <button
              type="button"
              onClick={() =>
                void copyText(SPOTIFY_REDIRECT_URI).then((ok) =>
                  setCopyState(ok ? "copied" : "failed"),
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-edge px-4 text-[12px] font-medium text-ink hover:bg-elevated"
            >
              {copyState === "copied" ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Copy size={17} aria-hidden="true" />
              )}
              {t(
                copyState === "copied" ? "music.spotifySetup.copied" : "music.spotifySetup.copyUri",
              )}
            </button>
          </div>
          <p
            role="status"
            className={
              copyState === "failed" ? "mt-1 text-[12px] leading-5 text-ink-muted" : "sr-only"
            }
          >
            {copyState === "failed"
              ? t("music.spotifySetup.copyFailed")
              : copyState === "copied"
                ? t("music.spotifySetup.copied")
                : null}
          </p>
        </div>
      </li>
      <li className={stepClass}>
        <span className={numberClass} aria-hidden="true">
          3
        </span>
        <label className="music-connect-field min-w-0">
          <span className={`block ${titleClass}`}>{t("music.spotifySetup.clientTitle")}</span>
          <input
            type="text"
            value={clientId}
            onChange={(event) => onChange(event.currentTarget.value)}
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            aria-label={t("music.spotifySetup.clientTitle")}
            placeholder={t("music.spotifySetup.clientPlaceholder")}
            className="mt-2 h-11 w-full rounded-md border border-edge bg-canvas px-3 text-[14px] text-ink disabled:opacity-40"
          />
          <span className={`block ${bodyClass}`}>{t("music.spotifySetup.accountHint")}</span>
        </label>
      </li>
    </ol>
  );
}
