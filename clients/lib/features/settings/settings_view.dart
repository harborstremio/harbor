import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/sfx_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/themes.dart';
import '../../design/tokens.dart';
import 'aiostatus_health.dart';
import 'stream_previews.dart';
import '../../domain/ai/ai_models.dart';
import '../../domain/catalog/streaming.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/streams/parser/stream_enums.dart';
import '../../domain/language/language_names.dart';
import '../../domain/player/crop_modes.dart';
import '../../domain/player/player_capabilities.dart';
import '../../domain/settings/settings.dart';
import '../player/player_host_os.dart';
import '../../domain/anime/anime_filter.dart';
import 'account_section.dart';
import 'anime4k_section.dart';
import 'bug_report_section.dart';
import 'letterboxd_section.dart';
import 'nav_customization_section.dart';
import 'stream_filters_section.dart';
import 'parental_section.dart';
import 'anilist_section.dart';
import 'language_section.dart';
import 'mal_section.dart';
import 'simkl_section.dart';
import 'theme_custom_editor.dart';
import 'trakt_section.dart';
import 'home_language_picker.dart';
import 'settings_categories.dart';
import 'settings_controls.dart';

/// The settings page — a category master/detail matching the web
/// `views/settings.tsx` layout (`20-settings-and-themes.md`): a grouped sidebar
/// selects one category, and the pane renders that category's title, subtitle
/// and only its own sections, so a page ends at its last setting rather than
/// bleeding into the next category.
///
/// Wide idioms (tablet / TV / desktop) get the sidebar; a phone drops it for a
/// top drop-down picker, since a permanent rail would eat the narrow width.
class SettingsView extends ConsumerStatefulWidget {
  const SettingsView({super.key, this.initialCategoryId});

  /// The category to open on, e.g. the TMDB nudge deep-links to `'library'`
  /// (mirrors the web `openSettings("library")`). Falls back to the default
  /// panel when null or unknown.
  final String? initialCategoryId;

  @override
  ConsumerState<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends ConsumerState<SettingsView> {
  late String _activeId = _resolveInitialCategory(widget.initialCategoryId);

  static String _resolveInitialCategory(String? id) =>
      (id != null && kSettingsCategories.any((c) => c.id == id))
      ? id
      : kDefaultSettingsCategoryId;

  void _select(String id) => setState(() => _activeId = id);

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final settings = ref.watch(settingsProvider);
    final ctrl = ref.read(settingsProvider.notifier);
    void setBool(String key, bool v) => ctrl.setValue(key, v);

    final idiom = Idiom.of(context);
    final cat = settingsCategoryById(_activeId);
    final g = idiom.isPhone ? 16.0 : 32.0;

    Widget section(String label) =>
        _sectionFor(label, context, t, tr, settings, ctrl, setBool);

    final pane = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 820),
        // Keyed on the category so switching pages starts at the top rather
        // than inheriting the previous page's scroll offset.
        child: SingleChildScrollView(
          key: ValueKey('settings-pane-${cat.id}'),
          padding: EdgeInsets.fromLTRB(g, idiom.isPhone ? 20 : 32, g, 160),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tr.t(cat.label),
                style: TextStyle(
                  color: t.ink,
                  fontSize: idiom.isPhone ? 30 : 40,
                  fontWeight: FontWeight.w600,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                tr.t(cat.sub),
                style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.45),
              ),
              const SizedBox(height: 28),
              for (final label in cat.sections) ...[
                section(label),
                const SizedBox(height: 34),
              ],
            ],
          ),
        ),
      ),
    );

    return Container(
      color: t.canvas,
      child: SafeArea(
        child: idiom.hasSideRail
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(width: 268, child: _sidebar(t, tr)),
                  Expanded(child: pane),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _categoryPicker(t, tr, cat),
                  Expanded(child: pane),
                ],
              ),
      ),
    );
  }

  /// The grouped category sidebar — the wide-idiom counterpart of the web
  /// settings nav (`NAV_GROUPS`). Every entry is [Focusable] so a TV remote can
  /// walk the list and Select to open a page.
  Widget _sidebar(HarborTokens t, Translations tr) => Container(
    color: t.surface,
    child: FocusTraversalGroup(
      policy: ReadingOrderTraversalPolicy(),
      child: ListView(
        key: const Key('settings-sidebar'),
        padding: const EdgeInsets.fromLTRB(12, 24, 12, 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 18),
            child: Text(
              tr.tOr('nav.settings', 'Settings'),
              style: TextStyle(
                color: t.ink,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          for (final group in kSettingsGroups) ...[
            if (group.heading != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
                child: Text(
                  tr.t(group.heading!).toUpperCase(),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                  ),
                ),
              ),
            for (final c in group.categories) _navItem(t, tr, c),
          ],
        ],
      ),
    ),
  );

  Widget _navItem(HarborTokens t, Translations tr, SettingsCategory c) {
    final active = c.id == _activeId;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Focusable(
        key: Key('settings-nav-${c.id}'),
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        // Land the remote on the selected category so Settings opens with a
        // visible focus target on a TV.
        autofocus: active,
        onPressed: () => _select(c.id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: active ? t.accentSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(c.icon, size: 18, color: active ? t.accent : t.inkSubtle),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  tr.t(c.label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active ? t.ink : t.inkMuted,
                    fontSize: 13.5,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The phone counterpart of the sidebar: a top drop-down that opens the full
  /// grouped category list, so every page stays one tap away on a narrow screen.
  Widget _categoryPicker(
    HarborTokens t,
    Translations tr,
    SettingsCategory cat,
  ) => Container(
    key: const Key('settings-category-picker'),
    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
    decoration: BoxDecoration(
      color: t.surface,
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
    ),
    child: Builder(
      builder: (anchorCtx) => Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: () => _openCategoryMenu(anchorCtx, t, tr),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: t.elevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Icon(cat.icon, size: 18, color: t.accent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  tr.t(cat.label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.expand_more, size: 20, color: t.inkMuted),
            ],
          ),
        ),
      ),
    ),
  );

  Future<void> _openCategoryMenu(
    BuildContext anchorCtx,
    HarborTokens t,
    Translations tr,
  ) async {
    final box = anchorCtx.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(anchorCtx).context.findRenderObject() as RenderBox?;
    if (box == null || overlay == null) return;
    final origin = box.localToGlobal(Offset.zero, ancestor: overlay);
    final position = RelativeRect.fromLTRB(
      origin.dx,
      origin.dy + box.size.height + 6,
      overlay.size.width - origin.dx - box.size.width,
      0,
    );
    final picked = await showMenu<String>(
      context: anchorCtx,
      position: position,
      color: t.elevated,
      constraints: const BoxConstraints(minWidth: 240),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: t.edgeSoft),
      ),
      items: [
        for (final group in kSettingsGroups) ...[
          if (group.heading != null)
            PopupMenuItem<String>(
              enabled: false,
              height: 30,
              child: Text(
                tr.t(group.heading!).toUpperCase(),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
            ),
          for (final c in group.categories)
            PopupMenuItem<String>(
              key: Key('settings-menu-${c.id}'),
              value: c.id,
              height: 44,
              child: Row(
                children: [
                  Icon(
                    c.icon,
                    size: 17,
                    color: c.id == _activeId ? t.accent : t.inkSubtle,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      tr.t(c.label),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.id == _activeId ? t.accent : t.ink,
                        fontSize: 14,
                        fontWeight: c.id == _activeId
                            ? FontWeight.w600
                            : FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
    if (picked != null) _select(picked);
  }

  /// Builds a single settings section by its stable English label. Only the
  /// active category's sections are built, so a page costs one category rather
  /// than all 38 sections.
  Widget _sectionFor(
    String label,
    BuildContext context,
    HarborTokens t,
    Translations tr,
    Settings settings,
    SettingsController ctrl,
    void Function(String, bool) setBool,
  ) => switch (label) {
    'Account' => AccountSection(tokens: t),
    'Parental controls' => ParentalSection(tokens: t),
    'Language' => LanguageSection(tokens: t),
    'Trakt' => TraktSection(tokens: t),
    'Simkl' => SimklSection(tokens: t),
    'AniList' => AnilistSection(tokens: t),
    'MyAnimeList' => MalSection(tokens: t),
    'Letterboxd' => LetterboxdSection(tokens: t),
    'Metadata & API keys' => _apiKeysSection(settings, t, ctrl),
    'AI search' => _aiSearchSection(settings, t, ctrl),
    'Streaming sources' => _streamingSection(settings, t, setBool, ctrl),
    'Streaming catalogs' => _streamingCatalogsSection(settings, t, ctrl),
    'Debrid services' => _debridKeysSection(settings, t, ctrl),
    'Stream filters' => StreamFiltersSection(tokens: t),
    'Theme' => _themeSection(context, ref, t),
    'Home layout' => _homeLayoutSection(settings, t, setBool, ctrl),
    'Home languages' => SettingsSection(
      tokens: t,
      title: tr.t('Home languages'),
      subtitle: tr.t(
        'Only show titles in these original languages on the Home '
        'catalogs. Leave all off to show everything.',
      ),
      children: [HomeLanguagePicker(tokens: t)],
    ),
    'Languages' => _languagesSection(settings, t, ctrl),
    'Spoilers' => _spoilersSection(settings, t, setBool),
    'Episode cards' => _episodeCardsSection(settings, t, setBool),
    'Detail page' => _detailPageSection(settings, t, setBool),
    'Skip intros & credits' => _skipSection(settings, t, setBool, ctrl),
    'Player engine' => _playerEngineSection(settings, t, ctrl),
    'Playback' => _playbackSection(settings, t, setBool, ctrl),
    'Seek bar' => _seekBarSection(settings, t, ctrl),
    'Aspect ratio' => _aspectSection(settings, t, ctrl),
    'Picture quality' => _pictureQualitySection(settings, t, ctrl),
    'Hardware acceleration' => _hardwareAccelSection(settings, t, ctrl),
    'Color & HDR' => _colorHdrSection(settings, t, ctrl),
    'Anime4K presets' => Anime4kSection(tokens: t),
    'Smooth motion' => _smoothMotionSection(settings, t, setBool),
    'Connection' => _bufferSection(settings, t, setBool),
    'Audio downmix' => _downmixSection(settings, t, setBool),
    'Title text' => _titleTextSection(settings, t, setBool, ctrl),
    'Poster card style' => _posterCardSection(settings, t, ctrl),
    'Subtitle style' => _subtitleSection(settings, t, setBool, ctrl),
    'Navigation' => NavCustomizationSection(tokens: t),
    'Sound effects' => _soundSection(settings, t, ctrl),
    'Report a bug' => BugReportSection(tokens: t),
    _ => const SizedBox.shrink(),
  };

  Widget _apiKeysSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Metadata & API keys'),
      subtitle: tr.t(
        'Personal keys unlock richer catalogs, posters, and ratings. Each '
        'key is stored securely on this device, never in plaintext.',
      ),
      children: [
        SettingKeyField(
          tokens: t,
          label: tr.t('TMDB · catalogs and rails'),
          placeholder: tr.t('v3 API key'),
          value: s.tmdbKey,
          onSave: (v) => ctrl.setValue('tmdbKey', v),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('OMDb · Rotten Tomatoes scores'),
          placeholder: tr.t('8-character key'),
          value: s.omdbKey,
          onSave: (v) => ctrl.setValue('omdbKey', v),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('RPDB · scores baked into posters'),
          placeholder: tr.t('rpdb key'),
          value: s.rpdbKey,
          onSave: (v) => ctrl.setValue('rpdbKey', v),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('MDBList · Letterboxd and Trakt scores'),
          placeholder: tr.t('mdblist api key'),
          value: s.mdblistKey,
          onSave: (v) => ctrl.setValue('mdblistKey', v),
        ),
      ],
    );
  }

  /// The AI-search settings: pick a provider (OpenRouter or Groq — derived from
  /// the chosen model), enter that provider's key, and choose the model. Ported
  /// from the web `AiSearchSection`; the Jina live-web-context options are left
  /// out until that enrichment ships. Switching provider resets the model to the
  /// new provider's first entry, mirroring the web.
  Widget _aiSearchSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tr = ref.watch(translationsProvider);
    final configured = s.getString('aiSearchModel').trim();
    final model = configured.isEmpty ? kDefaultAiModel : configured;
    final isGroq = providerForModel(model) == AiProvider.groq;
    final models = isGroq ? kGroqModels : kAiModels;
    return SettingsSection(
      tokens: t,
      title: tr.t('AI search'),
      subtitle: tr.t(
        'Type what you want in plain language and let a model find it. '
        'Bring your own OpenRouter or Groq API key.',
      ),
      children: [
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Provider'),
          value: isGroq ? 'groq' : 'openrouter',
          onChanged: (v) {
            if (v == 'groq' && !isGroq) {
              ctrl.setValue('aiSearchModel', kGroqModels.first.id);
            } else if (v == 'openrouter' && isGroq) {
              ctrl.setValue('aiSearchModel', kAiModels.first.id);
            }
          },
          options: const [
            SettingOption(value: 'openrouter', label: 'OpenRouter'),
            SettingOption(value: 'groq', label: 'Groq'),
          ],
        ),
        SettingKeyField(
          tokens: t,
          label: isGroq
              ? tr.t('Groq · LPU inference')
              : tr.t('OpenRouter · natural-language search'),
          placeholder: isGroq
              ? tr.t('Groq API key (gsk-…)')
              : tr.t('OpenRouter key (sk-or-…)'),
          value: isGroq ? s.getString('aiGroqKey') : s.getString('aiSearchKey'),
          onSave: (v) =>
              ctrl.setValue(isGroq ? 'aiGroqKey' : 'aiSearchKey', v.trim()),
        ),
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('Model'),
          value: model,
          onChanged: (v) => ctrl.setValue('aiSearchModel', v),
          options: [
            for (final m in models)
              SettingRadioOption(
                value: m.id,
                label: m.label,
                sub: m.free ? tr.t('Free') : kProviderName[m.provider],
              ),
          ],
        ),
        // Live web (Jina Reader) enrichment: an optional web search that grounds
        // the model in current results before it answers.
        SettingToggleRow(
          tokens: t,
          label: tr.t('Use live web context'),
          sub: tr.t(
            'Before asking the model, fetch DuckDuckGo results through Jina '
            'Reader and feed the top hits into the prompt. Works without a '
            'key at low volume; add a Jina key below for higher quotas.',
          ),
          value: s.getBool('aiWebSearch'),
          onChanged: (v) => ctrl.setValue('aiWebSearch', v),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('Jina API key · optional'),
          placeholder: 'jina_…',
          value: s.getString('jinaKey'),
          onSave: (v) => ctrl.setValue('jinaKey', v.trim()),
        ),
      ],
    );
  }

  Widget _languagesSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Languages'),
      subtitle: tr.t(
        'Which languages Harbor prefers when ranking streams and choosing '
        'an audio track.',
      ),
      children: [
        SettingLanguagePicker(
          tokens: t,
          label: tr.t('Preferred stream languages'),
          subtitle: tr.t(
            'Streams in these languages rank first in the picker.',
          ),
          value: s.getStringList('preferredLanguages'),
          onChanged: (v) => ctrl.setValue('preferredLanguages', v),
          options: allLanguageNames,
        ),
        SettingLanguagePicker(
          tokens: t,
          label: tr.t('Preferred audio languages'),
          subtitle: tr.t(
            'The player auto-selects the first matching audio track when '
            'a title has more than one.',
          ),
          value: s.getStringList('preferredAudioLangs'),
          onChanged: (v) => ctrl.setValue('preferredAudioLangs', v),
          options: allLanguageNames,
        ),
        SettingLanguagePicker(
          tokens: t,
          label: tr.t('Preferred subtitle languages'),
          subtitle: tr.t(
            'The player loads and auto-selects subtitles in these languages, '
            'and searches for them first.',
          ),
          value: s.getStringList('preferredSubLangs'),
          onChanged: (v) => ctrl.setValue('preferredSubLangs', v),
          options: allLanguageNames,
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Only show preferred languages'),
          sub: tr.t(
            'Open the source list already filtered to your preferred languages '
            '(sources with no language, or marked Multi, always show). The '
            'Preferred language pill in the picker toggles it per title.',
          ),
          value: s.getBool('requirePreferredLanguage'),
          onChanged: (v) => ctrl.setValue('requirePreferredLanguage', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Start with subtitles off'),
          sub: tr.t(
            "Harbor still finds and loads subtitles so they're one click away "
            "in the player, it just won't turn them on automatically.",
          ),
          value: s.getBool('subtitlesOffByDefault'),
          onChanged: (v) => ctrl.setValue('subtitlesOffByDefault', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Choose subtitles before playing'),
          sub: tr.t(
            'Show a subtitle picker each time you start a title, so you can '
            'pick the exact track (or none) up front instead of in the player.',
          ),
          value: s.getBool('subtitlePreselect'),
          onChanged: (v) => ctrl.setValue('subtitlePreselect', v),
        ),
      ],
    );
  }

  Widget _streamingSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final level = s.getString('streamFilterLevel');
    return SettingsSection(
      tokens: t,
      title: tr.t('Streaming sources'),
      subtitle: tr.t(
        'How the play picker filters, sorts, and lays out the streams your '
        'add-ons return.',
      ),
      children: [
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('Stream safety filter'),
          value: level.isEmpty ? 'strict' : level,
          onChanged: (v) => ctrl.setValue('streamFilterLevel', v),
          options: [
            SettingRadioOption(
              value: 'strict',
              label: tr.t('Strict'),
              sub: tr.t(
                'Default. Rejects size outliers, suspicious extensions, '
                'year/episode mismatches, season packs for episode requests, '
                'trailers, and likely cams.',
              ),
            ),
            SettingRadioOption(
              value: 'balanced',
              label: tr.t('Balanced'),
              sub: tr.t(
                'Keeps the malware, year, and episode-mismatch checks but '
                'allows season packs and oversized files.',
              ),
            ),
            SettingRadioOption(
              value: 'off',
              label: tr.t('Off'),
              sub: tr.t(
                'No filtering. Every stream every add-on returns shows up, '
                'including obvious junk.',
              ),
            ),
          ],
        ),
        StreamFilterPreview(level: level.isEmpty ? 'strict' : level, tokens: t),
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('Result order'),
          value: s.getString('streamSort').isEmpty
              ? 'addon'
              : s.getString('streamSort'),
          onChanged: (v) => ctrl.setValue('streamSort', v),
          options: [
            SettingRadioOption(
              value: 'harbor',
              label: tr.t('Harbor ranking'),
              sub: tr.t('Puts the best-scoring sources first.'),
            ),
            SettingRadioOption(
              value: 'addon',
              label: tr.t('Addon order'),
              sub: tr.t(
                "Follows your add-on priority and keeps each add-on's "
                'results in the order it returned them.',
              ),
            ),
          ],
        ),
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('Picker layout'),
          value: s.getString('pickerLayout').isEmpty
              ? 'stremio'
              : s.getString('pickerLayout'),
          onChanged: (v) => ctrl.setValue('pickerLayout', v),
          options: [
            SettingRadioOption(
              value: 'condensed',
              label: tr.t('Condensed'),
              sub: tr.t('A top pick, quality tiles, and a drawer.'),
            ),
            SettingRadioOption(
              value: 'stremio',
              label: tr.t('Stremio'),
              sub: tr.t('A flat list grouped by add-on, no scoring.'),
            ),
          ],
        ),
        PickerLayoutPreview(
          condensed:
              (s.getString('pickerLayout').isEmpty
                  ? 'stremio'
                  : s.getString('pickerLayout')) ==
              'condensed',
          tokens: t,
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show torrent name'),
          sub: tr.t(
            "Show each source's full release filename on the condensed "
            'layout.',
          ),
          value: s.getBool('pickerShowFilename'),
          onChanged: (v) => setBool('pickerShowFilename', v),
        ),
        TorrentNamePreview(on: s.getBool('pickerShowFilename'), tokens: t),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show full descriptions'),
          sub: tr.t(
            "Show each add-on's full description on the Stremio layout. Off "
            'condenses it to a few lines.',
          ),
          value: s.getBool('fullStreamDescription'),
          onChanged: (v) => setBool('fullStreamDescription', v),
        ),
        StreamDescriptionPreview(
          full: s.getBool('fullStreamDescription'),
          tokens: t,
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show format chips on stream rows'),
          sub: tr.t(
            'Tag each source with resolution, HDR flavor, codec, and audio '
            'format. Off hides them all.',
          ),
          value: s.getBool('showQualityBadge'),
          onChanged: (v) => setBool('showQualityBadge', v),
        ),
        AdSkipShowcase(tokens: t),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Enable injected ad skip (experimental)'),
          sub: tr.t(
            'Some cam and new-release rips have ads spliced into the video. '
            'When the community has marked one, a Skip button appears and you '
            'can report ads you spot. Off by default.',
          ),
          value: s.getBool('adSkipEnabled'),
          onChanged: (v) => setBool('adSkipEnabled', v),
        ),
        if (s.getBool('adSkipEnabled')) ...[
          SettingToggleRow(
            tokens: t,
            label: tr.t('Always show the report button'),
            sub: tr.t(
              'Show the report button on every torrent stream, not just likely '
              'new releases.',
            ),
            value: s.getBool('adReportAlwaysShow'),
            onChanged: (v) => setBool('adReportAlwaysShow', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('Skip injected ads automatically'),
            sub: tr.t(
              'Jump past a known injected ad on its own instead of showing the '
              'Skip button.',
            ),
            value: s.getBool('autoSkipAd'),
            onChanged: (v) => setBool('autoSkipAd', v),
          ),
        ],
      ],
    );
  }

  /// Per-service toggles for the Home streaming catalogs — the same set the web
  /// Streaming Sources panel exposes. Writes the `streaming` map read by
  /// [enabledStreamingServicesProvider]; needs a TMDB key to have any effect.
  Widget _streamingCatalogsSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final streaming = s.getMap('streaming');
    void toggle(String id, bool on) {
      final next = Map<String, dynamic>.from(s.getMap('streaming'));
      next[id] = on;
      ctrl.setValue('streaming', next);
    }

    return SettingsSection(
      tokens: t,
      title: tr.t('Streaming catalogs'),
      subtitle: tr.t(
        "Top titles per service on Home. Toggle off the ones you don't pay for.",
      ),
      children: [
        for (final id in kServiceOrder)
          if (kServices[id] != null)
            SettingToggleRow(
              tokens: t,
              label: kServices[id]!.name,
              value: streaming[id] != false,
              onChanged: (v) => toggle(id, v),
            ),
        if (s.tmdbKey.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              tr.t(
                'Save a TMDB key in Metadata & API keys to turn on streaming '
                'catalogs.',
              ),
              style: TextStyle(color: t.inkSubtle, fontSize: 13, height: 1.4),
            ),
          ),
      ],
    );
  }

  Widget _debridKeysSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final health = ref.watch(aioStatusHealthProvider).asData?.value?.health;
    Widget? badge(DebridSlug slug) =>
        health == null ? null : HealthBadge(health: health[slug], tokens: t);
    return SettingsSection(
      tokens: t,
      title: tr.t('Debrid services'),
      subtitle: tr.t(
        'Cached-torrent providers for instant, high-quality streams. Keys are '
        'stored securely on this device.',
      ),
      children: [
        AioStatusBanner(tokens: t),
        SettingKeyField(
          tokens: t,
          label: tr.t('Real-Debrid API token'),
          placeholder: tr.t('API token'),
          value: s.rdKey,
          onSave: (v) => ctrl.setValue('rdKey', v),
          trailing: badge(DebridSlug.rd),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('TorBox API key'),
          placeholder: tr.t('API key'),
          value: s.tbKey,
          onSave: (v) => ctrl.setValue('tbKey', v),
          trailing: badge(DebridSlug.tb),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('AllDebrid API key'),
          placeholder: tr.t('API key'),
          value: s.adKey,
          onSave: (v) => ctrl.setValue('adKey', v),
          trailing: badge(DebridSlug.ad),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('Premiumize API key'),
          placeholder: tr.t('API key'),
          value: s.pmKey,
          onSave: (v) => ctrl.setValue('pmKey', v),
          trailing: badge(DebridSlug.pm),
        ),
        SettingKeyField(
          tokens: t,
          label: tr.t('Debrid-Link API key'),
          placeholder: tr.t('API key'),
          value: s.dlKey,
          onSave: (v) => ctrl.setValue('dlKey', v),
          trailing: badge(DebridSlug.dl),
        ),
      ],
    );
  }

  Widget _themeSection(BuildContext context, WidgetRef ref, HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    final currentId = ref.watch(themeIdProvider);
    final ctrl = ref.read(themeIdProvider.notifier);
    final presets = kThemePresets.where((p) => !p.hidden).toList();
    return SettingsSection(
      tokens: t,
      title: tr.t('Theme'),
      subtitle: tr.t('The colour theme for the whole app.'),
      children: [
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final p in presets)
                SizedBox(
                  width: 220,
                  child: _themeCard(t, p, p.id == currentId, () {
                    if (p.id != currentId) ctrl.setId(p.id);
                  }),
                ),
              SizedBox(
                width: 220,
                child: _customThemeCard(context, ref, t, currentId == 'custom'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          tr.t('FEATURED'),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          tr.t('Community-inspired palettes ported to Harbor.'),
          style: TextStyle(color: t.inkSubtle, fontSize: 12.5, height: 1.35),
        ),
        const SizedBox(height: 14),
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final p in kFeaturedThemePresets)
                SizedBox(
                  width: 220,
                  child: _themeCard(t, p, p.id == currentId, () {
                    if (p.id != currentId) ctrl.setId(p.id);
                  }),
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// The "Custom" tile — activates a custom palette (seeded from the saved one or
  /// the default) and opens the colour editor.
  Widget _customThemeCard(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    bool selected,
  ) {
    final tr = ref.watch(translationsProvider);
    final colors = ref.watch(customColorsProvider) ?? kDefaultCustomColors;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 14,
      onPressed: () {
        ref
            .read(themeIdProvider.notifier)
            .setCustomColors(Map<String, String>.from(colors));
        showThemeCustomEditor(context);
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? t.accent : t.edgeSoft,
            width: selected ? 3 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (final key in const [
                  'surface',
                  'accent',
                  'ink',
                  'inkMuted',
                ])
                  Container(
                    width: 22,
                    height: 22,
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: hexToColor(colors[key] ?? '#000000'),
                      shape: BoxShape.circle,
                      border: Border.all(color: t.edgeSoft),
                    ),
                  ),
                const Spacer(),
                Icon(Icons.tune, size: 16, color: t.inkSubtle),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              tr.t('Custom'),
              style: TextStyle(
                color: t.ink,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              tr.t('Build your own palette'),
              style: TextStyle(color: t.inkSubtle, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _themeCard(
    HarborTokens t,
    ThemePreset preset,
    bool selected,
    VoidCallback onTap,
  ) {
    final p = preset.tokens;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 14,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: p.canvas,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? t.accent : t.edgeSoft,
            width: selected ? 3 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // A small preview built from the preset's own palette.
            Row(
              children: [
                for (final c in [p.surface, p.accent, p.ink, p.inkMuted])
                  Container(
                    width: 22,
                    height: 22,
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: c,
                      shape: BoxShape.circle,
                      border: Border.all(color: p.edgeSoft),
                    ),
                  ),
                const Spacer(),
                if (selected)
                  Icon(Icons.check_circle, color: p.accent, size: 20),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              preset.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: p.ink,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (preset.blurb != null) ...[
              const SizedBox(height: 3),
              Text(
                preset.blurb!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: p.inkSubtle, fontSize: 11, height: 1.3),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _homeLayoutSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Home layout'),
      subtitle: tr.t('How the Home page assembles its rails.'),
      children: [
        SettingOptionCards<String>(
          tokens: t,
          value: s.getString('homeMode').isEmpty
              ? 'harbor'
              : s.getString('homeMode'),
          onChanged: (v) => ctrl.setValue('homeMode', v),
          options: [
            SettingOption(
              value: 'harbor',
              label: tr.t('Harbor curated'),
              sub: tr.t(
                'Hero carousel, Top 10, Trending, In Theaters, per-service '
                'rails. Addon catalogs append underneath, deduped.',
              ),
            ),
            SettingOption(
              value: 'classic',
              label: tr.t('Classic Stremio'),
              sub: tr.t(
                'Continue Watching, then your installed addons. Every catalog '
                'renders as its own row, install order, no dedup, no hero.',
              ),
            ),
          ],
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show every addon row'),
          sub: tr.t(
            "By default, addon rails that duplicate the built-in ones "
            "(Trending, Popular, Top Rated, etc.) are merged so you don't see "
            "the same row twice. Turn this on to show every one, duplicates "
            "and all.",
          ),
          value: s.getBool('homeShowAllAddonRows'),
          onChanged: (v) => setBool('homeShowAllAddonRows', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Watchlist shows only saved titles'),
          sub: tr.t(
            'Keep the Library Watchlist tab limited to titles you added in '
            'Stremio. Turn this off to also include anything Stremio '
            'auto-added when you pressed play.',
          ),
          value: s.getBool('libraryBookmarkedOnly'),
          onChanged: (v) => setBool('libraryBookmarkedOnly', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show Playlists tab'),
          sub: tr.t(
            'Adds a Playlists item to the navigation for browsing movies and '
            'shows from your M3U or Xtream playlists (the same ones you add '
            'for Live TV). Off by default to keep the nav tidy.',
          ),
          value: s.getBool('showPlaylistsTab'),
          onChanged: (v) => setBool('showPlaylistsTab', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Keep anime in the Anime room only'),
          sub: tr.t(
            'Hides anime from the Home Continue Watching row. It still appears '
            "in the Anime tab's own Continue Watching.",
          ),
          value: s.getBool('animeOnlyInAnimeRoom'),
          onChanged: (v) => setBool('animeOnlyInAnimeRoom', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Hide watched anime picks'),
          sub: tr.t('Drop titles you have already watched from the Anime rows.'),
          value: s.getBool('animeHideWatchedPicks'),
          onChanged: (v) => setBool('animeHideWatchedPicks', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show DUB badge'),
          sub: tr.t('Mark anime that has an English dub with a DUB badge.'),
          value: s.getBool('showDubBadge'),
          onChanged: (v) => setBool('showDubBadge', v),
        ),
        for (final o in animeOriginOptions)
          SettingToggleRow(
            tokens: t,
            label: tr.t('Hide {origin} anime', {'origin': tr.t(o.label)}),
            value: s.getStringList('animeExcludeOrigins').contains(o.code),
            onChanged: (v) {
              final next = [...s.getStringList('animeExcludeOrigins')];
              if (v) {
                if (!next.contains(o.code)) next.add(o.code);
              } else {
                next.remove(o.code);
              }
              ctrl.setValue('animeExcludeOrigins', next);
            },
          ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Advance Continue Watching to the next episode'),
          sub: tr.t(
            'When you finish an episode, the Home Continue Watching card moves '
            'on to the next episode instead of sitting at 0 minutes left.',
          ),
          value: s.getBool('cwAdvanceNext'),
          onChanged: (v) => setBool('cwAdvanceNext', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Hide watched titles in catalogs'),
          sub: tr.t(
            "Movies you've watched and shows you've made progress on stop "
            'appearing in the built-in catalog rows, using your local watch '
            'history (and Trakt if connected). Continue Watching is never '
            'touched.',
          ),
          value: s.getBool('hideWatchedInCatalogs'),
          onChanged: (v) => setBool('hideWatchedInCatalogs', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Hide unreleased titles'),
          sub: tr.t(
            'Movies and shows with a future release date stop appearing in the '
            'built-in home catalog rows, so Home only shows what you can watch '
            'right now.',
          ),
          value: s.getBool('hideUnreleased'),
          onChanged: (v) => setBool('hideUnreleased', v),
        ),
      ],
    );
  }

  Widget _spoilersSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Spoilers'),
      subtitle: tr.t(
        'Blur episode artwork, titles, and descriptions for episodes you have '
        'not watched yet, on both shows and anime. Focus an episode to peek.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Blur spoilers'),
          sub: tr.t(
            'Hides spoiler-prone episode details in episode lists until you '
            'have watched them.',
          ),
          value: s.getBool('hideSpoilers'),
          onChanged: (v) => setBool('hideSpoilers', v),
        ),
        if (s.getBool('hideSpoilers'))
          Container(
            margin: const EdgeInsets.only(left: 12),
            padding: const EdgeInsets.only(left: 16),
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: t.edgeSoft, width: 2)),
            ),
            child: Column(
              children: [
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Blur thumbnails'),
                  value: s.getBool('spoilerHideThumbnails'),
                  onChanged: (v) => setBool('spoilerHideThumbnails', v),
                ),
                const SizedBox(height: 10),
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Blur titles'),
                  value: s.getBool('spoilerHideTitles'),
                  onChanged: (v) => setBool('spoilerHideTitles', v),
                ),
                const SizedBox(height: 10),
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Blur descriptions'),
                  value: s.getBool('spoilerHideDescriptions'),
                  onChanged: (v) => setBool('spoilerHideDescriptions', v),
                ),
                const SizedBox(height: 10),
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Blur episode images on detail page'),
                  sub: tr.t(
                    'Blurs the hero image and stills on the episode detail '
                    'page until you click reveal.',
                  ),
                  value: s.getBool('blurEpisodes'),
                  onChanged: (v) => setBool('blurEpisodes', v),
                ),
                const SizedBox(height: 10),
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Keep the next episode visible'),
                  sub: tr.t(
                    'Leave the episode you are up to clear and only blur the '
                    'ones after it.',
                  ),
                  value: s.getBool('spoilerSkipNext'),
                  onChanged: (v) => setBool('spoilerSkipNext', v),
                ),
                const SizedBox(height: 10),
                SettingToggleRow(
                  tokens: t,
                  label: tr.t('Blur stream backdrop'),
                  sub: tr.t(
                    'Adds a blurred glass effect behind the stream picker '
                    'panel.',
                  ),
                  value: s.getBool('streamBackdropBlur'),
                  onChanged: (v) => setBool('streamBackdropBlur', v),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _episodeCardsSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Episode cards'),
      subtitle: tr.t(
        'Show the IMDb rating and synopsis on episodes across the list, grid, '
        'and panel layouts.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show IMDb rating on episodes'),
          sub: tr.t(
            "Shows each episode's rating. Add your free OMDb API key for real "
            'IMDb scores; without it, ratings fall back to TMDB.',
          ),
          value: s.getBool('showEpisodeRating'),
          onChanged: (v) => setBool('showEpisodeRating', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show episode description'),
          sub: tr.t(
            'Shows the episode synopsis on the cards. Turn it off to hide it.',
          ),
          value: s.getBool('showEpisodeDescription'),
          onChanged: (v) => setBool('showEpisodeDescription', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('High-quality episode images'),
          sub: tr.t(
            'Loads full-resolution episode artwork (original) instead of '
            'lighter w300 images. Turn off for slow connections or low-end '
            'devices.',
          ),
          value: s.getBool('hdEpisodeImages'),
          onChanged: (v) => setBool('hdEpisodeImages', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Group episodes by story arc'),
          sub: tr.t(
            'Adds a Seasons/Arcs switch on shows that have a story-arc '
            'grouping (like One Piece), so you can browse by saga instead of '
            'scrolling seasons. Needs a TMDB key. Off by default.',
          ),
          value: s.getBool('episodeArcGroups'),
          onChanged: (v) => setBool('episodeArcGroups', v),
        ),
      ],
    );
  }

  Widget _detailPageSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Detail page'),
      subtitle: tr.t('What the title and episode detail pages show.'),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show ratings on detail pages'),
          sub: tr.t(
            'Detail pages show every available rating. Turn this off to hide '
            'ratings on detail pages.',
          ),
          value: s.getBool('showDetailRatings'),
          onChanged: (v) => setBool('showDetailRatings', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Mark watched button'),
          sub: tr.t(
            'Show a button on the detail page to mark a title or episode as '
            'watched. Syncs to Trakt and Simkl if connected.',
          ),
          value: s.getBool('showWatchedButton'),
          onChanged: (v) => setBool('showWatchedButton', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Rotate hero backdrops'),
          sub: tr.t(
            'Slowly cycle the detail hero through the title’s backdrop '
            'gallery. Only when there are at least two backdrops.',
          ),
          value: s.getBool('heroBackdropCarousel'),
          onChanged: (v) => setBool('heroBackdropCarousel', v),
        ),
      ],
    );
  }

  Widget _skipSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Skip intros & credits'),
      subtitle: tr.t(
        "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and "
        "the file's own chapters, then shows a Skip button at the right "
        "moment.",
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show the Skip button'),
          sub: tr.t(
            'Show a Skip Intro / Skip Credits button when Harbor detects one. '
            'Turn this off to never show it. You can also dismiss a wrong one '
            'for the rest of the episode.',
          ),
          value: s.getBool('showSkipButton'),
          onChanged: (v) => setBool('showSkipButton', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Auto-skip intros'),
          sub: tr.t(
            'Jump past openings automatically the moment one starts. The Skip '
            'button still shows either way, and seeking back into an intro '
            'replays it without skipping again.',
          ),
          value: s.getBool('autoSkipIntro'),
          onChanged: (v) => setBool('autoSkipIntro', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Auto-skip recaps'),
          sub: tr.t('Automatically jump past recap segments.'),
          value: s.getBool('autoSkipRecap'),
          onChanged: (v) => setBool('autoSkipRecap', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Auto-skip credit outros'),
          sub: tr.t(
            'Automatically skip ending credits and trigger the next episode '
            'countdown immediately.',
          ),
          value: s.getBool('autoSkipOutro'),
          onChanged: (v) => setBool('autoSkipOutro', v),
        ),
        if (s.getBool('showSkipButton'))
          SettingSegmented<int>(
            tokens: t,
            label: tr.t('Auto-hide the Skip button after'),
            sub: tr.t(
              "Hides the button on its own after a few seconds so a wrong one "
              "doesn't sit there the whole episode.",
            ),
            value: s.getInt('skipButtonHideSec'),
            onChanged: (v) => ctrl.setValue('skipButtonHideSec', v),
            options: [
              SettingOption(value: 0, label: tr.t('Off')),
              SettingOption(value: 5, label: tr.t('5s')),
              SettingOption(value: 10, label: tr.t('10s')),
              SettingOption(value: 15, label: tr.t('15s')),
              SettingOption(value: 30, label: tr.t('30s')),
            ],
          ),
      ],
    );
  }

  /// Player playback behaviour: resume handling and the on-screen volume HUD.
  /// Ported from the web player-panel play-mode section (the fields the native
  /// player consumes); every control drives real playback behaviour.
  /// The player-engine picker, ported from the web `PlayerEnginePanel` but made
  /// platform-native per the build rules: the stored value stays `auto`/`html5`/
  /// `mpv` (so `useAdvancedEngine` is unchanged), yet the middle "native" option
  /// is named after the engine that actually runs on this OS — AVPlayer on
  /// Apple, ExoPlayer on Android — instead of the web's "HTML5".
  Widget _playerEngineSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final (
      String nativeLabel,
      String nativeSub,
      String autoSub,
    ) = switch (currentPlayerHostOs()) {
      PlayerHostOs.iosFamily || PlayerHostOs.macos => (
        'AVPlayer',
        tr.t(
          "Apple's native player. Hardware Dolby Vision, HDR10, and Atmos "
          'passthrough, but no MKV and a narrower codec range.',
        ),
        tr.t(
          'AVPlayer for clean web-ready streams, mpv for the exotic 4K/HDR '
          'containers it cannot open. The right engine without thinking '
          'about it.',
        ),
      ),
      PlayerHostOs.android => (
        'ExoPlayer',
        tr.t(
          "Android's native player (Media3). Hardware HDR and audio "
          'passthrough with broad container support.',
        ),
        tr.t(
          'ExoPlayer for clean web-ready streams, mpv for the exotic '
          'containers it cannot open. The right engine without thinking '
          'about it.',
        ),
      ),
      _ => (
        tr.t('System player'),
        tr.t(
          'The desktop OS video pipeline. Smooth and integrated, but a '
          'narrower codec range.',
        ),
        tr.t(
          'The system player for clean web-ready streams, mpv for anything '
          'it cannot open.',
        ),
      ),
    };
    return SettingsSection(
      tokens: t,
      title: tr.t('Player engine'),
      subtitle: tr.t(
        'Auto is best for most people. mpv handles the trickiest 4K, HDR, and '
        'audio formats.',
      ),
      children: [
        SettingRadioGroup<String>(
          tokens: t,
          label: tr.t('Engine'),
          value: s.getString('playerEngine').isEmpty
              ? 'auto'
              : s.getString('playerEngine'),
          onChanged: (v) => ctrl.setValue('playerEngine', v),
          options: [
            SettingRadioOption(
              value: 'auto',
              label: tr.t('Auto'),
              sub: autoSub,
            ),
            SettingRadioOption(
              value: 'html5',
              label: nativeLabel,
              sub: nativeSub,
            ),
            SettingRadioOption(
              value: 'mpv',
              label: 'mpv',
              sub: tr.t('Bundled with Harbor. Plays anything you throw at it.'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _playbackSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Playback'),
      subtitle: tr.t(
        'How the player resumes titles and shows on-screen feedback.',
      ),
      children: [
        SettingOptionCards<String>(
          tokens: t,
          value: s.getBool('seasonSourceLock')
              ? 'season'
              : s.getBool('instantPlay')
              ? 'instant'
              : 'manual',
          options: [
            SettingOption(
              value: 'instant',
              label: tr.t('Instant'),
              sub: tr.t(
                'Hitting Play jumps straight into playback with the best '
                'stream Harbor finds.',
              ),
            ),
            SettingOption(
              value: 'manual',
              label: tr.t('Manual picker'),
              sub: tr.t(
                'Hitting Play opens the source list so you can choose '
                'quality, debrid, and audio yourself.',
              ),
            ),
            SettingOption(
              value: 'season',
              label: tr.t('Lock to season server'),
              sub: tr.t(
                'Pick a source once and Harbor keeps playing the rest of that '
                'season from the same release, no re-picking. Works best with '
                'a debrid season pack. Skipped for anime.',
              ),
            ),
          ],
          // A single-select mode: the three flags are mutually exclusive, set
          // atomically so the two writes can't race. "Lock to season" clears
          // instantPlay too, so a movie (no season lock) opens the picker
          // rather than instant-playing off a stale flag.
          onChanged: (mode) => ctrl.setValues(switch (mode) {
            'instant' => {'instantPlay': true, 'seasonSourceLock': false},
            'season' => {'instantPlay': false, 'seasonSourceLock': true},
            _ => {'instantPlay': false, 'seasonSourceLock': false},
          }),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Remember last stream'),
          sub: tr.t(
            'When you resume something you were watching, replay the exact '
            'stream you last used (same addon and source) instead of opening '
            'the picker again. Turn off to always choose fresh.',
          ),
          value: s.getBool('rememberLastStream'),
          onChanged: (v) => setBool('rememberLastStream', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Keep same source on next episode'),
          sub: tr.t(
            'When auto-playing the next episode, keep the same release/source '
            "you were just watching instead of Harbor's top-ranked stream. "
            "Falls back to the best stream if that source isn't available.",
          ),
          value: s.getBool('keepSourceNextEpisode'),
          onChanged: (v) => setBool('keepSourceNextEpisode', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Resume where you left off'),
          sub: tr.t(
            'Pick up partly-watched episodes and movies at your saved spot. '
            'Anything watched past 80% always restarts. Turn this off to '
            'always start from the beginning, handy if you rewatch shows.',
          ),
          value: s.getBool('resumePlayback'),
          onChanged: (v) => setBool('resumePlayback', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Ask to resume or start over'),
          sub: tr.t(
            "When you hit Play on something you've partly watched, show a "
            'prompt to resume from where you left off or start over. Also '
            'covers items synced from Stremio or Trakt.',
          ),
          value: s.getBool('resumePrompt'),
          onChanged: (v) => setBool('resumePrompt', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Auto-play next episode'),
          sub: tr.t(
            'When an episode ends, automatically start the next one. Off lets '
            'the episode finish and stop.',
          ),
          value: s.getBool('autoPlayNextEpisode'),
          onChanged: (v) => setBool('autoPlayNextEpisode', v),
        ),
        SettingSegmented<int>(
          tokens: t,
          label: tr.t('Skip step'),
          sub: tr.t(
            'How many seconds the on-screen skip buttons (and the Left/Right '
            'keys) jump.',
          ),
          value: s.getInt('seekForwardStepSec'),
          onChanged: (v) {
            ctrl.setValue('seekForwardStepSec', v);
            ctrl.setValue('seekBackStepSec', v);
          },
          options: [
            SettingOption(value: 5, label: tr.t('5s')),
            SettingOption(value: 10, label: tr.t('10s')),
            SettingOption(value: 15, label: tr.t('15s')),
            SettingOption(value: 30, label: tr.t('30s')),
          ],
        ),
        SettingSegmented<int>(
          tokens: t,
          label: tr.t('Next episode prompt'),
          sub: tr.t(
            'When the Up Next card appears before an episode ends. Auto '
            'scales to the episode length, so short episodes stop prompting '
            'so early. Off hides it.',
          ),
          value: s.getInt('nextEpisodeLeadSec'),
          onChanged: (v) => ctrl.setValue('nextEpisodeLeadSec', v),
          options: [
            SettingOption(value: -1, label: tr.t('Auto')),
            SettingOption(value: 0, label: tr.t('Off')),
            SettingOption(value: 30, label: tr.t('30s')),
            SettingOption(value: 45, label: tr.t('45s')),
            SettingOption(value: 60, label: tr.t('1 min')),
            SettingOption(value: 90, label: tr.t('1.5 min')),
            SettingOption(value: 120, label: tr.t('2 min')),
          ],
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show controls when pausing'),
          sub: tr.t(
            'Show the player controls when you pause or resume with the '
            "remote or a key. Turn off to keep them hidden so they don't "
            'cover subtitles.',
          ),
          value: s.getBool('keyboardPauseShowsControls'),
          onChanged: (v) => setBool('keyboardPauseShowsControls', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Volume pop-up while watching'),
          sub: tr.t(
            'Show a quick volume overlay when you change the volume with the '
            'player controls hidden, so the change is always visible.',
          ),
          value: s.getBool('playerVolumeHud'),
          onChanged: (v) => setBool('playerVolumeHud', v),
        ),
        if (s.getBool('playerVolumeHud'))
          SettingSegmented<String>(
            tokens: t,
            label: tr.t('Pop-up position'),
            sub: tr.t('Where the volume overlay appears on the video.'),
            value: s.getString('playerVolumeHudPosition').isEmpty
                ? 'top'
                : s.getString('playerVolumeHudPosition'),
            onChanged: (v) => ctrl.setValue('playerVolumeHudPosition', v),
            options: [
              SettingOption(value: 'center', label: tr.t('Center')),
              SettingOption(value: 'top', label: tr.t('Top')),
              SettingOption(value: 'top-left', label: tr.t('Top left')),
              SettingOption(value: 'top-right', label: tr.t('Top right')),
            ],
          ),
      ],
    );
  }

  /// The player scrub-bar look — `seekBar*`. Web player-panel seek-bar section.
  /// (Thumb style / custom image / hover thumbnail are separate follow-ups.)
  Widget _seekBarSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tr = ref.watch(translationsProvider);
    final color = s.getString('seekBarColor');
    final fillOn = s.getBool('seekBarFill');
    return SettingsSection(
      tokens: t,
      title: tr.t('Seek bar'),
      subtitle: tr.t('Customise the look of the player scrub bar.'),
      children: [
        SettingSlider(
          tokens: t,
          label: tr.t('Bar height'),
          value: s.getInt('seekBarHeight').toDouble().clamp(3.0, 14.0),
          min: 3,
          max: 14,
          step: 1,
          resetTo: 6,
          format: (v) => '${v.round()}px',
          onChanged: (v) => ctrl.setValue('seekBarHeight', v.round()),
        ),
        SettingColorSwatches(
          tokens: t,
          label: tr.t('Bar colour'),
          value: color.isEmpty ? '#F0C674' : color,
          resetTo: '#F0C674',
          onChanged: (v) => ctrl.setValue('seekBarColor', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Buffer fill'),
          sub: tr.t(
            'Show how much has buffered ahead of the current position.',
          ),
          value: fillOn,
          onChanged: (v) => ctrl.setValue('seekBarFill', v),
        ),
        if (fillOn)
          SettingSlider(
            tokens: t,
            label: tr.t('Buffer fill brightness'),
            value: s.getDouble('seekBarFillOpacity').clamp(0.05, 1.0),
            min: 0.05,
            max: 1.0,
            step: 0.05,
            resetTo: 0.35,
            format: (v) => '${(v * 100).round()}%',
            onChanged: (v) => ctrl.setValue('seekBarFillOpacity', v),
          ),
      ],
    );
  }

  /// Sound effects — the UI/volume tones. Ports the web "Sound Effects (SFX)"
  /// panel (display-section.tsx): an enable toggle (soundTheme none↔glass), the
  /// theme selector, the master-volume slider (with the live click preview), and
  /// the in-player volume-change toggle.
  Widget _soundSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tr = ref.watch(translationsProvider);
    final theme = s.getString('soundTheme');
    final enabled = theme != 'none';
    return SettingsSection(
      tokens: t,
      title: tr.t('Sound effects'),
      subtitle: tr.t('Audio feedback for navigation and actions.'),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Enable sound effects'),
          sub: tr.t('Play sounds for navigation and actions.'),
          value: enabled,
          // Re-enable restores glass (web parity: none → glass on toggle-on).
          onChanged: (v) =>
              ctrl.setValue('soundTheme', v ? (theme == 'none' ? 'glass' : theme) : 'none'),
        ),
        if (enabled) ...[
          SettingSegmented<String>(
            tokens: t,
            label: tr.t('Theme'),
            value: theme,
            options: [
              SettingOption(value: 'glass', label: tr.t('Glass')),
              SettingOption(value: 'modern', label: tr.t('Modern')),
              SettingOption(value: 'retro', label: tr.t('Retro')),
              SettingOption(value: 'cinematic', label: tr.t('Cinematic')),
            ],
            onChanged: (v) => ctrl.setValue('soundTheme', v),
          ),
          SettingSlider(
            tokens: t,
            label: tr.t('Sound effects volume'),
            value: s.getInt('sfxVolume').toDouble().clamp(0.0, 100.0),
            min: 0,
            max: 100,
            step: 5,
            resetTo: 50,
            format: (v) => '${v.round()}%',
            onChanged: (v) {
              ctrl.setValue('sfxVolume', v.round());
              // Live preview tick, exactly like the web slider onChange.
              ref.read(sfxServiceProvider).click();
            },
          ),
        ],
        SettingToggleRow(
          tokens: t,
          label: tr.t('Player volume sounds'),
          sub: tr.t(
            'Play a tick when you change the volume in the player. Needs a '
            'sound theme enabled above.',
          ),
          value: s.getBool('playerVolumeSfx'),
          onChanged: (v) => ctrl.setValue('playerVolumeSfx', v),
        ),
      ],
    );
  }

  Widget _aspectSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Aspect ratio'),
      subtitle: tr.t(
        'Default picture shape on the mpv engine. Fit keeps the source '
        'as-is with any black bars; the rest stretch or crop to fill, '
        'handy for old 4:3 shows on a widescreen TV.',
      ),
      children: [
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Picture shape'),
          value: s.getString('cropMode').isEmpty
              ? 'fit'
              : s.getString('cropMode'),
          onChanged: (v) => ctrl.setValue('cropMode', v),
          options: [
            // Aspect-ratio numbers (16:9, 4:3, …) fall through untranslated;
            // the named shapes (Fit/Fill/Stretch/Zoom) resolve.
            for (final m in cropPresets)
              SettingOption(value: m.id, label: tr.t(m.label)),
          ],
        ),
      ],
    );
  }

  Widget _pictureQualitySection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Picture quality'),
      subtitle: tr.t(
        'One choice that sets how hard your device works to make video look '
        'its best. Pick the one that matches your machine. Takes effect on '
        'the next thing you play.',
      ),
      children: [
        SettingOptionCards<String>(
          tokens: t,
          value: s.getString('mpvQuality').isEmpty
              ? 'balanced'
              : s.getString('mpvQuality'),
          onChanged: (v) => ctrl.setValue('mpvQuality', v),
          options: [
            SettingOption(
              value: 'performance',
              label: tr.t('Smooth on weak PCs'),
              sub: tr.t(
                'Turns off the fancy scaling and effects so video just plays. '
                'The lightest on your machine. Pick this if anything ever '
                'stutters or your fan screams.',
              ),
            ),
            SettingOption(
              value: 'balanced',
              label: tr.t('Balanced'),
              sub: tr.t(
                'Good-looking video without working your machine hard. Leave '
                'it here unless you have a reason to change.',
              ),
            ),
            SettingOption(
              value: 'quality',
              label: tr.t('Maximum quality'),
              sub: tr.t(
                'Sharper upscaling and smoother gradients in dark scenes, at '
                'the cost of more graphics-card load. Skip it on laptops and '
                'integrated graphics.',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _smoothMotionSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Smooth motion'),
      subtitle: tr.t(
        'Anime is drawn on twos and threes, so fast pans can judder. '
        'Smoothing fills in the gaps so motion glides.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Motion smoothing'),
          sub: tr.t(
            "Harbor's built-in frame interpolation. Smooths panning, best on "
            "anime. Needs a display refresh rate above the video's frame rate, "
            'and can stutter on weak GPUs. Lighter than SVP.',
          ),
          value: s.getBool('playerMotionInterp'),
          onChanged: (v) => setBool('playerMotionInterp', v),
        ),
      ],
    );
  }

  Widget _hardwareAccelSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final hwdec = s.getString('mpvHwdec').isEmpty
        ? 'auto'
        : s.getString('mpvHwdec');
    final help = switch (hwdec) {
      'off' => tr.t(
        'The CPU decodes everything. Most compatible, but it runs hot and can '
        'stutter on 4K. Use this only if the picture glitches with '
        'hardware decoding on.',
      ),
      'on' => tr.t(
        'Forces the graphics card on. Smoothest and coolest, but a few old or '
        'unusual files may refuse to play. Switch back to Auto if '
        "something won't start.",
      ),
      _ => tr.t(
        "Harbor uses the graphics card when it's safe and falls back to the "
        "CPU when it isn't. The right call for almost everyone.",
      ),
    };
    return SettingsSection(
      tokens: t,
      title: tr.t('Hardware acceleration'),
      subtitle: tr.t(
        'Let your graphics card do the heavy lifting of decoding video. It '
        'saves battery and keeps the CPU cool. Auto is right for almost '
        "everyone; only switch if playback looks wrong or won't start.",
      ),
      children: [
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Decoder'),
          sub: help,
          value: hwdec,
          onChanged: (v) => ctrl.setValue('mpvHwdec', v),
          options: [
            SettingOption(value: 'auto', label: tr.t('Auto')),
            SettingOption(value: 'on', label: tr.t('Force on')),
            SettingOption(value: 'off', label: tr.t('Off (use CPU)')),
          ],
        ),
      ],
    );
  }

  Widget _colorHdrSection(Settings s, HarborTokens t, SettingsController ctrl) {
    final tweaks = s.getMap('mpvTweaks');
    void setTweak(String key, String? value) {
      final next = Map<String, dynamic>.from(s.getMap('mpvTweaks'));
      if (value == null) {
        next.remove(key);
      } else {
        next[key] = value;
      }
      ctrl.setValue('mpvTweaks', next);
    }

    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Color & HDR'),
      subtitle: tr.t(
        'How Harbor squeezes HDR movies onto a normal screen. Auto is right '
        'for almost everyone; the curves below just change the look (punchy '
        'vs soft). Only matters on HDR sources.',
      ),
      children: [
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Tone-mapping curve'),
          value: tweaks['tone-mapping']?.toString() ?? '',
          onChanged: (v) => setTweak('tone-mapping', v.isEmpty ? null : v),
          options: [
            SettingOption(value: '', label: tr.t('Auto (recommended)')),
            SettingOption(value: 'bt.2390', label: tr.t('Reference (bt.2390)')),
            SettingOption(value: 'hable', label: tr.t('Filmic (Hable)')),
            SettingOption(value: 'mobius', label: tr.t('Balanced (Mobius)')),
            SettingOption(value: 'reinhard', label: tr.t('Soft (Reinhard)')),
            SettingOption(value: 'spline', label: tr.t('Modern (Spline)')),
          ],
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Boost SDR video toward HDR'),
          sub: tr.t(
            'On an HDR display, stretches normal (non-HDR) movies to use the '
            'extra brightness range. Leave off on a regular screen; it can '
            'look washed out.',
          ),
          value: tweaks['inverse-tone-mapping'] == 'yes',
          onChanged: (on) =>
              setTweak('inverse-tone-mapping', on ? 'yes' : null),
        ),
      ],
    );
  }

  Widget _bufferSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Slow or unstable connection'),
      subtitle: tr.t(
        "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a "
        'far-away server, this gives Harbor a bigger head start so playback '
        'rides through the rough patches.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Build a bigger buffer'),
          sub: tr.t(
            'Loads more of the video ahead of time before playing. Smoother '
            'on weak connections, uses a little more memory and takes a '
            'moment longer to start.',
          ),
          value: s.getBool('mpvBufferBoost'),
          onChanged: (v) => setBool('mpvBufferBoost', v),
        ),
      ],
    );
  }

  Widget _downmixSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
  ) {
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Audio downmix'),
      subtitle: tr.t(
        'For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 '
        'surround can sound hollow or have quiet dialogue on two speakers. '
        'This folds them down properly.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Mix surround sound down to stereo'),
          sub: tr.t(
            'Turn on if you watch on a laptop or headphones and dialogue '
            'feels too quiet next to the effects. Leave off if you have a '
            'real surround setup or a soundbar.',
          ),
          value: s.getBool('mpvDownmixStereo'),
          onChanged: (v) => setBool('mpvDownmixStereo', v),
        ),
      ],
    );
  }

  Widget _titleTextSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    double scale(String key) {
      final v = s.getDouble(key);
      return v > 0 ? v.clamp(0.8, 1.6) : 1.0;
    }

    return SettingsSection(
      tokens: t,
      title: tr.t('Title text'),
      subtitle: tr.t(
        'Resize the row titles on Home and the title shown in the player, '
        'without scaling the rest of the interface. You can also lead the '
        'player title with the series name instead of the episode.',
      ),
      children: [
        SettingSlider(
          tokens: t,
          label: tr.t('Row titles'),
          value: scale('rowTitleScale'),
          min: 0.8,
          max: 1.6,
          step: 0.05,
          resetTo: 1.0,
          onChanged: (v) => ctrl.setValue('rowTitleScale', v),
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Player title'),
          value: scale('playerTitleScale'),
          min: 0.8,
          max: 1.6,
          step: 0.05,
          resetTo: 1.0,
          onChanged: (v) => ctrl.setValue('playerTitleScale', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show series name first in the player'),
          sub: tr.t(
            'Lead with the show name instead of the episode title at the top '
            'of the player.',
          ),
          value: s.getBool('playerTitleSeriesFirst'),
          onChanged: (v) => setBool('playerTitleSeriesFirst', v),
        ),
      ],
    );
  }

  Widget _posterCardSection(
    Settings s,
    HarborTokens t,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final scale = s.getDouble('posterScale');
    final radius = s.getDouble('posterRadius');
    return SettingsSection(
      tokens: t,
      title: tr.t('Poster card style'),
      subtitle: tr.t(
        'Tune the size and corner radius of every poster across Home, '
        'Discover, and your library.',
      ),
      children: [
        SettingSlider(
          tokens: t,
          label: tr.t('Width'),
          value: (scale > 0 ? scale : 1.0).clamp(0.6, 2.0),
          min: 0.6,
          max: 2.0,
          step: 0.05,
          resetTo: 1.0,
          onChanged: (v) => ctrl.setValue('posterScale', v),
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Corner radius'),
          value: radius.clamp(0.0, 40.0),
          min: 0,
          max: 40,
          step: 2,
          resetTo: 12,
          format: (v) => '${v.round()}px',
          onChanged: (v) => ctrl.setValue('posterRadius', v),
        ),
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Load effect'),
          sub: tr.t(
            'How posters appear as they load. Blur up looks smoothest; Fade '
            'is lighter on older or low-power devices; Instant turns it off.',
          ),
          value: s.getString('posterEffect').isEmpty
              ? 'off'
              : s.getString('posterEffect'),
          onChanged: (v) => ctrl.setValue('posterEffect', v),
          options: [
            SettingOption(value: 'blur', label: tr.t('Blur up')),
            SettingOption(value: 'fade', label: tr.t('Fade')),
            SettingOption(value: 'off', label: tr.t('Instant')),
          ],
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Hide titles under posters'),
          sub: tr.t(
            'Cleaner grid when your poster service already prints the title on '
            'the artwork.',
          ),
          value: s.getBool('hidePosterTitles'),
          onChanged: (v) => ctrl.setValue('hidePosterTitles', v),
        ),
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Watchlist badge'),
          sub: tr.t(
            'Where the bookmark badge sits on a poster once a title is in your '
            'watchlist.',
          ),
          value: s.getString('watchlistBadge').isEmpty
              ? 'topEnd'
              : s.getString('watchlistBadge'),
          onChanged: (v) => ctrl.setValue('watchlistBadge', v),
          options: [
            SettingOption(value: 'off', label: tr.t('Off')),
            SettingOption(value: 'topStart', label: tr.t('Top left')),
            SettingOption(value: 'topEnd', label: tr.t('Top right')),
            SettingOption(value: 'bottomStart', label: tr.t('Bottom left')),
            SettingOption(value: 'bottomEnd', label: tr.t('Bottom right')),
          ],
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show rating badges'),
          sub: tr.t(
            'Show a small rating in the corner of each poster. Turn off to '
            'keep the artwork clean.',
          ),
          value: s.getBool('showCardBadges'),
          onChanged: (v) => ctrl.setValue('showCardBadges', v),
        ),
        if (s.getBool('showCardBadges')) ...[
          SettingToggleRow(
            tokens: t,
            label: tr.t('IMDb rating'),
            sub: tr.t('Show the IMDb score on posters that carry one.'),
            value: s.getBool('showImdbBadge'),
            onChanged: (v) => ctrl.setValue('showImdbBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('TMDB rating'),
            sub: tr.t('Show the TMDB score on posters without an IMDb rating.'),
            value: s.getBool('showTmdbBadge'),
            onChanged: (v) => ctrl.setValue('showTmdbBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('Rotten Tomatoes audience'),
            sub: tr.t(
              'Show the popcorn audience score. Needs an MDBList API key '
              '(set it under Integrations).',
            ),
            value: s.getBool('showPopcornBadge'),
            onChanged: (v) => ctrl.setValue('showPopcornBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('Metacritic'),
            sub: tr.t('Show the Metacritic score. Needs an MDBList API key.'),
            value: s.getBool('showMetacriticBadge'),
            onChanged: (v) => ctrl.setValue('showMetacriticBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('Letterboxd'),
            sub: tr.t('Show the Letterboxd rating. Needs an MDBList API key.'),
            value: s.getBool('showLetterboxdBadge'),
            onChanged: (v) => ctrl.setValue('showLetterboxdBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('MDBList score'),
            sub: tr.t('Show the combined MDBList score. Needs an MDBList key.'),
            value: s.getBool('showMdblistBadge'),
            onChanged: (v) => ctrl.setValue('showMdblistBadge', v),
          ),
          SettingToggleRow(
            tokens: t,
            label: tr.t('Trakt'),
            sub: tr.t('Show the Trakt community score. Needs an MDBList key.'),
            value: s.getBool('showTraktBadge'),
            onChanged: (v) => ctrl.setValue('showTraktBadge', v),
          ),
          SettingSlider(
            tokens: t,
            label: tr.t('Max badges per poster'),
            value: s.getInt('cardBadgeLimit').clamp(1, 6).toDouble(),
            min: 1,
            max: 6,
            step: 1,
            resetTo: 3,
            format: (v) => '${v.round()}',
            onChanged: (v) => ctrl.setValue('cardBadgeLimit', v.round()),
          ),
          SettingSegmented<String>(
            tokens: t,
            label: tr.t('Badge position'),
            value: s.getString('badgePlacement') == 'top' ? 'top' : 'bottom',
            onChanged: (v) => ctrl.setValue('badgePlacement', v),
            options: [
              SettingOption(value: 'top', label: tr.t('Top')),
              SettingOption(value: 'bottom', label: tr.t('Bottom')),
            ],
          ),
        ],
      ],
    );
  }

  Widget _subtitleSection(
    Settings s,
    HarborTokens t,
    void Function(String, bool) setBool,
    SettingsController ctrl,
  ) {
    final tr = ref.watch(translationsProvider);
    final style = s.getString('subStyle').isEmpty
        ? 'shadow'
        : s.getString('subStyle');
    return SettingsSection(
      tokens: t,
      title: tr.t('Subtitle style'),
      subtitle: tr.t(
        'How subtitles look during playback — background style, size, '
        'colour, position, and readability.',
      ),
      children: [
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Background style'),
          value: style,
          onChanged: (v) => ctrl.setValue('subStyle', v),
          options: [
            SettingOption(value: 'shadow', label: tr.t('Drop shadow')),
            SettingOption(value: 'outline', label: tr.t('Outline')),
            SettingOption(value: 'box', label: tr.t('Black bar')),
          ],
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Size'),
          value:
              (s.getDouble('subFontSize') > 0
                      ? s.getDouble('subFontSize')
                      : 32.0)
                  .clamp(16.0, 120.0),
          min: 16,
          max: 120,
          step: 2,
          resetTo: 32,
          format: (v) => '${v.round()}px',
          onChanged: (v) => ctrl.setValue('subFontSize', v),
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Opacity'),
          value:
              (s.getDouble('subOpacity') > 0 ? s.getDouble('subOpacity') : 1.0)
                  .clamp(0.2, 1.0),
          min: 0.2,
          max: 1,
          step: 0.05,
          resetTo: 1,
          onChanged: (v) => ctrl.setValue('subOpacity', v),
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Distance from bottom'),
          value: s.getDouble('subMarginY').clamp(0.0, 100.0),
          min: 0,
          max: 100,
          step: 2,
          resetTo: 12,
          format: (v) => '${v.round()}%',
          onChanged: (v) => ctrl.setValue('subMarginY', v),
        ),
        SettingSlider(
          tokens: t,
          label: tr.t('Outline thickness'),
          value: s.getDouble('subBorderSize').clamp(0.0, 6.0),
          min: 0,
          max: 6,
          step: 1,
          resetTo: 0,
          format: (v) => '${v.round()}px',
          onChanged: (v) => ctrl.setValue('subBorderSize', v),
        ),
        if (style == 'box')
          SettingSlider(
            tokens: t,
            label: tr.t('Background opacity'),
            value:
                (s.getDouble('subBoxOpacity') > 0
                        ? s.getDouble('subBoxOpacity')
                        : 0.6)
                    .clamp(0.2, 1.0),
            min: 0.2,
            max: 1,
            step: 0.05,
            resetTo: 0.6,
            onChanged: (v) => ctrl.setValue('subBoxOpacity', v),
          ),
        SettingColorSwatches(
          tokens: t,
          label: tr.t('Text colour'),
          value: s.getString('subFontColor').isEmpty
              ? '#FFFFFF'
              : s.getString('subFontColor'),
          resetTo: '#FFFFFF',
          onChanged: (v) => ctrl.setValue('subFontColor', v),
        ),
        SettingColorSwatches(
          tokens: t,
          label: tr.t('Outline colour'),
          value: s.getString('subBorderColor').isEmpty
              ? '#000000'
              : s.getString('subBorderColor'),
          resetTo: '#000000',
          onChanged: (v) => ctrl.setValue('subBorderColor', v),
        ),
        if (style == 'box')
          SettingColorSwatches(
            tokens: t,
            label: tr.t('Background colour'),
            value: s.getString('subBoxColor').isEmpty
                ? '#000000'
                : s.getString('subBoxColor'),
            resetTo: '#000000',
            onChanged: (v) => ctrl.setValue('subBoxColor', v),
          ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Bold text'),
          value: s.getBool('subBold'),
          onChanged: (v) => setBool('subBold', v),
        ),
        SettingSegmented<String>(
          tokens: t,
          label: tr.t('Alignment'),
          value: s.getString('subAlignX').isEmpty
              ? 'center'
              : s.getString('subAlignX'),
          onChanged: (v) => ctrl.setValue('subAlignX', v),
          options: [
            SettingOption(value: 'left', label: tr.t('Left')),
            SettingOption(value: 'center', label: tr.t('Center')),
            SettingOption(value: 'right', label: tr.t('Right')),
          ],
        ),
      ],
    );
  }
}
