import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const native = readFileSync(new URL("../src-tauri/src/mpv.rs", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const start = native.slice(
  native.indexOf("pub async fn mpv_start("),
  native.indexOf("async fn restore_display_sdr_if_flipped("),
);
const stop = native.slice(
  native.indexOf("pub async fn mpv_stop("),
  native.indexOf("pub async fn mpv_release_media("),
);
const restore = native.slice(
  native.indexOf("async fn restore_display_sdr_if_flipped("),
  native.indexOf("async fn restore_display_sdr_if_flipped(") + 2400,
);

test("Windows start and stop serialize lifecycle changes separately from property polling", () => {
  assert.match(native, /#\[cfg\(windows\)\]\s*lifecycle: Mutex<\(\)>/);
  for (const operation of [start, stop]) {
    const lifecycle = operation.indexOf("state.lifecycle.lock().await");
    const session = operation.indexOf("state.inner.lock().await");
    assert.ok(lifecycle >= 0 && lifecycle < session);
    const restoreAt = operation.search(
      /restore_display_sdr_if_flipped\(&app, was_off, (?:prev|session)_monitor\)\.await/,
    );
    assert.ok(restoreAt >= 0, "restore uses the previous session's display");
    assert.ok(operation.indexOf("drop(g)") < restoreAt);
  }
});

test("Windows startup reacquires the session only after SDR restoration", () => {
  const restoreAt = start.indexOf(
    "restore_display_sdr_if_flipped(&app, was_off, prev_monitor).await",
  );
  assert.ok(restoreAt >= 0);
  assert.ok(start.indexOf("state.inner.lock().await", restoreAt) > restoreAt);
});

test("display-mode restoration does not sleep or run DisplayConfig on the async worker", () => {
  const body = restore.slice(0, restore.indexOf("\n}\n") + 2);
  assert.match(body, /tokio::time::sleep/);
  assert.match(body, /tokio::task::spawn_blocking/);
  assert.doesNotMatch(body, /std::thread::sleep/);
});
