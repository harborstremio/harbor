// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  AUTO_DISPLAY,
  monitorCardName,
  monitorResolution,
  sanitizeDisplaySelection,
  type MonitorInfo,
} from "../src/lib/monitors.ts";

function monitor(overrides: Partial<MonitorInfo> = {}): MonitorInfo {
  return {
    id: "MONITOR\\KGS241Q\\{guid}\\0000",
    deviceName: "\\\\.\\DISPLAY1",
    deviceId: "MONITOR\\KGS241Q\\{guid}\\0000",
    name: "KGS241Q",
    isPrimary: true,
    x: 0,
    y: 0,
    width: 2560,
    height: 1440,
    scaleFactor: 1,
    ...overrides,
  };
}

test("monitorResolution formats width and height", () => {
  assert.equal(monitorResolution(monitor({ width: 3840, height: 2160 })), "3840 × 2160");
  assert.equal(monitorResolution(monitor({ width: 2560, height: 1440 })), "2560 × 1440");
});

test("monitorCardName prefers the real model name", () => {
  assert.equal(monitorCardName(monitor({ name: "DELL U2723QE" })), "DELL U2723QE");
});

test("monitorCardName trims whitespace-only model names down to the fallback", () => {
  assert.equal(
    monitorCardName(monitor({ name: "   ", deviceName: "\\\\.\\DISPLAY2" })),
    "DISPLAY2",
  );
});

test("monitorCardName falls back to the GDI device name without the prefix", () => {
  assert.equal(monitorCardName(monitor({ name: "", deviceName: "\\\\.\\DISPLAY3" })), "DISPLAY3");
});

test("monitorCardName falls back to the id when nothing else is present", () => {
  assert.equal(
    monitorCardName(monitor({ name: "", deviceName: "", id: "fallback-id" })),
    "fallback-id",
  );
});

test("monitorCardName keeps displays distinguishable when Windows reports no name", () => {
  const first = monitorCardName(monitor({ name: "", deviceName: "\\\\.\\DISPLAY1" }));
  const second = monitorCardName(monitor({ name: "", deviceName: "\\\\.\\DISPLAY2" }));
  assert.notEqual(first, second);
});

test("sanitizeDisplaySelection defaults to auto for junk input", () => {
  assert.deepEqual(sanitizeDisplaySelection(null), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection(undefined), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection("nope"), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection(42), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection({}), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection({ mode: "auto" }), AUTO_DISPLAY);
});

test("sanitizeDisplaySelection rejects explicit entries with a missing monitor", () => {
  assert.deepEqual(sanitizeDisplaySelection({ mode: "explicit" }), AUTO_DISPLAY);
  assert.deepEqual(sanitizeDisplaySelection({ mode: "explicit", monitor: "x" }), AUTO_DISPLAY);
});

test("sanitizeDisplaySelection rejects explicit entries missing required geometry", () => {
  const base = { id: "a", deviceName: "\\\\.\\DISPLAY1", x: 0, y: 0, width: 100, height: 100 };
  for (const key of ["id", "deviceName", "x", "y", "width", "height"] as const) {
    const broken: Record<string, unknown> = { ...base };
    delete broken[key];
    assert.deepEqual(
      sanitizeDisplaySelection({ mode: "explicit", monitor: broken }),
      AUTO_DISPLAY,
      `missing ${key} should fall back to auto`,
    );
  }
});

test("sanitizeDisplaySelection keeps a valid explicit monitor and fills optional defaults", () => {
  const result = sanitizeDisplaySelection({
    mode: "explicit",
    monitor: { id: "a", deviceName: "\\\\.\\DISPLAY1", x: 10, y: -20, width: 3840, height: 2160 },
  });
  assert.deepEqual(result, {
    mode: "explicit",
    monitor: {
      id: "a",
      deviceName: "\\\\.\\DISPLAY1",
      deviceId: "",
      name: "",
      isPrimary: false,
      x: 10,
      y: -20,
      width: 3840,
      height: 2160,
      scaleFactor: 1,
    },
  });
});

test("sanitizeDisplaySelection keeps a full valid monitor intact", () => {
  const full = monitor();
  const result = sanitizeDisplaySelection({ mode: "explicit", monitor: full });
  assert.deepEqual(result, { mode: "explicit", monitor: full });
});

test("AUTO_DISPLAY is the auto mode sentinel", () => {
  assert.deepEqual(AUTO_DISPLAY, { mode: "auto" });
});
