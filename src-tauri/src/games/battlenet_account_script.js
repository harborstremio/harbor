// Runs only in the account origin's top frame. Never forwards tokens, account names or CD keys.
(() => {
  if (window !== window.top || location.origin !== "https://account.battle.net" || window.__harborBattleRead) return;
  window.__harborBattleRead = true;
  const request = __HARBOR_REQUEST__, fresh = __HARBOR_FRESH__, connection = __HARBOR_CONNECTION__;
  let stopped = false;
  const report = value => {
    if (stopped) return;
    stopped = true;
    location.replace(`harbor-battlenet://result/${request}?data=${encodeURIComponent(JSON.stringify(value))}`);
  };
  const read = async path => {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (response.status !== 200 && response.status !== 401) throw Error("status");
    if (!response.headers.get("content-type")?.includes("application/json")) throw Error("content");
    const reader = response.body.getReader(); let total = 0; const parts = [];
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        total += part.value.byteLength; if (total > 4 * 1024 * 1024) throw Error("limit");
        parts.push(part.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const rows = (body, key) => {
    if (!Array.isArray(body?.[key]) || body[key].length > 4096) throw Error("schema");
    return body[key];
  };
  const identity = async status => {
    const id = status.accountId;
    if (status.authenticated !== true || !(typeof id === "number" && Number.isSafeInteger(id) && id > 0 || typeof id === "string" && /^[1-9][0-9]{0,19}$/.test(id))) throw Error("identity");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${connection}:${id}`));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  };
  const attempt = async () => {
    try {
      const status = await read("/api/");
      if (status.authenticated === false) {
        if (fresh) { setTimeout(attempt, 3000); return; }
        report({ authenticated: false, modern: null, classic: null }); return;
      }
      if (status.authenticated !== true) throw Error("schema");
      const account = await identity(status);
      const [modern, classic] = await Promise.all([
        read("/api/games-and-subs").then(body => rows(body, "gameAccounts").map(item => {
          if (!Number.isSafeInteger(item.titleId) || item.titleId < 0) throw Error("schema");
          return { titleId: item.titleId };
        })).catch(() => null),
        read("/api/classic-games").then(body => rows(body, "classicGames").map(item => {
          if (typeof item.localizedGameName !== "string" || typeof item.regionalGameFranchiseIconFilename !== "string"
            || item.localizedGameName.length > 512 || item.regionalGameFranchiseIconFilename.length > 512) throw Error("schema");
          return { name: item.localizedGameName, icon: item.regionalGameFranchiseIconFilename };
        })).catch(() => null),
      ]);
      if (await identity(await read("/api/")) !== account) throw Error("changed");
      report({ authenticated: true, identity: account, modern, classic });
    } catch {
      if (fresh) setTimeout(attempt, 3000);
      else report({ error: "refresh" });
    }
  };
  void attempt();
})();
