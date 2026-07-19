import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/languages.dart';
import 'settings_controls.dart';

/// The Language section — picks the app UI language (English, Arabic,
/// Portuguese). Arabic lays the whole app out right-to-left. Reads
/// [uiLanguageProvider]; writes the `uiLanguage` setting.
class LanguageSection extends ConsumerWidget {
  const LanguageSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final tr = ref.watch(translationsProvider);
    final current = ref.watch(uiLanguageProvider);
    final ctrl = ref.read(settingsProvider.notifier);
    return SettingsSection(
      tokens: t,
      title: tr.t('Language'),
      subtitle: tr.t(
        'Choose the app language. Arabic lays the interface out '
        'right-to-left.',
      ),
      children: [
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('App language'),
          value: current,
          onChanged: (code) => ctrl.setValue('uiLanguage', code),
          options: [
            for (final lang in languages)
              SettingRadioOption(
                value: lang.code,
                label: lang.nativeLabel,
                sub: lang.nativeLabel != lang.label ? lang.label : null,
              ),
          ],
        ),
      ],
    );
  }
}
