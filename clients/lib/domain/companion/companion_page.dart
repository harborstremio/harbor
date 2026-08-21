// GENERATED companion pairing page — do not hand-edit the crypto block.
//
// The ephemeral LAN server serves this self-contained page at GET '/'. The
// phone's browser opens the QR's real http URL, reads the token/kind/label from
// the URL fragment (never sent to the server), encrypts the typed value with the
// token (pure-JS HKDF-SHA256 + AES-256-GCM, byte-identical to companion_crypto
// and verified against Node's native crypto over 200 random vectors — WebCrypto's
// crypto.subtle is unavailable on a non-secure http LAN origin), and POSTs
// {iv, data} to /submit. The label is rendered via textContent and `kind` is
// whitelisted, so there is no XSS surface; the page is a static constant with no
// server-side interpolation.
//
// A "configure on your phone" variant carries an add-on setup URL in the `c`
// fragment param: the page then shows a link to the add-on's own setup page and
// asks the viewer to paste the resulting install link back (which returns to the
// TV to install). The setup href is set via setAttribute only after validating
// the scheme is http(s), so a hostile `c` cannot inject a javascript:/data: link.
const String companionPageHtml = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:,">
<title>Harbor</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: #0e1116; color: #e8eaed;
    font: 16px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; -webkit-text-size-adjust: 100%;
  }
  .card { width: 100%; max-width: 420px; }
  .brand { font-weight: 800; letter-spacing: .3px; color: #f0c674; font-size: 15px; margin-bottom: 18px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
  input {
    width: 100%; padding: 15px 16px; font-size: 17px; color: #e8eaed;
    background: #171b22; border: 1px solid #2a2f38; border-radius: 12px; outline: none;
  }
  input:focus { border-color: #f0c674; }
  button {
    width: 100%; margin-top: 12px; padding: 15px 16px; font-size: 16px; font-weight: 700;
    color: #0e1116; background: #f0c674; border: 0; border-radius: 12px;
  }
  button:disabled { opacity: .5; }
  .status { min-height: 20px; margin: 14px 0 0; font-size: 14px; color: #9aa0a6; }
  .status.ok { color: #8ac926; }
  .status.err { color: #ff6b6b; }
  .host { margin-top: 22px; font-size: 12px; color: #5f6672; }
  .setup {
    display: block; margin: 0 0 14px; padding: 14px 16px; box-sizing: border-box;
    font-size: 16px; font-weight: 600; text-align: center; text-decoration: none;
    color: #f0c674; background: transparent; border: 1px solid #f0c674;
    border-radius: 12px;
  }
  .intro { margin: 0 0 16px; font-size: 14px; line-height: 1.45; color: #9aa0a6; }
</style>
</head>
<body>
<main class="card">
  <div class="brand">HARBOR</div>
  <h1 id="label">Value</h1>
  <a id="setup" class="setup" target="_blank" rel="noopener noreferrer" hidden>Open the setup page</a>
  <p id="intro" class="intro" hidden></p>
  <form id="form" autocomplete="off">
    <input id="val" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type here">
    <button id="send" type="submit">Send to TV</button>
  </form>
  <p id="status" class="status"></p>
  <p class="host">Paired with <span id="host"></span></p>
</main>
<script>/*
 * Harbor phone -> TV companion channel crypto, pure JavaScript.
 *
 * Runs in a phone browser on a NON-secure http:// LAN origin, where
 * `crypto.subtle` is unavailable. Only `crypto.getRandomValues` is used (for the
 * 12-byte IV) — everything else is hand-rolled and self-contained.
 *
 * Byte-for-byte interoperable with the Dart `cryptography` package used by
 * lib/domain/companion/companion_crypto.dart:
 *   - HKDF-SHA256(ikm=token, salt=utf8('harbor-companion/v1/salt'),
 *                 info=utf8('harbor-companion/v1/aes-256-gcm'), length=32)
 *   - AES-256-GCM, 12-byte IV, 16-byte tag appended to the ciphertext.
 *
 * The wire payload is { iv: base64url(iv), data: base64url(cipher||tag) },
 * base64url = URL-safe (-, _) WITHOUT '=' padding (Dart companionB64/Unb64).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // SHA-256
  // ---------------------------------------------------------------------------
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  // Returns a 32-byte Uint8Array digest of the given Uint8Array message.
  function sha256(msg) {
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    var ml = msg.length;
    // Padded length: message + 0x80 + zeros + 8-byte length, multiple of 64.
    var withOne = ml + 1;
    var k = (56 - (withOne % 64) + 64) % 64;
    var total = withOne + k + 8;
    var buf = new Uint8Array(total);
    buf.set(msg, 0);
    buf[ml] = 0x80;
    // 64-bit big-endian bit length. Length in bytes < 2^53, so use float math
    // for the high word.
    var bitLenHi = Math.floor(ml / 0x20000000); // ml * 8 / 2^32
    var bitLenLo = (ml * 8) >>> 0;
    buf[total - 8] = (bitLenHi >>> 24) & 0xff;
    buf[total - 7] = (bitLenHi >>> 16) & 0xff;
    buf[total - 6] = (bitLenHi >>> 8) & 0xff;
    buf[total - 5] = bitLenHi & 0xff;
    buf[total - 4] = (bitLenLo >>> 24) & 0xff;
    buf[total - 3] = (bitLenLo >>> 16) & 0xff;
    buf[total - 2] = (bitLenLo >>> 8) & 0xff;
    buf[total - 1] = bitLenLo & 0xff;

    var w = new Uint32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + i * 4;
        w[i] =
          ((buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]) >>> 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
    }

    var out = new Uint8Array(32);
    var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (i = 0; i < 8; i++) {
      out[i * 4] = (hs[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
      out[i * 4 + 3] = hs[i] & 0xff;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // HMAC-SHA256
  // ---------------------------------------------------------------------------
  function hmacSha256(key, msg) {
    var blockSize = 64;
    var k = key;
    if (k.length > blockSize) k = sha256(k);
    var kPad = new Uint8Array(blockSize); // zero-padded to block size
    kPad.set(k, 0);

    var ipad = new Uint8Array(blockSize);
    var opad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      ipad[i] = kPad[i] ^ 0x36;
      opad[i] = kPad[i] ^ 0x5c;
    }

    var inner = new Uint8Array(blockSize + msg.length);
    inner.set(ipad, 0);
    inner.set(msg, blockSize);
    var innerHash = sha256(inner);

    var outer = new Uint8Array(blockSize + 32);
    outer.set(opad, 0);
    outer.set(innerHash, blockSize);
    return sha256(outer);
  }

  // ---------------------------------------------------------------------------
  // HKDF-SHA256 (RFC 5869)
  // ---------------------------------------------------------------------------
  function hkdfSha256(ikm, salt, info, length) {
    // Extract: if salt is empty, it defaults to hashLen zero bytes.
    var s = salt && salt.length ? salt : new Uint8Array(32);
    var prk = hmacSha256(s, ikm);

    // Expand.
    var out = new Uint8Array(length);
    var t = new Uint8Array(0);
    var generated = 0;
    var counter = 1;
    while (generated < length) {
      var input = new Uint8Array(t.length + info.length + 1);
      input.set(t, 0);
      input.set(info, t.length);
      input[t.length + info.length] = counter & 0xff;
      t = hmacSha256(prk, input);
      var take = Math.min(t.length, length - generated);
      out.set(t.subarray(0, take), generated);
      generated += take;
      counter++;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // AES-256 (block cipher core)
  // ---------------------------------------------------------------------------
  var SBOX = (function () {
    // Compute the AES S-box at load time (avoids a 256-entry literal).
    var sbox = new Uint8Array(256);
    var p = 1, q = 1;
    do {
      // multiply p by 3 in GF(2^8)
      p = p ^ ((p << 1) & 0xff) ^ ((p & 0x80) ? 0x1b : 0);
      // divide q by 3 (multiply by 0xf6)
      q ^= (q << 1) & 0xff;
      q ^= (q << 2) & 0xff;
      q ^= (q << 4) & 0xff;
      q ^= (q & 0x80) ? 0x09 : 0;
      var xformed = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^
        ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
      sbox[p] = (xformed ^ 0x63) & 0xff;
    } while (p !== 1);
    sbox[0] = 0x63;
    return sbox;
  })();

  var RCON = new Uint8Array([
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8,
    0xab, 0x4d,
  ]);

  // Key expansion for AES-256 (Nk=8, Nr=14) -> 60 words (240 bytes).
  function expandKey256(key) {
    var Nk = 8, Nr = 14;
    var w = new Uint8Array(4 * 4 * (Nr + 1)); // 240 bytes
    w.set(key.subarray(0, 32), 0);
    var bytesPerWord = 4;
    var temp = new Uint8Array(4);
    for (var i = Nk; i < 4 * (Nr + 1); i++) {
      var prev = (i - 1) * bytesPerWord;
      temp[0] = w[prev]; temp[1] = w[prev + 1];
      temp[2] = w[prev + 2]; temp[3] = w[prev + 3];
      if (i % Nk === 0) {
        // RotWord
        var t0 = temp[0];
        temp[0] = temp[1]; temp[1] = temp[2]; temp[2] = temp[3]; temp[3] = t0;
        // SubWord
        temp[0] = SBOX[temp[0]]; temp[1] = SBOX[temp[1]];
        temp[2] = SBOX[temp[2]]; temp[3] = SBOX[temp[3]];
        temp[0] ^= RCON[i / Nk - 1];
      } else if (i % Nk === 4) {
        // SubWord only (AES-256 extra step)
        temp[0] = SBOX[temp[0]]; temp[1] = SBOX[temp[1]];
        temp[2] = SBOX[temp[2]]; temp[3] = SBOX[temp[3]];
      }
      var cur = i * bytesPerWord;
      var back = (i - Nk) * bytesPerWord;
      w[cur] = w[back] ^ temp[0];
      w[cur + 1] = w[back + 1] ^ temp[1];
      w[cur + 2] = w[back + 2] ^ temp[2];
      w[cur + 3] = w[back + 3] ^ temp[3];
    }
    return w;
  }

  function xtime(x) {
    return ((x << 1) ^ ((x & 0x80) ? 0x1b : 0)) & 0xff;
  }

  // Encrypt a single 16-byte block in place-free fashion. `roundKeys` is the
  // 240-byte expanded key. Returns a new 16-byte Uint8Array.
  function encryptBlock(inBlock, roundKeys) {
    var Nr = 14;
    var s = new Uint8Array(16);
    s.set(inBlock);
    // AddRoundKey (round 0)
    for (var i = 0; i < 16; i++) s[i] ^= roundKeys[i];

    for (var round = 1; round < Nr; round++) {
      // SubBytes
      for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
      // ShiftRows (column-major state: byte at row r, col c => index c*4 + r)
      shiftRows(s);
      // MixColumns
      mixColumns(s);
      // AddRoundKey
      var rk = round * 16;
      for (i = 0; i < 16; i++) s[i] ^= roundKeys[rk + i];
    }
    // Final round (no MixColumns)
    for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    shiftRows(s);
    var frk = Nr * 16;
    for (i = 0; i < 16; i++) s[i] ^= roundKeys[frk + i];
    return s;
  }

  function shiftRows(s) {
    // State is column-major: index = col*4 + row. Shift row r left by r.
    var t;
    // row 1: shift left by 1 -> positions 1,5,9,13
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    // row 2: shift left by 2 -> positions 2,6,10,14
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    // row 3: shift left by 3 (= right by 1) -> positions 3,7,11,15
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
  }

  function mixColumns(s) {
    for (var c = 0; c < 4; c++) {
      var i = c * 4;
      var a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
      var t = a0 ^ a1 ^ a2 ^ a3;
      s[i] = (a0 ^ t ^ xtime(a0 ^ a1)) & 0xff;
      s[i + 1] = (a1 ^ t ^ xtime(a1 ^ a2)) & 0xff;
      s[i + 2] = (a2 ^ t ^ xtime(a2 ^ a3)) & 0xff;
      s[i + 3] = (a3 ^ t ^ xtime(a3 ^ a0)) & 0xff;
    }
  }

  // ---------------------------------------------------------------------------
  // AES-256-GCM
  // ---------------------------------------------------------------------------
  // GF(2^128) multiply per GCM (bit-reflected, R = 0xe1...).
  function ghashMul(X, Y) {
    var Z = new Uint8Array(16);
    var V = new Uint8Array(16);
    V.set(Y);
    for (var i = 0; i < 128; i++) {
      var bit = (X[i >> 3] >> (7 - (i & 7))) & 1;
      if (bit) {
        for (var j = 0; j < 16; j++) Z[j] ^= V[j];
      }
      var lsb = V[15] & 1;
      for (j = 15; j > 0; j--) {
        V[j] = ((V[j] >> 1) | ((V[j - 1] & 1) << 7)) & 0xff;
      }
      V[0] = V[0] >> 1;
      if (lsb) V[0] ^= 0xe1;
    }
    return Z;
  }

  function ghash(H, blocks) {
    // blocks: Uint8Array whose length is a multiple of 16.
    var Y = new Uint8Array(16);
    for (var off = 0; off < blocks.length; off += 16) {
      for (var j = 0; j < 16; j++) Y[j] ^= blocks[off + j];
      Y = ghashMul(Y, H);
    }
    return Y;
  }

  function inc32(block) {
    // Increment the rightmost 32 bits (mod 2^32) of a 16-byte counter.
    var out = new Uint8Array(16);
    out.set(block);
    for (var i = 15; i >= 12; i--) {
      out[i] = (out[i] + 1) & 0xff;
      if (out[i] !== 0) break;
    }
    return out;
  }

  // AES-256-GCM encrypt. key:32 bytes, iv:12 bytes, plaintext:Uint8Array,
  // aad optional. Returns { ciphertext, tag } (tag = 16 bytes).
  function aesGcmEncrypt(key, iv, plaintext, aad) {
    if (key.length !== 32) throw new Error('key must be 32 bytes');
    if (iv.length !== 12) throw new Error('iv must be 12 bytes');
    aad = aad || new Uint8Array(0);
    var roundKeys = expandKey256(key);

    // H = E(K, 0^128)
    var H = encryptBlock(new Uint8Array(16), roundKeys);

    // J0 = IV || 0x00000001 (12-byte IV case)
    var J0 = new Uint8Array(16);
    J0.set(iv, 0);
    J0[15] = 1;

    // GCTR over plaintext starting at inc32(J0)
    var ciphertext = new Uint8Array(plaintext.length);
    var counter = inc32(J0);
    for (var off = 0; off < plaintext.length; off += 16) {
      var ks = encryptBlock(counter, roundKeys);
      var n = Math.min(16, plaintext.length - off);
      for (var i = 0; i < n; i++) ciphertext[off + i] = plaintext[off + i] ^ ks[i];
      counter = inc32(counter);
    }

    // GHASH: A || 0-pad || C || 0-pad || [len(A)]_64 || [len(C)]_64
    var aadPad = (16 - (aad.length % 16)) % 16;
    var ctPad = (16 - (ciphertext.length % 16)) % 16;
    var ghashInput = new Uint8Array(
      aad.length + aadPad + ciphertext.length + ctPad + 16
    );
    var pos = 0;
    ghashInput.set(aad, pos); pos += aad.length + aadPad;
    ghashInput.set(ciphertext, pos); pos += ciphertext.length + ctPad;
    // length block: bit lengths, 64-bit big-endian each
    writeUint64BE(ghashInput, pos, aad.length * 8); pos += 8;
    writeUint64BE(ghashInput, pos, ciphertext.length * 8);

    var S = ghash(H, ghashInput);

    // Tag = E(K, J0) XOR S
    var eJ0 = encryptBlock(J0, roundKeys);
    var tag = new Uint8Array(16);
    for (i = 0; i < 16; i++) tag[i] = eJ0[i] ^ S[i];

    return { ciphertext: ciphertext, tag: tag };
  }

  function writeUint64BE(buf, offset, value) {
    // value < 2^53, so the top 21 bits are handled via float math.
    var hi = Math.floor(value / 0x100000000);
    var lo = value >>> 0;
    buf[offset] = (hi >>> 24) & 0xff;
    buf[offset + 1] = (hi >>> 16) & 0xff;
    buf[offset + 2] = (hi >>> 8) & 0xff;
    buf[offset + 3] = hi & 0xff;
    buf[offset + 4] = (lo >>> 24) & 0xff;
    buf[offset + 5] = (lo >>> 16) & 0xff;
    buf[offset + 6] = (lo >>> 8) & 0xff;
    buf[offset + 7] = lo & 0xff;
  }

  // ---------------------------------------------------------------------------
  // Encoding helpers
  // ---------------------------------------------------------------------------
  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    // Fallback UTF-8 encoder.
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(bytes);
  }

  var B64URL_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  // URL-safe base64 WITHOUT '=' padding (matches Dart companionB64).
  function base64UrlEncode(bytes) {
    var out = '';
    var i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64URL_ALPHABET[(n >> 18) & 63] + B64URL_ALPHABET[(n >> 12) & 63] +
        B64URL_ALPHABET[(n >> 6) & 63] + B64URL_ALPHABET[n & 63];
    }
    var rem = bytes.length - i;
    if (rem === 1) {
      var n1 = bytes[i] << 16;
      out += B64URL_ALPHABET[(n1 >> 18) & 63] + B64URL_ALPHABET[(n1 >> 12) & 63];
    } else if (rem === 2) {
      var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64URL_ALPHABET[(n2 >> 18) & 63] + B64URL_ALPHABET[(n2 >> 12) & 63] +
        B64URL_ALPHABET[(n2 >> 6) & 63];
    }
    return out;
  }

  function randomBytes(n) {
    var b = new Uint8Array(n);
    // getRandomValues is available on non-secure origins (unlike crypto.subtle).
    (root.crypto || root.msCrypto).getRandomValues(b);
    return b;
  }

  // ---------------------------------------------------------------------------
  // Companion key derivation + public API
  // ---------------------------------------------------------------------------
  var COMPANION_SALT = utf8Encode('harbor-companion/v1/salt');
  var COMPANION_INFO = utf8Encode('harbor-companion/v1/aes-256-gcm');

  // Derives the shared AES-256-GCM key from the 32-byte session token.
  function companionKey(tokenBytes) {
    return hkdfSha256(tokenBytes, COMPANION_SALT, COMPANION_INFO, 32);
  }

  /**
   * Encrypt `plaintext` for the TV using the session `tokenBytes` (Uint8Array,
   * 32 bytes from the QR fragment). Returns { iv, data } as URL-safe base64
   * strings WITHOUT padding — exactly the JSON body companion_server.dart wants.
   *
   * Async to mirror the WebCrypto-style contract; the work is synchronous.
   *
   * @param {Uint8Array} tokenBytes
   * @param {string} plaintext
   * @param {Uint8Array} [ivOverride] optional fixed 12-byte IV (for test vectors)
   * @returns {Promise<{iv: string, data: string}>}
   */
  function companionEncryptPayload(tokenBytes, plaintext, ivOverride) {
    return Promise.resolve().then(function () {
      var key = companionKey(tokenBytes);
      var iv = ivOverride || randomBytes(12);
      var pt = utf8Encode(plaintext);
      var res = aesGcmEncrypt(key, iv, pt);
      var cipherAndTag = new Uint8Array(res.ciphertext.length + 16);
      cipherAndTag.set(res.ciphertext, 0);
      cipherAndTag.set(res.tag, res.ciphertext.length);
      return {
        iv: base64UrlEncode(iv),
        data: base64UrlEncode(cipherAndTag),
      };
    });
  }

  var api = {
    sha256: sha256,
    hmacSha256: hmacSha256,
    hkdfSha256: hkdfSha256,
    aesGcmEncrypt: aesGcmEncrypt,
    companionKey: companionKey,
    companionEncryptPayload: companionEncryptPayload,
    base64UrlEncode: base64UrlEncode,
    utf8Encode: utf8Encode,
    COMPANION_SALT: COMPANION_SALT,
    COMPANION_INFO: COMPANION_INFO,
  };

  // Browser global + CommonJS (for the Node interop test).
  root.HarborCompanionCrypto = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : this);
</script>
<script>
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function b64urlToBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), a = new Uint8Array(bin.length), i = 0;
    for (; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function setStatus(msg, err) {
    var el = $('status');
    el.textContent = msg;
    el.className = err ? 'status err' : 'status ok';
  }
  var params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  var kind = params.get('k') || 'text';
  if (kind !== 'url' && kind !== 'key' && kind !== 'text') kind = 'text';
  var label = params.get('l') || 'Value';
  var token;
  try { token = b64urlToBytes(params.get('t') || ''); } catch (e) { token = new Uint8Array(0); }
  var ready = token.length === 32;

  $('label').textContent = label;          // textContent: never HTML
  $('host').textContent = location.host;
  var input = $('val');
  if (kind === 'url') { input.type = 'url'; input.setAttribute('inputmode', 'url'); }
  else { input.type = 'text'; }

  // "Configure on your phone": when a setup URL rides in the fragment, show a
  // link to the add-on's own setup page and ask the viewer to paste the install
  // link it produces back here (which returns to the TV to install). The href is
  // set via setAttribute only after validating the scheme is http(s), so a
  // hostile c= value cannot smuggle a javascript:/data: link into the page.
  var configure = params.get('c') || '';
  if (configure) {
    var okScheme = false;
    try {
      var u = new URL(configure);
      okScheme = (u.protocol === 'http:' || u.protocol === 'https:');
    } catch (e) { okScheme = false; }
    if (okScheme) {
      var setup = $('setup');
      setup.setAttribute('href', configure);   // validated http(s), not innerHTML
      setup.hidden = false;
      var intro = $('intro');
      intro.textContent = 'Open the setup page, finish configuring, then copy '
        + 'the install link it gives you and paste it below.';
      intro.hidden = false;
      input.type = 'url';
      input.setAttribute('inputmode', 'url');
      input.placeholder = 'Paste the install link';
      $('send').textContent = 'Install on TV';
    }
  }

  if (!ready) {
    setStatus('This pairing link is invalid or expired.', true);
    input.disabled = true;
    $('send').disabled = true;
  } else {
    setTimeout(function () { input.focus(); }, 60);
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!ready) return;
    var value = input.value.trim();
    if (!value) { setStatus('Type a value first.', true); return; }
    setStatus('Sending…', false);
    $('send').disabled = true;
    HarborCompanionCrypto.companionEncryptPayload(token, value).then(function (payload) {
      return fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }).then(function (res) {
      if (res.ok) { setStatus('Sent to your TV — you can close this.', false); input.disabled = true; }
      else { setStatus('The TV rejected it — try again.', true); $('send').disabled = false; }
    }).catch(function () {
      setStatus('Could not reach the TV — try again.', true);
      $('send').disabled = false;
    });
  });
})();
</script>
</body>
</html>
''';
