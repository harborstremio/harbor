import { lazy, Suspense, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { LeagueDef } from "@/lib/sports/espn-types";
import "./league-guide.css";
const Guide = lazy(() =>
  import("./league-guide").then((module) => ({ default: module.LeagueGuide })),
);
export function LeagueGuideLauncher({ league }: { league: LeagueDef }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} className="sh-league-guide-launcher" onClick={() => setOpen(true)}>
        <BookOpen size={15} />
        {t("League guide")}
      </button>
      <Suspense fallback={null}>
        {open && (
          <Guide
            league={league}
            onClose={() => {
              setOpen(false);
              requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
            }}
          />
        )}
      </Suspense>
    </>
  );
}
