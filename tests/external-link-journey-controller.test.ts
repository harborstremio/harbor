import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseExternalLinkDestination,
  dismissExternalLinkMenu,
  handleExternalLinkBack,
  hasExternalLinkAlternateDestination,
  openExternalLinkInBrowser,
} from "../src/lib/social/external-link-journey-controller.ts";
import { resolveExternalLinkActionLayout } from "../src/lib/social/external-link-preference.ts";
import { createLinkOutStore } from "../src/lib/social/link-out.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("only an alternate destination selection persists the preference", () => {
  const events: string[] = [];
  const actions = {
    setMenuOpen: (open: boolean) => events.push(`menu:${open}`),
    rememberPreference: (action: "browser" | "harbor") => events.push(`remember:${action}`),
    openInHarbor: () => events.push("open:harbor"),
    openInBrowser: () => events.push("open:browser"),
  };

  chooseExternalLinkDestination("harbor", "main", actions);
  assert.deepEqual(events, ["menu:false", "open:harbor"]);

  events.length = 0;
  chooseExternalLinkDestination("browser", "alternate", actions);
  assert.deepEqual(events, ["menu:false", "remember:browser", "open:browser"]);
});

test("an HTTP-only layout exposes no alternate arrow", () => {
  const httpLayout = resolveExternalLinkActionLayout("harbor", false);
  const httpsLayout = resolveExternalLinkActionLayout("harbor", true);

  assert.equal(hasExternalLinkAlternateDestination(httpLayout.alternate), false);
  assert.equal(hasExternalLinkAlternateDestination(httpsLayout.alternate), true);
});

test("Back closes an open menu before restoring arrow focus", () => {
  const events: string[] = [];
  const handled = handleExternalLinkBack(true, {
    setMenuOpen: (open) => events.push(`menu:${open}`),
    restoreMenuButtonFocus: () => events.push("focus:arrow"),
    closeJourney: () => events.push("close:journey"),
  });

  assert.equal(handled, true);
  assert.deepEqual(events, ["menu:false", "focus:arrow"]);
});

test("outside pointer dismissal closes the menu without stealing focus", () => {
  const events: string[] = [];
  dismissExternalLinkMenu("outside", {
    setMenuOpen: (open) => events.push(`menu:${open}`),
    restoreMenuButtonFocus: () => events.push("focus:arrow"),
  });

  assert.deepEqual(events, ["menu:false"]);
});

test("opener rejection leaves the current journey open and releases its latch", async () => {
  const store = createLinkOutStore();
  const journey = store.open("https://example.com");
  assert.ok(journey);
  const work = deferred<void>();
  const openingRef = { current: false };
  let openerCalls = 0;
  let opening = false;
  let error: string | null = "old error";
  let closes = 0;
  const options = {
    journey,
    href: journey.url,
    openingRef,
    isCurrentJourney: store.isCurrent,
    openUrl: () => {
      openerCalls += 1;
      return work.promise;
    },
    closeJourney: () => {
      closes += 1;
      store.close();
    },
    setOpening: (next: boolean) => {
      opening = next;
    },
    setError: (next: string | null) => {
      error = next;
    },
  };

  const first = openExternalLinkInBrowser(options);
  const duplicate = openExternalLinkInBrowser(options);
  assert.equal(openerCalls, 1);
  assert.equal(opening, true);
  assert.equal(error, null);
  work.reject(new Error("browser unavailable"));
  await Promise.all([first, duplicate]);

  assert.equal(closes, 0);
  assert.equal(store.isCurrent(journey), true);
  assert.equal(opening, false);
  assert.equal(openingRef.current, false);
  assert.equal(error, "browser unavailable");
});

test("stale opener settlement cannot mutate a newly generated journey", async () => {
  const store = createLinkOutStore();
  const firstJourney = store.open("https://example.com/first");
  assert.ok(firstJourney);
  const work = deferred<void>();
  const events: string[] = [];
  const opening = openExternalLinkInBrowser({
    journey: firstJourney,
    href: firstJourney.url,
    openingRef: { current: false },
    isCurrentJourney: store.isCurrent,
    openUrl: () => work.promise,
    closeJourney: () => events.push("close"),
    setOpening: (open) => events.push(`opening:${open}`),
    setError: (error) => events.push(`error:${error}`),
  });
  assert.deepEqual(events, ["opening:true", "error:null"]);

  store.close();
  const nextJourney = store.open("https://example.com/second");
  assert.ok(nextJourney);
  work.resolve();
  await opening;

  assert.deepEqual(events, ["opening:true", "error:null"]);
  assert.equal(store.isCurrent(nextJourney), true);
});
