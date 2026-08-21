import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Animated avatars up to this size pass through untouched; larger ones are
/// flattened and downscaled. Ported from `MAX_ANIMATED_AVATAR_BYTES`.
const int kMaxAnimatedAvatarBytes = 2 * 1024 * 1024;

/// Resizes raw image [bytes] to fit within [maxDim] on the longest edge
/// (downscale only — a smaller image is never enlarged), preserving aspect,
/// and returns a base64 `data:` URI. An animated GIF within the size cap passes
/// through unchanged. Ported from the web `resizeAvatar`; native re-encodes to
/// JPEG (the `image` package ships no WebP encoder) rather than the web's WebP,
/// producing an equivalent data-URI avatar.
String resizeAvatar(Uint8List bytes, int maxDim, {bool isGif = false}) {
  if (isGif && bytes.length <= kMaxAnimatedAvatarBytes) {
    return 'data:image/gif;base64,${base64Encode(bytes)}';
  }
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    throw const FormatException('Unsupported avatar image data');
  }
  final ratio = [
    maxDim / decoded.width,
    maxDim / decoded.height,
    1.0,
  ].reduce((a, b) => a < b ? a : b);
  final resized = ratio < 1.0
      ? img.copyResize(
          decoded,
          width: (decoded.width * ratio).round().clamp(1, maxDim),
          height: (decoded.height * ratio).round().clamp(1, maxDim),
        )
      : decoded;
  final jpg = img.encodeJpg(resized, quality: 85);
  return 'data:image/jpeg;base64,${base64Encode(jpg)}';
}
