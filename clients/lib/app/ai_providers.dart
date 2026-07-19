import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/ai/ai_models.dart';
import '../domain/ai/ai_search.dart';
import '../domain/ai/jina_search.dart';
import '../domain/catalog/cinemeta.dart';
import 'iptv_providers.dart';
import 'providers.dart';

/// Runs an AI search for [query]: asks the configured model for title
/// suggestions, then resolves them against Cinemeta. Throws [AiSearchException]
/// when no key is configured or the backend fails; returns an empty list for a
/// blank query.
final aiSearchProvider = FutureProvider.autoDispose
    .family<List<AiResult>, String>((ref, query) async {
      final q = query.trim();
      if (q.isEmpty) return const [];

      final settings = ref.watch(settingsProvider);
      final configured = settings.getString('aiSearchModel').trim();
      final model = configured.isEmpty ? kDefaultAiModel : configured;
      final isGroq = providerForModel(model) == AiProvider.groq;
      final key =
          (isGroq
                  ? settings.getString('aiGroqKey')
                  : settings.getString('aiSearchKey'))
              .trim();
      if (key.isEmpty) {
        throw const AiSearchException('no-key');
      }

      final transport = ref.watch(jsonTransportProvider);
      final client = ref.watch(addonClientProvider);

      // Optional Jina web-context enrichment: when `aiWebSearch` is on, search
      // the web and deep-read the top results, then ground the model in that
      // context. A failed enrichment must not sink the search — fall through
      // to the model's own knowledge.
      String? webContext;
      if (settings.getBool('aiWebSearch')) {
        try {
          final enriched = await enrichWithContent(
            ref.watch(textTransportProvider),
            q,
            apiKey: settings.getString('jinaKey'),
          );
          webContext = enriched.context.isEmpty ? null : enriched.context;
        } catch (_) {
          webContext = null;
        }
      }

      final suggestions = await aiSuggest(
        transport: transport,
        key: key,
        model: model,
        query: q,
        webContext: webContext,
      );
      return resolveAiSuggestions(suggestions, (title) async {
        final r = await searchCinemeta(client, title);
        return [...r.movies, ...r.series];
      });
    });
