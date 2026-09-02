import { Palette, RefreshCw, UserRound } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { DeviceScene } from "./device-scene";
import { useT } from "@/lib/i18n";

const PERKS = [
  {
    icon: <UserRound size={15} strokeWidth={2} />,
    title: "Your handle",
    body: "One @name that finds you across Harbor.",
  },
  {
    icon: <Palette size={15} strokeWidth={2} />,
    title: "Publish themes",
    body: "Share what you build and see who is using it.",
  },
  {
    icon: <RefreshCw size={15} strokeWidth={2} />,
    title: "Sync everywhere",
    body: "Settings, lists and progress follow you between machines.",
  },
];

export function SignedOutHero({ onSignIn }: { onSignIn: () => void }) {
  const t = useT();
  return (
    <div className="harbor-cascade flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6 rounded-md bg-elevated px-7 py-8">
        <div className="flex min-w-[260px] max-w-[34ch] flex-1 flex-col items-start gap-5">
          <span className="grid h-14 w-14 place-items-center rounded-md bg-canvas text-ink">
            <HarborMark className="h-8 w-8" />
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-[28px] font-medium leading-[1.1] tracking-tight text-ink">
              {t("One Harbor, every screen.")}
            </h3>
            <p className="text-[13.5px] leading-relaxed text-ink-subtle">
              {t("Your handle, your themes, your settings. Signed in once, waiting on the next machine you open.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSignIn}
              className="harbor-press-pop flex h-11 items-center rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas"
            >
              {t("Create your account")}
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="harbor-press-pop flex h-11 items-center rounded-md bg-canvas px-5 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("I already have one")}
            </button>
          </div>
        </div>
        <DeviceScene />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        {PERKS.map((perk) => (
          <div
            key={perk.title}
            className="harbor-perk flex flex-col gap-2.5 rounded-md bg-elevated px-4 py-4 transition-colors hover:bg-raised"
          >
            <span className="harbor-perk__icon grid h-9 w-9 place-items-center rounded-md bg-canvas text-ink-muted">
              {perk.icon}
            </span>
            <span className="text-[13px] font-medium text-ink">{t(perk.title)}</span>
            <span className="text-[12.5px] leading-relaxed text-ink-subtle">{t(perk.body)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
