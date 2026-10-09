import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function loadSource(source, imports = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => {
      if (!(id in imports)) throw new Error(`Unexpected import: ${id}`);
      return imports[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}

const read = (file, baseline) =>
  baseline
    ? execFileSync("git", ["show", `23bf0873:${file}`], { encoding: "utf8" })
    : readFileSync(file, "utf8");

export function apiFixture({ baseline = false, fetch, refresh = async () => false } = {}) {
  let account = "fixture-account";
  let token = "fixture-token";
  const requests = [];
  const imports = {
    "@/lib/safe-fetch": {
      safeFetch: async (url, init) => {
        requests.push({ url, init });
        return fetch ? fetch(url, init) : Response.json({ alias: "Original" });
      },
    },
    "@/lib/theme-auth": {
      authToken: () => token,
      currentAuthor: () => (account ? { id: account } : null),
      captureSessionScope: () => {
        const original = account;
        return () => original === account;
      },
      refreshToken: () =>
        refresh({
          setAccount: (value) => {
            account = value;
          },
          setToken: (value) => {
            token = value;
          },
        }),
    },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://example.invalid" },
  };
  imports["./authenticated-fetch"] = loadSource(
    read("src/lib/account/authenticated-fetch.ts", false),
    imports,
  );
  const api = loadSource(read("src/lib/account/name-sync.ts", baseline), imports);
  return {
    api,
    requests,
    setAccount: (value) => {
      account = value;
    },
    setToken: (value) => {
      token = value;
    },
  };
}

export function componentFixture({ baseline = false, load, save } = {}) {
  let name = "Original";
  let profile = { id: "fixture-profile", name, kid: false };
  let author = { id: "fixture-account", handle: "fixture" };
  let authorListener;
  let dirty = true;
  let cursor = 0;
  let pending = [];
  const slots = [];
  const effects = new Map();
  const writes = [];
  const phases = [];
  let retry;
  const setDisplayName = (value) => {
    name = value;
    dirty = true;
  };
  const updateProfile = (_id, patch) => {
    profile = { ...profile, ...patch };
    dirty = true;
  };
  const session = loadSource(readFileSync("src/lib/account/name-sync-session.ts", "utf8"));
  const imports = {
    react: {
      useRef(value) {
        const i = cursor++;
        return slots[i] ?? (slots[i] = { current: value });
      },
      useState(value) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
        return [
          slots[i],
          (next) => {
            slots[i] = typeof next === "function" ? next(slots[i]) : next;
            dirty = true;
          },
        ];
      },
      useEffect(fn, deps) {
        const i = cursor++;
        const previous = effects.get(i);
        if (
          previous &&
          deps.length === previous.deps.length &&
          deps.every((v, n) => Object.is(v, previous.deps[n]))
        )
          return;
        pending.push(() => {
          previous?.cleanup?.();
          effects.set(i, { deps, cleanup: fn() });
        });
      },
    },
    "@/lib/account/name-sync": {
      nameEquals: (a, b) => (a ?? "").trim() === (b ?? "").trim(),
      isPlaceholderName: (value) => !value || /^Guest \d+$/.test(value),
      fetchProfileAlias: () => (load ? load() : Promise.resolve("Original")),
      pushNameToProfileAlias: async (value) => {
        writes.push(value);
        if (save) await save(value);
      },
    },
    "@/lib/account/name-sync-session": session,
    "@/lib/account/name-sync-state": {
      bindNameSyncState: (_id, fn) => {
        retry = fn;
        return {
          publish: (phase) => phases.push(phase),
          dispose() {
            retry = null;
          },
        };
      },
    },
    "@/lib/profiles": { useProfiles: () => ({ activeProfile: profile, updateProfile }) },
    "@/lib/theme-auth": {
      currentAuthor: () => author,
      subscribeAuthor: (fn) => {
        authorListener = fn;
        return () => {};
      },
    },
    "@/lib/together/provider": { useTogether: () => ({ displayName: name, setDisplayName }) },
  };
  const component = loadSource(read("src/components/harbor-name-sync.tsx", baseline), imports);
  function render() {
    let passes = 0;
    while (dirty) {
      if (++passes > 50) throw new Error("Render loop");
      dirty = false;
      cursor = 0;
      pending = [];
      component.HarborNameSync();
      for (const effect of pending) effect();
    }
  }
  render();
  return {
    writes,
    phases,
    name: () => name,
    edit(value) {
      name = value;
      profile = { ...profile, name: value };
      dirty = true;
      render();
    },
    updateAvatar() {
      profile = { ...profile, avatar: "fixture" };
      dirty = true;
      render();
    },
    account(value) {
      author = value;
      authorListener?.();
      render();
    },
    retry() {
      retry?.();
    },
    dispose() {
      for (const effect of effects.values()) effect.cleanup?.();
    },
    async flush() {
      for (let i = 0; i < 40; i++) {
        await Promise.resolve();
        render();
      }
    },
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function benchmark(baseline) {
  const result = {
    runs: 20,
    editDuringLoadSaved: 0,
    finalRapidNameCorrect: 0,
    peakConcurrentWrites: 0,
    failedSavesDetected: 0,
  };
  for (let i = 0; i < result.runs; i++) {
    const pending = deferred();
    const h = componentFixture({ baseline, load: () => pending.promise });
    h.edit("Edited");
    pending.resolve("Original");
    await h.flush();
    if (h.writes.at(-1) === "Edited" && h.name() === "Edited") result.editDuringLoadSaved++;
    h.dispose();

    let server = "Original",
      concurrent = 0;
    const first = deferred();
    const rapid = componentFixture({
      baseline,
      save: async (value) => {
        concurrent++;
        result.peakConcurrentWrites = Math.max(result.peakConcurrentWrites, concurrent);
        if (value === "First") await first.promise;
        server = value;
        concurrent--;
      },
    });
    await rapid.flush();
    rapid.edit("First");
    await rapid.flush();
    rapid.edit("Latest");
    await rapid.flush();
    first.resolve();
    await rapid.flush();
    if (server === "Latest") result.finalRapidNameCorrect++;
    rapid.dispose();

    const api = apiFixture({ baseline, fetch: async () => new Response(null, { status: 500 }) });
    try {
      await api.api.pushNameToProfileAlias("Edited", "fixture-account");
    } catch {
      result.failedSavesDetected++;
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(
    JSON.stringify(
      {
        method:
          "Deterministic mocked network reliability benchmark; no real account or playback changes. Baseline 23bf0873.",
        before: await benchmark(true),
        after: await benchmark(false),
      },
      null,
      2,
    ),
  );
}
