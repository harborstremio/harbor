import ReactMarkdown from "react-markdown";
import { minecraftArt, minecraftLink } from "@/lib/games/minecraft-catalog";
import { MinecraftProjectLink } from "./minecraft-project-link";

/** Provider prose is rendered as Markdown; source HTML and arbitrary image hosts stay inert. */
export function MinecraftProjectProse({ children }: { children: string }) {
  return <div className="mc-project-prose"><ReactMarkdown skipHtml urlTransform={(url, key) => key === "src" ? minecraftArt(url) : minecraftLink(url)} components={{
    a: ({ href, children, node }) => node?.children.every(child => child.type === "text" ? !child.value.trim() : child.type === "element" && child.tagName === "img" && !minecraftArt(child.properties.src)) ? null : href ? <MinecraftProjectLink url={href}>{children}</MinecraftProjectLink> : <span>{children}</span>,
    img: ({ src, alt }) => src ? <img src={src} alt={alt || ""} loading="lazy" /> : null,
  }}>{children}</ReactMarkdown></div>;
}
