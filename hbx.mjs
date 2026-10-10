import fs from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((x) => x.type === "page" && !x.url.startsWith("devtools://"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(String(e.data)); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (m, p = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cmd = process.argv[2], rest = process.argv.slice(3);
if (cmd === "eval") {
  const r = await send("Runtime.evaluate", { expression: rest.join(" "), awaitPromise: true, returnByValue: true });
  const ex = r.result?.exceptionDetails;
  console.log(ex ? "ERR " + (ex.exception?.description ?? JSON.stringify(ex)) : JSON.stringify(r.result?.result?.value, null, 1));
} else if (cmd === "reload") {
  await send("Page.enable"); await send("Page.reload", { ignoreCache: true }); await sleep(Number(rest[0] || 6000)); console.log("reloaded");
} else if (cmd === "shot") {
  await send("Page.enable");
  const r = await send("Page.captureScreenshot", { format: "png" });
  const d = r.result?.data;
  if (!d) { console.log("no data: " + JSON.stringify(r).slice(0, 200)); } else { fs.writeFileSync(rest[0], Buffer.from(d, "base64")); console.log("wrote " + rest[0]); }
} else if (cmd === "click") {
  const [x, y] = [Number(rest[0]), Number(rest[1])];
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
  await sleep(150);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
  console.log("click " + x + "," + y);
} else if (cmd === "type") {
  for (const ch of rest.join(" ")) await send("Input.dispatchKeyEvent", { type: "char", text: ch });
  console.log("typed");
} else if (cmd === "key") {
  const K = { Enter: ["Enter","Enter",13], Escape: ["Escape","Escape",27], Space: [" ","Space",32] };
  const [k, c, v] = K[rest[0]];
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: c, windowsVirtualKeyCode: v, nativeVirtualKeyCode: v });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: c, windowsVirtualKeyCode: v, nativeVirtualKeyCode: v });
  console.log("key " + rest[0]);
}
ws.close();
