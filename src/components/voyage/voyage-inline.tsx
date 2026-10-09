import { ChevronUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import type { Voyage } from "@/lib/voyage/types";
import courseArt from "@/assets/voyage/course.svg";
import { VoyageChooser } from "./voyage-chooser";
import { VoyageRoute } from "./voyage-route";

export function VoyageInline({ active, onClose }: { active: Voyage | null; onClose: () => void }) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const step = active ? `${active.id}:${active.phase}:${active.routeIds.length}` : "chooser";
  useEffect(() => {
    // Keep keyboard position when the selected film is replaced by the next choices.
    const heading = root.current?.querySelector<HTMLElement>("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [step]);
  return (
    <div ref={root} className="voyage-inline" data-tv-focus-scope>
      <header className="voyage-inline-header">
        <span>{t("Harbor Voyages")}</span>
        <button type="button" onClick={onClose} aria-label={t("Close")} data-tv-modal-close className="voyage-collapse">
          <ChevronUp size={18} strokeWidth={1.7} />
        </button>
      </header>
      <div className="voyage-inline-body">
        <img className="voyage-course-art" src={courseArt} alt="" aria-hidden draggable={false} />
        {active ? <VoyageRoute key={active.id} voyage={active} inline /> : <VoyageChooser inline />}
      </div>
    </div>
  );
}
