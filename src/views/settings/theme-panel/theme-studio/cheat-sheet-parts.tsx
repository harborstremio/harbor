import { downloadText } from "@/lib/download-text";
import { Check, Copy, Download } from "lucide-react";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SUITE_CHROME } from "./suite-theme";

export function HoverTip({
  label,
  children,
  side = "top",
  disabled,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "left";
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const place = (e: MouseEvent) => {
    if (side === "left") {
      const r = ref.current?.getBoundingClientRect();
      if (r) setTip({ x: r.left, y: r.top + r.height / 2 });
    } else {
      setTip({ x: e.clientX, y: e.clientY });
    }
  };
  const hide = () => setTip(null);
  return (
    <span
      ref={ref}
      onMouseEnter={place}
      onMouseMove={side === "top" ? place : undefined}
      onMouseLeave={hide}
      onMouseDown={hide}
      className="inline-flex"
    >
      {children}
      {tip &&
        !disabled &&
        createPortal(
          <span
            style={{
              position: "fixed",
              left: tip.x,
              top: tip.y,
              transform:
                side === "left" ? "translate(calc(-100% - 10px), -50%)" : "translate(-50%, calc(-100% - 16px))",
              ...SUITE_CHROME,
            }}
            className="pointer-events-none z-[260] whitespace-nowrap rounded-md border border-edge bg-raised px-2.5 py-1 text-[12px] font-medium text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function CopyName({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <HoverTip label="Click to copy" disabled={copied}>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${text}`}
        className="group/cn relative inline-grid cursor-pointer justify-items-start text-start [perspective:600px]"
      >
        <code
          className="col-start-1 row-start-1 font-mono text-[13.5px] font-semibold text-ink transition-[transform,opacity,color] duration-300 group-hover/cn:text-accent"
          style={{ transform: copied ? "rotateX(90deg)" : "rotateX(0deg)", opacity: copied ? 0 : 1 }}
        >
          {text}
        </code>
        <span
          aria-hidden
          className="col-start-1 row-start-1 flex items-center gap-1 transition-[transform,opacity] duration-300"
          style={{ transform: copied ? "rotateX(0deg)" : "rotateX(-90deg)", opacity: copied ? 1 : 0 }}
        >
          <Check size={13} strokeWidth={2.6} className="text-accent" />
          <code className="font-mono text-[13px] font-semibold text-accent">Copied</code>
        </span>
      </button>
    </HoverTip>
  );
}

export function CodeBlock({ code, filename, compact }: { code: string; filename?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      return;
    }
  };
  const download = () => {
    const name = filename ?? "snippet.txt";
    void downloadText(name, code, [name.split(".").pop() ?? "txt"], "Harbor snippet");
  };
  return (
    <div className={`overflow-hidden rounded-lg border border-edge-soft bg-elevated ${compact ? "mt-2.5" : ""}`}>
      <div className="flex items-center gap-2 border-b border-edge-soft/70 bg-canvas/40 px-3 py-1.5">
        <span className="flex-1 truncate font-mono text-[12px] text-ink-subtle">{filename ?? "example"}</span>
        {filename && (
          <button
            type="button"
            onClick={download}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <Download size={13} strokeWidth={2.2} />
            Download
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-muted">{code}</pre>
    </div>
  );
}
