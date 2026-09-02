import { useEffect, useRef, useState } from "react";
import { Check, FolderOpen, X } from "lucide-react";
import { saveTextFileWithPath } from "@/lib/download-text";
import { useT } from "@/lib/i18n";

export function DownloadMenu({
  docsRef,
  onSaved,
}: {
  docsRef: React.RefObject<HTMLDivElement | null>;
  onSaved: (path: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const exportAs = async (kind: "txt" | "json" | "pdf") => {
    setOpen(false);
    const root = docsRef.current;
    if (!root) return;
    const documentTitle = t("Harbor Relay Documentation");
    if (kind === "pdf") {
      printDocs(root, documentTitle);
      return;
    }
    const isTxt = kind === "txt";
    const content = isTxt
      ? buildTxt(root, documentTitle)
      : JSON.stringify(buildJson(root, documentTitle), null, 2);
    setBusy(true);
    try {
      const { path } = await saveTextFileWithPath(
        isTxt ? "harbor-relay-docs.txt" : "harbor-relay-docs.json",
        content,
        [isTxt ? "txt" : "json"],
        t("Harbor Relay docs"),
      );
      if (path) onSaved(path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-10 items-center gap-2 rounded-md px-4 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
          open ? "bg-raised text-ink" : "bg-canvas text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        <DownloadGlyph />
        {busy ? t("Saving…") : t("Download")}
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-30 flex w-48 flex-col gap-0.5 overflow-hidden rounded-md bg-raised p-1 harbor-float animate-in fade-in slide-in-from-top-1 duration-150">
          <DownloadOption label={t("Plain text (.txt)")} onClick={() => void exportAs("txt")} />
          <DownloadOption label={t("JSON (.json)")} onClick={() => void exportAs("json")} />
          <DownloadOption label={t("PDF (print)")} onClick={() => void exportAs("pdf")} />
        </div>
      )}
    </div>
  );
}

function DownloadOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-md px-3 py-2.5 text-start text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
    >
      {label}
    </button>
  );
}

function DownloadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavePill({ path, onDismiss }: { path: string; onDismiss: () => void }) {
  const t = useT();
  const reveal = async () => {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(path);
    } catch {
      /* best-effort */
    }
  };
  const name = path.split(/[\\/]/).pop() ?? path;
  const dir = path.slice(0, Math.max(0, path.length - name.length)).replace(/[\\/]+$/, "");
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[min(560px,90vw)] items-center gap-3 rounded-md bg-elevated p-2 ps-3 harbor-float animate-in fade-in slide-in-from-bottom-2 duration-200">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success/15 text-success">
          <Check size={14} strokeWidth={2.8} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px] font-semibold leading-tight text-ink">{t("Saved")}</span>
          <span className="truncate text-[11.5px] leading-tight text-ink-subtle" title={path}>
            {dir || name}
          </span>
        </div>
        <button
          type="button"
          onClick={reveal}
          className="ms-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <FolderOpen size={14} strokeWidth={2.2} />
          {t("Show")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("Dismiss")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  main { max-width: 720px; margin: 0 auto; padding: 40px; color: #16181d;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.62; }
  h2 { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; }
  h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; margin: 24px 0 8px; }
  p { margin: 0 0 10px; color: #2b2f38; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin: 0 0 5px; color: #2b2f38; }
  code { font-family: "SF Mono", ui-monospace, Consolas, monospace; font-size: 11.5px;
    background: #f1f2f4; border: 1px solid #e2e4e8; border-radius: 4px; padding: 1px 5px; }
  kbd { font-family: "SF Mono", ui-monospace, Consolas, monospace; font-size: 11px;
    background: #f6f7f8; border: 1px solid #d8dbe0; border-radius: 5px; padding: 1px 6px; }
  pre { background: #f6f7f8; border: 1px solid #e2e4e8; border-radius: 8px; padding: 12px 14px;
    font-family: "SF Mono", ui-monospace, Consolas, monospace; font-size: 11.5px; line-height: 1.5;
    white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; margin: 8px 0 12px; }
  pre code { background: none; border: 0; padding: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 4px 0 14px; page-break-inside: avoid; }
  th, td { border: 1px solid #e2e4e8; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #f6f7f8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #5b616e; }
  header { border-bottom: 1px solid #e2e4e8; padding-bottom: 18px; margin-bottom: 8px; }
  header p:first-child { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; font-weight: 700; color: #1f8f88; margin: 0 0 6px; }
  section, header { page-break-inside: avoid; }
  @page { margin: 14mm; }
`;

function printDocs(root: HTMLElement, title: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title></title><style>${PRINT_CSS}</style></head><body><main>${root.innerHTML}</main></body></html>`,
  );
  doc.title = title;
  doc.close();
  const win = iframe.contentWindow;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    setTimeout(() => iframe.remove(), 400);
  };
  win?.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    win?.focus();
    win?.print();
    setTimeout(cleanup, 60000);
  }, 180);
}

function buildTxt(root: HTMLElement, title: string): string {
  const lines: string[] = [];
  root.querySelectorAll("h2, h3, p, li, pre").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag === "h2" || tag === "h3") {
      lines.push("");
      lines.push(text);
      lines.push("=".repeat(Math.min(text.length, 60)));
    } else if (tag === "li") {
      lines.push(`- ${text}`);
    } else if (tag === "pre") {
      lines.push("");
      lines.push((el.textContent ?? "").trimEnd());
      lines.push("");
    } else {
      lines.push(text);
    }
  });
  return `${title}\n${"=".repeat(Math.min(title.length, 60))}\n${lines.join("\n").trim()}\n`;
}

function buildJson(root: HTMLElement, title: string) {
  const sections: Array<{ heading: string; blocks: Array<unknown> }> = [];
  let current: { heading: string; blocks: Array<unknown> } | null = null;
  const ensureSection = (heading: string) => {
    current = { heading, blocks: [] };
    sections.push(current);
  };
  root.querySelectorAll("section, header").forEach((sec) => {
    const head = sec.querySelector("h2, h3");
    if (head) ensureSection((head.textContent ?? "").trim());
    else if (!current) ensureSection("");
    sec
      .querySelectorAll(":scope > p, :scope > ul, :scope > ol, :scope > pre, :scope > div table")
      .forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === "p")
          current!.blocks.push({ type: "paragraph", text: (el.textContent ?? "").trim() });
        else if (tag === "pre") current!.blocks.push({ type: "code", text: el.textContent ?? "" });
        else if (tag === "ul" || tag === "ol") {
          const items = Array.from(el.querySelectorAll(":scope > li")).map((li) =>
            (li.textContent ?? "").trim(),
          );
          current!.blocks.push({ type: tag === "ol" ? "ordered_list" : "list", items });
        } else if (tag === "table") {
          const rows = Array.from(el.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()),
          );
          const headers = Array.from(el.querySelectorAll("thead th")).map((th) =>
            (th.textContent ?? "").trim(),
          );
          current!.blocks.push({ type: "table", headers, rows });
        }
      });
  });
  return {
    title,
    generatedAt: new Date().toISOString(),
    sections,
  };
}
