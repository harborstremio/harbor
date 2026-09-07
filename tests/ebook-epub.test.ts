import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { strToU8, zipSync } from "fflate";
import { legacyEpubChapterTitle, parseEpub, readEpubChapter } from "../src/lib/ebook/epub.ts";

type XmlNode = {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: XmlNode[];
  parent?: XmlNode | null;
};

class XmlFixtureNode {
  node: XmlNode;
  wrappers: WeakMap<XmlNode, XmlFixtureNode>;

  constructor(node: XmlNode, wrappers: WeakMap<XmlNode, XmlFixtureNode>) {
    this.node = node;
    this.wrappers = wrappers;
    wrappers.set(node, this);
  }

  wrap(node: XmlNode): XmlFixtureNode {
    return this.wrappers.get(node) ?? new XmlFixtureNode(node, this.wrappers);
  }

  get nodeType(): number {
    return this.node.type === "root" ? 9 : this.node.type === "text" ? 3 : this.node.name ? 1 : 8;
  }

  get localName(): string {
    return (this.node.name ?? "").split(":").at(-1)!;
  }

  get childNodes(): XmlFixtureNode[] {
    return (this.node.children ?? []).map((node) => this.wrap(node));
  }

  get children(): XmlFixtureNode[] {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get parentElement(): XmlFixtureNode | null {
    const parent = this.node.parent && this.wrap(this.node.parent);
    return parent?.nodeType === 1 ? parent : null;
  }

  get documentElement(): XmlFixtureNode | undefined {
    return this.children[0];
  }

  get textContent(): string {
    return this.node.type === "text"
      ? (this.node.data ?? "")
      : this.childNodes
          .filter((node) => node.nodeType !== 8)
          .map((node) => node.textContent)
          .join("");
  }

  getElementsByTagName(name: string): XmlFixtureNode[] {
    return this.children.flatMap((node) => [
      ...(name === "*" || node.node.name === name ? [node] : []),
      ...node.getElementsByTagName(name),
    ]);
  }

  getAttribute(name: string): string | null {
    return this.node.attribs?.[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  getAttributeNS(namespace: string, name: string): string | null {
    for (const attribute of Object.keys(this.node.attribs ?? {})) {
      const [prefix, local] = attribute.split(":");
      if (local !== name) continue;
      for (let node: XmlFixtureNode | null = this; node; node = node.parentElement)
        if (node.getAttribute(`xmlns:${prefix}`) === namespace) return this.getAttribute(attribute);
    }
    return null;
  }

  createTextNode(value: string): XmlFixtureNode {
    return this.wrap({ type: "text", data: value });
  }

  remove(): void {
    const siblings = this.node.parent?.children;
    const index = siblings?.indexOf(this.node) ?? -1;
    if (siblings && index >= 0) siblings.splice(index, 1);
    this.node.parent = null;
  }

  replaceWith(replacement: XmlFixtureNode): void {
    const siblings = this.node.parent?.children;
    const index = siblings?.indexOf(this.node) ?? -1;
    if (siblings && index >= 0) {
      replacement.node.parent = this.node.parent;
      siblings.splice(index, 1, replacement.node);
      this.node.parent = null;
    }
  }
}

class XmlFixtureParser {
  parseFromString(value: string): XmlFixtureNode {
    return new XmlFixtureNode(
      load(value, { xmlMode: true }).root()[0] as unknown as XmlNode,
      new WeakMap(),
    );
  }
}

Object.assign(globalThis, { DOMParser: XmlFixtureParser });

const xhtml = (body: string) =>
  `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Fixture book</title></head><body>${body}</body></html>`;

function epub(
  files: Array<[string, string]>,
  options: { nav?: string; ncx?: string; spine?: string[] } = {},
): ArrayBuffer {
  const manifest = files.map(
    ([name], index) =>
      `<item id="f${index}" href="${encodeURI(name)}" media-type="application/xhtml+xml"/>`,
  );
  if (options.nav)
    manifest.push(
      '<item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    );
  if (options.ncx)
    manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  const spine = (options.spine ?? files.map(([name]) => name)).map(
    (name) => `<itemref idref="f${files.findIndex(([file]) => file === name)}"/>`,
  );
  const entries: Record<string, Uint8Array> = {
    "META-INF/container.xml": strToU8(
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    ),
    "OPS/book.opf": strToU8(
      `<package><metadata><title>Fixture book</title></metadata><manifest>${manifest.join("")}</manifest><spine>${spine.join("")}</spine></package>`,
    ),
    ...Object.fromEntries(files.map(([name, body]) => [`OPS/${name}`, strToU8(xhtml(body))])),
  };
  if (options.nav) entries["OPS/toc.xhtml"] = strToU8(xhtml(options.nav));
  if (options.ncx) entries["OPS/toc.ncx"] = strToU8(options.ncx);
  return zipSync(entries, { level: 0 }).slice().buffer as ArrayBuffer;
}

const toc = (...links: Array<[string, string]>) =>
  `<nav epub:type="toc"><ol>${links.map(([href, title]) => `<li><a href="${href}">${title}</a></li>`).join("")}</ol></nav>`;

test("EPUB chapters use each TOC anchor and exclude navigation landmarks and page numbers", async () => {
  const book = await parseEpub(
    epub(
      [
        [
          "book.xhtml",
          '<h2 id="one">Chapter One</h2><p>First chapter body.</p><h2 id="two">Chapter Two</h2><p>Second chapter body.</p><h2 id="three">Chapter Three</h2><p>Third chapter body.</p>',
        ],
      ],
      {
        nav:
          toc(
            ["book.xhtml#one", "One"],
            ["book.xhtml#one", "Duplicate"],
            ["book.xhtml#two", "Two"],
            ["book.xhtml#three", "Three"],
          ) +
          '<nav epub:type="page-list"><a href="book.xhtml#two">Page 14</a></nav><nav epub:type="landmarks"><a href="book.xhtml">Start reading</a></nav>',
      },
    ),
  );
  assert.deepEqual(
    book.chapters.map((chapter) => chapter.title),
    ["One", "Two", "Three"],
  );
  assert.deepEqual(
    book.chapters.map((chapter) => readEpubChapter(book, chapter.path)),
    [
      "Chapter One\n\nFirst chapter body.",
      "Chapter Two\n\nSecond chapter body.",
      "Chapter Three\n\nThird chapter body.",
    ],
  );
  assert.match(
    readEpubChapter(book, "OPS/book.xhtml"),
    /First chapter body\.[\s\S]*Third chapter body\./,
  );
});

test("chapter order follows the spine and anchors while continuations span storage files", async () => {
  const book = await parseEpub(
    epub(
      [
        ["a.xhtml", '<h2 id="one">First</h2><p>Chapter one begins.</p>'],
        ["b.xhtml", '<p>Chapter one continues.</p><h2 id="two">Second</h2><p>Chapter two begins.</p>'],
        ["c.xhtml", "<p>Chapter two continues in another file.</p>"],
      ],
      { nav: toc(["b.xhtml#two", "Second"], ["a.xhtml#one", "First"]) },
    ),
  );
  assert.deepEqual(
    book.chapters.map((chapter) => chapter.title),
    ["First", "Second"],
  );
  assert.equal(
    readEpubChapter(book, book.chapters[0].path),
    "First\n\nChapter one begins.\n\nChapter one continues.",
  );
  assert.equal(
    readEpubChapter(book, book.chapters[1].path),
    "Second\n\nChapter two begins.\n\nChapter two continues in another file.",
  );
});

test("prefaces, nested chapter markers, direct body text, and final paragraphs remain readable", async () => {
  const book = await parseEpub(
    epub(
      [
        [
          "book.xhtml",
          '<div>Preface text before the chapters.</div><section><h2>Chapter <a id="one"/>One</h2><div>Direct text.<p>A nested paragraph.</p>More direct text.</div></section><section id="two"><h2>Chapter Two</h2><p>The ending.</p></section>',
        ],
      ],
      { nav: toc(["book.xhtml#one", "One"], ["book.xhtml#two", "Two"]) },
    ),
  );
  assert.equal(book.chapters.length, 3);
  assert.equal(book.chapters[0].path, "OPS/book.xhtml#");
  assert.equal(readEpubChapter(book, book.chapters[0].path), "Preface text before the chapters.");
  assert.equal(
    readEpubChapter(book, book.chapters[1].path),
    "Chapter One\n\nDirect text.\n\nA nested paragraph.\n\nMore direct text.",
  );
  assert.equal(readEpubChapter(book, book.chapters[2].path), "Chapter Two\n\nThe ending.");
});

test("unusable EPUB 3 navigation falls back to nested NCX chapter targets", async () => {
  const book = await parseEpub(
    epub(
      [
        [
          "book.xhtml",
          '<h2 id="one">One</h2><p>First chapter.</p><h2 id="two">Two</h2><p>Second chapter.</p>',
        ],
      ],
      {
        nav: toc(["missing.xhtml#no", "Broken"]),
        ncx: '<ncx><navMap><navPoint><navLabel><text>First</text></navLabel><content src="book.xhtml#one"/><navPoint><navLabel><text>Second</text></navLabel><content src="book.xhtml#two"/></navPoint></navPoint></navMap></ncx>',
      },
    ),
  );
  assert.deepEqual(
    book.chapters.map((chapter) => chapter.title),
    ["First", "Second"],
  );
  assert.equal(readEpubChapter(book, book.chapters[1].path), "Two\n\nSecond chapter.");
});

test("missing or unusable navigation keeps the legacy whole-document spine fallback", async () => {
  for (const nav of [
    undefined,
    toc(["book.xhtml#missing", "Missing"], ["https://outside.invalid/book.xhtml", "External"]),
  ]) {
    const book = await parseEpub(
      epub(
        [
          ["book.xhtml", "<h2>First</h2><p>First readable document content.</p>"],
          ["next.xhtml", "<h2>Next</h2><p>Second readable document content.</p>"],
        ],
        { nav, spine: ["next.xhtml", "book.xhtml"] },
      ),
    );
    assert.deepEqual(
      book.chapters.map((chapter) => chapter.path),
      ["OPS/next.xhtml", "OPS/book.xhtml"],
    );
    assert.equal(
      readEpubChapter(book, book.chapters[0].path),
      "Next\n\nSecond readable document content.",
    );
  }
});

test("document-start links and encoded fragments have stable cache-distinct targets", async () => {
  const book = await parseEpub(
    epub(
      [
        [
          "text one.xhtml",
          '<p>Opening text.</p><h2 id="chapter%2">Encoded chapter</h2><p>The final text.</p>',
        ],
      ],
      { nav: toc(["TEXT%20ONE.xhtml", "Opening"], ["text%20one.xhtml#chapter%252", "Encoded"]) },
    ),
  );
  assert.deepEqual(
    book.chapters.map((chapter) => chapter.path),
    ["OPS/text one.xhtml#", "OPS/text one.xhtml#chapter%252"],
  );
  assert.equal(readEpubChapter(book, book.chapters[0].path), "Opening text.");
  assert.match(readEpubChapter(book, "OPS/text one.xhtml"), /Opening text\.[\s\S]*The final text\./);
});

test("document-start targets preserve leading text with one unique chapter path", async () => {
  const book = await parseEpub(
    epub(
      [
        ["preface.xhtml", "<p>Preface in an earlier file.</p>"],
        [
          "book.xhtml",
          'Leading body text.<div>Opening section.</div><h2 id="one">One</h2><p>Chapter content.</p>',
        ],
      ],
      { nav: toc(["book.xhtml#one", "One"], ["book.xhtml", "Opening"]) },
    ),
  );
  assert.deepEqual(
    book.chapters.map((chapter) => chapter.path),
    ["OPS/preface.xhtml#", "OPS/book.xhtml#", "OPS/book.xhtml#one"],
  );
  assert.equal(new Set(book.chapters.map((chapter) => chapter.path)).size, book.chapters.length);
  assert.deepEqual(
    book.chapters.map((chapter) => readEpubChapter(book, chapter.path)),
    [
      "Preface in an earlier file.",
      "Leading body text.\n\nOpening section.",
      "One\n\nChapter content.",
    ],
  );
});

test("135 chapter anchors remain complete and distinct when an EPUB groups them into 11 files", async () => {
  const files: Array<[string, string]> = [];
  const links: Array<[string, string]> = [];
  const expected: string[] = [];
  for (let chapter = 1; chapter <= 135; chapter++) {
    const fileIndex = Math.floor((chapter - 1) / 13);
    files[fileIndex] ??= [`part-${fileIndex}.xhtml`, ""];
    files[fileIndex][1] +=
      `<h2 id="c${chapter}">Chapter ${chapter}</h2><p>Unique chapter ${chapter} content.</p>`;
    links.push([`${files[fileIndex][0]}#c${chapter}`, `Chapter ${chapter}`]);
    expected.push(`Chapter ${chapter}\n\nUnique chapter ${chapter} content.`);
  }
  const book = await parseEpub(epub(files, { nav: toc(...links) }));
  assert.equal(files.length, 11);
  assert.equal(book.chapters.length, 135);
  assert.deepEqual(book.chapters.map((chapter) => readEpubChapter(book, chapter.path)), expected);
});

test("legacy title recovery preserves the exact original label used by cached translations", async () => {
  const files: Array<[string, string]> = [
    [
      "book.xhtml",
      '<h2 id="one">A Beginning</h2><p>First chapter content.</p><h2 id="two">An Ending</h2><p>Second chapter content.</p>',
    ],
  ];
  const nav =
    '<nav epub:type="page-list"><a href="book.xhtml#one">Page 1</a></nav>' +
    toc(["book.xhtml#one", " 1.  A Beginning "], ["book.xhtml#two", "2. An Ending"]);
  const book = await parseEpub(epub(files, { nav }));
  assert.equal(legacyEpubChapterTitle(book, "OPS/book.xhtml"), "1.  A Beginning");
  assert.equal(book.chapters[0].title, "1. A Beginning");

  const landmarks = await parseEpub(
    epub(files, {
      nav:
        '<nav epub:type="landmarks"><a href="book.xhtml">Start reading</a></nav>' + nav,
    }),
  );
  assert.equal(legacyEpubChapterTitle(landmarks, "OPS/book.xhtml"), "Start reading");
  assert.equal(landmarks.chapters[0].title, "1. A Beginning");
});

test("legacy NCX and heading labels remain recoverable after chapter splitting", async () => {
  const files: Array<[string, string]> = [
    [
      "book.xhtml",
      '<h2 id="one">A Beginning</h2><p>First chapter content.</p><h2 id="two">An Ending</h2><p>Second chapter content.</p>',
    ],
  ];
  const ncx =
    '<ncx><navMap><navPoint><navLabel><text>First label</text></navLabel><content src="book.xhtml#one"/><navPoint><navLabel><text>Last label</text></navLabel><content src="book.xhtml#two"/></navPoint></navPoint></navMap></ncx>';
  const ncxBook = await parseEpub(epub(files, { ncx }));
  assert.equal(legacyEpubChapterTitle(ncxBook, "OPS/book.xhtml"), "Last label");
  const brokenNav = await parseEpub(epub(files, { ncx, nav: toc(["missing.xhtml", "Missing"]) }));
  assert.equal(legacyEpubChapterTitle(brokenNav, "OPS/book.xhtml"), "A Beginning");
  assert.equal(brokenNav.chapters[0].title, "First label");
  const noToc = await parseEpub(epub(files));
  assert.equal(legacyEpubChapterTitle(noToc, "OPS/book.xhtml"), "A Beginning");
  assert.equal(legacyEpubChapterTitle(noToc, "OPS/missing.xhtml"), undefined);
});
