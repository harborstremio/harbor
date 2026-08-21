import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';

class _Lang {
  const _Lang(this.code, this.native, this.name, this.flags);
  final String code;
  final String native;
  final String name;
  final List<String> flags;
}

/// The Home-languages multi-select — the native port of `HomeLanguagePicker`.
/// Toggling a language writes `homeLanguages` (an original-language allow-list);
/// the Home catalogs filter to the selected set, or show everything when empty.
class HomeLanguagePicker extends ConsumerWidget {
  const HomeLanguagePicker({super.key, required this.tokens});

  final HarborTokens tokens;

  static const _langs = <_Lang>[
    _Lang('en', 'English', 'English', ['us']),
    _Lang('es', 'Español', 'Spanish', ['es', 'mx']),
    _Lang('fr', 'Français', 'French', ['fr']),
    _Lang('de', 'Deutsch', 'German', ['de']),
    _Lang('it', 'Italiano', 'Italian', ['it']),
    _Lang('sv', 'Svenska', 'Swedish', ['se']),
    _Lang('pt', 'Português', 'Portuguese', ['pt', 'br']),
    _Lang('ru', 'Русский', 'Russian', ['ru']),
    _Lang('tr', 'Türkçe', 'Turkish', ['tr']),
    _Lang('ar', 'العربية', 'Arabic', ['sa']),
    _Lang('hi', 'हिन्दी', 'Hindi', ['in']),
    _Lang('ta', 'தமிழ்', 'Tamil', ['in']),
    _Lang('zh', '中文', 'Chinese', ['cn']),
    _Lang('ja', '日本語', 'Japanese', ['jp']),
    _Lang('ko', '한국어', 'Korean', ['kr']),
  ];

  /// The regional-indicator flag emoji for a two-letter country code.
  static String _flag(String cc) {
    const base = 0x1F1E6; // regional indicator 'A'
    final up = cc.toUpperCase();
    return String.fromCharCodes([
      base + (up.codeUnitAt(0) - 0x41),
      base + (up.codeUnitAt(1) - 0x41),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final tr = ref.watch(translationsProvider);
    final selected = ref.watch(settingsProvider).getStringList('homeLanguages');
    final ctrl = ref.read(settingsProvider.notifier);
    final count = selected.length;

    void toggle(String code) => ctrl.setValue('homeLanguages', [
      for (final c in selected)
        if (c != code) c,
      if (!selected.contains(code)) code,
    ]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Summary bar: language count + Clear.
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Icon(
                Icons.language,
                size: 16,
                color: count > 0 ? t.accent : t.inkSubtle,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  count == 0
                      ? tr.t('No filter. Home shows every language.')
                      : count == 1
                      ? tr.t('1 language. Home filters to it.')
                      : tr.t('{n} languages. Home filters to these.', {
                          'n': count,
                        }),
                  style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                ),
              ),
              if (count > 0)
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 8,
                  onPressed: () => ctrl.setValue('homeLanguages', const []),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    child: Text(
                      tr.t('Clear'),
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Language chip grid.
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final lang in _langs)
                SizedBox(
                  width: 150,
                  child: _chip(
                    t,
                    lang,
                    selected.contains(lang.code),
                    toggle,
                    tr,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _chip(
    HarborTokens t,
    _Lang lang,
    bool on,
    void Function(String) toggle,
    Translations tr,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 12,
    onPressed: () => toggle(lang.code),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: on ? t.accentSoft : t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: on ? t.accent : t.edgeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  lang.native,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: on ? t.ink : t.inkMuted,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Container(
                width: 16,
                height: 16,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: on ? t.accent : Colors.transparent,
                  border: on ? null : Border.all(color: t.edgeSoft),
                ),
                child: on ? Icon(Icons.check, size: 10, color: t.canvas) : null,
              ),
            ],
          ),
          const SizedBox(height: 3),
          Row(
            children: [
              Text(
                lang.flags.map(_flag).join(' '),
                style: const TextStyle(fontSize: 12),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  tr.t(lang.name),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: t.inkSubtle, fontSize: 11),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
