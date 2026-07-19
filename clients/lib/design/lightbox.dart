import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'focus/focusable.dart';
import 'tokens.dart';

/// Opens a full-screen image lightbox over [images] starting at [index], with a
/// position counter, ported from `media-lightbox.tsx`. D-pad Left/Right step
/// through the set; Back/Escape or a tap closes it. Shared by the detail media
/// gallery and the Discover critics-pick stills strip.
void showImageLightbox(
  BuildContext context,
  List<String> images,
  int index,
  HarborTokens tokens,
) {
  showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'media',
    barrierColor: Colors.black.withValues(alpha: 0.88),
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (_, _, _) =>
        _Lightbox(images: images, index: index, tokens: tokens),
    transitionBuilder: (_, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(
        scale: Tween(
          begin: 0.96,
          end: 1.0,
        ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
        child: child,
      ),
    ),
  );
}

class _Lightbox extends StatefulWidget {
  const _Lightbox({
    required this.images,
    required this.index,
    required this.tokens,
  });

  final List<String> images;
  final int index;
  final HarborTokens tokens;

  @override
  State<_Lightbox> createState() => _LightboxState();
}

class _LightboxState extends State<_Lightbox> {
  late int _i = widget.index;

  void _go(int dir) => setState(
    () => _i = (_i + dir + widget.images.length) % widget.images.length,
  );

  KeyEventResult _onKey(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    switch (e.logicalKey) {
      case LogicalKeyboardKey.arrowRight:
        _go(1);
        return KeyEventResult.handled;
      case LogicalKeyboardKey.arrowLeft:
        _go(-1);
        return KeyEventResult.handled;
      case LogicalKeyboardKey.escape:
      case LogicalKeyboardKey.goBack:
        Navigator.of(context).maybePop();
        return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final multi = widget.images.length > 1;
    return Focus(
      autofocus: true,
      onKeyEvent: _onKey,
      child: GestureDetector(
        onTap: () => Navigator.of(context).maybePop(),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 96, vertical: 64),
              child: CachedNetworkImage(
                imageUrl: widget.images[_i],
                fit: BoxFit.contain,
              ),
            ),
            if (multi) ...[
              Positioned(
                left: 28,
                child: _NavArrow(
                  icon: Icons.chevron_left,
                  tokens: t,
                  onPressed: () => _go(-1),
                ),
              ),
              Positioned(
                right: 28,
                child: _NavArrow(
                  icon: Icons.chevron_right,
                  tokens: t,
                  onPressed: () => _go(1),
                ),
              ),
              Positioned(
                bottom: 28,
                child: Text(
                  '${_i + 1} / ${widget.images.length}',
                  style: TextStyle(
                    color: t.ink.withValues(alpha: 0.55),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 2,
                  ),
                ),
              ),
            ],
            Positioned(
              top: 40,
              right: 40,
              child: Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: () => Navigator.of(context).maybePop(),
                child: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.canvas.withValues(alpha: 0.9),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.close, color: t.ink, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A lightbox prev/next arrow — a real Focusable button (TV-remote reachable,
/// clickable on touch/mouse), matching web `MediaLightbox`'s clickable arrows.
class _NavArrow extends StatelessWidget {
  const _NavArrow({
    required this.icon,
    required this.tokens,
    required this.onPressed,
  });

  final IconData icon;
  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.9),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: t.ink, size: 26),
      ),
    );
  }
}
