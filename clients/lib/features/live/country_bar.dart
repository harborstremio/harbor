import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/country_detect.dart' show CountryCount;

/// The flag emoji for a 2-letter ISO country code (regional-indicator letters).
String countryFlagEmoji(String code) {
  if (code.length != 2) return '';
  final up = code.toUpperCase();
  final a = up.codeUnitAt(0);
  final b = up.codeUnitAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return '';
  return String.fromCharCode(0x1F1E6 + a - 65) +
      String.fromCharCode(0x1F1E6 + b - 65);
}

/// The Live Home country filter — a horizontal strip of country chips (flag +
/// name + channel count) plus a Clear action once any is selected. Ports web
/// `CountryBar`; selecting a country swaps the category rails to that country's
/// groups.
class CountryBar extends StatelessWidget {
  const CountryBar({
    super.key,
    required this.tokens,
    required this.tr,
    required this.countries,
    required this.selected,
    required this.onToggle,
    required this.onClear,
    required this.gutter,
  });

  final HarborTokens tokens;
  final Translations tr;
  final List<CountryCount> countries;
  final List<String> selected;
  final void Function(String code) onToggle;
  final VoidCallback onClear;
  final double gutter;

  @override
  Widget build(BuildContext context) {
    if (countries.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(gutter, 0, gutter, 10),
          child: Row(
            children: [
              Text(
                tr.t('Browse by country'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (selected.isNotEmpty) ...[
                const SizedBox(width: 12),
                Focusable(
                  tokens: t,
                  borderRadius: 8,
                  onPressed: onClear,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    child: Text(
                      tr.t('Clear'),
                      style: TextStyle(
                        color: t.accent,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: gutter),
            itemCount: countries.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final c = countries[i];
              final on = selected.contains(c.country.code);
              return Focusable(
                tokens: t,
                borderRadius: 20,
                scale: 1.04,
                onPressed: () => onToggle(c.country.code),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: on ? t.accent : t.raised,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        countryFlagEmoji(c.country.code),
                        style: const TextStyle(fontSize: 15),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        c.country.short,
                        style: TextStyle(
                          color: on ? t.canvas : t.ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${c.count}',
                        style: TextStyle(
                          color: on
                              ? t.canvas.withValues(alpha: 0.75)
                              : t.inkSubtle,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
