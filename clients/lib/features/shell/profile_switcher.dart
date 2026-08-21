import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/i18n_providers.dart';
import '../../app/profiles_providers.dart';
import '../../design/color_picker.dart';
import '../../design/css_color.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/profiles/avatar_catalog.dart';
import '../../domain/profiles/avatar_resize.dart';
import '../../domain/profiles/parental.dart';
import '../../domain/profiles/profile.dart';
import '../../domain/profiles/profile_password.dart';
import 'avatar_catalog_picker.dart';
import 'kids_setup_panel.dart';
import 'pin_entry.dart';
import 'profile_picker_screen.dart';
import 'tab_lock_dialog.dart';
import '../../design/focus/tv_text_field.dart';

/// A circular profile avatar with the profile's colour ring. Renders, in order:
/// the profile's own avatar (a built-in catalog `/avatars/<id>.webp` asset, a
/// `data:` uploaded image, or an http provider URL), then the [fallbackAvatar],
/// then the Stremio "cat" default illustration (web `CatAvatar`) — never a bare
/// text initial, which is only the last resort if the cat asset fails to load.
/// Ported from the web profile-picker avatars + `CatAvatar`.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.profile,
    required this.tokens,
    this.size = 36,
    this.fallbackAvatar,
  });

  final Profile profile;
  final HarborTokens tokens;
  final double size;

  /// The active/"self" chip passes this so that, when the profile has no
  /// avatar of its own, it falls back to the Harbor identity avatar
  /// (`harborAvatar` → the Stremio account avatar) — mirroring web's
  /// `activeProfile?.avatar ?? harborAvatar ?? user?.avatar` chain. Every other
  /// surface leaves it null and shows the profile's own avatar only.
  final String? fallbackAvatar;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final ring = profile.color != null ? parseCssColor(profile.color!) : null;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: ring != null ? Border.all(color: ring, width: 2) : null,
      ),
      child: ClipOval(child: _inner(t, ring)),
    );
  }

  Widget _initial(HarborTokens t, Color? ring) {
    final name = profile.name.trim();
    final initial = name.isNotEmpty ? name.characters.first.toUpperCase() : '?';
    return ColoredBox(
      color: ring ?? t.accentSoft,
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            color: ring != null ? t.canvas : t.accent,
            fontSize: size * 0.42,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _inner(HarborTokens t, Color? ring) {
    var avatar = profile.avatar;
    if (avatar == null || avatar.isEmpty) avatar = fallbackAvatar;
    if (avatar != null && avatar.isNotEmpty) {
      if (avatar.startsWith('http')) {
        return CachedNetworkImage(
          imageUrl: avatar,
          fit: BoxFit.cover,
          placeholder: (_, _) => _fallback(t, ring),
          errorWidget: (_, _, _) => _fallback(t, ring),
        );
      }
      if (avatar.startsWith('data:image')) {
        try {
          final bytes = base64Decode(avatar.split(',').last);
          return Image.memory(
            bytes,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _fallback(t, ring),
          );
        } catch (_) {
          return _fallback(t, ring);
        }
      }
      // A built-in catalog / kid avatar (`/avatars/<id>.webp`,
      // `/kids/avatars/<id>.webp`) resolves to a bundled asset.
      final asset = avatarAssetForStored(avatar);
      if (asset != null) {
        return Image.asset(
          asset,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(t, ring),
        );
      }
    }
    return _fallback(t, ring);
  }

  /// The no-avatar fallback — the Stremio "cat" default illustration (web
  /// `CatAvatar`), NOT a text initial. The coloured initial is the last resort
  /// only if the bundled cat asset itself fails to load.
  Widget _fallback(HarborTokens t, Color? ring) => Image.asset(
    kStremioDefaultAvatarAsset,
    fit: BoxFit.cover,
    errorBuilder: (_, _, _) => _initial(t, ring),
  );
}

/// Opens the full-screen "Who's watching?" profile picker as a route takeover —
/// the native, per-platform, remote-navigable switcher.
Future<void> showProfileSwitcher(
  BuildContext context,
  WidgetRef ref,
  HarborTokens tokens, {
  bool dismissible = true,
}) async {
  await Navigator.of(context, rootNavigator: true).push<void>(
    PageRouteBuilder<void>(
      opaque: true,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 300),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (_, _, _) =>
          ProfilePickerScreen(tokens: tokens, dismissible: dismissible),
      transitionsBuilder: (_, anim, _, child) {
        final curved = CurvedAnimation(
          parent: anim,
          curve: Curves.easeOutCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.97, end: 1).animate(curved),
            child: child,
          ),
        );
      },
    ),
  );
}

/// Creates or edits a profile: its name, kid mode, and (when editing a
/// non-primary profile) deletion. Ported from the web profile editor's core.
class ProfileEditorDialog extends ConsumerStatefulWidget {
  const ProfileEditorDialog({super.key, required this.tokens, this.profile});

  final HarborTokens tokens;
  final Profile? profile;

  @override
  ConsumerState<ProfileEditorDialog> createState() =>
      _ProfileEditorDialogState();
}

class _ProfileEditorDialogState extends ConsumerState<ProfileEditorDialog> {
  late final TextEditingController _name;
  late bool _kid;
  late String _color;
  late String? _passwordHash;
  late List<String> _lockedTabs;
  late KidConfig _kidConfig;
  late String? _shareWith;
  late String? _avatar;
  bool _uploading = false;
  Profile? _primary;

  bool get _editing => widget.profile != null;

  /// Whether this profile can delegate its Stremio session: a non-primary
  /// profile, with a primary that isn't itself. Ported from the web `canShare`.
  bool get _canShare =>
      !(widget.profile?.isPrimary ?? false) &&
      _primary != null &&
      _primary!.id != widget.profile?.id;

  @override
  void initState() {
    super.initState();
    final profiles = ref.read(profilesProvider).profiles;
    _primary = profiles.where((p) => p.isPrimary).firstOrNull;
    _name = TextEditingController(text: widget.profile?.name ?? '');
    _kid = widget.profile?.isKid ?? false;
    _color = widget.profile?.color ?? pickProfileColor(profiles);
    _passwordHash = widget.profile?.passwordHash;
    _lockedTabs = [...?widget.profile?.lockedTabs];
    _kidConfig = widget.profile?.kid ?? kDefaultKid;
    _shareWith = _editing ? widget.profile!.shareStremioWith : _primary?.id;
    _avatar = widget.profile?.avatar;
  }

  Future<void> _editLockedTabs() async {
    final next = await showTabLockDialog(
      context,
      tokens: widget.tokens,
      tr: ref.read(translationsProvider),
      initial: _lockedTabs,
    );
    if (next != null && mounted) setState(() => _lockedTabs = next);
  }

  /// Picks a photo from the gallery, downscales it to a 320px data URI, and sets
  /// it as the profile avatar.
  Future<void> _pickAvatar() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (file == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final bytes = await file.readAsBytes();
      final avatar = resizeAvatar(
        bytes,
        320,
        isGif: file.name.toLowerCase().endsWith('.gif'),
      );
      if (mounted) {
        setState(() {
          _avatar = avatar;
          _uploading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _uploading = false);
    }
  }

  /// Opens the built-in ready-avatar catalog and applies the pick. Available on
  /// every idiom — and the ONLY avatar-set path on a TV (photo upload is touch
  /// only). Ports the web `AvatarCatalogModal`.
  Future<void> _chooseFromCatalog() async {
    final picked = await showAvatarCatalogPicker(
      context,
      tokens: widget.tokens,
      current: _avatar,
    );
    if (picked != null && mounted) setState(() => _avatar = picked);
  }

  /// The 88px avatar preview with change/remove controls. Everyone can pick from
  /// the built-in catalog; photo upload is additionally offered on touch/pointer
  /// idioms (image_picker is not a TV-remote flow).
  Widget _avatarRing(HarborTokens t) {
    final tr = ref.read(translationsProvider);
    final canUpload = !Idiom.of(context).isTv;
    final preview = Profile(
      id: 'preview',
      name: _name.text,
      color: _color,
      avatar: _avatar,
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ProfileAvatar(profile: preview, tokens: t, size: 88),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            _pinButton(
              t,
              tr.t('Choose avatar'),
              _chooseFromCatalog,
              accent: true,
            ),
            if (canUpload)
              _pinButton(
                t,
                _uploading ? tr.t('Uploading…') : tr.t('Upload photo'),
                () {
                  if (!_uploading) _pickAvatar();
                },
              ),
            if (_avatar != null)
              _pinButton(
                t,
                tr.t('Remove'),
                () => setState(() => _avatar = null),
                danger: true,
              ),
          ],
        ),
      ],
    );
  }

  String _pinName() {
    final n = _name.text.trim();
    return n.isNotEmpty ? n : (widget.profile?.name ?? '');
  }

  /// Sets a brand-new PIN (no current one to confirm).
  Future<void> _setPin() async {
    final tr = ref.read(translationsProvider);
    final name = _pinName();
    final pin = await showPinDialog(
      context,
      tokens: widget.tokens,
      title: name.isEmpty
          ? tr.t('Set a PIN')
          : tr.t('Set a PIN for {name}', {'name': name}),
      subtitle: tr.t(
        "Pick a 4-digit PIN. You'll be asked for it before this profile opens.",
      ),
      mode: PinMode.set,
    );
    if (pin != null && mounted) {
      setState(() => _passwordHash = hashProfilePassword(pin));
    }
  }

  /// Confirms the current PIN, then sets a new one (from `pin-change`).
  Future<void> _changePin() async {
    final tr = ref.read(translationsProvider);
    final current = _passwordHash;
    if (current == null) return;
    final ok = await showPinDialog(
      context,
      tokens: widget.tokens,
      title: tr.t('Enter current PIN'),
      subtitle: tr.t('Confirm your current PIN, then pick a new one.'),
      mode: PinMode.verify,
      verify: (pin) => verifyProfilePassword(pin, current),
    );
    if (ok != null && mounted) await _setPin();
  }

  /// Confirms the current PIN, then removes the lock (from `pin-remove`).
  Future<void> _removePin() async {
    final tr = ref.read(translationsProvider);
    final current = _passwordHash;
    if (current == null) return;
    final ok = await showPinDialog(
      context,
      tokens: widget.tokens,
      title: tr.t('Enter current PIN'),
      subtitle: tr.t('Confirm your current PIN to remove the lock.'),
      mode: PinMode.verify,
      verify: (pin) => verifyProfilePassword(pin, current),
    );
    if (ok != null && mounted) setState(() => _passwordHash = null);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final notifier = ref.read(profilesProvider.notifier);
    if (_editing) {
      await notifier.updateProfile(
        widget.profile!.id,
        (p) => p.copyWith(
          name: name.isEmpty ? null : name,
          color: _color,
          avatar: _avatar,
          passwordHash: _passwordHash,
          lockedTabs: anyTabLocked(_lockedTabs) ? _lockedTabs : null,
          shareStremioWith: _canShare ? _shareWith : p.shareStremioWith,
          // Kid on persists the edited config; off clears it.
          kid: _kid ? _kidConfig : null,
        ),
      );
    } else {
      final id = await notifier.createProfile(
        name: name,
        avatar: _avatar,
        color: _color,
        kid: _kid ? _kidConfig : null,
      );
      // createProfile delegates to the primary; only patch when the user
      // changed the share choice, set a PIN, or locked tabs.
      final shareChanged = _canShare && _shareWith != _primary?.id;
      if (_passwordHash != null || anyTabLocked(_lockedTabs) || shareChanged) {
        await notifier.updateProfile(
          id,
          (p) => p.copyWith(
            passwordHash: _passwordHash,
            lockedTabs: anyTabLocked(_lockedTabs) ? _lockedTabs : null,
            shareStremioWith: shareChanged ? _shareWith : p.shareStremioWith,
          ),
        );
      }
    }
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _delete() async {
    await ref.read(profilesProvider.notifier).deleteProfile(widget.profile!.id);
    if (mounted) Navigator.of(context).pop();
  }

  /// The Stremio-account choice: share the primary's session or use a separate
  /// account. Ported from the web editor's `ShareOption` block.
  Widget _shareSection(HarborTokens t, Translations tr) {
    final primary = _primary;
    if (primary == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tr.t('Stremio account').toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
          ),
        ),
        const SizedBox(height: 8),
        _shareOption(
          t,
          active: _shareWith == primary.id,
          icon: Icons.link_rounded,
          title: tr.t('Share with {name}', {'name': primary.name}),
          sub: tr.t(
            "Use the primary profile's Stremio library, watchlist, and addons.",
          ),
          onPressed: () => setState(() => _shareWith = primary.id),
        ),
        const SizedBox(height: 8),
        _shareOption(
          t,
          active: _shareWith == null,
          icon: Icons.person_outline_rounded,
          title: tr.t('Use a separate Stremio account'),
          sub: tr.t(
            'Sign in from the sidebar after saving. Library and addons stay '
            'separate.',
          ),
          onPressed: () => setState(() => _shareWith = null),
        ),
      ],
    );
  }

  Widget _shareOption(
    HarborTokens t, {
    required bool active,
    required IconData icon,
    required String title,
    required String sub,
    required VoidCallback onPressed,
  }) {
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 12,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: active ? t.canvas.withValues(alpha: 0.6) : t.elevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active ? t.ink.withValues(alpha: 0.4) : t.edgeSoft,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 20,
              height: 20,
              margin: const EdgeInsets.only(top: 1),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: active ? t.ink : t.edge, width: 2),
              ),
              child: active
                  ? Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.ink,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Icon(icon, size: 16, color: active ? t.ink : t.inkMuted),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    sub,
                    style: TextStyle(
                      color: t.inkSubtle,
                      fontSize: 12,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The profile-PIN row: set a lock, or (once set) change/remove it. A profile
  /// with a PIN is challenged before it can be switched to in the picker.
  Widget _securitySection(HarborTokens t) {
    final tr = ref.read(translationsProvider);
    final locked = _passwordHash != null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: t.elevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Icon(
                locked ? Icons.lock_rounded : Icons.lock_open_rounded,
                size: 18,
                color: locked ? t.accent : t.inkMuted,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr.t('Profile PIN'),
                      style: TextStyle(
                        color: t.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      locked
                          ? tr.t(
                              'A 4-digit PIN is required to open this profile.',
                            )
                          : tr.t('Lock this profile behind a 4-digit PIN.'),
                      style: TextStyle(color: t.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (!locked)
                _pinButton(t, tr.t('Set PIN'), _setPin, accent: true)
              else ...[
                _pinButton(t, tr.t('Change'), _changePin),
                const SizedBox(width: 8),
                _pinButton(t, tr.t('Remove'), _removePin, danger: true),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        _tabsRow(t, tr),
      ],
    );
  }

  /// The locked-tabs row: which sidebar tabs the PIN hides. Opens the tab picker.
  Widget _tabsRow(HarborTokens t, Translations tr) {
    final count = _lockedTabs.length;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Icon(
            Icons.dashboard_customize_outlined,
            size: 18,
            color: count > 0 ? t.accent : t.inkMuted,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr.t('Locked tabs'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  count == 0
                      ? tr.t('Hide sidebar tabs behind the PIN.')
                      : tr.t('{n} tabs locked', {'n': count}),
                  style: TextStyle(color: t.inkMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _pinButton(t, tr.t('Edit'), _editLockedTabs),
        ],
      ),
    );
  }

  Widget _pinButton(
    HarborTokens t,
    String label,
    VoidCallback onPressed, {
    bool accent = false,
    bool danger = false,
  }) {
    final fg = danger ? t.danger : (accent ? t.canvas : t.ink);
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: accent ? t.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: accent
              ? null
              : Border.all(color: danger ? t.danger : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final canDelete = _editing && !(widget.profile?.isPrimary ?? false);
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _editing
                      ? ref.read(translationsProvider).t('Edit profile')
                      : ref.read(translationsProvider).t('New profile'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 18),
                Center(child: _avatarRing(t)),
                const SizedBox(height: 18),
                TvTextField(
                  controller: _name,
                  autofocus: true,
                  maxLength: 32,
                  style: TextStyle(color: t.ink, fontSize: 15),
                  cursorColor: t.accent,
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: ref.read(translationsProvider).t('Profile name'),
                    hintStyle: TextStyle(color: t.inkSubtle, fontSize: 15),
                    filled: true,
                    fillColor: t.elevated,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: t.edgeSoft),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: t.accent, width: 2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                HarborColorPicker(
                  value: _color,
                  tokens: t,
                  onChange: (hex) => setState(() => _color = hex),
                ),
                const SizedBox(height: 16),
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 12,
                  onPressed: () => setState(() => _kid = !_kid),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: t.elevated,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: t.edgeSoft),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ref.read(translationsProvider).t('Kid profile'),
                                style: TextStyle(
                                  color: t.ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                ref
                                    .read(translationsProvider)
                                    .t('A simplified, kid-safe experience.'),
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 40,
                          height: 24,
                          alignment: _kid
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: _kid ? t.accent : t.raised,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              color: t.canvas,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // A kid profile swaps the PIN/tab security for the kids space
                // setup (age, curfew, parent PIN), mirroring the web editor.
                if (_kid)
                  KidsSetupPanel(
                    tokens: t,
                    tr: ref.read(translationsProvider),
                    kid: _kidConfig,
                    onChange: (next) => setState(() => _kidConfig = next),
                    avatar: _avatar,
                    onAvatarChange: (v) => setState(() => _avatar = v),
                  )
                else
                  _securitySection(t),
                if (_canShare && !_kid) ...[
                  const SizedBox(height: 16),
                  _shareSection(t, ref.read(translationsProvider)),
                ],
                const SizedBox(height: 22),
                Row(
                  children: [
                    if (canDelete) ...[
                      Focusable(
                        tokens: t,
                        scale: 1.0,
                        borderRadius: 12,
                        onPressed: _delete,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: t.danger.withValues(alpha: 0.5),
                            ),
                          ),
                          child: Icon(
                            Icons.delete_outline_rounded,
                            size: 18,
                            color: t.danger,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: Focusable(
                        tokens: t,
                        scale: 1.0,
                        borderRadius: 12,
                        onPressed: () => Navigator.of(context).pop(),
                        child: Container(
                          alignment: Alignment.center,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: t.elevated,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: t.edgeSoft),
                          ),
                          child: Text(
                            ref.read(translationsProvider).t('Cancel'),
                            style: TextStyle(
                              color: t.inkMuted,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Focusable(
                        tokens: t,
                        scale: 1.0,
                        borderRadius: 12,
                        onPressed: _save,
                        child: Container(
                          alignment: Alignment.center,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: t.accent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _editing
                                ? ref.read(translationsProvider).t('Save')
                                : ref.read(translationsProvider).t('Create'),
                            style: TextStyle(
                              color: t.canvas,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
