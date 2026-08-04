export const DOM_PRELUDE = String.raw`
var __hyVOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
var __hyRAW = { script:1, style:1, textarea:1, title:1 };
var __hyENT = { amp:"&", lt:"<", gt:">", quot:"\"", apos:"'", nbsp:" ", "#39":"'" };

function __hyDecode(s) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, function (m, e) {
    if (e.charAt(0) === "#") {
      var hex = e.charAt(1) === "x" || e.charAt(1) === "X";
      var code = hex ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isFinite(code) ? String.fromCharCode(code) : m;
    }
    return __hyENT[e] != null ? __hyENT[e] : m;
  });
}

function __hyIndexCI(hay, needle, from) {
  return hay.toLowerCase().indexOf(needle.toLowerCase(), from);
}

function __hyParseTag(raw) {
  var m = /^([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(raw);
  if (!m) return null;
  var tag = m[1].toLowerCase();
  var rest = raw.slice(m[0].length);
  var attrs = {};
  var re = /([^\s"'>\/=]+)\s*(=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;
  var a;
  while ((a = re.exec(rest))) {
    if (!a[1]) continue;
    var name = a[1].toLowerCase();
    var val = "";
    if (a[4] != null) val = a[4];
    else if (a[5] != null) val = a[5];
    else if (a[2]) val = a[2].replace(/^=\s*/, "");
    attrs[name] = __hyDecode(val);
  }
  return { t: tag, a: attrs, c: [] };
}

function __hyPushText(stack, text) {
  if (!text) return;
  var top = stack[stack.length - 1];
  top.c.push({ x: __hyDecode(text) });
}

function __hyCloseTag(stack, tag) {
  for (var j = stack.length - 1; j > 0; j--) {
    if (stack[j].t === tag) { stack.length = j; return; }
  }
}

function __hyParse(html) {
  html = String(html);
  var root = { t: "#root", a: {}, c: [] };
  var stack = [root];
  var i = 0, n = html.length;
  while (i < n) {
    var lt = html.indexOf("<", i);
    if (lt < 0) { __hyPushText(stack, html.slice(i)); break; }
    if (lt > i) __hyPushText(stack, html.slice(i, lt));
    if (html.substr(lt, 4) === "<!--") {
      var ce = html.indexOf("-->", lt + 4);
      i = ce < 0 ? n : ce + 3;
      continue;
    }
    if (html.charAt(lt + 1) === "!" || html.charAt(lt + 1) === "?") {
      var de = html.indexOf(">", lt);
      i = de < 0 ? n : de + 1;
      continue;
    }
    var gt = html.indexOf(">", lt);
    if (gt < 0) { __hyPushText(stack, html.slice(lt)); break; }
    var body = html.slice(lt + 1, gt);
    i = gt + 1;
    if (body.charAt(0) === "/") {
      __hyCloseTag(stack, body.slice(1).trim().toLowerCase());
      continue;
    }
    var selfClose = body.charAt(body.length - 1) === "/";
    if (selfClose) body = body.slice(0, -1);
    var node = __hyParseTag(body);
    if (!node) continue;
    node.p = stack[stack.length - 1];
    stack[stack.length - 1].c.push(node);
    if (__hyVOID[node.t] || selfClose) continue;
    if (__hyRAW[node.t]) {
      var closer = "</" + node.t;
      var idx = __hyIndexCI(html, closer, i);
      var inner = html.slice(i, idx < 0 ? n : idx);
      if (inner) node.c.push({ x: inner });
      if (idx < 0) { i = n; }
      else { var g2 = html.indexOf(">", idx); i = g2 < 0 ? n : g2 + 1; }
      continue;
    }
    stack.push(node);
  }
  return root;
}

function __hyIsEl(node) { return node != null && typeof node === "object" && typeof node.t === "string"; }
function __hyKids(node) { return __hyIsEl(node) && Array.isArray(node.c) ? node.c : []; }

function __hyClassList(node) {
  var cls = node.a && node.a["class"];
  if (!cls) return [];
  return String(cls).split(/\s+/).filter(Boolean);
}

function __hyText(node) {
  if (!__hyIsEl(node)) return typeof node.x === "string" ? node.x : "";
  var kids = __hyKids(node), s = "";
  for (var i = 0; i < kids.length; i++) s += __hyText(kids[i]);
  return s;
}

function __hyDesc(node, out) {
  var kids = __hyKids(node);
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (__hyIsEl(k)) { out.push(k); __hyDesc(k, out); }
  }
  return out;
}

function __hyElKids(node) {
  var kids = __hyKids(node), out = [];
  for (var i = 0; i < kids.length; i++) if (__hyIsEl(kids[i])) out.push(kids[i]);
  return out;
}

function __hyParseAttr(inner) {
  inner = String(inner).trim();
  var ci = false;
  var fm = /^([\s\S]*\S)\s+[iI]$/.exec(inner);
  if (fm && /[=~^$*|]/.test(fm[1])) { inner = fm[1]; ci = true; }
  var ops = ["*=", "^=", "$=", "~=", "|=", "="];
  for (var k = 0; k < ops.length; k++) {
    var op = ops[k], idx = inner.indexOf(op);
    if (idx >= 0) {
      var name = inner.slice(0, idx).trim();
      var val = inner.slice(idx + op.length).trim().replace(/^["']|["']$/g, "");
      return { name: name.toLowerCase(), op: op, value: val, ci: ci };
    }
  }
  return { name: inner.trim().toLowerCase(), op: null, value: null, ci: ci };
}

function __hyCompound(sel) {
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
      out.attrs.push(__hyParseAttr(sel.slice(i + 1, end)));
      i = end + 1;
      continue;
    }
    if (ch === ":") {
      i++;
      if (sel.charAt(i) === ":") i++;
      var pn = "";
      while (i < sel.length && word.test(sel.charAt(i))) pn += sel.charAt(i++);
      var parg = null;
      if (sel.charAt(i) === "(") {
        var pd = 1; i++; var ps = i;
        while (i < sel.length && pd > 0) {
          var pc = sel.charAt(i);
          if (pc === "(") pd++;
          else if (pc === ")") pd--;
          if (pd > 0) i++;
        }
        parg = sel.slice(ps, i);
        i++;
      }
      pn = pn.toLowerCase();
      if (pn === "has" && parg != null) (out.has = out.has || []).push(parg);
      else if (pn === "not" && parg != null) (out.not = out.not || []).push(parg);
      else if (pn === "contains" && parg != null) (out.contains = out.contains || []).push(__hyPseudoText(parg));
      else if (pn === "containsown" && parg != null) (out.containsOwn = out.containsOwn || []).push(__hyPseudoText(parg));
      else if ((pn === "matches" || pn === "matchesown") && parg != null) (out.matches = out.matches || []).push(parg);
      else if (pn === "first-child") __hyPos(out).firstChild = true;
      else if (pn === "last-child") __hyPos(out).lastChild = true;
      else if (pn === "only-child") __hyPos(out).onlyChild = true;
      else if (pn === "empty") __hyPos(out).empty = true;
      else if (pn === "first-of-type") __hyPos(out).firstOfType = true;
      else if (pn === "last-of-type") __hyPos(out).lastOfType = true;
      else if (pn === "nth-child" && parg != null) __hyPos(out).nthChild = parg;
      else if (pn === "nth-last-child" && parg != null) __hyPos(out).nthLastChild = parg;
      else if (pn === "nth-of-type" && parg != null) __hyPos(out).nthOfType = parg;
      else if (pn === "eq" && parg != null) __hyPos(out).eq = parg;
      else if (pn === "gt" && parg != null) __hyPos(out).gt = parg;
      else if (pn === "lt" && parg != null) __hyPos(out).lt = parg;
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

function __hySibs(node, adjacentOnly) {
  var parent = node.p;
  if (!parent) return [];
  var kids = __hyElKids(parent);
  var idx = kids.indexOf(node);
  if (idx < 0) return [];
  return adjacentOnly ? (idx + 1 < kids.length ? [kids[idx + 1]] : []) : kids.slice(idx + 1);
}

function __hySibEl(node, dir) {
  var parent = node.p;
  if (!parent) return null;
  var kids = __hyElKids(parent);
  var idx = kids.indexOf(node);
  if (idx < 0) return null;
  var j = idx + dir;
  return (j >= 0 && j < kids.length) ? kids[j] : null;
}

function __hyOwnText(node) {
  var kids = __hyKids(node), s = "";
  for (var i = 0; i < kids.length; i++) if (!__hyIsEl(kids[i])) s += (kids[i].x || "");
  return s.replace(/\s+/g, " ").trim();
}

function __hyPseudoText(s) {
  s = String(s).trim();
  if (s.length >= 2) {
    var q = s.charAt(0);
    if ((q === '"' || q === "'") && s.charAt(s.length - 1) === q) s = s.slice(1, -1);
  }
  return __hyDecode(s);
}

function __hySafeRe(src) {
  try { return new RegExp(String(src)); } catch (e) { return null; }
}

function __hyInt(v) {
  var n = parseInt(v, 10);
  return isFinite(n) ? n : 0;
}

function __hyNth(expr, pos) {
  expr = String(expr).trim().toLowerCase().replace(/\s+/g, "");
  if (expr === "odd") return (pos % 2) === 1;
  if (expr === "even") return (pos % 2) === 0;
  if (/^[+-]?\d+$/.test(expr)) return pos === parseInt(expr, 10);
  var m = /^([+-]?\d*)n([+-]\d+)?$/.exec(expr);
  if (!m) return false;
  var a = (m[1] === "" || m[1] === "+") ? 1 : (m[1] === "-" ? -1 : parseInt(m[1], 10));
  var b = m[2] ? parseInt(m[2], 10) : 0;
  if (a === 0) return pos === b;
  var k = (pos - b) / a;
  return k >= 0 && k === Math.floor(k);
}

function __hyPos(out) { return out.pos || (out.pos = {}); }

function __hyMatchPos(node, pos) {
  var parent = node.p;
  if (!parent) return false;
  var kids = __hyElKids(parent);
  var idx = kids.indexOf(node);
  if (idx < 0) return false;
  var pos1 = idx + 1;
  if (pos.firstChild && idx !== 0) return false;
  if (pos.lastChild && idx !== kids.length - 1) return false;
  if (pos.onlyChild && kids.length !== 1) return false;
  if (pos.empty) { if (__hyElKids(node).length || __hyText(node).replace(/\s+/g, "") !== "") return false; }
  if (pos.eq != null && idx !== __hyInt(pos.eq)) return false;
  if (pos.gt != null && !(idx > __hyInt(pos.gt))) return false;
  if (pos.lt != null && !(idx < __hyInt(pos.lt))) return false;
  if (pos.nthChild != null && !__hyNth(pos.nthChild, pos1)) return false;
  if (pos.nthLastChild != null && !__hyNth(pos.nthLastChild, kids.length - idx)) return false;
  if (pos.firstOfType || pos.lastOfType || pos.nthOfType != null) {
    var same = [];
    for (var i = 0; i < kids.length; i++) if (kids[i].t === node.t) same.push(kids[i]);
    var ti = same.indexOf(node);
    if (pos.firstOfType && ti !== 0) return false;
    if (pos.lastOfType && ti !== same.length - 1) return false;
    if (pos.nthOfType != null && !__hyNth(pos.nthOfType, ti + 1)) return false;
  }
  return true;
}

function __hyGroup(group) {
  var steps = [], comb = "descendant", buf = "";
  var i = 0, n = group.length, bracket = 0, paren = 0, quote = null;
  function flush() {
    if (buf) { steps.push({ sel: __hyCompound(buf), comb: comb }); comb = "descendant"; buf = ""; }
  }
  while (i < n) {
    var ch = group.charAt(i);
    if (quote) { buf += ch; if (ch === quote) quote = null; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; i++; continue; }
    if (ch === "[") { bracket++; buf += ch; i++; continue; }
    if (ch === "]") { if (bracket > 0) bracket--; buf += ch; i++; continue; }
    if (ch === "(") { paren++; buf += ch; i++; continue; }
    if (ch === ")") { if (paren > 0) paren--; buf += ch; i++; continue; }
    if (bracket > 0 || paren > 0) { buf += ch; i++; continue; }
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") { flush(); i++; continue; }
    if (ch === ">" || ch === "+" || ch === "~") { flush(); comb = ch === ">" ? "child" : (ch === "+" ? "adjacent" : "sibling"); i++; continue; }
    buf += ch; i++;
  }
  flush();
  return steps;
}

function __hyMatch(node, s) {
  if (!__hyIsEl(node)) return false;
  if (s.tag && s.tag !== "*" && node.t !== s.tag) return false;
  if (s.id && (!node.a || node.a.id !== s.id)) return false;
  if (s.classes.length) {
    var cls = __hyClassList(node);
    for (var i = 0; i < s.classes.length; i++) if (cls.indexOf(s.classes[i]) < 0) return false;
  }
  for (var j = 0; j < s.attrs.length; j++) {
    var a = s.attrs[j];
    var av = node.a ? node.a[a.name] : undefined;
    if (av == null) return false;
    av = String(av);
    if (a.op === null) continue;
    var cav = av, cval = a.value == null ? "" : String(a.value);
    if (a.ci) { cav = av.toLowerCase(); cval = cval.toLowerCase(); }
    if (a.op === "=" && cav !== cval) return false;
    if (a.op === "*=" && cav.indexOf(cval) < 0) return false;
    if (a.op === "^=" && cav.slice(0, cval.length) !== cval) return false;
    if (a.op === "$=" && cav.slice(cav.length - cval.length) !== cval) return false;
    if (a.op === "~=" && cav.split(/\s+/).indexOf(cval) < 0) return false;
    if (a.op === "|=" && cav !== cval && cav.slice(0, cval.length + 1) !== cval + "-") return false;
  }
  if (s.has) {
    for (var h = 0; h < s.has.length; h++) if (!__hyQuery(node, s.has[h], true).length) return false;
  }
  if (s.not) {
    for (var n2 = 0; n2 < s.not.length; n2++) if (__hyMatch(node, __hyCompound(s.not[n2]))) return false;
  }
  if (s.contains) {
    var _ct = __hyText(node).toLowerCase();
    for (var _ci = 0; _ci < s.contains.length; _ci++) if (_ct.indexOf(String(s.contains[_ci]).toLowerCase()) < 0) return false;
  }
  if (s.containsOwn) {
    var _cot = __hyOwnText(node).toLowerCase();
    for (var _oi = 0; _oi < s.containsOwn.length; _oi++) if (_cot.indexOf(String(s.containsOwn[_oi]).toLowerCase()) < 0) return false;
  }
  if (s.matches) {
    var _mt = __hyText(node);
    for (var _mi = 0; _mi < s.matches.length; _mi++) { var _rx = __hySafeRe(s.matches[_mi]); if (_rx && !_rx.test(_mt)) return false; }
  }
  if (s.pos && !__hyMatchPos(node, s.pos)) return false;
  return true;
}

function __hyDedupe(arr) {
  var out = [];
  for (var i = 0; i < arr.length; i++) if (out.indexOf(arr[i]) < 0) out.push(arr[i]);
  return out;
}

function __hySteps(root, steps) {
  var current = [root];
  for (var s = 0; s < steps.length; s++) {
    var step = steps[s], next = [];
    for (var c = 0; c < current.length; c++) {
      var pool = step.comb === "child" ? __hyElKids(current[c])
        : step.comb === "adjacent" ? __hySibs(current[c], true)
        : step.comb === "sibling" ? __hySibs(current[c], false)
        : __hyDesc(current[c], []);
      for (var p = 0; p < pool.length; p++) if (__hyMatch(pool[p], step.sel)) next.push(pool[p]);
    }
    current = __hyDedupe(next);
    if (!current.length) break;
  }
  return current;
}

function __hyQuery(root, selector, first) {
  var groups = String(selector).split(",");
  var results = [];
  for (var g = 0; g < groups.length; g++) {
    var group = groups[g].trim();
    if (!group) continue;
    var steps = __hyGroup(group);
    if (!steps.length) continue;
    var matched = __hySteps(root, steps);
    for (var m = 0; m < matched.length; m++) results.push(matched[m]);
    if (first && results.length) break;
  }
  results = __hyDedupe(results);
  return first ? results.slice(0, 1) : results;
}

function DomElement(node) { this._node = node; }
Object.defineProperty(DomElement.prototype, "text", {
  get: function () { return __hyText(this._node).replace(/\s+/g, " ").trim(); },
});
Object.defineProperty(DomElement.prototype, "ownText", {
  get: function () {
    var kids = __hyKids(this._node), s = "";
    for (var i = 0; i < kids.length; i++) if (!__hyIsEl(kids[i])) s += (kids[i].x || "");
    return s.replace(/\s+/g, " ").trim();
  },
});
Object.defineProperty(DomElement.prototype, "className", {
  get: function () { return this.attr("class"); },
});
Object.defineProperty(DomElement.prototype, "getHref", {
  get: function () { return this.attr("href"); },
});
Object.defineProperty(DomElement.prototype, "getSrc", {
  get: function () { return this.attr("src"); },
});
DomElement.prototype.attr = function (name) {
  var v = this._node.a ? this._node.a[String(name).toLowerCase()] : undefined;
  return v == null ? "" : String(v);
};
DomElement.prototype.attrOrNull = function (name) {
  var v = this._node.a ? this._node.a[String(name).toLowerCase()] : undefined;
  return v == null ? null : String(v);
};
DomElement.prototype.getAttribute = DomElement.prototype.attrOrNull;
DomElement.prototype.hasClass = function (c) { return __hyClassList(this._node).indexOf(String(c)) >= 0; };
DomElement.prototype.selectFirst = function (sel) {
  var r = __hyQuery(this._node, sel, true);
  return r.length ? new DomElement(r[0]) : null;
};
DomElement.prototype.select = function (sel) {
  return __hyQuery(this._node, sel, false).map(function (n) { return new DomElement(n); });
};
DomElement.prototype.querySelector = DomElement.prototype.selectFirst;
DomElement.prototype.querySelectorAll = DomElement.prototype.select;
DomElement.prototype.hasAttr = function (name) {
  return !!(this._node.a && Object.prototype.hasOwnProperty.call(this._node.a, String(name).toLowerCase()));
};
Object.defineProperty(DomElement.prototype, "tagName", {
  get: function () { return this._node.t; },
});
Object.defineProperty(DomElement.prototype, "id", {
  get: function () { return this.attr("id"); },
});
Object.defineProperty(DomElement.prototype, "val", {
  get: function () { return this.attr("value"); },
});
Object.defineProperty(DomElement.prototype, "children", {
  get: function () { return __hyElKids(this._node).map(function (n) { return new DomElement(n); }); },
});
Object.defineProperty(DomElement.prototype, "nextElementSibling", {
  get: function () { var n = __hySibEl(this._node, 1); return n ? new DomElement(n) : null; },
});
Object.defineProperty(DomElement.prototype, "previousElementSibling", {
  get: function () { var n = __hySibEl(this._node, -1); return n ? new DomElement(n) : null; },
});
Object.defineProperty(DomElement.prototype, "parent", {
  get: function () { var p = this._node.p; return p && __hyIsEl(p) && p.t !== "#root" ? new DomElement(p) : null; },
});
Object.defineProperty(DomElement.prototype, "firstElementChild", {
  get: function () { var k = __hyElKids(this._node); return k.length ? new DomElement(k[0]) : null; },
});
Object.defineProperty(DomElement.prototype, "lastElementChild", {
  get: function () { var k = __hyElKids(this._node); return k.length ? new DomElement(k[k.length - 1]) : null; },
});
DomElement.prototype.siblingElements = function () {
  var self = this._node, p = self.p, out = [];
  if (!p) return out;
  var kids = __hyElKids(p);
  for (var i = 0; i < kids.length; i++) if (kids[i] !== self) out.push(new DomElement(kids[i]));
  return out;
};

function Document(html) {
  this._root = typeof html === "object" && html && html.t ? html : __hyParse(html);
}
Document.prototype.selectFirst = function (sel) {
  var r = __hyQuery(this._root, sel, true);
  return r.length ? new DomElement(r[0]) : null;
};
Document.prototype.select = function (sel) {
  return __hyQuery(this._root, sel, false).map(function (n) { return new DomElement(n); });
};
Object.defineProperty(Document.prototype, "text", {
  get: function () { return __hyText(this._root).replace(/\s+/g, " ").trim(); },
});
Document.prototype.querySelector = Document.prototype.selectFirst;
Document.prototype.querySelectorAll = Document.prototype.select;
var DomTree = Document;
`;
