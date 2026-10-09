import fs from "node:fs";
import path from "node:path";
import { settingsSearchEntries } from "./settings-search-entries.mjs";

const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const slug = (t) =>
  "set-" +
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
const unesc = (s) => s.replace(/\\(.)/g, "$1");
const LEGACY = {
  trakt: "trackers",
  anilist: "trackers",
  mal: "trackers",
  simkl: "trackers",
  letterboxd: "trackers",
};

export function createSettingsAnchorAudit(ROOT) {
  const SRC = path.normalize(path.join(ROOT, "src"));
  const SETTINGS = path.join(SRC, "views", "settings");
  const ACCOUNT = path.join(SRC, "views", "account");
  const PRIMITIVES = new Set(
    ["shared.tsx", "kit.tsx", "ui.tsx"].map((n) => path.join(SETTINGS, n)),
  );
  const CHROME = new Set(
    [
      "nav.tsx",
      "settings-sidebar.tsx",
      "jump-bar.tsx",
      "section-cards.tsx",
      "group-landing.tsx",
      "tab-registry.ts",
      "search-match.ts",
    ].map((n) => path.join(SETTINGS, n)),
  );
  const files = new Map();
  const read = (f) => {
    if (!files.has(f)) files.set(f, fs.readFileSync(f, "utf8"));
    return files.get(f);
  };
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
  const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

  function resolveSpec(from, spec) {
    let base;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const c of [
      base,
      base + ".tsx",
      base + ".ts",
      path.join(base, "index.tsx"),
      path.join(base, "index.ts"),
    ]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.normalize(c);
    }
    return null;
  }

  const reexports = new Map();
  function reexportsOf(file) {
    if (reexports.has(file)) return reexports.get(file);
    const map = new Map();
    for (const m of read(file).matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from\s+"([^"]+)"/g)) {
      if (m[1]) continue;
      const target = resolveSpec(file, m[3]);
      if (!target) continue;
      for (const part of m[2].split(",")) {
        const p = part.trim();
        if (!p || p.startsWith("type ")) continue;
        const as = p.match(/^(\w+)\s+as\s+(\w+)$/);
        map.set(as ? as[2] : p, { target, orig: as ? as[1] : p });
      }
    }
    reexports.set(file, map);
    return map;
  }

  const edgesCache = new Map();
  function importEdges(file) {
    if (edgesCache.has(file)) return edgesCache.get(file);
    const src = read(file);
    const out = [];
    const push = (target, names, at, len, depth) => {
      const re = reexportsOf(target);
      const direct = [];
      for (const n of names) {
        const hop = re.get(n);
        if (hop && depth < 6) push(hop.target, [n], at, len, depth + 1);
        else direct.push(n);
      }
      if (direct.length) out.push({ target, names: direct, at, len });
    };
    for (const m of src.matchAll(
      /import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+"([^"]+)"/g,
    )) {
      if (m[1]) continue;
      const names = m[2] ? [m[2]] : [];
      if (m[3]) {
        for (const part of m[3].split(",")) {
          const p = part.trim();
          if (!p || p.startsWith("type ")) continue;
          const as = p.match(/^(\w+)\s+as\s+(\w+)$/);
          names.push(as ? as[2] : p);
        }
      }
      const target = resolveSpec(file, m[4]);
      if (target) push(target, names, m.index, m[0].length, 0);
    }
    for (const m of src.matchAll(/import\(\s*"([^"]+)"\s*\)/g)) {
      const target = resolveSpec(file, m[1]);
      if (target) out.push({ target, names: ["*"], at: m.index, len: m[0].length });
    }
    edgesCache.set(file, out);
    return out;
  }

  function rendered(file, edge) {
    if (edge.names.includes("*")) return true;
    const src = read(file);
    const body = src.slice(0, edge.at) + src.slice(edge.at + edge.len);
    return edge.names.some((n) => /^[A-Z]/.test(n) && new RegExp("<" + n + "\\b").test(body));
  }

  function follow(from, edge) {
    const f = edge.target;
    if (CHROME.has(f) || PRIMITIVES.has(f) || !/\.(tsx?|jsx?)$/.test(f)) return false;
    const inScope = f.startsWith(SETTINGS) || f.startsWith(ACCOUNT);
    if (f.endsWith(".ts")) return inScope;
    if (!inScope && !/<(Section|SettingGroup)\b|settingsAnchor\(/.test(read(f))) return false;
    return rendered(from, edge);
  }

  function reach(entry) {
    const parents = new Map([[entry, null]]);
    const stack = [entry];
    while (stack.length) {
      const f = stack.pop();
      for (const e of importEdges(f)) {
        if (parents.has(e.target) || !follow(f, e)) continue;
        parents.set(e.target, f);
        stack.push(e.target);
      }
    }
    return parents;
  }

  const tokens = new Map();
  function tokensIn(file) {
    if (tokens.has(file)) return tokens.get(file);
    const src = read(file);
    const names = { Section: "Section", SettingGroup: "SettingGroup" };
    for (const m of src.matchAll(/\b(Section|SettingGroup)\s+as\s+(\w+)/g)) names[m[2]] = m[1];
    const out = [];
    for (const m of src.matchAll(
      new RegExp("<(/?)(" + Object.keys(names).join("|") + ")\\b", "g"),
    )) {
      const kind = names[m[2]];
      if (m[1] === "/") {
        out.push({ close: true, kind, idx: m.index });
        continue;
      }
      const win = src.slice(m.index, m.index + 1200);
      const end = win.search(/(?<!=)>/);
      const head = end >= 0 ? win.slice(0, end) : win;
      const attr = kind === "Section" ? "title" : "label";
      let t = head.match(new RegExp("(?<![A-Za-z])" + attr + "=\\{t\\(\\s*" + STR));
      if (!t) t = head.match(new RegExp("(?<![A-Za-z])" + attr + "=" + STR));
      const d = t ? null : head.match(new RegExp("(?<![A-Za-z])" + attr + "=\\{([^}]*)\\}"));
      const title = t ? unesc(t[1]) : d ? d[1].trim() : null;
      out.push({ open: true, kind, title, dyn: !t, idx: m.index, selfClose: /\/\s*$/.test(head) });
    }
    const id = (title, dyn, idx) =>
      out.push({ open: true, kind: "id", title, dyn, idx, selfClose: true });
    for (const m of src.matchAll(new RegExp("id=\\{settingsAnchor\\(\\s*(?:t\\(\\s*)?" + STR, "g")))
      id(unesc(m[1]), false, m.index);
    for (const m of src.matchAll(/id=\{settingsAnchor\(\s*`([^`]*)`/g)) id(m[1], true, m.index);
    for (const m of src.matchAll(/id=\{settingsAnchor\(\s*([a-zA-Z_][\w.]*)\s*\)/g))
      id(m[1], true, m.index);
    out.sort((a, b) => a.idx - b.idx);
    tokens.set(file, out);
    return out;
  }

  function chainAt(file, idx) {
    const stack = [];
    for (const tok of tokensIn(file)) {
      if (tok.idx >= idx) break;
      if (tok.kind === "id") continue;
      if (tok.close) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].kind === tok.kind) {
            stack.splice(i, 1);
            break;
          }
        }
        continue;
      }
      if (!tok.selfClose && tok.title != null) stack.push(tok);
    }
    return stack;
  }

  let libFiles = null;
  function unionType(name) {
    if (!libFiles) {
      libFiles = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.tsx?$/.test(e.name)) libFiles.push(p);
        }
      };
      walk(path.join(SRC, "lib"));
      walk(SETTINGS);
    }
    for (const f of libFiles) {
      const m = read(f).match(new RegExp("export type " + name + " =([^;]+);"));
      if (m) return [...m[1].matchAll(new RegExp(STR, "g"))].map((x) => unesc(x[1]));
    }
    return [];
  }

  function dynamicTitles(file, tok, fileList) {
    const expr = tok.title.replace(/^t\((.*)\)$/, "$1").trim();
    const src = read(file);
    const found = [];
    if (/^[A-Z][A-Z0-9_]+(\.\w+)?$/.test(expr)) {
      const [name, prop] = expr.split(".");
      for (const f of fileList) {
        const s = read(f);
        if (prop) {
          const m = s.match(
            new RegExp("\\b" + name + "\\b[^;]*?\\b" + prop + ":\\s*(?:t\\(\\s*)?" + STR, "s"),
          );
          if (m) found.push(unesc(m[1]));
        } else
          for (const m of s.matchAll(
            new RegExp("\\b" + name + "\\s*=\\s*(?:t\\(\\s*)?" + STR, "g"),
          ))
            found.push(unesc(m[1]));
      }
      return found;
    }
    if (/^\w+$/.test(expr)) {
      const typed = src.match(new RegExp("as (\\w+)\\[\\]\\)\\.map\\(\\(" + expr + "\\)"));
      if (typed) return unionType(typed[1]);
    }
    const last = expr.split(".").pop();
    if (!/^(title|heading|label)$/.test(last)) return found;
    if (last === expr) {
      const comp = [...src.slice(0, tok.idx).matchAll(/(?:export )?function (\w+)\(/g)].pop();
      if (comp) {
        for (const f of fileList) {
          const s = read(f);
          for (const m of s.matchAll(
            new RegExp(
              "<" + comp[1] + "\\b[^>]*?(?<![A-Za-z])" + expr + "=\\{t\\(\\s*" + STR,
              "gs",
            ),
          ))
            found.push(unesc(m[1]));
          for (const m of s.matchAll(
            new RegExp("<" + comp[1] + "\\b[^>]*?(?<![A-Za-z])" + expr + "=" + STR, "gs"),
          ))
            found.push(unesc(m[1]));
        }
        if (found.length) return found;
      }
    }
    for (const f of fileList) {
      for (const m of read(f).matchAll(
        new RegExp("(?<![A-Za-z])" + last + ":\\s*(?:t\\(\\s*)?" + STR, "g"),
      ))
        found.push(unesc(m[1]));
    }
    return found;
  }

  const registry = read(path.join(SETTINGS, "tab-registry.ts"));
  const tabsOf = {};
  for (const m of registry.matchAll(/^  (\w+): \[([\s\S]*?)^  \],/gm))
    tabsOf[m[1]] = [...m[2].matchAll(/\{ id: "([\w-]+)"/g)].map((x) => x[1]);

  const shell = read(path.join(SRC, "views", "settings.tsx"));
  const sections = {};
  for (const m of shell.matchAll(/^\s*(\w+): \(\) => import\("\.\/settings\/([^"]+)"\)/gm)) {
    const root = resolveSpec(path.join(SRC, "views", "settings.tsx"), "./settings/" + m[2]);
    if (!root) continue;
    const parents = reach(root);
    const list = [...parents.keys()].filter((f) => f.startsWith(SRC) && !PRIMITIVES.has(f));
    const anchors = new Map();
    const add = (title, file, idx) => {
      const s = slug(title);
      if (!anchors.has(s)) anchors.set(s, []);
      anchors.get(s).push({ title, file, idx });
    };
    for (const f of list) {
      for (const tok of tokensIn(f)) {
        if (!tok.open || tok.title == null) continue;
        if (!tok.dyn) add(tok.title, f, tok.idx);
        else for (const r of dynamicTitles(f, tok, list)) add(r, f, tok.idx);
      }
    }
    sections[m[1]] = { root, parents, files: list, anchors, tabs: tabsOf[m[1]] ?? [] };
  }

  const regionCache = new Map();
  function regions(sec) {
    const info = sections[sec];
    if (regionCache.has(sec)) return regionCache.get(sec);
    const src = read(info.root);
    const marks = [...src.matchAll(/\b(?:tab|active) === "([\w-]+)"\s*(&&|\?)\s*[(<]/g)].map(
      (m) => ({ id: m[1], start: m.index, tern: m[2] === "?" }),
    );
    const out = [];
    marks.forEach((mk, i) => {
      const fnEnd = src.slice(mk.start).search(/\r?\n\}/);
      const stop = fnEnd >= 0 ? mk.start + fnEnd : src.length;
      const end = Math.min(stop, i + 1 < marks.length ? marks[i + 1].start : src.length);
      if (mk.tern) {
        const split = src.indexOf(") : (", mk.start);
        const other = info.tabs.find((t) => t !== mk.id);
        if (split > 0 && split < end && info.tabs.length === 2) {
          out.push({ id: mk.id, start: mk.start, end: split });
          out.push({ id: other, start: split, end });
          return;
        }
      }
      out.push({ id: mk.id, start: mk.start, end });
    });
    regionCache.set(sec, out);
    return out;
  }

  function tvTab(title) {
    const index = read(path.join(SETTINGS, "tv-panel", "index.tsx"));
    const model = read(path.join(SETTINGS, "tv-panel", "model.ts"));
    const claimed = index.match(/const CLAIMED[^{]*\{([\s\S]*?)\n\};/);
    if (!claimed) return null;
    const groups = [...model.matchAll(/id: "([\w-]+)",\s*title: "([^"]+)"/g)];
    const group = groups.find((g) => g[2] === title);
    if (!group) return null;
    for (const m of claimed[1].matchAll(/(\w+): \[([^\]]*)\]/g))
      if (m[2].includes('"' + group[1] + '"')) return m[1];
    return "watching";
  }

  function tabOf(sec, file, idx) {
    const info = sections[sec];
    if (!info || !info.tabs.length || !file) return null;
    const at = (pos) => {
      let hit = null;
      for (const r of regions(sec)) if (pos >= r.start && pos < r.end) hit = r;
      return hit ? hit.id : null;
    };
    const src = read(info.root);
    const viaUsages = (names) => {
      const found = new Set();
      for (const n of names)
        for (const m of src.matchAll(new RegExp("<" + n + "\\b", "g"))) found.add(at(m.index));
      found.delete(null);
      return found.size === 1 ? [...found][0] : null;
    };
    if (file === info.root) {
      const direct = at(idx);
      if (direct) return direct;
      const owner = [...src.slice(0, idx).matchAll(/(?:export )?function (\w+)\(/g)].pop();
      return owner ? viaUsages([owner[1]]) : null;
    }
    let f = file;
    while (f && info.parents.get(f) !== info.root) f = info.parents.get(f);
    if (!f) return null;
    return viaUsages(
      importEdges(info.root)
        .filter((e) => e.target === f)
        .flatMap((e) => e.names),
    );
  }

  const usageCache = new Map();
  function usages(file, sec) {
    const key = sec + "|" + file;
    if (usageCache.has(key)) return usageCache.get(key);
    const comps = [...read(file).matchAll(/export function (\w+)\(/g)].map((m) => m[1]);
    const out = [];
    for (const comp of comps) {
      for (const f of sections[sec].files) {
        if (f === file) continue;
        const s = read(f);
        for (const m of s.matchAll(new RegExp("<" + comp + "\\b", "g")))
          out.push({ comp, file: f, idx: m.index, chain: chainAt(f, m.index) });
      }
    }
    usageCache.set(key, out);
    return out;
  }

  const labelCache = new Map();
  function labelHits(label) {
    if (labelCache.has(label)) return labelCache.get(label);
    const needle = '"' + label.replace(/"/g, '\\"') + '"';
    const hits = [];
    for (const [sec, info] of Object.entries(sections)) {
      for (const f of info.files) {
        const src = read(f);
        let idx = src.indexOf(needle);
        while (idx >= 0) {
          let chain = chainAt(f, idx);
          let via = null;
          if (!chain.length) {
            const owner = [...src.slice(0, idx).matchAll(/(?:export )?function (\w+)\(/g)].pop();
            const u = usages(f, sec).find((x) => x.chain.length && (!owner || x.comp === owner[1]));
            if (u) {
              chain = u.chain;
              via = u;
            }
          }
          hits.push({ sec, file: f, idx, chain, via });
          idx = src.indexOf(needle, idx + 1);
        }
      }
    }
    labelCache.set(label, hits);
    return hits;
  }

  const nav = read(path.join(SETTINGS, "nav.tsx"));
  const entries = settingsSearchEntries(nav).map((e, i) => ({
    ...e,
    index: i,
    line: lineOf(nav, e.range[0]),
  }));

  function derive(section, anchor, label) {
    const sec = LEGACY[section] ?? section;
    const info = sections[sec];
    if (!info) return { sec, missingSection: true };
    const hits = labelHits(label);
    const own = hits.filter((h) => h.sec === sec);
    const other = hits.filter((h) => h.sec !== sec);
    const staticChains = own.filter((h) => h.chain.length && h.chain.every((c) => !c.dyn));
    const target = anchor ? slug(anchor) : null;
    const exists = target ? info.anchors.has(target) : true;
    const esc = anchor ? anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
    const propNear = (h) =>
      !!anchor &&
      new RegExp('(?<![A-Za-z])(?:title|label)=\\{t\\("' + esc + '"\\)').test(
        read(h.file).slice(Math.max(0, h.idx - 600), h.idx),
      );
    const inChain =
      !target ||
      !staticChains.length ||
      staticChains.some((h) => h.chain.some((c) => slug(c.title) === target)) ||
      own.some(propNear);
    const tabAt = (h) =>
      h ? tabOf(sec, h.via ? h.via.file : h.file, h.via ? h.via.idx : h.idx) : null;
    let tab = tabAt(target ? own.find((h) => h.chain.some((c) => slug(c.title) === target)) : null);
    if (!tab && target && info.anchors.has(target)) {
      const a = info.anchors.get(target)[0];
      tab = tabOf(sec, a.file, a.idx);
      if (!tab && sec === "tv") tab = tvTab(a.title);
    }
    if (!tab) tab = tabAt(own.find((h) => h.chain.length) ?? own[0]);
    if (!tab && sec === "tv" && anchor) tab = tvTab(anchor);
    const innermost = staticChains.length
      ? staticChains[0].chain[staticChains[0].chain.length - 1].title
      : null;
    return {
      sec,
      exists,
      inChain,
      tab,
      innermost,
      other,
      ownFound: own.length > 0,
      tabs: info.tabs,
    };
  }

  const problems = [];
  for (const e of entries) {
    const d = derive(e.section, e.anchor, e.label);
    const where = `${e.label} (nav.tsx:${e.line})`;
    if (d.missingSection) {
      problems.push({ kind: "unknown section", detail: `${where} -> ${e.section}` });
      continue;
    }
    if (e.anchor && !d.exists)
      problems.push({
        kind: "heading missing",
        detail: `${where} -> "${e.anchor}" is not a heading on the ${d.sec} page`,
      });
    else if (e.anchor && !d.inChain)
      problems.push({
        kind: "heading wrong",
        detail: `${where} -> "${e.anchor}" but the control sits under "${d.innermost}"`,
      });
    const elsewhere = d.other.filter((h) => h.chain.length && h.chain.every((c) => !c.dyn));
    if (!d.ownFound && elsewhere.length) {
      const o = elsewhere[0];
      problems.push({
        kind: "page wrong",
        detail: `${where} is on the ${o.sec} page under "${o.chain[o.chain.length - 1].title}"`,
      });
    }
    if (e.tab && !d.tabs.includes(e.tab))
      problems.push({
        kind: "tab unknown",
        detail: `${where} -> tab "${e.tab}" is not a ${d.sec} tab`,
      });
    else if (e.tab && d.tab && d.tab !== e.tab)
      problems.push({
        kind: "tab wrong",
        detail: `${where} -> tab "${e.tab}" but the control is on "${d.tab}"`,
      });
    else if (!e.tab && d.tab)
      problems.push({
        kind: "tab missing",
        detail: `${where} lives on the "${d.tab}" tab but carries no tab`,
      });
  }

  return { entries, sections, problems, derive, rel };
}
