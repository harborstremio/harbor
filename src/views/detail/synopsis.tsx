import { useT } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Synopsis({ text }: { text: string }) {
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
    <div className="max-w-3xl">
      <p ref={ref} className={`text-[16px] leading-relaxed text-ink-muted ${expanded ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {expanded ? t("Show less") : t("Show more")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
