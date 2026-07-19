import 'dart:convert';

import 'package:crypto/crypto.dart';

const String _salt = 'harbor-profile-v1';

/// The SHA-256 hex digest of the salted profile PIN — the value stored in
/// `Profile.passwordHash`. Ported from the web `hashProfilePassword` and kept
/// byte-for-byte identical (same salt, same `salt|pin` framing, lowercase hex)
/// so a PIN set on either client verifies on the other.
String hashProfilePassword(String password) =>
    sha256.convert(utf8.encode('$_salt|$password')).toString();

/// Whether [password] matches a stored [hash]. An empty hash never matches.
/// Ported from `verifyProfilePassword`.
bool verifyProfilePassword(String password, String hash) =>
    hash.isNotEmpty && hashProfilePassword(password) == hash;
