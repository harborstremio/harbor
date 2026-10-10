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
    "@/lib/secret-store": { subscribeSecretsReady: () => () => {} },
    "./session": {
      getSession: () => session,
      subscribeSession: (fn: () => void) => {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      setSession: () => {},
    },
    "./device-auth": {},
    "./ids": {},
    "./list-status": { isSimklEpisodeWatched: async () => false },
    "./playback": { hasActiveSimklPlayback: async () => false },
    "./history": {},
    "./pending-sync": { armPendingFlush: () => () => {}, flushPendingWatches: async () => {} },
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

test("a disconnect before subscription cannot retain a stale connected session", () => {
  const f = fixture();
  f.change({ username: "fixture" });
  assert.equal(f.render().isConnected, true);
  f.change(null);
  f.mount();
  assert.equal(f.render().isConnected, false);
  f.unmount();
});
