import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';

/// End-to-end crypto for the phone → TV companion channel.
///
/// The one-time session token (32 random bytes) is delivered OUT-OF-BAND in the
/// on-screen QR's URL fragment — it never travels over the wire. Both sides
/// derive the SAME AES-256-GCM key from it with HKDF-SHA256, so the phone
/// (WebCrypto) can encrypt the URL/key and only the TV can decrypt it. An
/// on-path LAN attacker without the token sees only ciphertext and cannot forge
/// a payload (the GCM tag authenticates), which is what makes HTTP-over-LAN
/// safe here. The HKDF salt/info below MUST stay byte-identical to the phone
/// page's `deriveKey` call.
final List<int> kCompanionHkdfSalt = utf8.encode('harbor-companion/v1/salt');
final List<int> kCompanionHkdfInfo = utf8.encode(
  'harbor-companion/v1/aes-256-gcm',
);

/// Derives the shared AES-256-GCM key from the session [token]. HKDF-SHA256,
/// matching the phone page's WebCrypto `deriveKey`.
Future<SecretKey> companionKey(List<int> token) {
  final hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);
  return hkdf.deriveKey(
    secretKey: SecretKey(token),
    nonce: kCompanionHkdfSalt,
    info: kCompanionHkdfInfo,
  );
}

/// Decrypts a payload the phone produced: [iv] (12 bytes) followed by
/// [cipherAndTag] — the AES-GCM ciphertext with the 16-byte tag appended, as
/// WebCrypto's `encrypt` emits. Returns the plaintext, or null when the GCM tag
/// does not verify (tampered payload or wrong token) — the caller rejects null.
Future<String?> companionDecrypt({
  required SecretKey key,
  required List<int> iv,
  required List<int> cipherAndTag,
}) async {
  if (iv.length != 12 || cipherAndTag.length < 16) return null;
  final tag = cipherAndTag.sublist(cipherAndTag.length - 16);
  final cipher = cipherAndTag.sublist(0, cipherAndTag.length - 16);
  try {
    final clear = await AesGcm.with256bits().decrypt(
      SecretBox(cipher, nonce: iv, mac: Mac(tag)),
      secretKey: key,
    );
    return utf8.decode(clear);
  } catch (_) {
    return null; // authentication failed → reject
  }
}

/// Encrypts [value] the way the phone does — AES-256-GCM with a random 12-byte
/// IV, tag appended to the ciphertext. Used by the interop test and available
/// if the app ever needs to drive the channel itself. Returns `(iv, cipher+tag)`.
Future<(List<int>, List<int>)> companionEncrypt({
  required SecretKey key,
  required String value,
}) async {
  final box = await AesGcm.with256bits().encrypt(
    utf8.encode(value),
    secretKey: key,
  );
  return (box.nonce, [...box.cipherText, ...box.mac.bytes]);
}

/// 32 cryptographically-secure random bytes for a session token.
List<int> companionToken() {
  final rng = Random.secure();
  return List<int>.generate(32, (_) => rng.nextInt(256));
}

/// URL-safe base64 without padding (the QR fragment and the JSON body use this).
String companionB64(List<int> bytes) =>
    base64Url.encode(bytes).replaceAll('=', '');

/// Decodes URL-safe base64, tolerating missing padding.
List<int> companionUnb64(String s) {
  final pad = (4 - s.length % 4) % 4;
  return base64Url.decode(s + '=' * pad);
}
