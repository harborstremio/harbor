import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export function resolveStreamLink(stream: { url?: string; externalUrl?: string }): string | null {
  return stream.url ?? stream.externalUrl ?? null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    /* fallback: Use standard web API */
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  }
  catch (error) {
    console.error("failed to copy: ", error);
  }
  return false;

}

export function CopyLinkButton({
  url,
  size = 13,
  className = "",
  label,
}: {
  url: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const t = useT();
  const resolvedLabel = label ?? t("Copy link");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(url);
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      title={copied ? t("Copied to clipboard") : resolvedLabel}
      aria-label={resolvedLabel}
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }
      }}
      className={`relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 ${
        copied ? "bg-success/12 text-success" : "text-ink-subtle hover:bg-canvas/60 hover:text-ink"
      } ${className}`}
    >
      <Copy
        size={size}
        strokeWidth={2}
        className={`absolute transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
        }`}
      />
      <Check
        size={size + 1}
        strokeWidth={2.6}
        className={`absolute transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      />
    </span>
  );
}
