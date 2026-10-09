import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import type { SportsGame } from "../src/lib/sports/espn-types";
import { parsePbcDetail } from "../src/lib/sports/boxing-pbc-detail.ts";

const origin = "https://www.premierboxingchampions.com";
const cruz = `${origin}/sites/default/files/styles/fight_315x315/public/BioImage_IsaacCruz.jpg?itok=zb0_uJOq`;
const bravo = `${origin}/sites/default/files/styles/fight_315x315/public/BioImage_Bravo_3.jpg?itok=lEyhs9SE`;
const game: SportsGame = {
  source: "official-boxing",
  league: "BOXING",
  id: "pbc:fight-night-september-19-2026",
  state: "pre",
  detail: "Scheduled",
  startMs: Date.parse("2026-09-20T00:00:00Z"),
  home: { id: "", name: "Isaac Cruz", abbr: "", logo: "", score: "", winner: false },
  away: { id: "", name: "Nestor Bravo", abbr: "", logo: "", score: "", winner: false },
  broadcasts: ["Prime Video"],
};
// Exact official PBC fight-night elements captured September 14, 2026; reversed to prove name matching.
const canonical = `<link rel="canonical" href="${origin}/fight-night-september-19-2026">`;
const fixture = `${canonical}<div class="fight-image second"><img loading="lazy" src="${bravo}" alt="Nestor Bravo fighter profile"></div><div class="fight-image first"><img loading="lazy" src="${cruz}" alt="Isaac Cruz fighter profile"></div>`;
interface DomNode {
  textContent: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): DomNode | null;
  querySelectorAll(selector: string): DomNode[];
}
function withInertDocument<T>(run: () => T): T {
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

test("PBC detail resolves exact fighter names regardless of DOM order without changing schedule metadata", () =>
  withInertDocument(() => {
    const result = parsePbcDetail(fixture, game);
    assert.equal(result.home.logo, cruz);
    assert.equal(result.away.logo, bravo);
    assert.deepEqual(result, {
      ...game,
      home: { ...game.home, logo: cruz },
      away: { ...game.away, logo: bravo },
    });
    assert.equal(game.home.logo, "");
    assert.equal(result.broadcasts, game.broadcasts);
  }));

test("source and exact canonical identity must match before enrichment", () =>
  withInertDocument(() => {
    for (const html of [
      fixture.replace("september-19", "october-17"),
      fixture.replace(canonical, ""),
      fixture + canonical,
      fixture.replace(origin, "https://unrelated.example"),
      fixture.replace('2026">', '2026?other=1">'),
      "x".repeat(1_000_001),
    ]) {
      assert.equal(parsePbcDetail(html, game), game);
    }
    for (const candidate of [
      { ...game, source: "espn" },
      { ...game, league: "UFC" },
      { ...game, id: "queensberry:pages/fight" },
    ])
      assert.equal(parsePbcDetail(fixture, candidate), candidate);
  }));

test("untrusted and ambiguous photos never replace a fighter portrait", () =>
  withInertDocument(() => {
    for (const src of [
      "#",
      "javascript:alert(1)",
      "https://unrelated.example/BioImage_Bravo.jpg",
      `${origin}/generic-trophy.jpg`,
      "https://attacker@www.premierboxingchampions.com/sites/default/files/BioImage_Bravo.jpg",
    ]) {
      const result = parsePbcDetail(fixture.replace(bravo, src), game);
      assert.equal(result.away, game.away);
      assert.equal(result.home.logo, cruz);
    }
    assert.equal(
      parsePbcDetail(fixture.replace("Nestor Bravo fighter profile", "Bravo fighter profile"), game)
        .away,
      game.away,
    );
    const conflict =
      fixture +
      `<div class="fight-image"><img src="${cruz}" alt="Nestor Bravo fighter profile"></div>`;
    assert.equal(parsePbcDetail(conflict, game).away, game.away);
  }));

test("whitespace and case normalization preserve exact full-name identity; unmatched metadata stays intact", () =>
  withInertDocument(() => {
    const result = parsePbcDetail(
      fixture.replace("Nestor Bravo fighter profile", " NESTOR   BRAVO fighter PROFILE "),
      game,
    );
    assert.equal(result.away.logo, bravo);
    assert.equal(parsePbcDetail(canonical, game), game);
    assert.equal(parsePbcDetail(fixture, result), result);
  }));

test("the official October card attributes Fundora and Hadribeaj portraits by name", () =>
  withInertDocument(() => {
    const fundora = `${origin}/sites/default/files/styles/fight_315x315/public/BioImage_Fundora_0.jpg?itok=je3Jd-qL`;
    const hadribeaj = `${origin}/sites/default/files/styles/fight_315x315/public/BioImage_Hardibeaj.jpg?itok=f_wHdyuW`;
    const october = {
      ...game,
      id: "pbc:fight-night-october-17-2026",
      home: { ...game.home, name: "Sebastian Fundora" },
      away: { ...game.away, name: "Ermal Hadribeaj" },
    };
    const html = `<link rel="canonical" href="${origin}/fight-night-october-17-2026"><div class="fight-image first"><img src="${fundora}" alt="Sebastian Fundora fighter profile"></div><div class="fight-image second"><img src="${hadribeaj}" alt="Ermal Hadribeaj fighter profile"></div><img src="#" alt="Sebastian Fundora">`;
    const result = parsePbcDetail(html, october);
    assert.equal(result.home.logo, fundora);
    assert.equal(result.away.logo, hadribeaj);
  }));
