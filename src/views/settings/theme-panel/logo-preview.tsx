import { HarborMark } from "@/components/icons/harbor-mark";
import harborWordmark from "@/assets/harbor-wordmark.svg";
import { useT } from "@/lib/i18n";

function Rows({ n, top, start, w }: { n: number; top: number; start: number; w: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="absolute block h-[5px] rounded-[2px] bg-ink"
          style={{ top: top + i * 10, insetInlineStart: start, width: w - i * 14, opacity: 0.14 - i * 0.03 }}
        />
      ))}
    </>
  );
}

export function LogoPreview({ mark, wordmark, icon }: { mark: string; wordmark: string; icon: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      <div className="flex min-w-[260px] flex-1 flex-col gap-2.5 rounded-md bg-elevated px-4 py-4">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("In the sidebar")}
        </span>
        <span className="relative block h-[124px] overflow-hidden rounded-md bg-canvas">
          <span className="absolute inset-y-0 start-0 block w-[104px] bg-ink/[0.05]" />
          <span className="absolute start-3 top-3 flex h-7 items-center gap-2">
            {mark ? (
              <img src={mark} alt="" draggable={false} className="h-6 w-6 object-contain" />
            ) : (
              <HarborMark className="h-6 w-6 text-ink" />
            )}
            {wordmark ? (
              <img src={wordmark} alt="" draggable={false} className="h-[15px] w-auto object-contain" />
            ) : (
              <img
                src={harborWordmark}
                alt=""
                draggable={false}
                className="h-[13px] w-auto object-contain opacity-80"
              />
            )}
          </span>
          <Rows n={4} top={46} start={12} w={78} />
          <Rows n={3} top={22} start={122} w={150} />
          <span className="absolute end-4 top-[74px] block h-[38px] w-[92px] rounded-[3px] bg-ink/[0.07]" />
          <span className="absolute start-[122px] top-[74px] block h-[38px] w-[92px] rounded-[3px] bg-ink/[0.07]" />
        </span>
      </div>

      <div className="flex w-[210px] flex-col gap-2.5 rounded-md bg-elevated px-4 py-4">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("On the taskbar")}
        </span>
        <span className="relative block h-[124px] overflow-hidden rounded-md bg-canvas">
          <span className="absolute inset-x-0 bottom-0 block h-9 bg-ink/[0.06]" />
          <span className="absolute bottom-[7px] start-1/2 flex -translate-x-1/2 items-end gap-2.5">
            <span className="block h-5 w-5 rounded-[3px] bg-ink/[0.12]" />
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[4px] bg-elevated">
              {icon ? (
                <img src={icon} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <HarborMark className="h-5 w-5 text-ink" />
              )}
            </span>
            <span className="block h-5 w-5 rounded-[3px] bg-ink/[0.12]" />
          </span>
          <span className="absolute inset-x-6 top-5 block h-[52px] rounded-[3px] bg-ink/[0.05]" />
        </span>
      </div>
    </div>
  );
}
