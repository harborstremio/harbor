import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/companion/companion_link.dart';
import '../../domain/companion/companion_server.dart';

/// Opens the "enter on your phone" pairing sheet: starts an ephemeral LAN
/// server, shows a QR encoding a real http URL the phone's browser opens, and
/// resolves with the value the phone submits (or null if the user cancels or it
/// times out).
///
/// Typing a URL / API key on a TV remote is painful, so this hands entry to a
/// phone: scan the QR (or open the shown address) → a page loads in the phone
/// browser → type there → the value arrives here end-to-end encrypted. See
/// [startCompanionSession] for the security model.
Future<String?> enterOnPhone(
  BuildContext context,
  WidgetRef ref, {
  required String label,
  CompanionKind kind = CompanionKind.text,
}) async {
  final t = ref.read(tokensProvider);
  CompanionSession session;
  try {
    session = await startCompanionSession();
  } on CompanionUnavailable {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Connect this device to Wi-Fi to pair with a phone.'),
        ),
      );
    }
    return null;
  }
  final link = CompanionLink(
    host: session.host,
    port: session.port,
    token: session.token,
    kind: kind,
    label: label,
  );
  if (!context.mounted) {
    await session.close();
    return null;
  }
  final result = await showDialog<String>(
    context: context,
    barrierDismissible: true,
    builder: (_) => _CompanionSheet(session: session, link: link, tokens: t),
  );
  await session.close();
  return result;
}

/// Opens the "configure on your phone" pairing sheet for an add-on that needs a
/// setup page (which a TV has no browser for). Shows a QR that opens a companion
/// page on the phone with a link to the add-on's own [configureUrl] plus a field
/// to paste the resulting install link; resolves with that install link (or null
/// on cancel / timeout), which the caller then installs. Same end-to-end
/// encryption and LAN-only server as [enterOnPhone].
Future<String?> configureOnPhone(
  BuildContext context,
  WidgetRef ref, {
  required String configureUrl,
  required String addonName,
}) async {
  final t = ref.read(tokensProvider);
  CompanionSession session;
  try {
    session = await startCompanionSession();
  } on CompanionUnavailable {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Connect this device to Wi-Fi to pair with a phone.'),
        ),
      );
    }
    return null;
  }
  final link = CompanionLink(
    host: session.host,
    port: session.port,
    token: session.token,
    // The value the phone sends back is the add-on's install/manifest URL.
    kind: CompanionKind.url,
    label: 'Configure $addonName',
    configureUrl: configureUrl,
  );
  if (!context.mounted) {
    await session.close();
    return null;
  }
  final result = await showDialog<String>(
    context: context,
    barrierDismissible: true,
    builder: (_) => _CompanionSheet(
      session: session,
      link: link,
      tokens: t,
      configure: true,
    ),
  );
  await session.close();
  return result;
}

class _CompanionSheet extends StatefulWidget {
  const _CompanionSheet({
    required this.session,
    required this.link,
    required this.tokens,
    this.configure = false,
  });

  final CompanionSession session;
  final CompanionLink link;
  final HarborTokens tokens;

  /// Whether this is a "configure on your phone" pairing (the phone opens the
  /// add-on's setup page and sends back the install link) rather than plain
  /// value entry — only the sheet's copy differs.
  final bool configure;

  @override
  State<_CompanionSheet> createState() => _CompanionSheetState();
}

class _CompanionSheetState extends State<_CompanionSheet> {
  @override
  void initState() {
    super.initState();
    // Pop with the value the moment the phone submits it.
    widget.session.value.then((v) {
      if (mounted && v != null && v.isNotEmpty) {
        Navigator.of(context).pop(v);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Dialog(
      backgroundColor: t.elevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 28, 28, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.configure
                    ? 'Configure on your phone'
                    : 'Enter on your phone',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.configure
                    ? 'Scan to open the setup page on your phone. Configure it '
                          'there, then the install link comes back here.'
                    : widget.link.label,
                textAlign: TextAlign.center,
                style: TextStyle(color: t.inkMuted, fontSize: 14),
              ),
              const SizedBox(height: 20),
              // The QR must be dark-on-white to scan reliably.
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: QrImageView(
                  data: widget.link.toPairingUrl(),
                  size: 220,
                  backgroundColor: Colors.white,
                  // A very long add-on setup link can exceed QR capacity; show
                  // guidance instead of a silent blank square (qr_flutter renders
                  // an empty box on an over-capacity payload otherwise).
                  errorStateBuilder: (context, _) => SizedBox(
                    width: 220,
                    height: 220,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Text(
                          widget.configure
                              ? "This add-on's setup link is too long to scan "
                                    'here — set it up from a phone or computer '
                                    'browser instead.'
                              : 'This link is too long to show as a QR code.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFF0E1116),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // The real URL — scan the QR, or open this in the phone browser.
              SelectableText(
                'http://${widget.link.host}:${widget.link.port}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(t.accent),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    widget.configure
                        ? 'Waiting for the install link…'
                        : 'Waiting for your phone…',
                    style: TextStyle(color: t.inkMuted, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Focusable(
                tokens: t,
                autofocus: true,
                borderRadius: 12,
                onPressed: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: t.raised,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: t.edgeSoft),
                  ),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
