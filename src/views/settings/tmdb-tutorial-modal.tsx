import { ArrowLeft, ArrowRight, Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import shot1 from "@/assets/tmdb-guide/tmdb1.png";
import shot2 from "@/assets/tmdb-guide/tmdb2.png";
import shot3 from "@/assets/tmdb-guide/tmdb3.png";
import shot4 from "@/assets/tmdb-guide/tmdb4.png";
import shot5 from "@/assets/tmdb-guide/tmdb5.png";
import shot6 from "@/assets/tmdb-guide/tmdb6.png";
import shot7 from "@/assets/tmdb-guide/tmdb7.png";
import shot8 from "@/assets/tmdb-guide/tmdb8.png";
import shotApi1 from "@/assets/tmdb-guide/tmdbapi1.png";
import shotApi2 from "@/assets/tmdb-guide/tmdbapi2.png";
import shotApi3 from "@/assets/tmdb-guide/tmdbapi3.png";
import shotFinal from "@/assets/tmdb-guide/tmdbfinal.gif";
import shotDone from "@/assets/tmdb-guide/tmdbdone.png";

const API_URL = "https://www.themoviedb.org/settings/api";

type Step = { title: string; body: string; shot: string; note?: string };

function steps(t: (s: string) => string): Step[] {
  return [
    {
      title: t("Open the TMDB API page"),
      body: t("Use the button below. If you are not signed in yet TMDB says you do not have permission, which is normal. Click the link in that message to sign in."),
      shot: shot1,
    },
    {
      title: t("Sign in, or make an account"),
      body: t("Already have a TMDB login? Sign in and skip ahead. Otherwise press Register and fill in a username, password and email."),
      shot: shot2,
    },
    {
      title: t("Prove you are human"),
      body: t("TMDB may show a captcha while you register. Complete it to carry on."),
      shot: shot3,
    },
    {
      title: t("Your account needs activating"),
      body: t("Right after registering TMDB tells you the account is not active yet. Nothing is broken, the email is on its way."),
      shot: shot4,
    },
    {
      title: t("Click Activate in the email"),
      body: t("Open the email TMDB sent to the address you registered with and press the activate button inside it. Check spam if it has not arrived."),
      shot: shot5,
    },
    {
      title: t("Open your account settings"),
      body: t("Back on TMDB, click your avatar in the top right and choose Settings from the menu."),
      shot: shot6,
    },
    {
      title: t("Choose API in the sidebar"),
      body: t("The settings page has a list down the left. Click API near the bottom."),
      shot: shot7,
    },
    {
      title: t("Request a key"),
      body: t("You have no key yet, so TMDB asks you to request one. Follow the link to create it."),
      shot: shot8,
    },
    {
      title: t("Say it is for personal use"),
      body: t("TMDB asks what the key is for. Choose Yes, this is for my own personal use only."),
      shot: shotApi1,
    },
    {
      title: t("Accept the terms"),
      body: t("Confirm personal use once more and tick the box to agree to the API terms."),
      shot: shotApi2,
    },
    {
      title: t("Fill in the details, then Subscribe"),
      body: t("This is the part people get stuck on. None of it is checked and nothing is billed. Give the app any name, any URL, pick a type of use, and write a sentence for the summary. The contact fields can be anything real enough to look sensible. Tick the agreement and press Subscribe."),
      shot: shotApi3,
      note: t("For Application URL anything works, for example https://harbor.site. TMDB never visits it."),
    },
    {
      title: t("That was the hard part"),
      body: t("TMDB confirms the key is created. Follow the link it gives you to see your API key details."),
      shot: shotFinal,
    },
    {
      title: t("Copy your API Key"),
      body: t("Back on the API page, scroll to the bottom. Copy the value under API Key and paste it into Harbor. Harbor saves it on its own."),
      shot: shotDone,
      note: t("Take the short API Key at the very bottom, not the long API Read Access Token above it."),
    },
  ];
}

export function TmdbGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { closing, close } = useModalExit(onClose, open);
  const [i, setI] = useState(0);
  const all = steps(t);
  const step = all[i];
  const last = i === all.length - 1;

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((v) => Math.min(all.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, all.length]);

  if (!open) return null;

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[250] flex items-center justify-center p-6`}
      onClick={close}
    >
      <div
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[88vh] w-[min(780px,100%)] flex-col overflow-hidden rounded-md bg-surface harbor-float`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("TMDB")}
            </span>
            <h2 className="text-[17px] font-semibold text-ink">{t("Get your free TMDB key")}</h2>
            <p className="text-[12.5px] text-ink-subtle">
              {t("Free forever for personal use. No payment, ever.")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-1">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-semibold tabular-nums text-ink-muted">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] font-semibold text-ink">{step.title}</span>
              <p className="text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-canvas ring-1 ring-inset ring-edge-soft">
            <img
              src={step.shot}
              alt=""
              draggable={false}
              className="block max-h-[46vh] w-full object-contain"
            />
          </div>

          {step.note && (
            <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.04] px-3.5 py-3">
              <Check size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[12.5px] leading-relaxed text-ink">{step.note}</p>
            </div>
          )}

          {i === 0 && (
            <button
              type="button"
              onClick={() => openUrl(API_URL)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform duration-150 active:scale-[0.98]"
            >
              <ExternalLink size={15} strokeWidth={2.2} />
              {t("Open the TMDB API page")}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-4">
          <div className="flex items-center gap-1.5">
            {all.map((s, n) => (
              <button
                key={s.title}
                type="button"
                aria-label={s.title}
                onClick={() => setI(n)}
                className={`h-1.5 rounded-full transition-all duration-150 ${
                  n === i ? "w-5 bg-accent" : "w-1.5 bg-white/[0.14] hover:bg-white/[0.28]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => setI((v) => Math.max(0, v - 1))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12.5px] font-semibold text-ink transition-colors duration-150 hover:bg-white/[0.10] disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft size={14} strokeWidth={2.2} />
              {t("Back")}
            </button>
            <button
              type="button"
              onClick={() => (last ? close() : setI((v) => v + 1))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform duration-150 active:scale-[0.98]"
            >
              {last ? t("Done") : t("Next")}
              {!last && <ArrowRight size={14} strokeWidth={2.2} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
