import '../profiles/profile.dart';

/// A spoken profile command recognised from the voice pipeline. Not a web 1:1
/// port — a native voice affordance the app layers on top of voice search so a
/// remote/Siri/Assistant utterance can switch profiles hands-free.
sealed class VoiceProfileIntent {
  const VoiceProfileIntent();
}

/// "Who's watching" — show the profile picker.
class OpenPickerIntent extends VoiceProfileIntent {
  const OpenPickerIntent();
}

/// "Switch to {name}" — switch to [profile]. When [locked] the caller MUST route
/// through the picker's PIN gate: voice never bypasses a lock.
class SwitchProfileIntent extends VoiceProfileIntent {
  const SwitchProfileIntent(this.profile, {required this.locked});
  final Profile profile;
  final bool locked;
}

/// Whether a profile is credential-gated — a profile PIN, or a kid profile with
/// a parent PIN. Voice must never bypass either.
bool voiceProfileLocked(Profile p) {
  final pin = p.passwordHash;
  final parentPin = p.kid?.parentPinHash;
  return (pin != null && pin.isNotEmpty) ||
      (parentPin != null && parentPin.isNotEmpty);
}

const _pickerPhrases = {
  'whos watching',
  'who is watching',
  'switch profile',
  'switch profiles',
  'change profile',
  'change profiles',
  'switch account',
};

// Only clearly profile-directed verbs, so ordinary searches ("open range",
// "use of force") never trip the switch path. Longest prefixes first so
// "switch profile to X" isn't swallowed by "switch ".
const _switchPrefixes = [
  'switch profile to ',
  'change profile to ',
  'switch account to ',
  'switch to ',
  'watch as ',
  'log in as ',
  'sign in as ',
];

/// Resolves a spoken [phrase] to a [VoiceProfileIntent], or null when it isn't a
/// profile command (the caller then treats it as a normal search query).
VoiceProfileIntent? resolveVoiceProfileIntent(
  String phrase,
  List<Profile> profiles,
) {
  final norm = _normalize(phrase);
  if (norm.isEmpty) return null;

  if (_pickerPhrases.any((p) => norm == p || norm.contains(p))) {
    return const OpenPickerIntent();
  }

  final name = _extractTarget(norm);
  if (name == null || name.isEmpty) return null;
  final match = _matchProfile(profiles, name);
  if (match == null) return null;
  return SwitchProfileIntent(match, locked: voiceProfileLocked(match));
}

String _normalize(String phrase) => phrase
    .toLowerCase()
    .replaceAll("'", '')
    .replaceAll(RegExp(r'[^\p{L}\p{N} ]', unicode: true), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String? _extractTarget(String norm) {
  for (final prefix in _switchPrefixes) {
    if (norm.startsWith(prefix)) {
      final rest = norm
          .substring(prefix.length)
          .replaceAll(RegExp(r'(?: (?:profile|account))+$'), '')
          .trim();
      return rest.isEmpty ? null : rest;
    }
  }
  // "<name> profile" / "<name> account" with no leading verb.
  final trailing = RegExp(r'^(.+?) (?:profile|account)$').firstMatch(norm);
  return trailing?.group(1);
}

Profile? _matchProfile(List<Profile> profiles, String target) {
  for (final p in profiles) {
    if (p.name.toLowerCase() == target) return p;
  }
  // Fuzzy: the spoken target contains the profile name, or vice versa
  // ("the kids profile" → Kids). The longest such name wins.
  Profile? best;
  for (final p in profiles) {
    final n = p.name.toLowerCase();
    if (n.isEmpty) continue;
    if (target.contains(n) || n.contains(target)) {
      if (best == null || p.name.length > best.name.length) best = p;
    }
  }
  return best;
}
