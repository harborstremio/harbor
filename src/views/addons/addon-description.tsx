import { useT } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AddonDescription({ text }: { text: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
    setShowToggle(false);
  }, [text]);

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight > el.clientHeight + 1) setShowToggle(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="max-w-2xl">
      <p ref={ref} className={`text-[14px] leading-relaxed text-ink-muted ${expanded ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-[0.18em] text-accent transition-opacity hover:opacity-80"
        >
          {expanded ? t("Show less") : t("View more")}
          <ChevronDown
            size={12}
            strokeWidth={2.6}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
