import assert from "node:assert/strict";
import test from "node:test";
import { isLikelyGamepad, type GamepadShape } from "../src/lib/gamepad/web-source.ts";

function pad(id: string, mapping: string, buttons: number, axes: number): GamepadShape {
  return {
    id,
    mapping,
    buttons: Array.from({ length: buttons }, () => ({ pressed: false, touched: false, value: 0 })),
    axes: Array.from({ length: axes }, () => 0),
  };
}

test("admits pads Chromium reports with the standard mapping", () => {
  const xbox = pad("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)", "standard", 17, 4);
  assert.equal(isLikelyGamepad(xbox), true);
});

test("admits DirectInput pads that report no mapping but a gamepad shape", () => {
  const ds4 = pad("Wireless Controller (Vendor: 054c Product: 09cc)", "", 14, 4);
  assert.equal(isLikelyGamepad(ds4), true);

  const stick = pad("Arcade Stick (Vendor: 0f0d Product: 0088)", "", 12, 2);
  assert.equal(isLikelyGamepad(stick), true);
});

test("rejects audio devices Chromium enumerates as gamepads", () => {
  for (const id of [
    "HyperX Cloud III Wireless (Vendor: 03f0 Product: 0d93)",
    "Corsair HS80 Headset (Vendor: 1b1c Product: 0a6b)",
    "USB Audio Device (Vendor: 0d8c Product: 0014)",
    "Headphone Controls (Vendor: 1038 Product: 12ad)",
    "Unknown device (Vendor: 0951 Product: 16a4)",
  ]) {
    assert.equal(isLikelyGamepad(pad(id, "", 12, 4)), false, id);
  }
});

test("rejects HID blobs without a gamepad button and axis shape", () => {
  assert.equal(isLikelyGamepad(pad("Generic HID (Vendor: 1234 Product: 5678)", "", 2, 0)), false);
  assert.equal(isLikelyGamepad(pad("Foot Pedal (Vendor: 05f3 Product: 00ff)", "", 3, 1)), false);
});

test("the device denylist outranks the button and axis shape fallback", () => {
  assert.equal(isLikelyGamepad(pad("HyperX Cloud III Wireless", "", 16, 4)), false);
});
