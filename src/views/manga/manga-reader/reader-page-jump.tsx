import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { useT } from "@/lib/i18n";

const SPRING: React.CSSProperties = {
  transition: "transform 460ms cubic-bezier(0.2,1.15,0.32,1), opacity 240ms ease-out",
};

export function ReaderPageJump({
  currentPage,
  totalPages,
  label,
  onJump,
}: {
  currentPage: number;
  totalPages: number;
  label?: string;
  onJump: (page: number) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!editing) return;
    committed.current = false;
    setDraft(String(currentPage + 1));
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [editing, currentPage]);

  const commit = () => {
    committed.current = true;
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n)) onJump(Math.min(Math.max(n, 1), totalPages) - 1);
    setEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") setEditing(false);
  };

  const enter = mounted
    ? "translate-y-0 scale-100 opacity-100"
    : "translate-y-3 scale-90 opacity-0";

  return (
    <>
      {editing && (
        <div aria-hidden onClick={() => setEditing(false)} className="fixed inset-0 z-[89]" />
      )}
      <div
        style={SPRING}
        className={`fixed bottom-24 end-6 z-[90] ${enter} motion-reduce:!translate-y-0 motion-reduce:!scale-100 motion-reduce:!opacity-100 motion-reduce:transition-none`}
      >
      {editing ? (
        <div className="flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/80 pe-1.5 ps-4 shadow-lg backdrop-blur-md">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={totalPages}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (!committed.current) setEditing(false);
            }}
            className="w-12 bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[13px] font-medium tabular-nums text-ink-subtle">/ {totalPages}</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="ms-1 flex h-8 items-center rounded-full bg-accent px-3.5 text-[13px] font-semibold text-canvas transition-[filter,transform] hover:brightness-110 active:scale-95"
          >
            {t("Go")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("Page {page} of {count}, tap to jump", { page: currentPage + 1, count: totalPages })}
          className="group flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-canvas/80 px-4 shadow-lg backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-edge hover:bg-canvas/90 hover:shadow-xl active:translate-y-0 active:scale-[0.97]"
        >
          <FileText
            size={15}
            strokeWidth={2.2}
            className="text-ink-subtle transition-colors group-hover:text-ink-muted"
          />
          <span className="text-[15px] font-semibold tabular-nums text-ink">
            {label ?? currentPage + 1}
            <span className="mx-1 font-normal text-ink-subtle">/</span>
            {totalPages}
          </span>
        </button>
      )}
      </div>
    </>
  );
}
