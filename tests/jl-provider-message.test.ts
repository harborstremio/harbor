import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderMessage } from "../src/lib/jl/provider-message.ts";

test("reads an emoji access-details message with two servers and two playlists", () => {
  const msg = `🔑 Your Personal Access Details

💠 Name: Any name
💠 Username: jl_user42
💠 Password: s3cr3tPass

💠 Stream URLs:
🔗 http://xtreme.ink
🔗 http://cf.xtreme.ink (VPN Supported)

🎼 M3U Playlist (Default):
🔗 http://xtreme.ink/get.php?username=jl_user42&password=s3cr3tPass&type=m3u_plus&output=ts

🎼 M3U Playlist (VPN Supported):
🔗 http://cf.xtreme.ink/get.php?username=jl_user42&password=s3cr3tPass&type=m3u_plus&output=ts`;
  const d = parseProviderMessage(msg);
  assert.equal(d.username, "jl_user42");
  assert.equal(d.password, "s3cr3tPass");
  assert.deepEqual(
    d.logins.map((l) => (l.kind === "xtream" ? [l.server, l.note] : [l.url, l.note])),
    [
      ["http://xtreme.ink", "Default"],
      ["http://cf.xtreme.ink", "VPN Supported"],
    ],
  );
});

test("reads a device-details message with a server on a port", () => {
  const msg = `Device Details:

🔷 Device
👤 Username: GH7Q2N
🔒 Password: T9x4kLm
🌐 Link: http://limited-name.com:80
📺 M3U Link:
http://limited-name.com:80/get.php?username=GH7Q2N&password=T9x4kLm&type=m3u_plus&output=hls

If you have any questions, please let us know.`;
  const d = parseProviderMessage(msg);
  assert.equal(d.username, "GH7Q2N");
  assert.equal(d.password, "T9x4kLm");
  assert.equal(d.logins.length, 1);
  assert.deepEqual(d.logins[0], {
    kind: "xtream",
    // Port 80 is the http default, so URL parsing drops it.
    server: "http://limited-name.com",
    username: "GH7Q2N",
    password: "T9x4kLm",
    note: null,
  });
});

test("builds a login from a server link plus username and password alone", () => {
  const d = parseProviderMessage("User: abc\nPass: xyz\nServer: http://line.example.tv:8080/");
  assert.equal(d.logins.length, 1);
  const l = d.logins[0];
  assert.ok(l.kind === "xtream" && l.server === "http://line.example.tv:8080" && l.username === "abc");
});

test("keeps a plain .m3u link as an M3U playlist", () => {
  const d = parseProviderMessage("Your playlist: https://cdn.example.com/lists/home.m3u");
  assert.deepEqual(d.logins, [{ kind: "m3u", url: "https://cdn.example.com/lists/home.m3u", note: null }]);
});

test("finds nothing usable in a message without links", () => {
  const d = parseProviderMessage("Thanks for your order! Username: someone");
  assert.equal(d.logins.length, 0);
});
