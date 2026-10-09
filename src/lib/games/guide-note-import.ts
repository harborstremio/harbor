import { guidePlainText } from "./guide-export-data";
import type { GameGuide, GuideArticle } from "./guides-data";
import { parseNotebook, type GameNote } from "./game-notes";

const escape = (text: string) => text.replace(/[\\`*_{}\[\]()#+.!<>|~-]/g, "\\$&");
/** Import readable authored content, without retaining executable markup or remote image requests. */
export function guideNoteImport(item: GameGuide, article: GuideArticle, sections: boolean): GameNote[] {
  const author = article.authors?.map(value => value.name).join(", ") || item.author;
  const source = { url: item.url, author };
  const parts = article.sections.map(section => ({ title: section.title || article.title, body: guidePlainText(section.html).split("\n").map(escape).join("\n") }));
  const drafts = sections ? parts : [{ title: article.title, body: parts.map(part => `## ${escape(part.title)}\n\n${part.body}`).join("\n\n") }];
  return parseNotebook(JSON.stringify({ version: 1, revision: 0, notes: drafts.map(part => ({ id: crypto.randomUUID(), title: part.title.slice(0, 120) || "Guide", body: part.body, source })) })).notes;
}
