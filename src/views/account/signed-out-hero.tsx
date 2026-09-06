import { HarborMark } from "@/components/icons/harbor-mark";
import { DeviceScene } from "./device-scene";
import { useT } from "@/lib/i18n";

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
    </div>
  );
}
