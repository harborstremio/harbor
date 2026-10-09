export const CRYPTO_PRELUDE = String.raw`
function __hyMd5(input) {
  function rol(x, c) { return (x << c) | (x >>> (32 - c)); }
  function add(a, b) { return (a + b) & 0xffffffff; }
  function toBytes(str) {
    var utf8 = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i) & 0xff);
    return out;
  }
  var bytes = Array.isArray(input) ? input.slice() : toBytes(String(input));
  var origLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var __lenLo = origLen >>> 0, __lenHi = Math.floor(origLen / 4294967296);
  for (var l = 0; l < 4; l++) bytes.push((__lenLo >>> (8 * l)) & 0xff);
  for (var lh = 0; lh < 4; lh++) bytes.push((__lenHi >>> (8 * lh)) & 0xff);
  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = [];
  for (var ki = 0; ki < 64; ki++) K[ki] = Math.floor(Math.abs(Math.sin(ki + 1)) * 4294967296) & 0xffffffff;
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var off = 0; off < bytes.length; off += 64) {
    var M = [];
    for (var m = 0; m < 16; m++) {
      M[m] = bytes[off + m * 4] | (bytes[off + m * 4 + 1] << 8) |
        (bytes[off + m * 4 + 2] << 16) | (bytes[off + m * 4 + 3] << 24);
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var t = 0; t < 64; t++) {
      var F, gIdx;
      if (t < 16) { F = (B & C) | (~B & D); gIdx = t; }
      else if (t < 32) { F = (D & B) | (~D & C); gIdx = (5 * t + 1) % 16; }
      else if (t < 48) { F = B ^ C ^ D; gIdx = (3 * t + 5) % 16; }
      else { F = C ^ (B | ~D); gIdx = (7 * t) % 16; }
      F = add(add(add(F, A), K[t]), M[gIdx]);
      A = D; D = C; C = B; B = add(B, rol(F, S[t]));
    }
    a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
  }
  function hex(v) {
    var s = "";
    for (var i = 0; i < 4; i++) s += ("0" + ((v >>> (i * 8)) & 0xff).toString(16)).slice(-2);
    return s;
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function __hyMd5Bytes(bytes) {
  var hex = __hyMd5(bytes), out = [];
  for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

function __hyEvpKdf(pass, salt, keyLen, ivLen) {
  var passBytes = [], utf8 = unescape(encodeURIComponent(String(pass)));
  for (var i = 0; i < utf8.length; i++) passBytes.push(utf8.charCodeAt(i) & 0xff);
  var derived = [], block = [];
  while (derived.length < keyLen + ivLen) {
    var input = block.concat(passBytes).concat(salt);
    block = __hyMd5Bytes(input);
    derived = derived.concat(block);
  }
  return { key: derived.slice(0, keyLen), iv: derived.slice(keyLen, keyLen + ivLen) };
}

function __hyU8(arr) { return new Uint8Array(arr); }
function __hyB64ToBytes(b64) {
  var bin = atob(String(b64)), out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function __hyBytesToB64(bytes) {
  var bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function cryptoHandler(text, iv, secretKeyString, encrypt) {
  var keyBytes = typeof secretKeyString === "string" ? __hyUtf8Bytes(secretKeyString) : __hyToArr(secretKeyString);
  var ivBytes = typeof iv === "string" ? __hyUtf8Bytes(iv) : __hyToArr(iv);
  if (encrypt) {
    var ct = __hyAesCrypt(true, __hyUtf8Bytes(String(text)), keyBytes, ivBytes, "CBC", "Pkcs7");
    return __hyBytesToB64(ct);
  }
  var pt = __hyAesCrypt(false, __hyB64ToBytes(String(text)), keyBytes, ivBytes, "CBC", "Pkcs7");
  return __hyBytesToUtf8(pt);
}

function decryptAESCryptoJS(encrypted, passphrase) {
  var data = __hyB64ToBytes(encrypted);
  if (String.fromCharCode(data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7]) !== "Salted__") {
    return Promise.reject(new Error("unsupported ciphertext"));
  }
  var salt = Array.prototype.slice.call(data.slice(8, 16));
  var body = data.slice(16);
  var kdf = __hyEvpKdf(passphrase, salt, 32, 16);
  return crypto.subtle.importKey("raw", __hyU8(kdf.key), { name: "AES-CBC" }, false, ["decrypt"]).then(function (key) {
    return crypto.subtle.decrypt({ name: "AES-CBC", iv: __hyU8(kdf.iv) }, key, body).then(function (buf) {
      return new TextDecoder().decode(buf);
    });
  });
}

function encryptAESCryptoJS(plainText, passphrase) {
  var salt = crypto.getRandomValues(new Uint8Array(8));
  var kdf = __hyEvpKdf(passphrase, Array.prototype.slice.call(salt), 32, 16);
  return crypto.subtle.importKey("raw", __hyU8(kdf.key), { name: "AES-CBC" }, false, ["encrypt"]).then(function (key) {
    return crypto.subtle.encrypt({ name: "AES-CBC", iv: __hyU8(kdf.iv) }, key, new TextEncoder().encode(String(plainText))).then(function (buf) {
      var body = new Uint8Array(buf), head = [83, 97, 108, 116, 101, 100, 95, 95];
      var full = head.concat(Array.prototype.slice.call(salt)).concat(Array.prototype.slice.call(body));
      return __hyBytesToB64(full);
    });
  });
}

function unpackJs(code) {
  var m = /\}\s*\(\s*'(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\s*\.split\('\|'\)/s.exec(String(code));
  if (!m) return String(code);
  var payload = m[1], radix = parseInt(m[2], 10), count = parseInt(m[3], 10);
  var dict = m[4].split("|");
  function enc(n) {
    var s = n < radix ? "" : enc(Math.floor(n / radix));
    n = n % radix;
    return s + (n > 35 ? String.fromCharCode(n + 29) : n.toString(36));
  }
  var map = {};
  for (var i = count - 1; i >= 0; i--) { var k = enc(i); map[k] = dict[i] && dict[i].length ? dict[i] : k; }
  return payload.replace(/\b\w+\b/g, function (w) { return map[w] != null ? map[w] : w; })
    .replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function deobfuscateJsPassword(inputString) {
  var parts = String(inputString).split(/[^0-9]+/).filter(Boolean), out = "";
  for (var i = 0; i < parts.length; i++) {
    var code = parseInt(parts[i], 10);
    if (isFinite(code) && code > 0) out += String.fromCharCode(code);
  }
  return out;
}

function __hyToArr(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x.slice();
  if (x instanceof Uint8Array) return Array.prototype.slice.call(x);
  if (x.__hyBytes) return x.__hyBytes.slice();
  if (typeof x === "string") return __hyUtf8Bytes(x);
  if (typeof x.length === "number") return Array.prototype.slice.call(x);
  return [];
}
function __hyUtf8Bytes(str) {
  var u = unescape(encodeURIComponent(String(str))), out = [];
  for (var i = 0; i < u.length; i++) out.push(u.charCodeAt(i) & 0xff);
  return out;
}
function __hyBytesToUtf8(bytes) {
  var a = __hyToArr(bytes), s = "";
  for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i] & 0xff);
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}
function __hyLatin1Bytes(str) {
  var s = String(str), out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}
function __hyBytesToLatin1(bytes) {
  var a = __hyToArr(bytes), s = "";
  for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i] & 0xff);
  return s;
}
function __hyBytesToHex(bytes) {
  var a = __hyToArr(bytes), s = "";
  for (var i = 0; i < a.length; i++) { var h = (a[i] & 0xff).toString(16); s += h.length < 2 ? "0" + h : h; }
  return s;
}
function __hyHexToBytes(hex) {
  var s = String(hex).replace(/[^0-9a-fA-F]/g, ""), out = [];
  for (var i = 0; i + 2 <= s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
  return out;
}
function __hyB64UrlToBytes(str) {
  var s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Array.prototype.slice.call(__hyB64ToBytes(s));
}
function __hyBytesToB64Url(bytes) {
  return __hyBytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function __hyWordsToBytes(words) {
  var out = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    out.push((w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff);
  }
  return out;
}
function __hyWordsToBytesN(words, sigBytes) {
  var all = __hyWordsToBytes(words);
  return all.slice(0, typeof sigBytes === "number" ? sigBytes : all.length);
}
function __hyBytesToWords(bytesIn) {
  var b = __hyToArr(bytesIn), words = [];
  for (var i = 0; i < b.length; i += 4) {
    words.push((((b[i] || 0) << 24) | ((b[i + 1] || 0) << 16) | ((b[i + 2] || 0) << 8) | (b[i + 3] || 0)) >>> 0);
  }
  return words;
}
function __hyRandBytes(n) {
  var out = new Array(n), i;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    var u = new Uint8Array(n); crypto.getRandomValues(u);
    for (i = 0; i < n; i++) out[i] = u[i];
  } else { for (i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256); }
  return out;
}

var __hyAes = null;
function __hyAesTables() {
  if (__hyAes) return __hyAes;
  var sbox = new Array(256), inv = new Array(256);
  var logt = new Array(256), expt = new Array(256);
  var x = 1, i;
  for (i = 0; i < 255; i++) {
    expt[i] = x; logt[x] = i;
    var xt = (x << 1) ^ ((x & 0x80) ? 0x11b : 0);
    x = (x ^ xt) & 0xff;
  }
  function rotl8(v, n) { return ((v << n) | (v >>> (8 - n))) & 0xff; }
  function inverse(a) { return a === 0 ? 0 : expt[(255 - logt[a]) % 255]; }
  for (i = 0; i < 256; i++) {
    var b = inverse(i);
    var s = (b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63) & 0xff;
    sbox[i] = s; inv[s] = i;
  }
  function mul(a, c) { return (a === 0 || c === 0) ? 0 : expt[(logt[a] + logt[c]) % 255]; }
  __hyAes = { sbox: sbox, inv: inv, mul: mul };
  return __hyAes;
}

var __hyRcon = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];
function __hyKeyExpand(key) {
  var sbox = __hyAesTables().sbox;
  var Nk = key.length >>> 2, Nr = Nk + 6, w = [], i;
  for (i = 0; i < Nk; i++) {
    w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
  }
  for (i = Nk; i < 4 * (Nr + 1); i++) {
    var t = w[i - 1];
    if (i % Nk === 0) {
      t = ((t << 8) | (t >>> 24)) >>> 0;
      t = ((sbox[(t >>> 24) & 0xff] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff]) >>> 0;
      t = (t ^ (__hyRcon[i / Nk] << 24)) >>> 0;
    } else if (Nk > 6 && (i % Nk) === 4) {
      t = ((sbox[(t >>> 24) & 0xff] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff]) >>> 0;
    }
    w[i] = (w[i - Nk] ^ t) >>> 0;
  }
  return { w: w, Nr: Nr };
}
function __hyAddRK(s, w, round) {
  for (var c = 0; c < 4; c++) {
    var word = w[round * 4 + c];
    s[4 * c] ^= (word >>> 24) & 0xff;
    s[4 * c + 1] ^= (word >>> 16) & 0xff;
    s[4 * c + 2] ^= (word >>> 8) & 0xff;
    s[4 * c + 3] ^= word & 0xff;
  }
}
function __hySub(s, sbox) { for (var i = 0; i < 16; i++) s[i] = sbox[s[i]]; }
function __hyInvSub(s, inv) { for (var i = 0; i < 16; i++) s[i] = inv[s[i]]; }
function __hyShift(s) {
  var t;
  t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}
function __hyInvShift(s) {
  var t;
  t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}
function __hyMix(s, mul) {
  for (var c = 0; c < 4; c++) {
    var i = 4 * c, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i] = mul(a0, 2) ^ mul(a1, 3) ^ a2 ^ a3;
    s[i + 1] = a0 ^ mul(a1, 2) ^ mul(a2, 3) ^ a3;
    s[i + 2] = a0 ^ a1 ^ mul(a2, 2) ^ mul(a3, 3);
    s[i + 3] = mul(a0, 3) ^ a1 ^ a2 ^ mul(a3, 2);
  }
}
function __hyInvMix(s, mul) {
  for (var c = 0; c < 4; c++) {
    var i = 4 * c, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
    s[i + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
    s[i + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
    s[i + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
  }
}
function __hyAesEncBlock(inb, ks) {
  var T = __hyAesTables(), w = ks.w, Nr = ks.Nr, s = inb.slice(0, 16), round;
  __hyAddRK(s, w, 0);
  for (round = 1; round < Nr; round++) { __hySub(s, T.sbox); __hyShift(s); __hyMix(s, T.mul); __hyAddRK(s, w, round); }
  __hySub(s, T.sbox); __hyShift(s); __hyAddRK(s, w, Nr);
  return s;
}
function __hyAesDecBlock(inb, ks) {
  var T = __hyAesTables(), w = ks.w, Nr = ks.Nr, s = inb.slice(0, 16), round;
  __hyAddRK(s, w, Nr);
  for (round = Nr - 1; round >= 1; round--) { __hyInvShift(s); __hyInvSub(s, T.inv); __hyAddRK(s, w, round); __hyInvMix(s, T.mul); }
  __hyInvShift(s); __hyInvSub(s, T.inv); __hyAddRK(s, w, 0);
  return s;
}
function __hyPkcs7Pad(bytes) {
  var pad = 16 - (bytes.length % 16); if (pad === 0) pad = 16;
  var out = bytes.slice();
  for (var i = 0; i < pad; i++) out.push(pad);
  return out;
}
function __hyPkcs7Unpad(bytes) {
  if (!bytes.length) return bytes;
  var pad = bytes[bytes.length - 1];
  if (pad < 1 || pad > 16 || pad > bytes.length) return bytes;
  for (var i = bytes.length - pad; i < bytes.length; i++) if (bytes[i] !== pad) return bytes;
  return bytes.slice(0, bytes.length - pad);
}
function __hyZeroPad(bytes) {
  var out = bytes.slice();
  while (out.length % 16 !== 0) out.push(0);
  return out;
}
function __hyZeroUnpad(bytes) {
  var end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.slice(0, end);
}
function __hyAesCrypt(encrypt, dataBytes, keyBytes, ivBytes, mode, pad) {
  var ks = __hyKeyExpand(__hyToArr(keyBytes));
  var data = __hyToArr(dataBytes);
  var iv = ivBytes ? __hyToArr(ivBytes) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var ecb = mode === "ECB";
  var out = [], i, j, block, prev = iv.slice(0, 16);
  while (prev.length < 16) prev.push(0);
  if (encrypt) {
    var src = pad === "NoPadding" || pad === "ZeroPadding" ? __hyZeroPad(data) : __hyPkcs7Pad(data);
    for (i = 0; i < src.length; i += 16) {
      block = src.slice(i, i + 16);
      if (!ecb) for (j = 0; j < 16; j++) block[j] ^= prev[j];
      var enc = __hyAesEncBlock(block, ks);
      for (j = 0; j < 16; j++) out.push(enc[j]);
      prev = enc;
    }
    return out;
  }
  for (i = 0; i + 16 <= data.length; i += 16) {
    block = data.slice(i, i + 16);
    var dec = __hyAesDecBlock(block, ks);
    if (!ecb) { for (j = 0; j < 16; j++) dec[j] ^= prev[j]; prev = block; }
    for (j = 0; j < 16; j++) out.push(dec[j]);
  }
  if (pad === "NoPadding") return out;
  if (pad === "ZeroPadding") return __hyZeroUnpad(out);
  return __hyPkcs7Unpad(out);
}

function __hySha1Bytes(msgBytes) {
  var bytes = __hyToArr(msgBytes), ml = bytes.length * 8, i;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(ml / 4294967296);
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((ml >>> 24) & 0xff, (ml >>> 16) & 0xff, (ml >>> 8) & 0xff, ml & 0xff);
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  var w = new Array(80), off;
  for (off = 0; off < bytes.length; off += 64) {
    for (i = 0; i < 16; i++) w[i] = ((bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]) >>> 0;
    for (i = 16; i < 80; i++) { var v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = ((v << 1) | (v >>> 31)) >>> 0; }
    var a = h0, b = h1, c = h2, d = h3, e = h4, f, k;
    for (i = 0; i < 80; i++) {
      if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      var tmp = ((((a << 5) | (a >>> 27)) >>> 0) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = tmp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return __hyWordsToBytes([h0, h1, h2, h3, h4]);
}
function __hyRor(v, n) { return ((v >>> n) | (v << (32 - n))) >>> 0; }
var __hySha256K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function __hySha256Bytes(msgBytes) {
  var bytes = __hyToArr(msgBytes), ml = bytes.length * 8, i;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(ml / 4294967296);
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((ml >>> 24) & 0xff, (ml >>> 16) & 0xff, (ml >>> 8) & 0xff, ml & 0xff);
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var w = new Array(64), K = __hySha256K, off;
  for (off = 0; off < bytes.length; off += 64) {
    for (i = 0; i < 16; i++) w[i] = ((bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]) >>> 0;
    for (i = 16; i < 64; i++) {
      var s0 = __hyRor(w[i - 15], 7) ^ __hyRor(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = __hyRor(w[i - 2], 17) ^ __hyRor(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (((w[i - 16] + s0) >>> 0) + ((w[i - 7] + s1) >>> 0)) >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (i = 0; i < 64; i++) {
      var S1 = __hyRor(e, 6) ^ __hyRor(e, 11) ^ __hyRor(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var t1 = (((hh + S1) >>> 0) + ((ch + K[i]) >>> 0) + w[i]) >>> 0;
      var S0 = __hyRor(a, 2) ^ __hyRor(a, 13) ^ __hyRor(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return __hyWordsToBytes(h);
}
function __hyHmac(hashBytesFn, blockSize, keyBytes, msgBytes) {
  var key = __hyToArr(keyBytes);
  if (key.length > blockSize) key = hashBytesFn(key);
  while (key.length < blockSize) key.push(0);
  var ipad = [], opad = [], i;
  for (i = 0; i < blockSize; i++) { ipad.push(key[i] ^ 0x36); opad.push(key[i] ^ 0x5c); }
  var inner = hashBytesFn(ipad.concat(__hyToArr(msgBytes)));
  return hashBytesFn(opad.concat(inner));
}

function __hyMsgBytes(m) {
  if (m == null) return [];
  if (typeof m === "string") return __hyUtf8Bytes(m);
  if (m.__hyBytes) return m.__hyBytes.slice();
  if (m.words && typeof m.sigBytes === "number") return __hyWordsToBytesN(m.words, m.sigBytes);
  return __hyToArr(m);
}
function __hyWAtoBytes(x) {
  if (x == null) return [];
  if (x.__hyBytes) return x.__hyBytes.slice();
  if (x.ciphertext) return __hyWAtoBytes(x.ciphertext);
  if (x.words && typeof x.sigBytes === "number") return __hyWordsToBytesN(x.words, x.sigBytes);
  if (x instanceof Uint8Array) return Array.prototype.slice.call(x);
  if (Array.isArray(x)) return x.slice();
  if (typeof x === "string") return __hyUtf8Bytes(x);
  return __hyToArr(x);
}
function __hyCipherInputBytes(message) {
  if (message == null) return [];
  if (message.ciphertext) return __hyWAtoBytes(message.ciphertext);
  if (message.__hyBytes) return message.__hyBytes.slice();
  if (message.words && typeof message.sigBytes === "number") return __hyWordsToBytesN(message.words, message.sigBytes);
  if (typeof message === "string") return Array.prototype.slice.call(__hyB64ToBytes(message));
  return __hyToArr(message);
}
function __hyIsSalted(b) {
  return b.length >= 8 && b[0] === 0x53 && b[1] === 0x61 && b[2] === 0x6c && b[3] === 0x74 && b[4] === 0x65 && b[5] === 0x64 && b[6] === 0x5f && b[7] === 0x5f;
}
function __hyWA(bytesIn) {
  var bytes = __hyToArr(bytesIn);
  var wa = { __hyBytes: bytes, sigBytes: bytes.length, words: __hyBytesToWords(bytes) };
  wa.toString = function (enc) {
    if (enc && enc.stringify) return enc.stringify(this);
    return __hyBytesToHex(this.__hyBytes);
  };
  wa.concat = function (other) {
    this.__hyBytes = this.__hyBytes.concat(__hyWAtoBytes(other));
    this.sigBytes = this.__hyBytes.length;
    this.words = __hyBytesToWords(this.__hyBytes);
    return this;
  };
  wa.clone = function () { return __hyWA(this.__hyBytes.slice()); };
  return wa;
}
function __hyWACreate(a, sig) {
  if (a == null) return __hyWA([]);
  if (a instanceof Uint8Array) return __hyWA(Array.prototype.slice.call(a));
  if (typeof ArrayBuffer !== "undefined" && a instanceof ArrayBuffer) return __hyWA(Array.prototype.slice.call(new Uint8Array(a)));
  if (a.__hyBytes) return __hyWA(a.__hyBytes.slice());
  if (Array.isArray(a)) {
    var sb = typeof sig === "number" ? sig : a.length * 4;
    return __hyWA(__hyWordsToBytesN(a, sb));
  }
  return __hyWA(__hyToArr(a));
}
function __hyCipherParams(ctBytes, salt) {
  var cp = { ciphertext: __hyWA(ctBytes), salt: salt ? __hyWA(salt) : undefined };
  cp.toString = function () {
    var ct = __hyWAtoBytes(this.ciphertext);
    if (this.salt) {
      var full = [0x53, 0x61, 0x6c, 0x74, 0x65, 0x64, 0x5f, 0x5f].concat(__hyWAtoBytes(this.salt)).concat(ct);
      return __hyBytesToB64(full);
    }
    return __hyBytesToB64(ct);
  };
  return cp;
}
function __hyCryptoJsCipher(encrypt, message, key, cfg) {
  cfg = cfg || {};
  var mode = cfg.mode && cfg.mode.__hyMode ? cfg.mode.__hyMode : "CBC";
  var pad = cfg.padding && cfg.padding.__hyPad ? cfg.padding.__hyPad : "Pkcs7";
  if (typeof key === "string") {
    if (encrypt) {
      var salt = __hyRandBytes(8);
      var kdf = __hyEvpKdf(key, salt, 32, 16);
      var ct = __hyAesCrypt(true, __hyMsgBytes(message), kdf.key, kdf.iv, "CBC", pad);
      return __hyCipherParams(ct, salt);
    }
    var data = __hyCipherInputBytes(message), csalt = null, body = data;
    if (message && message.salt) { csalt = __hyWAtoBytes(message.salt); }
    else if (__hyIsSalted(data)) { csalt = data.slice(8, 16); body = data.slice(16); }
    var kdf2 = __hyEvpKdf(key, csalt || [], 32, 16);
    return __hyWA(__hyAesCrypt(false, body, kdf2.key, kdf2.iv, "CBC", pad));
  }
  var keyBytes = __hyWAtoBytes(key);
  var ivBytes = cfg.iv ? __hyWAtoBytes(cfg.iv) : null;
  if (encrypt) {
    return __hyCipherParams(__hyAesCrypt(true, __hyMsgBytes(message), keyBytes, ivBytes, mode, pad), null);
  }
  return __hyWA(__hyAesCrypt(false, __hyCipherInputBytes(message), keyBytes, ivBytes, mode, pad));
}

var __hyEncHex = { parse: function (str) { return __hyWA(__hyHexToBytes(str)); }, stringify: function (wa) { return __hyBytesToHex(__hyWAtoBytes(wa)); } };
var __hyEncUtf8 = { parse: function (str) { return __hyWA(__hyUtf8Bytes(str)); }, stringify: function (wa) { return __hyBytesToUtf8(__hyWAtoBytes(wa)); } };
var __hyEncLatin1 = { parse: function (str) { return __hyWA(__hyLatin1Bytes(str)); }, stringify: function (wa) { return __hyBytesToLatin1(__hyWAtoBytes(wa)); } };
var __hyEncB64 = { parse: function (str) { return __hyWA(Array.prototype.slice.call(__hyB64ToBytes(str))); }, stringify: function (wa) { return __hyBytesToB64(__hyWAtoBytes(wa)); } };
var __hyEncB64url = { parse: function (str) { return __hyWA(__hyB64UrlToBytes(str)); }, stringify: function (wa) { return __hyBytesToB64Url(__hyWAtoBytes(wa)); } };

var CryptoJS = {
  lib: {
    WordArray: { create: function (a, sig) { return __hyWACreate(a, sig); } },
    CipherParams: { create: function (o) { o = o || {}; return __hyCipherParams(__hyWAtoBytes(o.ciphertext || []), o.salt ? __hyWAtoBytes(o.salt) : null); } }
  },
  enc: { Hex: __hyEncHex, Utf8: __hyEncUtf8, Latin1: __hyEncLatin1, Base64: __hyEncB64, Base64url: __hyEncB64url },
  mode: { CBC: { __hyMode: "CBC" }, ECB: { __hyMode: "ECB" } },
  pad: { Pkcs7: { __hyPad: "Pkcs7" }, NoPadding: { __hyPad: "NoPadding" }, ZeroPadding: { __hyPad: "ZeroPadding" } },
  AES: {
    encrypt: function (message, key, cfg) { return __hyCryptoJsCipher(true, message, key, cfg); },
    decrypt: function (ciphertext, key, cfg) { return __hyCryptoJsCipher(false, ciphertext, key, cfg); }
  },
  MD5: function (m) { return __hyWA(__hyMd5Bytes(__hyMsgBytes(m))); },
  SHA1: function (m) { return __hyWA(__hySha1Bytes(__hyMsgBytes(m))); },
  SHA256: function (m) { return __hyWA(__hySha256Bytes(__hyMsgBytes(m))); },
  HmacMD5: function (m, k) { return __hyWA(__hyHmac(__hyMd5Bytes, 64, __hyMsgBytes(k), __hyMsgBytes(m))); },
  HmacSHA1: function (m, k) { return __hyWA(__hyHmac(__hySha1Bytes, 64, __hyMsgBytes(k), __hyMsgBytes(m))); },
  HmacSHA256: function (m, k) { return __hyWA(__hyHmac(__hySha256Bytes, 64, __hyMsgBytes(k), __hyMsgBytes(m))); }
};

function __hySha256Hex(input) { return __hyBytesToHex(__hySha256Bytes(__hyMsgBytes(input))); }
function __hySha1Hex(input) { return __hyBytesToHex(__hySha1Bytes(__hyMsgBytes(input))); }
`;
