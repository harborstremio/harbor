import { useEffect, useMemo, useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";

type Question = {
  q: string;
  options: string[];
  correct: number;
  hint?: string;
};

// Arabic questions bank - adult financial literacy quiz
const QUESTION_BANK: Question[] = [
  {
    q: 'Giving "two weeks\' notice" at a job means:',
    options: [
      "Booking two weeks of holiday",
      "Telling your boss you're quitting",
      "Starting a probation period",
      "Demanding a raise within 14 days",
    ],
    correct: 1,
  },
  {
    q: 'A landlord asks for a "deposit" before move-in. What\'s it for?',
    options: [
      "Pre-paying the last month's rent",
      "A property registration tax",
      "Cover for damage when you leave",
      "Fee to the listing agent",
    ],
    correct: 2,
  },
  {
    q: 'Your account goes "overdrawn". What happened?',
    options: [
      "You earned interest above the limit",
      "You spent past your balance",
      "You hit the savings ceiling",
      "Your bank locked the account",
    ],
    correct: 1,
  },
  {
    q: '"Compound" interest is calculated on:',
    options: [
      "Only the original sum borrowed",
      "Sum borrowed plus earned interest",
      "A fixed amount every month",
      "Whatever's left at year-end",
    ],
    correct: 1,
  },
  {
    q: "You make an insurance claim. Before the insurer pays out, you usually:",
    options: [
      "Get all your past payments refunded",
      "Pay a set amount yourself first",
      "Receive a loyalty bonus instead",
      "Have the policy cancelled automatically",
    ],
    correct: 1,
  },
  {
    q: 'Friend asks you to "co-sign" a loan. You agree to:',
    options: [
      "Split the borrowed amount equally",
      "Pay if the friend defaults",
      "Witness the contract only",
      "Receive interest from the friend",
    ],
    correct: 1,
  },
  {
    q: 'You buy something "in installments". That means you:',
    options: [
      "Pay a one-time fee to reserve it",
      "Pay the total in smaller amounts over time",
      "Get a discount for paying early",
      "Lease it and return it after a while",
    ],
    correct: 1,
  },
  {
    q: 'A bill is set up via "direct debit". The biller can:',
    options: [
      "Charge a one-time fee only",
      "Pull money on a schedule",
      "Reverse old transactions",
      "Convert your currency",
    ],
    correct: 1,
  },
  {
    q: "A mortgage is essentially:",
    options: [
      "Insurance that covers the home",
      "A loan tied to the property",
      "An agreement between landlord and tenant",
      "A yearly property tax bill",
    ],
    correct: 1,
  },
  {
    q: "You only ever pay the minimum on a credit card each month. Over time you:",
    options: [
      "Pay no interest as long as the minimum is met",
      "Owe more, because interest keeps building on the rest",
      "Clear the balance in equal monthly steps",
      "Lower the card's interest rate automatically",
    ],
    correct: 1,
  },
  {
    q: 'The economy has "inflation". What\'s happening?',
    options: [
      "GDP is shrinking",
      "Prices are rising overall",
      "Currency is gaining strength",
      "Unemployment is climbing",
    ],
    correct: 1,
  },
  {
    q: 'A document needs to be "notarised". You take it to someone who will:',
    options: [
      "Translate it into another language",
      "Verify and witness the signing",
      "File it with the government",
      "Legally enforce it",
    ],
    correct: 1,
  },
  {
    q: 'You\'re given "power of attorney" for a relative. You can:',
    options: [
      "Inherit their property automatically",
      "Make decisions on their behalf",
      "Practise law in court for them",
      "Override their existing will",
    ],
    correct: 1,
  },
  {
    q: 'A laid-off employee receives "severance". That\'s:',
    options: [
      "The standard year-end bonus",
      "A payout when employment ends",
      "A retirement-fund withdrawal",
      "The signing bonus from year one",
    ],
    correct: 1,
  },
  {
    q: 'A will names someone as "executor". Their job is to:',
    options: [
      "Inherit the largest share",
      "Settle the estate's affairs",
      "Witness the signing only",
      "Approve the will in court",
    ],
    correct: 1,
  },
  {
    q: 'Your payslip shows "gross" and "net" pay. Net is:',
    options: [
      "The hourly rate",
      "What lands in your bank",
      "Just the bonus portion",
      "The same as gross",
    ],
    correct: 1,
  },
  {
    q: 'You sign an "NDA" with a company. You\'re agreeing to:',
    options: [
      "Not quit without long notice",
      "Not share their confidential info",
      "Waive any overtime claim",
      "Relocate if they ask",
    ],
    correct: 1,
  },
  {
    q: "Interest rate on a loan is shown as a percentage. It tells you:",
    options: [
      "How many months the loan lasts",
      "The cost of borrowing per year",
      "The bank's quarterly profit",
      "Total fees in fixed dollars",
    ],
    correct: 1,
  },
  {
    q: 'A charge on your bank app sits as "pending" for a day. The merchant is:',
    options: [
      "Reversing it back to you",
      "Holding the funds before settling",
      "Charging double next week",
      "Refusing the transaction",
    ],
    correct: 1,
  },
  {
    q: 'Your boss says "submit your timesheet by Friday". You\'re recording:',
    options: [
      "Receipts for expenses",
      "Hours you worked this week",
      "Your holiday plans",
      "A complaint to HR",
    ],
    correct: 1,
  },
  {
    q: "A new job's salary is \"pro-rated\" because you start mid-year. You'll receive:",
    options: [
      "The full annual amount upfront",
      "A share matching your months worked",
      "Double pay to catch you up",
      "Nothing until next year begins",
    ],
    correct: 1,
  },
  {
    q: 'A subscription "auto-renews" at the end of the term. That means:',
    options: [
      "It pauses until you reactivate",
      "It charges you for another period",
      "The price drops by half",
      "It cancels and refunds",
    ],
    correct: 1,
  },
  {
    q: 'A job offer\'s compensation is described as "competitive". That tells you:',
    options: [
      "You'll compete with peers for it",
      "It's broadly in line with the market",
      "It changes every quarter",
      "It's commission-only",
    ],
    correct: 1,
  },
  {
    q: 'You file a tax return as a "sole proprietor" or self-employed. You owe tax on:',
    options: [
      "Only the cash you withdrew",
      "Your business profit",
      "The total revenue",
      "Whatever's in your bank account",
    ],
    correct: 1,
  },
];

const AR_QUESTION_BANK: Question[] = [
  {
    q: 'تقديم "إشعار أسبوعين" في العمل يعني:',
    options: [
      "حجز أسبوعين من الإجازة",
      "إبلاغ مديرك بأنك ستستقيل",
      "بدء فترة تجريبية",
      "المطالبة بزيادة راتب خلال 14 يوم",
    ],
    correct: 1,
  },
  {
    q: 'المالك يطلب "وديعة" قبل الانتقال. ما الغرض منها؟',
    options: [
      "دفع آخر شهر إيجار مسبقًا",
      "ضريبة تسجيل العقار",
      "تغطية الأضرار عند المغادرة",
      "رسوم لوكالة العقار",
    ],
    correct: 2,
  },
  {
    q: 'حسابك البنكي أصبح "بالسالب". ماذا حدث؟',
    options: [
      "كسبت فائدة فوق الحد المسموح",
      "أنفقت أكثر من رصيدك",
      "وصلت لحد المدخرات",
      "أوقف البنك حسابك",
    ],
    correct: 1,
  },
  {
    q: 'الفائدة "المركبة" تُحسب على:',
    options: [
      "المبلغ الأصلي المقترض فقط",
      "المبلغ المقترض زائد الفوائد المكتسبة",
      "مبلغ ثابت كل شهر",
      "ما تبقّى في نهاية السنة",
    ],
    correct: 1,
  },
  {
    q: "قدّمت مطالبة تأمين. قبل أن تدفع شركة التأمين، عادةً عليك:",
    options: [
      "استرداد كل دفعاتك السابقة",
      "دفع مبلغ محدد أولًا بنفسك",
      "تلقّي مكافأة ولاء بدلًا منه",
      "إلغاء الوثيقة تلقائيًا",
    ],
    correct: 1,
  },
  {
    q: 'صديق يطلب منك "التوقيع المشترك" على قرض. أنت توافق على:',
    options: [
      "تقسيم المبلغ المقترض بالتساوي",
      "السداد إذا تخلّف صديقك عن الدفع",
      "الشهادة على العقد فقط",
      "تحصيل فائدة من الصديق",
    ],
    correct: 1,
  },
  {
    q: 'اشتريت شيئًا "بالتقسيط". هذا يعني أنك:',
    options: [
      "تدفع رسومًا لحجزه",
      "تدفع المبلغ كاملًا بدفعات أصغر على مدى الوقت",
      "تحصل على خصم لدفعك المبكر",
      "تستأجره وتعيده لاحقًا",
    ],
    correct: 1,
  },
  {
    q: 'فاتورة مُعدَّة عبر "الخصم المباشر". يمكن للجهة المُصدِرة:',
    options: [
      "فرض رسوم مرة واحدة فقط",
      "سحب المبلغ وفق جدول زمني",
      "عكس المعاملات القديمة",
      "تحويل عملتك",
    ],
    correct: 1,
  },
  {
    q: "الرهن العقاري هو في الأساس:",
    options: [
      "تأمين يغطّي المنزل",
      "قرض مرتبط بالعقار",
      "اتفاق بين المالك والمستأجر",
      "فاتورة ضريبة عقارية سنوية",
    ],
    correct: 1,
  },
  {
    q: "تدفع فقط الحد الأدنى على بطاقة الائتمان كل شهر. بمرور الوقت:",
    options: [
      "لا تدفع فائدة طالما سدّدت الحد الأدنى",
      "يزيد ما تدين به لأن الفائدة تتراكم على الباقي",
      "تصفّي الرصيد بخطوات شهرية متساوية",
      "تنخفض نسبة الفائدة تلقائيًا",
    ],
    correct: 1,
  },
  {
    q: 'الاقتصاد يعاني من "التضخم". ماذا يحدث؟',
    options: ["الناتج المحلي ينكمش", "الأسعار ترتفع بشكل عام", "العملة تكتسب قوة", "البطالة ترتفع"],
    correct: 1,
  },
  {
    q: 'وثيقة تحتاج إلى "التوثيق". تأخذها لشخص سيقوم بـ:',
    options: [
      "ترجمتها إلى لغة أخرى",
      "التحقق منها وشهادة التوقيع",
      "تقديمها للحكومة",
      "تطبيقها قانونيًا",
    ],
    correct: 1,
  },
  {
    q: 'مُنحت "توكيلًا رسميًا" لأحد أقاربك. يمكنك:',
    options: [
      "وراثة ممتلكاتهم تلقائيًا",
      "اتخاذ القرارات نيابةً عنهم",
      "ممارسة القانون في المحكمة لحسابهم",
      "إلغاء وصيتهم الحالية",
    ],
    correct: 1,
  },
  {
    q: 'موظف طُرد يتلقّى "مكافأة نهاية خدمة". هي:',
    options: [
      "المكافأة المعتادة في نهاية العام",
      "مبلغ مالي عند انتهاء العمل",
      "سحب من صندوق التقاعد",
      "مكافأة التوقيع من السنة الأولى",
    ],
    correct: 1,
  },
  {
    q: 'الوصية تُسمّي شخصًا "منفّذًا". مهمّته:',
    options: [
      "الحصول على أكبر حصة",
      "تسوية شؤون التركة",
      "الشهادة على التوقيع فقط",
      "الموافقة على الوصية في المحكمة",
    ],
    correct: 1,
  },
  {
    q: 'قسيمة راتبك تُظهر الراتب "الإجمالي" و"الصافي". الصافي هو:',
    options: ["الأجر بالساعة", "ما يصل إلى حسابك البنكي", "جزء المكافأة فقط", "نفس الإجمالي"],
    correct: 1,
  },
  {
    q: 'وقّعت "اتفاقية سرية" مع شركة. أنت توافق على:',
    options: [
      "عدم الاستقالة بدون إشعار طويل",
      "عدم مشاركة معلوماتهم السرية",
      "التنازل عن مطالبة العمل الإضافي",
      "الانتقال إذا طلبوا",
    ],
    correct: 1,
  },
  {
    q: "نسبة الفائدة على قرض تُعرض كنسبة مئوية. تخبرك:",
    options: [
      "عدد أشهر القرض",
      "تكلفة الاقتراض سنويًا",
      "أرباح البنك الفصلية",
      "الرسوم الإجمالية بمبلغ ثابت",
    ],
    correct: 1,
  },
  {
    q: 'رسوم في تطبيق بنكك بحالة "معلّق" ليوم. التاجر:',
    options: [
      "يعيدها إليك",
      "يحجز الأموال قبل التسوية",
      "سيفرض ضعفها الأسبوع القادم",
      "يرفض المعاملة",
    ],
    correct: 1,
  },
  {
    q: 'مديرك يقول "أرسل كشف ساعاتك بحلول الجمعة". أنت تسجّل:',
    options: [
      "إيصالات المصاريف",
      "الساعات التي عملتها هذا الأسبوع",
      "خطط إجازتك",
      "شكوى لقسم الموارد البشرية",
    ],
    correct: 1,
  },
  {
    q: 'راتب وظيفة جديدة "محسوب بالتناسب" لأنك تبدأ في منتصف العام. ستتلقّى:',
    options: [
      "المبلغ السنوي الكامل مقدّمًا",
      "حصة تتناسب مع شهور عملك",
      "ضعف الراتب لتعويضك",
      "لا شيء حتى يبدأ العام القادم",
    ],
    correct: 1,
  },
  {
    q: 'اشتراك "يتجدّد تلقائيًا" في نهاية الفترة. هذا يعني:',
    options: [
      "يتوقف حتى تعيد تفعيله",
      "يُفوترك لفترة أخرى",
      "ينخفض سعره للنصف",
      "يُلغى ويُسترد المبلغ",
    ],
    correct: 1,
  },
  {
    q: 'عرض عمل راتبه "تنافسي". هذا يخبرك:',
    options: [
      "ستتنافس مع أقرانك للحصول عليه",
      "يتوافق بشكل عام مع السوق",
      "يتغير كل ربع سنة",
      "هو عمولة فقط",
    ],
    correct: 1,
  },
  {
    q: 'تقدّمت بإقرار ضريبي كـ "صاحب عمل حر". تدفع ضريبة على:',
    options: ["المبالغ التي سحبتها فقط", "أرباح عملك", "إجمالي الإيرادات", "ما هو في حسابك البنكي"],
    correct: 1,
  },
];

function pickThree(seed: number, bank: Question[]): Question[] {
  const indices = [...bank.keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, 3).map((i) => bank[i]);
}

export function AgeGateModal({
  open,
  onClose,
  onPass,
}: {
  open: boolean;
  onClose: () => void;
  onPass: () => void;
}) {
  const t = useT();
  const isAr = useUiLanguage() === "ar";
  const [seed, setSeed] = useState(() => Date.now() % 1_000_000);
  const questions = useMemo(
    () => pickThree(seed, isAr ? AR_QUESTION_BANK : QUESTION_BANK),
    [seed, isAr],
  );
  const [picks, setPicks] = useState<(number | null)[]>([null, null, null]);
  const [submitted, setSubmitted] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicks([null, null, null]);
    setSubmitted(false);
    setVerified(false);
    setSeed(Date.now() % 1_000_000);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const allAnswered = picks.every((p) => p != null);
  const allCorrect = questions.every((q, i) => picks[i] === q.correct);

  const handleSubmit = () => {
    setSubmitted(true);
    if (allCorrect) {
      setVerified(true);
      onPass();
      setTimeout(() => onClose(), 1700);
      return;
    }
    setTimeout(() => {
      setSeed(Date.now() % 1_000_000);
      setPicks([null, null, null]);
      setSubmitted(false);
    }, 1400);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !verified) onClose();
      }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/72 px-4 backdrop-blur-md animate-fade-in"
    >
      {verified ? (
        <VerifiedSplash t={t} />
      ) : (
        <div className="relative w-full max-w-xl animate-modal-in">
          <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-edge bg-canvas shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
            <header className="relative shrink-0 overflow-hidden border-b border-edge-soft bg-gradient-to-b from-elevated/35 to-canvas px-7 py-6">
              <div className="relative flex flex-col gap-1.5">
                <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
                  {t("Quick age check")}
                </h2>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  {t(
                    "A quick age check before adult add-ons unlock. Answer three everyday questions any adult would know, and you're in.",
                  )}
                </p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              <ol className="flex flex-col gap-7">
                {questions.map((q, qi) => (
                  <li key={qi} className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated text-[12px] font-bold text-ink-muted">
                        {qi + 1}
                      </span>
                      <p className="text-[14.5px] font-medium leading-relaxed text-ink">{q.q}</p>
                    </div>
                    <div className="ms-9 flex flex-col gap-1.5">
                      {q.options.map((opt, oi) => {
                        const picked = picks[qi] === oi;
                        const wasWrong = submitted && picked && oi !== q.correct;
                        return (
                          <button
                            key={oi}
                            onClick={() => {
                              if (submitted) return;
                              setPicks((cur) => {
                                const n = [...cur];
                                n[qi] = oi;
                                return n;
                              });
                            }}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-start text-[13.5px] transition-colors ${
                              wasWrong
                                ? "border-rose-400/50 bg-rose-400/10 text-rose-100"
                                : picked
                                  ? "border-ink bg-elevated text-ink"
                                  : "border-edge-soft bg-elevated/30 text-ink-muted hover:border-edge hover:text-ink"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                picked ? "border-ink bg-ink" : "border-edge"
                              }`}
                            >
                              {picked && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <footer className="shrink-0 border-t border-edge-soft bg-elevated/30 px-7 py-5">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-full border border-edge-soft px-5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className={`whitespace-nowrap rounded-full px-6 py-2 text-[12.5px] font-semibold leading-none transition-opacity ${
                    allAnswered
                      ? "bg-ink text-canvas hover:opacity-90"
                      : "cursor-not-allowed bg-edge text-ink-subtle"
                  }`}
                >
                  {t("Continue")}
                </button>
              </div>
              {submitted && !allCorrect && (
                <p className="mt-3 text-center text-[12px] font-medium text-rose-200">
                  {t("That's not it. Try a fresh round in a moment.")}
                </p>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedSplash({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-edge bg-canvas px-12 py-14 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] animate-modal-in">
      <div className="animate-done-pop">
        <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
          <circle
            cx="42"
            cy="42"
            r="36"
            stroke="oklch(0.78 0.17 145)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className="animate-done-ring"
            transform="rotate(-90 42 42)"
          />
          <path
            d="M27 43 L37.5 53.5 L57 33"
            stroke="oklch(0.82 0.18 145)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="animate-done-check"
          />
        </svg>
      </div>
      <p className="font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
        {t("You're verified")}
      </p>
    </div>
  );
}
