import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../design/tokens.dart';
import '../../domain/streams/aiostatus.dart';
import '../../design/focus/focusable.dart';

/// Palette for a health status: (dot color, text color).
({Color dot, Color text}) _palette(HarborTokens t, ServiceHealthStatus s) =>
    switch (s) {
      ServiceHealthStatus.expired => (
        dot: const Color(0xFFFDA4AF),
        text: const Color(0xFFFECDD3),
      ),
      ServiceHealthStatus.expiring => (
        dot: const Color(0xFFFCD34D),
        text: const Color(0xFFFDE68A),
      ),
      ServiceHealthStatus.active => (
        dot: const Color(0xFF6EE7B7),
        text: const Color(0xFFA7F3D0),
      ),
      ServiceHealthStatus.unknown => (dot: t.inkSubtle, text: t.inkSubtle),
    };

/// The AIOStatus debrid-health banner shown in the Debrid services settings —
/// summarises service health and opens a detail modal. Ports web
/// `AioStatusBanner`.
class AioStatusBanner extends ConsumerWidget {
  const AioStatusBanner({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snap = ref.watch(aioStatusHealthProvider).asData?.value;
    if (snap == null || snap.services.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    final needAttention = snap.services
        .where(
          (s) =>
              s.status == ServiceHealthStatus.expiring ||
              s.status == ServiceHealthStatus.expired,
        )
        .length;
    final warning = needAttention > 0;
    final total = snap.services.length;
    final message = warning
        ? needAttention == 1
              ? '$needAttention service needs attention'
              : '$needAttention services need attention'
        : total == 1
        ? 'Health for $total service'
        : 'Health for $total services';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: Focusable(
          tokens: t,
          borderRadius: 12,
          onPressed: () => showDialog<void>(
            context: context,
            barrierColor: Colors.black.withValues(alpha: 0.6),
            builder: (_) => _AioStatusModal(snapshot: snap, tokens: t),
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: warning
                  ? const Color(0xFFFBBF24).withValues(alpha: 0.10)
                  : t.canvas.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: warning
                    ? const Color(0xFFFCD34D).withValues(alpha: 0.4)
                    : t.edgeSoft,
              ),
            ),
            child: Row(
              children: [
                Text(
                  snap.addonName,
                  style: TextStyle(
                    color: warning ? const Color(0xFFFDE68A) : t.inkMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(width: 8),
                Text('·', style: TextStyle(color: t.inkSubtle, fontSize: 12)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    message,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: warning ? const Color(0xFFFEF3C7) : t.inkMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
                Text(
                  'View all',
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Icon(Icons.chevron_right, size: 15, color: t.inkSubtle),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A small per-service health chip (a status dot + short label) for a debrid
/// key field's trailing slot. Ports web `HealthBadge`.
class HealthBadge extends StatelessWidget {
  const HealthBadge({super.key, required this.health, required this.tokens});

  final ServiceHealth? health;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final h = health;
    if (h == null) return const SizedBox.shrink();
    final t = tokens;
    final pal = _palette(t, h.status);
    final String label;
    if (h.status == ServiceHealthStatus.expired) {
      label = 'Expired';
    } else if (h.daysLeft != null) {
      label = '${h.daysLeft}d left';
    } else if (h.status == ServiceHealthStatus.active) {
      label = 'Active';
    } else {
      final r = h.rawLine;
      label = r.length > 40 ? r.substring(0, 40) : r;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: pal.dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: pal.text,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AioStatusModal extends StatelessWidget {
  const _AioStatusModal({required this.snapshot, required this.tokens});

  final AioStatusSnapshot snapshot;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460, maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          snapshot.addonName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'Service status',
                          style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    // The only interactive control in this modal, so it takes
                    // focus on open — otherwise a TV remote lands on nothing.
                    autofocus: true,
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close, size: 18, color: t.inkMuted),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: t.edgeSoft),
            Flexible(
              child: snapshot.services.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Text(
                        'No services reported.',
                        style: TextStyle(color: t.inkMuted, fontSize: 13),
                      ),
                    )
                  : ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.all(10),
                      children: [
                        for (final s in snapshot.services) _serviceRow(t, s),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _serviceRow(HarborTokens t, AioService s) {
    final pal = _palette(t, s.status);
    final parts = <String>[
      if (s.daysLeft != null) '${s.daysLeft}d left',
      if (s.quotaUsedPercent != null) '${s.quotaUsedPercent}% used',
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: pal.dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (s.rawLine.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    s.rawLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: t.inkSubtle, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
          if (parts.isNotEmpty) ...[
            const SizedBox(width: 10),
            Text(
              parts.join(' · '),
              style: TextStyle(
                color: pal.text,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
