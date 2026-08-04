export const RUNTIME_PRELUDE = String.raw`
function __hyEncodeBody(body, headers) {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  var ct = "";
  if (headers) for (var h in headers) if (h.toLowerCase() === "content-type") ct = String(headers[h]).toLowerCase();
  if (ct.indexOf("json") >= 0) return JSON.stringify(body);
  if (typeof body === "object") {
    var parts = [];
    for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(body[k])));
    }
    return parts.join("&");
  }
  return String(body);
}

function __hyReq(method, url, headers, body) {
  var h = headers;
  if (h && typeof h === "object" && h.headers && typeof h.headers === "object") {
    if (body == null && h.body != null) body = h.body;
    if (body == null && h.data != null) body = h.data;
    h = h.headers;
  }
  var opts = { method: method, headers: h || {}, responseType: "text" };
  var enc = __hyEncodeBody(body, h);
  if (enc != null) opts.body = enc;
  return harbor.http(String(url), opts).then(function (res) {
    return {
      body: res.body,
      statusCode: res.status,
      status: res.status,
      hasError: !res.ok,
      headers: res.headers || {},
      request: { url: String(url) },
    };
  });
}

function Client() {}
Client.prototype.get = function (url, headers) { return __hyReq("GET", url, headers, null); };
Client.prototype.head = function (url, headers) { return __hyReq("HEAD", url, headers, null); };
Client.prototype.post = function (url, headers, body) { return __hyReq("POST", url, headers, body); };
Client.prototype.put = function (url, headers, body) { return __hyReq("PUT", url, headers, body); };
Client.prototype.patch = function (url, headers, body) { return __hyReq("PATCH", url, headers, body); };
Client.prototype.delete = function (url, headers, body) { return __hyReq("DELETE", url, headers, body); };
Client.prototype.request = function (opts) {
  opts = opts || {};
  var rbody = opts.body != null ? opts.body : opts.data;
  return __hyReq(opts.method || "GET", opts.url, opts.headers, rbody);
};

function __hyBefore(s, d) { var i = String(s).indexOf(d); return i < 0 ? String(s) : String(s).slice(0, i); }
function __hyAfter(s, d) { var i = String(s).indexOf(d); return i < 0 ? String(s) : String(s).slice(i + d.length); }
function __hyBeforeLast(s, d) { var i = String(s).lastIndexOf(d); return i < 0 ? String(s) : String(s).slice(0, i); }
function __hyAfterLast(s, d) { var i = String(s).lastIndexOf(d); return i < 0 ? String(s) : String(s).slice(i + d.length); }
function __hyBetween(s, a, b) { return __hyBefore(__hyAfter(s, a), b); }

var MBridge = {
  parseHtml: function (html) { return new Document(html); },
  substringBefore: __hyBefore,
  substringAfter: __hyAfter,
  substringBeforeLast: __hyBeforeLast,
  substringAfterLast: __hyAfterLast,
  substringBetween: __hyBetween,
  trim: function (s) { return String(s).trim(); },
};

var __hyPrefStore = Object.create(null);

function __hyPrefDefault(p) {
  var spec = p.listPreference || p.multiSelectListPreference || p.editTextPreference ||
    p.switchPreferenceCompat || p.checkBoxPreference;
  if (!spec) return undefined;
  if (p.listPreference) {
    var ev = spec.entryValues || [];
    var idx = spec.valueIndex != null ? spec.valueIndex : 0;
    if (ev[idx] != null) return ev[idx];
    return spec.value != null ? spec.value : spec.defaultValue;
  }
  if (p.multiSelectListPreference) {
    if (spec.values != null) return spec.values;
    return spec.defaultValue != null ? spec.defaultValue : [];
  }
  return spec.value != null ? spec.value : spec.defaultValue;
}

function __hyInitPrefs(ext) {
  var prefs = [];
  try { prefs = ext && ext.getSourcePreferences ? ext.getSourcePreferences() : []; } catch (e) { prefs = []; }
  if (!Array.isArray(prefs)) return;
  for (var i = 0; i < prefs.length; i++) {
    var p = prefs[i];
    if (!p || !p.key) continue;
    if (__hyPrefStore[p.key] === undefined) __hyPrefStore[p.key] = __hyPrefDefault(p);
  }
}

function SharedPreferences() {}
SharedPreferences.prototype.get = function (key, def) {
  var v = __hyPrefStore[key];
  return v === undefined || v === null ? (def !== undefined ? def : v) : v;
};
SharedPreferences.prototype.getString = function (key, def) {
  var v = __hyPrefStore[key];
  return v == null ? (def != null ? def : "") : String(v);
};
SharedPreferences.prototype.getInt = function (key, def) {
  var n = parseInt(__hyPrefStore[key]);
  return isNaN(n) ? (def != null ? def : 0) : n;
};
SharedPreferences.prototype.getLong = SharedPreferences.prototype.getInt;
SharedPreferences.prototype.getDouble = function (key, def) {
  var n = parseFloat(__hyPrefStore[key]);
  return isNaN(n) ? (def != null ? def : 0) : n;
};
SharedPreferences.prototype.getBool = function (key, def) {
  var v = __hyPrefStore[key];
  return v == null ? (def != null ? def : false) : (v === true || v === "true");
};
SharedPreferences.prototype.getFloat = SharedPreferences.prototype.getDouble;
SharedPreferences.prototype.getBoolean = SharedPreferences.prototype.getBool;
SharedPreferences.prototype.getStringSet = function (key, def) {
  var v = __hyPrefStore[key];
  return Array.isArray(v) ? v : (def != null ? def : []);
};
SharedPreferences.prototype.getStringList = SharedPreferences.prototype.getStringSet;
SharedPreferences.prototype.set = function (key, value) { __hyPrefStore[key] = value; };
SharedPreferences.prototype.setString = SharedPreferences.prototype.set;
SharedPreferences.prototype.setInt = SharedPreferences.prototype.set;
SharedPreferences.prototype.setLong = SharedPreferences.prototype.set;
SharedPreferences.prototype.setDouble = SharedPreferences.prototype.set;
SharedPreferences.prototype.setBool = SharedPreferences.prototype.set;
SharedPreferences.prototype.setStringSet = SharedPreferences.prototype.set;
SharedPreferences.prototype.setStringList = SharedPreferences.prototype.set;
SharedPreferences.prototype.setFloat = SharedPreferences.prototype.set;
SharedPreferences.prototype.setBoolean = SharedPreferences.prototype.set;

function MProvider(source) { this.source = source || {}; this.client = new Client(); }
MProvider.prototype.getHeaders = function () { return {}; };
MProvider.prototype.getFilterList = function () { return []; };
MProvider.prototype.getSourcePreferences = function () { return []; };
MProvider.prototype.getBaseUrl = function () { return this.source && this.source.baseUrl; };
MProvider.prototype.substringBefore = function (s, d) { return __hyBefore(s, d); };
MProvider.prototype.substringAfter = function (s, d) { return __hyAfter(s, d); };
MProvider.prototype.substringBeforeLast = function (s, d) { return __hyBeforeLast(s, d); };
MProvider.prototype.substringAfterLast = function (s, d) { return __hyAfterLast(s, d); };
MProvider.prototype.substringBetween = function (s, a, b) { return __hyBetween(s, a, b); };
MProvider.prototype.getPreference = function (key, def) {
  var v = __hyPrefStore[key];
  return v === undefined || v === null ? (def !== undefined ? def : v) : v;
};
MProvider.prototype.getPreferenceValue = MProvider.prototype.getPreference;

function __hyStatus(v) {
  if (typeof v === "number") {
    return ["ongoing", "completed", "hiatus", "cancelled", "completed", ""][v] || "";
  }
  return typeof v === "string" ? v.toLowerCase() : undefined;
}

function __hyCover(c) {
  if (c == null) return undefined;
  c = String(c);
  if (!c) return undefined;
  if (c.indexOf("//") === 0) return "https:" + c;
  return c;
}

function __hyItem(o) {
  if (!o || typeof o !== "object") return null;
  var id = o.link || o.url;
  var title = o.name || o.title;
  if (!id || !title) return null;
  var cover = o.imageUrl || o.cover || o.thumbnailUrl || o.coverUrl || o.image;
  return { id: String(id), title: String(title), cover: __hyCover(cover) };
}

function __hyToList(res) {
  var arr = [];
  if (Array.isArray(res)) arr = res;
  else if (res && typeof res === "object") {
    if (Array.isArray(res.list)) arr = res.list;
    else if (Array.isArray(res.manga)) arr = res.manga;
    else if (Array.isArray(res.mangas)) arr = res.mangas;
    else if (Array.isArray(res.mangaList)) arr = res.mangaList;
    else if (Array.isArray(res.results)) arr = res.results;
  }
  var out = [];
  for (var i = 0; i < arr.length; i++) { var m = __hyItem(arr[i]); if (m) out.push(m); }
  return out;
}

function __hyChapterNumber(name) {
  var m = /(?:chapter|ch|episode|ep)[\s._-]*([0-9]+(?:\.[0-9]+)?)/i.exec(String(name || ""));
  if (m) return m[1];
  var g = /([0-9]+(?:\.[0-9]+)?)\s*$/.exec(String(name || "").trim());
  return g ? g[1] : null;
}

function __hyToChapters(mmanga, lang) {
  var arr = mmanga && (mmanga.chapters || mmanga.episodes);
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var ch = arr[i];
    if (!ch || typeof ch !== "object") continue;
    var cu = ch.url || ch.link;
    if (!cu) continue;
    var cname = ch.name != null ? ch.name : ch.title;
    var grp = ch.scanlator != null ? ch.scanlator : ch.scanlators;
    var when = ch.dateUpload != null ? ch.dateUpload : ch.date;
    out.push({
      id: String(cu),
      chapter: __hyChapterNumber(cname),
      title: cname ? String(cname) : undefined,
      pages: 0,
      language: lang || "en",
      group: grp != null && grp !== "" ? String(grp) : undefined,
      publishAt: when != null ? String(when) : undefined,
    });
  }
  return out;
}

function __hyToPages(res) {
  var arr;
  if (Array.isArray(res)) arr = res;
  else if (res && typeof res === "object") {
    arr = Array.isArray(res.pages) ? res.pages : Array.isArray(res.list) ? res.list : [res];
  } else arr = [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    var u = typeof it === "string" ? it : it && (it.url || it.imageUrl || it.src || it.img || it.image);
    if (u) out.push(String(u));
  }
  return out;
}

function __hyFilters(ext, tagId) {
  if (!tagId) return [];
  var m = /^(\d+):(\d+)$/.exec(String(tagId));
  if (!m) return [];
  var fl;
  try { fl = ext.getFilterList(); } catch (e) { return []; }
  if (!Array.isArray(fl)) return [];
  var f = fl[+m[1]], vi = +m[2];
  if (!f) return fl;
  try {
    if (Array.isArray(f.state)) {
      for (var k = 0; k < f.state.length; k++) {
        if (f.state[k] && typeof f.state[k] === "object") f.state[k].state = k === vi;
      }
    } else { f.state = vi; }
  } catch (e2) {}
  return fl;
}

function __hyTags(ext) {
  var fl;
  try { fl = ext.getFilterList(); } catch (e) { return []; }
  if (!Array.isArray(fl)) return [];
  var out = [];
  for (var i = 0; i < fl.length && out.length < 400; i++) {
    var f = fl[i];
    var name = (f && (f.name || f.title)) || "Filter";
    var values = f && (f.values || f.state);
    if (!Array.isArray(values)) continue;
    for (var j = 0; j < values.length; j++) {
      var v = values[j];
      var label = typeof v === "string" ? v : v && (v.name || v.type || v.value);
      if (!label) continue;
      out.push({ id: i + ":" + j, name: String(label), group: String(name) });
    }
  }
  return out;
}

function __hyAdapt(ext, source) {
  __hyInitPrefs(ext);
  var pageSize = source && source.pageSize ? source.pageSize : 48;
  var lang = source && source.lang ? source.lang : "en";
  var cache = Object.create(null);
  function page(offset) { return Math.floor((Number(offset) || 0) / pageSize) + 1; }
  function detailOf(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    var d = typeof ext.getDetail === "function" ? ext.getDetail(id)
      : typeof ext.getMangaDetail === "function" ? ext.getMangaDetail(id)
      : {};
    return Promise.resolve(d).then(function (r) { cache[id] = r || {}; return cache[id]; });
  }
  var provider = {
    id: String(source.id),
    name: String(source.name),
    popular: function (offset, tagId) {
      var p;
      if (tagId) p = ext.search("", page(offset), __hyFilters(ext, tagId));
      else if (typeof ext.getPopular === "function") p = ext.getPopular(page(offset));
      else if (typeof ext.getLatestUpdates === "function") p = ext.getLatestUpdates(page(offset));
      else p = [];
      return Promise.resolve(p).then(__hyToList);
    },
    search: function (query, offset, tagId) {
      return Promise.resolve(ext.search(String(query || ""), page(offset), __hyFilters(ext, tagId))).then(__hyToList);
    },
    detail: function (id) {
      return detailOf(String(id)).then(function (d) {
        var base = __hyItem({ url: id, name: d.name || d.title, imageUrl: d.imageUrl || d.cover || d.thumbnailUrl });
        if (!base) base = { id: String(id), title: String(id) };
        base.description = d.description ? String(d.description) : undefined;
        var au = d.author != null && d.author !== "" ? d.author : d.artist;
        base.author = au != null && au !== "" ? String(au) : undefined;
        base.status = __hyStatus(d.status);
        if (d.year != null && isFinite(Number(d.year))) base.year = Number(d.year);
        if (d.altTitle) base.altTitle = String(d.altTitle);
        if (d.lastChapter != null && d.lastChapter !== "") base.lastChapter = String(d.lastChapter);
        if (d.contentRating) base.contentRating = String(d.contentRating);
        return base;
      });
    },
    chapters: function (id) {
      return detailOf(String(id)).then(function (d) { return __hyToChapters(d, lang); });
    },
    pageUrls: function (chapterId) {
      return Promise.resolve(ext.getPageList(String(chapterId))).then(__hyToPages);
    },
  };
  var hasFilters = false;
  try { hasFilters = Array.isArray(ext.getFilterList()) && ext.getFilterList().length > 0; } catch (e) { hasFilters = false; }
  if (hasFilters) provider.tags = function () { return Promise.resolve(__hyTags(ext)); };
  return provider;
}
`;
