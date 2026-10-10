import assert from "node:assert/strict";
import test from "node:test";
import { composeProviderSource } from "../src/lib/streams/plugins/provider-compat/prelude.ts";

const SHADOW = [
  "self", "globalThis", "window", "fetch", "XMLHttpRequest", "WebSocket",
  "EventSource", "importScripts", "indexedDB", "caches", "Worker",
  "SharedWorker", "BroadcastChannel", "MessageChannel", "postMessage",
  "close", "navigator", "location", "document", "Request", "Response",
];

type Registered = {
  id: string;
  name: string;
  streams: (req: unknown) => Promise<unknown>;
  settings?: () => Promise<unknown>;
};

function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function boot(code: string, settings: Record<string, string | boolean> = {}) {
  const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
  let registered: Registered | null = null;
  const harbor = {
    http: async (url: string, opts: Record<string, unknown>) => {
      calls.push({ url, opts });
      if (url.includes("/json")) {
        return { status: 200, ok: true, headers: { "content-type": "application/json" }, body: b64(JSON.stringify({ hello: "world", n: 2 })) };
      }
      if (url.includes("/html")) {
        return {
          status: 200,
          ok: true,
          headers: { "content-type": "text/html" },
          body: b64('<html><body><div class="row"><a href="/one" data-id="1">One</a><a href="/two">Two</a></div><p id="x">Hi <b>there</b></p></body></html>'),
        };
      }
      if (url.includes("/404")) return { status: 404, ok: false, headers: {}, body: b64("nope") };
      throw new Error("connection refused");
    },
    log: () => {},
    grpc: async () => ({}),
    parseHtml: async () => ({}),
    register: (p: Registered) => {
      registered = p;
    },
  };
  const source = composeProviderSource(code, { id: "example", name: "Example", settings });
  const body = '"use strict";\n' + source + "\n;return (typeof plugin !== 'undefined') ? plugin : undefined;";
  const factory = new Function(...["harbor", ...SHADOW], body);
  factory(harbor, ...SHADOW.map(() => undefined));
  if (!registered) throw new Error("nothing registered");
  return { plugin: registered as Registered, calls };
}

test("a module.exports provider script registers and receives the provider-script call convention", async () => {
  const { plugin } = boot(`
    async function getStreams(tmdbId, mediaType, season, episode) {
      return [{ name: "P", title: tmdbId + ":" + mediaType + ":" + season + ":" + episode, url: "https://x.example/v.m3u8" }];
    }
    module.exports = { getStreams };
  `);
  assert.equal(plugin.id, "example");
  const out = (await plugin.streams({ tmdb: { id: 603 }, type: "series", season: 1, episode: 2 })) as Array<{ title: string }>;
  assert.equal(out[0].title, "603:tv:1:2");
  const movie = (await plugin.streams({ tmdb: { id: 603 }, type: "movie", season: null, episode: null })) as Array<{ title: string }>;
  assert.equal(movie[0].title, "603:movie:undefined:undefined");
});

test("global.getStreams and settings are wired, and SCRAPER_SETTINGS reach the script", async () => {
  const { plugin } = boot(
    `
    global.getStreams = function () { return [{ url: "https://x.example/" + SCRAPER_SETTINGS.domain, name: SCRAPER_ID }]; };
    globalThis.onSettings = function () { return [{ type: "select", key: "domain", label: "Domain", options: [{ label: "a", value: "a" }] }]; };
  `,
    { domain: "a.example" },
  );
  const out = (await plugin.streams({ tmdb: { id: 1 }, type: "movie" })) as Array<{ url: string; name: string }>;
  assert.equal(out[0].url, "https://x.example/a.example");
  assert.equal(out[0].name, "example");
  assert.ok(plugin.settings);
  const fields = (await plugin.settings!()) as Array<{ key: string }>;
  assert.equal(fields[0].key, "domain");
});

test("fetch and axios go through the bridge with json, errors and non-2xx handled the way scripts expect", async () => {
  const { plugin, calls } = boot(`
    async function getStreams() {
      const r = await fetch("https://api.example/json", { headers: { "X-A": "1" } });
      const j = await r.json();
      const bad = await fetch("https://api.example/404");
      const dead = await fetch("https://down.example/");
      const ax = await axios.get("https://api.example/json", { params: { q: 1 } });
      let axErr = null;
      try { await axios.get("https://api.example/404"); } catch (e) { axErr = e.response.status; }
      return [{ url: "https://x.example/" + j.hello + "/" + r.status + "/" + bad.status + "/" + dead.status + "/" + ax.data.n + "/" + axErr + "/" + ax.status }];
    }
    module.exports = { getStreams };
  `);
  const out = (await plugin.streams({ tmdb: { id: 1 }, type: "movie" })) as Array<{ url: string }>;
  assert.equal(out[0].url, "https://x.example/world/200/404/0/2/404/200");
  assert.equal(calls[0].opts.responseType, "base64");
  assert.equal((calls[0].opts.headers as Record<string, string>)["X-A"], "1");
  assert.equal(calls[3].url, "https://api.example/json?q=1");
});

test("cheerio, crypto-js and Buffer are available through require", async () => {
  const { plugin } = boot(`
    const cheerio = require("cheerio");
    const CryptoJS = require("crypto-js");
    async function getStreams() {
      const html = await (await fetch("https://site.example/html")).text();
      const $ = cheerio.load(html);
      const links = $(".row a").map((i, el) => $(el).attr("href")).get();
      const first = $(".row a").first();
      const text = $("#x").text();
      const md5 = CryptoJS.MD5("abc").toString();
      const b = Buffer.from("aGVsbG8=", "base64").toString("utf8");
      const enc = CryptoJS.AES.encrypt("secret", "pass").toString();
      const dec = CryptoJS.AES.decrypt(enc, "pass").toString(CryptoJS.enc.Utf8);
      return [{ url: "https://x.example/" + links.join(",") + "/" + first.data("id") + "/" + text.trim() + "/" + md5 + "/" + b + "/" + dec + "/" + $(".row").children().length }];
    }
    module.exports = { getStreams };
  `);
  const out = (await plugin.streams({ tmdb: { id: 1 }, type: "movie" })) as Array<{ url: string }>;
  assert.equal(
    out[0].url,
    "https://x.example//one,/two/1/Hi there/900150983cd24fb0d6963f7d28e17f72/hello/secret/2",
  );
});

test("a script without getStreams is rejected at start", () => {
  assert.throws(() => boot("module.exports = { hello: 1 };"), /not-stream-plugin/);
});
