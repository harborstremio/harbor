import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAddon } from "@/lib/providers/stremio-addons";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

export function AddonDocumentation({ slug }: { slug: string }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getAddon(slug)
      .then((detail) => {
        if (cancelled) return;
        setText(detail.documentation?.trim() || null);
      })
      .catch(() => {
        if (cancelled) return;
        setText(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (expanded || !text) return;
    const el = bodyRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight > el.clientHeight + 1) setNeedsToggle(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div className="border-b border-edge-soft pb-12 mb-12">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
          {t("Documentation")}
        </h2>
        <span className="text-[10.5px] uppercase tracking-[0.22em] text-ink-subtle">
          {t("From stremio-addons.net")}
        </span>
      </div>
      <div
        ref={bodyRef}
        className={`prose-doc max-w-3xl text-[14px] leading-relaxed text-ink-muted ${
          expanded ? "" : "max-h-[420px] overflow-hidden"
        }`}
      >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml={true}
            components={{
              h1: (p) => (
                <h3 className="mt-6 mb-2 font-display text-[20px] font-medium tracking-tight text-ink first:mt-0">
                  {p.children}
                </h3>
              ),
              h2: (p) => (
                <h4 className="mt-5 mb-2 font-display text-[17px] font-medium tracking-tight text-ink">
                  {p.children}
                </h4>
              ),
              h3: (p) => (
                <h5 className="mt-4 mb-1.5 text-[14px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {p.children}
                </h5>
              ),
              h4: (p) => (
                <h6 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{p.children}</h6>
              ),
              p: (p) => <p className="mb-3">{p.children}</p>,
              a: (p) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof p.href === "string" && /^https?:\/\//i.test(p.href)) openUrl(p.href);
                  }}
                  className="inline font-semibold text-accent underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {p.children}
                </button>
              ),
              ul: (p) => <ul className="mb-3 ms-5 list-disc">{p.children}</ul>,
              ol: (p) => <ol className="mb-3 ms-5 list-decimal">{p.children}</ol>,
              li: (p) => <li className="mb-1">{p.children}</li>,
              code: (p) => {
                const isInline = !String(p.className ?? "").includes("language-");
                return isInline ? (
                  <code className="rounded bg-canvas/60 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
                    {p.children}
                  </code>
                ) : (
                  <code className={p.className}>{p.children}</code>
                );
              },
              pre: (p) => (
                <pre className="mb-3 overflow-x-auto rounded-xl border border-edge-soft bg-canvas/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink">
                  {p.children}
                </pre>
              ),
              blockquote: (p) => (
                <blockquote className="my-3 border-s-2 border-accent/60 ps-3 italic text-ink-subtle">
                  {p.children}
                </blockquote>
              ),
              strong: (p) => <strong className="font-semibold text-ink">{p.children}</strong>,
              em: (p) => <em className="italic">{p.children}</em>,
              hr: () => <hr className="my-5 border-edge-soft" />,
              img: (p) => (
                <img
                  src={p.src as string | undefined}
                  alt={p.alt ?? ""}
                  draggable={false}
                  loading="lazy"
                  className="my-3 inline-block max-w-full rounded-lg align-middle"
                  style={{ maxHeight: 360 }}
                />
              ),
              picture: (p) => <span className="inline-block">{p.children}</span>,
              source: () => null,
              br: () => <br />,
              div: (p) => <div className="mb-3">{p.children}</div>,
              span: (p) => <span className={p.className as string | undefined}>{p.children}</span>,
              details: (p) => (
                <details className="my-3 rounded-xl border border-edge-soft bg-canvas/40 p-3">
                  {p.children}
                </details>
              ),
              summary: (p) => (
                <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
                  {p.children}
                </summary>
              ),
              table: (p) => (
                <div className="my-4 overflow-x-auto rounded-xl border border-edge-soft">
                  <table className="w-full border-collapse text-[13px]">{p.children}</table>
                </div>
              ),
              thead: (p) => <thead className="bg-elevated/60">{p.children}</thead>,
              tbody: (p) => <tbody>{p.children}</tbody>,
              tr: (p) => <tr className="border-b border-edge-soft/40 last:border-b-0">{p.children}</tr>,
              th: (p) => (
                <th className="px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wider text-ink">
                  {p.children}
                </th>
              ),
              td: (p) => <td className="px-3 py-2 align-top text-ink-muted">{p.children}</td>,
            }}
          >
            {text}
          </ReactMarkdown>
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-[0.18em] text-accent transition-opacity hover:opacity-80"
        >
          {expanded ? t("Show less") : t("Show full documentation")}
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
