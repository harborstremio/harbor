import { DOM_PRELUDE } from "@/lib/manga/sources/mangayomi/prelude/dom";
import { CRYPTO_PRELUDE } from "@/lib/manga/sources/mangayomi/prelude/crypto";
import { PROVIDER_CHEERIO } from "./cheerio";

export const PRELUDE_VERSION = 2;

const PROVIDER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export const PROVIDER_PRELUDE = String.raw`
var __g = {};
globalThis = __g; window = __g; self = __g;
var global = __g;
var module = { exports: {} };
var exports = module.exports;
var SCRAPER_ID = __harborScraper.id;
var SCRAPER_SETTINGS = __harborScraper.settings || {};
var TMDB_API_KEY = "";
__g.SCRAPER_ID = SCRAPER_ID;
__g.SCRAPER_SETTINGS = SCRAPER_SETTINGS;
__g.TMDB_API_KEY = TMDB_API_KEY;
__g.module = module;
__g.exports = exports;
var navigator = { userAgent: ${JSON.stringify(PROVIDER_UA)}, language: "en-US", languages: ["en-US", "en"], onLine: true };
__g.navigator = navigator;

function __hpLog(level) {
  return function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a instanceof Error) parts.push(String(a.message || a));
      else if (typeof a === "object") { try { parts.push(JSON.stringify(a)); } catch (e) { parts.push(String(a)); } }
      else parts.push(String(a));
    }
    harbor.log(level + ": " + parts.join(" "));
  };
}
var console = { log: __hpLog("log"), info: __hpLog("info"), warn: __hpLog("warn"), error: __hpLog("error"), debug: __hpLog("debug"), trace: __hpLog("trace") };
__g.console = console;

function __hpBytes(b64) {
  var bin = atob(String(b64 || ""));
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function __hpHeadersObj(init) {
  var out = {};
  if (!init) return out;
  if (typeof init.forEach === "function" && !Array.isArray(init)) {
    init.forEach(function (v, k) { out[String(k)] = String(v); });
    return out;
  }
  if (Array.isArray(init)) {
    for (var i = 0; i < init.length; i++) if (init[i] && init[i].length >= 2) out[String(init[i][0])] = String(init[i][1]);
    return out;
  }
  if (typeof init === "object") for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k) && init[k] != null) out[k] = String(init[k]);
  return out;
}

function __hpHeaderGet(headers, name) {
  var n = String(name).toLowerCase();
  for (var k in headers) if (Object.prototype.hasOwnProperty.call(headers, k) && k.toLowerCase() === n) return headers[k];
  return null;
}

function __hpHeaders(raw) {
  var store = raw || {};
  return {
    __raw: store,
    get: function (name) { return __hpHeaderGet(store, name); },
    has: function (name) { return __hpHeaderGet(store, name) != null; },
    forEach: function (fn) { for (var k in store) if (Object.prototype.hasOwnProperty.call(store, k)) fn(store[k], k); },
    entries: function () { var out = []; for (var k in store) if (Object.prototype.hasOwnProperty.call(store, k)) out.push([k, store[k]]); return out; },
    keys: function () { return Object.keys(store); }
  };
}

function __hpBody(body, headers) {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    if (!__hpHeaderGet(headers, "content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
    return body.toString();
  }
  if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
    var bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  if (typeof body === "object") {
    var ct = __hpHeaderGet(headers, "content-type") || "";
    if (/x-www-form-urlencoded/i.test(ct)) return new URLSearchParams(body).toString();
    if (!ct) headers["Content-Type"] = "application/json";
    try { return JSON.stringify(body); } catch (e) { return String(body); }
  }
  return String(body);
}

function __hpResponse(res, url) {
  var bytes = null;
  var text = null;
  var raw = res && res.headers ? res.headers : {};
  var status = res && typeof res.status === "number" ? res.status : 0;
  function getBytes() { if (!bytes) bytes = __hpBytes(res && res.body); return bytes; }
  function getText() { if (text == null) text = new TextDecoder("utf-8").decode(getBytes()); return text; }
  var finalUrl = res && res.url ? String(res.url) : String(url);
  var out = {
    ok: status >= 200 && status < 300,
    status: status,
    statusText: status ? "" : "Network Error",
    url: finalUrl,
    redirected: finalUrl !== String(url),
    headers: __hpHeaders(raw),
    bodyUsed: false,
    text: function () { return Promise.resolve(getText()); },
    json: function () { var t = getText(); try { return Promise.resolve(JSON.parse(t)); } catch (e) { return Promise.resolve(null); } },
    arrayBuffer: function () { var b = getBytes(); return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); },
    bytes: function () { return Promise.resolve(getBytes()); },
    blob: function () { return Promise.resolve({ size: getBytes().length, type: __hpHeaderGet(raw, "content-type") || "" }); },
    clone: function () { return out; }
  };
  return out;
}

function __hpFailed(err, url) {
  var out = __hpResponse({ status: 0, headers: {}, body: "" }, url);
  out.statusText = String(err && err.message ? err.message : err || "Network Error");
  return out;
}

var fetch = function (input, init) {
  var url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
  init = init || {};
  var headers = __hpHeadersObj(init.headers);
  var body = __hpBody(init.body, headers);
  var method = (init.method || "GET").toUpperCase();
  return harbor.http(url, {
    method: method,
    headers: headers,
    body: body,
    responseType: "base64",
    redirect: init.redirect,
    timeoutMs: typeof init.timeoutMs === "number" ? init.timeoutMs : undefined
  }).then(function (res) {
    if (init.redirect === "error" && res && res.status >= 300 && res.status < 400) throw new TypeError("Failed to fetch");
    return __hpResponse(res, url);
  }, function (err) { return __hpFailed(err, url); });
};
__g.fetch = fetch;

function __hpAxiosError(message, config, response) {
  var e = new Error(message);
  e.isAxiosError = true;
  e.config = config;
  e.response = response || undefined;
  e.code = response ? "ERR_BAD_RESPONSE" : "ERR_NETWORK";
  e.toJSON = function () { return { message: message }; };
  return e;
}

function __hpAxiosRequest(defaults, cfg) {
  cfg = cfg || {};
  var merged = {};
  for (var k in defaults) if (Object.prototype.hasOwnProperty.call(defaults, k)) merged[k] = defaults[k];
  for (var k2 in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k2)) merged[k2] = cfg[k2];
  var headers = __hpHeadersObj(defaults.headers && defaults.headers.common);
  var dh = __hpHeadersObj(defaults.headers);
  for (var h in dh) if (h !== "common" && h !== "get" && h !== "post" && h !== "put" && h !== "delete" && h !== "patch" && h !== "head") headers[h] = dh[h];
  var ch = __hpHeadersObj(cfg.headers);
  for (var h2 in ch) headers[h2] = ch[h2];
  var url = String(merged.url || "");
  if (merged.baseURL && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = String(merged.baseURL).replace(/\/+$/, "") + "/" + url.replace(/^\/+/, "");
  }
  if (merged.params) {
    var qs = merged.params instanceof URLSearchParams ? merged.params.toString() : new URLSearchParams(merged.params).toString();
    if (qs) url += (url.indexOf("?") >= 0 ? "&" : "?") + qs;
  }
  var body = __hpBody(merged.data, headers);
  var method = (merged.method || "GET").toUpperCase();
  return fetch(url, { method: method, headers: headers, body: body, redirect: merged.maxRedirects === 0 ? "manual" : undefined, timeoutMs: merged.timeout }).then(function (res) {
    if (res.status === 0) throw __hpAxiosError(res.statusText || "Network Error", merged, null);
    return res.text().then(function (text) {
      var data = text;
      if (merged.responseType !== "text") { try { data = JSON.parse(text); } catch (e) { data = text; } }
      var response = { data: data, status: res.status, statusText: res.statusText, headers: res.headers.__raw, config: merged, request: {} };
      var valid = typeof merged.validateStatus === "function" ? merged.validateStatus(res.status) : res.ok;
      if (!valid) throw __hpAxiosError("Request failed with status code " + res.status, merged, response);
      return response;
    });
  });
}

function __hpMakeAxios(defaults) {
  defaults = defaults || {};
  var inst = function (cfgOrUrl, cfg) {
    if (typeof cfgOrUrl === "string") { cfg = cfg || {}; cfg.url = cfgOrUrl; return __hpAxiosRequest(defaults, cfg); }
    return __hpAxiosRequest(defaults, cfgOrUrl);
  };
  inst.request = function (cfg) { return __hpAxiosRequest(defaults, cfg); };
  var noBody = ["get", "delete", "head", "options"];
  for (var i = 0; i < noBody.length; i++) (function (m) {
    inst[m] = function (url, cfg) { cfg = cfg || {}; cfg.url = url; cfg.method = m; return __hpAxiosRequest(defaults, cfg); };
  })(noBody[i]);
  var withBody = ["post", "put", "patch"];
  for (var j = 0; j < withBody.length; j++) (function (m) {
    inst[m] = function (url, data, cfg) { cfg = cfg || {}; cfg.url = url; cfg.method = m; cfg.data = data; return __hpAxiosRequest(defaults, cfg); };
  })(withBody[j]);
  inst.defaults = defaults;
  inst.defaults.headers = inst.defaults.headers || { common: {} };
  inst.interceptors = { request: { use: function () {} }, response: { use: function () {} } };
  inst.create = function (d) { return __hpMakeAxios(d); };
  inst.isAxiosError = function (e) { return !!(e && e.isAxiosError); };
  inst.CancelToken = { source: function () { return { token: {}, cancel: function () {} }; } };
  return inst;
}
var axios = __hpMakeAxios({});
__g.axios = axios;

var Buffer = {
  from: function (value, enc) {
    var bytes;
    if (typeof value === "string") {
      enc = String(enc || "utf8").toLowerCase();
      if (enc === "base64") bytes = Array.prototype.slice.call(__hyB64ToBytes(value));
      else if (enc === "hex") bytes = __hyHexToBytes(value);
      else if (enc === "latin1" || enc === "binary" || enc === "ascii") bytes = __hyLatin1Bytes(value);
      else bytes = __hyUtf8Bytes(value);
    } else if (value instanceof Uint8Array) bytes = Array.prototype.slice.call(value);
    else if (value instanceof ArrayBuffer) bytes = Array.prototype.slice.call(new Uint8Array(value));
    else if (Array.isArray(value)) bytes = value.slice();
    else bytes = [];
    var u8 = Uint8Array.from(bytes);
    u8.toString = function (enc2) {
      enc2 = String(enc2 || "utf8").toLowerCase();
      var arr = Array.prototype.slice.call(this);
      if (enc2 === "base64") return __hyBytesToB64(arr);
      if (enc2 === "hex") return __hyBytesToHex(arr);
      if (enc2 === "latin1" || enc2 === "binary" || enc2 === "ascii") return __hyBytesToLatin1(arr);
      return __hyBytesToUtf8(arr);
    };
    return u8;
  },
  isBuffer: function (b) { return b instanceof Uint8Array; }
};
__g.Buffer = Buffer;

function require(name) {
  var n = String(name);
  if (n === "cheerio" || n === "cheerio-without-node-native" || n === "react-native-cheerio") return cheerio;
  if (n === "crypto-js") return CryptoJS;
  if (n === "axios") return axios;
  if (n === "node-fetch" || n === "cross-fetch" || n === "isomorphic-fetch") return fetch;
  if (n === "url") return { URL: URL, URLSearchParams: URLSearchParams };
  if (n === "buffer") return { Buffer: Buffer };
  if (n === "querystring") return { stringify: function (o) { return new URLSearchParams(o).toString(); }, parse: function (s) { var out = {}; new URLSearchParams(String(s)).forEach(function (v, k) { out[k] = v; }); return out; } };
  throw new Error("module not available: " + n);
}
__g.require = require;
`;

const INNER_EPILOGUE = String.raw`
;if (typeof getStreams === "function" && !(module.exports && module.exports.getStreams) && !globalThis.getStreams) globalThis.getStreams = getStreams;
if (typeof onSettings === "function" && !(module.exports && module.exports.onSettings) && !globalThis.onSettings) globalThis.onSettings = onSettings;
`;

export const PROVIDER_EPILOGUE = String.raw`
;(function () {
  var __params = ["module", "exports", "require", "global", "window", "self", "globalThis", "fetch", "axios", "CryptoJS", "cheerio", "console", "Buffer", "navigator", "SCRAPER_ID", "SCRAPER_SETTINGS", "TMDB_API_KEY", "Document", "DomElement"];
  var __factory = Function.apply(null, __params.concat(["(function () {\n" + __harborCode + "\n" + __harborInner + "\n}).call(this);"]));
  __factory.apply(__g, [module, exports, require, __g, __g, __g, __g, fetch, axios, CryptoJS, cheerio, console, Buffer, navigator, SCRAPER_ID, SCRAPER_SETTINGS, TMDB_API_KEY, Document, DomElement]);
  var __exp = module.exports;
  var __fn = (__exp && typeof __exp.getStreams === "function" ? __exp.getStreams : null)
    || (typeof __exp === "function" ? __exp : null)
    || (typeof __g.getStreams === "function" ? __g.getStreams : null);
  var __settings = (__exp && typeof __exp.onSettings === "function" ? __exp.onSettings : null)
    || (typeof __g.onSettings === "function" ? __g.onSettings : null);
  if (typeof __fn !== "function") throw new Error("not-stream-plugin");
  var __plugin = {
    id: __harborScraper.id,
    name: __harborScraper.name,
    streams: function (req) {
      var tmdb = req && req.tmdb ? String(req.tmdb.id) : "";
      var type = req && req.type === "series" ? "tv" : "movie";
      var season = req && req.season != null ? req.season : undefined;
      var episode = req && req.episode != null ? req.episode : undefined;
      return Promise.resolve(__fn(tmdb, type, season, episode));
    }
  };
  if (__settings) __plugin.settings = function () { return Promise.resolve(__settings()); };
  harbor.register(__plugin);
})();
`;

export function composeProviderSource(
  code: string,
  meta: { id: string; name: string; settings: Record<string, string | boolean> },
): string {
  return (
    DOM_PRELUDE +
    "\n" +
    CRYPTO_PRELUDE +
    "\nvar __harborScraper = " +
    JSON.stringify(meta) +
    ";\n" +
    PROVIDER_PRELUDE +
    "\n" +
    PROVIDER_CHEERIO +
    "\nvar __harborCode = " +
    JSON.stringify(code) +
    ";\nvar __harborInner = " +
    JSON.stringify(INNER_EPILOGUE) +
    ";\n" +
    PROVIDER_EPILOGUE
  );
}

export const HARBOR_NATIVE_PRELUDE = String.raw`
var __g = {};
globalThis = __g; window = __g; self = __g;
var global = __g;
function __hpLog(level) {
  return function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a instanceof Error) parts.push(String(a.message || a));
      else if (typeof a === "object") { try { parts.push(JSON.stringify(a)); } catch (e) { parts.push(String(a)); } }
      else parts.push(String(a));
    }
    harbor.log(level + ": " + parts.join(" "));
  };
}
var console = { log: __hpLog("log"), info: __hpLog("info"), warn: __hpLog("warn"), error: __hpLog("error"), debug: __hpLog("debug") };
`;

export function composeHarborSource(code: string): string {
  return HARBOR_NATIVE_PRELUDE + "\n" + code;
}
