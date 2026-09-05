import { useT } from "@/lib/i18n";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[252px] flex-col gap-2.5 rounded-[10px] bg-canvas p-4">{children}</div>
  );
}

function Caption({ text }: { text: string }) {
  return <span className="text-[15.5px] leading-[22px] text-ink-subtle">{text}</span>;
}

export function ResumeArt() {
  const t = useT();
  return (
    <Frame>
      <div className="relative h-8 overflow-hidden rounded-[4px] bg-elevated">
        <span className="harbor-art-fill absolute inset-y-0 start-0 bg-ink/25" />
        <span className="absolute inset-y-1.5 start-[92px] w-[2px] rounded-full bg-ink-subtle" />
        <span className="harbor-art-resume absolute inset-y-0 start-0 w-[4px] rounded-full bg-ink" />
      </div>
      <Caption text={t("Picks up at your saved spot instead of the start.")} />
    </Frame>
  );
}

export function ResumePromptArt() {
  const t = useT();
  return (
    <Frame>
      <div className="relative grid h-[74px] place-items-center rounded-[4px] bg-elevated">
        <div className="harbor-art-prompt flex w-[150px] flex-col gap-2 rounded-[4px] bg-canvas p-2.5">
          <span className="h-[3px] w-16 rounded-full bg-ink-subtle" />
          <div className="flex gap-1.5">
            <span className="h-5 flex-1 rounded-[3px] bg-ink" />
            <span className="h-5 flex-1 rounded-[3px] bg-elevated" />
          </div>
        </div>
      </div>
      <Caption text={t("Asks first: carry on, or start over.")} />
    </Frame>
  );
}

export function RememberStreamArt() {
  const t = useT();
  return (
    <Frame>
      <div className="relative h-[74px] rounded-[4px] bg-elevated">
        <span className="absolute inset-x-3 top-2.5 h-6 rounded-[3px] bg-canvas" />
        <span className="harbor-art-fly absolute inset-x-3 bottom-3 flex h-6 items-center gap-1.5 rounded-[3px] bg-ink px-2">
          <span className="h-[3px] w-10 rounded-full bg-canvas" />
          <span className="h-[3px] w-5 rounded-full bg-canvas" />
        </span>
      </div>
      <Caption text={t("Replays the exact source you used last time.")} />
    </Frame>
  );
}

export function SeasonLockArt() {
  const t = useT();
  return (
    <Frame>
      <div className="flex h-[74px] flex-col justify-center gap-2 rounded-[4px] bg-elevated px-3">
        <span className="mx-auto flex h-6 items-center rounded-[6px] bg-ink px-2.5 text-[13px] font-bold uppercase tracking-[0.72px] text-canvas">
          {t("One release")}
        </span>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="harbor-art-seq h-[3px] w-8 rounded-full bg-ink"
              style={{ animationDelay: `${i * 0.28}s` }}
            />
          ))}
        </div>
      </div>
      <Caption text={t("Every episode of the season uses that same release.")} />
    </Frame>
  );
}

export function StallSkipArt() {
  const t = useT();
  return (
    <Frame>
      <div className="flex h-[74px] flex-col justify-center gap-1.5 rounded-[4px] bg-elevated px-3">
        <span className="harbor-art-stall flex h-6 items-center rounded-[3px] bg-ink px-2">
          <span className="h-[3px] w-14 rounded-full bg-canvas" />
        </span>
        <span className="flex h-6 items-center rounded-[3px] bg-canvas px-2">
          <span className="h-[3px] w-10 rounded-full bg-ink-subtle" />
        </span>
      </div>
      <Caption text={t("A dead source is dropped and the next one starts.")} />
    </Frame>
  );
}
