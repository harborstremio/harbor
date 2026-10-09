import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { GamesIcon } from "./games-icon";
import "./games-nav-icon.css";

export function GamesNavIcon({ hovered = false }: { hovered?: boolean }) {
  const { settings } = useSettings();
  const reducedMotion = useReducedMotion();
  const enabled = settings.navIconAnimations && !reducedMotion;
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    if (!enabled) setPressing(false);
    else if (hovered) setPressing(true);
    // Finish the release when the pointer leaves, like the Sports icon's landing.
  }, [enabled, hovered]);

  return (
    <span
      aria-hidden="true"
      className={`games-nav-icon${enabled && pressing ? " is-pressing" : ""}`}
      onAnimationEnd={(event) => {
        if (event.animationName === "games-nav-play"
          && event.target === event.currentTarget.querySelector("svg")) {
          setPressing(false);
        }
      }}
    >
      <GamesIcon />
    </span>
  );
}
