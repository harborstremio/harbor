import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/iptv/country_prefs.dart';
import '../domain/iptv/favorites.dart';
import '../domain/iptv/group_prefs.dart';
import '../domain/iptv/m3u.dart';
import 'iptv_providers.dart';

/// The reactive pinned-channel order. Wraps [ChannelPinsStore] so the UI
/// re-renders on a pin toggle (the native analog of the web's `usePinnedOrder`).
class ChannelPinsController extends Notifier<List<String>> {
  @override
  List<String> build() => ref.watch(channelPinsStoreProvider).pins();

  Future<void> toggle(String channelId) async {
    final store = ref.read(channelPinsStoreProvider);
    await store.toggle(channelId);
    state = store.pins();
  }

  Future<void> clear() async {
    final store = ref.read(channelPinsStoreProvider);
    await store.clear();
    state = store.pins();
  }

  Future<void> removeForSource(String sourceId) async {
    final store = ref.read(channelPinsStoreProvider);
    await store.removeForSource(sourceId);
    state = store.pins();
  }
}

final channelPinsProvider =
    NotifierProvider<ChannelPinsController, List<String>>(
      ChannelPinsController.new,
    );

/// The reactive per-source group preferences (`usePruneGroups` equivalent).
class GroupPrefsController extends Notifier<Map<String, GroupPrefs>> {
  @override
  Map<String, GroupPrefs> build() => ref.watch(groupPrefsStoreProvider).all();

  Future<void> togglePin(String sourceId, String group) async {
    final store = ref.read(groupPrefsStoreProvider);
    await store.togglePin(sourceId, group);
    state = store.all();
  }

  Future<void> toggleHidden(String sourceId, String group) async {
    final store = ref.read(groupPrefsStoreProvider);
    await store.toggleHidden(sourceId, group);
    state = store.all();
  }

  Future<void> clear(String sourceId) async {
    final store = ref.read(groupPrefsStoreProvider);
    await store.clear(sourceId);
    state = store.all();
  }

  Future<void> removeForSource(String sourceId) async {
    final store = ref.read(groupPrefsStoreProvider);
    await store.removeForSource(sourceId);
    state = store.all();
  }
}

final groupPrefsProvider =
    NotifierProvider<GroupPrefsController, Map<String, GroupPrefs>>(
      GroupPrefsController.new,
    );

/// The reactive per-source country filters (`useCountryPrefs` equivalent).
class CountryPrefsController extends Notifier<Map<String, CountryPrefs>> {
  @override
  Map<String, CountryPrefs> build() =>
      ref.watch(countryPrefsStoreProvider).all();

  Future<void> toggle(String sourceId, String code) async {
    final store = ref.read(countryPrefsStoreProvider);
    await store.toggle(sourceId, code);
    state = store.all();
  }

  Future<void> clear(String sourceId) async {
    final store = ref.read(countryPrefsStoreProvider);
    await store.clear(sourceId);
    state = store.all();
  }

  Future<void> removeForSource(String sourceId) async {
    final store = ref.read(countryPrefsStoreProvider);
    await store.removeForSource(sourceId);
    state = store.all();
  }
}

final countryPrefsProvider =
    NotifierProvider<CountryPrefsController, Map<String, CountryPrefs>>(
      CountryPrefsController.new,
    );

/// The reactive EPG override map (channelId → tvg-id; `useEpgMapVersion`
/// equivalent).
class EpgOverridesController extends Notifier<Map<String, String>> {
  @override
  Map<String, String> build() => ref.watch(epgOverrideStoreProvider).all();

  Future<void> setOverride(String channelId, String? tvgId) async {
    final store = ref.read(epgOverrideStoreProvider);
    await store.setOverride(channelId, tvgId);
    state = store.all();
  }

  Future<void> removeForSource(String sourceId) async {
    final store = ref.read(epgOverrideStoreProvider);
    await store.removeForSource(sourceId);
    state = store.all();
  }
}

final epgOverridesProvider =
    NotifierProvider<EpgOverridesController, Map<String, String>>(
      EpgOverridesController.new,
    );

/// The reactive channel-stats version. Bumps on every play/clear so watchers
/// re-query top/recent/count from [channelStatsStoreProvider]. Ports
/// `useChannelStatsVersion`.
class ChannelStatsController extends Notifier<int> {
  @override
  int build() => 0;

  Future<void> record(IptvChannel channel) async {
    await ref.read(channelStatsStoreProvider).record(channel);
    state = state + 1;
  }

  Future<void> clear() async {
    await ref.read(channelStatsStoreProvider).clear();
    state = state + 1;
  }

  Future<void> removeForSource(String sourceId) async {
    await ref.read(channelStatsStoreProvider).removeForSource(sourceId);
    state = state + 1;
  }
}

final channelStatsVersionProvider =
    NotifierProvider<ChannelStatsController, int>(ChannelStatsController.new);

/// The reactive favorited-channel map. Wraps [FavoritesStore] so the UI
/// re-renders on toggle/hydrate (the native analog of the web's `useFavorites`).
class FavoritesController extends Notifier<Map<String, StoredFavorite>> {
  @override
  Map<String, StoredFavorite> build() =>
      ref.watch(favoritesStoreProvider).items();

  Future<void> toggle(IptvChannel channel) async {
    final store = ref.read(favoritesStoreProvider);
    await store.toggle(channel);
    state = store.items();
  }

  Future<void> hydrate(List<IptvChannel> channels) async {
    final store = ref.read(favoritesStoreProvider);
    if (await store.hydrate(channels)) state = store.items();
  }

  Future<void> removeForSource(String sourceId) async {
    final store = ref.read(favoritesStoreProvider);
    await store.removeForSource(sourceId);
    state = store.items();
  }
}

final favoritesProvider =
    NotifierProvider<FavoritesController, Map<String, StoredFavorite>>(
      FavoritesController.new,
    );
