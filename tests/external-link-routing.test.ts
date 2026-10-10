import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderBbcode } from "../src/lib/social/bbcode.ts";
import { handleLinkOutActivation, safeExternalUrl } from "../src/lib/social/link-out-activation.ts";

const interstitialSource = readFileSync(
  new URL("../src/components/link-out-interstitial.tsx", import.meta.url),
  "utf8",
);

test("app-managed bbcode links do not request native blank-window navigation", () => {
  for (const body of [
    "https://example.com/watch?id=42",
    "[url=https://example.com/watch?id=42]Example[/url]",
  ]) {
    const html = renderBbcode(body);
    assert.match(html, /<a href="https:\/\/example\.com\/watch\?id=42"/);
    assert.match(html, /rel="noopener noreferrer nofollow"/);
    assert.doesNotMatch(html, /target="_blank"/);
  }
});

test("bbcode link safety policy remains unchanged", () => {
  assert.doesNotMatch(renderBbcode("[url=javascript:alert(1)]unsafe[/url]"), /<a /);
  assert.doesNotMatch(renderBbcode("https://bit.ly/harbor-test"), /<a /);
});

test("external link routing accepts only HTTP(S) destinations", () => {
  assert.equal(safeExternalUrl(" https://example.com/path "), "https://example.com/path");
  assert.equal(safeExternalUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("file:///C:/Windows/System32/calc.exe"), null);
  assert.equal(safeExternalUrl("not a URL"), null);
});

test("unsafe delegated links are consumed without being opened", () => {
  let prevented = false;
  const opened: string[] = [];
  const handled = handleLinkOutActivation(
    {
      target: {
        closest: () => ({ getAttribute: () => "javascript:alert(1)" }),
      } as unknown as EventTarget,
      preventDefault: () => {
        prevented = true;
      },
    },
    (href) => opened.push(href),
  );

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.deepEqual(opened, []);
});

test("delegated primary and middle clicks prevent WebView navigation and route the exact URL", () => {
  for (const button of [0, 1]) {
    const opened: string[] = [];
    let prevented = false;
    const handled = handleLinkOutActivation(
      {
        button,
        target: {
          closest: (selector: string) => {
            assert.equal(selector, "a");
            return {
              getAttribute: (name: string) => (name === "href" ? "https://example.com/path" : null),
            };
          },
        } as unknown as EventTarget,
        preventDefault: () => {
          prevented = true;
        },
      },
      (href) => opened.push(href),
    );

    assert.equal(handled, true);
    assert.equal(prevented, true);
    assert.deepEqual(opened, ["https://example.com/path"]);
  }
});

test("delegated non-link activation keeps the default interaction", () => {
  let prevented = false;
  const opened: string[] = [];
  const handled = handleLinkOutActivation(
    {
      target: { closest: () => null } as unknown as EventTarget,
      preventDefault: () => {
        prevented = true;
      },
    },
    (href) => opened.push(href),
  );

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.deepEqual(opened, []);
});

test("delegated right-click keeps the context-menu interaction", () => {
  let prevented = false;
  const opened: string[] = [];
  const handled = handleLinkOutActivation(
    {
      button: 2,
      target: {
        closest: () => ({ getAttribute: () => "https://example.com/path" }),
      } as unknown as EventTarget,
      preventDefault: () => {
        prevented = true;
      },
    },
    (href) => opened.push(href),
  );

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.deepEqual(opened, []);
});

test("the global confirmation owns back navigation and modal focus", () => {
  assert.match(interstitialSource, /pushBackHandler\(/);
  assert.match(interstitialSource, /isBackKey\(e\)/);
  assert.match(interstitialSource, /addEventListener\("keydown", onKey, true\)/);
  assert.match(interstitialSource, /addEventListener\("harbor:local-back", onLocalBack, true\)/);
  assert.match(interstitialSource, /role="dialog"/);
  assert.match(interstitialSource, /aria-modal="true"/);
});
