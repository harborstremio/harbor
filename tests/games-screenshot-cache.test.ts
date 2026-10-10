import assert from "node:assert/strict";
import test from "node:test";
import { ScreenshotCache, SCREENSHOT_MAX_BYTES, type ScreenshotStore } from "../src/lib/games/screenshot-cache.ts";
import { cacheableScreenshot, screenshotImageHeader } from "../src/lib/games/screenshot-image-data.ts";

const url = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_a.jpg";
const good = new Blob(["valid"]), signal = () => new AbortController().signal;
const validate = async (blob: Blob) => { if (await blob.text() !== "valid") throw Error("bad image"); return blob; };
function disk() { const entries = new Map<string, Blob>(), removed: string[] = []; return { entries, removed, read: async (key: string) => entries.get(key) ?? null, write: async (key: string, value: Blob) => { entries.set(key, value); }, remove: async (key: string) => { removed.push(key); entries.delete(key); } }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

test("a fresh cache instance reuses stored image bytes and keeps exact query variants separate", async () => {
  const store = disk(); let requests = 0;
  const fetch = async () => { requests++; return good; };
  await new ScreenshotCache(store, fetch, validate).load(url, signal());
  assert.equal(await (await new ScreenshotCache(store, fetch, validate).load(url, signal())).text(), "valid");
  assert.equal(requests, 1);
  await new ScreenshotCache(store, fetch, validate).load(url + "?version=2", signal());
  assert.equal(requests, 2); assert.equal(store.entries.size, 2);
});

test("corrupt persisted images are removed before one network repair and invalid downloads never persist", async () => {
  const store = disk(); store.entries.set(url, new Blob(["broken"])); let requests = 0;
  const cache = new ScreenshotCache(store, async () => { requests++; return good; }, validate);
  await cache.load(url, signal()); assert.equal(requests, 1); assert.deepEqual(store.removed, [url]); assert.equal(await store.entries.get(url)!.text(), "valid");
  await assert.rejects(new ScreenshotCache(store, async () => new Blob(["HTML error page"]), validate).load(url + "?bad", signal()));
  assert.equal(store.entries.has(url + "?bad"), false);
});

test("storage refusal cannot prevent a valid online image and size bounds apply before decoding", async () => {
  const unavailable: ScreenshotStore = { read: async () => { throw Error("blocked"); }, write: async () => { throw Error("quota"); }, remove: async () => { throw Error("blocked"); } };
  assert.equal(await (await new ScreenshotCache(unavailable, async () => good, validate).load(url, signal())).text(), "valid");
  let decoded = false;
  for (const bytes of [new Blob([]), new Blob([new Uint8Array(SCREENSHOT_MAX_BYTES + 1)])]) {
    await assert.rejects(new ScreenshotCache(disk(), async () => bytes, async blob => { decoded = true; return blob; }).load(url, signal()));
  }
  assert.equal(decoded, false);
});

test("two consumers share a transfer and cancel independently", async () => {
  const gate = deferred<Blob>(), started = deferred<void>(), first = new AbortController(), second = new AbortController(); let requests = 0, aborted = false;
  const cache = new ScreenshotCache(disk(), async (_url, signal) => { requests++; signal.addEventListener("abort", () => { aborted = true; }); started.resolve(); return gate.promise; }, validate);
  const a = cache.load(url, first.signal), b = cache.load(url, second.signal); await started.promise;
  first.abort(); await assert.rejects(a, { name: "AbortError" }); assert.equal(aborted, false);
  gate.resolve(good); assert.equal(await (await b).text(), "valid"); assert.equal(requests, 1);
});

test("only three image jobs run and abandoned queued jobs never fetch", async () => {
  const gates = Array.from({ length: 6 }, () => deferred<Blob>()), allStarted = deferred<void>(); const started: number[] = [];
  const cache = new ScreenshotCache(disk(), async (url) => { const index = Number(url); started.push(index); if (started.length === 3) allStarted.resolve(); return gates[index].promise; }, validate);
  const controllers = Array.from({ length: 6 }, () => new AbortController());
  const values = controllers.map((controller, index) => cache.load(String(index), controller.signal)); await allStarted.promise;
  assert.deepEqual(started, [0, 1, 2]); controllers[4].abort(); await assert.rejects(values[4], { name: "AbortError" });
  gates.forEach(gate => gate.resolve(good)); await Promise.all(values.filter((_, i) => i !== 4)); assert.deepEqual(started, [0, 1, 2, 3, 5]);
});

test("abandoned decode does not write a stale game image", async () => {
  const decoding = deferred<void>(), decoded = deferred<Blob>(), controller = new AbortController(), store = disk();
  const cache = new ScreenshotCache(store, async () => good, async () => { decoding.resolve(); return decoded.promise; });
  const pending = cache.load(url, controller.signal); await decoding.promise; controller.abort(); await assert.rejects(pending, { name: "AbortError" });
  decoded.resolve(good); await new Promise(resolve => setImmediate(resolve)); assert.equal(store.entries.size, 0);
});

test("an uncancellable native transfer holds its pool slot after all consumers leave", async () => {
  const gates=Array.from({length:4},()=>deferred<Blob>()),ready=deferred<void>(),started:number[]=[];
  const cache=new ScreenshotCache(disk(),async key=>{const index=Number(key);started.push(index);if(started.length===3)ready.resolve();return gates[index].promise;},validate);
  const controllers=Array.from({length:4},()=>new AbortController()),values=controllers.map((controller,index)=>cache.load(String(index),controller.signal));await ready.promise;
  const abandoned=Promise.allSettled(values.slice(0,3));controllers.slice(0,3).forEach(controller=>controller.abort());await abandoned;
  assert.deepEqual(started,[0,1,2]);gates.slice(0,3).forEach(gate=>gate.resolve(good));gates[3].resolve(good);await values[3];assert.deepEqual(started,[0,1,2,3]);
});

test("cache keys accept only public Steam raster images without credentials or nonstandard ports", () => {
  assert.equal(cacheableScreenshot(url), true);
  for (const value of [url.replace("https:", "http:"), url.replace("steamstatic.com", "steamstatic.com.evil.test"), url.replace("https://", "https://user:password@"), url.replace("steamstatic.com", "steamstatic.com:1234"), url.replace(".jpg", ".svg"), "file:///game.jpg", "data:image/png;base64,AA"]) assert.equal(cacheableScreenshot(value), false, value);
});

test("raster dimensions are bounded before decode, including all three WebP container forms", () => {
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]); png.set(new TextEncoder().encode("IHDR"),12); const pv = new DataView(png.buffer); pv.setUint32(16,1920); pv.setUint32(20,1080);
  assert.deepEqual(screenshotImageHeader(png), { width:1920,height:1080,mime:"image/png" }); pv.setUint32(16,20000); assert.equal(screenshotImageHeader(png),null);
  const jpeg = Uint8Array.from([255,216,255,224,0,4,1,2,255,192,0,8,8,4,56,7,128,0]);
  assert.deepEqual(screenshotImageHeader(jpeg), { width:1920,height:1080,mime:"image/jpeg" });
  const webp = new Uint8Array(30), text = new TextEncoder(); webp.set(text.encode("RIFF"));webp.set(text.encode("WEBPVP8X"),8);webp[24]=127;webp[25]=7;webp[27]=55;webp[28]=4;
  assert.deepEqual(screenshotImageHeader(webp),{width:1920,height:1080,mime:"image/webp"});
  webp.set(text.encode("VP8L"),12);webp[20]=47;new DataView(webp.buffer).setUint32(21,1919|(1079<<14),true);assert.equal(screenshotImageHeader(webp)?.height,1080);
  webp.set(text.encode("VP8 "),12);webp.set([157,1,42],23);new DataView(webp.buffer).setUint16(26,1920,true);new DataView(webp.buffer).setUint16(28,1080,true);assert.equal(screenshotImageHeader(webp)?.width,1920);
  for(let i=0;i<jpeg.length;i++)assert.doesNotThrow(()=>screenshotImageHeader(jpeg.subarray(0,i)));
  assert.equal(screenshotImageHeader(new TextEncoder().encode("<html>unavailable</html>")),null);
});
