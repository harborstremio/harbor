import '../../../design/addons/addon_logo.dart';
import '../../../domain/addons/models.dart';
import '../../../domain/addons/reorder.dart';

/// A single Organize-list row's display fields, ported from `OrganizeEntry`.
class OrganizeEntry {
  const OrganizeEntry({
    required this.key,
    required this.name,
    required this.host,
    required this.addonId,
    required this.logo,
  });

  final String key;
  final String name;
  final String host;
  final String addonId;
  final String? logo;
}

/// The tone of an Organize [Notice].
enum NoticeTone { info, danger }

/// A banner shown above the Organize sections, ported from `Notice`.
class Notice {
  const Notice({
    required this.tone,
    required this.text,
    this.retry = false,
    this.reload = false,
  });

  final NoticeTone tone;
  final String text;
  final bool retry;
  final bool reload;
}

/// The button label for a save step, ported from `stepLabel`.
String stepLabel(SaveStep step) => switch (step) {
  SaveStep.checking => 'Checking',
  SaveStep.saving => 'Saving',
  SaveStep.verifying => 'Verifying',
};

/// The transport urls of [items] in order.
List<String> urlsOfCloud(List<CollectionAddon> items) => [
  for (final i in items) (i['transportUrl'] as String?) ?? '',
];

List<String> urlsOfDevice(List<InstalledAddon> items) => [
  for (final i in items) i.transportUrl,
];

/// Builds display entries for a cloud collection, ported from `entriesOf`.
List<OrganizeEntry> entriesOfCloud(List<CollectionAddon> items) {
  final seen = <String, int>{};
  return [
    for (final item in items)
      () {
        final url = (item['transportUrl'] as String?) ?? '';
        final n = seen[url] ?? 0;
        seen[url] = n + 1;
        final host = hostOf(url);
        final manifest = item['manifest'];
        final m = manifest is Map ? manifest : const {};
        final name = m['name'];
        final id = m['id'];
        final logo = m['logo'];
        return OrganizeEntry(
          key: '$url#$n',
          name: (name is String && name.isNotEmpty) ? name : host,
          host: host,
          addonId: (id is String && id.isNotEmpty) ? id : url,
          logo: resolveAddonLogo(logo is String ? logo : null, url),
        );
      }(),
  ];
}

/// Builds display entries for the device-installed addons.
List<OrganizeEntry> entriesOfDevice(List<InstalledAddon> items) {
  final seen = <String, int>{};
  return [
    for (final item in items)
      () {
        final url = item.transportUrl;
        final n = seen[url] ?? 0;
        seen[url] = n + 1;
        final host = hostOf(url);
        final name = item.manifest?.name;
        return OrganizeEntry(
          key: '$url#$n',
          name: (name != null && name.isNotEmpty) ? name : host,
          host: host,
          addonId: item.manifest?.id.isNotEmpty ?? false
              ? item.manifest!.id
              : url,
          logo: resolveAddonLogo(item.manifest?.logo, url),
        );
      }(),
  ];
}

/// Maps a non-success [SaveResult] to the banner it should raise, ported 1:1
/// from `noticeFor`.
Notice noticeFor(SaveResult result) => switch (result) {
  SaveValidateFailure() => const Notice(
    tone: NoticeTone.danger,
    text:
        "Couldn't save: the reordered list failed safety validation. Nothing "
        'was written.',
    reload: true,
  ),
  SaveFetchFailure() => const Notice(
    tone: NoticeTone.danger,
    text:
        "Couldn't reach Stremio to confirm your collection. Nothing was "
        'written.',
    retry: true,
  ),
  SaveStaleFailure() => const Notice(
    tone: NoticeTone.danger,
    text:
        'Your addon collection changed on another device. Nothing was written.',
    reload: true,
  ),
  SaveWriteFailure() => const Notice(
    tone: NoticeTone.danger,
    text:
        "Stremio didn't confirm the save. Your collection may be unchanged. "
        'Retry will re-check before writing again.',
    retry: true,
  ),
  SaveVerifyFailure(current: final current) =>
    current == null
        ? const Notice(
            tone: NoticeTone.danger,
            text:
                "Saved, but Harbor couldn't confirm the new order. Retry to "
                're-check.',
            retry: true,
          )
        : const Notice(
            tone: NoticeTone.danger,
            text: 'Stremio reports a different order than was saved.',
            retry: true,
            reload: true,
          ),
  SaveSuccess() => const Notice(tone: NoticeTone.info, text: ''),
};
