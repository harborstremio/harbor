/// The Arabic translation catalog. Ported from the `ar` locale namespaces in
/// `src/lib/i18n/locales/ar/`. Keys are the English source strings; any key not
/// present here falls back to English. This is the `common` namespace; other
/// namespaces are merged in as they are ported.
const arCatalog = <String, String>{
  '#{position} in {label} Today': '#{position} في {label} اليوم',
  'Top 10 {name}': 'أفضل 10 {name}',
  'Nothing in progress yet. Press Play on something.':
      'لا شيء قيد التقدم بعد. اضغط تشغيل على شيء ما.',
  'Sign in to': 'سجّل الدخول إلى',
  'to bring in your library.': 'لجلب مكتبتك.',
  'Add': 'إضافة',
  'Add Custom Source': 'إضافة قسم خارجي',
  'Add Source': 'إضافة قسم',
  'An error occurred': 'حدث خطأ',
  'Failed to fetch JSON': 'فشل جلب ملف JSON',
  'Invalid SourceRow JSON format': 'تنسيق JSON غير صالح',
  'JSON URL': 'رابط JSON',
  'JSON cannot be empty': 'JSON لا يمكن أن يكون فارغاً',
  'Paste JSON': 'لصق JSON',
  'Provide a JSON link or paste it directly.':
      'أضف رابط JSON أو الصق الكود مباشرة.',
  'Source': 'المصدر',
  'URL cannot be empty': 'الرابط لا يمكن أن يكون فارغاً',
  'Back': 'رجوع',
  'Cancel': 'إلغاء',
  'Change': 'تغيير',
  'Clear': 'مسح',
  'Close': 'إغلاق',
  'Collapse': 'طيّ',
  'Delete': 'حذف',
  'Dismiss': 'إخفاء',
  'Done': 'تم',
  'Edit': 'تعديل',
  'Favorite': 'تفضيل',
  'Favorited': 'في المفضّلة',
  'Hide': 'إخفاء',
  'Leave': 'مغادرة',
  'List': 'قائمة',
  'Load more': 'تحميل المزيد',
  'Loading': 'جارٍ التحميل',
  'Looks good': 'يبدو جيدًا',
  'Manage': 'إدارة',
  'More': 'المزيد',
  'More actions': 'إجراءات أخرى',
  'Move down': 'تحريك لأسفل',
  'Move up': 'تحريك لأعلى',
  'New': 'جديد',
  'Normal': 'عادي',
  'Playback speed': 'سرعة التشغيل',
  'Speed & sleep': 'السرعة والنوم',
  'Sleep timer': 'مؤقّت النوم',
  '1 hour': 'ساعة واحدة',
  'End of episode': 'نهاية الحلقة',
  'End of next episode': 'نهاية الحلقة التالية',
  'Sleep at end of episode': 'النوم عند نهاية الحلقة',
  'Sleep off': 'إيقاف النوم',
  'Remove': 'إزالة',
  'Rename': 'إعادة تسمية',
  'Rename row': 'إعادة تسمية الصف',
  'Renamed': 'تمت إعادة التسمية',
  'Reset': 'إعادة تعيين',
  'Reset to default': 'الإعادة إلى الافتراضي',
  'Save': 'حفظ',
  'Saved': 'تم الحفظ',
  'Search': 'بحث',
  'Play this video URL': 'تشغيل رابط الفيديو هذا',
  'From your add-ons': 'من إضافاتك',
  'See all': 'عرض الكل',
  'Send': 'إرسال',
  'Show': 'إظهار',
  'Show less': 'عرض أقل',
  'Show more': 'عرض المزيد',
  'Sign in': 'تسجيل الدخول',
  'Sign out': 'تسجيل الخروج',
  'Status': 'الحالة',
  'Stop': 'إيقاف',
  'Sync': 'مزامنة',
  'Try again': 'حاول مرة أخرى',
  'Unknown': 'غير معروف',
  'Untitled': 'بلا عنوان',
  'Clear search': 'مسح البحث',
  'Copied to clipboard': 'تم النسخ إلى الحافظة',
  'Copy link': 'نسخ الرابط',
  'Copy URL': 'نسخ الرابط',
  'Detecting': 'جارٍ الكشف...',
  'Detecting...': 'جارٍ الكشف...',
  'Filtered': 'مُصفّى',
  'Grouped': 'مُجمّع',
  'No matches': 'لا توجد نتائج',
  'Nothing here yet': 'لا يوجد شيء هنا بعد',
  'Pinned': 'مثبّت',
  'Refine search': 'تنقيح البحث',
  'Searching': 'جارٍ البحث…',
  'Searching…': 'جارٍ البحث…',
  'loading more…': 'تحميل المزيد…',
  '{n} item': 'عنصر واحد',
  '{n} items': '{n} عناصر',
  '{n} title': 'عنوان واحد',
  '{n} titles': '{n} عنوان',
  '{n} source': 'مصدر واحد',
  '{n} sources': '{n} مصادر',
  '{n} sources available': '{n} مصادر متاحة',
  '{n} source across {count} addons': 'مصدر واحد عبر {count} إضافة',
  '{n} sources across {count} addons': '{n} مصادر عبر {count} إضافة',
  '{n} provider': 'مزوّد واحد',
  '{n} providers': '{n} مزوّدات',
  '{n} genre': 'نوع واحد',
  '{n} genres': '{n} أنواع',
  '{n} people': '{n} أشخاص',
  '{n} country': 'دولة واحدة',
  '{n} countries': '{n} دول',
  '{n} active': '{n} نشط',
  '{n} hidden': '{n} مخفي',
  '{n} min': '{n} دقيقة',
  'min': 'دقيقة',
  '{n} votes': '{n} صوت',
  '{n} award': 'جائزة واحدة',
  '{n} awards': '{n} جوائز',
  '{n} ep': 'حلقة واحدة',
  '{n} eps': '{n} حلقة',
  '{n} episode': 'حلقة واحدة',
  '{n} episodes': '{n} حلقات',
  '+{n} ep': '+{n} حلقة',
  '+{n} more': '+{n} أخرى',
  '{count} dl': '{count} تنزيل',
  '{shown} of {total}': '{shown} من {total}',
  '{label} · {n} collection': '{label} · مجموعة واحدة',
  '{label} · {n} collections': '{label} · {n} مجموعات',
  'Today': 'اليوم',
  'tomorrow': 'غدًا',
  'next week': 'الأسبوع القادم',
  'in {d} days': 'خلال {d} أيام',
  'in {n} weeks': 'خلال {n} أسابيع',
  '{m}m ago': 'قبل {m} دقيقة',
  '{s}s ago': 'قبل {s} ثانية',
  '{m}m {s}s ago': 'قبل {m} دقيقة و{s} ثانية',
  '{m}m left': '{m} دقيقة متبقية',
  '{s}s left': '{s} ثانية متبقية',
  '{h}h left': '{h} ساعة متبقية',
  '{h}h {m}m left': '{h} ساعة و{m} دقيقة متبقية',
  'Add to Home': 'إضافة إلى الرئيسية',
  'On Home': 'على الرئيسية',
  'Watched on Trakt': 'تمت مشاهدته على Trakt',
  'Paused on Simkl': 'متوقّف مؤقتًا على Simkl',
  'Ep {n}': 'الحلقة {n}',
  '1 new episode since you last watched': 'حلقة جديدة واحدة منذ آخر مشاهدة',
  '{n} new episodes since you last watched': '{n} حلقات جديدة منذ آخر مشاهدة',
  '{pct}% watched': 'تمت مشاهدة {pct}%',
  'added': 'تمت الإضافة',
  'default': 'افتراضي',
  'local': 'محلي',
  'Continue': 'متابعة',
  'Quick age check': 'تحقّق سريع من العمر',
  "A quick age check before adult add-ons unlock. Answer three everyday "
          "questions any adult would know, and you're in.":
      'تحقّق سريع من العمر قبل فتح إضافات الكبار. أجب عن ثلاثة أسئلة يوميّة يعرفها أي بالغ، وستدخل.',
  "You're verified": 'تم التحقّق',
  "That's not it. Try a fresh round in a moment.":
      'إجابة غير صحيحة. ستظهر جولة جديدة بعد لحظات.',

  // The navigation rail labels (`chrome` namespace).
  'nav.home': 'الرئيسية',
  'nav.discover': 'اكتشف',
  'nav.movies': 'أفلام',
  'nav.shows': 'مسلسلات',
  'nav.anime': 'أنمي',
  'nav.live': 'البث المباشر',
  'nav.playlists': 'قوائم التشغيل',
  'nav.calendar': 'التقويم',
  'nav.library': 'مكتبتي',
  'nav.downloads': 'التنزيلات',
  'nav.addons': 'الإضافات',
  'nav.settings': 'الإعدادات',
  'nav.collections': 'المجموعات',
  'nav.arabic': 'العربية',

  // The search view (`search` / `spotlights` namespaces).
  'Search movies, shows, people…': 'ابحث عن الأفلام والمسلسلات والأشخاص…',
  'Search failed.': 'فشل البحث.',
  'No matches for "{q}"': 'لا نتائج لـ "{q}"',
  "Try a different spelling, a person's name, a year like \"1972\", or a genre "
          "like \"Horror\".":
      'جرّب تهجئة مختلفة، أو اسم شخص، أو سنة مثل "1972"، أو نوعاً مثل "رعب".',
  'Search for movies, shows and people.':
      'ابحث عن الأفلام والمسلسلات والأشخاص.',
  'RECENT': 'الأخيرة',
  'AI search': 'البحث بالذكاء الاصطناعي',
  'Describe a plot, a vibe, or even a specific episode by a scene — the AI '
          'finds matching titles.':
      'صِف حبكة أو أجواءً أو حتى حلقة بعينها من مشهد فيها — وسيجد الذكاء الاصطناعي العناوين المطابقة.',
  'Add an AI key': 'أضِف مفتاح ذكاء اصطناعي',
  'Set an OpenRouter or Groq key under Settings to use AI search.':
      'أضِف مفتاح OpenRouter أو Groq من الإعدادات لاستخدام البحث بالذكاء الاصطناعي.',
  'AI search failed': 'فشل البحث بالذكاء الاصطناعي',
  'The model could not be reached. Try again in a moment.':
      'تعذّر الوصول إلى النموذج. حاول مرة أخرى بعد لحظات.',
  'The AI could not find titles for that. Try describing it differently.':
      'لم يجد الذكاء الاصطناعي عناوين لذلك. جرّب وصفه بطريقة مختلفة.',
  'Listening…': 'يستمع…',
  'Say a title, a person, or describe what you want to watch.':
      'قل عنواناً أو اسم شخص، أو صِف ما تريد مشاهدته.',
  'Microphone is off': 'الميكروفون مُغلق',
  'Harbor needs microphone access to search by voice. Turn it on in your '
          'device settings, then try again.':
      'يحتاج Harbor إلى إذن الميكروفون للبحث الصوتي. فعّله من إعدادات جهازك ثم حاول مرة أخرى.',
  'Voice search unavailable': 'البحث الصوتي غير متاح',
  "This device doesn't offer speech recognition.":
      'لا يوفّر هذا الجهاز التعرّف على الكلام.',
  "Didn't catch that": 'لم ألتقط ذلك',
  'The microphone stopped before anything was recognized. Try again.':
      'توقّف الميكروفون قبل التعرّف على أي شيء. حاول مرة أخرى.',
  'Movies': 'أفلام',
  'Series': 'مسلسلات',
  'Movie': 'فيلم',
  'Open': 'فتح',

  // The downloads view (`downloads` namespace).
  'Saved movies and episodes for offline watching':
      'الأفلام والمسلسلات المحفوظة للمشاهدة بدون اتصال',
  'Nothing downloaded yet.': 'لا توجد تنزيلات بعد.',
  '{n} downloading': 'جارٍ تنزيل {n}',
  '{size} saved': 'تم حفظ {size}',
  'Paused': 'متوقّف مؤقتًا',
  'Download failed': 'فشل التنزيل',
  'Canceled': 'أُلغي',
  'Interrupted — re-download to finish': 'قوطع — أعد التنزيل للإكمال',
  'Pause': 'إيقاف مؤقت',
  'Resume': 'استئناف',
  'Play': 'تشغيل',

  // The calendar view (`calendar` namespace) — chrome, months, and weekdays.
  'RELEASES': 'الإصدارات',
  'All': 'الكل',
  'Previous month': 'الشهر السابق',
  'Next month': 'الشهر التالي',
  'Anticipated': 'المنتظرة',
  'Premieres': 'العروض الأولى',
  'Library': 'المكتبة',
  'Start week on Monday': 'ابدأ الأسبوع بالإثنين',
  'TV': 'مسلسلات',
  'Anime': 'أنمي',
  'The calendar could not be loaded.': 'تعذّر تحميل التقويم.',
  'Add a TMDB key in Settings to see the calendar.':
      'أضِف مفتاح TMDB في الإعدادات لعرض التقويم.',
  'Nothing in your library releases this month.':
      'لا شيء في مكتبتك يصدر هذا الشهر.',
  'No upcoming releases from Trakt this month.':
      'لا إصدارات قادمة من Trakt هذا الشهر.',
  'Nothing in your Simkl lists releases this month.':
      'لا شيء في قوائم Simkl يصدر هذا الشهر.',
  'No anticipated releases this month.': 'لا إصدارات منتظرة هذا الشهر.',
  'No premieres this month.': 'لا عروض أولى هذا الشهر.',
  'No releases this month.': 'لا إصدارات هذا الشهر.',
  'January': 'يناير',
  'February': 'فبراير',
  'March': 'مارس',
  'April': 'أبريل',
  'May': 'مايو',
  'June': 'يونيو',
  'July': 'يوليو',
  'August': 'أغسطس',
  'September': 'سبتمبر',
  'October': 'أكتوبر',
  'November': 'نوفمبر',
  'December': 'ديسمبر',
  'Sun': 'أحد',
  'Mon': 'إثنين',
  'Tue': 'ثلاثاء',
  'Wed': 'أربعاء',
  'Thu': 'خميس',
  'Fri': 'جمعة',
  'Sat': 'سبت',

  // The detail view's episode list (`detail` namespace).
  'Episodes': 'الحلقات',
  'Oldest': 'الأقدم',
  'Newest': 'الأحدث',
  'Download season': 'تنزيل الموسم',
  'Ask AI': 'اسأل الذكاء الاصطناعي',
  'Describe the episode.': 'صِف الحلقة.',
  'Find': 'ابحث',
  'No episode matched that.': 'لا توجد حلقة تطابق ذلك.',
  'Showing keyword matches instead':
      'عرض مطابقات الكلمات المفتاحية بدلاً من ذلك',
  "Ask AI to find an episode by vibe — a scene you remember, a quote, or a "
          "moment you can't place.":
      'اطلب من الذكاء الاصطناعي أن يجد حلقة حسب أجوائها — مشهد تتذكّره، أو اقتباس، أو لحظة لا تستطيع تحديدها.',
  'Mark as unwatched': 'تعليم كغير مُشاهَد',
  'Mark as watched': 'تعليم كمُشاهَد',
  'Mark watched up to here': 'تعليم كمُشاهَد حتى هنا',

  // The detail view's rails, info panel, and layout editor.
  'Could not load this title.': 'تعذّر تحميل هذا العنوان.',
  'Crew': 'طاقم العمل',
  'Cast': 'طاقم التمثيل',
  'Collection': 'المجموعة',
  'Collections': 'المجموعات',
  '{count} films': '{count} فيلم',
  'View all': 'عرض الكل',
  'Upcoming': 'قادم',
  'in {n}wks': 'خلال {n} أسابيع',
  'Add a comment…': 'أضف تعليقاً…',
  'Contains spoiler': 'يحتوي على حرق',
  'Post': 'نشر',
  'Comments must be at least 5 words.': 'يجب ألا يقل التعليق عن 5 كلمات.',
  'This title could not be posted to.': 'تعذّر النشر على هذا العنوان.',
  'Could not post your comment. Try again.': 'تعذّر نشر تعليقك. حاول مجدداً.',
  'Sign in to Trakt in Settings to add a comment.':
      'سجّل الدخول إلى Trakt من الإعدادات لإضافة تعليق.',
  'Not officially released yet. Click to search anyway in case of an early release.':
      'لم يُصدر رسمياً بعد. اضغط للبحث على أي حال تحسباً لإصدار مبكر.',
  'More Like This': 'المزيد من هذا القبيل',
  'You Might Also Like': 'قد يعجبك أيضاً',
  'Gallery': 'المعرض',
  'Information': 'معلومات',
  'Seasons': 'المواسم',
  'First aired': 'أول عرض',
  'Last aired': 'آخر عرض',
  'Networks': 'الشبكات',
  'Studio': 'الاستوديو',
  'Country': 'الدولة',
  'Original language': 'اللغة الأصلية',
  'Original title': 'العنوان الأصلي',
  'Genres': 'الأنواع',
  'Budget': 'الميزانية',
  'Revenue': 'الإيرادات',
  'Rating': 'التقييم',
  'Done editing': 'إنهاء التحرير',
  'Customize layout': 'تخصيص التخطيط',
  'episodes': 'حلقة',
  'votes': 'صوت',

  // The anime episode list (`detail` namespace) — search, filler, air dates.
  'Search episodes': 'ابحث في الحلقات',
  'No episodes match your search': 'لا حلقات تطابق بحثك',
  'FILLER': 'حشو',
  'Episode {n}': 'الحلقة {n}',
  // In-player episode panel ("Up Next" drawer).
  'Up Next': 'التالي',
  'Now Playing': 'قيد التشغيل',
  'Now playing: {label}': 'قيد التشغيل: {label}',
  'Season {n}': 'الموسم {n}',
  'Restart': 'إعادة التشغيل',
  'No description available.': 'لا يوجد وصف متاح.',
  'No episodes found for this season.': 'لا توجد حلقات لهذا الموسم.',
  'Instant Play: choosing an episode queues its stream automatically.':
      'التشغيل الفوري: اختيار حلقة يضيف بثّها تلقائيًا.',
  'Choosing an episode opens the source picker for it.':
      'اختيار حلقة يفتح مُنتقي المصادر لها.',
  // Short month names for episode air dates (the `_monthAbbr` list).
  'Jan': 'يناير',
  'Feb': 'فبراير',
  'Mar': 'مارس',
  'Apr': 'أبريل',
  'Jun': 'يونيو',
  'Jul': 'يوليو',
  'Aug': 'أغسطس',
  'Sep': 'سبتمبر',
  'Oct': 'أكتوبر',
  'Nov': 'نوفمبر',
  'Dec': 'ديسمبر',

  // The detail hero actions and the add-to-list menu.
  'Resume S{s}:E{e}': 'استئناف م{s}:ح{e}',
  'In Watchlist': 'في قائمة المشاهدة',
  'Add to Watchlist': 'أضِف إلى قائمة المشاهدة',
  'No lists yet. Create your first one below.':
      'لا قوائم بعد. أنشئ أول قائمة أدناه.',
  'ADD TO LIST': 'إضافة إلى قائمة',
  'List name…': 'اسم القائمة…',
  'Create new list': 'إنشاء قائمة جديدة',

  // The episode detail page.
  'Add a TMDB key to view episode details.':
      'أضِف مفتاح TMDB لعرض تفاصيل الحلقة.',
  'Play Episode': 'تشغيل الحلقة',
  'Stills': 'لقطات',

  // The awards block (`awards` / `misc` namespaces).
  'Awards & Recognition': 'الجوائز والتكريم',
  'Academy Awards': 'جوائز الأوسكار',
  'Primetime Emmys': 'جوائز إيمي',
  'BAFTA Awards': 'جوائز بافتا',
  'Golden Globes': 'جوائز جولدن جلوب',
  'Screen Actors Guild Awards': 'جوائز نقابة ممثلي الشاشة',
  "Critics' Choice Awards": 'جوائز اختيار النقاد',
  'Cannes Film Festival': 'مهرجان كان السينمائي',
  'Venice Film Festival': 'مهرجان البندقية السينمائي',
  'Berlin Film Festival': 'مهرجان برلين السينمائي',
  'Other Awards': 'جوائز أخرى',
  'Awards': 'الجوائز',
  'WIN': 'فوز',
  'WINS': 'فوز',
  '{n} NOMINATION': '{n} ترشيح',
  '{n} NOMINATIONS': '{n} ترشيحات',
  'ALSO NOMINATED': 'مُرشَّح أيضاً',
  'Recognized at the {award}.': 'معروف في {award}.',

  // The home screen (rails, continue-watching, hero).
  'Could not load catalogs.': 'تعذّر تحميل القوائم.',
  'Retry': 'إعادة المحاولة',
  'No catalogs yet.': 'لا قوائم بعد.',
  'Continue Watching': 'متابعة المشاهدة',
  'Home': 'الرئيسية',
  'Your TV': 'تلفازك',
  'at {time}': 'في {time}',
  'On now': 'يُعرض الآن',
  'Browse by country': 'تصفح حسب الدولة',
  'Continue watching': 'متابعة المشاهدة',
  'Your favorites': 'مفضلتك',
  'View details': 'عرض التفاصيل',
  'In watchlist': 'في قائمة المشاهدة',
  'Add to watchlist': 'أضِف إلى قائمة المشاهدة',
  'Remove from Continue Watching': 'إزالة من متابعة المشاهدة',
  'Year': 'السنة',
  'Runtime': 'المدة',
  'My Watchlist': 'قائمة مشاهدتي',
  'Your Streaming': 'بثّك',

  // The Live TV screen (`live` namespace).
  'Add source': 'إضافة مصدر',
  'Copy as M3U': 'نسخ كـ M3U',
  'Uncategorized': 'غير مصنّف',
  'Unpin': 'إلغاء التثبيت',
  'Pin to top': 'تثبيت في الأعلى',
  'Remove favourite': 'إزالة من المفضّلة',
  'Add favourite': 'إضافة إلى المفضّلة',
  'Match EPG': 'مطابقة دليل البرامج',
  'No EPG is loaded for this source.': 'لم يُحمَّل دليل برامج لهذا المصدر.',
  'No IPTV sources yet.': 'لا مصادر IPTV بعد.',
  'Could not load this playlist.': 'تعذّر تحميل قائمة التشغيل هذه.',
  'Grid': 'شبكة',
  'Guide': 'الدليل',
  'Search channels': 'ابحث في القنوات',
  'No channels in this group.': 'لا قنوات في هذه المجموعة.',
  'No channels match "{q}"': 'لا قنوات تطابق "{q}"',
  'No program info': 'لا معلومات عن البرنامج',

  // The IPTV add/edit-source form.
  'Type': 'النوع',
  'Name': 'الاسم',
  'Direct .m3u link': 'رابط .m3u مباشر',
  'Server + login': 'خادم + تسجيل دخول',
  'XMLTV only': 'XMLTV فقط',
  'M3U URL': 'رابط M3U',
  'EPG URL (optional)': 'رابط EPG (اختياري)',
  'Server': 'الخادم',
  'Username': 'اسم المستخدم',
  'Password': 'كلمة المرور',
  'XMLTV URL': 'رابط XMLTV',

  // The anime tracker-sync status toast ({tracker} = MyAnimeList / AniList).
  'Syncing to {tracker}': 'جارٍ المزامنة مع {tracker}',
  'Synced to {tracker}': 'تمت المزامنة مع {tracker}',
  'Now watching on {tracker}': 'قيد المشاهدة الآن على {tracker}',
  '{tracker} sync': 'مزامنة {tracker}',

  // The Live TV program guide + EPG-match dialog.
  'CHANNEL': 'القناة',
  'Loading program listings… channels are ready to play in the meantime.':
      'جارٍ تحميل قوائم البرامج… القنوات جاهزة للتشغيل في الأثناء.',
  'Search guide channels': 'ابحث في قنوات الدليل',
  'No guide channels match.': 'لا قنوات دليل مطابقة.',
  'Clear current match': 'مسح المطابقة الحالية',
  'Pick the guide channel for "{name}".': 'اختر قناة الدليل لـ "{name}".',

  // The profile switcher + editor.
  'Switch profile': 'تبديل الملف الشخصي',
  'No profiles yet.': 'لا ملفات شخصية بعد.',
  'Add profile': 'إضافة ملف شخصي',
  'Profile': 'ملف شخصي',
  'KID': 'طفل',
  'Edit profile': 'تعديل الملف الشخصي',
  'New profile': 'ملف شخصي جديد',
  'Profile name': 'اسم الملف الشخصي',
  'Kid profile': 'ملف الطفل',
  'A simplified, kid-safe experience.': 'تجربة مبسّطة وآمنة للأطفال.',
  'Create': 'إنشاء',

  // The parental PIN dialogs (unlock + set).
  'Enter PIN': 'أدخل رمز PIN',
  'This profile is locked. Enter the PIN to continue.':
      'هذا الملف الشخصي مقفل. أدخل رمز PIN للمتابعة.',
  'Incorrect PIN. Try again.': 'رمز PIN غير صحيح. حاول مرة أخرى.',
  'Unlock': 'إلغاء القفل',
  'Set a PIN': 'تعيين رمز PIN',
  "Pick a PIN. You'll be asked for it before this profile's locked tabs open.":
      'اختر رمز PIN. سيُطلب منك قبل فتح التبويبات المقفلة لهذا الملف الشخصي.',
  'New PIN': 'رمز PIN جديد',
  'Confirm PIN': 'تأكيد رمز PIN',
  'Use at least 4 digits.': 'استخدم 4 أرقام على الأقل.',
  'Enter current PIN': 'أدخل رمز PIN الحالي',
  'Confirm your current PIN, then pick a new one.':
      'أكّد رمز PIN الحالي، ثم اختر رمزاً جديداً.',
  'Confirm your current PIN to remove the lock.':
      'أكّد رمز PIN الحالي لإزالة القفل.',

  // The Library and On-Demand (VOD) screens.
  'MY LIBRARY': 'مكتبتي',
  'Watchlist': 'قائمة المشاهدة',
  'Your collection.': 'مجموعتك.',
  'Watchlist is what you’ve saved for later. History is everything you’ve watched.':
      'قائمة المشاهدة هي ما حفظته للاحقًا. السجل هو كل ما شاهدته.',
  'Title': 'العنوان',
  'Nothing here.': 'لا شيء هنا.',
  'Could not load this library.': 'تعذّر تحميل هذه المكتبة.',
  'This week': 'هذا الأسبوع',
  'This month': 'هذا الشهر',
  'Filter your watchlist': 'تصفية قائمة المشاهدة',
  'Your Trakt library is empty.': 'مكتبة Trakt فارغة.',
  'Your Simkl library is empty.': 'مكتبة Simkl فارغة.',
  'Your Letterboxd library is empty.': 'مكتبة Letterboxd فارغة.',
  'Your MyAnimeList library is empty.': 'مكتبة MyAnimeList فارغة.',
  'Your watchlist is empty': 'قائمة مشاهدتك فارغة',
  'Add titles to your watchlist and they will show up here.':
      'أضِف عناوين إلى قائمة مشاهدتك وستظهر هنا.',
  'No on-demand movies or series in your sources.':
      'لا أفلام أو مسلسلات عند الطلب في مصادرك.',
  'On Demand': 'عند الطلب',
  'Search on-demand': 'ابحث في المحتوى عند الطلب',

  // Custom lists — import, create and manage saved lists.
  'Add a list': 'إضافة قائمة',
  'Add list': 'إضافة قائمة',
  'Bring your lists with you': 'اصطحب قوائمك معك',
  'Create your first list': 'أنشئ قائمتك الأولى',
  'List URL or ID': 'رابط القائمة أو المعرّف',
  'My Lists': 'قوائمي',
  'My list': 'قائمتي',
  'New list': 'قائمة جديدة',
  'No lists saved yet.': 'لا توجد قوائم محفوظة بعد.',
  'No lists yet': 'لا توجد قوائم بعد',
  'One list': 'قائمة واحدة',
  'Paste a Trakt, MDBList, TMDB, Letterboxd, IMDb, or MAL list URL':
      'الصق رابط قائمة من Trakt أو MDBList أو TMDB أو Letterboxd أو IMDb أو MAL',
  'Paste a public list from Trakt, MDBList, TMDB, Letterboxd, IMDb, or MyAnimeList. Harbor pulls the titles in and keeps the artwork sharp.':
      'الصق قائمة عامة من Trakt أو MDBList أو TMDB أو Letterboxd أو IMDb أو MyAnimeList. يجلب Harbor العناوين ويبقي الصور حادّة.',
  'Remove list "{name}"?': 'إزالة القائمة "{name}"؟',
  'Rename list': 'إعادة تسمية القائمة',
  'This list is empty. Add titles from any detail page.':
      'هذه القائمة فارغة. أضف عناوين من أي صفحة تفاصيل.',
  "Use the primary profile's Stremio library, watchlist, and addons.":
      'استخدام مكتبة Stremio وقائمة المشاهدة والإضافات الخاصة بالملف الشخصي الأساسي.',
  'Weekend watchlist': 'قائمة مشاهدة نهاية الأسبوع',
  '{n} / {max} lists': '{n} / {max} قوائم',
  '{source} list detected': 'تم اكتشاف قائمة {source}',

  // The AniList library tab.
  'Add anime to your AniList and they show up here, grouped by status and ready to edit.':
      'أضف أنمي إلى AniList الخاص بك ليظهر هنا، مجمّعًا حسب الحالة وجاهزًا للتعديل.',
  'AniList': 'أني ليست (AniList)',
  "Couldn't reach AniList. Try refreshing.":
      'تعذّر الوصول إلى AniList. حاول التحديث.',
  'Loading your AniList…': 'جارٍ تحميل AniList الخاص بك…',
  'Your AniList is empty': 'AniList الخاص بك فارغ',

  // The watch-history tab.
  'History': 'السجل',
  'Loading your history…': 'جارٍ تحميل سجلّك…',
  'No history yet': 'لا يوجد سجلّ بعد',
  'Nothing watched yet': 'لم تتم مشاهدة أي شيء بعد',
  'Watched': 'تمت المشاهدة',

  // The profile picker and profile management.
  'Manage profiles': 'إدارة الملفات الشخصية',
  'Pick a profile to continue.': 'اختر ملفًا شخصيًا للمتابعة.',
  "Press play on something. It'll show up here once you start watching.":
      'اضغط تشغيل على شيء ما. سيظهر هنا بمجرد أن تبدأ المشاهدة.',
  'Select a profile to edit.': 'اختر ملفًا شخصيًا لتعديله.',
  "Sign in to Stremio or connect Trakt to see what you've been watching here.":
      'سجّل الدخول إلى Stremio أو اربط Trakt لرؤية ما كنت تشاهده هنا.',
  "Who's watching?": 'من يشاهد؟',

  // Profile PINs and the parental sidebar lock.
  'A 4-digit PIN is required to open this profile.':
      'يلزم رمز PIN مكوّن من 4 أرقام لفتح هذا الملف الشخصي.',
  'A grown-up can enter the parent PIN to keep watching.':
      'يمكن لشخص بالغ إدخال رمز PIN الأبوي لمواصلة المشاهدة.',
  'Confirm your PIN': 'أكّد رمز PIN الخاص بك',
  'Enter the parent PIN': 'أدخل رمز PIN الأبوي',
  "Enter {name}'s PIN": 'أدخل رمز PIN الخاص بـ {name}',
  'Hide sidebar tabs behind the PIN.':
      'إخفاء تبويبات الشريط الجانبي خلف رمز PIN.',
  'Keep typing, or paste the full list URL.':
      'تابع الكتابة، أو الصق رابط القائمة الكامل.',
  'Lock sidebar tabs': 'قفل تبويبات الشريط الجانبي',
  'Lock this profile behind a 4-digit PIN.':
      'اقفل هذا الملف الشخصي برمز PIN مكوّن من 4 أرقام.',
  'Locked tabs': 'التبويبات المقفلة',
  'Locks only activate once a PIN is set.':
      'تُفعَّل الأقفال فقط بعد تعيين رمز PIN.',
  'PIN set': 'تم تعيين رمز PIN',
  "PINs didn't match. Start over.": 'رمزا PIN غير متطابقين. ابدأ من جديد.',
  'Parent PIN': 'رمز PIN الأبوي',
  "Pick a 4-digit PIN. You'll be asked for it before this profile opens.":
      'اختر رمز PIN مكوّنًا من 4 أرقام. سيُطلب منك إدخاله قبل فتح هذا الملف الشخصي.',
  'Profile PIN': 'رمز PIN للملف الشخصي',
  'Profile is locked. Enter the 4-digit PIN to continue.':
      'الملف الشخصي مقفل. أدخل رمز PIN المكوّن من 4 أرقام للمتابعة.',
  'Set PIN': 'تعيين رمز PIN',
  'Set a PIN for {name}': 'تعيين رمز PIN لـ {name}',
  'Set parent PIN': 'تعيين رمز PIN الأبوي',
  'Set the parent PIN': 'عيّن رمز PIN الأبوي',
  'Sidebar access': 'الوصول إلى الشريط الجانبي',
  'Sign in from the sidebar after saving. Library and addons stay separate.':
      'سجّل الدخول من الشريط الجانبي بعد الحفظ. تبقى المكتبة والإضافات منفصلة.',
  'Type the same 4-digit PIN again.':
      'اكتب رمز PIN نفسه المكوّن من 4 أرقام مرة أخرى.',
  "When time's up, the ship sails away until a parent unlocks it.":
      'عند انتهاء الوقت، تُبحر السفينة بعيدًا حتى يفتحها أحد الوالدين.',
  'Wrong PIN': 'رمز PIN خاطئ',
  '{n} tabs locked': '{n} تبويبات مقفلة',

  // The kids time-limit lock screen.
  'Age level': 'الفئة العمرية',
  'Ask a grown-up to switch profiles.':
      'اطلب من شخص بالغ تبديل الملفات الشخصية.',
  'Daily watch time': 'وقت المشاهدة اليومي',
  'Shows titles suitable up to age {age}.': 'يعرض عناوين مناسبة حتى عمر {age}.',
  "The ship is sailing away. Thanks for watching with Harbor, it's time to listen to your grown-ups.":
      'السفينة تُبحر بعيدًا. شكرًا لمشاهدتك مع Harbor، حان وقت الاستماع إلى الكبار.',
  "Time's up!": 'انتهى الوقت!',
  "Used to lift Time's Up and to leave the kids space.":
      'يُستخدم لرفع "انتهى الوقت" ولمغادرة مساحة الأطفال.',

  // Casting to an external device.
  'Cast to a device': 'البثّ إلى جهاز',
  'Searching for devices…': 'جارٍ البحث عن الأجهزة…',
  'Stop casting': 'إيقاف البثّ',

  // The trailer sheet.
  'This trailer plays on YouTube.': 'يُعرض هذا المقطع الدعائي على YouTube.',
  'Watch on YouTube': 'المشاهدة على YouTube',

  // Shared sort, layout and status labels.
  '1 item': 'عنصر واحد',
  'A-Z': 'أ-ي',
  'Almost done': 'أوشكت على الانتهاء',
  'Change photo': 'تغيير الصورة',
  'Choose avatar': 'اختيار صورة رمزية',
  'Upload photo': 'رفع صورة',
  'Choose an avatar': 'اختر صورة رمزية',
  'Search characters or shows…': 'ابحث عن شخصيات أو مسلسلات…',
  'No avatars match your search.': 'لا توجد صور رمزية مطابقة لبحثك.',
  'Pick an avatar': 'اختر صورة رمزية',
  'A friendly face for the kids space.': 'وجه ودود لمساحة الأطفال.',
  'From {source}': 'من {source}',
  'Group the movies and shows you love. Rewatch shelf, weekend picks, whatever keeps them close.':
      'اجمع الأفلام والمسلسلات التي تحبّها. رفّ إعادة المشاهدة، اختيارات نهاية الأسبوع، أو أي شيء يبقيها قريبة.',
  'Group the movies and shows you want to keep close.':
      'اجمع الأفلام والمسلسلات التي تريد إبقاءها قريبة.',
  'Name (optional)': 'الاسم (اختياري)',
  'No matches for these filters.': 'لا توجد نتائج لهذه المرشّحات.',
  'No tabs selected': 'لم يتم تحديد أي تبويبات',
  'No titles match your filters.': 'لا عناوين تطابق مرشّحاتك.',
  'Posters': 'الملصقات',
  'Primary': 'الأساسي',
  'Recent': 'الأحدث',
  'Search title…': 'ابحث عن عنوان…',
  'Share with {name}': 'المشاركة مع {name}',
  'Shows': 'مسلسلات',
  'Stremio account': 'حساب Stremio',
  'Syncing Trakt…': 'جارٍ المزامنة مع Trakt…',
  'Type on your keyboard or tap the digits above.':
      'اكتب باستخدام لوحة المفاتيح أو انقر الأرقام أعلاه.',
  'Updated {when}': 'آخر تحديث {when}',
  'Uploading…': 'جارٍ الرفع…',
  'Use a separate Stremio account': 'استخدام حساب Stremio منفصل',
  "We'll name it from the URL.": 'سنسمّيها من الرابط.',
  '{n}m left': '{n}د متبقية',

  // The Discover "Browse by Award" tiles (award bodies and their taglines).
  'Browse by Award': 'تصفح حسب الجائزة',
  'BAFTA': 'بافتا',
  'Emmys': 'إيمي',
  'SAG Awards': 'جوائز نقابة ممثلي الشاشة',
  "Critics' Choice": 'اختيار النقاد',
  'Cannes': 'مهرجان كان',
  'Venice': 'مهرجان البندقية',
  'Berlinale': 'مهرجان برلين',
  'Best Picture and beyond': 'أفضل فيلم وما بعده',
  'Film and television': 'السينما والتلفزيون',
  'The British Academy': 'الأكاديمية البريطانية',
  "Television's finest": 'أفضل الأعمال التلفزيونية',
  'Chosen by actors': 'باختيار الممثلين',
  "The critics' cut": 'حسب اختيار النقاد',
  "Palme d'Or": 'السعفة الذهبية',
  'Golden Lion': 'الأسد الذهبي',
  'Golden Bear': 'الدب الذهبي',

  // The Discover queue CTA and the Surprise-me panel.
  'Your Discovery Queue': 'طابور الاستكشاف الخاص بك',
  '{count} picks ready': '{count} اختيارات جاهزة',
  'Explore your queue': 'استكشف طابورك',
  "Can't decide?": 'محتار؟',
  "Critics' Pick": 'اختيار النقاد',
  'Loved by reviewers today': 'محبوب من النقاد اليوم',
  'Read full': 'اقرأ الكامل',
  'Featured & Recommended': 'مميّز وموصى به',
  'Hide section': 'إخفاء القسم',
  'Show section': 'إظهار القسم',
  'Hidden': 'مخفي',
  'Customize': 'تخصيص',
  'Featured tonight': 'مختارات الليلة',
  'Trending on AniList': 'رائج على AniList',
  'Top 100 on AniList': 'أفضل 100 على AniList',
  'For You': 'مقترحة لك',
  'Featured anime': 'أنمي مميّز',
  'Show DUB badge': 'إظهار شارة الدبلجة',
  'Mark anime that has an English dub with a DUB badge.':
      'ضع شارة DUB على الأنمي الذي يتوفر له دبلجة إنجليزية.',
  'Rotate hero backdrops': 'تدوير خلفيات الواجهة',
  'Slowly cycle the detail hero through the title’s backdrop gallery. Only when there are at least two backdrops.':
      'تنقّل ببطء بين خلفيات العمل في واجهة صفحة التفاصيل. يعمل فقط عند توفّر خلفيتين على الأقل.',
  'Stats': 'إحصاءات',
  'hours watched': 'ساعات المشاهدة',
  'titles': 'عناوين',
  'plays': 'مشاهدات',
  'What you watched': 'ما شاهدته',
  'Top titles': 'أبرز العناوين',
  'Top genres': 'أبرز التصنيفات',
  'Your watch year': 'سنة مشاهدتك',
  'Nothing to show yet': 'لا شيء لعرضه بعد',
  'Estimated from your local history. Connect Trakt or Simkl for the full picture.':
      'مُقدَّرة من سجلّك المحلي. اربط Trakt أو Simkl للحصول على الصورة الكاملة.',
  'Connect Trakt or Simkl, or start watching, and your stats will build themselves.':
      'اربط Trakt أو Simkl، أو ابدأ بالمشاهدة، وستُبنى إحصاءاتك تلقائيًا.',
  'Sound effects': 'المؤثرات الصوتية',
  'Audio feedback for navigation and actions.':
      'تنبيهات صوتية للتنقّل والإجراءات.',
  'Enable sound effects': 'تفعيل المؤثرات الصوتية',
  'Play sounds for navigation and actions.':
      'تشغيل أصوات عند التنقّل والإجراءات.',
  'Glass': 'زجاجي',
  'Modern': 'عصري',
  'Retro': 'كلاسيكي',
  'Cinematic': 'سينمائي',
  'Sound effects volume': 'مستوى صوت المؤثرات',
  'Player volume sounds': 'أصوات مستوى صوت المشغّل',
  'Play a tick when you change the volume in the player. Needs a sound theme enabled above.':
      'تشغيل نغمة عند تغيير مستوى الصوت في المشغّل. يتطلّب تفعيل نمط صوتي أعلاه.',
  'Tune': 'ضبط',
  'Tune anime': 'ضبط الأنمي',
  'Shape your anime feed.': 'شكّل موجز الأنمي الخاص بك.',
  'Steer your picks toward what you love, and hide what you don’t.':
      'وجّه اختياراتك نحو ما تحب، وأخفِ ما لا تحب.',
  'Genres you want more of': 'الأنواع التي تريد المزيد منها',
  'Hide from your picks': 'إخفاء من اختياراتك',
  'Hide anime I’ve already watched': 'إخفاء الأنمي الذي شاهدته بالفعل',
  'Clear all': 'مسح الكل',
  'None yet': 'لا شيء بعد',
  '{n} selected': 'تم تحديد {n}',
  'Watching': 'قيد المشاهدة',
  'Plan to Watch': 'أنوي المشاهدة',
  'Completed': 'مكتمل',
  'On Hold': 'قيد الانتظار',
  'Dropped': 'متوقّف',
  'Surprise me': 'فاجئني',
  'Pick a random title': 'اختر عنواناً عشوائياً',

  // The Discover "Browse by Language" tiles and the language filter header.
  'Browse by Language': 'تصفح حسب اللغة',
  'Language': 'اللغة',
  'Everything originally in {name}: movies and series across every genre, era, and hidden gems.':
      'كل ما هو أصلًا بـ {name}: أفلام ومسلسلات عبر كل نوع وحقبة وجواهر خفية.',
  'Korean': 'الكورية',
  'Japanese': 'اليابانية',
  'Spanish': 'الإسبانية',
  'French': 'الفرنسية',
  'Chinese': 'الصينية',
  'Hindi': 'الهندية',
  'German': 'الألمانية',
  'Italian': 'الإيطالية',
  'Portuguese': 'البرتغالية',
  'Turkish': 'التركية',
  'Swedish': 'السويدية',
  'Danish': 'الدنماركية',
  'Norwegian': 'النرويجية',
  'Russian': 'الروسية',
  'Polish': 'البولندية',
  'Thai': 'التايلندية',
  'Dutch': 'الهولندية',
  'Arabic': 'العربية',

  // The filter browse header (year, runtime, studio, country, network).
  'Network': 'الشبكة',
  'TV Shows': 'مسلسلات تلفزيونية',
  'Around {min} min': 'نحو {min} دقيقة',
  'Everything from {year}, sorted across trending, top rated, and hidden gems.':
      'كل شيء من {year}، مرتّب عبر الرائج والأعلى تقييمًا والجواهر الخفية.',
  '{media} between {lo}-{hi} minutes. Pick a length, not a wall of options.':
      '{media} بين {lo}-{hi} دقيقة. اختر مدة، لا جدارًا من الخيارات.',
  '{media} produced by {name}, ranked from biggest hits to overlooked gems.':
      '{media} من إنتاج {name}، مرتّبة من أكبر النجاحات إلى الجواهر المُغفَلة.',
  '{media} from {name}: popular, acclaimed, and hidden alike.':
      '{media} من {name}: الشائع والمُشاد به والخفي على حدّ سواء.',
  'Series from {name}: current hits, classics, and the deep cuts.':
      'مسلسلات من {name}: النجاحات الحالية والكلاسيكيات والأعمال النادرة.',

  // The Discover "Browse by Genre" tiles and the genre filter header.
  'Browse by Genre': 'تصفح حسب التصنيف',
  'Genre': 'النوع',
  'TV Genre': 'نوع تلفزيوني',
  "The best {genre} {media}, layered by mood. Browse trending, dive into a director's run, sort by decade, find quiet gems.":
      'أفضل {media} {genre}، مرتّبة حسب المزاج. تصفّح الرائج، وتعمّق في أعمال مخرج، ورتّب حسب العقد، واكتشف الجواهر الهادئة.',
  'genre.Action': 'أكشن',
  'genre.Adventure': 'مغامرة',
  'genre.Thriller': 'إثارة',
  'genre.Crime': 'جريمة',
  'genre.Drama': 'دراما',
  'genre.Romance': 'رومانسي',
  'genre.Mystery': 'غموض',
  'genre.Sci-Fi': 'خيال علمي',
  'genre.Fantasy': 'فانتازيا',
  'genre.Horror': 'رعب',
  'genre.Comedy': 'كوميديا',
  'genre.Family': 'عائلي',
  'genre.Animation': 'أنميشن',
  'genre.Western': 'غربي',
  'genre.War': 'حرب',
  'genre.History': 'تاريخ',
  'genre.Documentary': 'وثائقي',
  'genre.Music': 'موسيقى',

  // Settings: the Account (Stremio sign-in) and Language sections.
  'Account': 'الحساب',
  'Sign in to Stremio to sync your library and add-ons across devices.':
      'سجّل الدخول إلى Stremio لمزامنة مكتبتك وإضافاتك عبر الأجهزة.',
  'Could not load your account.': 'تعذّر تحميل حسابك.',
  'Signed in': 'تم تسجيل الدخول',
  'On your phone, open Stremio and enter this code:':
      'على هاتفك، افتح Stremio وأدخل هذا الرمز:',
  'On your phone, open {link} and enter this code:':
      'على هاتفك، افتح {link} وأدخل هذا الرمز:',
  'Waiting for confirmation…': 'بانتظار التأكيد…',
  'Sign in with Stremio': 'تسجيل الدخول عبر Stremio',
  'App language': 'لغة التطبيق',
  'Choose the app language. Arabic lays the interface out right-to-left.':
      'اختر لغة التطبيق. تعرض العربية الواجهة من اليمين إلى اليسار.',

  // Settings: the Trakt, Simkl, MyAnimeList and AniList tracker sections.
  'Connected': 'متصل',
  'Connected as {name}': 'متصل باسم {name}',
  'Disconnect': 'إلغاء الارتباط',
  'Sync watch progress': 'مزامنة تقدم المشاهدة',
  'Connect': 'ربط',
  'Connecting…': 'جارٍ الربط…',
  'Waiting for authorization…': 'بانتظار التفويض…',
  'On your phone or computer, open {url} and enter this code:':
      'على هاتفك أو حاسوبك، افتح {url} وأدخل هذا الرمز:',
  'Connect Trakt to scrobble playback and sync your watchlist and watched history.':
      'اربط Trakt لتسجيل التشغيل ومزامنة قائمة مشاهدتك وسجلّ مشاهدتك.',
  'Connect Simkl to sync your watched history and watchlist across services.':
      'اربط Simkl لمزامنة سجلّ مشاهدتك وقائمة مشاهدتك عبر الخدمات.',
  'Connect MyAnimeList to sync your anime watch progress.':
      'اربط MyAnimeList لمزامنة تقدم مشاهدتك للأنمي.',
  'Connect AniList to sync your anime watch progress.':
      'اربط AniList لمزامنة تقدم مشاهدتك للأنمي.',
  'Connect Trakt': 'ربط Trakt',
  'Connect Simkl': 'ربط Simkl',
  'Connect MyAnimeList': 'ربط MyAnimeList',
  'Connect AniList': 'ربط AniList',
  'Authorize Harbor in the MyAnimeList page that opened, then paste the code shown there below.':
      'فوّض Harbor في صفحة MyAnimeList التي فُتحت، ثم الصق الرمز المعروض هناك أدناه.',
  'Authorize Harbor in the AniList page that opened, then paste the code shown there below.':
      'فوّض Harbor في صفحة AniList التي فُتحت، ثم الصق الرمز المعروض هناك أدناه.',
  'Paste the MyAnimeList code': 'الصق رمز MyAnimeList',
  'Paste the AniList code': 'الصق رمز AniList',
  'Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.':
      'إكمال حلقة أنمي يحدّث تقدمك على MyAnimeList. للتقدم فقط: لا يُنقص أبدًا عددًا لديك بالفعل.',
  'Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.':
      'إكمال حلقة أنمي يحدّث تقدمك على AniList. للتقدم فقط: لا يُنقص أبدًا عددًا لديك بالفعل.',

  // Settings: the Parental controls section (PIN + lockable sidebar tabs).
  'Parental controls': 'الرقابة الأبوية',
  'Create or select a profile to set up parental controls.':
      'أنشئ ملفًا شخصيًا أو اختر واحدًا لإعداد الرقابة الأبوية.',
  'Set a PIN and choose which sidebar tabs it protects for {name}.':
      'عيّن رمز PIN واختر تبويبات الشريط الجانبي التي يحميها لـ {name}.',
  'LOCKED TABS · none': 'التبويبات المقفلة · لا شيء',
  'LOCKED TABS · {n}': 'التبويبات المقفلة · {n}',
  'Set a PIN above to enforce these locks.':
      'عيّن رمز PIN أعلاه لتفعيل هذه الأقفال.',
  'PIN': 'رمز PIN',
  'A PIN is set.': 'تم تعيين رمز PIN.',
  'No PIN set.': 'لم يتم تعيين أي رمز.',
  'Discover': 'اكتشاف',
  'Sports': 'الرياضة',
  'Live TV': 'البث التلفزيوني المباشر',
  'Calendar': 'التقويم',
  'My Library': 'مكتبتي',
  'Addons': 'الإضافات',

  // Settings: the Anime4K presets section.
  'Anime4K presets': 'إعدادات Anime4K المسبقة',
  'GPU shaders that sharpen lines and clean up gradients on anime as it plays. Pick a mode, Harbor handles the shaders.':
      'مُظلِّلات معالج الرسوميات التي تشحذ الخطوط وتنظّف التدرّجات في الأنمي أثناء التشغيل. اختر وضعًا، ويتولّى Harbor المُظلِّلات.',
  'Quality tier': 'مستوى الجودة',
  'Quality': 'جودة',
  'Performance': 'أداء',
  'Mode': 'الوضع',
  'One-time setup downloads the shader pack (about 1 MB) into Harbor. No files to hunt down.':
      'يقوم الإعداد لمرة واحدة بتنزيل حزمة المُظلِّلات (نحو 1 ميغابايت) إلى Harbor. لا ملفات تبحث عنها.',
  'Downloading shaders…': 'جارٍ تنزيل المُظلِّلات…',
  'Set up Anime4K': 'إعداد Anime4K',
  'Shaders installed': 'تم تثبيت المُظلِّلات',
  'Updating…': 'جارٍ التحديث…',
  'Updated': 'تم التحديث',
  'Re-download': 'إعادة التنزيل',
  'Download failed. Check your connection and try again.':
      'فشل التنزيل. تحقّق من اتصالك وحاول مرة أخرى.',
  'Mode A': 'الوضع A',
  'Mode B': 'الوضع B',
  'Mode C': 'الوضع C',
  'Mode A+A': 'الوضع A+A',
  'Mode B+B': 'الوضع B+B',
  'Mode C+A': 'الوضع C+A',
  'Restore + upscale. The best all-rounder for most anime.':
      'استعادة + رفع الدقة. الأفضل لمعظم الأنمي.',
  'Softer restore. Kinder to compressed or noisy sources.':
      'استعادة أنعم. ألطف مع المصادر المضغوطة أو المشوّشة.',
  'Denoise + upscale. Lightest, cleanest on already-sharp video.':
      'إزالة التشويش + رفع الدقة. الأخف والأنظف على الفيديو الحاد أصلًا.',
  'Double restore. Sharpest detail, for high-quality sources.':
      'استعادة مزدوجة. أحدّ التفاصيل، للمصادر عالية الجودة.',
  'Double soft restore. For heavy compression artifacts.':
      'استعادة ناعمة مزدوجة. لتشوّهات الضغط الشديدة.',
  'Denoise then restore. Balanced cleanup and detail.':
      'إزالة التشويش ثم الاستعادة. تنظيف وتفاصيل متوازنة.',

  // Settings: the custom-theme colour editor.
  'Canvas': 'اللوحة',
  'Surface': 'السطح',
  'Elevated': 'المرتفع',
  'Raised': 'الناتئ',
  'Ink': 'الحبر',
  'Ink muted': 'الحبر الخافت',
  'Ink subtle': 'الحبر الخفيف',
  'Edge': 'الحافة',
  'Accent': 'اللون المميّز',
  'Danger': 'الخطر',
  'The app background behind everything.': 'خلفية التطبيق وراء كل شيء.',
  'Cards and rails.': 'البطاقات والصفوف.',
  'Raised cards and menus.': 'البطاقات المرتفعة والقوائم.',
  'Controls and inputs.': 'عناصر التحكّم والحقول.',
  'Primary text.': 'النص الأساسي.',
  'Secondary text.': 'النص الثانوي.',
  'Hints and tertiary text.': 'التلميحات والنص الثالثي.',
  'Borders and hairlines.': 'الحدود والخطوط الرفيعة.',
  'Brand, focus, and actions.': 'الهوية والتركيز والإجراءات.',
  'Destructive actions and errors.': 'الإجراءات المدمّرة والأخطاء.',
  'Tap a colour to change it. Changes apply to the whole app immediately.':
      'انقر لونًا لتغييره. تُطبَّق التغييرات على التطبيق بأكمله فورًا.',
  'Custom theme': 'سمة مخصّصة',

  // Settings: the Home-languages multi-select filter.
  'English': 'الإنجليزية',
  'Tamil': 'التاميلية',
  'No filter. Home shows every language.':
      'بدون تصفية. تعرض الرئيسية كل اللغات.',
  '1 language. Home filters to it.': 'لغة واحدة. تُصفّي الرئيسية إليها.',
  '{n} languages. Home filters to these.': '{n} لغات. تُصفّي الرئيسية إليها.',

  // settings_view: the Metadata/API-keys and AI-search sections.
  'Metadata & API keys': 'البيانات الوصفية ومفاتيح API',
  'Personal keys unlock richer catalogs, posters, and ratings. Each key is stored securely on this device, never in plaintext.':
      'المفاتيح الشخصية تفتح قوائم وملصقات وتقييمات أغنى. يُخزَّن كل مفتاح بأمان على هذا الجهاز، وليس كنص عادي أبدًا.',
  'TMDB · catalogs and rails': 'TMDB · البيانات الوصفية الأساسية',
  'v3 API key': 'مفتاح API الإصدار 3',
  'OMDb · Rotten Tomatoes scores': 'OMDB · تقييمات ROTTEN TOMATOES',
  '8-character key': 'مفتاح من 8 أحرف',
  'RPDB · scores baked into posters': 'RPDB · تقييمات مدمجة في الملصقات',
  'rpdb key': 'مفتاح RPDB',
  'MDBList · Letterboxd and Trakt scores':
      'MDBLIST · تقييمات LETTERBOXD وTRAKT',
  'mdblist api key': 'مفتاح MDBList API',
  'Type what you want in plain language and let a model find it. Bring your own OpenRouter or Groq API key.':
      'اكتب ما تريده بلغة عادية ودع نموذجًا يجده. أحضر مفتاح OpenRouter أو Groq الخاص بك.',
  'Provider': 'المزوّد',
  'Groq · LPU inference': 'Groq · استدلال LPU',
  'OpenRouter · natural-language search': 'OpenRouter · بحث بلغة طبيعية',
  'Groq API key (gsk-…)': 'مفتاح Groq API (gsk-…)',
  'OpenRouter key (sk-or-…)': 'مفتاح OpenRouter (sk-or-…)',
  'Model': 'النموذج',
  'Free': 'مجانية',
  'Use live web context': 'استخدام سياق الويب المباشر',
  'Before asking the model, fetch DuckDuckGo results through Jina Reader and feed the top hits into the prompt. Works without a key at low volume; add a Jina key below for higher quotas.':
      'قبل سؤال النموذج، اجلب نتائج DuckDuckGo عبر Jina Reader وأدخل أفضل النتائج في الطلب. يعمل دون مفتاح بحجم منخفض؛ أضِف مفتاح Jina أدناه لحصص أعلى.',
  'Jina API key · optional': 'مفتاح Jina API · اختياري',

  // settings_view: the Home-languages section wrapper.
  'Home languages': 'لغات الرئيسية',
  'Only show titles in these original languages on the Home catalogs. Leave all off to show everything.':
      'أظهر فقط العناوين بهذه اللغات الأصلية في قوائم الرئيسية. اترك الكل مُطفأً لعرض كل شيء.',

  // settings_view: the Streaming sources and Debrid services sections.
  'Streaming sources': 'مصادر البث',
  'How the play picker filters, sorts, and lays out the streams your add-ons return.':
      'كيف يُصفّي منتقي التشغيل مصادر البث التي تُرجعها إضافاتك ويرتّبها ويعرضها.',
  'Stream safety filter': 'فلتر أمان البث',
  'Strict': 'صارم',
  'Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs for episode requests, trailers, and likely cams.':
      'الافتراضي. يرفض الأحجام الشاذّة والامتدادات المشبوهة وعدم تطابق السنة/الحلقة وحزم المواسم لطلبات الحلقات والمقاطع الدعائية والنسخ المصوّرة المحتملة.',
  'Balanced': 'متوازن',
  'Keeps the malware, year, and episode-mismatch checks but allows season packs and oversized files.':
      'يُبقي فحوص البرمجيات الخبيثة والسنة وعدم تطابق الحلقة لكنه يسمح بحزم المواسم والملفات كبيرة الحجم.',
  'Off': 'إيقاف',
  'No filtering. Every stream every add-on returns shows up, including obvious junk.':
      'بدون تصفية. يظهر كل مصدر تُرجعه كل إضافة، بما في ذلك النفايات الواضحة.',
  'Result order': 'ترتيب النتائج',
  'Harbor ranking': 'ترتيب Harbor',
  'Puts the best-scoring sources first.': 'يضع المصادر الأعلى تقييمًا أولًا.',
  'Addon order': 'ترتيب الإضافة',
  "Follows your add-on priority and keeps each add-on's results in the order it returned them.":
      'يتبع أولوية إضافاتك ويحافظ على نتائج كل إضافة بالترتيب الذي أعادتها به.',
  'Picker layout': 'تخطيط المنتقي',
  'Condensed': 'مكثف',
  'A top pick, quality tiles, and a drawer.':
      'اختيار أفضل، ومربّعات الجودة، ودُرج.',
  'Stremio': 'Stremio',
  'A flat list grouped by add-on, no scoring.':
      'قائمة مسطّحة مجمّعة حسب الإضافة، دون تقييم.',
  'Show torrent name': 'إظهار اسم التورنت',
  "Show each source's full release filename on the condensed layout.":
      'أظهر اسم ملف الإصدار الكامل لكل مصدر في التخطيط المكثف.',
  'Debrid services': 'خدمات Debrid',
  'Cached-torrent providers for instant, high-quality streams. Keys are stored securely on this device.':
      'مزوّدو التورنت المخزّن مؤقتًا لبثّ فوري عالي الجودة. تُخزَّن المفاتيح بأمان على هذا الجهاز.',
  'Real-Debrid API token': 'رمز API لـ Real-Debrid',
  'API token': 'رمز API',
  'TorBox API key': 'مفتاح API لـ TorBox',
  'API key': 'مفتاح API',
  'AllDebrid API key': 'مفتاح API لـ AllDebrid',
  'Premiumize API key': 'مفتاح API لـ Premiumize',
  'Debrid-Link API key': 'مفتاح API لـ Debrid-Link',

  // settings_view: the Languages and Theme sections.
  'Languages': 'اللغات',
  'Which languages Harbor prefers when ranking streams and choosing an audio track.':
      'اللغات التي يفضّلها Harbor عند ترتيب مصادر البث واختيار مسار صوتي.',
  'Preferred stream languages': 'لغات البث المفضّلة',
  'Streams in these languages rank first in the picker.':
      'تتصدّر مصادر البث بهذه اللغات في المنتقي.',
  'Preferred audio languages': 'لغات الصوت المفضّلة',
  'The player auto-selects the first matching audio track when a title has more than one.':
      'يختار المشغّل تلقائيًا أول مسار صوتي مطابق عندما يكون للعنوان أكثر من مسار.',
  'Start with subtitles off': 'البدء مع إيقاف الترجمة',
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
      'يظل Harbor يبحث عن الترجمات ويحمّلها لتكون على بُعد نقرة واحدة في المشغّل، لكنه لن يفعّلها تلقائيًا.',
  'Theme': 'السمة',
  'The colour theme for the whole app.': 'سمة الألوان للتطبيق بأكمله.',
  'FEATURED': 'مميّزة',
  'Community-inspired palettes ported to Harbor.':
      'لوحات ألوان مستوحاة من المجتمع ومنقولة إلى Harbor.',
  'Custom': 'مخصص',
  'Build your own palette': 'أنشئ لوحة الألوان الخاصة بك',

  // settings_view: the Home layout section.
  'Home layout': 'تخطيط الرئيسية',
  'How the Home page assembles its rails.': 'كيف تجمّع الصفحة الرئيسية صفوفها.',
  'Harbor curated': 'اختيار Harbor',
  'Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.':
      'عرض رئيسي دوّار، وأفضل 10، والرائج، وفي دور العرض، وصفوف لكل خدمة. تُضاف كتالوجات الإضافات أسفلها، بلا تكرار.',
  'Classic Stremio': 'Stremio الكلاسيكي',
  'Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.':
      'متابعة المشاهدة، ثم إضافاتك المثبّتة. يُعرض كل كتالوج كصفّ خاص به، بترتيب التثبيت، بلا إزالة تكرار، بلا عرض رئيسي.',
  'Show every addon row': 'إظهار كل صفّ إضافة',
  "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.":
      'افتراضيًا، تُدمج صفوف الإضافات التي تكرّر الصفوف المدمجة (الرائج، الشائع، الأعلى تقييمًا، إلخ) حتى لا ترى الصف نفسه مرتين. فعّل هذا لإظهار كل صف، بما في ذلك التكرارات.',
  'Watchlist shows only saved titles':
      'تعرض قائمة المشاهدة العناوين المحفوظة فقط',
  'Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.':
      'أبقِ علامة تبويب قائمة المشاهدة في المكتبة مقتصرة على العناوين التي أضفتها في Stremio. عطّل هذا لتضمين أي شيء أضافه Stremio تلقائيًا عند الضغط على تشغيل.',
  'Show Playlists tab': 'إظهار علامة تبويب قوائم التشغيل',
  'Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.':
      'يضيف عنصر قوائم التشغيل إلى شريط التنقل لتصفّح الأفلام والمسلسلات من قوائم M3U أو Xtream (نفسها التي تضيفها للبث المباشر). معطّل افتراضيًا للحفاظ على ترتيب التنقل.',
  'Keep anime in the Anime room only': 'إبقاء الأنمي في غرفة الأنمي فقط',
  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
      'يخفي الأنمي من صف متابعة المشاهدة في الرئيسية. ويظل يظهر في متابعة المشاهدة الخاصة بعلامة تبويب الأنمي.',
  'Advance Continue Watching to the next episode':
      'تقديم متابعة المشاهدة إلى الحلقة التالية',
  'When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.':
      'عند انتهائك من حلقة، تنتقل بطاقة متابعة المشاهدة في الرئيسية إلى الحلقة التالية بدلًا من البقاء عند 0 دقيقة متبقية.',
  'Hide watched titles in catalogs': 'إخفاء العناوين المُشاهدة من القوائم',
  "Movies you've watched and shows you've made progress on stop appearing in the built-in catalog rows, using your local watch history (and Trakt if connected). Continue Watching is never touched.":
      'تتوقّف الأفلام التي شاهدتها والمسلسلات التي أحرزت تقدّمًا فيها عن الظهور في صفوف القوائم المدمجة، باستخدام سجلّ مشاهدتك المحلّي (وTrakt إن كان متصلًا). لا تُمَسّ متابعة المشاهدة أبدًا.',
  'Hide unreleased titles': 'إخفاء العناوين غير المُصدَرة',
  'Movies and shows with a future release date stop appearing in the built-in home catalog rows, so Home only shows what you can watch right now.':
      'تتوقّف الأفلام والمسلسلات ذات تاريخ الإصدار المستقبلي عن الظهور في صفوف قوائم الرئيسية المدمجة، فتعرض الرئيسية فقط ما يمكنك مشاهدته الآن.',

  // settings_view: the Spoilers and Episode-cards sections.
  'Spoilers': 'الحرق',
  'Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Focus an episode to peek.':
      'موّه صور الحلقات وعناوينها وأوصافها للحلقات التي لم تشاهدها بعد، في المسلسلات والأنمي معًا. ركّز على حلقة لإلقاء نظرة.',
  'Blur spoilers': 'تمويه الحرق',
  'Hides spoiler-prone episode details in episode lists until you have watched them.':
      'يخفي تفاصيل الحلقات المعرّضة للحرق في قوائم الحلقات حتى تشاهدها.',
  'Blur thumbnails': 'تمويه الصور المصغّرة',
  'Blur titles': 'تمويه العناوين',
  'Blur descriptions': 'تمويه الأوصاف',
  'Blur episode images on detail page': 'تمويه صور الحلقات في صفحة التفاصيل',
  'Blurs the hero image and stills on the episode detail page until you click reveal.':
      'تمويه الصورة الرئيسية وصور المشاهد في صفحة تفاصيل الحلقة حتى تنقر على الإظهار.',
  'Keep the next episode visible': 'إبقاء الحلقة التالية ظاهرة',
  'Leave the episode you are up to clear and only blur the ones after it.':
      'اترك الحلقة التي وصلت إليها واضحة وموّه فقط ما بعدها.',
  'Blur stream backdrop': 'تمويه خلفية البث',
  'Adds a blurred glass effect behind the stream picker panel.':
      'يضيف تأثير زجاج مموّه خلف لوحة منتقي البث.',
  'Episode cards': 'بطاقات الحلقات',
  'Show the IMDb rating and synopsis on episodes across the list, grid, and panel layouts.':
      'أظهر تقييم IMDb والملخّص على الحلقات عبر تخطيطات القائمة والشبكة واللوحة.',
  'Show IMDb rating on episodes': 'إظهار تقييم IMDb على الحلقات',
  "Shows each episode's rating. Add your free OMDb API key for real IMDb scores; without it, ratings fall back to TMDB.":
      'يعرض تقييم كل حلقة. أضِف مفتاح OMDb المجاني للحصول على تقييمات IMDb الحقيقية؛ بدونه تعود التقييمات إلى TMDB.',
  'Show episode description': 'إظهار وصف الحلقة',
  'Shows the episode synopsis on the cards. Turn it off to hide it.':
      'يعرض ملخّص الحلقة على البطاقات. عطّله لإخفائه.',
  'High-quality episode images': 'صور حلقات عالية الجودة',
  'Loads full-resolution episode artwork (original) instead of lighter w300 images. Turn off for slow connections or low-end devices.':
      'يحمّل صور الحلقات بدقّة كاملة (الأصلية) بدلًا من صور w300 الأخف. عطّله للاتصالات البطيئة أو الأجهزة الضعيفة.',
  'Group episodes by story arc': 'تجميع الحلقات حسب القوس القصصي',
  'Adds a Seasons/Arcs switch on shows that have a story-arc grouping (like One Piece), so you can browse by saga instead of scrolling seasons. Needs a TMDB key. Off by default.':
      'يضيف مبدّل المواسم/الأقواس على المسلسلات ذات التجميع القصصي (مثل ون بيس)، لتتصفّح حسب الملحمة بدلًا من تمرير المواسم. يحتاج مفتاح TMDB. معطّل افتراضيًا.',

  // settings_view: the Skip intros & credits section.
  'Skip intros & credits': 'تخطي المقدمات والنهايات',
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
      'يجد Harbor توقيتات المقدمات وأسماء الطاقم من AniSkip و TheIntroDB وفصول الملف نفسه، ثم يظهر زر التخطي في اللحظة المناسبة.',
  'Show the Skip button': 'إظهار زر التخطي',
  'Show a Skip Intro / Skip Credits button when Harbor detects one. Turn this off to never show it. You can also dismiss a wrong one for the rest of the episode.':
      'أظهر زر تخطي المقدمة / تخطي النهاية عندما يكتشف Harbor واحدة. عطّل هذا لعدم إظهاره أبدًا. يمكنك أيضًا إخفاء زر خاطئ لبقية الحلقة.',
  'Auto-skip intros': 'تخطي المقدمات تلقائياً',
  'Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.':
      'تخطي الافتتاحيات تلقائياً بمجرد بدايتها. سيظل زر التخطي يظهر في كل الأحوال، والرجوع للخلف إلى المقدمة سيعيد تشغيلها دون التخطي مجدداً.',
  'Auto-skip recaps': 'تخطي الملخّصات تلقائيًا',
  'Automatically jump past recap segments.': 'تخطي مقاطع الملخّص تلقائيًا.',
  'Auto-skip credit outros': 'تخطي نهايات الطاقم تلقائيًا',
  'Automatically skip ending credits and trigger the next episode countdown immediately.':
      'تخطى أسماء طاقم النهاية تلقائيًا وابدأ العد التنازلي للحلقة التالية فورًا.',
  'Auto-hide the Skip button after': 'إخفاء زر التخطي تلقائيًا بعد',
  "Hides the button on its own after a few seconds so a wrong one doesn't sit there the whole episode.":
      'يخفي الزر تلقائيًا بعد بضع ثوانٍ حتى لا يبقى زر خاطئ طوال الحلقة.',
  '5s': '5 ثوانٍ',
  '10s': '10 ثوانٍ',
  '15s': '15 ثانية',
  '30s': '30 ثانية',

  // settings_view: the Playback section.
  'Playback': 'التشغيل',
  'How the player resumes titles and shows on-screen feedback.':
      'كيف يستأنف المشغّل العناوين ويعرض التنبيهات على الشاشة.',
  'Resume where you left off': 'الاستئناف من حيث توقفت',
  'Pick up partly-watched episodes and movies at your saved spot. Anything watched past 80% always restarts. Turn this off to always start from the beginning, handy if you rewatch shows.':
      'تابع الحلقات والأفلام التي شاهدت جزءًا منها من نقطة الحفظ. يُعاد تشغيل أي شيء تجاوزت مشاهدته 80% من البداية دائمًا. عطّل هذا للبدء دائمًا من البداية، مفيد إن كنت تعيد المشاهدة.',
  'Ask to resume or start over': 'السؤال عن الاستئناف أو البدء من جديد',
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
      "عند النقر على 'تشغيل' لشيء شاهدت جزءاً منه، اعرض مطالبة لاستئناف المشاهدة من حيث توقفت أو البدء من جديد. يشمل ذلك أيضاً العناصر المتزامنة من Stremio أو Trakt.",
  'Auto-play next episode': 'التشغيل التلقائي للحلقة التالية',
  'When an episode ends, automatically start the next one. Off lets the episode finish and stop.':
      "عندما تنتهي الحلقة، ابدأ الحلقة التالية تلقائياً. 'إيقاف' يتيح للحلقة أن تنتهي ثم يتوقف التشغيل.",
  'Next episode prompt': 'تنبيه الحلقة القادمة',
  'When the Up Next card appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.':
      "متى تظهر بطاقة 'التالي' قبل انتهاء الحلقة. يتكيّف 'تلقائي' مع طول الحلقة، فتتوقّف الحلقات القصيرة عن التنبيه مبكرًا. 'إيقاف' يخفيها.",
  'Show controls when pausing': 'إظهار عناصر التحكّم عند الإيقاف المؤقت',
  "Show the player controls when you pause or resume with the remote or a key. Turn off to keep them hidden so they don't cover subtitles.":
      'أظهر عناصر تحكّم المشغّل عند الإيقاف المؤقت أو الاستئناف بجهاز التحكّم أو مفتاح. عطّله لإبقائها مخفية حتى لا تغطّي الترجمة.',
  'Volume pop-up while watching': 'نافذة الصوت المنبثقة أثناء المشاهدة',
  'Show a quick volume overlay when you change the volume with the player controls hidden, so the change is always visible.':
      'أظهر طبقة صوت سريعة عند تغيير مستوى الصوت مع إخفاء عناصر التحكّم، ليكون التغيير مرئيًا دائمًا.',
  'Pop-up position': 'موضع النافذة المنبثقة',
  'Where the volume overlay appears on the video.':
      'أين تظهر طبقة الصوت على الفيديو.',
  'Auto': 'تلقائي',
  '45s': '45 ثانية',
  '1 min': '1 دقيقة',
  '1.5 min': '1.5 دقيقة',
  '2 min': '2 دقيقة',
  'Center': 'وسط',
  'Top': 'الأعلى',
  'Top left': 'أعلى اليسار',
  'Top right': 'أعلى اليمين',

  // settings_view: the Picture-quality, Smooth-motion and Hardware-accel sections.
  'Picture quality': 'جودة الصورة',
  'One choice that sets how hard your device works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.':
      'خيار واحد يحدّد مدى الجهد الذي يبذله جهازك لجعل الفيديو يبدو بأفضل حال. اختر ما يناسب جهازك. يسري على الشيء التالي الذي تشغّله.',
  'Smooth on weak PCs': 'سلس على الأجهزة الضعيفة',
  'Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.':
      'يوقف التكبير والتأثيرات المتقدمة حتى يعمل الفيديو ببساطة. وهو الخيار الأخف على جهازك. اختر هذا إذا تقطع الفيديو أو إذا صدر صوت مرتفع من المروحة.',
  'Good-looking video without working your machine hard. Leave it here unless you have a reason to change.':
      'فيديو بمظهر جيد دون إرهاق جهازك. اتركه هنا إلا إذا كان لديك سبب لتغييره.',
  'Maximum quality': 'أعلى جودة',
  'Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.':
      'ترقية دقة أكثر حدة وتدرجات أكثر نعومة في المشاهد المظلمة، على حساب زيادة الحمل على كرت الشاشة. تجنبه على الحواسيب المحمولة وكروت الشاشة المدمجة.',
  'Smooth motion': 'حركة سلسة',
  'Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.':
      'يُرسم الأنمي على إطارين أو ثلاثة، لذا قد تتقطع اللقطات السريعة. التنعيم يملأ الفراغات لتنساب الحركة بسلاسة.',
  'Motion smoothing': 'تنعيم الحركة',
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
      'استيفاء الإطارات المدمج في Harbor. ينعم اللقطات، وهو الأفضل للأنمي. يحتاج إلى معدل تحديث شاشة أعلى من معدل إطارات الفيديو، وقد يتقطع على كروت الشاشة الضعيفة. أخف من SVP.',
  'Hardware acceleration': 'تسريع الأجهزة (Hardware acceleration)',
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
      'دع كرت الشاشة يقوم بالعمل الشاق لفك تشفير الفيديو. هذا يوفر البطارية ويحافظ على برودة المعالج. تلقائي هو المناسب للجميع تقريباً؛ قم بالتغيير فقط إذا كان التشغيل يبدو خاطئاً أو لم يبدأ.',
  'Decoder': 'فاكّ التشفير',
  'The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.':
      'يقوم المعالج بفك التشفير بالكامل. هذا الخيار الأكثر توافقاً، لكنه يرفع الحرارة وقد يتقطع في دقة 4K. استخدمه فقط إذا واجهت مشاكل في الصورة مع تشغيل تسريع الأجهزة.',
  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.":
      'يفرض تشغيل كرت الشاشة. وهو الخيار الأكثر سلاسة وبرودة، لكن بعض الملفات القديمة أو غير المعتادة قد ترفض التشغيل. عد إلى تلقائي إذا لم يبدأ شيء ما.',
  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.":
      'يستخدم Harbor كرت الشاشة عندما يكون آمناً ويعود لاستخدام المعالج عندما لا يكون كذلك. الخيار الأنسب للجميع تقريباً.',
  'Force on': 'فرض التشغيل',
  'Off (use CPU)': 'إيقاف (استخدام المعالج)',

  // settings_view: the Aspect, Color&HDR, Connection and Downmix sections.
  'Aspect ratio': 'نسبة العرض إلى الارتفاع',
  'Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.':
      "شكل الصورة الافتراضي في محرك mpv. 'ملاءمة' تحافظ على المصدر كما هو مع أي أشرطة سوداء؛ أما البقية فتقوم بالتمدد أو القص لملء الشاشة، وهو خيار مفيد للعروض القديمة بنسبة 4:3 على أجهزة التلفاز العريضة.",
  'Picture shape': 'شكل الصورة',
  'Fit': 'ملاءمة',
  'Fill': 'تعبئة',
  'Stretch': 'تمديد',
  'Zoom': 'تكبير',
  'Color & HDR': 'اللون و HDR',
  'How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.':
      'كيف يضغط Harbor أفلام HDR لتناسب الشاشات العادية. تلقائي هو المناسب للجميع تقريباً؛ المنحنيات أدناه تغير المظهر فقط (حيوي مقابل ناعم). هذا يهم فقط في مصادر HDR.',
  'Tone-mapping curve': 'منحنى تعيين النغمات (Tone-mapping)',
  'Auto (recommended)': 'تلقائي (موصى به)',
  'Reference (bt.2390)': 'مرجعي (bt.2390)',
  'Filmic (Hable)': 'سينمائي (Hable)',
  'Balanced (Mobius)': 'متوازن (Mobius)',
  'Soft (Reinhard)': 'ناعم (Reinhard)',
  'Modern (Spline)': 'حديث (Spline)',
  'Boost SDR video toward HDR': 'تعزيز فيديو SDR نحو HDR',
  'On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.':
      'على شاشة HDR، يقوم بتوسيع الأفلام العادية (غير HDR) لاستخدام نطاق السطوع الإضافي. اتركه مغلقاً على الشاشات العادية؛ وإلا قد تبدو الألوان باهتة.',
  'Connection': 'الاتصال',
  'Slow or unstable connection': 'اتصال بطيء أو غير مستقر',
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
      'إذا استمر الفيديو في التوقف المؤقت للتحميل، أو كنت تستخدم شبكة Wi-Fi غير مستقرة أو خادماً بعيداً، فهذا يمنح Harbor بداية أكبر حتى يتجاوز التشغيل الفترات الصعبة.',
  'Build a bigger buffer': 'بناء تخزين مؤقت أكبر',
  'Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.':
      'يقوم بتحميل جزء أكبر من الفيديو مقدماً قبل التشغيل. أكثر سلاسة في الاتصالات الضعيفة، ويستهلك ذاكرة أكثر قليلاً ويستغرق وقتاً أطول للبدء.',
  'Audio downmix': 'دمج الصوت',
  'For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.':
      'لمكبرات صوت الحواسيب المحمولة وسماعات الرأس. الأفلام الممزوجة بصوت محيطي 5.1 أو 7.1 قد تبدو فارغة أو يكون فيها الحوار منخفضاً على مكبري صوت. هذا يدمجهم معاً بشكل صحيح.',
  'Mix surround sound down to stereo': 'دمج الصوت المحيطي إلى ستيريو (Stereo)',
  'Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.':
      'قم بتشغيله إذا كنت تشاهد على حاسوب محمول أو سماعات رأس وكان الحوار يبدو منخفضاً جداً مقارنة بالمؤثرات. اتركه مغلقاً إذا كان لديك إعداد صوت محيطي حقيقي أو مكبر صوت (soundbar).',

  // settings_view: the Title-text, Poster-card and Subtitle-style sections.
  'Title text': 'نص العنوان',
  'Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.':
      'غيّر حجم عناوين الصفوف في الرئيسية والعنوان المعروض في المشغّل، دون تغيير حجم بقية الواجهة. ويمكنك أيضًا بدء عنوان المشغّل باسم المسلسل بدلًا من الحلقة.',
  'Row titles': 'عناوين الصفوف',
  'Player title': 'عنوان المشغّل',
  'Show series name first in the player': 'إظهار اسم المسلسل أولًا في المشغّل',
  'Lead with the show name instead of the episode title at the top of the player.':
      'ابدأ باسم العمل بدلًا من عنوان الحلقة في أعلى المشغّل.',
  'Poster card style': 'نمط بطاقة الملصق',
  'Tune the size and corner radius of every poster across Home, Discover, and your library.':
      'اضبط حجم كل ملصق ونصف قطر زواياه عبر الرئيسية والاكتشاف ومكتبتك.',
  'Width': 'العرض',
  'Corner radius': 'نصف قطر الزاوية',
  'Load effect': 'تأثير التحميل',
  'How posters appear as they load. Blur up looks smoothest; Fade is lighter on older or low-power devices; Instant turns it off.':
      "كيف تظهر الملصقات أثناء تحميلها. 'تمويه متصاعد' يبدو الأكثر سلاسة؛ 'تلاشٍ' أخف على الأجهزة القديمة أو منخفضة الطاقة؛ 'فوري' يوقفه.",
  'Blur up': 'تمويه متصاعد',
  'Fade': 'تلاشٍ',
  'Instant': 'فوري',
  'Subtitle style': 'نمط الترجمة',
  'How subtitles look during playback — background style, size, colour, position, and readability.':
      'كيف تبدو الترجمة أثناء التشغيل — نمط الخلفية والحجم واللون والموضع ووضوح القراءة.',
  'Background style': 'نمط الخلفية',
  'Drop shadow': 'ظل الإسقاط',
  'Outline': 'إطار',
  'Black bar': 'شريط أسود',
  'Size': 'الحجم',
  'Opacity': 'الشفافية',
  'Distance from bottom': 'المسافة من الأسفل',
  'Outline thickness': 'سُمك الإطار',
  'Background opacity': 'شفافية الخلفية',
  'Text colour': 'لون النص',
  'Outline colour': 'لون الإطار',
  'Background colour': 'لون الخلفية',
  'Bold text': 'نص عريض',
  'Alignment': 'المحاذاة',
  'Left': 'يسار',
  'Right': 'يمين',
  // Arabic home-feed row titles (shown on the Arabic UI).
  'Ramadan 2026 Series': 'مسلسلات رمضان 2026',
  'Arabic Drama': 'دراما عربية',
  'Arabic Movies': 'أفلام عربية',
  'Egyptian Cinema Classics': 'كلاسيكيات السينما المصرية',
  'Gulf / Khaleeji': 'خليجي',
  'Arabic Comedy': 'كوميديا عربية',
  'Trending in Arabic': 'الرائج بالعربية',
};
