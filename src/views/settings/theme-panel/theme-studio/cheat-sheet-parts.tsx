import { Check, Copy, Download } from "lucide-react";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { downloadText } from "@/lib/download-text";
import { useT } from "@/lib/i18n";
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
                side === "left"
                  ? "translate(calc(-100% - 10px), -50%)"
                  : "translate(-50%, calc(-100% - 16px))",
              ...SUITE_CHROME,
            }}
            className="pointer-events-none z-[260] whitespace-nowrap rounded-md bg-raised px-2.5 py-1 text-[12.5px] font-medium text-ink harbor-float"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function CopyName({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <HoverTip label={t("Click to copy")} disabled={copied}>
      <button
        type="button"
        onClick={copy}
        aria-label={t("Copy {text}", { text })}
        className="group/cn relative inline-grid cursor-pointer justify-items-start text-start [perspective:600px]"
      >
        <code
          className="col-start-1 row-start-1 font-mono text-[13.5px] font-semibold text-ink transition-[transform,opacity,color] duration-300 group-hover/cn:text-accent"
          style={{
            transform: copied ? "rotateX(90deg)" : "rotateX(0deg)",
            opacity: copied ? 0 : 1,
          }}
        >
          {text}
        </code>
        <span
          aria-hidden
          className="col-start-1 row-start-1 flex items-center gap-1 transition-[transform,opacity] duration-300"
          style={{
            transform: copied ? "rotateX(0deg)" : "rotateX(-90deg)",
            opacity: copied ? 1 : 0,
          }}
        >
          <Check size={14} strokeWidth={2.6} className="text-accent" />
          <code className="font-mono text-[13px] font-semibold text-accent">{t("Copied")}</code>
        </span>
      </button>
    </HoverTip>
  );
}

export function CodeBlock({
  code,
  filename,
  compact,
}: {
  code: string;
  filename?: string;
  compact?: boolean;
}) {
  const t = useT();
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
    void downloadText(name, code, [name.split(".").pop() ?? "txt"], t("Harbor snippet"));
  };
  return (
    <div className={`overflow-hidden rounded-md bg-elevated ${compact ? "mt-2.5" : ""}`}>
      <div className="flex items-center gap-2 px-3 pb-0.5 pt-2">
        <span className="flex-1 truncate font-mono text-[12.5px] text-ink-subtle">
          {filename ?? t("example")}
        </span>
        {filename && (
          <button
            type="button"
            onClick={download}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Download size={14} strokeWidth={2.2} />
            {t("Download")}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          {copied ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} strokeWidth={2.2} />}
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
      <pre className="overflow-auto px-4 pb-3 pt-1 font-mono text-[13px] leading-relaxed text-ink-muted">
        {code}
      </pre>
    </div>
  );
}
