const ageGate: Record<string, string> = {
  'Giving "two weeks\' notice" at a job means:': "ماذا يعني تقديم «إشعار قبل أسبوعين» في العمل؟",
  "Booking two weeks of holiday": "حجز إجازة لمدة أسبوعين",
  "Telling your boss you're quitting": "إبلاغ مديرك بأنك ستترك العمل",
  "Starting a probation period": "بدء فترة اختبار",
  "Demanding a raise within 14 days": "المطالبة بزيادة الراتب خلال 14 يومًا",

  'A landlord asks for a "deposit" before move-in. What\'s it for?':
    "يطلب المالك «تأمينًا» قبل الانتقال إلى المسكن. ما الغرض منه؟",
  "Pre-paying the last month's rent": "دفع إيجار الشهر الأخير مقدمًا",
  "A property registration tax": "ضريبة تسجيل العقار",
  "Cover for damage when you leave": "تغطية الأضرار عند مغادرة المسكن",
  "Fee to the listing agent": "رسوم لوكيل الإعلان العقاري",

  'Your account goes "overdrawn". What happened?': "أصبح حسابك «مكشوفًا». ماذا حدث؟",
  "You earned interest above the limit": "حصلت على فائدة تجاوزت الحد",
  "You spent past your balance": "أنفقت أكثر من رصيدك",
  "You hit the savings ceiling": "بلغت الحد الأقصى للادخار",
  "Your bank locked the account": "جمّد البنك حسابك",

  '"Compound" interest is calculated on:': "على أي مبلغ تُحتسب الفائدة «المركّبة»؟",
  "Only the original sum borrowed": "المبلغ الأصلي المقترض فقط",
  "Sum borrowed plus earned interest": "المبلغ المقترض مضافًا إليه الفائدة المتراكمة",
  "A fixed amount every month": "مبلغ ثابت كل شهر",
  "Whatever's left at year-end": "المبلغ المتبقي في نهاية السنة",

  "You make an insurance claim. Before the insurer pays out, you usually:":
    "عندما تقدّم مطالبة تأمين، ماذا تفعل عادةً قبل أن تدفع شركة التأمين؟",
  "Get all your past payments refunded": "تسترد جميع أقساطك السابقة",
  "Pay a set amount yourself first": "تدفع مبلغ تحمّل محددًا أولًا",
  "Receive a loyalty bonus instead": "تحصل على مكافأة ولاء بدلًا من ذلك",
  "Have the policy cancelled automatically": "تُلغى وثيقتك تلقائيًا",

  'Friend asks you to "co-sign" a loan. You agree to:':
    "يطلب منك صديق أن تكون «ضامنًا» لقرضه. على ماذا توافق؟",
  "Split the borrowed amount equally": "تقاسم المبلغ المقترض بالتساوي",
  "Pay if the friend defaults": "السداد إذا تعثّر صديقك",
  "Witness the contract only": "الشهادة على العقد فقط",
  "Receive interest from the friend": "تقاضي فائدة من صديقك",

  'You buy something "in installments". That means you:': "تشتري شيئًا «بالتقسيط». ماذا يعني ذلك؟",
  "Pay a one-time fee to reserve it": "تدفع رسمًا لمرة واحدة لحجزه",
  "Pay the total in smaller amounts over time": "تدفع المبلغ الإجمالي على دفعات أصغر مع مرور الوقت",
  "Get a discount for paying early": "تحصل على خصم مقابل الدفع المبكر",
  "Lease it and return it after a while": "تستأجره ثم تعيده بعد مدة",

  'A bill is set up via "direct debit". The biller can:':
    "أُعدّت فاتورة للسداد عبر «الخصم المباشر». ماذا يستطيع مُصدر الفاتورة؟",
  "Charge a one-time fee only": "تحصيل رسم لمرة واحدة فقط",
  "Pull money on a schedule": "سحب المال وفق جدول محدد",
  "Reverse old transactions": "عكس المعاملات القديمة",
  "Convert your currency": "تحويل عملتك",

  "A mortgage is essentially:": "ما الرهن العقاري في جوهره؟",
  "Insurance that covers the home": "تأمين يغطي المنزل",
  "A loan tied to the property": "قرض مرتبط بالعقار",
  "An agreement between landlord and tenant": "اتفاق بين المالك والمستأجر",
  "A yearly property tax bill": "فاتورة ضريبة عقارية سنوية",

  "You only ever pay the minimum on a credit card each month. Over time you:":
    "تدفع الحد الأدنى فقط من رصيد بطاقتك الائتمانية كل شهر. ماذا يحدث بمرور الوقت؟",
  "Pay no interest as long as the minimum is met": "لا تدفع فائدة ما دمت تسدد الحد الأدنى",
  "Owe more, because interest keeps building on the rest":
    "يزداد ما تدين به لأن الفائدة تستمر في التراكم على الباقي",
  "Clear the balance in equal monthly steps": "تسدد الرصيد على دفعات شهرية متساوية",
  "Lower the card's interest rate automatically": "ينخفض معدل فائدة البطاقة تلقائيًا",

  'The economy has "inflation". What\'s happening?': "يشهد الاقتصاد «تضخمًا». ماذا يحدث؟",
  "GDP is shrinking": "ينكمش الناتج المحلي الإجمالي",
  "Prices are rising overall": "ترتفع الأسعار عمومًا",
  "Currency is gaining strength": "تزداد قوة العملة",
  "Unemployment is climbing": "ترتفع البطالة",

  'A document needs to be "notarised". You take it to someone who will:':
    "تحتاج وثيقة إلى «تصديق كاتب العدل». ماذا يفعل الشخص الذي تأخذها إليه؟",
  "Translate it into another language": "يترجمها إلى لغة أخرى",
  "Verify and witness the signing": "يتحقق من التوقيع ويشهد عليه",
  "File it with the government": "يودعها لدى جهة حكومية",
  "Legally enforce it": "ينفذها قانونيًا",

  'You\'re given "power of attorney" for a relative. You can:':
    "مُنحت «توكيلًا قانونيًا» عن قريب لك. ماذا يمكنك أن تفعل؟",
  "Inherit their property automatically": "ترث ممتلكاته تلقائيًا",
  "Make decisions on their behalf": "تتخذ قرارات نيابةً عنه",
  "Practise law in court for them": "تمارس المحاماة عنه في المحكمة",
  "Override their existing will": "تلغي وصيته الحالية",

  'A laid-off employee receives "severance". That\'s:':
    "يتلقى موظف سُرّح من العمل «تعويض نهاية خدمة». ما هو؟",
  "The standard year-end bonus": "مكافأة نهاية السنة المعتادة",
  "A payout when employment ends": "مبلغ يُدفع عند انتهاء العمل",
  "A retirement-fund withdrawal": "سحب من صندوق التقاعد",
  "The signing bonus from year one": "مكافأة التوقيع من السنة الأولى",

  'A will names someone as "executor". Their job is to:':
    "تسمّي الوصية شخصًا «منفّذًا للوصية». ما مهمته؟",
  "Inherit the largest share": "وراثة الحصة الأكبر",
  "Settle the estate's affairs": "تسوية شؤون التركة",
  "Witness the signing only": "الشهادة على التوقيع فقط",
  "Approve the will in court": "اعتماد الوصية في المحكمة",

  'Your payslip shows "gross" and "net" pay. Net is:':
    "تعرض قسيمة راتبك الأجر «الإجمالي» و«الصافي». ما الأجر الصافي؟",
  "The hourly rate": "الأجر بالساعة",
  "What lands in your bank": "المبلغ الذي يصل إلى حسابك البنكي",
  "Just the bonus portion": "جزء المكافأة فقط",
  "The same as gross": "هو نفسه الأجر الإجمالي",

  'You sign an "NDA" with a company. You\'re agreeing to:':
    "توقّع «اتفاقية عدم إفصاح» مع شركة. على ماذا توافق؟",
  "Not quit without long notice": "ألا تستقيل دون إشعار طويل",
  "Not share their confidential info": "ألا تشارك معلوماتها السرية",
  "Waive any overtime claim": "أن تتنازل عن أي مطالبة بساعات عمل إضافية",
  "Relocate if they ask": "أن تنتقل إلى مكان آخر إذا طلبت منك ذلك",

  "Interest rate on a loan is shown as a percentage. It tells you:":
    "يُعرض معدل فائدة القرض كنسبة مئوية. ماذا يوضح لك؟",
  "How many months the loan lasts": "عدد أشهر مدة القرض",
  "The cost of borrowing per year": "تكلفة الاقتراض سنويًا",
  "The bank's quarterly profit": "ربح البنك الفصلي",
  "Total fees in fixed dollars": "إجمالي الرسوم كمبلغ ثابت",

  'A charge on your bank app sits as "pending" for a day. The merchant is:':
    "تظهر عملية خصم في تطبيق البنك بحالة «معلّقة» ليوم. ماذا يفعل التاجر؟",
  "Reversing it back to you": "يعيد المبلغ إليك",
  "Holding the funds before settling": "يحجز المبلغ قبل تسوية العملية",
  "Charging double next week": "سيخصم ضعف المبلغ الأسبوع المقبل",
  "Refusing the transaction": "يرفض المعاملة",

  'Your boss says "submit your timesheet by Friday". You\'re recording:':
    "يقول مديرك: «قدّم سجل ساعاتك بحلول الجمعة». ماذا تسجّل؟",
  "Receipts for expenses": "إيصالات المصروفات",
  "Hours you worked this week": "الساعات التي عملتها هذا الأسبوع",
  "Your holiday plans": "خطط إجازتك",
  "A complaint to HR": "شكوى إلى الموارد البشرية",

  "A new job's salary is \"pro-rated\" because you start mid-year. You'll receive:":
    "رُتب راتب وظيفة جديدة «بالتناسب» لأنك ستبدأ منتصف السنة. ماذا ستحصل عليه؟",
  "The full annual amount upfront": "المبلغ السنوي كاملًا مقدمًا",
  "A share matching your months worked": "حصة تناسب عدد الأشهر التي عملتها",
  "Double pay to catch you up": "راتبًا مضاعفًا لتعويضك",
  "Nothing until next year begins": "لا شيء حتى تبدأ السنة المقبلة",

  'A subscription "auto-renews" at the end of the term. That means:':
    "اشتراك «يتجدد تلقائيًا» عند نهاية مدته. ماذا يعني ذلك؟",
  "It pauses until you reactivate": "يتوقف حتى تعيد تفعيله",
  "It charges you for another period": "يُحصّل منك مبلغ فترة جديدة",
  "The price drops by half": "ينخفض السعر إلى النصف",
  "It cancels and refunds": "يُلغى ويُعاد المبلغ",

  'A job offer\'s compensation is described as "competitive". That tells you:':
    "وُصف راتب عرض وظيفي بأنه «تنافسي». ماذا يعني ذلك؟",
  "You'll compete with peers for it": "ستتنافس مع زملائك للحصول عليه",
  "It's broadly in line with the market": "إنه متوافق عمومًا مع مستوى السوق",
  "It changes every quarter": "يتغير كل ثلاثة أشهر",
  "It's commission-only": "يعتمد على العمولة فقط",

  'You file a tax return as a "sole proprietor" or self-employed. You owe tax on:':
    "تقدّم إقرارًا ضريبيًا بصفتك «مالكًا فرديًا» أو عاملًا لحسابك. على أي مبلغ تدين بالضريبة؟",
  "Only the cash you withdrew": "النقد الذي سحبته فقط",
  "Your business profit": "ربح نشاطك التجاري",
  "The total revenue": "إجمالي الإيرادات",
  "Whatever's in your bank account": "كل ما في حسابك البنكي",
};

export default ageGate;
