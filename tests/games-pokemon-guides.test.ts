import assert from "node:assert/strict";
import test from "node:test";
import { pokemonGuideLink } from "../src/lib/games/pokemon-guides.ts";
import type { GameGuide } from "../src/lib/games/guides-data.ts";

const root = "Walkthrough:Pokémon FireRed and LeafGreen";
const item: GameGuide = { id: root, title: "Pokémon FireRed and LeafGreen", source: "bulbapedia", author: "Bulbapedia", image: "", description: "", url: "" };
const url = (title: string) => `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

test("walkthrough links navigate between the same edition's chapters and overview", () => {
  const next = pokemonGuideLink(item, url(`${root}/Part 20`));
  assert.equal(next?.id, `${root}/Part 20`);
  assert.equal(next?.source, "bulbapedia");
  assert.equal(pokemonGuideLink(next!, url(root))?.id, root);
  assert.equal(pokemonGuideLink(next!, url(`${root}/Part 1`))?.id, `${root}/Part 1`);
});

test("other games, unsafe origins, article edits and anchors never replace the selected guide", () => {
  for (const href of [url("Walkthrough:Pokémon Emerald/Part 1"), url("Pallet Town"), url(`${root}/Part fake`), url(root) + "?action=edit", url(root) + "#Contents", url(`${root}/Part 2`).replace("bulbapedia.bulbagarden.net", "example.com"), "javascript:alert(1)"]) {
    assert.equal(pokemonGuideLink(item, href), null, href);
  }
  assert.equal(pokemonGuideLink({ ...item, source: "steam" }, url(root)), null);
});
