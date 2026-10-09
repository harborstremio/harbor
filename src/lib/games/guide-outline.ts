import type { GuideArticle } from "./guides-data";

export type GuideHeading = { id: string; title: string; sectionId: string; depth: number; children: GuideHeading[] };

/** Add local anchors only after the provider HTML has passed the reader sanitizer. */
export function outlineGuide(article: GuideArticle) {
  const headings: GuideHeading[] = [], entries: GuideHeading[] = [];
  const sections = article.sections.map(section => {
    const parent: GuideHeading = { id: section.id, title: section.title, sectionId: section.id, depth: 0, children: [] };
    headings.push(parent); entries.push(parent);
    const body = new DOMParser().parseFromString(section.html, "text/html").body;
    const stack = [{ level: 0, heading: parent }];
    for (const [index, node] of [...body.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")].entries()) {
      const title = node.textContent?.replace(/\s+/g, " ").trim();
      // Do not expose concealed spoiler headings in the contents list.
      if (!title || node.closest(".games-guide-spoiler")) continue;
      const level = Number(node.tagName.slice(1));
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const owner = stack[stack.length - 1].heading;
      const heading: GuideHeading = { id: `${section.id}-heading-${index}`, title, sectionId: section.id, depth: owner.depth + 1, children: [] };
      const target = body.ownerDocument.createElement(`h${Math.min(heading.depth + 2, 6)}`);
      target.append(...node.childNodes); node.replaceWith(target);
      target.id = heading.id; target.tabIndex = -1; target.dataset.guideHeading = "";
      owner.children.push(heading); entries.push(heading); stack.push({ level, heading });
    }
    return { ...section, html: body.innerHTML };
  });
  return { sections, headings, entries };
}
