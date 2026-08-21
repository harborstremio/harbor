import 'package:html/parser.dart' as html_parser;

import '../../core/http/text_transport.dart';

/// A single Letterboxd review scraped from a film's page. Ported from the web
/// `LetterboxdReview`.
class LetterboxdReview {
  const LetterboxdReview({
    required this.text,
    required this.author,
    this.authorUrl = '',
    this.avatar,
    this.rating,
    this.lang,
    this.date,
  });

  final String text;
  final String author;
  final String authorUrl;
  final String? avatar;

  /// The star rating as Letterboxd renders it (the svg `aria-label`, e.g.
  /// "★★★½"), or null when the reviewer left no rating.
  final String? rating;
  final String? lang;

  /// The review's ISO timestamp (`time.timestamp[datetime]`), or null.
  final String? date;
}

const _browserUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/// Scrapes up to twelve popular reviews from a film's Letterboxd main page
/// (`letterboxd.com/imdb/{imdbId}/`, which returns 200 — unlike the Cloudflare-
/// gated `/reviews/` path). Ported 1:1 from `fetchLetterboxdReviewsDirect`:
/// each `article.production-viewing` with a review body yields the text, author
/// (+ profile url / avatar), star rating, language, and date. Empty on any
/// failure or a Cloudflare challenge — a Letterboxd hiccup never surfaces.
Future<List<LetterboxdReview>> fetchLetterboxdReviews(
  TextTransport transport,
  String imdbId,
) async {
  if (imdbId.isEmpty) return const [];
  TextResponse res;
  try {
    res = await transport.getText(
      'https://letterboxd.com/imdb/$imdbId/',
      headers: const {
        'User-Agent': _browserUa,
        'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    );
  } catch (_) {
    return const [];
  }
  if (!res.ok) return const [];
  final body = res.body;
  if (body.contains('Just a moment...') || body.contains('__cf_chl_opt')) {
    return const [];
  }

  String abs(String path) => path.isEmpty
      ? ''
      : path.startsWith('http')
      ? path
      : 'https://letterboxd.com$path';

  final doc = html_parser.parse(body);
  final out = <LetterboxdReview>[];
  for (final art in doc.querySelectorAll('article.production-viewing')) {
    final bodyEl = art.querySelector('.js-review-body');
    if (bodyEl == null) continue;
    final text = bodyEl.text.trim();
    if (text.isEmpty) continue;

    final author = art.querySelector('.displayname')?.text.trim() ?? '';
    final authorUrl = abs(
      art.querySelector('a.avatar')?.attributes['href'] ?? '',
    );
    final avatarSrc = abs(
      art.querySelector('a.avatar img')?.attributes['src'] ?? '',
    );
    final rating = art
        .querySelector('.inline-rating svg')
        ?.attributes['aria-label'];
    final date = art.querySelector('time.timestamp')?.attributes['datetime'];

    out.add(
      LetterboxdReview(
        text: text,
        author: author,
        authorUrl: authorUrl,
        avatar: avatarSrc.isEmpty ? null : avatarSrc,
        rating: (rating != null && rating.isNotEmpty) ? rating : null,
        lang: bodyEl.attributes['lang'],
        date: date,
      ),
    );
    if (out.length >= 12) break;
  }
  return out;
}
