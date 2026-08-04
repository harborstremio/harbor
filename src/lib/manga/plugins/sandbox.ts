export const SANDBOX_SOURCE = String.raw`(function () {
  "use strict";

  var post = self.postMessage.bind(self);
  var doClose = self.close.bind(self);
  var pending = Object.create(null);
  var seq = 0;
  var provider = null;

  var BLOCKED = [
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts",
    "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel",
    "Notification", "navigator", "Request", "Response", "sendBeacon",
    "MessageChannel", "createImageBitmap"
  ];

  var SHADOW = [
    "self", "globalThis", "window", "fetch", "XMLHttpRequest", "WebSocket",
    "EventSource", "importScripts", "indexedDB", "caches", "Worker",
    "SharedWorker", "BroadcastChannel", "MessageChannel", "postMessage",
    "close", "navigator", "location", "document", "Request", "Response"
  ];

  function safePost(msg) {
    try { post(msg); return true; }
    catch (e) { return false; }
  }

  function bridge(kind, payload) {
    var id = "b" + (++seq);
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      safePost({ type: kind, id: id, payload: payload });
    });
  }

  function normOpts(opts) {
    opts = opts && typeof opts === "object" ? opts : {};
    var headers = {};
    var src = opts.headers;
    if (src && typeof src === "object") {
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) headers[String(k)] = String(src[k]);
      }
    }
    var rt = opts.responseType;
    if (rt !== "json" && rt !== "base64") rt = "text";
    return {
      method: opts.method ? String(opts.method) : "GET",
      headers: headers,
      body: typeof opts.body === "string" ? opts.body : undefined,
      responseType: rt,
      timeoutMs: typeof opts.timeoutMs === "number" ? opts.timeoutMs : undefined
    };
  }

  function httpCall(url, opts) {
    var norm = normOpts(opts);
    return bridge("http", { url: String(url), opts: norm }).then(function (res) {
      if (norm.responseType === "json") {
        try { return JSON.parse(res.body); } catch (e) { return null; }
      }
      return res;
    });
  }

  function parseHtml(html) {
    return bridge("parse", { html: String(html) }).then(function (tree) {
      return new HDocument(tree);
    });
  }

  function log() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      try { args.push(String(arguments[i])); } catch (e) { args.push("?"); }
    }
    safePost({ type: "log", level: "log", args: args });
  }

  function register(p) { provider = p; }

  var harbor = { http: httpCall, parseHtml: parseHtml, register: register, log: log };

  function isEl(node) { return node != null && typeof node === "object" && typeof node.t === "string"; }
  function children(node) { return isEl(node) && Array.isArray(node.c) ? node.c : []; }

  function classList(node) {
    var cls = node.a && node.a["class"];
    if (!cls) return [];
    return String(cls).split(/\s+/).filter(Boolean);
  }

  function collectText(node) {
    if (!isEl(node)) return typeof node.x === "string" ? node.x : "";
    var kids = children(node), s = "";
    for (var i = 0; i < kids.length; i++) s += collectText(kids[i]);
    return s;
  }

  function descendants(node, out) {
    var kids = children(node);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (isEl(k)) { out.push(k); descendants(k, out); }
    }
    return out;
  }

  function elementChildren(node) {
    var kids = children(node), out = [];
    for (var i = 0; i < kids.length; i++) if (isEl(kids[i])) out.push(kids[i]);
    return out;
  }

  function parseAttr(inner) {
    var ops = ["*=", "^=", "$=", "~=", "="];
    for (var k = 0; k < ops.length; k++) {
      var op = ops[k];
      var idx = inner.indexOf(op);
      if (idx >= 0) {
        var name = inner.slice(0, idx).trim();
        var val = inner.slice(idx + op.length).trim().replace(/^["']|["']$/g, "");
        return { name: name.toLowerCase(), op: op, value: val };
      }
    }
    return { name: inner.trim().toLowerCase(), op: null, value: null };
  }

  function parseCompound(sel) {
    var out = { tag: null, id: null, classes: [], attrs: [] };
    var i = 0, word = /[A-Za-z0-9_-]/;
    while (i < sel.length) {
      var ch = sel.charAt(i);
      if (ch === "*") { i++; continue; }
      if (ch === "#") {
        i++; var id = "";
        while (i < sel.length && word.test(sel.charAt(i))) id += sel.charAt(i++);
        if (id) out.id = id;
        continue;
      }
      if (ch === ".") {
        i++; var cl = "";
        while (i < sel.length && word.test(sel.charAt(i))) cl += sel.charAt(i++);
        if (cl) out.classes.push(cl);
        continue;
      }
      if (ch === "[") {
        var end = sel.indexOf("]", i);
        if (end < 0) break;
        out.attrs.push(parseAttr(sel.slice(i + 1, end)));
        i = end + 1;
        continue;
      }
      if (word.test(ch)) {
        var t = "";
        while (i < sel.length && word.test(sel.charAt(i))) t += sel.charAt(i++);
        out.tag = t.toLowerCase();
        continue;
      }
      i++;
    }
    return out;
  }

  function parseGroup(group) {
    var norm = group.replace(/\s*>\s*/g, " > ").trim();
    var toks = norm.split(/\s+/).filter(Boolean);
    var steps = [], combinator = "descendant";
    for (var i = 0; i < toks.length; i++) {
      if (toks[i] === ">") { combinator = "child"; continue; }
      steps.push({ sel: parseCompound(toks[i]), combinator: combinator });
      combinator = "descendant";
    }
    return steps;
  }

  function matchesSimple(node, s) {
    if (!isEl(node)) return false;
    if (s.tag && s.tag !== "*" && node.t.toLowerCase() !== s.tag) return false;
    if (s.id) {
      var nid = node.a ? node.a.id : undefined;
      if (nid !== s.id) return false;
    }
    if (s.classes.length) {
      var cls = classList(node);
      for (var i = 0; i < s.classes.length; i++) if (cls.indexOf(s.classes[i]) < 0) return false;
    }
    for (var j = 0; j < s.attrs.length; j++) {
      var a = s.attrs[j];
      var av = node.a ? node.a[a.name] : undefined;
      if (av == null) return false;
      av = String(av);
      if (a.op === null) continue;
      if (a.op === "=" && av !== a.value) return false;
      if (a.op === "*=" && av.indexOf(a.value) < 0) return false;
      if (a.op === "^=" && av.slice(0, a.value.length) !== a.value) return false;
      if (a.op === "$=" && av.slice(av.length - a.value.length) !== a.value) return false;
      if (a.op === "~=" && av.split(/\s+/).indexOf(a.value) < 0) return false;
    }
    return true;
  }

  function dedupe(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) if (out.indexOf(arr[i]) < 0) out.push(arr[i]);
    return out;
  }

  function matchSteps(root, steps) {
    var current = [root];
    for (var s = 0; s < steps.length; s++) {
      var step = steps[s], next = [];
      for (var c = 0; c < current.length; c++) {
        var pool = step.combinator === "child" ? elementChildren(current[c]) : descendants(current[c], []);
        for (var p = 0; p < pool.length; p++) if (matchesSimple(pool[p], step.sel)) next.push(pool[p]);
      }
      current = dedupe(next);
      if (!current.length) break;
    }
    return current;
  }

  function runQuery(rootNode, selector, first) {
    var groups = String(selector).split(",");
    var results = [];
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g].trim();
      if (!group) continue;
      var steps = parseGroup(group);
      if (!steps.length) continue;
      var matched = matchSteps(rootNode, steps);
      for (var m = 0; m < matched.length; m++) results.push(matched[m]);
      if (first && results.length) break;
    }
    results = dedupe(results);
    return first ? results.slice(0, 1) : results;
  }

  function HElement(node) { this._node = node; }
  HElement.prototype.text = function () {
    return collectText(this._node).replace(/\s+/g, " ").trim();
  };
  HElement.prototype.attr = function (name) {
    var v = this._node.a ? this._node.a[String(name)] : undefined;
    return v == null ? null : String(v);
  };
  HElement.prototype.getAttribute = HElement.prototype.attr;
  HElement.prototype.querySelector = function (sel) {
    var r = runQuery(this._node, sel, true);
    return r.length ? new HElement(r[0]) : null;
  };
  HElement.prototype.querySelectorAll = function (sel) {
    return runQuery(this._node, sel, false).map(function (n) { return new HElement(n); });
  };

  function HDocument(tree) {
    this._root = { t: "#document", a: {}, x: "", c: tree ? [tree] : [] };
  }
  HDocument.prototype.querySelector = function (sel) {
    var r = runQuery(this._root, sel, true);
    return r.length ? new HElement(r[0]) : null;
  };
  HDocument.prototype.querySelectorAll = function (sel) {
    return runQuery(this._root, sel, false).map(function (n) { return new HElement(n); });
  };

  function neutralize() {
    var scopes = [];
    try {
      var o = self;
      while (o && o !== Object.prototype && scopes.indexOf(o) === -1) {
        scopes.push(o);
        o = Object.getPrototypeOf(o);
      }
    } catch (e) {}
    for (var s = 0; s < scopes.length; s++) {
      for (var i = 0; i < BLOCKED.length; i++) {
        var key = BLOCKED[i];
        try { delete scopes[s][key]; } catch (e2) {}
        try { Object.defineProperty(scopes[s], key, { value: undefined, writable: false, configurable: false }); } catch (e3) {}
      }
    }
    try { Object.freeze(self); } catch (e4) {}
  }

  function onInit(m) {
    try {
      neutralize();
      var body = '"use strict";\n' + String(m.source) +
        "\n;return (typeof plugin !== 'undefined') ? plugin : undefined;";
      var params = ["harbor"].concat(SHADOW);
      var factory = new Function(params, body);
      var callArgs = [harbor];
      for (var i = 0; i < SHADOW.length; i++) callArgs.push(undefined);
      var ret = factory.apply(undefined, callArgs);
      if (!provider) provider = ret;
      if (!provider || typeof provider !== "object") throw new Error("plugin registered no provider");
      safePost({
        type: "ready",
        meta: {
          id: String(provider.id),
          name: String(provider.name),
          hasTags: typeof provider.tags === "function"
        }
      });
    } catch (err) {
      safePost({ type: "initError", error: String(err && err.stack ? err.stack : err) });
    }
  }

  function onCall(m) {
    var fn = provider ? provider[m.method] : null;
    if (typeof fn !== "function") {
      safePost({ type: "error", id: m.id, error: "no method: " + m.method });
      return;
    }
    Promise.resolve().then(function () {
      return fn.apply(provider, Array.isArray(m.args) ? m.args : []);
    }).then(function (v) {
      if (!safePost({ type: "result", id: m.id, value: v })) {
        safePost({ type: "error", id: m.id, error: "unserializable result" });
      }
    }).catch(function (e) {
      safePost({ type: "error", id: m.id, error: String(e && e.message ? e.message : e) });
    });
  }

  function onBridge(m) {
    var p = pending[m.id];
    if (!p) return;
    delete pending[m.id];
    if (m.ok) p.resolve(m.value);
    else p.reject(new Error(String(m.error || "bridge error")));
  }

  self.onmessage = function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "init") return onInit(m);
    if (m.type === "call") return onCall(m);
    if (m.type === "bridgeResult") return onBridge(m);
    if (m.type === "ping") return safePost({ type: "pong" });
    if (m.type === "dispose") return doClose();
  };

  self.onerror = function () { return true; };
})();
`;
