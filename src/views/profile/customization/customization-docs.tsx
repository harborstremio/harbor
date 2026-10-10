import { useT } from "@/lib/i18n";

const CAN = [
  "Any HTML layout: headings, paragraphs, lists, tables, sections, divs.",
  "Any CSS: colors, gradients, grid, flex, animations, web fonts via @import from https.",
  "Images and video from https or data URLs.",
  "Links open in a new tab automatically.",
];

const CANNOT = [
  "No JavaScript. Scripts, inline handlers, and javascript: URLs are removed.",
  "No nested iframes, objects, or embeds.",
  "No forms or popups. The canvas cannot navigate the page.",
];

function translateDoc(item: string, t: (key: string) => string): string {
  switch (item) {
    case "Any HTML layout: headings, paragraphs, lists, tables, sections, divs.":
      return t("Any HTML layout: headings, paragraphs, lists, tables, sections, divs.");
    case "Any CSS: colors, gradients, grid, flex, animations, web fonts via @import from https.":
      return t(
        "Any CSS: colors, gradients, grid, flex, animations, web fonts via @import from https.",
      );
    case "Images and video from https or data URLs.":
      return t("Images and video from https or data URLs.");
    case "Links open in a new tab automatically.":
      return t("Links open in a new tab automatically.");
    case "No JavaScript. Scripts, inline handlers, and javascript: URLs are removed.":
      return t("No JavaScript. Scripts, inline handlers, and javascript: URLs are removed.");
    case "No nested iframes, objects, or embeds.":
      return t("No nested iframes, objects, or embeds.");
    case "No forms or popups. The canvas cannot navigate the page.":
      return t("No forms or popups. The canvas cannot navigate the page.");
    default:
      return item;
  }
}

function List({ items, tone }: { items: string[]; tone: "ok" | "no" }) {
  const t = useT();
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
          <span className={tone === "ok" ? "text-success" : "text-ink-subtle"}>
            {tone === "ok" ? "+" : "-"}
          </span>
          <span>{translateDoc(item, t)}</span>
        </li>
      ))}
    </ul>
  );
}

export function CustomizationDocs() {
  const t = useT();
  return (
    <div className="space-y-4 rounded-lg bg-elevated/60 p-4 ring-1 ring-edge-soft">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{t("How the canvas works")}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {t(
            "Your HTML and CSS render inside a sandboxed frame, fully isolated from the rest of Harbor. Write it like a tiny self-contained page. Font and page background are separate controls above, applied to the whole profile.",
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
            {t("Allowed")}
          </div>
          <List items={CAN} tone="ok" />
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
            {t("Not allowed")}
          </div>
          <List items={CANNOT} tone="no" />
        </div>
      </div>
      <p className="text-[12px] text-ink-subtle">
        {t("HTML and CSS are each capped at 16,384 characters.")}
      </p>
    </div>
  );
}
