import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/net/safe_launch.dart';

import '../../app/anilist_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/anilist/anilist_mutations.dart';
import '../../domain/anilist/anilist_types.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import 'anilist_html.dart';

/// The detail-page AniList comments section (web `AnilistComments`), gated by
/// the caller on `showAnilistComments` for anime titles. AniList "comments" are
/// forum threads: a thread list drills into a thread's comments. Read-only —
/// posting/replying/liking are not part of the port. When `anilistBlurComments`
/// is on the whole list sits behind a reveal gate.
class AnilistCommentsSection extends ConsumerStatefulWidget {
  const AnilistCommentsSection({
    super.key,
    required this.harborId,
    required this.tokens,
  });

  final String harborId;
  final HarborTokens tokens;

  @override
  ConsumerState<AnilistCommentsSection> createState() =>
      _AnilistCommentsSectionState();
}

class _AnilistCommentsSectionState
    extends ConsumerState<AnilistCommentsSection> {
  bool _sectionRevealed = false;
  AnilistThread? _openThread;
  // Optimistic like overrides keyed by comment id (AniList returns isLiked, so
  // the toggle can start from the true state).
  final _likeOverride = <int, ({int likeCount, bool isLiked})>{};
  bool _likeBusy = false;

  Future<void> _toggleCommentLike(AnilistThreadComment c) async {
    if (_likeBusy || c.id <= 0) return;
    final cur = _likeOverride[c.id];
    final wasLiked = cur?.isLiked ?? c.isLiked;
    final baseCount = cur?.likeCount ?? c.likeCount;
    setState(() {
      _likeBusy = true;
      _likeOverride[c.id] = (
        likeCount: baseCount + (wasLiked ? -1 : 1),
        isLiked: !wasLiked,
      );
    });
    final token = ref.read(anilistSessionStoreProvider).read()?.accessToken;
    final res = token == null
        ? null
        : await toggleAnilistCommentLike(
            ref.read(anilistClientProvider),
            token,
            c.id,
          );
    if (!mounted) return;
    setState(() {
      _likeOverride[c.id] = res ?? (likeCount: baseCount, isLiked: wasLiked);
      _likeBusy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final g = pageGutter(Idiom.of(context));
    final tr = ref.watch(translationsProvider);
    final connected = ref.watch(anilistConnectProvider) is AnilistConnectDone;

    if (!connected) return _connectPrompt(t, tr, g);

    final result = ref
        .watch(anilistThreadsProvider(widget.harborId))
        .asData
        ?.value;
    if (result == null || result.mediaId == null || result.threads.isEmpty) {
      return const SizedBox.shrink();
    }

    final blurred =
        ref.watch(settingsProvider).getBool('anilistBlurComments') &&
        !_sectionRevealed;

    final content = _openThread != null
        ? _threadComments(t, tr, _openThread!)
        : _threadList(t, tr, result.threads);

    return Padding(
      padding: EdgeInsets.fromLTRB(g, 40, g, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(t, tr),
          const SizedBox(height: 14),
          if (blurred)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  // Behind the gate the content must be inert — not tappable
                  // (privacy) and not remote-focusable (TV can't land on a
                  // hidden row).
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 200),
                    child: ExcludeFocus(child: IgnorePointer(child: content)),
                  ),
                  Positioned.fill(child: _blurGate(t, tr)),
                ],
              ),
            )
          else
            content,
        ],
      ),
    );
  }

  Widget _header(HarborTokens t, Translations tr) => Row(
    children: [
      Text(
        tr.t('AniList Comments'),
        style: TextStyle(
          color: t.ink,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      const Spacer(),
      if (_openThread != null)
        _textButton(t, tr.t('Back'), () => setState(() => _openThread = null)),
    ],
  );

  Widget _blurGate(HarborTokens t, Translations tr) => BackdropFilter(
    filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            t.canvas.withValues(alpha: 0.05),
            t.canvas.withValues(alpha: 0.78),
            t.canvas.withValues(alpha: 0.95),
          ],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.only(top: 48, bottom: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Focusable(
              tokens: t,
              borderRadius: 12,
              onPressed: () => setState(() => _sectionRevealed = true),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: t.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  tr.t('Reveal comments'),
                  style: TextStyle(
                    color: t.canvas,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              tr.t('Comments are hidden'),
              style: TextStyle(color: t.inkSubtle, fontSize: 11),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _threadList(
    HarborTokens t,
    Translations tr,
    List<AnilistThread> threads,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final thread in threads.take(20))
        Focusable(
          tokens: t,
          borderRadius: 12,
          onPressed: () => setState(() => _openThread = thread),
          child: Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: t.canvas.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: t.edgeSoft),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (thread.isLocked) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(
                          Icons.lock_outline,
                          size: 13,
                          color: t.inkSubtle,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Expanded(
                      child: Text(
                        thread.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _avatar(t, thread.user, 20),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        thread.user.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Icon(
                      Icons.mode_comment_outlined,
                      size: 12,
                      color: t.inkSubtle,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${thread.replyCount}',
                      style: TextStyle(color: t.inkSubtle, fontSize: 12),
                    ),
                    const SizedBox(width: 10),
                    Icon(
                      Icons.visibility_outlined,
                      size: 12,
                      color: t.inkSubtle,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${thread.viewCount}',
                      style: TextStyle(color: t.inkSubtle, fontSize: 12),
                    ),
                    const Spacer(),
                    Text(
                      _timeAgo(thread.createdAt),
                      style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
    ],
  );

  Widget _threadComments(
    HarborTokens t,
    Translations tr,
    AnilistThread thread,
  ) {
    final async = ref.watch(anilistThreadCommentsProvider(thread.id));
    final connected = ref.watch(anilistConnectProvider) is AnilistConnectDone;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                thread.title,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (thread.siteUrl != null && thread.siteUrl!.isNotEmpty) ...[
              const SizedBox(width: 10),
              _linkButton(t, tr.t('Open on AniList'), thread.siteUrl!),
            ],
          ],
        ),
        if (thread.bodyHtml != null && thread.bodyHtml!.isNotEmpty) ...[
          const SizedBox(height: 8),
          _commentTile(
            t,
            AnilistThreadComment(
              id: -thread.id,
              commentHtml: thread.bodyHtml!,
              likeCount: 0,
              isLiked: false,
              createdAt: thread.createdAt,
              user: thread.user,
            ),
          ),
        ],
        const SizedBox(height: 12),
        async.when(
          loading: () => Padding(
            padding: const EdgeInsets.all(20),
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: t.accent,
                ),
              ),
            ),
          ),
          error: (_, _) => Text(
            tr.t('Could not load comments.'),
            style: TextStyle(color: t.inkMuted, fontSize: 13),
          ),
          data: (comments) => comments.isEmpty
              ? Text(
                  tr.t('No comments yet'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 13),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final c in comments)
                      _commentTile(t, c, connected: connected),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _likeRow(
    HarborTokens t,
    AnilistThreadComment c, {
    required bool connected,
  }) {
    final o = _likeOverride[c.id];
    final liked = o?.isLiked ?? c.isLiked;
    final count = o?.likeCount ?? c.likeCount;
    if (!connected && count <= 0) return const SizedBox.shrink();
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          liked ? Icons.favorite : Icons.favorite_border,
          size: 13,
          color: liked ? t.accent : t.inkSubtle,
        ),
        const SizedBox(width: 4),
        Text(
          '$count',
          style: TextStyle(color: liked ? t.accent : t.inkSubtle, fontSize: 12),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: connected
          ? Focusable(
              tokens: t,
              borderRadius: 6,
              scale: 1.0,
              onPressed: () => _toggleCommentLike(c),
              child: row,
            )
          : row,
    );
  }

  Widget _commentTile(
    HarborTokens t,
    AnilistThreadComment c, {
    bool connected = false,
  }) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _avatar(t, c.user, 30),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      c.user.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.ink,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _timeAgo(c.createdAt),
                    style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              AnilistHtml(html: c.commentHtml, tokens: t),
              // Like row — real comments (id>0) become a tappable optimistic
              // toggle when connected; otherwise a static count (shown only when
              // there are likes). The thread OP body (id<=0) never shows it.
              if (c.id > 0) _likeRow(t, c, connected: connected),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _connectPrompt(HarborTokens t, Translations tr, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 40, g, 0),
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr.t('AniList Comments'),
            style: TextStyle(
              color: t.ink,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr.t(
              'Connect your AniList account to see forum threads and comments.',
            ),
            style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 14),
          Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 12,
            onPressed: () => ref
                .read(navControllerProvider.notifier)
                .setView(FrameKind.settings),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                color: t.accentSoft,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.accent),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.link, color: t.accent, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    tr.t('Connect AniList'),
                    style: TextStyle(
                      color: t.accent,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _avatar(HarborTokens t, AnilistUser user, double size) {
    final url = user.avatar;
    final initial = ColoredBox(
      color: t.inkMuted.withValues(alpha: 0.2),
      child: Center(
        child: Text(
          user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
          style: TextStyle(
            color: t.inkMuted,
            fontSize: size * 0.42,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: url == null || url.isEmpty
            ? initial
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, _) => initial,
                errorWidget: (_, _, _) => initial,
              ),
      ),
    );
  }

  Widget _linkButton(HarborTokens t, String label, String url) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 8,
    onPressed: () => launchExternalUrl(url),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: t.edge),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.open_in_new, size: 12, color: t.inkMuted),
        ],
      ),
    ),
  );

  Widget _textButton(HarborTokens t, String label, VoidCallback onTap) =>
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 8,
        onPressed: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_back, size: 14, color: t.accent),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  color: t.accent,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
}

String _timeAgo(int unixSeconds) {
  if (unixSeconds <= 0) return '';
  final t = DateTime.fromMillisecondsSinceEpoch(unixSeconds * 1000);
  final mins = DateTime.now().difference(t).inMinutes;
  if (mins < 1) return 'just now';
  if (mins < 60) return '${mins}m ago';
  final hours = mins ~/ 60;
  if (hours < 24) return '${hours}h ago';
  final days = hours ~/ 24;
  if (days < 30) return '${days}d ago';
  return '${days ~/ 30}mo ago';
}
