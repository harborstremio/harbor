import { HarborMark } from "@/components/icons/harbor-mark";

export function DeviceScene() {
  return (
    <span aria-hidden className="block shrink-0 select-none">
      <span className="relative block h-[136px] w-[268px]">
        <span className="absolute inset-x-0 bottom-[8px] block h-px bg-ink/[0.08]" />

        <Screen left={0} top={26} w={120} h={70} radius={6} glow="harbor-slot-a" />
        <span className="absolute block bg-raised" style={{ left: 53, top: 96, width: 14, height: 11 }} />
        <span
          className="absolute block rounded-[2px] bg-raised"
          style={{ left: 36, top: 107, width: 48, height: 5 }}
        />

        <Screen left={136} top={48} w={78} h={48} radius={5} glow="harbor-slot-b" />
        <span
          className="absolute block bg-raised"
          style={{ left: 128, top: 96, width: 94, height: 6, borderRadius: "0 0 4px 4px" }}
        />
        <span
          className="absolute block rounded-full bg-canvas/60"
          style={{ left: 165, top: 98, width: 20, height: 2 }}
        />

        <span
          className="absolute block bg-raised"
          style={{ left: 232, top: 58, width: 28, height: 54, borderRadius: 7 }}
        >
          <span className="absolute block bg-canvas" style={{ inset: 3, borderRadius: 5 }}>
            <span className="harbor-slot-c absolute inset-0 block rounded-[5px] bg-ink/[0.08]" />
          </span>
          <span className="absolute start-1/2 top-[2px] block h-[2px] w-[9px] -translate-x-1/2 rounded-full bg-canvas/70" />
        </span>

        <span
          className="harbor-hop absolute grid h-[24px] w-[24px] place-items-center rounded-[5px] bg-ink text-canvas"
          style={{ left: 48, top: 49 }}
        >
          <HarborMark className="h-[15px] w-[15px]" />
        </span>
      </span>
    </span>
  );
}

function Screen({
  left,
  top,
  w,
  h,
  radius,
  glow,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  radius: number;
  glow: string;
}) {
  const inner = Math.max(2, radius - 3);
  return (
    <span
      className="absolute block bg-raised"
      style={{ left, top, width: w, height: h, borderRadius: radius }}
    >
      <span className="absolute block bg-canvas" style={{ inset: 4, borderRadius: inner }}>
        <span
          className={`${glow} absolute inset-0 block bg-ink/[0.08]`}
          style={{ borderRadius: inner }}
        />
      </span>
    </span>
  );
}
