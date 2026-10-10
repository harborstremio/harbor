import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture() {
  let session: object | null = null;
  let index = 0;
  let mounted = false;
  const values: unknown[] = [];
  const effects: Array<() => void | (() => void)> = [];
  const cleanups: Array<void | (() => void)> = [];
  const subscribers = new Set<() => void>();
  const module = { exports: {} as any };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial: unknown) {
      const at = index++;
      if (!(at in values)) values[at] = typeof initial === "function" ? initial() : initial;
      return [
        values[at],
        (next: unknown) => {
          values[at] = next;
        },
      ];
    },
    useRef: (current: unknown) => ({ current }),
    useMemo: (read: () => unknown) => read(),
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      if (!mounted) effects.push(effect);
    },
  };
  const dependencies: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx: (_: unknown, props: unknown) => ({ props }) },
    "./session": {
      getSession: () => session,
      subscribeSession: (fn: () => void) => {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      setSession: () => {},
    },
    "@/lib/secret-store": { subscribeSecretsReady: () => () => {} },
    "./device-auth": {},
    "./ids": {},
    "./history": {},
    "./pending-sync": { armOnlineFlush: () => () => {}, flushPendingWatches: async () => {} },
    "./record-watched": {},
    "./scrobble": {},
  };
  const code = ts.transpileModule(readFileSync("src/lib/simkl/provider.tsx", "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (id: string) => {
      assert.ok(id in dependencies, `unexpected dependency: ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
  );
  return {
    render() {
      index = 0;
      return module.exports.SimklProvider({ children: null }).props.value;
    },
    change(next: object | null) {
      session = next;
      for (const fn of subscribers) fn();
    },
    mount() {
      for (const effect of effects) cleanups.push(effect());
      mounted = true;
    },
    unmount() {
      for (const cleanup of cleanups) cleanup?.();
    },
    subscribers,
  };
}

test("Simkl provider catches a session restored between render and subscription", () => {
  const f = fixture();
  assert.equal(f.render().isConnected, false);
  f.change({ username: "fixture" });
  f.mount();
  assert.equal(f.render().isConnected, true);
  assert.equal(f.render().username, "fixture");
  f.change(null);
  assert.equal(f.render().isConnected, false);
  f.unmount();
  assert.equal(f.subscribers.size, 0);
});

test("a session read before secrets.json loads is re-read once the store is ready", () => {
  let secret: string | null = null;
  let ready: (() => void) | null = null;
  const module = { exports: {} as any };
  const deps: Record<string, unknown> = {
    "@/lib/active-profile-id": { activeProfileId: () => "p", activeProfileIsPrimary: () => true },
    "@/lib/secret-store": {
      getSecret: (k: string) => (k === "harbor.simkl.session.v1.p" ? secret : null),
      setSecret: () => {},
      subscribeSecretsReady: (fn: () => void) => {
        ready = fn;
        return () => {};
      },
    },
    "./pending-sync": { clearPendingWatches: () => {} },
  };
  const code = ts.transpileModule(readFileSync("src/lib/simkl/session.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", "window", code)(
    (id: string) => deps[id],
    module,
    module.exports,
    {},
  );
  assert.equal(module.exports.getSession(), null);
  secret = JSON.stringify({ accessToken: "t", username: "u" });
  let notified = 0;
  module.exports.subscribeSession(() => notified++);
  ready!();
  assert.equal(module.exports.getSession()?.username, "u");
  assert.equal(notified, 1);
});

test("a disconnect before subscription cannot retain a stale connected session", () => {
  const f = fixture();
  f.change({ username: "fixture" });
  assert.equal(f.render().isConnected, true);
  f.change(null);
  f.mount();
  assert.equal(f.render().isConnected, false);
  f.unmount();
});
