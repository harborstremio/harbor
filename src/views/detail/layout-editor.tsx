import { Check, RotateCcw } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { PencilOutlineIcon } from "@/components/icons/pencil-outline";
import {
  loadDetailCustomization,
  moveSection,
  resetDetailCustomization,
  saveDetailCustomization,
  toggleSectionHidden,
  type DetailCustomization,
} from "@/lib/detail-customization";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ContentRails, type DetailSection } from "./content-rails";
import "./layout-editor.css";

export function DetailLayoutEditor({ sections }: { sections: DetailSection[] }) {
  const t = useT();
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [layout, setLayout] = useState<DetailCustomization>(loadDetailCustomization);
  const [editing, setEditing] = useState(false);
  const [finished, setFinished] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const railsRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const animations = useRef<Animation[]>([]);
  const hasChanges = layout.order.length > 0 || layout.hidden.length > 0;
  const showReset = editing && hasChanges;
  const keys = sections.map((section) => section.key);

  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => setFinished(false), 1000);
    return () => window.clearTimeout(timer);
  }, [finished]);

  useEffect(() => {
    if (reducedMotion) animations.current.forEach((animation) => animation.cancel());
    return () => animations.current.forEach((animation) => animation.cancel());
  }, [reducedMotion]);

  const apply = (next: DetailCustomization) => {
    const root = railsRef.current;
    positions.current.clear();
    if (root && !reducedMotion) {
      const top = root.getBoundingClientRect().top;
      // Capture before the update, including any in-flight movement on rapid clicks.
      root.querySelectorAll<HTMLElement>("[data-detail-section]").forEach((element) => {
        positions.current.set(element.dataset.detailSection!, element.getBoundingClientRect().top - top);
      });
    }
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    setLayout(next);
    saveDetailCustomization(next);
  };

  useLayoutEffect(() => {
    const root = railsRef.current;
    if (!root || reducedMotion || positions.current.size === 0) return;
    const top = root.getBoundingClientRect().top;
    root.querySelectorAll<HTMLElement>("[data-detail-section]").forEach((element) => {
      const previous = positions.current.get(element.dataset.detailSection!);
      const rect = element.getBoundingClientRect();
      const delta = previous === undefined ? 0 : previous - (rect.top - top);
      if (Math.abs(delta) < 1 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      animations.current.push(element.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      ));
    });
    positions.current.clear();
  }, [layout, reducedMotion]);

  return (
    <>
      <div className="detail-layout-toolbar flex items-center justify-end">
        <div className="detail-layout-reset" data-visible={showReset} inert={!showReset} aria-hidden={!showReset}>
          <div>
            <button
              type="button"
              onClick={() => {
                apply(resetDetailCustomization());
                toggleRef.current?.focus({ preventScroll: true });
              }}
              className="detail-layout-action flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-[12px] font-medium text-ink-muted hover:bg-white/[0.10] hover:text-ink"
            >
              <RotateCcw size={12} strokeWidth={2.2} />
              {t("Reset")}
            </button>
          </div>
        </div>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={editing}
          aria-controls={id}
          aria-label={editing ? t("Done editing") : t("Customize layout")}
          data-state={editing ? "editing" : finished ? "finished" : "idle"}
          onClick={() => {
            setFinished(editing);
            setEditing(!editing);
          }}
          className={`detail-layout-action detail-layout-toggle flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium ${
            editing ? "bg-ink text-canvas hover:opacity-90" : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
          }`}
        >
          <span className="detail-layout-glyph" aria-hidden="true">
            <PencilOutlineIcon size={12} />
            <Check size={12} strokeWidth={2.2} />
          </span>
          <span className="detail-layout-label" aria-hidden="true">
            <span data-label="idle">{t("Customize layout")}</span>
            <span data-label="editing">{t("Done editing")}</span>
            <span data-label="finished">{t("Done")}</span>
          </span>
        </button>
      </div>
      <div ref={railsRef} id={id} className="harbor-fade-in-up">
        <ContentRails
          sections={sections}
          custom={layout}
          editMode={editing}
          onMove={(key, delta) => apply(moveSection(layout, keys, key, delta))}
          onToggleHidden={(key) => apply(toggleSectionHidden(layout, key))}
        />
      </div>
    </>
  );
}
