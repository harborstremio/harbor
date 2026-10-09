import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { parseQueensberryDetail } from "../src/lib/sports/boxing-queensberry-detail.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

// Main-event excerpts from Queensberry's official event pages, September 14, 2026.
const fixtures = [
  {
    slug: "liam-davies-vs-nathaniel-collins-homestretch",
    date: "2026-09-26",
    title: "Homestretch",
    names: ["Liam Davies", "Nathaniel Collins"],
    images: [
      "LIAM-DAVIES_4b876ed4-1571-4b8a-8b58-88a4a69e82ee.png?v=1726061038",
      "Nathaniel-Collins.png?v=1757673523",
    ],
  },
  {
    slug: "daniel-dubois-vs-fabio-wardley-2-run-it-back",
    date: "2026-10-17",
    title: "Run it back",
    names: ["Daniel Dubois", "Fabio Wardley"],
    images: ["Daniel_Dubois_1.png?v=1736419596", "Fabio-Wardley_5.png?v=1757927629"],
  },
  {
    slug: "joshua-buatsi-vs-willy-hutchinson-2-point-to-prove",
    date: "2026-11-07",
    title: "A point 2 prove",
    names: ["Joshua Buatsi", "Willy Hutchinson"],
    images: ["Joshua-Buatsi.png?v=1754044492", "Willy-Hutchinson_1.png?v=1788876985"],
  },
];
const image = (name: string) => `https://queensberry.co.uk/cdn/shop/files/${name}`;
function fixture(index = 0) {
  const f = fixtures[index];
  const id = `queensberry:pages/${f.slug}`;
  const side = { id: "", name: "", logo: "", abbr: "", score: "", winner: false };
  const game: SportsGame = {
    id,
    league: "BOXING",
    source: "official-boxing",
    state: "pre",
    detail: "",
    startMs: Date.parse(`${f.date}T12:00:00Z`),
    dateOnly: f.date,
    home: { ...side },
    away: { ...side },
    poster: image("actual-event-poster.jpg"),
    context: {
      id,
      name: f.title,
      round: "",
      draw: "Queensberry",
      venue: "Published venue",
      major: false,
    },
    broadcasts: ["DAZN"],
  };
  const html = `<link rel="canonical" href="https://queensberry.co.uk/pages/${f.slug}"><div class="custom-banner-content">${f.names.map((name, i) => `<h2><span>-${name.split(" ")[0]}-</span>\n${name.split(" ").slice(1).join(" ")}${index === 2 && i === 1 ? " 2" : ""}</h2>`).join("")}<h6>7 | 10 | 26</h6></div><section id="id-fighter-result">${f.names.map((name, i) => `<div class="fighter-result-info-blocks fighter-result-info-${i ? "left" : "right"}"><div class="fighter-result-info-image-content"><img src="${image(f.images[i]).replace("https:", "")}"><h3><span>Light Heavyweight</span>\n${name}</h3></div></div>`).join('<div class="fighter-result-info-image-center-content"><img src="//queensberry.co.uk/cdn/shop/files/VS.svg"></div>')}</section><div class="fighter-info-section"><img src="${game.poster}"></div><script>window.parserScriptExecuted=true;</script>`;
  return { game, html, expected: f };
}

interface DomNode {
  textContent: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): DomNode | null;
  querySelectorAll(selector: string): DomNode[];
}
function inert<T>(run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = {
    createElement() {
      let html = "";
      return {
        set innerHTML(value: string) {
          html = value;
        },
        get content() {
          const $ = load(html);
          const wrap = (nodes: ReturnType<typeof $>): DomNode => ({
            textContent: nodes.text(),
            getAttribute: (name) => nodes.attr(name) ?? null,
            querySelector: (selector) => {
              const found = nodes.find(selector).first();
              return found.length ? wrap(found) : null;
            },
            querySelectorAll: (selector) =>
              nodes
                .find(selector)
                .toArray()
                .map((node) => wrap($(node))),
          });
          return wrap($.root());
        },
      };
    },
  } as unknown as Document;
  try {
    return run();
  } finally {
    globalThis.document = previous;
  }
}

test("all three official main events enrich full names and standalone portraits without changing schedule precision", () =>
  inert(() => {
    for (let index = 0; index < fixtures.length; index++) {
      const { game, html, expected } = fixture(index);
      const enriched = parseQueensberryDetail(html, game);
      assert.notEqual(enriched, game);
      assert.equal(enriched.home.name, expected.names[0]);
      assert.equal(enriched.away.name, expected.names[1]);
      assert.equal(enriched.home.logo, image(expected.images[0]));
      assert.equal(enriched.away.logo, image(expected.images[1]));
      assert.equal(enriched.dateOnly, expected.date);
      assert.equal(enriched.startMs, game.startMs);
      assert.equal(enriched.poster, game.poster);
      assert.equal(enriched.context, game.context);
      assert.equal(enriched.broadcasts, game.broadcasts);
      assert.equal(game.home.name, "");
      assert.equal(parseQueensberryDetail(html, enriched), enriched);
    }
  }));

test("missing, mismatched or credentialed canonical URLs and non-Queensberry identities cannot enrich", () =>
  inert(() => {
    const { game, html } = fixture();
    for (const altered of [
      html.replace('rel="canonical"', 'rel="alternate"'),
      html.replace(
        'href="https://queensberry.co.uk/pages/',
        'href="https://queensberry.co.uk/pages/other-',
      ),
      html.replace(
        'href="https://queensberry.co.uk/',
        'href="https://name:password@queensberry.co.uk/',
      ),
      "x".repeat(1_000_001),
    ]) {
      assert.equal(parseQueensberryDetail(altered, game), game);
    }
    for (const wrong of [
      { ...game, source: "thesportsdb-hub" },
      { ...game, id: game.id.replace("queensberry:", "matchroom:") },
      { ...game, league: "UFC" },
    ]) {
      assert.equal(parseQueensberryDetail(html, wrong), wrong);
    }
  }));

test("portraits must match two distinct announced full names regardless of positional CSS classes", () =>
  inert(() => {
    const { game, html } = fixture();
    const wrongPanel = html.replace("\nNathaniel Collins</h3>", "\nSomeone Else</h3>");
    assert.equal(parseQueensberryDetail(wrongPanel, game), game);
    const conflicting = { ...game, home: { ...game.home, name: "Previous Opponent" } };
    assert.equal(parseQueensberryDetail(html, conflicting), conflicting);
    const duplicate = html.replace("\nNathaniel Collins</h3>", "\nLiam Davies</h3>");
    assert.equal(parseQueensberryDetail(duplicate, game), game);
    const preserved = {
      ...game,
      home: { ...game.home, name: "Liam Davies", record: "18-1-0", id: "verified-athlete" },
    };
    const result = parseQueensberryDetail(html, preserved);
    assert.equal(result.home.record, "18-1-0");
    assert.equal(result.home.id, "verified-athlete");
  }));

test("unsafe images and event posters never become portraits", () =>
  inert(() => {
    const { game, html, expected } = fixture();
    for (const unsafe of [
      "https://evil.example/fighter.png",
      "https://user:pass@queensberry.co.uk/cdn/shop/files/fighter.png",
      "https://queensberry.co.uk:444/cdn/shop/files/fighter.png",
      "http://queensberry.co.uk/cdn/shop/files/fighter.png",
      "data:image/svg+xml,bad",
      "//queensberry.co.uk/cdn/shop/files/VS.svg",
      "//queensberry.co.uk/pages/fighter.png",
    ]) {
      const result = parseQueensberryDetail(
        html.replace(image(expected.images[0]).replace("https:", ""), unsafe),
        game,
      );
      assert.equal(result.home.logo, "");
      assert.equal(result.home.name, expected.names[0]);
      assert.equal(result.poster, game.poster);
    }
    assert.equal(
      parseQueensberryDetail(
        html.replaceAll("fighter-result-info-image-content", "poster-content"),
        game,
      ),
      game,
    );
  }));
