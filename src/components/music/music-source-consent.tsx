import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ShieldCheck } from "@/components/icons/music-icons";
import { ModalShell } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import {
  acceptMusicSources,
  getMusicSourceConsent,
  getMusicSourceConsentServer,
  subscribeMusicSourceConsent,
  peekMusicSourceConsentFocus,
  takeMusicSourceConsentRetry,
  GATED_MUSIC_SOURCES,
  MUSIC_SOURCE_CONSENT_EVENT,
  type GatedMusicSource,
} from "@/lib/music/source-consent";
import "./music-source-consent.css";

const TERMS: Record<GatedMusicSource, { name: string; url: string }> = {
  youtube: { name: "YouTube", url: "https://www.youtube.com/t/terms" },
  soundcloud: { name: "SoundCloud", url: "https://soundcloud.com/terms-of-use" },
};

export function MusicSourceConsent() {
  const t = useT();
  const id = useId();
  const consent = useSyncExternalStore(
    subscribeMusicSourceConsent,
    getMusicSourceConsent,
    getMusicSourceConsentServer,
  );
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<GatedMusicSource[]>([]);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = () => {
      const focus = peekMusicSourceConsentFocus();
      const already = GATED_MUSIC_SOURCES.filter((source) => consent.sources[source]);
      setPicked(focus && !already.includes(focus) ? [...already, focus] : already);
      setOpen(true);
    };
    window.addEventListener(MUSIC_SOURCE_CONSENT_EVENT, show);
    return () => window.removeEventListener(MUSIC_SOURCE_CONSENT_EVENT, show);
  }, [consent]);


  if (!open) return null;
  const toggle = (source: GatedMusicSource) =>
    setPicked((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
    );

  return (
    <ModalShell closing={false} onDismiss={() => setOpen(false)} width={620} labelledBy={id}>
      <section className="music-consent">
        <header>
          <ShieldCheck size={22} aria-hidden="true" />
          <h2 id={id}>{t("music.consent.title")}</h2>
        </header>
        <div className="music-consent-body" ref={body} tabIndex={0}>
          <p>{t("music.consent.hosting")}</p>
          <p>{t("music.consent.terms")}</p>
          <p>{t("music.consent.responsibility")}</p>
          <p>{t("music.consent.rights")}</p>
          <div className="music-consent-links">
            {GATED_MUSIC_SOURCES.map((source) => (
              <button key={source} type="button" onClick={() => openUrl(TERMS[source].url)}>
                {t("music.consent.readTerms", { service: TERMS[source].name })}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="music-consent-sources">
          <legend>{t("music.consent.enable")}</legend>
          {GATED_MUSIC_SOURCES.map((source) => (
            <label key={source}>
              <input
                type="checkbox"
                checked={picked.includes(source)}
                onChange={() => toggle(source)}
              />
              <span>{TERMS[source].name}</span>
            </label>
          ))}
        </fieldset>
        <footer>
          <button
            type="button"
            className="music-consent-cancel"
            onClick={() => {
              takeMusicSourceConsentRetry();
              setOpen(false);
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="music-consent-accept"
            disabled={picked.length === 0}
            onClick={() => {
              acceptMusicSources(picked);
              setOpen(false);
              takeMusicSourceConsentRetry()?.();
            }}
          >
            {t("music.consent.accept")}
          </button>
        </footer>
      </section>
    </ModalShell>
  );
}
