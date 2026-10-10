import assert from "node:assert/strict";
import test from "node:test";
import { createPokemonSource, pokemonWikiUrl, POKEMON_API, POKEMON_WIKI, POKEMON_ARCHIVE } from "../src/lib/games/pokemon-source.ts";

const signal = () => new AbortController().signal;
const article = { parse: { title: "Walkthrough:Pokémon Crystal", text: { "*": "<p>New Bark Town</p>" } } };
const wikiUrl = `${POKEMON_WIKI}/w/api.php?action=parse&page=Walkthrough%3APok%C3%A9mon_Crystal`;

test("wiki URLs preserve the CORS origin and Pokémon title without a bare wildcard", () => {
  const title = "Walkthrough:Pokémon FireRed and LeafGreen/Part 1";
  for (const host of [POKEMON_WIKI, POKEMON_ARCHIVE]) {
    const url = pokemonWikiUrl(host, { action: "parse", page: title, prop: "text|links" });
    assert.equal(url.includes("*"), false);
    assert.ok(url.endsWith("origin=%2A"));
    assert.equal(new URL(url).searchParams.get("origin"), "*");
    assert.equal(new URL(url).searchParams.get("page"), title);
  }
});

test("walkthroughs use bounded background transport and share successful requests", async () => {
  let calls = 0;
  const source = createPokemonSource(async (url, init, timeout, maxBytes) => {
    calls++;
    assert.equal(url, wikiUrl);
    assert.equal(init?.credentials, "omit");
    assert.equal(new Headers(init.headers).get("Accept"), "application/json");
    assert.equal(timeout, 15_000);
    assert.equal(maxBytes, 3_000_000);
    return Response.json(article);
  });
  assert.deepEqual(await Promise.all([source(wikiUrl, signal()), source(wikiUrl, signal())]), [article, article]);
  assert.deepEqual(await source(wikiUrl, signal()), article);
  assert.equal(calls, 1);
});

test("Pokédex and map requests retain the native byte cap and shorter deadline", async () => {
  const calls: string[] = [];
  const source = createPokemonSource(async (url, _init, timeout, max) => {
    calls.push(url);
    assert.equal(timeout, 15_000);
    assert.equal(max, 3_000_000);
    return Response.json({ name: "crystal" });
  });
  await source(`${POKEMON_API}/version/crystal/`, signal());
  await source(`${POKEMON_ARCHIVE}/w/api.php?action=query`, signal());
  assert.equal(calls.length, 2);
});

test("Retry does not replay cached MediaWiki errors or challenge HTML", async () => {
  const failures = [Response.json({ error: { code: "missingtitle" } }), Response.json({ parse: {} }), new Response("<title>Just a moment...</title>")];
  for (const failure of failures) {
    let calls = 0;
    const source = createPokemonSource(async () => ++calls === 1 ? failure : Response.json(article));
    await assert.rejects(source(wikiUrl, signal()));
    assert.deepEqual(await source(wikiUrl, signal()), article);
    assert.equal(calls, 2);
  }
});

test("a rate-limited walkthrough does not disable the Pokédex", async () => {
  let now = 100, calls = 0;
  const source = createPokemonSource(async url => {
    if (url.startsWith(POKEMON_API)) return Response.json({ name: "crystal" });
    calls++;
    return calls === 1 ? new Response("", { status: 429 }) : Response.json(article);
  }, () => now);
  await assert.rejects(source(wikiUrl, signal()), /429/);
  await assert.rejects(source(wikiUrl, signal()), /cooling down/);
  assert.deepEqual(await source(`${POKEMON_API}/version/crystal/`, signal()), { name: "crystal" });
  now += 60_001;
  assert.deepEqual(await source(wikiUrl, signal()), article);
});

test("walkthrough response limits apply to both declared and streamed UTF-8 bytes", async () => {
  for (const response of [new Response("{}", { headers: { "content-length": "3000001" } }), new Response(JSON.stringify({ text: "é".repeat(1_500_000) }))]) {
    const source = createPokemonSource(async () => response);
    await assert.rejects(source(wikiUrl, signal()), /too large/);
  }
});

test("leaving the page cancels a stalled reader and permits a fresh visit", async () => {
  let calls = 0, cancelled = false;
  const source = createPokemonSource(async () => ++calls === 1
    ? new Response(new ReadableStream({ cancel() { cancelled = true; } }))
    : Response.json(article));
  const controller = new AbortController();
  const pending = source(wikiUrl, controller.signal);
  await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cancelled, true);
  assert.deepEqual(await source(wikiUrl, signal()), article);
});

test("unrelated origins and credential-bearing URLs never reach a transport", async () => {
  const source = createPokemonSource(async () => { throw Error("unexpected bytes"); });
  for (const url of ["https://example.com/w/api.php", "http://bulbapedia.bulbagarden.net/w/api.php", "https://name:secret@bulbapedia.bulbagarden.net/w/api.php"]) {
    await assert.rejects(source(url, signal()), /Invalid Pokémon source/);
  }
});

test("a source challenge stays an inline failure without a second transport attempt", async () => {
  let calls = 0;
  const source = createPokemonSource(async () => { calls++; return new Response("<title>Just a moment</title>", { status: 403 }); });
  await assert.rejects(source(wikiUrl, signal()), /403/);
  assert.equal(calls, 1);
});

test("a transient wiki edge challenge gets only one bounded retry", async () => {
  for (const persistent of [false, true]) {
    let calls = 0;
    const source = createPokemonSource(async (_url, _init, timeout, bytes) => {
      assert.equal(timeout, 15_000);
      assert.equal(bytes, 3_000_000);
      return ++calls === 1 || persistent ? new Response("Challenge", { status: 403, headers: { "cf-mitigated": "challenge" } }) : Response.json(article);
    });
    if (persistent) await assert.rejects(source(wikiUrl, signal()), /403/);
    else assert.deepEqual(await source(wikiUrl, signal()), article);
    assert.equal(calls, 2);
  }
});

test("leaving during the edge retry cancels the second request", async () => {
  let calls = 0;
  const source = createPokemonSource(async () => { calls++; return new Response("Challenge", { status: 403, headers: { "cf-mitigated": "challenge" } }); });
  const controller = new AbortController(), pending = source(wikiUrl, controller.signal);
  await new Promise(resolve => setTimeout(resolve, 20));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await new Promise(resolve => setTimeout(resolve, 800));
  assert.equal(calls, 1);
});
