import { useT } from "@/lib/i18n";
import { buildCanvasDoc, clampHeight } from "./build-canvas-iframe";

export function CanvasFrame({ html, css, height }: { html: string; css: string; height?: number }) {
  const t = useT();
  const doc = buildCanvasDoc(html, css);
  const h = clampHeight(height);
  return (
    <iframe
      title={t("Custom profile")}
      sandbox=""
      referrerPolicy="no-referrer"
      loading="lazy"
      srcDoc={doc}
      style={{
        width: "100%",
        height: h,
        border: 0,
        borderRadius: 14,
        display: "block",
        background: "transparent",
      }}
    />
  );
}

export function CanvasCard({
  html,
  css,
  height,
  hiddenFromVisitors,
  hideTitle,
}: {
  html: string;
  css: string;
  height?: number;
  hiddenFromVisitors?: boolean;
  hideTitle?: boolean;
}) {
  const t = useT();
  return (
    <section className="rounded-[16px] bg-surface p-2 ring-1 ring-edge-soft">
      {(!hideTitle || hiddenFromVisitors) && (
        <div className="mb-2 flex items-center justify-between px-1">
          {hideTitle ? (
            <span />
          ) : (
            <span className="text-[13px] font-medium text-ink-muted">{t("Custom")}</span>
          )}
          {hiddenFromVisitors && (
            <span className="text-[12px] text-ink-subtle">{t("Hidden from visitors")}</span>
          )}
        </div>
      )}
      <CanvasFrame html={html} css={css} height={height} />
    </section>
  );
}
