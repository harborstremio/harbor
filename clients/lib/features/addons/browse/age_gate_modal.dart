import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';

typedef AgeGateQuestion = ({String q, List<String> options, int correct});

/// The adult-content age check, ported 1:1 from `AgeGateModal`: three everyday
/// financial-literacy questions any adult would know. All-correct verifies and
/// calls [onPass]; a wrong answer reshuffles. Transcribed from the English
/// `QUESTION_BANK` (the Arabic bank ships with RTL i18n).
const List<AgeGateQuestion> _questionBank = [
  (
    q: 'Giving "two weeks\' notice" at a job means:',
    options: [
      'Booking two weeks of holiday',
      "Telling your boss you're quitting",
      'Starting a probation period',
      'Demanding a raise within 14 days',
    ],
    correct: 1,
  ),
  (
    q: 'A landlord asks for a "deposit" before move-in. What\'s it for?',
    options: [
      "Pre-paying the last month's rent",
      'A property registration tax',
      'Cover for damage when you leave',
      'Fee to the listing agent',
    ],
    correct: 2,
  ),
  (
    q: 'Your account goes "overdrawn". What happened?',
    options: [
      'You earned interest above the limit',
      'You spent past your balance',
      'You hit the savings ceiling',
      'Your bank locked the account',
    ],
    correct: 1,
  ),
  (
    q: '"Compound" interest is calculated on:',
    options: [
      'Only the original sum borrowed',
      'Sum borrowed plus earned interest',
      'A fixed amount every month',
      "Whatever's left at year-end",
    ],
    correct: 1,
  ),
  (
    q: 'You make an insurance claim. Before the insurer pays out, you usually:',
    options: [
      'Get all your past payments refunded',
      'Pay a set amount yourself first',
      'Receive a loyalty bonus instead',
      'Have the policy cancelled automatically',
    ],
    correct: 1,
  ),
  (
    q: 'Friend asks you to "co-sign" a loan. You agree to:',
    options: [
      'Split the borrowed amount equally',
      'Pay if the friend defaults',
      'Witness the contract only',
      'Receive interest from the friend',
    ],
    correct: 1,
  ),
  (
    q: 'You buy something "in installments". That means you:',
    options: [
      'Pay a one-time fee to reserve it',
      'Pay the total in smaller amounts over time',
      'Get a discount for paying early',
      'Lease it and return it after a while',
    ],
    correct: 1,
  ),
  (
    q: 'A bill is set up via "direct debit". The biller can:',
    options: [
      'Charge a one-time fee only',
      'Pull money on a schedule',
      'Reverse old transactions',
      'Convert your currency',
    ],
    correct: 1,
  ),
  (
    q: 'A mortgage is essentially:',
    options: [
      'Insurance that covers the home',
      'A loan tied to the property',
      'An agreement between landlord and tenant',
      'A yearly property tax bill',
    ],
    correct: 1,
  ),
  (
    q: 'You only ever pay the minimum on a credit card each month. Over time you:',
    options: [
      'Pay no interest as long as the minimum is met',
      'Owe more, because interest keeps building on the rest',
      'Clear the balance in equal monthly steps',
      "Lower the card's interest rate automatically",
    ],
    correct: 1,
  ),
  (
    q: 'The economy has "inflation". What\'s happening?',
    options: [
      'GDP is shrinking',
      'Prices are rising overall',
      'Currency is gaining strength',
      'Unemployment is climbing',
    ],
    correct: 1,
  ),
  (
    q: 'A document needs to be "notarised". You take it to someone who will:',
    options: [
      'Translate it into another language',
      'Verify and witness the signing',
      'File it with the government',
      'Legally enforce it',
    ],
    correct: 1,
  ),
  (
    q: 'You\'re given "power of attorney" for a relative. You can:',
    options: [
      'Inherit their property automatically',
      'Make decisions on their behalf',
      'Practise law in court for them',
      'Override their existing will',
    ],
    correct: 1,
  ),
  (
    q: 'A laid-off employee receives "severance". That\'s:',
    options: [
      'The standard year-end bonus',
      'A payout when employment ends',
      'A retirement-fund withdrawal',
      'The signing bonus from year one',
    ],
    correct: 1,
  ),
  (
    q: 'A will names someone as "executor". Their job is to:',
    options: [
      'Inherit the largest share',
      "Settle the estate's affairs",
      'Witness the signing only',
      'Approve the will in court',
    ],
    correct: 1,
  ),
  (
    q: 'Your payslip shows "gross" and "net" pay. Net is:',
    options: [
      'The hourly rate',
      'What lands in your bank',
      'Just the bonus portion',
      'The same as gross',
    ],
    correct: 1,
  ),
  (
    q: 'You sign an "NDA" with a company. You\'re agreeing to:',
    options: [
      'Not quit without long notice',
      'Not share their confidential info',
      'Waive any overtime claim',
      'Relocate if they ask',
    ],
    correct: 1,
  ),
  (
    q: 'Interest rate on a loan is shown as a percentage. It tells you:',
    options: [
      'How many months the loan lasts',
      'The cost of borrowing per year',
      "The bank's quarterly profit",
      'Total fees in fixed dollars',
    ],
    correct: 1,
  ),
  (
    q: 'A charge on your bank app sits as "pending" for a day. The merchant is:',
    options: [
      'Reversing it back to you',
      'Holding the funds before settling',
      'Charging double next week',
      'Refusing the transaction',
    ],
    correct: 1,
  ),
  (
    q: 'Your boss says "submit your timesheet by Friday". You\'re recording:',
    options: [
      'Receipts for expenses',
      'Hours you worked this week',
      'Your holiday plans',
      'A complaint to HR',
    ],
    correct: 1,
  ),
  (
    q: 'A new job\'s salary is "pro-rated" because you start mid-year. You\'ll receive:',
    options: [
      'The full annual amount upfront',
      'A share matching your months worked',
      'Double pay to catch you up',
      'Nothing until next year begins',
    ],
    correct: 1,
  ),
  (
    q: 'A subscription "auto-renews" at the end of the term. That means:',
    options: [
      'It pauses until you reactivate',
      'It charges you for another period',
      'The price drops by half',
      'It cancels and refunds',
    ],
    correct: 1,
  ),
  (
    q: 'A job offer\'s compensation is described as "competitive". That tells you:',
    options: [
      "You'll compete with peers for it",
      "It's broadly in line with the market",
      'It changes every quarter',
      "It's commission-only",
    ],
    correct: 1,
  ),
  (
    q: 'You file a tax return as a "sole proprietor" or self-employed. You owe tax on:',
    options: [
      'Only the cash you withdrew',
      'Your business profit',
      'The total revenue',
      "Whatever's in your bank account",
    ],
    correct: 1,
  ),
];

/// Ports `pickThree`: an LCG shuffle of the bank's indices, taking the first 3.
List<AgeGateQuestion> pickThreeQuestions(int seed) {
  final indices = [for (var i = 0; i < _questionBank.length; i++) i];
  var s = seed;
  for (var i = indices.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    final j = ((s / 233280) * (i + 1)).floor();
    final tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return [for (final i in indices.take(3)) _questionBank[i]];
}

class AgeGateModal extends ConsumerStatefulWidget {
  const AgeGateModal({
    super.key,
    required this.onClose,
    required this.onPass,
    this.initialSeed,
  });

  final VoidCallback onClose;
  final VoidCallback onPass;

  /// Fixes the first question set for deterministic tests; the reshuffle after a
  /// wrong answer always uses a fresh time-based seed, matching the web.
  final int? initialSeed;

  @override
  ConsumerState<AgeGateModal> createState() => _AgeGateModalState();
}

class _AgeGateModalState extends ConsumerState<AgeGateModal> {
  late List<AgeGateQuestion> _questions;
  final _picks = <int?>[null, null, null];
  bool _submitted = false;
  bool _verified = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _applySeed(
      widget.initialSeed ?? DateTime.now().millisecondsSinceEpoch % 1000000,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _reset() => _applySeed(DateTime.now().millisecondsSinceEpoch % 1000000);

  void _applySeed(int seed) {
    _questions = pickThreeQuestions(seed);
    _picks.setAll(0, [null, null, null]);
    _submitted = false;
    _verified = false;
  }

  bool get _allAnswered => _picks.every((p) => p != null);
  bool get _allCorrect {
    for (var i = 0; i < 3; i++) {
      if (_picks[i] != _questions[i].correct) return false;
    }
    return true;
  }

  void _submit() {
    setState(() => _submitted = true);
    if (_allCorrect) {
      setState(() => _verified = true);
      widget.onPass();
      _timer = Timer(const Duration(milliseconds: 1700), widget.onClose);
    } else {
      _timer = Timer(
        const Duration(milliseconds: 1400),
        () => setState(_reset),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Positioned.fill(
      child: GestureDetector(
        onTap: _verified ? null : widget.onClose,
        child: ColoredBox(
          color: Colors.black.withValues(alpha: 0.72),
          // The caller (AddonsView) takes the page behind this overlay out of
          // the focus tree while the gate is open, so the D-pad cannot escape
          // onto controls hidden behind the dim. This FocusScope + traversal
          // group scopes the quiz's own controls, and the first answer
          // autofocuses so a TV session opens with a visible focus target.
          child: FocusScope(
            child: FocusTraversalGroup(
              child: Center(
                child: GestureDetector(
                  onTap: () {}, // swallow taps inside the card
                  child: _verified ? _splash(t) : _quiz(t),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _splash(HarborTokens t) => Container(
    constraints: const BoxConstraints(maxWidth: 380),
    margin: const EdgeInsets.symmetric(horizontal: 24),
    padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 56),
    decoration: BoxDecoration(
      color: t.canvas,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: t.edge),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle, size: 84, color: Color(0xFF34D399)),
        const SizedBox(height: 24),
        Text(
          "You're verified",
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w500,
            color: t.ink,
          ),
        ),
      ],
    ),
  );

  Widget _quiz(HarborTokens t) => Container(
    constraints: const BoxConstraints(maxWidth: 576, maxHeight: 720),
    margin: const EdgeInsets.symmetric(horizontal: 24),
    decoration: BoxDecoration(
      color: t.canvas,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: t.edge),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: t.edgeSoft)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quick age check',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w500,
                  color: t.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                "A quick age check before adult add-ons unlock. Answer three "
                "everyday questions any adult would know, and you're in.",
                style: TextStyle(fontSize: 14, height: 1.5, color: t.inkMuted),
              ),
            ],
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
            child: Column(
              children: [
                for (var qi = 0; qi < _questions.length; qi++) ...[
                  if (qi > 0) const SizedBox(height: 28),
                  _questionBlock(t, qi),
                ],
              ],
            ),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(28, 20, 28, 20),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.3),
            border: Border(top: BorderSide(color: t.edgeSoft)),
          ),
          child: Column(
            children: [
              // Wrap so the Cancel / Continue buttons drop onto a second line
              // rather than overflow a narrow phone-width quiz card.
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _footerButton(
                    t,
                    'Cancel',
                    onTap: widget.onClose,
                    filled: false,
                  ),
                  _footerButton(
                    t,
                    'Continue',
                    onTap: _allAnswered ? _submit : null,
                    filled: true,
                  ),
                ],
              ),
              if (_submitted && !_allCorrect) ...[
                const SizedBox(height: 12),
                Text(
                  "That's not it. Try a fresh round in a moment.",
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFFFECDD3),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );

  Widget _questionBlock(HarborTokens t, int qi) {
    final q = _questions[qi];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: t.elevated,
              ),
              child: Text(
                '${qi + 1}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: t.inkMuted,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                q.q,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w500,
                  height: 1.5,
                  color: t.ink,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.only(left: 36),
          child: Column(
            children: [
              for (var oi = 0; oi < q.options.length; oi++) ...[
                if (oi > 0) const SizedBox(height: 6),
                _option(t, qi, oi, q),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _option(HarborTokens t, int qi, int oi, AgeGateQuestion q) {
    final picked = _picks[qi] == oi;
    final wasWrong = _submitted && picked && oi != q.correct;
    final borderColor = wasWrong
        ? const Color(0x80FB7185)
        : picked
        ? t.ink
        : t.edgeSoft;
    final bg = wasWrong
        ? const Color(0x1AFB7185)
        : picked
        ? t.elevated
        : t.elevated.withValues(alpha: 0.3);
    final fg = wasWrong
        ? const Color(0xFFFFE4E6)
        : picked
        ? t.ink
        : t.inkMuted;

    return Focusable(
      autofocus: qi == 0 && oi == 0,
      onPressed: () {
        if (_submitted) return;
        setState(() => _picks[qi] = oi);
      },
      tokens: t,
      borderRadius: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              width: 16,
              height: 16,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: picked ? t.ink : Colors.transparent,
                border: Border.all(color: picked ? t.ink : t.edge),
              ),
              child: picked
                  ? Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.canvas,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                q.options[oi],
                style: TextStyle(fontSize: 13.5, color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _footerButton(
    HarborTokens t,
    String label, {
    required VoidCallback? onTap,
    required bool filled,
  }) {
    final enabled = onTap != null;
    final child = Container(
      padding: EdgeInsets.symmetric(horizontal: filled ? 24 : 20, vertical: 10),
      decoration: BoxDecoration(
        color: filled ? (enabled ? t.ink : t.edge) : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: filled ? null : Border.all(color: t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: filled ? (enabled ? t.canvas : t.inkSubtle) : t.inkMuted,
        ),
      ),
    );
    if (!enabled) return child;
    return Focusable(
      onPressed: onTap,
      tokens: t,
      borderRadius: 999,
      child: child,
    );
  }
}
