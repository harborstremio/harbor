import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/bug_report_providers.dart';
import '../../app/i18n_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/bug_report/bug_report.dart';
import '../../domain/i18n/translations.dart';
import 'settings_controls.dart';
import '../../design/focus/tv_text_field.dart';

/// The "Report a bug" panel (web `bug-report-panel`): a form that collects a
/// summary, severity, repro steps, expectation/actuality, optional image
/// attachments and reporter credit, attaches app/device diagnostics, and posts
/// it to the backend. On success it shows the report id.
class BugReportSection extends ConsumerStatefulWidget {
  const BugReportSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<BugReportSection> createState() => _BugReportSectionState();
}

class _BugReportSectionState extends ConsumerState<BugReportSection> {
  final _summary = TextEditingController();
  final _steps = TextEditingController();
  final _expected = TextEditingController();
  final _actual = TextEditingController();
  final _name = TextEditingController();
  final _github = TextEditingController();
  final _contact = TextEditingController();

  BugSeverity _severity = BugSeverity.normal;
  bool _consent = true;
  final _files = <BugReportFile>[];
  bool _submitting = false;
  String? _submittedId;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _summary,
      _steps,
      _expected,
      _actual,
      _name,
      _github,
      _contact,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _canSubmit => _summary.text.trim().length >= 6 && !_submitting;

  Future<void> _pickFiles() async {
    final picked = await ImagePicker().pickMultiImage(limit: 5);
    if (picked.isEmpty) return;
    for (final x in picked) {
      final bytes = await x.readAsBytes();
      _files.add(BugReportFile(name: x.name, bytes: bytes));
    }
    if (mounted) setState(() {});
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final view = View.of(context).physicalSize;
      final diag = await collectBugDiagnostics(
        ref,
        viewport: '${view.width.round()}x${view.height.round()}',
      );
      final id = await submitBugReport(
        ref.read(bugReportTransportProvider),
        BugReportInput(
          summary: _summary.text.trim(),
          severity: _severity,
          steps: _steps.text.trim(),
          expected: _expected.text.trim(),
          actual: _actual.text.trim(),
          reporterName: _name.text.trim(),
          reporterGithub: _github.text.trim().replaceFirst(RegExp('^@'), ''),
          reporterContact: _contact.text.trim(),
          consentCredit: _consent,
        ),
        diag,
        files: _files,
      );
      if (mounted) setState(() => _submittedId = id);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _reset() {
    for (final c in [
      _summary,
      _steps,
      _expected,
      _actual,
      _name,
      _github,
      _contact,
    ]) {
      c.clear();
    }
    setState(() {
      _severity = BugSeverity.normal;
      _consent = true;
      _files.clear();
      _submittedId = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Report a bug'),
      subtitle: tr.t(
        'A specific summary lands faster than a long paragraph. Steps to '
        'reproduce help most of all.',
      ),
      children: _submittedId != null
          ? [_success(t, tr, _submittedId!)]
          : _form(t, tr),
    );
  }

  List<Widget> _form(HarborTokens t, Translations tr) => [
    _field(
      t,
      tr.t('Summary'),
      _summary,
      hint: tr.t('Player freezes after the second episode autoplays'),
      required: true,
      maxLength: 240,
    ),
    SettingSegmented<String>(
      tokens: t,
      label: tr.t('Severity'),
      value: _severity.wire,
      options: [
        SettingOption(value: 'low', label: tr.t('Low')),
        SettingOption(value: 'normal', label: tr.t('Normal')),
        SettingOption(value: 'high', label: tr.t('High')),
        SettingOption(value: 'critical', label: tr.t('Critical')),
      ],
      onChanged: (v) => setState(
        () => _severity = BugSeverity.values.firstWhere((s) => s.wire == v),
      ),
    ),
    _field(
      t,
      tr.t('Steps to reproduce'),
      _steps,
      hint: '1. Open Movies\n2. Press Play\n3. …',
      maxLines: 4,
    ),
    _field(
      t,
      tr.t('What you expected'),
      _expected,
      hint: tr.t('Stream should start playing within a few seconds.'),
      maxLines: 2,
    ),
    _field(
      t,
      tr.t('What actually happened'),
      _actual,
      hint: tr.t('Spinner stays forever and nothing in the player loads.'),
      maxLines: 2,
    ),
    _attachments(t, tr),
    _field(
      t,
      tr.t('Display name'),
      _name,
      hint: tr.t('Display name'),
      maxLength: 120,
    ),
    _field(
      t,
      tr.t('GitHub username'),
      _github,
      hint: tr.t('GitHub username'),
      maxLength: 60,
    ),
    _field(
      t,
      tr.t('Contact'),
      _contact,
      hint: tr.t('Email or Discord'),
      maxLength: 200,
    ),
    SettingToggleRow(
      tokens: t,
      label: tr.t('Credit me in the release notes'),
      sub: tr.t(
        'Bug reporters get listed in the release notes when their report leads '
        'to a shipped fix. Leave off to stay anonymous.',
      ),
      value: _consent,
      onChanged: (v) => setState(() => _consent = v),
    ),
    if (_error != null) ...[
      const SizedBox(height: 4),
      Text(
        _error!,
        style: TextStyle(color: t.danger, fontSize: 12.5, height: 1.4),
      ),
    ],
    const SizedBox(height: 4),
    Row(
      children: [
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 12,
          onPressed: _canSubmit ? _submit : () {},
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: _canSubmit
                  ? t.accentSoft
                  : t.canvas.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _canSubmit ? t.accent : t.edgeSoft),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_submitting) ...[
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: t.accent,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  _submitting ? tr.t('Sending…') : tr.t('Send report'),
                  style: TextStyle(
                    color: _canSubmit ? t.accent : t.inkSubtle,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            _summary.text.trim().length < 6
                ? tr.t('Summary needs at least 6 characters')
                : tr.t(
                    'Diagnostics (app version, OS, integrations) are attached.',
                  ),
            style: TextStyle(color: t.inkSubtle, fontSize: 12),
          ),
        ),
      ],
    ),
  ];

  Widget _attachments(HarborTokens t, Translations tr) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 10,
            onPressed: _pickFiles,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: t.edge),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.attach_file, size: 14, color: t.inkMuted),
                  const SizedBox(width: 6),
                  Text(
                    tr.t('Attach screenshots'),
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      if (_files.isNotEmpty) ...[
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < _files.length; i++)
              Container(
                padding: const EdgeInsets.only(
                  left: 10,
                  right: 6,
                  top: 5,
                  bottom: 5,
                ),
                decoration: BoxDecoration(
                  color: t.canvas.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: t.edgeSoft),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _files[i].name,
                      style: TextStyle(color: t.inkMuted, fontSize: 12),
                    ),
                    const SizedBox(width: 4),
                    Focusable(
                      tokens: t,
                      scale: 1.0,
                      borderRadius: 999,
                      onPressed: () => setState(() => _files.removeAt(i)),
                      child: Icon(Icons.close, size: 14, color: t.inkSubtle),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    ],
  );

  Widget _success(HarborTokens t, Translations tr, String id) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: t.success.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: t.success.withValues(alpha: 0.3)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.check_circle, color: t.success, size: 20),
            const SizedBox(width: 10),
            Text(
              tr.t('Report sent — thank you!'),
              style: TextStyle(
                color: t.ink,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          tr.t('Your report id is {id}. Keep it handy for follow-ups.', {
            'id': id,
          }),
          style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 14),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 10,
          onPressed: _reset,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: t.edge),
            ),
            child: Text(
              tr.t('Report another'),
              style: TextStyle(
                color: t.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _field(
    HarborTokens t,
    String label,
    TextEditingController controller, {
    String? hint,
    int maxLines = 1,
    bool required = false,
    int? maxLength,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Text(
            label,
            style: TextStyle(
              color: t.ink,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (required)
            Text(' *', style: TextStyle(color: t.danger, fontSize: 13.5)),
        ],
      ),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: t.edgeSoft),
        ),
        child: TvTextField(
          controller: controller,
          maxLines: maxLines,
          inputFormatters: maxLength != null
              ? [LengthLimitingTextInputFormatter(maxLength)]
              : null,
          onChanged: (_) => setState(() {}),
          style: TextStyle(color: t.ink, fontSize: 14),
          cursorColor: t.accent,
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            hintText: hint,
            hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14, height: 1.3),
          ),
        ),
      ),
    ],
  );
}
