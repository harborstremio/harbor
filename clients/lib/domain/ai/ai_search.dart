import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import 'ai_models.dart';

const String _openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const String _groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
const int _maxSuggestions = 12;

/// A title the AI proposed, before it is resolved against the catalog.
class AiSuggestion {
  const AiSuggestion({
    required this.title,
    this.year,
    this.type,
    this.season,
    this.episode,
    this.episodeTitle,
  });

  final String title;
  final int? year;

  /// `movie` or `series`, when the AI committed to one.
  final String? type;
  final int? season;
  final int? episode;
  final String? episodeTitle;
}

/// A resolved AI suggestion: the matched catalog title plus an optional exact
/// episode when the query targeted one.
class AiResult {
  const AiResult({
    required this.meta,
    this.season,
    this.episode,
    this.episodeTitle,
  });

  final MetaPreview meta;
  final int? season;
  final int? episode;
  final String? episodeTitle;
}

/// The system prompt that constrains the model to a JSON array of real titles,
/// ported verbatim from the web `SYSTEM_PROMPT`.
const String kAiSystemPrompt =
    'You are a film and TV discovery engine for a media app. The user describes '
    'what they want to watch in natural language. Reply with ONLY a JSON array '
    '(no prose, no markdown code fences) of up to 12 specific, real movies or TV '
    'shows that best match, most relevant first. Each element is an object: '
    '{"title": string, "year": number, "type": "movie" or "series"}. If the user '
    'is clearly asking about a SPECIFIC EPISODE (by plot, scene, character, '
    "quote, or meme, for example 'the south park episode with kanye west'), "
    'return that show as the first result and add its "season" and "episode" '
    'numbers plus "episodeTitle", like {"title": "South Park", "type": "series", '
    '"season": 13, "episode": 5, "episodeTitle": "Fishsticks"}. Use your own '
    'knowledge of the show to pick the exact episode. Use the original or most '
    'internationally recognized title. Never repeat a title. When live web '
    'context is provided below, treat it as authoritative ground truth for '
    'fact-grounded queries (people\'s filmographies, box office, recency, '
    'regional titles, memes, current seasons/episodes) — use it as your primary '
    'source and cite the exact title/year it mentions rather than guessing from '
    'training data.';

/// Extracts the first balanced `[ { … } ]` JSON-array span from a raw model
/// reply (stripping code fences, respecting strings/escapes), or null. Ported
/// from the web `extractJsonArray`.
String? extractJsonArray(String raw) {
  final s = raw.replaceAll(RegExp(r'```(?:json)?', caseSensitive: false), '');
  final m = RegExp(r'\[\s*\{').firstMatch(s);
  if (m == null) return null;
  final start = m.start;
  var depth = 0;
  var inStr = false;
  var esc = false;
  for (var i = start; i < s.length; i++) {
    final ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch == r'\') {
        esc = true;
      } else if (ch == '"') {
        inStr = false;
      }
      continue;
    }
    if (ch == '"') {
      inStr = true;
    } else if (ch == '[') {
      depth++;
    } else if (ch == ']') {
      depth--;
      if (depth == 0) return s.substring(start, i + 1);
    }
  }
  return null;
}

/// Parses a model reply into validated, de-duplicated suggestions (capped at
/// [_maxSuggestions]). Ported from the web `parseSuggestions`.
List<AiSuggestion> parseSuggestions(String content) {
  final span = extractJsonArray(content);
  if (span == null) return const [];
  Object? arr;
  try {
    arr = jsonDecode(span);
  } catch (_) {
    return const [];
  }
  if (arr is! List) return const [];

  final out = <AiSuggestion>[];
  final seen = <String>{};
  for (final item in arr) {
    if (item is! Map) continue;
    final title = (item['title'] is String)
        ? (item['title'] as String).trim()
        : '';
    if (title.isEmpty) continue;
    final dedup = title.toLowerCase();
    if (seen.contains(dedup)) continue;
    seen.add(dedup);

    int? intOf(Object? v) => v is num && v.isFinite ? v.round() : null;
    final rawType = item['type'];
    out.add(
      AiSuggestion(
        title: title,
        year: intOf(item['year']),
        type: (rawType == 'series' || rawType == 'movie')
            ? rawType as String
            : null,
        season: intOf(item['season']),
        episode: intOf(item['episode']),
        episodeTitle:
            (item['episodeTitle'] is String &&
                (item['episodeTitle'] as String).trim().isNotEmpty)
            ? (item['episodeTitle'] as String).trim()
            : null,
      ),
    );
    if (out.length >= _maxSuggestions) break;
  }
  return out;
}

/// Calls the configured model (OpenRouter or Groq, chosen by [model]) with
/// [query] and returns parsed suggestions. Ported from the web `aiSuggest`; the
/// HTTP transport is injected for testability. Throws on a non-2xx response.
Future<List<AiSuggestion>> aiSuggest({
  required JsonTransport transport,
  required String key,
  required String model,
  required String query,
  String? webContext,
}) async {
  final q = query.trim();
  if (key.trim().isEmpty || q.isEmpty) return const [];
  final isGroq = providerForModel(model) == AiProvider.groq;
  final url = isGroq ? _groqUrl : _openrouterUrl;
  final headers = <String, String>{
    'Authorization': 'Bearer ${key.trim()}',
    'Content-Type': 'application/json',
    if (!isGroq) 'HTTP-Referer': 'https://harbor.site',
    if (!isGroq) 'X-Title': 'Harbor',
  };
  final ctx = webContext?.trim();
  final systemPrompt = (ctx != null && ctx.isNotEmpty)
      ? '$kAiSystemPrompt\n\nLive web context for this query (use it when '
            'relevant, fall back to your own knowledge otherwise):\n$ctx'
      : kAiSystemPrompt;
  final resolvedModel = migrateModelId(model.trim());
  final res = await transport.postJson(
    url,
    headers: headers,
    body: {
      'model': resolvedModel.isEmpty ? kDefaultAiModel : resolvedModel,
      'temperature': 0.4,
      'messages': [
        {'role': 'system', 'content': systemPrompt},
        {'role': 'user', 'content': q},
      ],
    },
  );
  if (!res.ok) {
    throw AiSearchException('AI search failed (${res.statusCode}).');
  }
  final data = res.data;
  final choices = (data is Map) ? data['choices'] : null;
  final first = (choices is List && choices.isNotEmpty) ? choices.first : null;
  final message = (first is Map) ? first['message'] : null;
  final content = (message is Map) ? message['content'] : null;
  return parseSuggestions(content is String ? content : '');
}

/// Thrown when the AI backend returns a non-2xx response.
class AiSearchException implements Exception {
  const AiSearchException(this.message);
  final String message;
  @override
  String toString() => 'AiSearchException($message)';
}

/// A season/episode plus its title/synopsis, the catalog the episode finder
/// grounds its answer in.
typedef EpisodeCandidate = ({
  int season,
  int episode,
  String? name,
  String? overview,
});

/// A season/episode pair the episode finder returns.
typedef EpisodePick = ({int season, int episode});

const String _episodeSystemPrompt =
    'You are an expert on television and anime. A viewer describes an episode '
    'from vague memory: a plot point, a scene, a quote, a character moment, or '
    'a meme. Identify which episode they mean. Lean on your own knowledge of '
    'the show first, then ground the answer in the provided list, which holds '
    'the exact seasons, episode numbers, and titles that are available (a short '
    'synopsis may follow the title, but it is often brief and omits subplots, '
    'so trust your own knowledge of the show when the synopsis does not mention '
    'the detail). Reply with ONLY a JSON array (no prose, no markdown) of up to '
    '5 episodes, most likely first, each {"season": number, "episode": number}. '
    'Only return season/episode pairs that appear in the list. If nothing '
    'plausibly matches, reply with [].';

/// Asks the model which episodes of [showName] match a vague [query] (a scene,
/// plot point, quote, or meme), grounded in the [episodes] catalog. Ported from
/// the web `aiFindEpisodes`; routes to OpenRouter or Groq by [model]. Returns
/// the season/episode pairs, most likely first. Throws on a non-2xx response.
Future<List<EpisodePick>> aiFindEpisodes({
  required JsonTransport transport,
  required String key,
  required String model,
  required String showName,
  required List<EpisodeCandidate> episodes,
  required String query,
}) async {
  final q = query.trim();
  if (key.trim().isEmpty || q.isEmpty || episodes.isEmpty) return const [];

  String line(EpisodeCandidate e, {required bool withOverview}) {
    final base = 's${e.season}e${e.episode}: ${e.name ?? ''}';
    if (!withOverview) return base;
    final ov = e.overview;
    return (ov != null && ov.isNotEmpty) ? '$base - $ov' : base;
  }

  final withOverview = episodes
      .map((e) => line(e, withOverview: true))
      .join('\n');
  final titlesOnly = episodes
      .map((e) => line(e, withOverview: false))
      .join('\n');
  final catalog = withOverview.length <= 24000
      ? withOverview
      : (titlesOnly.length <= 48000
            ? titlesOnly
            : titlesOnly.substring(0, 48000));

  final isGroq = providerForModel(model) == AiProvider.groq;
  final url = isGroq ? _groqUrl : _openrouterUrl;
  final headers = <String, String>{
    'Authorization': 'Bearer ${key.trim()}',
    'Content-Type': 'application/json',
    if (!isGroq) 'HTTP-Referer': 'https://harbor.site',
    if (!isGroq) 'X-Title': 'Harbor',
  };
  final resolvedModel = migrateModelId(model.trim());
  final res = await transport.postJson(
    url,
    headers: headers,
    body: {
      'model': resolvedModel.isEmpty ? kDefaultAiModel : resolvedModel,
      'temperature': 0.3,
      'messages': [
        {'role': 'system', 'content': _episodeSystemPrompt},
        {
          'role': 'user',
          'content':
              'Show: $showName\nAvailable episodes (use these exact season '
              'and episode numbers):\n$catalog\n\nWhich episode does this '
              'describe: $q',
        },
      ],
    },
  );
  if (!res.ok) {
    throw AiSearchException('AI episode search failed (${res.statusCode}).');
  }
  final data = res.data;
  final choices = (data is Map) ? data['choices'] : null;
  final first = (choices is List && choices.isNotEmpty) ? choices.first : null;
  final message = (first is Map) ? first['message'] : null;
  final content = (message is Map) ? message['content'] : null;
  return parseEpisodePicks(content is String ? content : '');
}

/// Parses a model reply into de-duplicated season/episode picks (capped at 8).
/// Ported from the web `parseRefs`.
List<EpisodePick> parseEpisodePicks(String content) {
  final span = extractJsonArray(content);
  if (span == null) return const [];
  Object? arr;
  try {
    arr = jsonDecode(span);
  } catch (_) {
    return const [];
  }
  if (arr is! List) return const [];

  final out = <EpisodePick>[];
  final seen = <String>{};
  for (final item in arr) {
    if (item is! Map) continue;
    final s = item['season'];
    final e = item['episode'];
    if (s is! num || !s.isFinite || e is! num || !e.isFinite) continue;
    final season = s.round();
    final episode = e.round();
    final k = '$season-$episode';
    if (seen.contains(k)) continue;
    seen.add(k);
    out.add((season: season, episode: episode));
    if (out.length >= 8) break;
  }
  return out;
}

String _norm(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');

/// The best catalog match for [suggestion] from [pool], scored by name equality
/// / containment, then type and year agreement. Ported from the web `pickBest`.
MetaPreview? pickBest(List<MetaPreview> pool, AiSuggestion suggestion) {
  final target = _norm(suggestion.title);
  if (target.isEmpty) return null;
  MetaPreview? best;
  var bestScore = 0;
  for (final m in pool) {
    final name = _norm(m.name);
    if (name.isEmpty) continue;
    var nameScore = 0;
    if (name == target) {
      nameScore = 5;
    } else if (target.length >= 4 && name.contains(target)) {
      nameScore = 3;
    }
    if (nameScore == 0) continue;
    var score = nameScore;
    if (suggestion.type != null && m.type == suggestion.type) score += 1;
    if (suggestion.year != null &&
        (m.releaseInfo?.contains('${suggestion.year}') ?? false)) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/// Resolves each suggestion against the catalog via [search] (title → catalog
/// metas), keeping the best match and de-duplicating by id (or id:season:episode
/// for an exact episode). Ported from the web `resolveAiSuggestions`.
Future<List<AiResult>> resolveAiSuggestions(
  List<AiSuggestion> suggestions,
  Future<List<MetaPreview>> Function(String title) search,
) async {
  final resolved = await Future.wait(
    suggestions.map((s) async {
      try {
        final pool = await search(s.title);
        final meta = pickBest(pool, s);
        if (meta == null) return null;
        final isEpisode =
            meta.type == 'series' && s.season != null && s.episode != null;
        return AiResult(
          meta: meta,
          season: isEpisode ? s.season : null,
          episode: isEpisode ? s.episode : null,
          episodeTitle: isEpisode ? s.episodeTitle : null,
        );
      } catch (_) {
        return null;
      }
    }),
  );

  final out = <AiResult>[];
  final seen = <String>{};
  for (final r in resolved) {
    if (r == null) continue;
    final key = (r.season != null && r.episode != null)
        ? '${r.meta.id}:${r.season}:${r.episode}'
        : r.meta.id;
    if (seen.contains(key)) continue;
    seen.add(key);
    out.add(r);
  }
  return out;
}
