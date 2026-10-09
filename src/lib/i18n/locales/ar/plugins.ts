const plugins: Record<string, string> = {
  Plugins: "المكوّنات الإضافية",
  Repositories: "المستودعات",
  "Installed plugins": "المكوّنات الإضافية المثبّتة",
  "Plugin repositories": "مستودعات المكوّنات الإضافية",
  "Plugins run in the desktop app. Open Harbor on your computer to add and manage them.":
    "تعمل المكوّنات الإضافية في تطبيق سطح المكتب. افتح Harbor على حاسوبك لإضافتها وإدارتها.",
  "Use plugins": "استخدام المكوّنات الإضافية",
  "Plugins are small scripts that look for streams on sites Harbor does not know about. Everything here was installed by you, from repositories you chose.":
    "المكوّنات الإضافية سكربتات صغيرة تبحث عن البثوث في مواقع لا يعرفها Harbor. كل ما هنا ثبّتّه أنت بنفسك من مستودعات اخترتها.",
  "Ask every enabled plugin for streams when you press Play. Turn this off to pause them all without removing anything.":
    "اطلب البثوث من كل مكوّن إضافي مفعّل عند الضغط على تشغيل. أوقف هذا الخيار لإيقاف الكل مؤقتًا دون إزالة أي شيء.",
  "Group by repository": "التجميع حسب المستودع",
  "Show one source per repository in the picker instead of one per plugin. Useful when a repository ships many small providers.":
    "اعرض مصدرًا واحدًا لكل مستودع في قائمة اختيار البث بدلًا من مصدر لكل مكوّن إضافي. مفيد عندما يضم المستودع كثيرًا من المزوّدين الصغار.",
  "Also use plugins for background checks": "استخدام المكوّنات الإضافية في الفحوصات الخلفية أيضًا",
  "Let auto-download and the next-episode prefetch ask plugins too. Off keeps plugins to the moment you press Play.":
    "اسمح للتنزيل التلقائي والتحميل المسبق للحلقة التالية بسؤال المكوّنات الإضافية أيضًا. عند الإيقاف تعمل المكوّنات الإضافية فقط عند الضغط على تشغيل.",
  "Wait time": "مدة الانتظار",
  "Plugins share the addon wait time, {n} seconds unless you changed it under Streaming sources.":
    "تشترك المكوّنات الإضافية في مدة انتظار الإضافات: {n} ثانية، ما لم تغيّرها في مصادر البث.",
  "Plugins share the addon wait time, {n} seconds unless you changed it under Streaming sources.#few":
    "تشترك المكوّنات الإضافية في مدة انتظار الإضافات: {n} ثوانٍ، ما لم تغيّرها في مصادر البث.",
  "Check safety notices": "التحقق من تنبيهات الأمان",
  "Once a day, download a short list of plugins that were found to be harmful and turn them off. Nothing about you is sent.":
    "مرة يوميًا، نزّل قائمة قصيرة بالمكوّنات الإضافية التي تبيّن أنها ضارة وأوقفها. لا يُرسل أي شيء عنك.",
  "Plugins are paused. Turn on Use plugins above to run them.":
    "المكوّنات الإضافية متوقفة مؤقتًا. فعّل «استخدام المكوّنات الإضافية» أعلاه لتشغيلها.",
  "Nothing installed yet": "لم يُثبَّت شيء بعد",
  "Add a repository, then install the providers you want. They show up here.":
    "أضف مستودعًا ثم ثبّت المزوّدين الذين تريدهم. ستظهر هنا.",
  "Add a repository": "إضافة مستودع",
  "Movies and series": "أفلام ومسلسلات",
  Script: "سكربت",
  Verified: "موثّق",
  "v{version} available": "الإصدار v{version} متاح",
  "Paused after {n} failures. Turn it back on to try again.":
    "أُوقف مؤقتًا بعد {n} إخفاقًا. أعد تفعيله للمحاولة مجددًا.",
  "Paused after {n} failures. Turn it back on to try again.#one":
    "أُوقف مؤقتًا بعد {n} إخفاق. أعد تفعيله للمحاولة مجددًا.",
  "Paused after {n} failures. Turn it back on to try again.#few":
    "أُوقف مؤقتًا بعد {n} إخفاقات. أعد تفعيله للمحاولة مجددًا.",
  "Needs Harbor {version} or newer.": "يتطلب Harbor {version} أو أحدث.",
  "This file is not a stream plugin.": "هذا الملف ليس مكوّنًا إضافيًا للبث.",
  "Turned off by its repository.": "أوقفه مستودعه.",
  "Plugin files changed on disk. Reinstall it from its repository.":
    "تغيّرت ملفات المكوّن الإضافي على القرص. أعد تثبيته من مستودعه.",
  "Files changed": "تغيّرت الملفات",
  "No longer listed by its repository.": "لم يعد مدرجًا في مستودعه.",
  "Hidden by parental controls": "مخفي بواسطة الرقابة الأبوية",
  "Disabled by a safety notice": "معطّل بسبب تنبيه أمان",
  "Timed out after {n} seconds.": "انتهت المهلة بعد {n} ثانية.",
  "Timed out after {n} seconds.#few": "انتهت المهلة بعد {n} ثوانٍ.",
  "Timed out on the last {count} titles.": "انتهت المهلة في آخر {count} عنوانًا.",
  "Timed out on the last {count} titles.#one": "انتهت المهلة في آخر {count} عنوان.",
  "Timed out on the last {count} titles.#few": "انتهت المهلة في آخر {count} عناوين.",
  "Stopped with: {error}": "توقف مع الخطأ: {error}",
  "Could not start: {error}": "تعذّر البدء: {error}",
  "Needs a TMDB id for this title.": "يحتاج إلى معرّف TMDB لهذا العنوان.",
  "Plugin files": "ملفات المكوّن الإضافي",
  "v{version} from {repo}, installed {when}.": "v{version} من {repo}، ثُبّت {when}.",
  "Update to v{version}": "التحديث إلى v{version}",
  "Revert to v{version}": "الرجوع إلى v{version}",
  Reaches: "يتصل بـ",
  "Any public website. This plugin did not say which sites it uses.":
    "أي موقع عام. لم يحدد هذا المكوّن الإضافي المواقع التي يستخدمها.",
  "Seen so far: {hosts}": "شوهد حتى الآن: {hosts}",
  "Limit to these hosts": "التقييد بهذه النطاقات",
  "Allow any host": "السماح بأي نطاق",
  "Recent activity": "النشاط الأخير",
  "Found {count} streams for {title} in {seconds}s":
    "عُثر على {count} بثًا لـ {title} خلال {seconds} ث",
  "Found {count} streams for {title} in {seconds}s#one":
    "عُثر على {count} بث لـ {title} خلال {seconds} ث",
  "Found {count} streams for {title} in {seconds}s#few":
    "عُثر على {count} بثوث لـ {title} خلال {seconds} ث",
  "No streams for {title}": "لا بثوث لـ {title}",
  "Nothing yet. Kept on this computer only.": "لا شيء بعد. يُحفظ على هذا الحاسوب فقط.",
  "Check it works": "التحقق من عمله",
  "Runs this plugin on a real title and shows what came back.":
    "يشغّل هذا المكوّن الإضافي على عنوان حقيقي ويعرض ما أعاده.",
  "Checking…": "جارٍ التحقق…",
  "Found {count} streams in {seconds}s.": "عُثر على {count} بثًا خلال {seconds} ث.",
  "Found {count} streams in {seconds}s.#one": "عُثر على {count} بث خلال {seconds} ث.",
  "Found {count} streams in {seconds}s.#few": "عُثر على {count} بثوث خلال {seconds} ث.",
  "{requests} requests": "{requests} طلبًا",
  "{requests} requests#one": "{requests} طلب",
  "{requests} requests#few": "{requests} طلبات",
  "No streams came back.": "لم يُعَد أي بث.",
  "Failed: {error}": "فشل: {error}",
  "Installed {name}.": "ثُبّت {name}.",
  "Removed {name}.": "أُزيل {name}.",
  "Updated {name} to v{version}.": "حُدّث {name} إلى v{version}.",
  "Reverted {name} to v{version}.": "أُعيد {name} إلى v{version}.",
  "Paste the manifest link of a repository you trust. Harbor reads its own plugin repositories and provider-script repositories as they are, and installs nothing until you choose to.":
    "الصق رابط ملف manifest لمستودع تثق به. يقرأ Harbor مستودعات المكوّنات الإضافية الخاصة به ومستودعات سكربتات المزوّدين كما هي، ولا يثبّت شيئًا حتى تقرر ذلك.",
  "Repository link": "رابط المستودع",
  "Any GitHub link works, raw or not. Harbor adds /manifest.json when it is missing. Paste several to add them all.":
    "يعمل أي رابط GitHub، سواء كان raw أم لا. يضيف Harbor المسار /manifest.json عند غيابه. الصق عدة روابط لإضافتها كلها.",
  "Only https links are accepted.": "تُقبل روابط https فقط.",
  "That link did not answer.": "لم يستجب هذا الرابط.",
  "This does not look like a plugin repository. Harbor expects { name, plugins } or a provider-script manifest with scrapers.":
    "لا يبدو هذا مستودع مكوّنات إضافية. يتوقع Harbor بنية { name, plugins } أو ملف manifest لسكربتات المزوّدين يحتوي على scrapers.",
  "This is a manga repository. Add it from the Manga page.":
    "هذا مستودع مانغا. أضفه من صفحة المانغا.",
  "These are compiled Android extensions (.cs3). Harbor runs script plugins only, so they cannot be installed here.":
    "هذه إضافات أندرويد مُجمَّعة (.cs3). يشغّل Harbor إضافات نصية برمجية فقط، لذا لا يمكن تثبيتها هنا.",
  "This is a Stremio addon manifest. Add it from the Addons page instead.":
    "هذا ملف تعريف إضافة Stremio. أضفها من صفحة الإضافات بدلاً من ذلك.",
  "Already added.": "مضاف مسبقًا.",
  "Added {repo} with {count} providers.": "أُضيف {repo} مع {count} مزوّدًا.",
  "Added {repo} with {count} providers.#one": "أُضيف {repo} مع {count} مزوّد.",
  "Added {repo} with {count} providers.#few": "أُضيف {repo} مع {count} مزوّدين.",
  "Your repositories": "مستودعاتك",
  "No repositories yet": "لا مستودعات بعد",
  "Add one above. Nothing installs until you pick a plugin.":
    "أضف واحدًا أعلاه. لا يُثبَّت شيء حتى تختار مكوّنًا إضافيًا.",
  "{count} plugins": "{count} مكوّنًا إضافيًا",
  "{count} plugins#one": "{count} مكوّن إضافي",
  "{count} plugins#few": "{count} مكوّنات إضافية",
  "{count} installed": "{count} مثبّتًا",
  "{count} installed#one": "{count} مثبّت",
  "{count} installed#few": "{count} مثبّتة",
  "checked {when}": "فُحص {when}",
  "{count} updates available": "{count} تحديثًا متاحًا",
  "{count} updates available#one": "{count} تحديث متاح",
  "{count} updates available#few": "{count} تحديثات متاحة",
  "Update all": "تحديث الكل",
  "Remove and uninstall {count}?": "إزالة وإلغاء تثبيت {count}؟",
  "Could not reach this repository. Installed plugins keep working.":
    "تعذّر الوصول إلى هذا المستودع. المكوّنات الإضافية المثبّتة تستمر في العمل.",
  "This repository lists no plugins.": "لا يدرج هذا المستودع أي مكوّنات إضافية.",
  "This repository is not for stream plugins.": "هذا المستودع ليس لمكوّنات البث الإضافية.",
  "Not a stream plugin: it exports no getStreams or streams function.":
    "ليس مكوّنًا إضافيًا للبث: لا يصدّر دالة getStreams أو streams.",
  "File is larger than 2 MB.": "حجم الملف أكبر من 2 م.ب.",
  "Checksum did not match the manifest.": "المجموع الاختباري لا يطابق ملف manifest.",
  "Checking for updates": "التحقق من التحديثات",
  "Check repositories daily": "فحص المستودعات يوميًا",
  "Once a day, look for newer versions and show an Update button here. Harbor never installs an update by itself.":
    "مرة يوميًا، ابحث عن إصدارات أحدث واعرض زر تحديث هنا. لا يثبّت Harbor أي تحديث من تلقاء نفسه.",
  "Settings this plugin asked for. Stored on this computer only.":
    "إعدادات طلبها هذا المكوّن الإضافي. تُحفظ على هذا الحاسوب فقط.",
  "This plugin's settings form failed to load: {error}":
    "تعذّر تحميل نموذج إعدادات هذا المكوّن الإضافي: {error}",
  "{n} of {m} answered, {k} failed": "أجاب {n} من {m}، وأخفق {k}",
  "Install all": "تثبيت الكل",
  "Installing {done} of {total}": "جارٍ تثبيت {done} من {total}",
  "Small scripts that find streams, manga and books on sites Harbor does not know about, installed from repositories you choose.":
    "سكربتات صغيرة تعثر على البثوث والمانغا والكتب في مواقع لا يعرفها Harbor، تُثبَّت من مستودعات تختارها.",
  "Remove all": "إزالة الكل",
};

export default plugins;
