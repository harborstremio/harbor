import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

import '../../core/net/safe_launch.dart';
import '../../design/tokens.dart';

/// A native renderer for the (already server-rendered) HTML in AniList thread
/// bodies and comments. Ported from the web `sanitizeHtml` + `HtmlContent`: it
/// strips active/unsafe elements, neutralises `javascript:`/`data:` links, and
/// renders the remaining text with bold/italic/links/line-breaks as a single
/// `Text.rich` — no heavyweight HTML-widget dependency, and TV-safe (links open
/// externally). Unhandled tags degrade to their text content.
class AnilistHtml extends StatefulWidget {
  const AnilistHtml({
    super.key,
    required this.html,
    required this.tokens,
    this.baseStyle,
    this.maxLines,
  });

  final String html;
  final HarborTokens tokens;
  final TextStyle? baseStyle;
  final int? maxLines;

  /// Elements dropped entirely (matching the web sanitiser).
  static const _drop = {
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'link',
    'meta',
    'form',
    'input',
    'button',
    'svg',
  };

  static bool _safeUrl(String? url) {
    if (url == null || url.isEmpty) return false;
    // Allowlist http(s) only — a denylist of known-bad schemes leaks
    // intent:/file:/tel:/market:/custom-deeplink URIs that an attacker can post
    // in a comment and get launched. Whitespace/case is stripped first so a
    // padded/mixed-case scheme can't slip past.
    final v = url.replaceAll(RegExp(r'\s+'), '').toLowerCase();
    return v.startsWith('http://') || v.startsWith('https://');
  }

  @override
  State<AnilistHtml> createState() => _AnilistHtmlState();
}

class _AnilistHtmlState extends State<AnilistHtml> {
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  Future<void> _open(String url) => launchExternalUrl(url);

  @override
  Widget build(BuildContext context) {
    _disposeRecognizers();
    final t = widget.tokens;
    final base =
        widget.baseStyle ??
        TextStyle(color: t.inkMuted, fontSize: 13.5, height: 1.45);
    final body = html_parser.parseFragment(widget.html);
    final spans = _render(body, base, t, 0);
    return Text.rich(
      TextSpan(children: spans.isEmpty ? [const TextSpan(text: '')] : spans),
      maxLines: widget.maxLines,
      overflow: widget.maxLines != null
          ? TextOverflow.ellipsis
          : TextOverflow.clip,
    );
  }

  List<InlineSpan> _render(
    dom.Node node,
    TextStyle style,
    HarborTokens t, [
    int depth = 0,
  ]) {
    final out = <InlineSpan>[];
    // Untrusted comment HTML can nest thousands of tags deep; cap the recursion
    // and flatten the remainder to plain text so a pathological body degrades
    // gracefully instead of overflowing the build stack.
    if (depth > 64) {
      final text = node.text;
      if (text != null && text.isNotEmpty) {
        out.add(TextSpan(text: text, style: style));
      }
      return out;
    }
    void breakBefore() {
      if (out.isNotEmpty && !_endsWithNewline(out)) {
        out.add(const TextSpan(text: '\n'));
      }
    }

    for (final child in node.nodes) {
      if (child is dom.Text) {
        final text = child.text.replaceAll(RegExp(r'[ \t\r\n]+'), ' ');
        if (text.isNotEmpty) out.add(TextSpan(text: text, style: style));
        continue;
      }
      if (child is! dom.Element) continue;
      final tag = child.localName?.toLowerCase();
      if (tag == null || AnilistHtml._drop.contains(tag)) continue;
      switch (tag) {
        case 'br':
          out.add(const TextSpan(text: '\n'));
        case 'b':
        case 'strong':
          out.addAll(
            _render(
              child,
              style.copyWith(fontWeight: FontWeight.w700),
              t,
              depth + 1,
            ),
          );
        case 'i':
        case 'em':
          out.addAll(
            _render(
              child,
              style.copyWith(fontStyle: FontStyle.italic),
              t,
              depth + 1,
            ),
          );
        case 'a':
          final href = child.attributes['href'];
          final linkStyle = style.copyWith(color: t.accent);
          if (AnilistHtml._safeUrl(href)) {
            final rec = TapGestureRecognizer()..onTap = () => _open(href!);
            _recognizers.add(rec);
            out.add(
              TextSpan(
                children: _render(child, linkStyle, t, depth + 1),
                recognizer: rec,
              ),
            );
          } else {
            out.addAll(_render(child, style, t, depth + 1));
          }
        case 'img':
          final src = child.attributes['src'];
          if (AnilistHtml._safeUrl(src)) {
            final rec = TapGestureRecognizer()..onTap = () => _open(src!);
            _recognizers.add(rec);
            out.add(
              TextSpan(
                text: '🖼 image',
                style: style.copyWith(color: t.accent),
                recognizer: rec,
              ),
            );
          }
        case 'li':
          breakBefore();
          out.add(TextSpan(text: '• ', style: style));
          out.addAll(_render(child, style, t, depth + 1));
        case 'p':
        case 'div':
        case 'blockquote':
        case 'ul':
        case 'ol':
        case 'h1':
        case 'h2':
        case 'h3':
          breakBefore();
          out.addAll(_render(child, style, t, depth + 1));
          breakBefore();
        default:
          out.addAll(_render(child, style, t, depth + 1));
      }
    }
    return out;
  }

  bool _endsWithNewline(List<InlineSpan> spans) {
    final last = spans.last;
    return last is TextSpan && (last.text?.endsWith('\n') ?? false);
  }
}
