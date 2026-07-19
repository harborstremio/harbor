import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/color_picker.dart';
import '../../design/focus/focusable.dart';
import '../../design/themes.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';

/// The ten editable roles with a label + one-line purpose, ordered to match the
/// web `custom-editor.tsx`. Keys align with [kCustomColorKeys].
const List<(String key, String label, String blurb)> _roles = [
  ('canvas', 'Canvas', 'The app background behind everything.'),
  ('surface', 'Surface', 'Cards and rails.'),
  ('elevated', 'Elevated', 'Raised cards and menus.'),
  ('raised', 'Raised', 'Controls and inputs.'),
  ('ink', 'Ink', 'Primary text.'),
  ('inkMuted', 'Ink muted', 'Secondary text.'),
  ('inkSubtle', 'Ink subtle', 'Hints and tertiary text.'),
  ('edge', 'Edge', 'Borders and hairlines.'),
  ('accent', 'Accent', 'Brand, focus, and actions.'),
  ('danger', 'Danger', 'Destructive actions and errors.'),
];

/// Opens the custom-theme colour editor as a full page. Each edit writes to the
/// live theme (`preset: 'custom'`), so the whole app — including this editor's
/// own chrome — re-themes as the colour changes, mirroring the web's
/// `applyCustomColorsPreview`.
Future<void> showThemeCustomEditor(BuildContext context) {
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => const ThemeCustomEditorPage(),
    ),
  );
}

class ThemeCustomEditorPage extends ConsumerWidget {
  const ThemeCustomEditorPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final colors = ref.watch(customColorsProvider) ?? kDefaultCustomColors;
    final ctrl = ref.read(themeIdProvider.notifier);

    Future<void> edit(String key) async {
      final picked = await showHarborColorPicker(
        context,
        initial: colors[key] ?? '#000000',
        tokens: t,
      );
      if (picked != null) {
        ctrl.setCustomColors(Map<String, String>.from(colors)..[key] = picked);
      }
    }

    return Scaffold(
      backgroundColor: t.canvas,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _header(context, t, ctrl, tr),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 40),
                    children: [
                      Text(
                        tr.t(
                          'Tap a colour to change it. Changes apply to the '
                          'whole app immediately.',
                        ),
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 16),
                      for (final (key, label, blurb) in _roles)
                        _ColorRow(
                          tokens: t,
                          label: tr.t(label),
                          blurb: tr.t(blurb),
                          hex: colors[key] ?? '#000000',
                          onTap: () => edit(key),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(
    BuildContext context,
    HarborTokens t,
    ThemeIdController ctrl,
    Translations tr,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 20, 8),
      child: Row(
        children: [
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => Navigator.of(context).maybePop(),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(Icons.arrow_back, color: t.ink, size: 22),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr.t('Custom theme'),
              style: TextStyle(
                color: t.ink,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => ctrl.setCustomColors(
              Map<String, String>.from(kDefaultCustomColors),
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: t.edge),
              ),
              child: Text(
                tr.t('Reset'),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ColorRow extends StatelessWidget {
  const _ColorRow({
    required this.tokens,
    required this.label,
    required this.blurb,
    required this.hex,
    required this.onTap,
  });

  final HarborTokens tokens;
  final String label;
  final String blurb;
  final String hex;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Focusable(
        tokens: t,
        borderRadius: 14,
        onPressed: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: t.ink,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      blurb,
                      style: TextStyle(color: t.inkSubtle, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                hex.toUpperCase(),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 12.5,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: hexToColor(hex),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: t.edge),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
