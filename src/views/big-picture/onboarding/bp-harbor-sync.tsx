import jlHero from "@/assets/brand/jl-hero.webp";
import { BpOnboardAside } from "./bp-onboard-aside";

export function BpHarborSync() {
  return (
    <BpOnboardAside>
      <img
        src={jlHero}
        alt=""
        draggable={false}
        className="w-full select-none self-start rounded-[var(--bp-r-md)] object-contain"
        style={{ maxHeight: "clamp(260px, 54vh, 640px)" }}
      />
    </BpOnboardAside>
  );
}
