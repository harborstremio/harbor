import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../core/net/safe_launch.dart';
import '../../../app/providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/addon_url.dart';
import '../../../domain/addons/classify.dart';
import '../../../domain/addons/community_index.dart';
import '../../../domain/addons/curated.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../../../domain/addons/stremio_addons_client.dart';
import '../../../domain/nav/frame.dart';
import '../../../app/nav_controller.dart';
import '../../companion/companion_sheet.dart';
import '../addon_utils.dart';
import 'addon_description.dart';
import 'detail_rail.dart';
import 'tag_row.dart';

enum _Busy { install, remove }

enum _Copied { https, stremio }

/// The addon-detail screen: hero, install/configure/uninstall pill, project
/// info, and the related/recommended rails. Ported 1:1 from `AddonDetail` /
/// `RemoteOrLocalDetail`. Reads everything from [addonDetailProvider].
class AddonDetailView extends ConsumerStatefulWidget {
  const AddonDetailView({super.key, required this.id});

  final String id;

  @override
  ConsumerState<AddonDetailView> createState() => _AddonDetailViewState();
}

class _AddonDetailViewState extends ConsumerState<AddonDetailView> {
  final _scroll = ScrollController();
  _Busy? _busy;
  bool? _optimisticInstalled;
  _Copied? _copied;
  bool _manifestVisible = false;
  Timer? _copyTimer;

  @override
  void dispose() {
    _scroll.dispose();
    _copyTimer?.cancel();
    super.dispose();
  }

  Future<void> _launch(String url) => launchExternalUrl(url);

  /// Opens the add-on's setup page. A TV has no usable browser, so it hands the
  /// setup page to a phone over the companion channel and installs the install
  /// link the phone sends back; every other idiom opens the page in the device
  /// browser (the phone/desktop viewer configures and returns via Add-by-URL).
  Future<void> _configure(ResolvedAddon resolved, String configureUrl) async {
    if (!Idiom.of(context).isTv) {
      await _launch(configureUrl);
      return;
    }
    final installUrl = await configureOnPhone(
      context,
      ref,
      configureUrl: configureUrl,
      addonName: resolved.manifest?.name ?? 'add-on',
    );
    if (installUrl != null && installUrl.isNotEmpty && mounted) {
      await _installUrl(installUrl);
    }
  }

  /// Installs the configured install/manifest link the phone sent back. The
  /// installed-addons store normalizes the URL (strips `/configure`, appends
  /// `manifest.json`) before fetching the manifest.
  Future<void> _installUrl(String url) async {
    if (_busy != null) return;
    setState(() {
      _busy = _Busy.install;
      _optimisticInstalled = true;
    });
    try {
      final error = await ref
          .read(installedAddonsProvider.notifier)
          .install(url, installedAt: DateTime.now().millisecondsSinceEpoch);
      if (error != null) {
        setState(() => _optimisticInstalled = null);
        _toast(error);
      } else {
        ref.invalidate(addonsCatalogProvider);
      }
    } catch (_) {
      setState(() => _optimisticInstalled = null);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _install(ResolvedAddon resolved) async {
    if (_busy != null) return;
    setState(() {
      _busy = _Busy.install;
      _optimisticInstalled = true;
    });
    try {
      final error = await ref
          .read(installedAddonsProvider.notifier)
          .install(
            resolved.transportUrl,
            installedAt: DateTime.now().millisecondsSinceEpoch,
          );
      if (error != null) {
        setState(() => _optimisticInstalled = null);
        _toast(error);
      } else {
        ref.invalidate(addonsCatalogProvider);
      }
    } catch (_) {
      setState(() => _optimisticInstalled = null);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _uninstall(ResolvedAddon resolved) async {
    if (_busy != null) return;
    setState(() {
      _busy = _Busy.remove;
      _optimisticInstalled = false;
    });
    try {
      await ref
          .read(installedAddonsProvider.notifier)
          .uninstall(resolved.transportUrl);
      ref.invalidate(addonsCatalogProvider);
    } catch (_) {
      setState(() => _optimisticInstalled = null);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _copy(_Copied kind, String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    setState(() => _copied = kind);
    _copyTimer?.cancel();
    _copyTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _copied = null);
    });
    _toast(
      kind == _Copied.stremio ? 'Stremio link copied' : 'Manifest URL copied',
    );
  }

  void _open(String id) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.addonDetail, {'id': id}));

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final async = ref.watch(addonDetailProvider(widget.id));
    return Container(
      color: t.canvas,
      child: async.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
        ),
        error: (_, _) => const SizedBox.shrink(),
        data: (data) =>
            data == null ? const SizedBox.shrink() : _body(context, t, data),
      ),
    );
  }

  Widget _body(BuildContext context, HarborTokens t, AddonDetailData data) {
    final idiom = Idiom.of(context);
    final gutter = pageGutter(idiom);
    final resolved = data.resolved;
    final m = resolved.manifest;

    // Clear the optimistic flag once the real state has caught up.
    if (_optimisticInstalled != null &&
        resolved.installed == _optimisticInstalled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _optimisticInstalled = null);
      });
    }
    final installed = _optimisticInstalled ?? resolved.installed;

    final community = ref.watch(communityForProvider(m?.id ?? '')).value;
    final rising = ref.watch(risingProvider).value ?? const [];
    final risingEntry = community == null
        ? null
        : risingEntryFor(
            rising,
            uuid: community.uuid,
            slug: community.slug,
            manifestUrl: community.manifestUrl,
          );

    final installedIds =
        ref.watch(addonsCatalogProvider).value?.installedIds ??
        const <String>{};

    return ListView(
      controller: _scroll,
      padding: EdgeInsets.fromLTRB(gutter, 32, gutter, 80),
      children: [
        _hero(t, resolved, installed, community, risingEntry, idiom),
        if (resolved.curated?.warnings.isNotEmpty ?? false)
          _warnings(t, resolved.curated!.warnings),
        const SizedBox(height: 32),
        _projectInfo(t, resolved),
        DetailRail(
          title: 'More like this',
          items: data.related,
          installedIds: installedIds,
          onOpen: _open,
          onInstall: _install,
        ),
        DetailRail(
          title: 'Recommended for you',
          items: data.recommended,
          installedIds: installedIds,
          onOpen: _open,
          onInstall: _install,
        ),
      ],
    );
  }

  Widget _hero(
    HarborTokens t,
    ResolvedAddon resolved,
    bool installed,
    SACommunity? community,
    ({int rank, num recentStars})? risingEntry,
    Idiom idiom,
  ) {
    final m = resolved.manifest;
    final c = resolved.curated;
    final logoUrl = resolveAddonLogo(m?.logo, resolved.transportUrl);
    final official = c?.tags.contains(AddonTag.official) ?? false;
    final category = categoryLabel(c?.category ?? categorizeAddon(resolved));
    final phone = stacksHero(idiom);

    final logo = AddonLogo(
      addonId: idOf(resolved),
      addonName: nameOf(resolved),
      manifestLogo: logoUrl,
      // The 220px logo would overflow a phone next to the text; shrink it and
      // stack below.
      size: phone ? AddonLogoSize.xxl : AddonLogoSize.xxxxl,
    );

    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${official ? 'Official' : 'Community'} · $category'
          '${(m?.id.isNotEmpty ?? false) ? ' · ${m!.id}' : ''}',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 3.5,
            color: t.inkSubtle,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          nameOf(resolved),
          style: TextStyle(
            fontSize: phone ? 28 : 36,
            fontWeight: FontWeight.w500,
            height: 1.1,
            color: t.ink,
          ),
        ),
        if (risingEntry != null) ...[
          const SizedBox(height: 8),
          _risingBadge(risingEntry.recentStars),
        ],
        if (m?.description?.isNotEmpty ?? false) ...[
          const SizedBox(height: 8),
          AddonDescription(text: m!.description!),
        ],
        const SizedBox(height: 12),
        _actions(t, resolved, installed, community),
        TagRow(resolved: resolved),
      ],
    );

    // Phone stacks the logo (and star) above the text; tablet/tv keep the
    // source's side-by-side row.
    if (phone) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              logo,
              if (community != null) ...[
                const Spacer(),
                _starHeader(t, community),
              ],
            ],
          ),
          const SizedBox(height: 16),
          text,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        logo,
        const SizedBox(width: 40),
        Expanded(child: text),
        if (community != null) ...[
          const SizedBox(width: 16),
          _starHeader(t, community),
        ],
      ],
    );
  }

  Widget _starHeader(HarborTokens t, SACommunity community) => Focusable(
    onPressed: () {
      _launch(rateOnSiteUrl(community.slug));
      _toast('Opening stremio-addons.net to sign in and rate');
    },
    tokens: t,
    borderRadius: 8,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Icon(Icons.star, size: 22, color: t.accent),
        const SizedBox(width: 8),
        Text(
          _thousands(community.stars),
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w600,
            color: t.ink,
          ),
        ),
      ],
    ),
  );

  Widget _risingBadge(num recentStars) {
    const rose = Color(0xFFFDA4AF);
    final n = recentStars.toInt();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF43F5E).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: const Color(0xFFF43F5E).withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.trending_up, size: 12, color: rose),
          const SizedBox(width: 6),
          Text(
            'Rising · +$n ${n == 1 ? 'star' : 'stars'} in 24h',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: rose,
            ),
          ),
        ],
      ),
    );
  }

  Widget _actions(
    HarborTokens t,
    ResolvedAddon resolved,
    bool installed,
    SACommunity? community,
  ) {
    final configurable = resolved.manifest?.needsConfiguration ?? false;
    final configureUrl = configureUrlOf(resolved.transportUrl);
    final buttons = <Widget>[];

    if (_busy == _Busy.remove) {
      buttons.add(_pill(t, label: 'Removing', busy: true, onTap: null));
    } else if (_busy == _Busy.install) {
      buttons.add(
        _pill(t, label: 'Installing', busy: true, filled: true, onTap: null),
      );
    } else if (installed) {
      buttons.add(
        _pill(
          t,
          label: 'Installed',
          icon: Icons.check,
          onTap: () => _uninstall(resolved),
        ),
      );
    } else if (configurable) {
      buttons.add(
        _pill(
          t,
          label: 'Configure & install',
          icon: Icons.settings,
          filled: true,
          onTap: () => _configure(resolved, configureUrl),
        ),
      );
    } else {
      buttons.add(
        _pill(
          t,
          label: 'Install',
          filled: true,
          onTap: () => _install(resolved),
        ),
      );
    }

    if (!installed && configurable && _busy == null) {
      buttons.add(
        _pill(t, label: 'Install default', onTap: () => _install(resolved)),
      );
    }
    if (installed && configurable && _busy == null) {
      buttons.add(
        _pill(
          t,
          label: 'Reconfigure',
          icon: Icons.settings,
          onTap: () => _configure(resolved, configureUrl),
        ),
      );
    }

    buttons.add(
      _pill(
        t,
        label: _copied == _Copied.https ? 'Copied' : 'Copy URL',
        icon: _copied == _Copied.https ? Icons.check : Icons.copy,
        onTap: () => _copy(_Copied.https, resolved.transportUrl),
      ),
    );
    buttons.add(
      _pill(
        t,
        label: _copied == _Copied.stremio ? 'Copied' : 'stremio:// link',
        icon: _copied == _Copied.stremio ? Icons.check : Icons.open_in_new,
        onTap: () => _copy(
          _Copied.stremio,
          shareUrlOf(resolved.transportUrl, scheme: AddonShareScheme.stremio),
        ),
      ),
    );
    if (community != null) {
      buttons.add(
        _pill(
          t,
          label: 'Rate',
          icon: Icons.star,
          accent: true,
          onTap: () {
            _launch(rateOnSiteUrl(community.slug));
            _toast('Opening stremio-addons.net to sign in and rate');
          },
        ),
      );
      buttons.add(
        _pill(
          t,
          label: 'On Stremio-Addons',
          onTap: () => _launch(addonSiteUrl(community.slug)),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 4),
      child: Wrap(spacing: 10, runSpacing: 10, children: buttons),
    );
  }

  Widget _pill(
    HarborTokens t, {
    required String label,
    IconData? icon,
    bool filled = false,
    bool accent = false,
    bool busy = false,
    required VoidCallback? onTap,
  }) {
    final fg = filled
        ? t.canvas
        : accent
        ? t.accent
        : t.inkMuted;
    final child = Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      // No `alignment` here: the Row child already centres its icon+label
      // vertically, and an alignment would make the pill EXPAND to the full
      // pane width inside the actions Wrap (bounded-loose constraints) instead
      // of hugging its label — the source shows content-width pills that wrap.
      decoration: BoxDecoration(
        color: filled
            ? t.ink
            : accent
            ? t.accentSoft
            : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: filled
            ? null
            : Border.all(
                color: accent ? t.accent.withValues(alpha: 0.4) : t.edgeSoft,
              ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (busy)
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: fg),
            )
          else if (icon != null)
            Icon(icon, size: 14, color: fg),
          if (busy || icon != null) const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return Opacity(opacity: 0.7, child: child);
    return Focusable(
      onPressed: onTap,
      tokens: t,
      borderRadius: 999,
      child: child,
    );
  }

  Widget _warnings(HarborTokens t, List<String> warnings) => Container(
    margin: const EdgeInsets.only(top: 32),
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: const Color(0xFFFCD34D).withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFFCD34D).withValues(alpha: 0.3)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Worth knowing',
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFFFDE68A),
          ),
        ),
        const SizedBox(height: 8),
        for (final w in warnings)
          Padding(
            padding: const EdgeInsets.only(top: 2, left: 4),
            child: Text(
              '•  $w',
              style: TextStyle(fontSize: 13, color: t.inkMuted),
            ),
          ),
      ],
    ),
  );

  Widget _projectInfo(HarborTokens t, ResolvedAddon resolved) {
    final m = resolved.manifest;
    final stats = <(String, String)>[
      ('Version', m?.version ?? '–'),
      ('Resources', m?.resources.join(', ').ifEmpty('–') ?? '–'),
      ('Types', m?.types.join(', ').ifEmpty('–') ?? '–'),
      ('ID prefixes', (m?.idPrefixes.take(3).join(', ') ?? '').ifEmpty('–')),
      ('Catalogs', '${m?.catalogs.length ?? 0}'),
      ('P2P', (m?.p2p ?? false) ? 'Yes' : 'No'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Project information',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w500,
            color: t.ink,
          ),
        ),
        const SizedBox(height: 16),
        for (final (label, value) in stats)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: t.edgeSoft)),
            ),
            child: Row(
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 12,
                    letterSpacing: 1.9,
                    color: t.inkSubtle,
                  ),
                ),
                const Spacer(),
                Flexible(
                  child: Text(
                    value,
                    textAlign: TextAlign.end,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: t.ink,
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        _manifestBlock(t, resolved.transportUrl),
      ],
    );
  }

  Widget _manifestBlock(HarborTokens t, String transportUrl) {
    final masked = _maskUrl(transportUrl);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'MANIFEST URL',
              style: TextStyle(
                fontSize: 12,
                letterSpacing: 1.9,
                color: t.inkSubtle,
              ),
            ),
            const Spacer(),
            if (_manifestVisible)
              _miniButton(
                t,
                label: _copied == _Copied.https ? 'Copied' : 'Copy',
                icon: _copied == _Copied.https ? Icons.check : Icons.copy,
                onTap: () => _copy(_Copied.https, transportUrl),
              ),
            const SizedBox(width: 6),
            _miniButton(
              t,
              label: _manifestVisible ? 'Hide' : 'Reveal',
              icon: _manifestVisible ? Icons.visibility_off : Icons.visibility,
              onTap: () => setState(() => _manifestVisible = !_manifestVisible),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Text(
            _manifestVisible ? transportUrl : masked,
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: 12.5,
              height: 1.5,
              color: t.inkMuted,
            ),
          ),
        ),
        if (!_manifestVisible) ...[
          const SizedBox(height: 8),
          Text(
            "Hidden by default. Manifest paths often carry API keys (debrid "
            "tokens, OMDB keys, etc.) you don't want over a shoulder.",
            style: TextStyle(fontSize: 11.5, height: 1.5, color: t.inkSubtle),
          ),
        ],
      ],
    );
  }

  Widget _miniButton(
    HarborTokens t, {
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) => Focusable(
    onPressed: onTap,
    tokens: t,
    borderRadius: 999,
    child: Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: t.inkMuted),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: t.inkMuted,
            ),
          ),
        ],
      ),
    ),
  );

  String _maskUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null || uri.host.isEmpty) return '•' * 16;
    return '${uri.scheme}://${uri.host}/…/manifest.json';
  }
}

extension _IfEmpty on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

/// Groups an integer count with thousands separators, matching `toLocaleString`.
String _thousands(num n) {
  final digits = n.toInt().abs().toString();
  final buffer = StringBuffer(n < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}
