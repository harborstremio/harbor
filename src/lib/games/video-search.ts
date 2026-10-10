export type GameVideoSearch = "gameplay" | "trailer";
/** Keep the actual edition title; never interpret it as a URL, command or provider ID. */
export function gameVideoSearchUrl(name: string, kind: GameVideoSearch): string | null {
  const title = name.trim();
  if (!title || title.length > 512 || /[\u0000-\u001f\u007f]/.test(title) || !["gameplay", "trailer"].includes(kind)) return null;
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", `${title} ${kind}`);
  return url.href;
}
