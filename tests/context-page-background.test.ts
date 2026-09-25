import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { isPageContextBackground } from "../src/lib/context-page-background.ts";

test("page background recognizes declared layout gaps and drag regions without inheriting card space", () => {
  const dom = new JSDOM(`<main id="main"><div id="layout" data-context-page-background>
    <div id="gap" data-context-page-background></div>
    <div id="card"><div id="card-space"></div></div>
    <button><span id="button-drag" data-tauri-drag-region></span></button>
    <header id="header" data-tauri-drag-region><span id="header-text">A title</span></header>
    <div id="no-drag" data-tauri-drag-region="false"></div>
  </div></main>`);
  const el = (id: string) => dom.window.document.getElementById(id)!;
  assert.equal(isPageContextBackground(el("main")), true);
  assert.equal(isPageContextBackground(el("layout")), true);
  assert.equal(isPageContextBackground(el("gap")), true);
  assert.equal(isPageContextBackground(el("header")), true);
  for (const id of ["card", "card-space", "button-drag", "header-text", "no-drag"])
    assert.equal(isPageContextBackground(el(id)), false, id);
  dom.window.close();
});

test("page markers cannot override editor, reader, player, or modal ownership", () => {
  const dom = new JSDOM(`<main>
    <div role="dialog"><div id="dialog" data-context-page-background></div></div>
    <div contenteditable="true"><div id="editor" data-context-page-background></div></div>
    <div data-harbor-player><header id="player" data-tauri-drag-region></header></div>
    <div data-ebook-page><main id="reader"></main></div>
    <div data-context-page-exclude><div id="custom" data-context-page-background></div></div>
    <iframe id="frame" data-context-page-background></iframe>
  </main>`);
  for (const id of ["dialog", "editor", "player", "reader", "custom", "frame"])
    assert.equal(isPageContextBackground(dom.window.document.getElementById(id)), false, id);
  assert.equal(isPageContextBackground(null), false);
  dom.window.close();
});
