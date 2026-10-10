import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { curseForgeUrl, discoveryUrl, parseCurseForge, parseMinecraftServers, serverDirectoryUrl } from "../src/lib/games/minecraft-discovery.ts";

// Exercise the same CSS selectors in Node; browser verification covers the native DOMParser.
globalThis.DOMParser = class {
  parseFromString(html: string) {
    const $ = load(html);
    const wrap = (node: any): any => ({
      get textContent() { return $(node).text(); },
      getAttribute: (key: string) => $(node).attr(key) || null,
      querySelector: (selector: string) => { const found = $(node).find(selector).first().get(0); return found ? wrap(found) : null; },
      querySelectorAll: (selector: string) => $(node).find(selector).toArray().map(wrap),
    });
    return wrap($.root().get(0));
  }
} as any;

test("CurseForge queries preserve provider classes, search and independent filters", () => {
  const url = new URL(curseForgeUrl({ type: "resourcepack", query: "A&B", category: "16x", version: "1.21.1", loader: "4", sort: "relevance", page: -1 }));
  assert.equal(url.searchParams.get("class"), "texture-packs");
  assert.equal(url.searchParams.get("search"), "A&B");
  assert.equal(url.searchParams.get("version"), "1.21.1");
  assert.equal(url.searchParams.get("gameVersionTypeId"), "4");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("sortBy"), "relevancy");
});

test("discovery links reject credential URLs, scripts, other ports and lookalike hosts", () => {
  for (const value of ["javascript:alert(1)", "https://www.curseforge.com.evil.test/minecraft", "https://user@www.curseforge.com/", "https://www.curseforge.com:8080/", "http://www.curseforge.com/"]) assert.equal(discoveryUrl(value, "https://www.curseforge.com", ["www.curseforge.com"]), "");
});

const cfCard = `<div class="project-card"><a class="name" href="/minecraft/modpacks/example">Example pack</a><div class="art"><img src="https://media.forgecdn.net/avatars/1.png"></div><span class="author-name">Creator</span><p class="description">A real description</p><li class="detail-downloads">22.1M</li><li class="detail-updated"><span class="date-full">Oct 1, 2026</span></li><li class="detail-game-version">1.21.1</li></div>`;
test("CurseForge keeps rounded counts honest, deduplicates cards and follows page links", () => {
  const data = parseCurseForge(`<div class="results-container">${cfCard}${cfCard}</div><a href="?page=2">2</a><a href="?version=1.21.1">1.21.1</a><a href="?gameVersionTypeId=4">Fabric</a>`, "https://www.curseforge.com/minecraft/search?page=1");
  assert.equal(data.projects.length, 1); assert.equal(data.projects[0].downloads, "22.1M"); assert.equal(data.projects[0].author, "Creator"); assert.equal(data.next, true);
  assert.deepEqual(data.loaders, [{ value: "4", label: "Fabric" }]);
});
test("a challenge or changed page is an error, while a real empty catalog remains empty", () => {
  assert.throws(() => parseCurseForge("<h1>Just a moment</h1>", "https://www.curseforge.com/minecraft/search"), /source_changed/);
  assert.equal(parseCurseForge('<div class="results-container"></div>', "https://www.curseforge.com/minecraft/search").projects.length, 0);
});
const orgRow = (id: number, rank: number, extra = "") => `<div class="server-listing ${extra}"><div class="rank"><span>${rank}</span></div><div class="name"><a href="/server/${id}">Server ${id}</a></div><span data-clipboard-content="play.example.com:25565"></span><div class="players"><div class="value">123/400</div></div><div class="status"><div class="value online">online</div></div><div class="banner"><img src="https://minecraftservers.org/banners/${id}.gif"></div></div>`;
test("server ranking excludes promoted duplicates and preserves source ranks and counts", () => {
  const data = parseMinecraftServers(`<section class="server-list">${orgRow(1, 1, "highlight")}${orgRow(1, 1)}${orgRow(2, 2)}</section><a href="/index/2">next</a><a href="/type/survival">Survival</a>`, "org", "https://minecraftservers.org/");
  assert.equal(data.servers.length, 2); assert.equal(data.servers[0].rank, 1); assert.equal(data.servers[0].players, 123); assert.equal(data.servers[0].capacity, 400); assert.equal(data.servers[0].online, true);
  assert.equal(data.next, "https://minecraftservers.org/index/2"); assert.equal(data.modes[0].value, "survival");
});
test("mode pagination cannot wander into another directory filter or site", () => {
  const data = parseMinecraftServers(`<section class="server-list">${orgRow(1, 1)}</section><a href="/index/2">all</a><a href="/type/creative/2">creative</a><a href="https://evil.test/type/survival/2">bad</a><a href="/type/survival/2">next</a>`, "org", serverDirectoryUrl("org", "survival"));
  assert.equal(data.next, "https://minecraftservers.org/type/survival/2");
});
test("Minecraft-MP extracts address, status, banner and tags without autoplay video", () => {
  const html = `<table><tr><td><strong>#3</strong><img src="https://minecraft-mp.com/images/favicon/42.png"></td><td><div class="server-card"><video data-src="evil"></video><img class="card-img-fluid" src="https://minecraft-mp.com/images/banners/42.png"><button data-clipboard-text="play.example.net"></button></div><div class="server-about-m"><button class="btn-success">Online</button><button class="btn-xs-playercount">2,500 / 3,000</button></div></td><td><div class="server-title-responsive"><a href="/server-s42">Example</a></div><p class="server-description">Survival world</p><div class="list-server-tags"><span class="btn-tag">Survival</span></div><a href="/version/1_21/">1.21</a></td></tr></table><a href="/servers/list/2/">2</a>`;
  const data = parseMinecraftServers(html, "mp", "https://minecraft-mp.com/");
  assert.equal(data.servers[0].players, 2500); assert.equal(data.servers[0].rank, 3); assert.deepEqual(data.servers[0].tags, ["Survival"]); assert.match(data.servers[0].banner, /42.png$/); assert.equal(data.next, "https://minecraft-mp.com/servers/list/2/");
});
test("malformed server addresses and invalid source markup do not become actionable rows", () => {
  const html = `<section class="server-list">${orgRow(1, 1).replace("play.example.com:25565", "evil.example; start shell")}</section>`;
  assert.equal(parseMinecraftServers(html, "org", "https://minecraftservers.org/").servers.length, 0);
  assert.throws(() => parseMinecraftServers("<h1>Challenge</h1>", "mp", "https://minecraft-mp.com/"), /source_changed/);
});

test("Sims CurseForge catalogs preserve game identity, classes and pagination", () => {
  const sims4 = cfCard.replaceAll('/minecraft/modpacks/', '/sims4/mods/');
  const sims2 = cfCard.replaceAll('/minecraft/modpacks/', '/the-sims-2/mods/');
  const html = `<div class="results-container">${sims4}${sims2}${cfCard}</div><a href="?page=2">2</a><a href="?class=mods">Mods</a>`;
  const four = parseCurseForge(html, 'https://www.curseforge.com/sims4/search?page=1', 'sims4');
  const two = parseCurseForge(html, 'https://www.curseforge.com/the-sims-2/search?page=1', 'the-sims-2');
  assert.equal(four.projects.length, 1); assert.match(four.projects[0].url, /\/sims4\/mods\//);
  assert.equal(two.projects.length, 1); assert.match(two.projects[0].url, /\/the-sims-2\/mods\//);
  assert.equal(four.next, true); assert.equal(two.next, true);
  assert.deepEqual(four.classes, [{value:'mods',label:'Mods'}]);
  assert.equal(parseCurseForge(html, 'https://www.curseforge.com/minecraft/search').projects.length, 1);
});
