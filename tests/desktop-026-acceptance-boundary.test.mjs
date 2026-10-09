import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSource } from "./desktop-026-acceptance-fixtures.mjs";

function boundary(error) {
  const effects = [];
  const { JlAccountWorkspaceBoundary } = loadSource(
    "components/jl-account-workspace-boundary.tsx",
    {
      react: { useEffect: (effect) => effects.push(effect) },
      "react/jsx-runtime": jsxRuntime,
      "@/lib/jl/account/client": { useJlWorkspaceError: () => error },
    },
  );
  return {
    Component: JlAccountWorkspaceBoundary,
    flushEffects() {
      effects.splice(0).forEach((effect) => effect());
    },
  };
}

test("026 account recovery renders without mounting private children and reveals the hidden desktop window", () => {
  const f = boundary("The saved workspace could not be restored. Existing data is preserved.");
  let privateMounts = 0,
    ready = 0;
  function PrivateProviders() {
    privateMounts++;
    return createElement("div", null, "PRIVATE ACCOUNT FIXTURE");
  }
  const html = renderToStaticMarkup(
    createElement(
      f.Component,
      {
        onReady: () => {
          ready++;
        },
      },
      createElement(PrivateProviders),
    ),
  );
  assert.equal(privateMounts, 0);
  assert.doesNotMatch(html, /PRIVATE ACCOUNT FIXTURE/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Existing data is preserved/);
  f.flushEffects();
  assert.equal(
    ready,
    1,
    "recovery state must call the Tauri-ready callback even though normal private app providers never mount",
  );
});

test("026 a valid workspace passes through private providers without taking over normal ready signaling", () => {
  const f = boundary(null);
  let privateMounts = 0,
    ready = 0;
  function PrivateProviders() {
    privateMounts++;
    return createElement("div", null, "Private fixture");
  }
  const html = renderToStaticMarkup(
    createElement(
      f.Component,
      {
        onReady: () => {
          ready++;
        },
      },
      createElement(PrivateProviders),
    ),
  );
  assert.equal(privateMounts, 1);
  assert.match(html, /Private fixture/);
  f.flushEffects();
  assert.equal(ready, 0, "normal shell remains responsible for its completed ready state");
});
