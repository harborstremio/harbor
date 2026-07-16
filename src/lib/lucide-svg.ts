import type { LucideIcon } from "lucide-react";

type IconNode = Array<[tag: string, attributes: Record<string, string | number>]>;
type LucideRenderResult = { props?: { iconNode?: IconNode } };
type RenderableLucideIcon = LucideIcon & {
  render?: (props: Record<string, never>, ref: null) => LucideRenderResult;
};

function escapeAttribute(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svgAttributeName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function lucideIconInnerSvg(Icon: LucideIcon): string {
  const iconNode = (Icon as RenderableLucideIcon).render?.({}, null)?.props?.iconNode;
  if (!iconNode) return "";

  return iconNode
    .map(([tag, attributes]) => {
      const serialized = Object.entries(attributes)
        .filter(([name]) => name !== "key")
        .map(([name, value]) => `${svgAttributeName(name)}="${escapeAttribute(value)}"`)
        .join(" ");
      return `<${tag}${serialized ? ` ${serialized}` : ""}/>`;
    })
    .join("");
}
