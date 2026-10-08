import { Check } from "lucide-react";
import { JlAccountForm } from "@/components/jl-account-form";
import { useT } from "@/lib/i18n";
import { signOutJl, useJlSession } from "@/lib/jl/account/client";
import { isWeb } from "@/lib/platform";

export function AccountStep({ onSkip }: { onSkip: () => void }) {
  const t = useT();
  const session = useJlSession();
  // The web app only works signed in; the desktop and TV apps can also run on their own.
  const required = isWeb();

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 1 of 4 · Your account")}
      </span>
      <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink">
        {session ? t("You're signed in") : t("Sign in to JL Media Vision")}
      </h1>

      {session ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-[14px] text-ink">
            <Check size={15} className="shrink-0 text-accent" />
            <span className="min-w-0 truncate">{session.email ?? t("Signed in")}</span>
          </p>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {t("Your profiles, favorites, keys and TV logins now follow you to every device.")}
          </p>
          <button
            onClick={() => void signOutJl()}
            className="w-fit text-[13px] text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
          >
            {t("Use a different account")}
          </button>
        </div>
      ) : (
        <>
          <JlAccountForm
            intro={t(
              "One account for every device. Already set up somewhere else? Sign in and your TV provider and keys come with you.",
            )}
          />
          {!required && (
            <button
              onClick={onSkip}
              className="w-fit text-[13px] text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
            >
              {t("Skip for now (nothing syncs between devices)")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
