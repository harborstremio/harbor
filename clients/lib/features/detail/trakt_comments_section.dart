import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/trakt/trakt_ids.dart';
import '../../domain/trakt/trakt_types.dart';

/// The detail-page Trakt comments section (web `TraktComments`), gated by the
/// caller on `showTraktComments`. Read-only list of community comments.
///
/// Two independent blur layers, mirroring the web component:
///  * a spoiler-tagged comment is always hidden behind a "Spoiler — Click to
///    reveal" button until the reader opens it (regardless of any setting);
///  * when the `blurComments` setting is on, the whole section is covered by a
///    blur + "Reveal comments" gate until the reader reveals it.
class TraktCommentsSection extends ConsumerStatefulWidget {
  const TraktCommentsSection({
    super.key,
    required this.type,
    required this.id,
    required this.tokens,
    this.season,
    this.episode,
  });

  final String type;
  final String id;
  final HarborTokens tokens;

  /// When set (the episode-detail page), the section fetches the comments for
  /// that specific episode rather than the show/movie as a whole.
  final int? season;
  final int? episode;

  @override
  ConsumerState<TraktCommentsSection> createState() =>
      _TraktCommentsSectionState();
}

class _TraktCommentsSectionState extends ConsumerState<TraktCommentsSection> {
  bool _sectionRevealed = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(
      traktCommentsProvider((
        type: widget.type,
        id: widget.id,
        season: widget.season,
        episode: widget.episode,
      )),
    );
    final comments = async.asData?.value ?? const <TraktComment>[];
    final connected = ref.watch(traktConnectedProvider);
    // The composer is offered only on the movie/show detail (not per-episode).
    final canCompose = widget.season == null && widget.episode == null;
    // Show the section when there are comments, or when a connected user can add
    // the first one (web keeps the composer visible regardless of count).
    if (comments.isEmpty && !(connected && canCompose)) {
      return const SizedBox.shrink();
    }

    final t = widget.tokens;
    final g = pageGutter(Idiom.of(context));
    final tr = ref.watch(translationsProvider);
    final blurred =
        ref.watch(settingsProvider).getBool('blurComments') &&
        !_sectionRevealed;

    final myUsername = ref.watch(traktUsernameProvider);
    final list = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final c in comments.take(20))
          _CommentTile(
            comment: c,
            tokens: t,
            tr: tr,
            connected: connected,
            myUsername: myUsername,
            onDeleted: () => ref.invalidate(
              traktCommentsProvider((
                type: widget.type,
                id: widget.id,
                season: widget.season,
                episode: widget.episode,
              )),
            ),
          ),
      ],
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(g, 40, g, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr.t('Comments'),
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          if (comments.isNotEmpty && blurred)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  // Keep a minimum height so the reveal gate never overflows a
                  // short comment list and always stays on-screen.
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 200),
                    child: list,
                  ),
                  Positioned.fill(
                    child: BackdropFilter(
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
                                onPressed: () =>
                                    setState(() => _sectionRevealed = true),
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
                                style: TextStyle(
                                  color: t.inkSubtle,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else if (comments.isNotEmpty)
            list,
          if (canCompose && !blurred) ...[
            const SizedBox(height: 20),
            if (connected)
              _TraktComposer(
                type: widget.type,
                id: widget.id,
                tokens: t,
                tr: tr,
                onPosted: () => ref.invalidate(
                  traktCommentsProvider((
                    type: widget.type,
                    id: widget.id,
                    season: widget.season,
                    episode: widget.episode,
                  )),
                ),
              )
            else if (comments.isNotEmpty)
              Text(
                tr.t('Sign in to Trakt in Settings to add a comment.'),
                style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
              ),
          ],
        ],
      ),
    );
  }
}

/// The Trakt comment composer — a text field, a "Contains spoiler" toggle and a
/// Post button (Trakt requires at least five words). Ported from the web
/// `TraktComments` composer. Posts through [postComment] and calls [onPosted]
/// (which refreshes the list) on success.
class _TraktComposer extends ConsumerStatefulWidget {
  const _TraktComposer({
    required this.type,
    required this.id,
    required this.tokens,
    required this.tr,
    required this.onPosted,
  });

  final String type;
  final String id;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onPosted;

  @override
  ConsumerState<_TraktComposer> createState() => _TraktComposerState();
}

class _TraktComposerState extends ConsumerState<_TraktComposer> {
  final _controller = TextEditingController();
  bool _spoiler = false;
  bool _busy = false;
  String? _error;
  int _words = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int _wordCount(String s) {
    final trimmed = s.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  Future<void> _post() async {
    final text = _controller.text.trim();
    if (_wordCount(text) < 5 || _busy) return;
    final res = stremioIdToTraktTarget(widget.id);
    final target = res.target;
    if (target == null) {
      setState(
        () => _error = widget.tr.t('This title could not be posted to.'),
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final posted = await ref
        .read(traktClientProvider)
        .postComment(target, text, spoiler: _spoiler);
    if (!mounted) return;
    if (posted == null) {
      setState(() {
        _busy = false;
        _error = widget.tr.t('Could not post your comment. Try again.');
      });
      return;
    }
    _controller.clear();
    setState(() {
      _busy = false;
      _spoiler = false;
      _words = 0;
    });
    widget.onPosted();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = widget.tr;
    final canPost = _words >= 5 && !_busy;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TvTextField(
          controller: _controller,
          decoration: InputDecoration(hintText: tr.t('Add a comment…')),
          maxLines: 3,
          onChanged: (v) => setState(() => _words = _wordCount(v)),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Focusable(
              tokens: t,
              borderRadius: 8,
              onPressed: () => setState(() => _spoiler = !_spoiler),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _spoiler ? Icons.check_box : Icons.check_box_outline_blank,
                    size: 18,
                    color: _spoiler ? t.accent : t.inkSubtle,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    tr.t('Contains spoiler'),
                    style: TextStyle(color: t.inkMuted, fontSize: 13),
                  ),
                ],
              ),
            ),
            const Spacer(),
            Focusable(
              tokens: t,
              borderRadius: 999,
              onPressed: canPost ? _post : () {},
              child: Opacity(
                opacity: canPost ? 1 : 0.5,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: t.ink,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    tr.t('Post'),
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        // Trakt requires at least five words; nudge until the composer is valid.
        if (_words > 0 && _words < 5)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              tr.t('Comments must be at least 5 words.'),
              style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _error!,
              style: const TextStyle(color: Color(0xFFEF4444), fontSize: 11.5),
            ),
          ),
      ],
    );
  }
}

String _timeAgo(String isoDate) {
  final t = DateTime.tryParse(isoDate);
  if (t == null) return '';
  final mins = DateTime.now().difference(t).inMinutes;
  if (mins < 1) return 'just now';
  if (mins < 60) return '${mins}m ago';
  final hours = mins ~/ 60;
  if (hours < 24) return '${hours}h ago';
  final days = hours ~/ 24;
  if (days < 30) return '${days}d ago';
  return '${days ~/ 30}mo ago';
}

class _CommentTile extends ConsumerStatefulWidget {
  const _CommentTile({
    required this.comment,
    required this.tokens,
    required this.tr,
    this.connected = false,
    this.myUsername,
    this.onDeleted,
  });

  final TraktComment comment;
  final HarborTokens tokens;
  final Translations tr;

  /// Whether Trakt is connected — gates the like toggle.
  final bool connected;

  /// The signed-in user's Trakt username — the delete affordance shows only on
  /// their own comments.
  final String? myUsername;

  /// Called after the user's own comment is deleted (refreshes the list).
  final VoidCallback? onDeleted;

  @override
  ConsumerState<_CommentTile> createState() => _CommentTileState();
}

class _CommentTileState extends ConsumerState<_CommentTile> {
  // Spoiler-tagged comments start hidden; everything else starts revealed.
  late bool _revealed = !widget.comment.spoiler;
  bool _deleted = false;
  bool _deleteBusy = false;

  Future<void> _delete() async {
    if (_deleteBusy) return;
    setState(() => _deleteBusy = true);
    final ok = await ref
        .read(traktClientProvider)
        .deleteComment(widget.comment.id);
    if (!mounted) return;
    if (ok) {
      setState(() => _deleted = true);
      widget.onDeleted?.call();
    } else {
      setState(() => _deleteBusy = false);
    }
  }
  // Optimistic like state — Trakt's comment list carries no per-user like flag,
  // so (as on web) the first tap likes and the next unlikes.
  bool _liked = false;
  bool _busyLike = false;

  Future<void> _toggleLike() async {
    if (_busyLike) return;
    final id = widget.comment.id;
    final wasLiked = _liked;
    setState(() {
      _busyLike = true;
      _liked = !wasLiked;
    });
    final client = ref.read(traktClientProvider);
    final ok = wasLiked
        ? await client.unlikeComment(id)
        : await client.likeComment(id);
    if (!mounted) return;
    setState(() {
      if (!ok) _liked = wasLiked; // revert on failure
      _busyLike = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_deleted) return const SizedBox.shrink();
    final c = widget.comment;
    final t = widget.tokens;
    final tr = widget.tr;
    final canDelete =
        widget.connected &&
        widget.myUsername != null &&
        widget.myUsername!.isNotEmpty &&
        c.username.toLowerCase() == widget.myUsername!.toLowerCase();
    final avatarUrl =
        c.avatar ??
        'https://walter.trakt.tv/users/${c.username}/avatars/medium';
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipOval(
            child: SizedBox(
              width: 34,
              height: 34,
              child: CachedNetworkImage(
                imageUrl: avatarUrl,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => _initial(t, c.username),
                placeholder: (_, _) => _initial(t, c.username),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        c.name?.isNotEmpty == true ? c.name! : c.username,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (c.userRating != null) ...[
                      const SizedBox(width: 8),
                      Icon(Icons.star, size: 12, color: t.accent),
                      const SizedBox(width: 2),
                      Text(
                        '${c.userRating}',
                        style: TextStyle(color: t.accent, fontSize: 12),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      _timeAgo(c.createdAt),
                      style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (!_revealed)
                  Focusable(
                    tokens: t,
                    borderRadius: 10,
                    onPressed: () => setState(() => _revealed = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: t.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.visibility_off_outlined,
                            size: 14,
                            color: t.accent,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            tr.t('Spoiler — Click to reveal'),
                            style: TextStyle(
                              color: t.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Text(
                    c.comment,
                    style: TextStyle(
                      color: t.inkMuted,
                      fontSize: 13.5,
                      height: 1.4,
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    // Connected users can like/unlike (optimistic); otherwise the
                    // like count stays a static read-only cue.
                    if (widget.connected)
                      Focusable(
                        tokens: t,
                        borderRadius: 6,
                        scale: 1.0,
                        onPressed: _toggleLike,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _liked ? Icons.favorite : Icons.favorite_border,
                              size: 13,
                              color: _liked ? t.accent : t.inkSubtle,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${c.likes + (_liked ? 1 : 0)}',
                              style: TextStyle(
                                color: _liked ? t.accent : t.inkSubtle,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      )
                    else ...[
                      Icon(Icons.favorite_border, size: 13, color: t.inkSubtle),
                      const SizedBox(width: 4),
                      Text(
                        '${c.likes}',
                        style: TextStyle(color: t.inkSubtle, fontSize: 12),
                      ),
                    ],
                    if (c.replies > 0) ...[
                      const SizedBox(width: 14),
                      Icon(
                        Icons.mode_comment_outlined,
                        size: 13,
                        color: t.inkSubtle,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${c.replies}',
                        style: TextStyle(color: t.inkSubtle, fontSize: 12),
                      ),
                    ],
                    // Own-comment delete (web gates on comment.user === user).
                    if (canDelete) ...[
                      const SizedBox(width: 14),
                      Focusable(
                        tokens: t,
                        borderRadius: 6,
                        scale: 1.0,
                        onPressed: _deleteBusy ? () {} : _delete,
                        child: Opacity(
                          opacity: _deleteBusy ? 0.4 : 1,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.delete_outline,
                                size: 13,
                                color: t.inkSubtle,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                tr.t('Delete'),
                                style: TextStyle(
                                  color: t.inkSubtle,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _initial(HarborTokens t, String username) => ColoredBox(
    color: t.inkMuted.withValues(alpha: 0.2),
    child: Center(
      child: Text(
        username.isNotEmpty ? username[0].toUpperCase() : '?',
        style: TextStyle(
          color: t.inkMuted,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}
