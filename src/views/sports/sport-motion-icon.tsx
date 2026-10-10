import { useMemo, useState } from "react";
import { NavLottie } from "@/components/icons/nav-lottie";
import baseballBasketball from "@/assets/lottie/nav/sports/baseball-basketball.json";
import soccerHockey from "@/assets/lottie/nav/sports/soccer-hockey.json";
import boxingTennis from "@/assets/lottie/nav/sports/boxing-tennis.json";
import { SportIcon } from "./sport-icon";

const clips: Record<string, object> = {
  baseball: baseballBasketball,
  basketball: baseballBasketball,
  soccer: soccerHockey,
  hockey: soccerHockey,
  combat: boxingTennis,
  boxing: boxingTennis,
  tennis: boxingTennis,
};

/** The supplied morphs have room here; navigation uses the lightweight static basketball. */
export function SportMotionIcon({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false);
  const data = useMemo(() => (clips[name] ? structuredClone(clips[name]) : null), [name]);
  const fallback = (
    <span className="sh-sport-motion-still">
      <SportIcon name={name} size={36} />
    </span>
  );
  return (
    <span
      className="sh-sport-motion"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {data ? <NavLottie data={data} hovered={hovered} fallback={fallback} /> : fallback}
    </span>
  );
}
