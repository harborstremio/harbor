import '../debrid/debrid_types.dart';
import 'download_engine.dart';

/// Builds the per-episode download requests for a whole season from a debrid
/// torrent's file list, ported from the `download-season` branch of the web
/// `use-pick-handler`: keep only video files, read the season/episode from each
/// filename (falling back to the list index for the episode number), and keep
/// only files whose season matches [targetSeason].
///
/// Files with no resolved [DebridFile.url] are skipped. The returned requests
/// carry an `S..E..`-suffixed [DownloadRequest.streamLabel] and the season /
/// episode so the Downloads view groups them under the series.
List<DownloadRequest> buildSeasonDownloadRequests({
  required List<DebridFile> files,
  required int targetSeason,
  required String metaId,
  required String title,
  String? poster,
  String? releaseInfo,
  String? label,
}) {
  final videoFiles = files
      .where((f) => kVideoExts.any((ext) => f.name.toLowerCase().endsWith(ext)))
      .toList();
  if (videoFiles.isEmpty) return const [];

  final seaEp = RegExp(r'[Ss](\d+)[Ee](\d+)');
  final epOnly = RegExp(r'[Ee]0*(\d+)');
  final out = <DownloadRequest>[];
  for (var i = 0; i < videoFiles.length; i++) {
    final file = videoFiles[i];
    final url = file.url;
    if (url == null || url.isEmpty) continue;

    var seaNum = targetSeason;
    int epNum;
    final m = seaEp.firstMatch(file.name);
    if (m != null) {
      seaNum = int.parse(m.group(1)!);
      epNum = int.parse(m.group(2)!);
    } else {
      final e = epOnly.firstMatch(file.name);
      epNum = e != null ? int.parse(e.group(1)!) : i + 1;
    }
    if (seaNum != targetSeason) continue;

    final ep2 = epNum.toString().padLeft(2, '0');
    final se = 'S${seaNum.toString().padLeft(2, '0')}E$ep2';
    out.add(
      DownloadRequest(
        metaId: metaId,
        title: title,
        subtitle: 'S$seaNum · E$ep2',
        poster: poster,
        season: seaNum,
        episode: epNum,
        streamLabel: (label != null && label.isNotEmpty) ? '$label $se' : se,
        url: url,
        releaseInfo: releaseInfo,
      ),
    );
  }
  return out;
}
