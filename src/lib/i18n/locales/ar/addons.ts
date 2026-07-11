const addons: Record<string, string> = {
  Discover: "اكتشاف",
  Installed: "مثبّتة",
  Install: "تثبيت",
  Installing: "جارٍ التثبيت",
  "Installing…": "جارٍ التثبيت…",
  Uninstalling: "جارٍ إلغاء التثبيت",
  "Installed locally": "مثبّتة محليًا",
  Updated: "تم التحديث",
  Update: "تحديث",
  Removed: "تمت الإزالة",
  "Install failed.": "فشل التثبيت.",
  "Couldn't remove. Try again.": "تعذّرت الإزالة. حاول مرة أخرى.",
  "Loading the catalog": "جارٍ تحميل الفهرس",
  "Addon order synced to your Stremio account": "تمت مزامنة ترتيب الإضافات مع حساب Stremio الخاص بك",
  "Addon order saved on this device": "تم حفظ ترتيب الإضافات على هذا الجهاز",
  Adult: "للبالغين",
  "Hide adult addons": "إخفاء إضافات البالغين",
  "Show adult addons": "إظهار إضافات البالغين",
  Filters: "المرشّحات",
  "Curated for popularity and reliability. No paid placements. Install anything else by URL on the Browse tab.":
    "منتقاة حسب الشعبية والموثوقية. لا توجد مواضع مدفوعة. ثبّت أي شيء آخر عبر الرابط في علامة تبويب التصفّح.",

  "Top rated": "الأعلى تقييمًا",
  "By community stars": "حسب نجوم المجتمع",
  "Top rising": "الأكثر صعودًا",
  "Most starred in 24 hours": "الأكثر حصولًا على النجوم خلال 24 ساعة",
  "Just added": "أُضيف حديثًا",
  "Freshest on stremio-addons.net": "الأحدث على stremio-addons.net",

  "Search addons": "ابحث عن الإضافات",
  "No addons installed yet": "لا توجد إضافات مثبّتة بعد",
  "Head to Discover. Cinemeta and OpenSubtitles cover the basics; Torrentio + a debrid key cover almost everything else.":
    "توجّه إلى الاكتشاف. تغطّي Cinemeta وOpenSubtitles الأساسيات؛ وتغطّي Torrentio مع مفتاح debrid كل شيء آخر تقريبًا.",
  "No installed addon matches that.": "لا توجد إضافة مثبّتة تطابق ذلك.",
  "Clear the search to see all {n} installed.": "امسح البحث لرؤية كل الإضافات المثبّتة البالغ عددها {n}.",
  Reorder: "إعادة ترتيب",
  "Change the order addons are tried in": "غيّر الترتيب الذي تُجرّب به الإضافات",
  "Off · catalogs and streams hidden": "متوقّفة · الفهارس ومصادر البث مخفية",
  Enabled: "مُفعّلة",
  Disabled: "مُعطّلة",
  "Click to turn off": "انقر للإيقاف",
  "Click to turn on": "انقر للتشغيل",
  "Turn {name} off": "إيقاف {name}",
  "Turn {name} on": "تشغيل {name}",
  "Re-configure this addon and apply the updated link": "أعد تهيئة هذه الإضافة وطبّق الرابط المحدّث",

  "Sign in to sync your addons across devices": "سجّل الدخول لمزامنة إضافاتك عبر الأجهزة",
  "Anything you install in Harbor pushes back to your Stremio account so it shows up on mobile too. Sign in via the avatar in the bottom-left of the sidebar.":
    "أي شيء تثبّته في Harbor يُدفع إلى حساب Stremio الخاص بك ليظهر على الجوال أيضًا. سجّل الدخول عبر الصورة الرمزية أسفل الشريط الجانبي.",
  Starters: "البدايات",
  "Common picks for a fresh setup.": "اختيارات شائعة لإعداد جديد.",

  "Browse by category": "تصفّح حسب الفئة",
  "Six places to start. Tap one and we'll filter the catalog for you.":
    "ستّة أماكن للبدء. اضغط واحدًا وسنُصفّي الفهرس لك.",
  Streaming: "البث",
  "Where your video comes from": "من أين يأتي الفيديو الخاص بك",
  Catalogs: "الفهارس",
  "Posters, ratings, lists": "الملصقات والتقييمات والقوائم",
  Subtitles: "الترجمات",
  "Captions in your language": "ترجمات بلغتك",
  "Kitsu, MAL, season-aware": "Kitsu وMAL، مدركة للمواسم",
  Torrents: "التورنت",
  "P2P sources, debrid-ready": "مصادر P2P، جاهزة لـ debrid",
  "Live TV": "البث التلفزيوني المباشر",
  "OTA channels + IPTV": "قنوات البث الهوائي + IPTV",

  Get: "احصل عليها",
  "View details": "عرض التفاصيل",
  "Set up": "إعداد",

  Official: "رسمية",
  Free: "مجانية",
  Paid: "مدفوعة",
  "Debrid required": "تتطلب debrid",
  Configurable: "قابلة للتهيئة",
  Usenet: "Usenet",

  "Manage addon": "إدارة الإضافة",
  "Install addon": "تثبيت إضافة",
  "Add from URL": "إضافة من رابط",
  "Configure on the addon's setup page": "التهيئة في صفحة إعداد الإضافة",
  "Click to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "انقر لفتح صفحة إعداد {name}. اختر خياراتك، ثم انسخ رابط التثبيت الذي تمنحك إياه والصقه أدناه لتحديث الإضافة.",
  "Click to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "انقر لفتح صفحة إعداد {name} في متصفّح Harbor المدمج. اختر خياراتك. عند النقر على تثبيت في صفحتها، يلتقط Harbor الرابط تلقائيًا ويحدّث الإضافة.",
  "Open setup page": "فتح صفحة الإعداد",
  'Heads-up: a few addons (like AIOStatus) don\'t pre-fill from the URL. If the form loads blank, paste the existing manifest URL into their "Import from URL" field to restore your settings.':
    'تنبيه: بعض الإضافات (مثل AIOStatus) لا تُملأ مسبقًا من الرابط. إذا حُمّل النموذج فارغًا، فالصق رابط الـ manifest الحالي في حقل "الاستيراد من رابط" لاستعادة إعداداتك.',
  "Or paste the install link manually": "أو الصق رابط التثبيت يدويًا",
  Read: "قراءة",
  Continue: "متابعة",
  Reading: "جارٍ القراءة",
  "Couldn't read that addon URL.": "تعذّرت قراءة رابط الإضافة هذا.",
  "Reading manifest": "قراءة الـ manifest",
  "Reading new manifest": "قراءة manifest الجديد",
  "Saving to library": "الحفظ في المكتبة",
  "Swapping configuration": "تبديل التهيئة",
  "Syncing to Stremio": "المزامنة مع Stremio",
  "Looks like a re-configure of {name}. We'll replace the existing entry so you don't end up with two copies.":
    "يبدو أنها إعادة تهيئة لـ {name}. سنستبدل الإدخال الحالي حتى لا تنتهي بنسختين.",
  "Updating {name}": "جارٍ تحديث {name}",
  "Installing {name}": "جارٍ تثبيت {name}",
  addon: "إضافة",
  "Hang tight, won't be a sec.": "تمهّل، لن يطول الأمر.",
  "is now using your new configuration.": "يستخدم الآن تهيئتك الجديدة.",
  "is ready. Open Discover or hit Play on a title to use it.": "جاهزة. افتح الاكتشاف أو اضغط تشغيل على عنوان لاستخدامها.",

  "Rate on stremio-addons.net": "قيّم على stremio-addons.net",
  "Opening stremio-addons.net in your browser to sign in and rate":
    "فتح stremio-addons.net في متصفّحك لتسجيل الدخول والتقييم",
  Community: "مجتمعية",
  Addon: "إضافة",
  "Rising · +{n} star in 24h": "صاعدة · +{n} نجمة خلال 24 ساعة",
  "Rising · +{n} stars in 24h": "صاعدة · +{n} نجوم خلال 24 ساعة",
  Removing: "جارٍ الإزالة",
  "Configure & install": "التهيئة والتثبيت",
  "Install default": "تثبيت الافتراضي",
  Reconfigure: "إعادة التهيئة",
  "Stremio link copied": "تم نسخ رابط Stremio",
  "Manifest URL copied": "تم نسخ رابط الـ manifest",
  "Couldn't copy. Select the URL manually.": "تعذّر النسخ. حدّد الرابط يدويًا.",
  "stremio:// link": "رابط //:stremio",
  Rate: "تقييم",
  "On Stremio-Addons": "على Stremio-Addons",
  "Worth knowing": "جدير بالمعرفة",
  "Project information": "معلومات المشروع",
  "Pulled from manifest": "مأخوذة من الـ manifest",
  Version: "الإصدار",
  Resources: "الموارد",
  Types: "الأنواع",
  "ID prefixes": "بادئات المعرّف",
  P2P: "P2P",
  Yes: "نعم",
  No: "لا",
  "Manifest URL": "رابط الـ manifest",
  Copy: "نسخ",
  Reveal: "إظهار",
  "Hide the full URL": "إخفاء الرابط الكامل",
  "URLs can carry debrid keys or tokens; reveal when you need to copy":
    "قد تحمل الروابط مفاتيح debrid أو رموزًا؛ أظهرها عندما تحتاج إلى النسخ",
  "Hidden by default. Manifest paths often carry API keys (debrid tokens, OMDB keys, etc.) you don't want over a shoulder.":
    "مخفي افتراضيًا. غالبًا ما تحمل مسارات الـ manifest مفاتيح API (رموز debrid، مفاتيح OMDB، إلخ) لا تريد أن تُرى من فوق كتفك.",
  "Stremio addon, packaged into Harbor's catalog.": "إضافة Stremio، ضمن فهرس Harbor.",
  "Version and capabilities come straight from the addon's manifest. Ratings and categories come from the":
    "يأتي الإصدار والإمكانات مباشرة من manifest الإضافة. وتأتي التقييمات والفئات من",
  "community API. Star, browse, and contribute on their site.": "واجهة برمجة المجتمع. قيّم وتصفّح وساهم على موقعهم.",
  "More like this": "أعمال مشابهة",
  "Recommended for you": "موصى به لك",

  "Catalogs & metadata": "الفهارس والبيانات الوصفية",
  Streams: "البثوث",
  Sports: "الرياضة",
  Tools: "الأدوات",

  Documentation: "الوثائق",
  "From stremio-addons.net": "من stremio-addons.net",
  "Show full documentation": "عرض الوثائق كاملة",
  "View more": "عرض المزيد",

  "You've reached the end · {n} addons": "لقد وصلت إلى النهاية · {n} إضافة",
  "No velocity data yet": "لا توجد بيانات سرعة بعد",
  "Trending tracks star growth across your Harbor visits. Open the addons page again tomorrow and the top risers will appear here.":
    "يتتبّع الرائج نمو النجوم عبر زياراتك لـ Harbor. افتح صفحة الإضافات مرة أخرى غدًا وستظهر هنا أكثر الإضافات صعودًا.",
  New: "جديد",

  "Organize addons": "تنظيم الإضافات",
  "Back to addons": "العودة إلى الإضافات",
  "The order decides who answers first when you press Play. Drag, use the arrows, or jump anything straight to the top.":
    "يحدّد الترتيب من يستجيب أولًا عند الضغط على تشغيل. اسحب، أو استخدم الأسهم، أو انقل أي عنصر مباشرة إلى الأعلى.",
  Backups: "النسخ الاحتياطية",
  "Save order": "حفظ الترتيب",
  "Couldn't load your Stremio collection. Nothing can be reordered safely without it.":
    "تعذّر تحميل مجموعة Stremio الخاصة بك. لا يمكن إعادة ترتيب أي شيء بأمان دونها.",
  "Go back": "رجوع",
  "Reload list": "إعادة تحميل القائمة",
  "Something unexpected went wrong. Nothing may have been written. Retry to re-check.":
    "حدث خطأ غير متوقّع. ربما لم يُكتب أي شيء. أعد المحاولة للتحقّق من جديد.",
  "Backed up. The current account order is saved in the Backups panel.":
    "تم النسخ احتياطيًا. تم حفظ ترتيب الحساب الحالي في لوحة النسخ الاحتياطية.",
  "Backup loaded into the editor. Addons added since stay at the end. Nothing changes until you press Save.":
    "تم تحميل النسخة الاحتياطية في المحرّر. تبقى الإضافات المضافة لاحقًا في النهاية. لا يتغيّر شيء حتى تضغط حفظ.",
  "Your Stremio account": "حساب Stremio الخاص بك",
  "This order syncs to every Stremio app signed into this account.":
    "يتزامن هذا الترتيب مع كل تطبيق Stremio مسجّل الدخول بهذا الحساب.",
  "No addons are synced to this account yet.": "لا توجد إضافات متزامنة مع هذا الحساب بعد.",
  "On this device only": "على هذا الجهاز فقط",
  "These live in Harbor on this computer and never touch your account.":
    "توجد هذه في Harbor على هذا الحاسوب ولا تمسّ حسابك أبدًا.",
  "On this device": "على هذا الجهاز",
  "Sign in to Stremio to organize the addons synced to your account.":
    "سجّل الدخول إلى Stremio لتنظيم الإضافات المتزامنة مع حسابك.",
  "Good to know": "جدير بالمعرفة",
  "Number 1 gets asked first for streams when you press Play.": "يُسأل رقم 1 أولًا عن البثوث عند الضغط على تشغيل.",
  "The order also decides which addon's rows win on your Home screen.":
    "يحدّد الترتيب أيضًا صفوف أي إضافة تفوز في شاشتك الرئيسية.",
  "Nothing changes until you press Save. Leaving this page discards edits.":
    "لا يتغيّر شيء حتى تضغط حفظ. مغادرة هذه الصفحة تتجاهل التعديلات.",
  "The Backups button at the top keeps your last five orders. One click restores any of them.":
    "يحتفظ زرّ النسخ الاحتياطية في الأعلى بآخر خمسة ترتيبات. نقرة واحدة تستعيد أيًّا منها.",
  "Harbor double-checks with Stremio after saving, so a half-written order can't slip through.":
    "يتحقّق Harbor مرتين مع Stremio بعد الحفظ، حتى لا يتسلّل ترتيب مكتوب جزئيًا.",

  "{n} addon": "إضافة واحدة",
  "{n} addons": "{n} إضافة",
  "Drag to reorder": "اسحب لإعادة الترتيب",
  "Move to top": "نقل إلى الأعلى",

  Checking: "جارٍ التحقّق",
  Saving: "جارٍ الحفظ",
  Verifying: "جارٍ التأكّد",
  "Couldn't save: the reordered list failed safety validation. Nothing was written.":
    "تعذّر الحفظ: فشلت القائمة المُعاد ترتيبها في التحقّق الأمني. لم يُكتب أي شيء.",
  "Couldn't reach Stremio to confirm your collection. Nothing was written.":
    "تعذّر الوصول إلى Stremio لتأكيد مجموعتك. لم يُكتب أي شيء.",
  "Your addon collection changed on another device. Nothing was written.":
    "تغيّرت مجموعة إضافاتك على جهاز آخر. لم يُكتب أي شيء.",
  "Stremio didn't confirm the save. Your collection may be unchanged. Retry will re-check before writing again.":
    "لم يؤكّد Stremio الحفظ. قد تكون مجموعتك دون تغيير. ستُعيد المحاولة التحقّق قبل الكتابة مرة أخرى.",
  "Saved, but Harbor couldn't confirm the new order. Retry to re-check.":
    "تم الحفظ، لكن تعذّر على Harbor تأكيد الترتيب الجديد. أعد المحاولة للتحقّق.",
  "Stremio reports a different order than was saved.": "يُبلّغ Stremio عن ترتيب مختلف عمّا حُفظ.",

  "A safety copy of your addon order. One is saved automatically before Harbor writes any change, and you can save one yourself any time. The five most recent are kept.":
    "نسخة أمان من ترتيب إضافاتك. تُحفظ واحدة تلقائيًا قبل أن يكتب Harbor أي تغيير، ويمكنك حفظ واحدة بنفسك في أي وقت. يُحتفظ بأحدث خمس نسخ.",
  "Back up current order": "نسخ الترتيب الحالي احتياطيًا",
  "No backups yet. Press the button above to save your first one.":
    "لا توجد نسخ احتياطية بعد. اضغط الزرّ أعلاه لحفظ أول نسخة.",
  "{names} +{n} more": "{names} +{n} أخرى",
  Restore: "استعادة",

  Cancel: "إلغاء",
  Close: "إغلاق",
  Done: "تم",
  Copied: "تم النسخ",
  "Copy URL": "نسخ الرابط",
  Hide: "إخفاء",
  Manage: "إدارة",
  Retry: "إعادة المحاولة",
  "Try again": "حاول مرة أخرى",
  Remove: "إزالة",
  "Show less": "عرض أقل",
  "Move up": "نقل لأعلى",
  "Move down": "نقل لأسفل",
  "See all ({n})": "عرض الكل ({n})",
  Anime: "أنمي",
  "Loading…": "جارٍ التحميل…",
  "Untitled addon": "إضافة بلا عنوان",
  "Paste manifest URL or stremio:// link": "الصق رابط الـ manifest أو رابط //:stremio",
  "Install from URL: paste any manifest or stremio:// link": "التثبيت من رابط: الصق أي manifest أو رابط //:stremio",
  "Click below to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "انقر أدناه لفتح صفحة إعداد {name}. اختر خياراتك، ثم انسخ رابط التثبيت الذي تمنحك إياه والصقه أدناه لتحديث الإضافة.",
  "Click below to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "انقر أدناه لفتح صفحة إعداد {name} في متصفّح Harbor المدمج. اختر خياراتك. عند النقر على تثبيت في صفحتها، يلتقط Harbor الرابط تلقائيًا ويحدّث الإضافة.",

  "Essential addons": "إضافات أساسية",
  "Start here. The ones almost everyone has.": "ابدأ من هنا. الإضافات التي لدى الجميع تقريبًا.",
  "Best for debrid": "الأفضل مع debrid",
  "Cached on Real-Debrid, TorBox, AllDebrid. Instant play.":
    "مخزّنة مؤقتًا على Real-Debrid وTorBox وAllDebrid. تشغيل فوري.",
  "Free torrent + usenet": "تورنت + Usenet مجاني",
  "No subscription needed. Quality varies.": "لا يتطلب اشتراكًا. تتفاوت الجودة.",
  "Anime done right": "أنمي بشكل صحيح",
  "Kitsu IDs, fansub-friendly, season-aware.": "معرّفات Kitsu، متوافقة مع ترجمات المعجبين، مدركة للمواسم.",
  "Proper search across providers, foreign-language coverage.": "بحث دقيق عبر المزوّدين، وتغطية للّغات الأجنبية.",
  "Better posters, ratings, episode info.": "ملصقات وتقييمات ومعلومات حلقات أفضل.",
  "Sports & live TV": "الرياضة والبث التلفزيوني المباشر",
  "Live streams that actually work.": "بثوث مباشرة تعمل فعلًا.",
  "Power tools": "أدوات احترافية",
  "Quality-of-life upgrades. Sync, ratings, trailers.": "تحسينات لجودة الاستخدام. مزامنة وتقييمات ومقاطع دعائية.",
  "NSFW. Hidden until enabled.": "محتوى للبالغين. مخفي حتى يُفعّل.",
};

export default addons;
