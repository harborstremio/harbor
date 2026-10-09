import { useEffect, useState } from "react";
import { ArrowLeft, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { MUSIC_GENRES } from "@/lib/music/genre-catalog";
import { dismissSurprisePrompt, surpriseEnjoyed, surpriseNotEnjoyed, useSurpriseFeedback } from "@/lib/music/surprise-feedback";
import { restartMusicSurprise, useMusicSurprise } from "@/lib/music/surprise-me";
import "./music-surprise-prompt.css";

/** One genre per family, so the shortcuts offer real alternatives rather than near neighbours. */
const suggestions = () => {
  const seen = new Set<string>();
  return MUSIC_GENRES.filter(genre => !seen.has(genre.family) && seen.add(genre.family)).slice(0, 6);
};

export function MusicSurprisePrompt() {
  const t = useT(), feedback = useSurpriseFeedback(), status = useMusicSurprise();
  const [leaving, setLeaving] = useState(false);
  const open = feedback.step !== "idle" && (status === "playing" || status === "waiting");
  useEffect(() => { if (open) setLeaving(false); }, [open]);
  if (!open && !leaving) return null;
  const redirect = feedback.step === "redirect";
  const choose = (id: number) => { setLeaving(true); dismissSurprisePrompt(); void restartMusicSurprise([id]); };
  return (
    <div className={`music-surprise-prompt${open ? " is-open" : ""}`} role="dialog" aria-label={t("music.surprise.rate.title")}>
      <button type="button" className="music-surprise-prompt-close" aria-label={t("common.close")} onClick={() => { setLeaving(true); dismissSurprisePrompt(); }}>
        <X size={15} />
      </button>
      <div className="music-surprise-prompt-step" data-open={!redirect}>
        <div>
          <div className="music-surprise-prompt-rate">
            {!!feedback.covers.length && (
              <span className="music-surprise-prompt-covers" aria-hidden>
                {feedback.covers.map(cover => <img key={cover} src={cover} alt="" loading="lazy" decoding="async" />)}
              </span>
            )}
            <span className="music-surprise-prompt-copy">
              <strong>{t("music.surprise.rate.title")}</strong>
              <small>{t("music.surprise.rate.note", { count: feedback.heard })}</small>
            </span>
            <span className="music-surprise-prompt-actions">
              <button type="button" aria-label={t("music.surprise.rate.no")} onClick={surpriseNotEnjoyed}><ThumbsDown size={17} /></button>
              <button type="button" data-primary aria-label={t("music.surprise.rate.yes")} onClick={() => { setLeaving(true); surpriseEnjoyed(); }}><ThumbsUp size={17} /></button>
            </span>
          </div>
        </div>
      </div>
      <div className="music-surprise-prompt-step" data-open={redirect}>
        <div>
          <div className="music-surprise-prompt-redirect">
            <span className="music-surprise-prompt-copy">
              <strong>
                <button type="button" aria-label={t("music.surprise.back")} onClick={() => { setLeaving(true); dismissSurprisePrompt(); }}><ArrowLeft size={15} /></button>
                {t("music.surprise.redirect.title")}
              </strong>
              <small>{t("music.surprise.redirect.note")}</small>
            </span>
            <span className="music-surprise-prompt-genres">
              {suggestions().map(genre => (
                <button type="button" key={genre.id} onClick={() => choose(genre.id)}>{genre.name}</button>
              ))}
            </span>
            <Dropdown
              value=""
              placeholder={t("music.surprise.redirect.more")}
              ariaLabel={t("music.surprise.redirect.more")}
              size="sm"
              onChange={value => choose(Number(value))}
              options={MUSIC_GENRES.map(genre => ({ value: String(genre.id), label: genre.name }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
