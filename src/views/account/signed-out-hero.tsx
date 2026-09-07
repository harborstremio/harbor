import harborScreenshot from "@/assets/settings-preview/harbor-profile.png";
import stremioLogo from "@/assets/stremio.png";
import { useT } from "@/lib/i18n";
import { Section, settingsAnchor, useSettingsActiveContext } from "@/views/settings/shared";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "@/views/settings/kit";

export function SignedOutHero({ onSignIn }: { onSignIn: (mode: "register" | "signin") => void }) {
  const t = useT();
  const { setActive } = useSettingsActiveContext();
  return (
    <Section title={t("Harbor account")}>
      <div className="hset-account-welcome">
        <div className="flex min-w-0 flex-col items-start gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-[28px] font-semibold leading-[34px] tracking-[-0.65px] text-ink">
              {t("A little more you.")}
            </h3>
            <p className="max-w-[34ch] text-[16px] leading-[25px] text-ink-muted">
              {t("Claim your @handle, share your themes, and make a profile of your own.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onSignIn("register")}
              className={ROW_ACTION_PRIMARY}
            >
              {t("Create your account")}
            </button>
            <button
              type="button"
              onClick={() => onSignIn("signin")}
              className={ROW_ACTION}
            >
              {t("Sign in")}
            </button>
          </div>
        </div>
        <figure className="m-0 min-w-0">
          <div className="relative aspect-[1005/405] overflow-hidden rounded-[12px] bg-canvas">
            <img
              src={harborScreenshot}
              alt={t("Harbor profile showing watch statistics")}
              width={1221}
              height={849}
              draggable={false}
              className="pointer-events-none absolute left-[-21.4925%] top-[-15.8025%] block h-auto w-[121.4925%] max-w-none select-none"
            />
          </div>
          <figcaption className="mt-3 text-[15px] leading-[22px] text-ink-muted">
            {t("Your profile")}
          </figcaption>
        </figure>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-edge-soft py-6">
        <img src={stremioLogo} alt="" className="h-8 w-8 shrink-0 object-contain" />
        <div className="min-w-[220px] flex-1">
          <p className="text-[15.5px] font-medium leading-[23px] text-ink">{t("Bringing your Stremio library?")}</p>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-muted">
            {t("Connect Stremio to bring in your library and addons.")}
          </p>
        </div>
        <button
          type="button"
          className={ROW_ACTION}
          onClick={() => setActive("account", settingsAnchor("Stremio"))}
        >
          {t("Open Stremio settings")}
        </button>
      </div>
    </Section>
  );
}
