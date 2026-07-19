import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/xmltv.dart';
import '../../design/focus/tv_text_field.dart';

/// The outcome of the Match-EPG picker: a chosen tvg-id, or a request to clear
/// an existing override.
class EpgMatchResult {
  const EpgMatchResult({this.tvgId, this.clear = false});
  final String? tvgId;
  final bool clear;
}

/// Opens a searchable picker of the loaded EPG's channels so the user can
/// manually map [channelName] to a tvg-id when auto-matching missed. Resolves to
/// the chosen id, a clear request, or null if cancelled. Ports the web
/// "Match EPG" channel action.
Future<EpgMatchResult?> showEpgMatchDialog({
  required BuildContext context,
  required HarborTokens tokens,
  required String channelName,
  required EpgIndex epg,
  required bool hasOverride,
  required Translations tr,
}) {
  final meta = epg.channelMeta ?? const <String, EpgChannelMeta>{};
  final entries = <(String, String)>[
    for (final tvgId in epg.byChannel.keys)
      (tvgId, meta[tvgId]?.displayName ?? tvgId),
  ]..sort((a, b) => a.$2.toLowerCase().compareTo(b.$2.toLowerCase()));
  return showDialog<EpgMatchResult>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) => _EpgMatchDialog(
      tokens: tokens,
      channelName: channelName,
      entries: entries,
      hasOverride: hasOverride,
      tr: tr,
    ),
  );
}

class _EpgMatchDialog extends StatefulWidget {
  const _EpgMatchDialog({
    required this.tokens,
    required this.channelName,
    required this.entries,
    required this.hasOverride,
    required this.tr,
  });

  final HarborTokens tokens;
  final String channelName;
  final List<(String, String)> entries;
  final bool hasOverride;
  final Translations tr;

  @override
  State<_EpgMatchDialog> createState() => _EpgMatchDialogState();
}

class _EpgMatchDialogState extends State<_EpgMatchDialog> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final q = _query.trim().toLowerCase();
    final matches = q.isEmpty
        ? widget.entries
        : widget.entries
              .where(
                (e) =>
                    e.$2.toLowerCase().contains(q) ||
                    e.$1.toLowerCase().contains(q),
              )
              .toList();

    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 640),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.tr.t('Match EPG'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.tr.t('Pick the guide channel for "{name}".', {
                  'name': widget.channelName,
                }),
                style: TextStyle(color: t.inkMuted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: t.canvas.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: t.edgeSoft),
                ),
                child: Row(
                  children: [
                    Icon(Icons.search, size: 16, color: t.inkSubtle),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TvTextField(
                        controller: _controller,
                        autocorrect: false,
                        onChanged: (v) => setState(() => _query = v),
                        style: TextStyle(color: t.ink, fontSize: 14),
                        cursorColor: t.accent,
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: widget.tr.t('Search guide channels'),
                          hintStyle: TextStyle(color: t.inkSubtle),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: matches.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 28),
                        child: Text(
                          widget.tr.t('No guide channels match.'),
                          textAlign: TextAlign.center,
                          style: TextStyle(color: t.inkSubtle, fontSize: 13),
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: matches.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 6),
                        itemBuilder: (context, i) {
                          final (tvgId, name) = matches[i];
                          return Focusable(
                            tokens: t,
                            scale: 1.0,
                            borderRadius: 12,
                            autofocus: i == 0,
                            onPressed: () => Navigator.of(
                              context,
                            ).pop(EpgMatchResult(tvgId: tvgId)),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 11,
                              ),
                              decoration: BoxDecoration(
                                color: t.canvas.withValues(alpha: 0.4),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: t.edgeSoft),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: t.ink,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (name != tvgId) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      tvgId,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: t.inkSubtle,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  if (widget.hasOverride)
                    // Flexible + ellipsis so a long (or localized) label
                    // shrinks instead of overflowing the narrow phone dialog.
                    Flexible(
                      child: Focusable(
                        tokens: t,
                        scale: 1.0,
                        borderRadius: 12,
                        onPressed: () => Navigator.of(
                          context,
                        ).pop(const EpgMatchResult(clear: true)),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          child: Text(
                            widget.tr.t('Clear current match'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: t.danger, fontSize: 14),
                          ),
                        ),
                      ),
                    ),
                  const Spacer(),
                  Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 12,
                    onPressed: () => Navigator.of(context).pop(),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      child: Text(
                        widget.tr.t('Cancel'),
                        style: TextStyle(color: t.inkMuted, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
