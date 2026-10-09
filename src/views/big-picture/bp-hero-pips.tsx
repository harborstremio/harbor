const REST = "w-[5.3px] bg-[var(--bp-edge-2)]";
const LIVE = "w-[10.7px] bg-ink";

// Not focusable and not a rail row. Eight buttons standing in for hundreds of
// slides was a meaningless focus stop between the hero controls and the page.
//
// TRAP, and it is the reason this file lost its `running` and `durationMs`
// props. The active pip used to hold an inner bar with transitionDuration set to
// the whole rotation interval, linear, restarted on every swap. Fourteen seconds
// of transition every fourteen seconds is a hundred percent duty cycle: a render
// surface that never rests, the same class as an `infinite` keyframe, and it ran
// while the ring was down in the rows with nobody looking at it. Position only.
// Do not put the countdown back.
export function BpHeroPips({ total, active }: { total: number; active: number }) {
  if (total < 2) return null;

  return (
    <div aria-hidden className="flex items-center justify-center gap-[12.5px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[5.3px] shrink-0 rounded-full transition-[width,background-color] duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
            i === active ? LIVE : REST
          }`}
        />
      ))}
    </div>
  );
}
