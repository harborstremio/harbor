export const PROVIDER_CHEERIO = String.raw`
function __hpEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function __hpOuter(node) {
  if (!node) return "";
  if (typeof node.t !== "string") return node.x == null ? "" : String(node.x);
  if (node.t === "#root" || node.t === "#document") return __hpInner(node);
  var s = "<" + node.t;
  var a = node.a || {};
  for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) s += " " + k + "=\"" + String(a[k]).replace(/"/g, "&quot;") + "\"";
  if (__hyVOID[node.t]) return s + ">";
  return s + ">" + __hpInner(node) + "</" + node.t + ">";
}

function __hpInner(node) {
  var kids = node && Array.isArray(node.c) ? node.c : [];
  var s = "";
  for (var i = 0; i < kids.length; i++) s += __hpOuter(kids[i]);
  return s;
}

function __hpEl(x) {
  if (x == null) return null;
  if (x instanceof DomElement) return x;
  if (x.__hpEl instanceof DomElement) return x.__hpEl;
  if (x.__hpCheerio) return x.length ? x[0].__hpEl : null;
  return null;
}

function __hpRaw(el) {
  if (!el) return null;
  if (el.__hpRaw) return el.__hpRaw;
  var node = el._node;
  var raw = { type: "tag", name: node.t, tagName: node.t, attribs: node.a || {}, __hpEl: el };
  Object.defineProperty(raw, "children", { get: function () { return el.children.map(__hpRaw); } });
  Object.defineProperty(raw, "parent", { get: function () { return el.parent ? __hpRaw(el.parent) : null; } });
  Object.defineProperty(raw, "firstChild", { get: function () { var c = el.children; return c.length ? __hpRaw(c[0]) : null; } });
  Object.defineProperty(raw, "data", { get: function () { return el.text; } });
  el.__hpRaw = raw;
  return raw;
}

function __hpMatches(el, sel) {
  if (!sel) return true;
  var p = el.parent;
  var scope = p ? p : new Document(__hpOuter(el._node));
  var hits = scope.select(sel);
  for (var i = 0; i < hits.length; i++) if (hits[i]._node === el._node) return true;
  return false;
}

function __hpUnique(list) {
  var out = [], seen = [];
  for (var i = 0; i < list.length; i++) {
    var el = __hpEl(list[i]);
    if (!el || seen.indexOf(el._node) >= 0) continue;
    seen.push(el._node);
    out.push(el);
  }
  return out;
}

function __hpWrap(list) {
  var els = __hpUnique(list);
  var c = {};
  c.__hpCheerio = true;
  c.length = els.length;
  for (var i = 0; i < els.length; i++) c[i] = __hpRaw(els[i]);
  c.__els = els;
  c.toArray = function () { return els.map(__hpRaw); };
  c.get = function (i) { if (i == null) return c.toArray(); var idx = i < 0 ? els.length + i : i; return els[idx] ? __hpRaw(els[idx]) : undefined; };
  c.eq = function (i) { var idx = i < 0 ? els.length + i : i; return __hpWrap(els[idx] ? [els[idx]] : []); };
  c.first = function () { return c.eq(0); };
  c.last = function () { return c.eq(els.length - 1); };
  c.slice = function (a, b) { return __hpWrap(els.slice(a, b)); };
  c.each = function (fn) { for (var j = 0; j < els.length; j++) if (fn.call(__hpRaw(els[j]), j, __hpRaw(els[j])) === false) break; return c; };
  c.map = function (fn) {
    var out = [];
    for (var j = 0; j < els.length; j++) {
      var r = fn.call(__hpRaw(els[j]), j, __hpRaw(els[j]));
      if (r == null) continue;
      if (Array.isArray(r)) out = out.concat(r); else out.push(r);
    }
    var wrapped = out.every(function (x) { return __hpEl(x); }) ? __hpWrap(out) : __hpWrapValues(out);
    return wrapped;
  };
  c.filter = function (arg) {
    if (typeof arg === "function") return __hpWrap(els.filter(function (el, j) { return !!arg.call(__hpRaw(el), j, __hpRaw(el)); }));
    return __hpWrap(els.filter(function (el) { return __hpMatches(el, arg); }));
  };
  c.not = function (arg) {
    if (typeof arg === "function") return __hpWrap(els.filter(function (el, j) { return !arg.call(__hpRaw(el), j, __hpRaw(el)); }));
    return __hpWrap(els.filter(function (el) { return !__hpMatches(el, arg); }));
  };
  c.find = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) out = out.concat(els[j].select(sel));
    return __hpWrap(out);
  };
  c.children = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) out = out.concat(els[j].children.filter(function (k) { return __hpMatches(k, sel); }));
    return __hpWrap(out);
  };
  c.parent = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var p = els[j].parent; if (p && __hpMatches(p, sel)) out.push(p); }
    return __hpWrap(out);
  };
  c.parents = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var p = els[j].parent; while (p) { if (__hpMatches(p, sel)) out.push(p); p = p.parent; } }
    return __hpWrap(out);
  };
  c.closest = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var p = els[j]; while (p) { if (__hpMatches(p, sel)) { out.push(p); break; } p = p.parent; } }
    return __hpWrap(out);
  };
  c.next = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var n = els[j].nextElementSibling; if (n && __hpMatches(n, sel)) out.push(n); }
    return __hpWrap(out);
  };
  c.prev = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var n = els[j].previousElementSibling; if (n && __hpMatches(n, sel)) out.push(n); }
    return __hpWrap(out);
  };
  c.nextAll = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) { var n = els[j].nextElementSibling; while (n) { if (__hpMatches(n, sel)) out.push(n); n = n.nextElementSibling; } }
    return __hpWrap(out);
  };
  c.siblings = function (sel) {
    var out = [];
    for (var j = 0; j < els.length; j++) out = out.concat(els[j].siblingElements().filter(function (k) { return __hpMatches(k, sel); }));
    return __hpWrap(out);
  };
  c.is = function (sel) { for (var j = 0; j < els.length; j++) if (__hpMatches(els[j], sel)) return true; return false; };
  c.hasClass = function (cls) { for (var j = 0; j < els.length; j++) if (els[j].hasClass(cls)) return true; return false; };
  c.attr = function (name, value) {
    if (value !== undefined) { for (var j = 0; j < els.length; j++) { els[j]._node.a = els[j]._node.a || {}; els[j]._node.a[String(name).toLowerCase()] = String(value); } return c; }
    if (!els.length) return undefined;
    if (name === undefined) return els[0]._node.a || {};
    var v = els[0].attrOrNull(name);
    return v == null ? undefined : v;
  };
  c.prop = function (name) { if (name === "tagName" || name === "nodeName") return els.length ? String(els[0].tagName).toUpperCase() : undefined; if (name === "outerHTML") return els.length ? __hpOuter(els[0]._node) : undefined; if (name === "innerHTML") return c.html(); return c.attr(name); };
  c.data = function (name) {
    if (!els.length) return undefined;
    if (name === undefined) { var out = {}; var a = els[0]._node.a || {}; for (var k in a) if (k.indexOf("data-") === 0) out[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = a[k]; return out; }
    var key = "data-" + String(name).replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); });
    var v = els[0].attrOrNull(key);
    return v == null ? undefined : v;
  };
  c.val = function () { return els.length ? els[0].attr("value") : undefined; };
  c.text = function () { var s = ""; for (var j = 0; j < els.length; j++) s += __hyText(els[j]._node); return s; };
  c.html = function () { return els.length ? __hpInner(els[0]._node) : null; };
  c.toString = function () { var s = ""; for (var j = 0; j < els.length; j++) s += __hpOuter(els[j]._node); return s; };
  c.contents = function () { return c.children(); };
  c.end = function () { return c; };
  c.add = function (other) { var o = other && other.__hpCheerio ? other.__els : [__hpEl(other)]; return __hpWrap(els.concat(o)); };
  c.remove = function () { for (var j = 0; j < els.length; j++) { var p = els[j]._node.p; if (p && Array.isArray(p.c)) { var idx = p.c.indexOf(els[j]._node); if (idx >= 0) p.c.splice(idx, 1); } } return c; };
  c.index = function () { if (!els.length) return -1; var p = els[0].parent; if (!p) return 0; var kids = p.children; for (var j = 0; j < kids.length; j++) if (kids[j]._node === els[0]._node) return j; return -1; };
  return c;
}

function __hpWrapValues(values) {
  var c = { __hpCheerio: true, __els: [], length: values.length };
  for (var i = 0; i < values.length; i++) c[i] = values[i];
  c.get = function (i) { return i == null ? values.slice() : values[i]; };
  c.toArray = function () { return values.slice(); };
  c.each = function (fn) { for (var j = 0; j < values.length; j++) if (fn.call(values[j], j, values[j]) === false) break; return c; };
  c.map = function (fn) { var out = []; for (var j = 0; j < values.length; j++) { var r = fn.call(values[j], j, values[j]); if (r != null) out.push(r); } return __hpWrapValues(out); };
  c.filter = function (fn) { return __hpWrapValues(values.filter(function (v, j) { return !!fn.call(v, j, v); })); };
  c.join = function (sep) { return values.join(sep); };
  c.text = function () { return values.join(""); };
  c.first = function () { return __hpWrapValues(values.slice(0, 1)); };
  c.last = function () { return __hpWrapValues(values.slice(-1)); };
  c.eq = function (i) { return __hpWrapValues(values[i] === undefined ? [] : [values[i]]); };
  return c;
}

var cheerio = {
  load: function (html) {
    var doc = new Document(String(html == null ? "" : html));
    var rootEl = new DomElement(doc._root);
    function $(sel, ctx) {
      if (sel == null) return __hpWrap([]);
      if (typeof sel === "string") {
        if (/^\s*</.test(sel)) return __hpWrap(new DomElement(new Document(sel)._root).children);
        var scopes = ctx ? (ctx.__hpCheerio ? ctx.__els : [__hpEl(ctx) || rootEl]) : [rootEl];
        var out = [];
        for (var i = 0; i < scopes.length; i++) if (scopes[i]) out = out.concat(scopes[i].select(sel));
        return __hpWrap(out);
      }
      if (sel.__hpCheerio) return sel;
      var el = __hpEl(sel);
      if (el) return __hpWrap([el]);
      if (Array.isArray(sel)) return __hpWrap(sel);
      return __hpWrap([]);
    }
    $.html = function (x) { if (x == null) return __hpInner(doc._root); var c = $(x); return c.toString(); };
    $.text = function (x) { if (x == null) return __hyText(doc._root); return $(x).text(); };
    $.root = function () { return __hpWrap([rootEl]); };
    $.load = cheerio.load;
    $._root = doc;
    return $;
  },
  html: function (x) { return x && x.__hpCheerio ? x.toString() : String(x == null ? "" : x); },
  text: function (x) { return x && x.__hpCheerio ? x.text() : String(x == null ? "" : x); }
};
__g.cheerio = cheerio;
`;
