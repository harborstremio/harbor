import 'mal_client.dart';

/// The connected user's MyAnimeList profile picture (`/users/@me` → `picture`),
/// or null when unavailable. Ported from web `mal/profile.ts fetchMalAvatar`.
/// Backs the "Use MyAnimeList avatar" setting.
Future<String?> fetchMalAvatar(MalClient client, String accessToken) async {
  try {
    final me = await client.get('/users/@me', accessToken: accessToken);
    final picture = me?['picture'];
    return picture is String && picture.isNotEmpty ? picture : null;
  } on MalApiError {
    return null;
  }
}
