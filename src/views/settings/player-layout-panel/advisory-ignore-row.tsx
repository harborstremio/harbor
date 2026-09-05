import { Check, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { clearAdvisoryIgnores, useAdvisoryIgnoreCount } from "@/lib/player/content-advisory-ignore";
import { ActionRow } from "../advanced-panel/action-row";

export function AdvisoryIgnoreRow({ featureOn }: { featureOn: boolean }) {
  const t = useT();
  const count = useAdvisoryIgnoreCount();
  const [restored, setRestored] = useState(false);
  const pressedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!restored) return;
    const done = () => setRestored(false);
    const held = pressedRef.current;
    const timer = window.setTimeout(() => {
      if (held && document.activeElement === held && navOwnsFocus(held)) {
        held.addEventListener("blur", done, { once: true });
        return;
      }
      done();
    }, 1400);
    return () => {
      window.clearTimeout(timer);
      held?.removeEventListener("blur", done);
    };
  }, [restored]);

  if (!featureOn && count === 0 && !restored) return null;

  return (
    <ActionRow
      label={t("Ignored titles")}
      sub={
        count === 0
          ? t("Titles you ignore on the advisory card never show it again.")
          : t("{count} titles will never show the content advisory again.", { count })
      }
      cta={restored ? t("Restored") : t("Restore")}
      icon={restored ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
      tone={restored ? "success" : "neutral"}
      disabled={count === 0 && !restored}
      onClick={() => {
        const el = document.activeElement;
        pressedRef.current = el instanceof HTMLElement ? el : null;
        clearAdvisoryIgnores();
        setRestored(true);
      }}
    />
  );
}
