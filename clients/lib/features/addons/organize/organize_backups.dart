import 'package:flutter/material.dart';

import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/reorder.dart';

String _previewNames(List<String> names) {
  final first = names.take(3).join(', ');
  return names.length > 3 ? '$first +${names.length - 3} more' : first;
}

String _timeLabel(int at) {
  final d = DateTime.fromMillisecondsSinceEpoch(at);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final hour12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final ampm = d.hour < 12 ? 'AM' : 'PM';
  final min = d.minute.toString().padLeft(2, '0');
  return '${months[d.month - 1]} ${d.day}, $hour12:$min $ampm';
}

/// The backups panel shown under the Organize page's Backups button, ported 1:1
/// from `BackupsPanel`: a safety-copy explainer, a "Back up now" action, and the
/// stored backups with per-item Restore.
class OrganizeBackupsPanel extends StatelessWidget {
  const OrganizeBackupsPanel({
    super.key,
    required this.tokens,
    required this.backups,
    required this.busy,
    required this.canBackup,
    required this.onBackupNow,
    required this.onRestore,
  });

  final HarborTokens tokens;
  final List<AddonOrderBackup> backups;
  final bool busy;
  final bool canBackup;
  final VoidCallback onBackupNow;
  final void Function(AddonOrderBackup) onRestore;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'A safety copy of your addon order. One is saved automatically '
            'before Harbor writes any change, and you can save one yourself any '
            'time. The five most recent are kept.',
            style: TextStyle(fontSize: 12.5, height: 1.5, color: t.inkMuted),
          ),
          const SizedBox(height: 16),
          _backupNowButton(t),
          const SizedBox(height: 16),
          if (backups.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: t.canvas.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.edgeSoft),
              ),
              child: Text(
                'No backups yet. Press the button above to save your first one.',
                style: TextStyle(fontSize: 13, color: t.inkSubtle),
              ),
            )
          else
            for (var i = 0; i < backups.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _backupRow(t, backups[i]),
            ],
        ],
      ),
    );
  }

  Widget _backupNowButton(HarborTokens t) {
    final enabled = canBackup && !busy;
    final child = Container(
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.ink,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restore, size: 16, color: t.canvas),
          const SizedBox(width: 8),
          Text(
            'Back up current order',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: t.canvas,
            ),
          ),
        ],
      ),
    );
    if (!enabled) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: onBackupNow,
      child: child,
    );
  }

  Widget _backupRow(HarborTokens t, AddonOrderBackup b) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Flexible(
                    child: Text(
                      _timeLabel(b.at),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w500,
                        color: t.ink,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    b.urls.length == 1 ? '1 addon' : '${b.urls.length} addons',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.26,
                      color: t.inkSubtle,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                _previewNames(b.names),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, color: t.inkSubtle),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        _restoreButton(t, b),
      ],
    ),
  );

  Widget _restoreButton(HarborTokens t, AddonOrderBackup b) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: t.ink,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'Restore',
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: t.canvas,
        ),
      ),
    );
    if (busy) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () => onRestore(b),
      child: child,
    );
  }
}
