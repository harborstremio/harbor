const settings: Record<string, string> = {
  "Home hero": "واجهة العنوان المميّز",
  "Make the featured banner on Home bigger and sharper.": "اجعل لافتة العنوان المميّز في الصفحة الرئيسية أكبر وأوضح.",
  "Full hero banner": "لافتة بطل كاملة",
  "Stretch the featured hero edge to edge and taller, across every layout.":
    "تمدّد لافتة البطل من الحافة إلى الحافة وبارتفاع أكبر، في جميع التخطيطات.",
  "Full quality hero image": "صورة البطل بأعلى جودة",
  "Load the highest-resolution artwork for the featured hero. Uses more bandwidth.":
    "تحميل صورة البطل المميّز بأعلى دقة. يستهلك بيانات أكثر.",
  "Display language": "لغة العرض",
  "Interface language": "لغة الواجهة",
  "Metadata language": "لغة البيانات الوصفية",
  Language: "اللغة",
  Region: "المنطقة",
  "Region & language": "المنطقة واللغة",
  "English (default)": "الإنجليزية (افتراضي)",
  "Apply {language}": "تطبيق {language}",
  "Switch Harbor to {language}?": "تبديل Harbor إلى {language}؟",
  "Just change region": "تغيير المنطقة فقط",
  "Translate titles": "ترجمة العناوين",
  "If disabled, titles remain in their original language.":
    "إذا تم تعطيله، ستبقى العناوين بلغتها الأصلية، قد تحتاج لإعادة تشغيل التطبيق.",
  "Translate descriptions": "ترجمة الوصف",
  "If disabled, overviews and taglines remain in their original language. (Applies only inside the details page)":
    "إذا تم تعطيله، سيبقى الوصف والشعارات بلغتها الأصلية (يُطبّق هذا الخيار داخل صفحة التفاصيل فقط).",
  "Translate posters": "ترجمة الغلاف",
  "If disabled, posters remain in their original language. (Applies only inside the details page)":
    "إذا تم تعطيله، ستبقى الأغلفة والملصقات بلغتها الأصلية (يُطبّق هذا الخيار داخل صفحة التفاصيل فقط).",
  "Poster translation is disabled because a custom poster service is active.":
    "ترجمة الملصقات غير متاحة لأن خدمة الملصقات المخصصة مُفعلة.",
  "Metadata providers": "مزوّدو البيانات الوصفية",
  "Content filters": "مرشّحات المحتوى",

  "Sets the language of Harbor's own interface: menus, buttons, and labels. Arabic switches the layout to right to left. This is separate from subtitle and metadata languages below.":
    "يحدّد لغة واجهة Harbor نفسها: القوائم والأزرار والتسميات. تبدّل العربية التخطيط من اليمين إلى اليسار. وهذا منفصل عن لغتي الترجمة والبيانات الوصفية أدناه.",
  "Switch the menus and buttons to your language. Arabic flips the layout to right to left.":
    "بدّل القوائم والأزرار إلى لغتك. تقلب العربية التخطيط من اليمين إلى اليسار.",
  "This sets the interface, metadata, subtitle, and audio languages to match.":
    "يضبط هذا لغات الواجهة والبيانات الوصفية والترجمة والصوت لتتطابق.",
  "Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.":
    "تُعرض العناوين والملخصات والشعارات من TMDB بهذه اللغة عند توفّر ترجمة. يتطلب مفتاح TMDB.",
  "Used for streaming availability and the Now Playing release window. Pick a country and Harbor can match the interface, metadata, and subtitle languages to it.":
    'يُستخدم لتوفّر البث ونافذة إصدار "يُعرض الآن". اختر دولة ليتمكّن Harbor من مطابقة لغات الواجهة والبيانات الوصفية والترجمة معها.',

  "A free TMDB key is highly recommended. It unlocks the full Harbor experience. The rest are optional, and Cinemeta works out of the box without any.":
    "يُنصح بشدة بمفتاح TMDB المجاني. فهو يفتح تجربة Harbor الكاملة. والبقية اختيارية، وتعمل Cinemeta مباشرةً بدون أي مفتاح.",
  "TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.":
    "تطلب TMDB رابط تطبيق عند إنشاء المفتاح. ضع أي رابط على الإطلاق، مثل https://harbor.app. كل ما تحتاجه في المقابل هو مفتاح الـ API.",

  "RPDB already paints scores onto the poster. Toggle to override.":
    "يرسم RPDB التقييمات على الملصق بالفعل. بدّل للتجاوز.",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays optional.":
    "تقييمات MyAnimeList لعناوين الأنمي. لا يغطّي RPDB الأنمي، لذا يبقى هذا اختياريًا.",

  "v3 API key": "مفتاح API الإصدار 3",
  "8-character key": "مفتاح من 8 أحرف",
  "personal key": "مفتاح شخصي",
  "subscriber API key": "مفتاح API للمشتركين",
  "mdblist api key": "مفتاح MDBList API",
  "rpdb key": "مفتاح RPDB",
  "https://posters.example.com or a pattern with {id}": "https://posters.example.com أو نمط يحتوي على {id}",
  "The yellow chip in the poster corner.": "الشارة الصفراء في زاوية الملصق.",

  "Hide adult content": "إخفاء المحتوى للبالغين",
  "Filters out streams from adult catalogs and addons. On by default.":
    "يستبعد البثوث من كتالوجات وإضافات البالغين. مفعّل افتراضيًا.",
  "Hide anime": "إخفاء الأنمي",
  "Removes the Anime tab and any Trending/Popular/Upcoming/New anime rows from Home.":
    "يزيل علامة تبويب الأنمي وأي صفوف أنمي رائجة/شائعة/قادمة/جديدة من الرئيسية.",
  "Hide Live TV": "إخفاء البث المباشر",
  "Removes the Live TV tab from the sidebar.": "يزيل علامة تبويب البث المباشر من الشريط الجانبي.",
  "Hide entire categories. Toggling these also removes the matching sidebar entries and rails.":
    "إخفاء فئات بأكملها. يؤدي تبديل هذه أيضًا إلى إزالة مدخلات الشريط الجانبي والصفوف المطابقة.",
  "Show Playlists tab": "إظهار علامة تبويب قوائم التشغيل",
  "Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.":
    "يضيف عنصر قوائم التشغيل إلى شريط التنقل لتصفّح الأفلام والمسلسلات من قوائم M3U أو Xtream (نفسها التي تضيفها للبث المباشر). معطّل افتراضيًا للحفاظ على ترتيب التنقل.",

  "Show IMDb score on cards": "إظهار تقييم IMDb على البطاقات",

  "Use mpv engine": "استخدام محرك mpv",
  "Show sources hidden by the trust filter": "إظهار المصادر المخفية بواسطة مرشّح الثقة",

  "Blur spoilers": "تمويه الحرق",
  "Blur thumbnails": "تمويه الصور المصغّرة",
  "Blur titles": "تمويه العناوين",
  "Blur descriptions": "تمويه الأوصاف",
  Spoilers: "الحرق",
  "Hides spoiler-prone episode details in episode lists until you have watched them.":
    "يخفي تفاصيل الحلقات المعرّضة للحرق في قوائم الحلقات حتى تشاهدها.",
  "Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.":
    "تمويه صور الحلقات وعناوينها وأوصافها للحلقات التي لم تشاهدها بعد، في المسلسلات والأنمي معًا. مرّر فوق حلقة لإلقاء نظرة.",
  "Leave the episode you are up to clear and only blur the ones after it.":
    "اترك الحلقة التي وصلت إليها واضحة وموّه فقط ما بعدها.",
  "Keep the next episode visible": "إبقاء الحلقة التالية ظاهرة",
  "Blur episode images on detail page": "تمويه صور الحلقات في صفحة التفاصيل",
  "Blurs the hero image and stills on the episode detail page until you click reveal.":
    "تمويه الصورة الرئيسية وصور المشاهد في صفحة تفاصيل الحلقة حتى تنقر على الإظهار.",

  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
    "يخفي الأنمي من صف متابعة المشاهدة في الرئيسية. ويظل يظهر في متابعة المشاهدة الخاصة بعلامة تبويب الأنمي.",
  "Keep anime in the Anime room only": "إبقاء الأنمي في غرفة الأنمي فقط",

  "Start with subtitles off": "البدء مع إيقاف الترجمة",
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
    "يظل Harbor يبحث عن الترجمات ويحمّلها لتكون على بُعد نقرة واحدة في المشغّل، لكنه لن يفعّلها تلقائيًا.",
  "Prefer embedded subtitles": "تفضيل الترجمات المدمجة",
  "When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.":
    "عندما يأتي الملف بمسار ترجمة خاص به، أبقِه محدّدًا بدلًا من التبديل إلى ترجمة مُنزّلة. المسارات المدمجة عادةً أفضل من حيث التزامن.",
  "Forced subs with native audio": "ترجمة إجبارية مع الصوت الأصلي",
  "When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.":
    "عندما يطابق الصوت لغة ترجمتك بالفعل، اختر مسارًا إجباريًا (الحوار الأجنبي واللافتات فقط) بدلًا من الترجمة الكاملة. وإن لم يكن للملف مسار إجباري، تبقى الترجمة معطّلة.",

  "Preferred languages": "اللغات المفضّلة",
  "Only show streams in my languages": "إظهار البثوث بلغاتي فقط",
  "Show {langs} only": "إظهار {langs} فقط",
  "{langs} only · {n} hidden": "{langs} فقط · {n} مخفي",
  "Hides streams with no detected preferred language. Multi-audio releases count as a match.":
    "يخفي البثوث التي لا توجد بها لغة مفضّلة مكتشفة. وتُحتسب الإصدارات متعددة الصوت كمطابقة.",
  "Streams in these languages rank first. Toggle below to drop everything else.":
    "تأتي البثوث بهذه اللغات أولًا. بدّل أدناه لإسقاط كل ما عداها.",
  "When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.":
    "عند بدء التشغيل، يجد Harbor تلقائيًا ترجمة بإحدى هذه اللغات ويحمّلها، فلا تضطر للبحث يدويًا أبدًا. تفوز أول مطابقة متاحة، لذا ضع لغتك الأساسية أولًا.",

  "Never auto-select tracks containing": "عدم اختيار المسارات تلقائيًا التي تحتوي على",
  "commentary, descriptive": "تعليق صوتي، وصفي",
  "Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.":
    "كلمات مفصولة بفواصل. تُتخطّى مسارات الصوت أو الترجمة التي يطابق اسمها أيًا منها أثناء الاختيار التلقائي. وما زال بإمكانك اختيارها يدويًا في المشغّل.",
  "When a release ships multiple audio tracks, Harbor selects the first match from this list.":
    "عندما يأتي إصدار بمسارات صوت متعددة، يختار Harbor أول مطابقة من هذه القائمة.",

  "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.":
    "افتراضيًا، تُدمج صفوف الإضافات التي تكرّر الصفوف المدمجة (الرائج، الشائع، الأعلى تقييمًا، إلخ) حتى لا ترى الصف نفسه مرتين. فعّل هذا لإظهار كل صف، بما في ذلك التكرارات.",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left. Tune how long they stick around, or wipe them all.":
    "عند خروجك من عنوان، يحفظ Harbor لقطة لتبدو بطاقة متابعة المشاهدة مثل المكان الذي تركته. اضبط مدة بقائها، أو امسحها جميعًا.",
  "When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.":
    "عند انتهائك من حلقة، تنتقل بطاقة متابعة المشاهدة في الرئيسية إلى الحلقة التالية بدلًا من البقاء عند 0 دقيقة متبقية.",
  "Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.":
    "أبقِ علامة تبويب قائمة المشاهدة في المكتبة مقتصرة على العناوين التي أضفتها في Stremio. عطّل هذا لتضمين أي شيء أضافه Stremio تلقائيًا عند الضغط على تشغيل.",

  "Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.":
    "تنبيه: بُني Harbor بالإنجليزية. دعم تعدد اللغات جزئي، لذا تلتقط إضافاتك عادةً ما تفوّته مرشّحات Harbor نفسها. إن كنت تتحدث لغة أخرى وتريد المساعدة في سدّ الثغرات، فالمصدر مفتوح.",
  "Contribute on GitHub": "ساهم على GitHub",
  Settings: "الإعدادات",
  "Stremio account": "حساب Stremio",
  Custom: "مخصص",
  "Search settings": "ابحث في الإعدادات",
  Account: "الحساب",
  "Your Stremio sign-in. Library, watch progress, and addons sync from here.":
    "تسجيل دخول Stremio. المكتبة وتقدم المشاهدة والإضافات تُزامَن من هنا.",
  "Library & metadata": "المكتبة والبيانات",
  "Optional keys that unlock TMDB rails, baked-in poster ratings, fanart, and TVDB episode data.":
    "مفاتيح اختيارية تفتح محتوى TMDB وتقييمات الملصقات وبيانات Fanart وـ TVDB.",
  "Connect your Trakt account to scrobble playback, sync your watchlist, and pull personalized recommendations.":
    "اربط حسابك على Trakt لتسجيل المشاهدات ومزامنة قائمة المتابعة الخاصة بك.",
  AniList: "أني ليست (AniList)",
  "Connect your AniList account to show your anime lists as rails on the Anime page.":
    "اربط حسابك على AniList لعرض قوائم الأنمي كشرائط في صفحة الأنمي.",
  Simkl: "سيمكل (Simkl)",
  "Connect your Simkl account to mark what you finish as watched and sync your plan-to-watch list across apps.":
    "اربط حسابك على Simkl لتحديد ما شاهدته ومزامنة قوائم المشاهدة الخاصة بك.",
  "Harbor Relay": "Harbor Relay",
  "A Cloudflare Worker on your own account that hosts your Watch Together rooms.":
    "عامل Cloudflare على حسابك الخاص يستضيف غرف المشاهدة المشتركة.",
  "Streaming sources": "مصادر البث",
  "How Harbor finds and resolves playable streams. Debrid keys and addon installs live here.":
    "كيف يجد Harbor مصادر البث ويحلّها. مفاتيح Debrid وتثبيت الإضافات هنا.",
  Languages: "اللغات",
  "Which audio and subtitle languages rank first in stream lists.": "لغات الصوت والترجمة التي تأتي أولاً في قوائم البث.",
  Hotkeys: "الاختصارات",
  "Every shortcut Harbor responds to. Click a binding to rebind it.":
    "جميع الاختصارات التي يستجيب لها Harbor. انقر على اختصار لإعادة تعيينه.",
  "Theme & appearance": "السمة والمظهر",
  "Color presets, custom backgrounds, and the font pair Harbor renders in.":
    "إعدادات الألوان والخلفيات المخصصة ونوع الخط الذي يستخدمه Harbor.",
  Webhooks: "ويب هوك",
  "Push upcoming releases to Discord or Telegram. Pick which calendars feed the notifications.":
    "إرسال الإصدارات القادمة إلى Discord أو Telegram. اختر التقاويم التي تغذي الإشعارات.",
  "Report a bug": "الإبلاغ عن خطأ",
  "Send a bug report straight to the Harbor team. Screenshots and screen recordings welcome.":
    "أرسل تقرير خطأ مباشرة إلى فريق Harbor. نرحب بلقطات الشاشة وتسجيلات الشاشة.",
  "Highly recommended. This is what gives you the full Harbor experience: Popular, Trending, In Theaters, and per-service rails. Free at ":
    "موصى به بشدة. هذا ما يمنحك تجربة Harbor الكاملة: الرائج، الترند، في دور السينما، وصفوف لكل خدمة. مجانًا على ",
  ". Use the v3 key, not the read access token.": ". استخدم مفتاح v3، وليس رمز الوصول للقراءة.",
  "Free at ": "مجانًا على ",
  ". They email an activation link the first time. Click it, then come back and save.":
    ". سيرسلون رابط تفعيل عبر البريد الإلكتروني في المرة الأولى. انقر عليه، ثم ارجع إلى هنا واحفظ.",
  "Paid plan at ": "خطة مدفوعة على ",
  ". Once saved, every poster gets re-rendered with IMDb, Rotten Tomatoes, and Metacritic stamped on it.":
    ". بمجرد الحفظ، تتم إعادة تصيير كل ملصق مع إضافة أختام تقييمات IMDb، وRotten Tomatoes، وMetacritic عليه.",
  "Free key at ": "مفتاح مجاني على ",
  ". Adds Letterboxd and Trakt community ratings to detail pages, covering what OMDb misses.":
    ". يضيف تقييمات مجتمع Letterboxd و Trakt إلى صفحات التفاصيل، لتغطية ما ينقص OMDb.",
  "Two formats work: a bare RPDB-compatible server URL (your RPDB key above is still sent), or a full URL pattern from services like BetterPosters containing ":
    "يعمل تنسيقان: عنوان خادم متوافق مع RPDB فقط (لا يزال مفتاح RPDB أعلاه يُرسل)، أو نمط عنوان URL كامل من خدمات مثل BetterPosters يحتوي على ",
  ". Patterns may also use ": ". يمكن للأنماط أيضًا استخدام ",
  ", ": "، ",
  ", and ": "، و ",
  ". Leave empty for the default.": ". اتركه فارغًا للوضع الافتراضي.",
  "Fills in where TMDB comes up empty (anime, older catalog). Free at ":
    "يملأ الفراغات عندما لا توفر TMDB نتائج (الأنمي، الكتالوجات القديمة). مجانًا على ",
  '. Use the "personal" key, not the project one.': '. استخدم المفتاح "الشخصي" (personal)، وليس مفتاح المشروع.',
  "Show Rotten Tomatoes score on cards": "إظهار تقييم Rotten Tomatoes على البطاقات",
  "Fresh tomatoes for 60% and up, splat for anything under.": "طماطم طازجة لنسبة 60% فأكثر، ولطخة لما دونها.",
  "Show MAL score on cards": "إظهار تقييم MAL على البطاقات",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays an opt-in.":
    "تقييمات MyAnimeList لعناوين الأنمي. لا يغطّي RPDB الأنمي، لذا يبقى هذا اختياريًا.",
  "Hover a poster to peek at its rating, runtime, and synopsis without opening it.":
    "أبقِ المؤشر على الملصق لإلقاء نظرة على التقييم والمدة والقصة دون فتحه.",
  "Badge position": "موضع الشارة",
  "TMDB · catalogs and rails": "TMDB · البيانات الوصفية الأساسية",
  "OMDb · Rotten Tomatoes scores": "OMDB · تقييمات ROTTEN TOMATOES",
  "RPDB · scores baked into posters": "RPDB · تقييمات مدمجة في الملصقات",
  "MDBList · Letterboxd and Trakt scores": "MDBLIST · تقييمات LETTERBOXD وTRAKT",
  "Custom poster service": "خدمة ملصقات مخصّصة",
  "Cleaner grid for when your poster service already prints the title onto the artwork.":
    "شبكة أنظف عندما تطبع خدمة الملصقات لديك العنوان على الصورة بالفعل.",
  "Fanart.tv · logos and backdrops": "FANART.TV · الشعارات والخلفيات",
  "TheTVDB · episode data": "THETVDB · بيانات الحلقات",
  Advanced: "متقدم",
  "1 frame stored. Wiping rebuilds them next time you watch.":
    "تم حفظ لقطة واحدة. مسحها سيجعلها تُبنى مجدداً في المرة القادمة التي تشاهد فيها.",
  "{count} frames stored. Wiping rebuilds them next time you watch.":
    "تم حفظ {count} لقطات. مسحها سيجعلها تُبنى مجدداً في المرة القادمة التي تشاهد فيها.",
  "Diagnostics, manual overrides, things most users never need.":
    "تشخيصات وتجاوزات يدوية وأشياء لا يحتاجها معظم المستخدمين.",
  "Watch Together rooms are routed through Harbor's hosted relay.":
    "يتم توجيه غرف المشاهدة المشتركة عبر الخادم المستضاف لـ Harbor.",
  Streaming: "البث",
  Playback: "التشغيل",
  Appearance: "المظهر",
  Notifications: "الإشعارات",
  Help: "المساعدة",
  العربية: "العربية",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left.":
    "عند الخروج من عنوان، يحفظ Harbor لقطة ليبدو الكارت مثل المكان الذي توقفت فيه.",
  "Used for streaming availability and the Now Playing release window.": "تُستخدم لتوفر البث ونافذة الإصدار.",
  "MyAnimeList scores for anime titles.": "تقييمات MyAnimeList لعناوين الأنمي.",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails.":
    "عرض دوّار، Top 10، الأكثر رواجاً، في دور السينما، صفوف لكل خدمة.",
  Updates: "التحديثات",
  "Harbor checks harbor.site for new versions and installs them in place.":
    "يتحقق Harbor من harbor.site من إصدارات جديدة ويثبّتها في مكانها.",
  "Backup & restore": "النسخ الاحتياطي والاستعادة",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup.":
    "صدّر إعداداتك الكاملة لملف واحد، ثم استعدها على جهاز جديد.",
  Privacy: "الخصوصية",
  "System tray": "شريط النظام",
  "Stremio install links": "روابط تثبيت Stremio",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app.":
    "Harbor يلتقط روابط stremio:// ليبقي تدفق التثبيت داخل التطبيق.",
  "Discord Rich Presence": "Discord Rich Presence",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar.":
    "اسمح لأصدقائك على Discord برؤية ما تشاهد، مع ملصق العرض وشريط تقدم حي.",
  "API budget": "ميزانية API",
  "Daily call counter for OMDb rating lookups. Reset if it stops returning fresh scores.":
    "عداد الطلبات اليومي لجلب تقييمات OMDb. أعده إذا توقف عن إرجاع نتائج جديدة.",
  Onboarding: "الإعداد الأولي",
  "Replay the walkthrough or unhide every dismissed tip in the app.":
    "أعِد تشغيل الجولة التعريفية أو أظهر كل تلميح رفضته.",
  "Stremio library repair": "إصلاح مكتبة Stremio",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema.":
    "يفحص مكتبة Stremio ويُعيد كتابة أي عنصر لا يطابق مخطط Stremio الدقيق.",
  About: "حول",
  "Build identity. Useful when filing a bug report at bugs@harbor.site.":
    "معلومات البناء. مفيدة عند تقديم تقرير خطأ على bugs@harbor.site.",
  "Reveal the show or movie artwork.": "إظهار صورة العرض أو الفيلم.",
  Legal: "إشعار قانوني",
  "Made with": "صُنع بـ",
  "by the Harbor team": "بواسطة فريق Harbor",
  "Know more": "اعرف المزيد",
  "A special thank you to the team at Stremio-Addons. Please consider supporting them.":
    "شكر خاص لفريق Stremio-Addons. يرجى التفكير في دعمهم.",
  "Debrid services": "خدمات Debrid",
  "TorBox API key": "مفتاح API لـ TorBox",
  "AllDebrid API key": "مفتاح API لـ AllDebrid",
  "Premiumize API key": "مفتاح API لـ Premiumize",
  "Debrid-Link API key": "مفتاح API لـ Debrid-Link",
  "Streaming catalogs": "كتالوجات البث",
  "Top titles per service. Toggle off the ones you don't pay for.":
    "أفضل العناوين لكل خدمة. أوقف الخدمات التي لا تدفع اشتراكها.",
  "Stream safety filter": "فلتر أمان البث",
  "Result order": "ترتيب النتائج",
  "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.":
    "Condensed يعرض أفضل اختيار، بطاقات للجودة، وقائمة. Stremio قائمة مسطحة مجمّعة حسب الإضافة.",
  "Stream format chips": "شارات صيغة البث",
  "The little 4K · HDR · codec · audio chips that ride along each stream in the play picker.":
    "شارات 4K · HDR · الترميز · الصوت التي تظهر مع كل بث في منتقي التشغيل.",
  "Synced addons": "الإضافات المزامَنة",
  "How aggressively Harbor rejects shady or mismatched streams before showing them in the picker.":
    "ما مدى صرامة Harbor في رفض البث المشبوه أو غير المطابق قبل عرضه.",
  Strict: "صارم",
  "Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs (for episode requests), trailers, and likely cams.":
    "الافتراضي. يرفض الأحجام غير المنطقية، والامتدادات المشبوهة، وعدم تطابق سنة/حلقة الإصدار، وحزم المواسم (لطلبات الحلقات)، والعروض الدعائية، والجودات الضعيفة (cams).",
  Balanced: "متوازن",
  "Keeps the malware/year/episode-mismatch checks but allows season packs and oversized files. Same as hitting Search wider in the picker.":
    "يحتفظ بفحص الفيروسات وعدم تطابق السنة/الحلقة، ولكنه يسمح بحزم المواسم والملفات كبيرة الحجم. يعادل اختيار 'بحث أوسع' في القائمة.",
  "No filtering. Every stream every addon returns shows up, including obvious junk. You'll be on your own.":
    "بدون تصفية. سيظهر كل مصدر تبثه الإضافات، بما في ذلك الملفات العشوائية أو الرديئة. ستكون مسؤوليتك.",
  Condensed: "مكثف",
  "Default. Top pick at the top, quality tiles, and an All-Sources drawer. Harbor scores and ranks results.":
    "الافتراضي. الخيار الأفضل بالأعلى، بطاقات للجودة، وقائمة 'كل المصادر'. Harbor يقوم بتقييم وترتيب النتائج.",
  "Flat list of sources grouped by addon, with a filter dropdown. No re-ranking. Closest match to the Stremio app's stream picker.":
    "قائمة مبسطة مرتبة حسب الإضافة، مع قائمة تصفية منسدلة. بدون إعادة ترتيب. الأقرب لتصميم مشغل Stremio.",
  "Harbor ranking": "ترتيب Harbor",
  "Default. Harbor parses and scores every source and surfaces the best quality first.":
    "الافتراضي. Harbor يحلل ويقيم كل مصدر ويعرض أفضل الجودات أولاً.",
  "Addon order": "ترتيب الإضافة",
  "Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps.":
    "عرض نتائج كل إضافة بالترتيب الذي أرسلته، ومجمعة حسب قائمة إضافاتك. يطابق تطبيقي Stremio و Vidi.",
  "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Cached streams play direct. Keys stay local.":
    "Real-Debrid و TorBox و AllDebrid و Premiumize و Debrid-Link. البث المؤقت يعمل مباشرة. المفاتيح تبقى محلية.",
  "Real-Debrid API token": "رمز API لـ Real-Debrid",
  "API token": "رمز API",
  "API key": "مفتاح API",
  "Faster and quieter than torrents if you already pay for Usenet. Configure on the addon page, paste the manifest URL it returns.":
    "أسرع وأكثر هدوءًا من التورنت إذا كنت تدفع مقابل Usenet. قم بتكوينه على صفحة الإضافة والصق رابط manifest.",
  "Searches and streams directly off Easynews. No debrid needed. Just your Easynews login.":
    "يبحث ويبث مباشرة من Easynews. لا حاجة لـ debrid. فقط تسجيل دخولك إلى Easynews.",
  Expired: "منتهي",
  "Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.":
    "يقوم التطبيق بجلب إضافاتك من Stremio. يمكنك إدارة الإضافات بشكل فردي في مصادر البث.",
  "A specific summary lands faster than a long paragraph. Steps to reproduce help most of all.":
    "ملخص محدد يصل أسرع من فقرة طويلة. خطوات الإعادة تساعد أكثر من أي شيء.",
  Summary: "الملخص",
  "Steps to reproduce": "خطوات الإعادة",
  "What broke?": "ماذا تعطّل؟",
  "What actually happened": "ما الذي حدث فعلاً",
  "What you expected": "ما الذي توقعته",
  Severity: "الخطورة",
  "Screenshots and recordings": "لقطات الشاشة والتسجيلات",
  "Credit (optional)": "الاعتماد (اختياري)",
  "Bug reporters get listed in the release notes when their report leads to a shipped fix. Leave blank to stay anonymous.":
    "يُذكر المبلّغون عن الأخطاء في ملاحظات الإصدار عندما يؤدي تقريرهم إلى إصلاح. اتركه فارغاً للبقاء مجهولاً.",
  Theme: "السمة",
  "Theme Library": "مكتبة السمات",
  "Your themes": "سماتك",
  "Ships with Harbor. Always available.": "مدمجة مع Harbor. متاحة دائماً.",
  "Themes you imported or built.": "السمات التي استوردتها أو بنيتها.",
  "Build a new theme": "بناء سمة جديدة",
  "Copy theme": "نسخ السمة",
  Copy: "نسخ",
  "Apply custom theme": "تطبيق سمة مخصصة",
  "Background image": "صورة الخلفية",
  Ambience: "الأجواء (Ambience)",
  "The quick brown fox jumps over the lazy dog": "أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ",
  "Default. Humanist serif, warm sans.": "الافتراضي. خط كلاسيكي وآخر حديث، يوفران دفئاً.",
  "Classic. Was Harbor's original pair.": "كلاسيكي. الخط الأصلي لـ Harbor.",
  "Clean modern. Sans across the board.": "عصري ونظيف. خطوط بلا حواف في جميع الأقسام.",
  "Editorial. Headline-strong display.": "تحريري. خط عناوين قوي.",
  "Technical. IBM's open family.": "تقني. عائلة خطوط IBM المفتوحة.",
  "Stremio's typeface. Geometric humanist sans.": "خط Stremio. خط هندسي إنساني.",
  "Whatever your OS uses.": "ما يستخدمه نظام التشغيل الخاص بك.",
  Typography: "الخطوط",
  Colors: "الألوان",
  "Color tokens": "رموز الألوان",
  "Theme cheat sheet": "ورقة غش السمة",
  "Stable selectors": "محددات ثابتة",
  "Now using": "يُستخدم الآن",
  "Custom palette": "لوحة ألوان مخصصة",
  "Hand-tuned colors. Edit them in the section above.": "ألوان مضبوطة يدوياً. يمكنك تعديلها في القسم أعلاه.",
  "Edit colors": "تعديل الألوان",
  Bokeh: "تأثير بوكيه",
  "Top dock": "شريط علوي",
  "Side rail": "شريط جانبي رفيع",
  "Stremio rail": "شريط Stremio",
  "Floating dock": "شريط عائم",
  "Dracula sidebar": "شريط جانبي Dracula",
  "Nord sidebar": "شريط جانبي Nord",
  "Forest sidebar": "شريط جانبي Forest",
  "Royal top bar": "شريط علوي Royal",
  "Custom chrome": "تخطيط مخصص",
  "Sidebar layout": "الشريط الجانبي",
  "Glass cards": "بطاقات زجاجية",
  "Stremio cards": "بطاقات Stremio",
  "Hairline cards": "بطاقات رقيقة (Hairline)",
  "Crunch cards": "بطاقات Crunch",
  "Noir cards": "بطاقات Noir",
  "Custom cards": "بطاقات مخصصة",
  "Flat cards": "بطاقات مسطحة",
  "No background image": "بدون صورة خلفية",
  "Dim overlay": "تعتيم الخلفية",
  "Use the native window title bar": "استخدام شريط عنوان النافذة الأصلي",
  "Bokeh background": "تأثير بوكيه للخلفية",
  "Pick a layout, set colors and fonts, save it to your library. No code needed.":
    "اختر تخطيطاً، وعيّن الألوان والخطوط، واحفظه في مكتبتك. بدون برمجة.",
  "Open studio": "فتح الاستوديو",
  "Every variable, selector, hook, and recipe for building custom Harbor themes.":
    "كل متغير ومحدد ومرجع لبناء سمات مخصصة لـ Harbor.",
  "Make your own in the Theme Studio, or import one a friend shared.":
    "اصنع سمة بنفسك في الاستوديو، أو استورد واحدة شاركها صديق.",
  "Open library": "فتح المكتبة",
  "Build a Theme": "بناء سمة",
  "Pick a layout, set colors and fonts. No code needed.": "اختر تخطيطاً، وعيّن الألوان والخطوط. بدون برمجة.",
  "Import a Theme": "استيراد سمة",
  "Got a theme a friend shared? Drop it in.": "لديك سمة شاركها صديق؟ أسقطها هنا.",
  "Choose file": "اختيار ملف",
  "Window title bar": "شريط عنوان النافذة",
  "Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.":
    "استخدم شريط عنوان النظام وأزرار النافذة الأصلية بدلاً من المدمجة في Harbor. مفيد إذا كانت الأزرار داخل التطبيق صعبة الوصول، كما يحدث أثناء التشغيل.",
  "{name} imported to your library": "{name} تم استيرادها إلى مكتبتك",
  "Click any binding to rebind it. Press Esc while capturing to cancel. Letters ignore Shift (so K and Shift+K trigger the same action).":
    "انقر على أي اختصار لإعادة تعيينه. اضغط Esc أثناء التسجيل للإلغاء. الأحرف تتجاهل Shift (لذا K و Shift+K يؤديان نفس الإجراء).",
  Global: "عام",
  "Anywhere in Harbor.": "في أي مكان في Harbor.",
  NAVIGATION: "التنقل",
  PLAYBACK: "التشغيل",
  VOLUME: "الصوت",
  TRACKS: "المسارات",
  SPEED: "السرعة",
  PANELS: "اللوحات",
  Conflict: "تعارض",
  "Press a key…": "اضغط على مفتاح…",
  "Focus search": "التركيز على البحث",
  "Jump to the top-bar search from anywhere.": "الانتقال إلى شريط البحث العلوي من أي مكان.",
  "Your face in Watch Together rooms, sessions, and chat. Sits on top of your Stremio account.":
    "صورتك في غرف المشاهدة المشتركة والجلسات والدردشة. تُبنى فوق حسابك في Stremio.",
  "Use my AniList avatar as my Harbor avatar": "استخدام صورتي الرمزية في AniList كصورة رمزية في Harbor",
  "Use my Trakt avatar as my Harbor avatar": "استخدام صورتي الرمزية في Trakt كصورة رمزية في Harbor",
  "Use my Simkl avatar as my Harbor avatar": "استخدام صورتي الرمزية في Simkl كصورة رمزية في Harbor",
  "Not signed in": "غير مسجل الدخول",
  "addon synced": "إضافة متزامنة",
  "addons synced": "إضافات متزامنة",
  "Sync now": "مزامنة الآن",
  "Syncing…": "جاري المزامنة...",
  "Stremio ID": "معرف Stremio",
  "Re-authenticate": "إعادة المصادقة",
  "Sign in to sync your library, watch progress, and addons.":
    "قم بتسجيل الدخول لمزامنة مكتبتك وسجل المشاهدة والإضافات.",
  "Deploy your relay": "انشر مُرحّلك الخاص",
  "Spins up a tiny server on Cloudflare's free Workers tier. Stays online forever (or until you stop it). Friends connect by URL.":
    "يقوم بتشغيل خادم صغير جداً على باقة Cloudflare Workers المجانية. يبقى متصلاً بالإنترنت دائماً (أو حتى تقوم بإيقافه). يتصل الأصدقاء عن طريق الرابط.",
  "Click the button below. It opens Cloudflare's token page in your browser. Sign in (free, takes 30 seconds if you don't have an account).":
    "انقر على الزر أدناه. سيتم فتح صفحة رموز (Token) الخاصة بـ Cloudflare في متصفحك. قم بتسجيل الدخول (مجاني، يستغرق 30 ثانية إذا لم يكن لديك حساب).",
  "Fill the top of the form to look exactly like this:": "قم بتعبئة الجزء العلوي من النموذج ليبدو هكذا تماماً:",
  "Open Cloudflare token page": "افتح صفحة رموز Cloudflare",
  "I have my token": "لدي رمز (Token) بالفعل",
  "40-character token": "رمز مكون من 40 حرفاً",
  "Which account should the relay live in?": "في أي حساب يجب أن يكون هذا المُرحّل؟",
  "Uploading worker, wiring durable object…": "جاري رفع Worker وربط الـ durable object…",
  "Takes about 10 seconds.": "يستغرق حوالي 10 ثوانٍ.",
  "Relay is live": "المُرحّل يعمل الآن",
  "URL is saved and ready to share.": "تم حفظ الرابط وجاهز للمشاركة.",
  "Your relay URL": "رابط المُرحّل الخاص بك",
  "Copied. Paste it to your friend.": "تم النسخ. أرسله إلى أصدقائك.",
  "Send this to anyone you want to watch with. They paste it in their Settings → Harbor Relay. After that, share a 6-character room code from the people icon up top.":
    "أرسل هذا الرابط لأي شخص تريد المشاهدة معه. ليقوم بلصقه في الإعدادات ← Harbor Relay. بعد ذلك، شارك رمز الغرفة المكون من 6 أحرف من أيقونة الأشخاص في الأعلى.",
  "One last thing on Cloudflare's side": "أمر أخير من جانب Cloudflare",
  "Click the button below to open Cloudflare's Workers page.": "انقر على الزر أدناه لفتح صفحة Cloudflare Workers.",
  "Open Cloudflare Workers": "افتح Cloudflare Workers",
  "Try deploy again": "حاول النشر مجدداً",
  "Paste your API token first.": "الرجاء لصق رمز الـ API أولاً.",
  "Token works, but no accounts came back. Check the token's permissions.":
    "الرمز يعمل، ولكن لم يتم العثور على حسابات. تحقق من صلاحيات الرمز.",
  "No Cloudflare accounts found for this token.": "لم يتم العثور على حسابات Cloudflare لهذا الرمز.",
  "Connect your Trakt account": "ربط حساب Trakt الخاص بك",
  "Connect Trakt": "ربط Trakt",
  "About Trakt": "حول Trakt",
  "Harbor will scrobble your playback to Trakt and sync your watchlist.":
    "سيقوم Harbor بتسجيل ما تشاهده في Trakt ومزامنة قائمة المشاهدة الخاصة بك.",
  Authorized: "مُصرح منذ",
  "Open profile": "فتح الملف الشخصي",
  "Wear your Trakt profile picture across Harbor instead of the default.":
    "اعرض صورة ملفك الشخصي في Trakt في جميع أنحاء Harbor بدلاً من الصورة الافتراضية.",
  "Disconnect from Trakt": "قطع الاتصال من Trakt",
  "Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.":
    "هل تريد قطع اتصال Trakt؟ سيتوقف تسجيل المشاهدات والمزامنة حتى تقوم بالاتصال مرة أخرى.",
  Disconnect: "قطع الاتصال",
  "Blur comments by default": "تمويه التعليقات افتراضيًا",
  "Comments on episode/show pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "التعليقات في صفحات الحلقات/العروض تكون معمّاة حتى تظهرها، حتى لو لم تكن موسومة كحرق.",
  "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "التعليقات في صفحات الأنمي تكون معمّاة حتى تظهرها، حتى لو لم تكن موسومة كحرق.",
  "Show AniList comments": "إظهار تعليقات AniList",
  "Show forum threads and comments from AniList on anime detail pages.":
    "إظهار مواضيع المنتدى والتعليقات من AniList في صفحات تفاصيل الأنمي.",
  today: "اليوم",
  "Connect your Simkl account": "ربط حساب Simkl الخاص بك",
  "Connect Simkl": "ربط Simkl",
  "About Simkl": "حول Simkl",
  "Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.":
    "سيقوم Harbor بتعليم ما تنهيه كمُشاهد في Simkl ومزامنة قائمة المشاهدة المخطط لها.",
  "Authorized on this device": "مُصرح على هذا الجهاز",
  "Wear your Simkl profile picture across Harbor instead of the default.":
    "اعرض صورة ملفك الشخصي في Simkl في جميع أنحاء Harbor بدلاً من الصورة الافتراضية.",
  "Disconnect from Simkl": "قطع الاتصال من Simkl",
  "Disconnect Simkl? Syncing will stop until you reconnect.":
    "هل تريد قطع اتصال Simkl؟ ستتوقف المزامنة حتى تقوم بالاتصال مرة أخرى.",
  "Connect your AniList account": "ربط حساب AniList الخاص بك",
  "Connect AniList": "ربط AniList",
  "About AniList": "حول AniList",
  "Harbor shows your AniList lists on the Anime page and keeps your progress in sync.":
    "يعرض Harbor قوائم AniList الخاصة بك في صفحة الأنمي ويزامن تقدمك باستمرار.",
  "Sync watch progress": "مزامنة تقدم المشاهدة",
  "Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.":
    "يؤدي إنهاء حلقة أنمي إلى تحديث تقدمك في AniList. للأمام فقط: لن يقلل أبدًا من العدد الذي لديك بالفعل.",
  "Show your AniList profile picture as your Harbor avatar.":
    "اعرض صورة ملفك الشخصي في AniList كصورتك الرمزية في Harbor.",
  "Disconnect from AniList": "قطع الاتصال من AniList",
  "Discord webhook URL": "رابط ويب هوك Discord",
  Sources: "المصادر",
  "Pick which calendars feed your webhook. Items are deduped across sources before sending.":
    "اختر التقويمات التي ستغذي الويب هوك الخاص بك. يتم إزالة التكرارات بين المصادر قبل الإرسال.",
  "Filter by media type after the sources merge. Leave them all on to send everything.":
    "قم بالتصفية حسب نوع الوسائط بعد دمج المصادر. اتركها جميعًا قيد التشغيل لإرسال كل شيء.",
  "Episodes and movies from shows you've saved on Stremio.": "الحلقات والأفلام من العروض التي حفظتها على Stremio.",
  "Sign in to Stremio first.": "قم بتسجيل الدخول إلى Stremio أولاً.",
  "All upcoming": "كل الإصدارات القادمة",
  "Everything releasing in the current month from TMDB.": "كل شيء سيصدر في الشهر الحالي من TMDB.",
  "Add a TMDB key in Library settings.": "أضف مفتاح TMDB في إعدادات المكتبة.",
  "My Trakt": "حسابي في Trakt",
  "Upcoming episodes and movies from your Trakt watchlist.": "الحلقات والأفلام القادمة من قائمة المشاهدة في Trakt.",
  "Connect Trakt first.": "قم بربط Trakt أولاً.",
  "The most anticipated upcoming releases on Trakt. No login needed.":
    "أكثر الإصدارات القادمة انتظارًا على Trakt. لا يتطلب تسجيل الدخول.",
  "Anything matching your Custom calendar: tracked people, genres, providers, countries.":
    "أي شيء يطابق تقويمك المخصص: الأشخاص المتتبعون، الأنواع، المزودون، البلدان.",
  "Sent. Check your channel.": "تم الإرسال. تحقق من قناتك.",
  "Each rule fires independently. Define what triggers a ping and where it goes.":
    "كل قاعدة تعمل بشكل مستقل. حدد ما الذي يؤدي إلى إرسال إشعار وإلى أين يذهب.",
  "New rule": "قاعدة جديدة",
  "Add a Discord or Telegram URL above before creating rules.": "أضف رابط Discord أو Telegram أعلاه قبل إنشاء القواعد.",
  "No automations yet. Hit New rule to wire one up.": "لا توجد أتمتة بعد. انقر على قاعدة جديدة لإنشاء واحدة.",
  "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.":
    "يقوم Discord بنشر رسالة إلى قناة كلما أرسل Harbor إشعاراً. يستغرق الإعداد حوالي دقيقة.",
  "Open the Discord server where you want notifications to land.": "افتح خادم Discord الذي تريد أن تصل الإشعارات إليه.",
  "Edit Channel": "Edit Channel",
  Integrations: "Integrations",
  "New Webhook": "New Webhook",
  "Copy Webhook URL": "Copy Webhook URL",
  "Paste the URL into the box above and send a test.": "الصق الرابط في المربع أعلاه وأرسل اختباراً.",
  "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.":
    "لا يوجد خيار Integrations؟ تحتاج إلى إذن Manage Webhooks. اسأل مالك الخادم.",
  "Open Discord's webhook help": "افتح مساعدة webhook الخاصة بـ Discord",
  "Telegram bot": "بوت Telegram",
  "bot token": "رمز البوت (bot token)",
  "chat ID": "معرف الدردشة (chat ID)",
  "Open BotFather": "فتح BotFather",
  "Bot token": "رمز البوت (Bot token)",
  "Open the bot BotFather just made (he sends you a link). Send it any message so it's allowed to message you back.":
    "افتح البوت الذي صنعه BotFather للتو (يرسل لك رابطاً). أرسل له أي رسالة حتى يُسمح له بالرد عليك.",
  "Open userinfobot": "فتح userinfobot",
  "Chat ID": "معرف الدردشة (Chat ID)",
  "Send test": "إرسال اختبار",
  "Open Settings": "فتح الإعدادات",
  "Open Library settings": "فتح إعدادات المكتبة",
  "add one in settings": "أضف واحداً في الإعدادات",

  "Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.":
    "هل تستخدم AIOStreams أو إضافة تجميع أخرى؟ الفرز والتصفية الخاصة بها تحدث داخل الإضافة قبل أن يرى Harbor النتائج، ثم يُطبق Harbor فلتر أمان البث وترتيب النتائج أعلاه. إذا كانت النتائج أقل من المتوقع، اجعل أحدهما أكثر مرونة: إما أن تخفف الفلاتر الداخلية للإضافة أو تعين فلتر Harbor على متوازن أو إيقاف.",
  "Get yours at ": "احصل عليه من ",
  ". Used to check cache and unrestrict links. Harbor never adds or removes torrents on its own.":
    ". يُستخدم للتحقق من التخزين المؤقت وفك القيود. Harbor لا يضيف أو يزيل التورنت بمفرده أبداً.",
  ". Same read-only usage as Real-Debrid. Also lets you queue uncached torrents from the play picker.":
    ". نفس استخدام Real-Debrid (للقراءة فقط). يسمح لك أيضاً بوضع التورنت غير المخزن مؤقتاً في قائمة الانتظار من المشغل.",
  ". AllDebrid deprecated their cache-check endpoint, so streams may show as unknown until you actually hit Play.":
    ". ألغت AllDebrid نقطة فحص التخزين المؤقت، لذا قد تظهر البثوث غير معروفة حتى تنقر على تشغيل.",
  ". Uses the directdl endpoint, which skips queueing for anything already cached.":
    ". يستخدم نقطة نهاية directdl، التي تتجاوز قائمة الانتظار لأي شيء مخزن مسبقاً.",
  ". EU-hosted, fast cache check. Same read-only usage as the others.":
    ". استضافة أوروبية وفحص سريع للذاكرة المؤقتة. نفس استخدام البقية (للقراءة فقط).",
  "Easynews+": "Easynews+",
  "{n} services need attention": "{n} خدمات تحتاج إلى انتباه",
  "Health for {n} services below": "حالة {n} خدمات أدناه",
  "{n}d left": "متبقي {n} يوم",
  "Save a TMDB key in Library & metadata to turn on streaming catalogs.":
    "احفظ مفتاح TMDB في 'المكتبة والبيانات الوصفية' لتشغيل كتالوجات البث.",
  "Sign in to Stremio first. Your installed addons sync from there.":
    "سجل الدخول إلى Stremio أولاً. ستتم مزامنة الإضافات المثبتة من هناك.",
  Manage: "إدارة",
  "Last synced {n}s ago.": "آخر مزامنة منذ {n} ثانية.",
  "Show {n} more addons": "عرض {n} إضافات أخرى",
  "All addons ({n})": "جميع الإضافات ({n})",
  "Who's watching?": "من يشاهد؟",
  "Pick a profile to continue.": "اختر ملفاً شخصياً للمتابعة.",
  "Add profile": "إضافة ملف شخصي",
  "Profile not found.": "الملف الشخصي غير موجود.",
  Back: "رجوع",
  "Harbor identity": "هوية Harbor",
  "Edit {name}": "تعديل {name}",
  "New profile": "ملف شخصي جديد",
  "Display name": "الاسم",
  "Upload photo": "رفع صورة",
  "Use Trakt avatar": "استخدام صورة Trakt",
  "Use AniList avatar": "استخدام صورة AniList",
  "Use Simkl avatar": "استخدام صورة Simkl",
  "Share with {name}": "مشاركة مع {name}",
  "Use the primary profile's Stremio library, watchlist, and addons.":
    "استخدام مكتبة Stremio، وقائمة المشاهدة، والإضافات الخاصة بالملف الشخصي الأساسي.",
  "Use a separate Stremio account": "استخدام حساب Stremio منفصل",
  "Sign in from the sidebar after saving. Library and addons stay separate.":
    "سجل الدخول من الشريط الجانبي بعد الحفظ. المكتبة والإضافات تبقى منفصلة.",
  "Delete profile": "حذف الملف الشخصي",
  "Delete this profile?": "حذف هذا الملف الشخصي؟",
  Confirm: "تأكيد",
  "Save changes": "حفظ التغييرات",
  "Create profile": "إنشاء ملف شخصي",
  "Only the primary profile can edit other profiles.":
    "الملف الشخصي الأساسي فقط هو الذي يمكنه تعديل الملفات الشخصية الأخرى.",
  Security: "الأمان",
  "PIN on": "الرمز مفعل",
  "PIN off": "الرمز معطل",
  "no tab locks": "لا يوجد أقفال للتبويبات",
  "{n} tab locked": "تم قفل تبويب واحد",
  "{n} tabs locked": "تم قفل {n} تبويبات",
  "Profile security": "أمان الملف الشخصي",
  "PIN & sidebar locks": "الرمز السري وأقفال الشريط الجانبي",
  "Pick a PIN and which sidebar tabs require it.": "اختر رمزاً وحدد تبويبات الشريط الجانبي التي تتطلبه.",
  PIN: "الرمز السري",
  "4-digit PIN is set.": "تم تعيين رمز مكون من 4 أرقام.",
  "No PIN set.": "لم يتم تعيين أي رمز.",
  "Set PIN": "تعيين الرمز",
  Change: "تغيير",
  "Sidebar access": "الوصول للشريط الجانبي",
  "No locks. All sidebar tabs open without a PIN.": "لا يوجد أقفال. تفتح جميع تبويبات الشريط الجانبي بدون رمز.",
  "{n} tab requires this profile's PIN.": "يتطلب تبويب واحد رمز هذا الملف الشخصي.",
  "{n} tabs require this profile's PIN.": "تتطلب {n} تبويبات رمز هذا الملف الشخصي.",
  "Lock sidebar tabs": "قفل تبويبات الشريط الجانبي",
  "Locks only activate once a PIN is set.": "الأقفال تتفعل فقط عند تعيين رمز.",
  "Play button behavior": "سلوك زر التشغيل",
  "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.":
    "اختر ما يحدث عند الضغط على 'تشغيل' لعنوان ما. الوضع اليدوي يمنحك تحكماً كاملاً في الجودة والمصدر.",
  "Player engine": "محرك المشغل",
  "HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.":
    "يقوم محرك HTML5 بتشغيل كل ما يدعمه متصفحك. محرك mpv يتعامل مع TrueHD و DTS-HD و AV1 والحاويات المعقدة و HDR. 'تلقائي' يختار بناءً على المصدر.",
  "Seek bar": "شريط التقدم",
  "Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.":
    "اضبط مظهر الشريط في أسفل المشغل. غير النقطة إلى ملصق، غير ارتفاع الشريط، أو أعد تلوينه. يمكنك معاينة الإعدادات مباشرة هنا.",
  "Subtitle style": "نمط الترجمة",
  "How subtitles look during playback. Live preview below.": "كيف تبدو الترجمة أثناء التشغيل. المعاينة المباشرة أدناه.",
  "Show format chips on stream rows": "إظهار شارات الصيغ في صفوف البث",
  "The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.":
    "يقوم المنتقي بوضع علامات لكل بث توضح الدقة، ونوع HDR، والترميز، وصيغة الصوت. 'إيقاف' يخفيها جميعاً.",
  "Poster size": "حجم الملصق",
  "Scale every poster and card across Home, Discover, and your library. Bump it up on a 4K or large display where the defaults feel small, or shrink it for a denser grid.":
    "تغيير حجم كل ملصق وبطاقة عبر الصفحة الرئيسية والاستكشاف ومكتبتك. قم بتكبيره على شاشات 4K أو الشاشات الكبيرة، أو تصغيره للحصول على شبكة أكثر كثافة.",
  Compact: "مضغوط",
  Default: "الافتراضي",
  Large: "كبير",
  Huge: "ضخم",
  Accessibility: "إمكانية الوصول",
  "Make everything bigger and easier to read: sidebar, menus, popups, every page. The whole interface scales live as you drag, so you can see the change right here. Great on 4K and ultrawide monitors, or whenever the text feels small.":
    "اجعل كل شيء أكبر وأسهل للقراءة: الشريط الجانبي، القوائم، النوافذ المنبثقة، كل صفحة. الواجهة بأكملها تتغير أثناء السحب. ممتاز للشاشات الكبيرة.",
  "Interface scale": "حجم الواجهة",
  "Trailer quality": "جودة العرض الدعائي",
  "How sharp the trailer is when you hit the preview button. Auto picks from your connection speed. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "مدى دقة المقطع الدعائي عند النقر على زر المعاينة. 'تلقائي' يختار بناءً على سرعة اتصالك. '1080p' و'الأفضل' يدمجان الفيديو والصوت المنفصلين عبر ffmpeg، لذا قد يستغرقان وقتاً أطول قليلاً للبدء.",
  Auto: "تلقائي",
  Best: "الأفضل",
  Audio: "الصوت",
  "Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.":
    "شكّل الصوت دون لمس معادل الصوت في نظامك. يُطبق على محرك mpv؛ محرك HTML5 يُشغل الصوت كما هو.",
  "Normalize loudness": "تطبيع مستوى الصوت",
  "Evens out quiet dialogue and loud action scenes with a dynamic normalizer.":
    "يوازن بين الحوار الهادئ ومشاهد الحركة الصاخبة باستخدام مُطبع ديناميكي.",
  Flat: "مسطح",
  "Bass boost": "تضخيم الباس",
  "Vocal clarity": "وضوح الصوت البشري",
  "Less bass": "باس أقل",
  "Night mode": "الوضع الليلي",
  "Night mode gently compresses loud moments for late-night watching. Profiles take effect when the next track loads and stack with the normalizer.":
    "الوضع الليلي يضغط بلطف اللحظات الصاخبة للمشاهدة في وقت متأخر من الليل. يتم تطبيق الإعدادات عند تحميل المقطع التالي، وتُدمج مع تطبيع مستوى الصوت.",
  "Skip intros": "تخطي المقدمات",
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
    "يجد Harbor توقيتات المقدمات وأسماء الطاقم من AniSkip و TheIntroDB وفصول الملف نفسه، ثم يظهر زر التخطي في اللحظة المناسبة.",
  "Auto-skip intros": "تخطي المقدمات تلقائياً",
  "Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.":
    "تخطي الافتتاحيات تلقائياً بمجرد بدايتها. سيظل زر التخطي يظهر في كل الأحوال، والرجوع للخلف إلى المقدمة سيعيد تشغيلها دون التخطي مجدداً.",
  "Next episode prompt": "تنبيه الحلقة القادمة",
  "When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.":
    "متى يظهر تنبيه الحلقة القادمة قبل انتهاء الحلقة. يتم ضبطه تلقائياً بناءً على طول الحلقة. 'إيقاف' يخفيه تماماً.",
  Off: "إيقاف",
  "30s": "30 ثانية",
  "45s": "45 ثانية",
  "1 min": "1 دقيقة",
  "1.5 min": "1.5 دقيقة",
  "2 min": "2 دقيقة",
  Downloads: "التنزيلات",
  "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.":
    "المكان الذي يحفظ فيه Harbor الفيديوهات عند الضغط على تنزيل. اختر أي مجلد، حتى لو كان على محرك أقراص آخر.",
  HTML5: "HTML5",
  mpv: "mpv",
  "Anime4K upscaling": "تحسين Anime4K",
  Flat_Style: "مسطح",
  Background: "الخلفية",
  "{name} will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "سيتم إزالة {name} من Harbor. سيعود أي شيء قمت بتعيينه لاستخدامه إلى خط Inter.",
  "Player & quality": "المشغل والجودة",
  "Pick the playback engine and which quality chips show up on cards.":
    "اختر محرك التشغيل والجودات التي تظهر على البطاقات.",
  Starting: "قيد البدء",
  "Not running": "لا يعمل",
  Copied: "تم النسخ",
  Stop: "إيقاف",
  Restart: "إعادة التشغيل",
  "Start server": "بدء تشغيل الخادم",
  "Your streaming server address": "عنوان خادم البث الخاص بك",
  "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.":
    "يقوم Harbor بتشغيل خادم بث صغير على هذا الكمبيوتر مباشرةً. من هنا يتم العمل. للبث من هذا الجهاز على جهاز آخر، انسخ عنوان Wi-Fi والصقه في خادم البث عن بعد في Harbor هناك.",
  "On this computer": "على هذا الكمبيوتر",
  "From other devices on your Wi-Fi": "من أجهزة أخرى على شبكة Wi-Fi الخاصة بك",
  "Harbor in your browser": "Harbor في متصفحك",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer.":
    "يُقدم هذه النسخة تماماً من Harbor كتطبيق ويب على شبكتك. افتحها على متصفح الهاتف أو الكمبيوتر المحمول أو التلفزيون، وسجّل الدخول هناك، وسيتم البث عبر هذا الكمبيوتر.",
  "From any browser on your Wi-Fi": "من أي متصفح على شبكة Wi-Fi الخاصة بك",
  "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.":
    "تعذر البدء على المنفذ {WEB_PORT}. قد يكون هناك تطبيق آخر يستخدمه؛ قم بإيقافه وتشغيله لإعادة المحاولة.",
  Connected: "متصل",
  "Custom CSS": "CSS مخصص",
  "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.":
    "يُحقن مباشرة في المستند. استخدمه لإعادة تصميم الأزرار، وتغيير التباعد، وإعادة تلوين أي شيء.",
  "Custom JS": "JS مخصص",
  "Runs in the app's WebView. You're modding your own client. No sandbox, no safety net. Errors land in the console.":
    "يُنفذ في WebView الخاص بالتطبيق. أنت تعدل عميلك الخاص. لا توجد بيئة معزولة ولا شبكة أمان. ستظهر الأخطاء في وحدة التحكم.",
  "Custom HTML overlay": "تراكب HTML مخصص",
  "Injected into a fixed-position layer above the app (pointer-events disabled by default). Wrap in a div with pointer-events:auto to make it interactive.":
    "يتم حقنه في طبقة ثابتة أعلى التطبيق (تعطيل أحداث المؤشر افتراضيًا). ضعها داخل div مع pointer-events:auto لجعلها قابلة للتفاعل.",
  "Custom code": "رمز مخصص",
  "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.":
    "إعداد للمستخدمين المتقدمين. قم بحقن رموز CSS و JS و HTML الخاصة بك في Harbor. تُحفظ في إعداداتك المحلية؛ لا شيء يغادر جهازك.",
  "You're modding your own client. Custom JS has full access to your Harbor session. Only paste code you wrote or fully trust.":
    "أنت تقوم بتعديل العميل الخاص بك. الكود المخصص له حق الوصول الكامل إلى جلستك. قم بلصق الكود الذي كتبته أو تثق به تماماً.",
  "{n} chars": "{n} حرف",
  "Player layout": "تخطيط المشغل",
  "Pick a theme, then rearrange every button in the player chrome. Hide what you never use, promote what you do.":
    "اختر سمة، ثم أعد ترتيب كل زر في واجهة المشغل. قم بإخفاء ما لا تستخدمه أبدًا، وأبرز ما تستخدمه.",
  "Click any control in the live preview to move, hide, or reorder it.":
    "انقر على أي عنصر تحكم في المعاينة المباشرة لنقله أو إخفائه أو إعادة ترتيبه.",
  Profile: "الملف الشخصي",
  visible: "مرئي",
  hidden: "مخفي",
  "on the {themeName} theme.": "في سمة {themeName}.",
  "Edit player layout": "تعديل تخطيط المشغل",
  "Harbor's native player chrome.": "واجهة مشغل Harbor الأصلية.",
  Stremio: "Stremio",
  "Familiar Stremio button order.": "ترتيب أزرار Stremio المألوف.",
  "Confirm full reset": "تأكيد إعادة الضبط الكامل",
  "Reset all to default": "إعادة ضبط الكل للافتراضي",
  "Discard changes": "تجاهل التغييرات",
  "Designing the player layout": "تصميم تخطيط المشغل",
  "Customizing the player": "تخصيص المشغل",
  "Couldn't save your layout. {error}": "تعذر حفظ التخطيط الخاص بك. {error}",
  "You have unsaved changes that will be lost when switching profiles. Continue?":
    "لديك تغييرات غير محفوظة ستفقد عند التبديل بين الملفات الشخصية. هل ترغب في المتابعة؟",
  "Couldn't switch profile. {error}": "تعذر التبديل بين الملفات الشخصية. {error}",
  "Couldn't create the profile. {error}": "تعذر إنشاء الملف الشخصي. {error}",
  "Couldn't rename the profile. {error}": "تعذر إعادة تسمية الملف الشخصي. {error}",
  "Delete this profile permanently? This cannot be undone.":
    "هل تريد حذف هذا الملف الشخصي نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
  "Couldn't delete the profile. {error}": "تعذر حذف الملف الشخصي. {error}",
  "Couldn't import that file. {error}": "تعذر استيراد ذلك الملف. {error}",
  "You have unsaved changes. Close the editor and discard them?":
    "لديك تغييرات غير محفوظة. هل تريد إغلاق المحرر وتجاهلها؟",
  "Time format": "تنسيق الوقت",
  "What the clock labels show on the seek bar.": "ما تظهره تسميات الساعة على شريط التمرير.",
  "Elapsed and remaining": "المنقضي والمتبقي",
  "00:23 on the left, -1:12 on the right.": "00:23 على اليسار، -1:12 على اليمين.",
  "Remaining only": "المتبقي فقط",
  "Single -1:12 label, both ends collapse.": "تسمية واحدة -1:12، ويتم طي كلا الطرفين.",
  "Elapsed only": "المنقضي فقط",
  "Single 00:23 label, both ends collapse.": "تسمية واحدة 00:23، ويتم طي كلا الطرفين.",
  "Volume control": "التحكم في الصوت",
  "How the volume widget behaves on click and hover.": "كيف تتصرف أداة الصوت عند النقر والتمرير.",
  Slider: "شريط تمرير",
  "Hover the speaker to reveal a horizontal slider.": "مرر فوق مكبر الصوت لإظهار شريط تمرير أفقي.",
  Stepper: "أداة تدرج",
  "Click to cycle 100 / 75 / 50 / 25 / 0.": "انقر للتنقل بين 100 / 75 / 50 / 25 / 0.",
  "Icon only": "أيقونة فقط",
  "Click toggles mute. Wheel scrolls volume.": "يؤدي النقر إلى التبديل بين كتم الصوت. وتقوم العجلة بتمرير مستوى الصوت.",
  "Back to relay": "العودة إلى الخادم",
  Documentation: "المستندات",
  "Self-host": "الاستضافة الذاتية",
  "Run your own Harbor Relay": "قم بتشغيل خادم Harbor الخاص بك",
  "Two paths: Harbor handles the deploy for you, or you do it yourself with wrangler.":
    "مساران: يتعامل Harbor مع النشر نيابة عنك، أو تقوم بذلك بنفسك باستخدام wrangler.",
  Overview: "نظرة عامة",
  "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.":
    "خادم Harbor هو Cloudflare Worker يستضيف غرف WebSocket للمشاهدة معًا. يدير كل مستخدم الخادم الخاص به. لا يوجد خادم مركزي لـ Harbor.",
  "Source: {code}. About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "المصدر: {code}. حوالي 200 سطر من JavaScript، بدون تبعيات. اقرأه قبل النشر إذا كنت تريد معرفة ما يتم تشغيله.",
  Requirements: "المتطلبات",
  "A free Cloudflare account.": "حساب Cloudflare مجاني.",
  "About two minutes for the auto-deploy path.": "حوالي دقيقتين لمسار النشر التلقائي.",
  "For the manual path: {code} 20+ and {code} CLI.": "للمسار اليدوي: {code} 20+ و {code} CLI.",
  "Auto-deploy from Harbor": "النشر التلقائي من Harbor",
  "Easiest path. Harbor uploads the worker, creates the Durable Object namespace, and stores the resulting URL.":
    "أسهل مسار. يقوم Harbor برفع worker، وإنشاء مساحة اسم Durable Object، وتخزين الرابط الناتج.",
  "Open Settings, then Harbor Relay.": "افتح الإعدادات، ثم Harbor Relay.",
  "Click {kbd}.": "انقر على {kbd}.",
  "Generate a Cloudflare API token with {code1} and {code2} permissions at {code3}. Paste it into Harbor.":
    "قم بإنشاء رمز Cloudflare API بصلاحيات {code1} و {code2} في {code3}. الصقه في Harbor.",
  "Pick the Cloudflare account to deploy under.": "اختر حساب Cloudflare لنشره ضمنه.",
  "Wait for the upload to finish. The relay URL gets written to {code} in Harbor settings.":
    "انتظر حتى ينتهي الرفع. سيتم كتابة رابط الخادم إلى {code} في إعدادات Harbor.",
  "Manual deploy with wrangler": "النشر اليدوي باستخدام wrangler",
  "For users who want to deploy themselves or already have a wrangler workflow.":
    "للمستخدمين الذين يرغبون في النشر بأنفسهم أو لديهم سير عمل بـ wrangler بالفعل.",
  "Install wrangler and authenticate:": "قم بتثبيت wrangler والمصادقة:",
  "Save the worker source. Copy {code1} from the Harbor repo into a new directory as {code2}.":
    "احفظ مصدر worker. انسخ {code1} من مستودع Harbor إلى مجلد جديد باسم {code2}.",
  "Save this {code} next to it:": "احفظ ملف {code} هذا بجانبه:",
  "Deploy:": "نشر:",
  "Note the URL Cloudflare returns. It looks like {code}.": "لاحظ الرابط الذي تعيده Cloudflare. يبدو مثل {code}.",
  "In Harbor: Settings, Harbor Relay, then {kbd}. Paste the URL with {code1} as the scheme instead of {code2}.":
    "في Harbor: الإعدادات، Harbor Relay، ثم {kbd}. الصق الرابط مع استخدام مخطط {code1} بدلاً من {code2}.",
  "Verify it works": "التحقق من عمله",
  "Settings, Harbor Relay, then {kbd}.": "الإعدادات، Harbor Relay، ثم {kbd}.",
  "The test calls {code} and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "يستدعي الاختبار مسار {code} ويؤكد إمكانية الوصول إلى worker وتشغيله لإصدار حالي. يعني نجاح الاختبار أن غرف المشاهدة معًا ستتصل.",
  "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.":
    "إذا أظهرت نافذة المشاهدة معًا إشعارًا بخادم قديم، فإن إعادة النشر بالخطوات المذكورة أعلاه هو الحل. يختفي الإشعار تلقائيًا في المرة التالية التي تتصل فيها بمجرد إبلاغ الخادم عن الإصدار الحالي.",
  "Sharing your relay": "مشاركة الخادم الخاص بك",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique {code} subdomain acts as the access token. There is no login.":
    "رابط الخادم قابل للمشاركة. يمكن لأي شخص لديه الرابط الانضمام إلى غرف المشاهدة معًا المستضافة على الخادم الخاص بك. يعمل النطاق الفرعي المميز {code} كرمز وصول. لا يوجد تسجيل دخول.",
  "To run a public relay, post the {code} URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay, {kbd}.":
    "لتشغيل خادم عام، انشر رابط {code} على r/Stremio أو في أي مكان يتواجد فيه مجتمعك. يقوم مستخدمو Harbor الآخرون بلصقه في الإعدادات، Harbor Relay، ثم {kbd}.",
  Costs: "التكاليف",
  "Cloudflare Workers free tier:": "الفئة المجانية لـ Cloudflare Workers:",
  "100,000 requests per day.": "100,000 طلب في اليوم.",
  "10ms CPU time per request.": "10 مللي ثانية من وقت وحدة المعالجة المركزية لكل طلب.",
  "Unlimited Durable Object storage at $0.20 per million reads.":
    "تخزين Durable Object غير محدود مقابل 0.20 دولار لكل مليون عملية قراءة.",
  "A typical Watch Together session uses a few hundred messages per hour. Solo and small-group use stays well under free tier limits.":
    "تستخدم جلسة المشاهدة معًا النموذجية بضع مئات من الرسائل في الساعة. يبقى الاستخدام الفردي وللمجموعات الصغيرة أقل بكثير من حدود الفئة المجانية.",
  "If you exceed free tier, the Workers Paid plan is $5 per month and bumps the request allowance to 10 million per day.":
    "إذا تجاوزت الفئة المجانية، فإن خطة Workers المدفوعة تكلف 5 دولارات شهريًا وترفع حد الطلبات إلى 10 ملايين في اليوم.",
  Troubleshooting: "استكشاف الأخطاء وإصلاحها",
  Symptom: "الأعراض",
  Cause: "السبب",
  Fix: "الإصلاح",
  "Health check returns 5xx": "التحقق من الصحة يعيد خطأ 5xx",
  "Worker crashed or hit memory limits": "تعطل Worker أو وصل إلى حدود الذاكرة",
  "Check logs in Cloudflare dashboard, then redeploy": "تحقق من السجلات في لوحة تحكم Cloudflare، ثم أعد النشر",
  "Connection refused / DNS does not resolve": "تم رفض الاتصال / تعذر تحليل DNS",
  "Worker deleted or URL wrong": "تم حذف Worker أو أن الرابط غير صحيح",
  "Re-run deploy or paste the correct URL": "أعد تشغيل النشر أو الصق الرابط الصحيح",
  "Watch Together rooms drop after 6 hours": "سقوط غرف المشاهدة معًا بعد 6 ساعات",
  "Durable Object idle eviction": "إخلاء Durable Object الخامل",
  "Expected. Rooms recreate on next join.": "متوقع. يتم إعادة إنشاء الغرف عند الانضمام التالي.",
  "What the worker does": "ما يفعله worker",
  "{code}: returns JSON with the worker version. Used by the test button.":
    "{code}: يعيد ملف JSON يحتوي على إصدار worker. يُستخدم بواسطة زر الاختبار.",
  "{code} with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "{code} مع ترقية WebSocket: يفتح غرفة المشاهدة معًا. يتم الاحتفاظ بالحالة في Durable Object، ولا يوجد استمرار بعد الجلسة النشطة.",
  "Saving…": "جاري الحفظ...",
  Download: "تنزيل",
  "Plain text (.txt)": "نص عادي (.txt)",
  "JSON (.json)": "JSON (.json)",
  "PDF (print)": "PDF (طباعة)",
  Relay: "الخادم",
  "On Cloudflare, click {b1}, then find {b2} and click {b3}.":
    "في Cloudflare، انقر على {b1}، ثم ابحث عن {b2} وانقر على {b3}.",
  "Create Token": "Create Token",
  "Create Custom Token": "Create Custom Token",
  "Get started": "Get started",
  "Cloudflare token form filled with name 'Harbor Relay' and one permission row set to Account / Workers Scripts / Edit":
    "نموذج رمز Cloudflare المليء بالاسم 'Harbor Relay' وصف أذونات واحد تم تعيينه على Account / Workers Scripts / Edit",
  "Token name can be anything. The permission row must be exactly {b1} + {b2} + {b3}.":
    "يمكن أن يكون اسم الرمز المميز أي شيء. يجب أن يكون صف الأذونات بالتحديد {b1} + {b2} + {b3}.",
  "Workers Scripts": "Workers Scripts",
  Edit: "Edit",
  "Leave everything below it alone. Scroll down, click {b1}, then {b2}. Copy the long string it shows you (you only see it once) and bring it back here.":
    "اترك كل شيء تحته كما هو. مرر لأسفل، انقر على {b1}، ثم {b2}. انسخ النص الطويل الذي يظهر لك (ستراه مرة واحدة فقط) وأحضره إلى هنا.",
  "Continue to summary": "Continue to summary",
  Continue: "متابعة",
  "Copy URL": "نسخ الرابط",
  "Something went wrong.": "حدث خطأ ما.",
  "Your account hasn't picked its free {code} address yet. Cloudflare only asks the first time. Quick to set up.":
    "لم يقم حسابك باختيار عنوان {code} المجاني الخاص به بعد. يطلب Cloudflare ذلك في المرة الأولى فقط. الإعداد سريع.",
  "Click {b1} in the top right. Pick the {b2} template (it's the default, should already be selected).":
    "انقر على {b1} في أعلى اليمين. اختر قالب {b2} (إنه الافتراضي، ويجب أن يكون محدداً بالفعل).",
  Create: "Create",
  "Hello World": "Hello World",
  "Cloudflare asks you to pick a name (this becomes {code}). Type any name (your first name works). Then click {b1}.":
    "يطلب منك Cloudflare اختيار اسم (سيصبح هذا {code}). اكتب أي اسم (اسمك الأول مناسب). ثم انقر على {b1}.",
  Deploy: "Deploy",
  "Come back here and hit {b1}. The Hello World can stay where it is. It's free and harmless.":
    "عد إلى هنا واضغط على {b1}. يمكن أن يبقى Hello World حيث هو. إنه مجاني وغير ضار.",
  Close: "إغلاق",
  "Try again": "حاول مرة أخرى",
  "Reset all ({count})": "إعادة تعيين الكل ({count})",
  Player: "المشغل",
  "Inside the playback view.": "داخل واجهة التشغيل.",
  Other: "أخرى",
  Navigation: "التنقل",
  Seeking: "التقديم والتأخير",
  Volume: "الصوت",
  Tracks: "المسارات",
  Speed: "السرعة",
  Panels: "اللوحات",
  "Close player": "إغلاق المشغل",
  "Exit playback and return to the previous view.": "الخروج من التشغيل والعودة إلى العرض السابق.",
  "Play / pause": "تشغيل / إيقاف مؤقت",
  "Toggle playback.": "التبديل بين التشغيل والإيقاف.",
  "Toggle fullscreen": "ملء الشاشة",
  "Enter or exit fullscreen.": "الدخول أو الخروج من وضع ملء الشاشة.",
  "Toggle stats overlay": "إظهار الإحصائيات",
  "Show or hide the playback stats overlay.": "إظهار أو إخفاء إحصائيات التشغيل.",
  "Cycle aspect / crop": "تبديل الأبعاد / القص",
  "Cycle aspect and crop modes: Fit, Fill, Zoom, 16:9, 4:3, Original.":
    "تبديل أوضاع الأبعاد والقص: احتواء، تعبئة، تكبير، 16:9، 4:3، أصلي.",
  "Zoom out": "تصغير",
  "Step zoom out to restore baked-in black bars (Zoom mode).":
    "تصغير تدريجي لاستعادة الأشرطة السوداء المدمجة (وضع التكبير).",
  "Zoom in": "تكبير",
  "Step zoom in to crop baked-in black bars (Zoom mode).": "تكبير تدريجي لقص الأشرطة السوداء المدمجة (وضع التكبير).",
  Screenshot: "لقطة شاشة",
  "Save the current frame (video only, no subtitles) as a PNG to Pictures/Harbor.":
    "حفظ الإطار الحالي (فيديو فقط، بدون ترجمة) كصورة PNG في مجلد Pictures/Harbor.",
  "Record GIF": "تسجيل صورة متحركة (GIF)",
  "Start or stop recording a GIF of the video (no subtitles). Saves to Pictures/Harbor.":
    "بدء أو إيقاف تسجيل صورة متحركة للفيديو (بدون ترجمة). يتم حفظها في مجلد Pictures/Harbor.",
  "Seek back": "رجوع",
  "Jump back by the Back seek step set under Behavior.": "الرجوع للخلف حسب خطوة الرجوع المحددة في السلوك.",
  "Seek forward": "تقديم",
  "Jump forward by the Forward seek step set under Behavior.": "التقدم للأمام حسب خطوة التقديم المحددة في السلوك.",
  "Seek back 30s": "تأخير 30 ثانية",
  "Jump back thirty seconds.": "الرجوع للخلف ثلاثين ثانية.",
  "Seek forward 30s": "تقديم 30 ثانية",
  "Jump forward thirty seconds.": "التقدم للأمام ثلاثين ثانية.",
  "Jump to start": "الانتقال إلى البداية",
  "Seek to the beginning.": "التقديم إلى البداية.",
  "Jump to end": "الانتقال إلى النهاية",
  "Seek to the last half second.": "التقديم إلى آخر نصف ثانية.",
  "Volume up": "رفع مستوى الصوت",
  "Raise volume (hold Shift for big steps).": "رفع مستوى الصوت (اضغط مع الاستمرار على Shift للخطوات الكبيرة).",
  "Volume down": "خفض مستوى الصوت",
  "Lower volume (hold Shift for big steps).": "خفض مستوى الصوت (اضغط مع الاستمرار على Shift للخطوات الكبيرة).",
  "Toggle mute": "كتم الصوت",
  "Mute or unmute audio.": "كتم الصوت أو إعادته.",
  "Cycle subtitles": "تبديل الترجمات",
  "Cycle through available subtitle tracks.": "التبديل بين مسارات الترجمة المتاحة.",
  "Cycle subtitles (alt)": "تبديل الترجمات (بديل)",
  "A second binding for the same action so muscle memory survives.": "اختصار ثانٍ لنفس الإجراء لتسهيل الاستخدام.",
  "Subtitle delay −0.1s": "تأخير الترجمة −0.1 ثانية",
  "Shift subtitle timing earlier (Shift for fine steps).": "تقديم وقت الترجمة (اضغط Shift لخطوات دقيقة).",
  "Subtitle delay +0.1s": "تأخير الترجمة +0.1 ثانية",
  "Shift subtitle timing later (Shift for fine steps).": "تأخير وقت الترجمة (اضغط Shift لخطوات دقيقة).",
  "Next episode": "الحلقة التالية",
  "Skip to the next episode if available.": "التخطي إلى الحلقة التالية إن وجدت.",
  "Previous episode": "الحلقة السابقة",
  "Skip to the previous episode if available.": "التخطي إلى الحلقة السابقة إن وجدت.",
  "Previous channel": "القناة السابقة",
  "Jump back to the last live channel you watched (live TV only).":
    "الرجوع إلى آخر قناة بث مباشر شاهدتها (البث المباشر فقط).",
  "Speed down": "إبطاء",
  "Slow playback by 0.25x.": "إبطاء التشغيل بمقدار 0.25x.",
  "Speed up": "تسريع",
  "Speed playback up by 0.25x.": "تسريع التشغيل بمقدار 0.25x.",
  "Stream switcher": "مبدّل البث",
  "Open or close the in-player stream switcher.": "فتح أو إغلاق مبدّل البث في المشغل.",
  "Up next / episodes": "التالي / الحلقات",
  "Open or close the episode panel.": "فتح أو إغلاق لوحة الحلقات.",
  "TV guide": "دليل التلفزيون",
  "Open or close the live TV guide (live channels only).": "فتح أو إغلاق دليل البث المباشر (القنوات المباشرة فقط).",
  "DVR / record": "تسجيل DVR",
  "Open or close the live TV recorder (live channels only).": "فتح أو إغلاق مسجل البث المباشر (القنوات المباشرة فقط).",
  "Sleep at end of episode": "وضع السكون عند نهاية الحلقة",
  "Toggle a sleep timer that pauses when this episode ends.":
    "تشغيل مؤقت السكون لإيقاف التشغيل مؤقتاً عند انتهاء هذه الحلقة.",
  Low: "منخفضة",
  "cosmetic, minor": "شكلي، بسيط",
  Normal: "عادية",
  annoying: "مزعج",
  High: "عالية",
  "feature broken": "ميزة معطلة",
  Critical: "حرجة",
  "app unusable": "توقف التطبيق بالكامل",
  "Drop a clip of the bug if you can. A 5-second screen recording usually says more than five paragraphs.":
    "أرفق مقطعاً للمشكلة إن أمكن. تسجيل شاشة لـ 5 ثوانٍ يغني عن خمس فقرات عادةً.",
  "Drop screenshots or screen recordings, or click to browse": "أسقط لقطات شاشة أو تسجيلات هنا، أو انقر للتصفح",
  "PNG, JPG, WebP, GIF, MP4, WebM, MOV. Up to 6 files, 100 MB each.":
    "PNG، JPG، WebP، GIF، MP4، WebM، MOV. بحد أقصى 6 ملفات، 100 ميجابايت لكل منها.",
  "Credit me in the release notes if this report leads to a fix.": "اذكرني في ملاحظات الإصدار إذا أدى تقريري إلى إصلاح.",
  "Want to fix it yourself?": "تريد إصلاحه بنفسك؟",
  "Harbor is open source. PRs that reference a bug get reviewed within 48h and ship with credit in the release notes.":
    "Harbor مفتوح المصدر. تُراجع طلبات السحب (PRs) التي تشير لخطأ خلال 48 ساعة ويُضاف لك الاعتماد في ملاحظات الإصدار.",
  "Open repo on GitHub": "افتح المستودع على GitHub",
  "Browse pull requests": "تصفح طلبات السحب",
  "What gets sent": "ما الذي يتم إرساله",
  "Could not send:": "تعذر الإرسال:",
  "Ready to send": "جاهز للإرسال",
  "Player freezes after the second episode autoplays": "المشغل يتجمد بعد التشغيل التلقائي للحلقة الثانية",
  "1. Open Movies\n2. Click The Substance\n3. Press Play\n4. ...":
    "1. افتح الأفلام\n2. اضغط على The Substance\n3. اضغط تشغيل\n4. ...",
  "Stream should start playing within a few seconds.": "يجب أن يبدأ البث خلال ثوانٍ قليلة.",
  "Spinner stays forever and nothing in the player loads.": "تستمر أيقونة التحميل للأبد ولا يظهر شيء في المشغل.",
  "Email or Discord": "البريد الإلكتروني أو Discord",
  "Loading environment details…": "جاري تحميل تفاصيل بيئة التشغيل…",
  "Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go faster.":
    "تُدرج تلقائياً. بدون مفاتيح، أو مكتبة، أو روابط. مجرد بيانات هيكلية لتسريع حل المشكلة.",
  "Harbor test message (Discord). If you can read this, your webhook is wired up.":
    "رسالة اختبار من Harbor (Discord). إذا كنت تقرأ هذا، فإن الويب هوك يعمل.",
  "Harbor test message (Telegram). If you can read this, your webhook is wired up.":
    "رسالة اختبار من Harbor (Telegram). إذا كنت تقرأ هذا، فإن الويب هوك يعمل.",
  Failed: "فشل الإرسال",
  Types: "الأنواع",
  Movies: "الأفلام",
  TV: "المسلسلات",
  Anime: "الأنمي",
  "Right-click a text channel, pick": "انقر بزر الماوس الأيمن على قناة نصية، واختر",
  Click: "انقر على",
  "on the left, then": "على اليسار، ثم",
  "name it Harbor, hit": "سمِّه Harbor، واضغط",
  "Telegram sends through a bot you create. You need two things: a":
    "يرسل Telegram عبر بوت تقوم بإنشائه. تحتاج إلى شيئين: ",
  "and your": "و",
  "Both go in the boxes above. Harbor builds the URL for you.":
    "كلاهما يوضع في المربعات أعلاه. وسيقوم Harbor بإنشاء الرابط لك.",
  Tap: "اضغط",
  "below. In Telegram, send him": "أدناه. في Telegram، أرسل له",
  "Pick any name. Pick a username ending in": "اختر أي اسم. اختر اسم مستخدم ينتهي بـ",
  "BotFather replies with a token like": "سيرد BotFather برمز مثل",
  "Long string with a colon in it. Copy it. Paste it into the": "نص طويل يحتوي على نقطتين. انسخه. الصقه في",
  "box above.": "المربع أعلاه.",
  "below. Send it": "أدناه. أرسل له",
  "It replies with your numeric ID. Copy that number. Paste it into the":
    "سيرد بمعرفك الرقمي. انسخ هذا الرقم. الصقه في",
  Hit: "اضغط",
  "You should get a message from your new bot.": "يجب أن تتلقى رسالة من البوت الجديد الخاص بك.",
  "A new movie comes out": "إصدار فيلم جديد",
  "A new series comes out": "إصدار مسلسل جديد",
  "A new anime comes out": "إصدار أنمي جديد",
  "Someone I track has a new release": "شخص أتابعه لديه إصدار جديد",
  "A specific genre releases": "إصدار لتصنيف محدد",
  "A streamer releases something": "شبكة بث تُصدر شيئًا",
  "A country releases something": "دولة تُصدر شيئًا",
  "Trakt anticipated picks up something": "قائمة المنتظرة في Trakt تُحدث شيء",
  "My Trakt watchlist updates": "تحديث قائمة المشاهدة في Trakt",
  "A Live TV program is about to start": "برنامج بث مباشر (Live TV) على وشك البدء",
  "Any new movie": "أي فيلم جديد",
  "Any new series": "أي مسلسل جديد",
  "Any new anime": "أي أنمي جديد",
  "Any of your {n} tracked people": "أي من الأشخاص المتابعين وعددهم {n}",
  "Tracked people": "الأشخاص المتابعون",
  "Any genre": "أي تصنيف",
  Series: "مسلسلات",
  "Any streamer": "أي شبكة بث",
  "Any country": "أي دولة",
  "Trakt anticipated": "قائمة المنتظرة في Trakt",
  "Your Trakt watchlist": "قائمة المشاهدة الخاصة بك في Trakt",
  "Live TV": "بث مباشر (Live TV)",
  favorites: "المفضلة",
  "all channels": "جميع القنوات",
  "{n} min lead": "إشعار قبل {n} دقيقة",
  Automations: "الأتمتة (Automations)",
  "no channel": "لا توجد قناة",
  "Edit rule": "تعديل القاعدة",
  Name: "الاسم",
  WHEN: "متى (WHEN)",
  "Media type": "نوع الوسائط",
  Genres: "التصنيفات",
  Streamers: "شبكات البث",
  Countries: "الدول",
  "Only my favorited channels": "قنواتي المفضلة فقط",
  "Heads up": "إشعار مسبق",
  "Harbor scans your IPTV playlists' EPG every 30 min for programs about to start.":
    "يقوم Harbor بفحص دليل البرامج (EPG) في قوائم IPTV كل 30 دقيقة بحثًا عن البرامج التي على وشك البدء.",
  "Add people in the Custom calendar manager first, then come back here.":
    "أضف أشخاصًا في مدير التقويم المخصص أولاً، ثم عُد إلى هنا.",
  "People (empty = all tracked)": "الأشخاص (فارغ = جميع المتابعين)",
  "THEN notify on": "ثم أرسل الإشعار على (THEN notify on)",
  "Save rule": "حفظ القاعدة",
  "My library": "مكتبتي",
  Anticipated: "المنتظرة",
  "Custom calendar": "التقويم المخصص",
  "Harbor checks harbor.site for new versions and installs them in place. Nothing installs until you choose to, and a dismissed update never nags you again.":
    "يتحقق Harbor من harbor.site للبحث عن إصدارات جديدة ويثبتها في مكانها. لا يتم تثبيت أي شيء حتى تختار ذلك، ولن يزعجك إشعار التحديث المرفوض مرة أخرى.",
  "Library, watch progress, and addon collection sync from this account.":
    "المكتبة، وتقدم المشاهدة، ومجموعة الإضافات تتزامن من هذا الحساب.",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your Stremio sign-in.":
    "قم بتصدير إعدادات Harbor بالكامل إلى ملف واحد، ثم استعدها على جهاز كمبيوتر جديد أو احتفظ بها كنسخة احتياطية. كل شيء متضمن باستثناء تسجيل الدخول إلى Stremio الخاص بك.",
  "Harbor sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.":
    "لا يرسل Harbor أي بيانات تتبع (telemetry). وهذا يوقف أيضًا طلبات الإعلانات، التحليلات، ومتتبعات البيانات الصادرة التي تحاول الإضافات أو مزودو البيانات الوصفية إجراؤها، قبل أن تغادر جهازك.",
  "Keep Harbor a click away. Close it to the system tray instead of quitting, and control it from the tray menu. These also mirror into the tray menu live.":
    "أبقِ Harbor على بُعد نقرة. أغلقه ليتجه إلى شريط النظام بدلاً من إنهائه، وتحكم فيه من قائمة الشريط. وتنعكس هذه التغييرات أيضًا في قائمة الشريط مباشرةً.",
  "Your color": "لونك",
  "Used for your cursor in Watch Together, your draw color, and your name pill in chat.":
    "يُستخدم لمؤشرك في المشاهدة معاً، ولون الرسم الخاص بك، وشريط اسمك في الدردشة.",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app. Every install also syncs to your Stremio account, so the official app remains the canonical home for your library.":
    "يلتقط Harbor روابط التثبيت stremio:// بحيث تبقى عملية الإعداد والتثبيت داخل التطبيق. تتم مزامنة كل تثبيت مع حسابك في Stremio أيضًا، بحيث يظل التطبيق الرسمي هو المرجع الأساسي لمكتبتك.",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar. Desktop only, and only your own Discord client is involved (nothing touches a Harbor server).":
    "دع أصدقاءك على Discord يرون ما تشاهده، مع بوستر العرض وشريط تقدم مباشر. متوفر للديسكتوب فقط، ولا يتطلب سوى برنامج Discord الخاص بك (لا شيء يمر عبر خوادم Harbor).",
  "Saved {d} from Harbor {a}.": "تم الحفظ {d} من Harbor {a}.",
  "MPV (native, recommended)": "MPV (أصلي، موصى به)",
  "HTML5 (browser-based)": "HTML5 (مستند للمتصفح)",
  "Player shell": "واجهة المشغل",
  "Seek bar style": "نمط شريط التقدم",
  "Playback speed": "سرعة التشغيل",
  "Subtitle appearance": "مظهر الترجمة",
  "Subtitle font size": "حجم خط الترجمة",
  "Subtitle background": "خلفية الترجمة",
  "Play mode": "وضع التشغيل",
  "Auto next episode": "التالية تلقائياً",
  "Automatically play the next episode when the current one ends.": "تشغيل الحلقة التالية تلقائياً عند انتهاء الحالية.",
  "Local engine address": "عنوان المحرك المحلي",
  "Remote server": "الخادم البعيد",
  "Custom MPV code": "كود MPV مخصص",
  "Anime4K shaders": "تظليلات Anime4K",
  "Server address": "عنوان الخادم",
  Connection: "الاتصال",
  "Downloading to": "التنزيل إلى",
  "Downloads folder": "مجلد التنزيلات",
  "Speed test": "اختبار السرعة",
  "Run speed test": "تشغيل اختبار السرعة",
  Test: "اختبار",
  Internals: "إعدادات داخلية",
  Layouts: "التخطيطات",
  "New layout": "تخطيط جديد",
  "Save layout": "حفظ التخطيط",
  "Delete layout": "حذف التخطيط",
  "Layout name": "اسم التخطيط",
  "Upload icon": "رفع أيقونة",
  "Add element": "إضافة عنصر",
  "Top bar": "الشريط العلوي",
  "Bottom bar": "الشريط السفلي",
  Inspector: "المفتش",
  Options: "خيارات",
  Controls: "أدوات التحكم",
  "Reset layout": "إعادة تعيين التخطيط",
  "Deploy relay": "نشر المرحّل",
  "Relay URL": "رابط المرحّل",
  "Test relay": "اختبار المرحّل",
  "Relay status": "حالة المرحّل",
  "Relay docs": "وثائق المرحّل",
  "Your relay": "مرحّلك",
  "Relay panel": "لوحة المرحّل",
  "Set up a Cloudflare relay for Watch Together": "إعداد مرحّل Cloudflare للمشاهدة المشتركة",
  "Copy relay URL": "نسخ رابط المرحّل",
  "Relay is up to date": "المرحّل محدّث",
  "Relay needs update": "المرحّل يحتاج تحديث",
  "Relay not reachable": "المرحّل غير متاح",
  "Checking…": "جارٍ التحقق…",
  "Check relay": "فحص المرحّل",
  "Relay test passed": "نجح اختبار المرحّل",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.":
    "يفحص مكتبة Stremio ويعيد كتابة أي عنصر لا يطابق المخطط الدقيق. آمن التشغيل في أي وقت.",
  "Translate series and movie posters to Arabic if available on TMDB":
    "ترجمة أغلفة المسلسلات والأفلام إلى العربية إذا كانت متاحة على TMDB",
  "If enabled, posters will display the Arabic title. Disable this to keep the original English poster.":
    "إذا كان مفعلاً، ستعرض الأغلفة العنوان بالعربية. عطّله للإبقاء على الغلاف الإنجليزي الأصلي.",
  "Translate descriptions and synopsis to Arabic": "ترجمة الأوصاف والملخصات إلى العربية",
  "Enable this to fetch Arabic descriptions for series and movies when available on TMDB.":
    "فعّل هذا لجلب الأوصاف بالعربية للمسلسلات والأفلام عند توفرها على TMDB.",
  "Summary needs at least 6 characters": "يحتاج الملخّص إلى 6 أحرف على الأقل",
  "Preparing…": "جارٍ التحضير…",
  "Sending…": "جارٍ الإرسال…",
  "Submit bug report": "إرسال بلاغ الخلل",

  Slot: "الموضع",
  Order: "الترتيب",
  "Move to previous slot": "النقل إلى الموضع السابق",
  "Move to next slot": "النقل إلى الموضع التالي",
  "Move up": "تحريك لأعلى",
  "Move down": "تحريك لأسفل",
  "Preview state": "حالة المعاينة",
  Size: "الحجم",
  Icon: "أيقونة",
  Hidden: "مخفي",
  Visible: "ظاهر",
  "Show this control": "إظهار هذا العنصر",
  "Hide this control": "إخفاء هذا العنصر",
  Deselect: "إلغاء التحديد",
  "Slot is getting crowded ({n}/{limit}). May overflow on narrow screens.":
    "الموضع يزدحم ({n}/{limit}). قد يفيض على الشاشات الضيّقة.",
  "Series tab": "علامة المسلسل",
  "Watch Together panel": "لوحة المشاهدة الجماعية",
  Side: "الجانب",
  Corner: "الزاوية",
  "Show this panel": "إظهار هذه اللوحة",
  "Hide this panel": "إخفاء هذه اللوحة",
  Host: "المضيف",

  Save: "حفظ",
  Saved: "تم الحفظ",
  Active: "نشط",
  Hide: "إخفاء",
  Show: "إظهار",
  Clear: "مسح",
  "No matches": "لا توجد نتائج",
  "Sign in": "تسجيل الدخول",
  "Sign out": "تسجيل الخروج",
  "Reset to default": "الإعادة إلى الافتراضي",

  Instant: "فوري",
  "Manual picker": "أداة الاختيار اليدوية",
  Recommended: "موصى به",
  "Hitting Play jumps straight into playback with the best stream Harbor finds.":
    "يقفز الضغط على تشغيل مباشرةً إلى التشغيل بأفضل بثٍّ يجده Harbor.",
  "Hitting Play opens the source list so you can choose quality, debrid, and audio yourself.":
    "يفتح الضغط على تشغيل قائمة المصادر لتختار الجودة وDebrid والصوت بنفسك.",
  "Remember last stream": "تذكّر آخر بثّ",
  "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.":
    "عند استئنافك لشيء كنت تشاهده، أعد تشغيل البثّ نفسه الذي استخدمته آخر مرة (نفس الإضافة والمصدر) بدلًا من فتح الأداة من جديد. عطّله لتختار جديدًا دائمًا.",

  "mpv on the desktop app, HTML5 in the browser. The right engine without thinking about it.":
    "mpv في تطبيق سطح المكتب، وHTML5 في المتصفّح. المحرك المناسب دون تفكير.",
  "Native webview playback. Smooth and integrated, but limited codec coverage.":
    "تشغيل أصلي عبر webview. سلس ومتكامل، لكن تغطية الترميز محدودة.",
  "Bundled with Harbor. Plays anything you throw at it.": "مُضمّن مع Harbor. يشغّل أي شيء تعطيه إياه.",
  "Embed mpv inside Harbor window": "تضمين mpv داخل نافذة Harbor",
  "Renders mpv inline so playback lives in Harbor itself. Disable to open it in a separate window instead.":
    "يعرض mpv داخليًا ليكون التشغيل في Harbor نفسه. عطّله لفتحه في نافذة منفصلة بدلًا من ذلك.",
  "HDR-to-SDR tonemapping": "تحويل ألوان HDR إلى SDR",
  "Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.":
    "يحوّل مصادر HDR إلى SDR باستخدام bt.2446a. موصى به على شاشات SDR.",
  "HDR in a separate window": "HDR في نافذة منفصلة",
  "Plays HDR content in its own window so Windows treats it as true HDR (the SDR brightness slider stops dimming it). Turn off HDR-to-SDR tonemapping above to use this on an HDR display.":
    "يشغّل محتوى HDR في نافذته الخاصة ليعامله Windows كـ HDR حقيقي (يتوقّف شريط سطوع SDR عن تعتيمه). عطّل تحويل ألوان HDR إلى SDR أعلاه لاستخدام هذا على شاشة HDR.",
  "HDR display mode": "وضع عرض HDR",
  "Keeps Harbor embedded but lifts the HDR video onto its own opaque plane with the controls floating above, so Windows shows true HDR without the brightness slider dimming it. Needs HDR-to-SDR tonemapping off.":
    "يبقي Harbor مضمّنًا لكنه يرفع فيديو HDR إلى مستواه المعتم الخاص مع طفو عناصر التحكّم فوقه، ليعرض Windows HDR حقيقيًا دون أن يعتّمه شريط السطوع. يتطلب إيقاف تحويل ألوان HDR إلى SDR.",
  Always: "دائمًا",
  "Line-free video mode": "وضع فيديو بلا خطوط",
  "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer (this mode bypasses the HDR display path). Leave OFF unless you see that line. Restart playback to apply.":
    "يفرض وضع عرض متوافق يزيل خطًا ساطعًا رفيعًا تُظهره بعض الشاشات عند حافة الشاشة. آثار جانبية: قد يتحول تشغيل 4K إلى عرض شرائح ويبدو محتوى HDR أكثر تعتيمًا (يتجاوز هذا الوضع مسار عرض HDR). اتركه معطّلًا ما لم ترَ ذلك الخط. أعد تشغيل التشغيل للتطبيق.",
  "Motion smoothing": "تنعيم الحركة",
  "Interpolates frames for smoother panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. mpv only.":
    "يستوفي الإطارات لتحريك أنعم، أفضل في الأنمي. يتطلب معدّل تحديث شاشة أعلى من معدّل إطارات الفيديو، وقد يتقطّع على بطاقات الرسوم الضعيفة. mpv فقط.",
  "Direct torrent streaming": "بثّ التورنت المباشر",
  "When you have no debrid set up, or a torrent isn't cached, stream it straight from the bundled engine on localhost:11470. This connects to peers over your own connection, the same way Stremio's built-in streaming does.":
    "عندما لا يكون لديك Debrid معدّ، أو لا يكون التورنت مخزّنًا، ابثّه مباشرةً من المحرك المضمّن على localhost:11470. يتصل هذا بالأقران عبر اتصالك الخاص، تمامًا كما يفعل بثّ Stremio المدمج.",
  "Use Harbor's built-in engine (beta)": "استخدام محرك Harbor المدمج (تجريبي)",
  "Stream torrents through Harbor's own Rust peer-to-peer engine instead of the bundled Stremio Server. Falls back automatically if it can't connect. Status and a self-test live in the Local engine card below.":
    "ابثّ التورنت عبر محرك Harbor الخاص بلغة Rust للنظير إلى النظير بدلًا من خادم Stremio المضمّن. يرجع تلقائيًا إن تعذّر الاتصال. الحالة واختبار ذاتي موجودان في بطاقة المحرك المحلي أدناه.",
  "Always re-encode when casting (recommended)": "إعادة الترميز دائمًا عند البثّ (موصى به)",
  "On by default. Pipes every cast through ffmpeg as H.264 + AAC + MPEG-TS so Samsung, LG, Sony, and other DLNA TVs accept the stream regardless of source codec. Turn off only if you have a beefy receiver that handles raw HEVC/DTS and want max quality. Requires ffmpeg in PATH.":
    "مفعّل افتراضيًا. يمرّر كل بثّ عبر ffmpeg كـ H.264 + AAC + MPEG-TS لتقبل تلفزيونات Samsung وLG وSony وغيرها من تلفزيونات DLNA البثّ بغض النظر عن ترميز المصدر. عطّله فقط إن كان لديك مستقبِل قوي يتعامل مع HEVC/DTS الخام وتريد أقصى جودة. يتطلب ffmpeg في PATH.",
  "Sharper lines and cleaner gradients on anime, in real time. One-tap setup below.":
    "خطوط أحدّ وتدرّجات أنظف على الأنمي، في الوقت الفعلي. إعداد بنقرة واحدة أدناه.",
  "Disabled while strict remote streaming is on": "معطّل أثناء تفعيل البثّ البعيد الصارم",

  "Custom location": "موقع مخصّص",
  "System default": "افتراضي النظام",
  "Detecting...": "جارٍ الكشف...",
  Open: "فتح",
  "Choose folder": "اختيار مجلد",

  "Drop shadow": "ظلّ مُسقط",
  "Soft halo around the text. Cleanest on most content.": "هالة ناعمة حول النص. الأنظف على معظم المحتوى.",
  Outline: "حدّ خارجي",
  "Hard stroke around each letter. High contrast.": "خطّ صلب حول كل حرف. تباين عالٍ.",
  "Black bar": "شريط أسود",
  "Rounded background panel behind the text. Most readable.": "لوحة خلفية مدوّرة خلف النص. الأكثر قابلية للقراءة.",
  Left: "يسار",
  Center: "وسط",
  Right: "يمين",
  "Keep original": "إبقاء الأصل",
  "Styled (ASS) subs keep their own fonts, colors, and effects. Truest to the release.":
    "تحتفظ الترجمات المنسّقة (ASS) بخطوطها وألوانها وتأثيراتها. الأقرب إلى الإصدار.",
  "Resize only": "تغيير الحجم فقط",
  "Keep the original look but apply your size and position.": "أبقِ المظهر الأصلي لكن طبّق حجمك وموضعك.",
  "Use my style": "استخدام نمطي",
  "Force your font, size, and color onto styled subs. Use this for Arabic or any subs showing boxes. Can affect karaoke and signs.":
    "افرض خطّك وحجمك ولونك على الترجمات المنسّقة. استخدم هذا للعربية أو أي ترجمات تظهر مربّعات. قد يؤثّر في الكاريوكي واللافتات.",
  "Styled (ASS) subtitles": "الترجمات المنسّقة (ASS)",
  "Seeing empty boxes instead of letters? Choose Arabic under Font and switch to Use my style.":
    "ترى مربّعات فارغة بدل الحروف؟ اختر العربية تحت الخط وبدّل إلى استخدام نمطي.",
  "Background opacity": "عتامة الخلفية",
  "Outline thickness": "سُمك الحدّ الخارجي",
  "Bold text": "نص عريض",
  "Render subtitles in a heavier weight. Turn off to use your font's normal weight.":
    "اعرض الترجمات بوزن أثقل. عطّله لاستخدام الوزن العادي لخطّك.",
  "Show subtitles in Picture-in-Picture": "إظهار الترجمات في صورة داخل صورة",
  "Hide subtitles when the player shrinks into the floating PiP window.":
    "إخفاء الترجمات عندما يتقلّص المشغّل إلى نافذة صورة داخل صورة العائمة.",
  Opacity: "العتامة",
  "Distance from bottom": "المسافة من الأسفل",
  Alignment: "المحاذاة",
  "Text color": "لون النص",
  "Outline color": "لون الحدّ الخارجي",
  "Box color": "لون المربّع",
  Reset: "إعادة التعيين",
  "Reset to defaults": "إعادة التعيين إلى الافتراضيات",
  Font: "الخط",
  Rounded: "مدوّر",
  Serif: "مذيّل",
  Arabic: "عربي",
  "{n} custom": "{n} مخصّص",
  "Remove {name}": "إزالة {name}",
  "Upload font": "رفع خط",
  "Delete this font?": "حذف هذا الخط؟",
  "will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "سيُزال من Harbor. وأي شيء ضبطته لاستخدامه سيرجع إلى Inter.",
  Cancel: "إلغاء",
  Delete: "حذف",

  "Show thumbnail preview on hover": "إظهار معاينة مصغّرة عند التمرير",
  "Generates a frame on the fly as you scrub the seek bar. Works on debrid streams and local files.":
    "يولّد إطارًا فوريًا أثناء سحبك لشريط التقديم. يعمل على بثوث Debrid والملفات المحلية.",
  "Bar style": "نمط الشريط",
  "Solid fill, no texture. Cleanest baseline.": "تعبئة صلبة بلا ملمس. الأساس الأنظف.",
  Glass: "زجاج",
  "Subtle Apple-like sheen on the filled portion.": "لمعان خفيف يشبه Apple على الجزء المملوء.",
  Pinstripe: "خطوط رفيعة",
  "Diagonal stripes across the fill, retro vibe.": "خطوط قطرية عبر التعبئة، بطابع كلاسيكي.",
  Rainbow: "قوس قزح",
  "Six horizontal stripes. Pairs with nyan cat dot.": "ستة خطوط أفقية. تتناسب مع نقطة قطة نيان.",
  "Image bar active. Pick a style above to switch back, or clear the image below.":
    "شريط الصورة مفعّل. اختر نمطًا أعلاه للعودة، أو امسح الصورة أدناه.",
  "Bar height": "ارتفاع الشريط",
  "Bar color": "لون الشريط",
  "Default (gold accent)": "افتراضي (تمييز ذهبي)",
  "Bar image": "صورة الشريط",
  "Upload a pattern to tile across the bar": "ارفع نمطًا ليتكرّر عبر الشريط",
  "Tiles horizontally; the bar's height crops it vertically. Animated GIFs up to 2 MB play.":
    "يتكرّر أفقيًا؛ ويقصّه ارتفاع الشريط عموديًا. تعمل صور GIF المتحرّكة حتى 2 ميجابايت.",
  "Seek dot shape": "شكل نقطة التقديم",
  Circle: "دائرة",
  "The default round dot.": "النقطة المستديرة الافتراضية.",
  Square: "مربّع",
  "Rounded square in the same color.": "مربّع مدوّر باللون نفسه.",
  "Custom image": "صورة مخصّصة",
  "PNG, GIF, WebP, or SVG. Animated GIFs play.": "PNG أو GIF أو WebP أو SVG. تعمل صور GIF المتحرّكة.",
  "No dot, just the bar.": "بلا نقطة، فقط الشريط.",
  "Image size": "حجم الصورة",
  "Dot size": "حجم النقطة",
  "Dot image": "صورة النقطة",
  "Upload nyan cat, a sticker, anything": "ارفع قطة نيان أو ملصقًا أو أي شيء",
  "PNG, JPEG, WebP, or SVG (auto-shrunk if huge). Animated GIFs up to 2 MB play live.":
    "PNG أو JPEG أو WebP أو SVG (يُصغّر تلقائيًا إن كان ضخمًا). تعمل صور GIF المتحرّكة حتى 2 ميجابايت مباشرةً.",

  "Desktop only": "سطح المكتب فقط",
  "Local engine": "المحرك المحلي",
  "Built-in peer-to-peer streaming, served from your own machine.":
    "بثّ مدمج من النظير إلى النظير، يُقدَّم من جهازك الخاص.",
  Running: "قيد التشغيل",
  Stopped: "متوقّف",
  Error: "خطأ",
  Port: "المنفذ",
  "Active torrents": "التورنتات النشطة",
  "Run self-test": "تشغيل الاختبار الذاتي",
  "Running self-test": "جارٍ الاختبار الذاتي",
  "Restart engine": "إعادة تشغيل المحرك",
  Restarting: "جارٍ إعادة التشغيل",
  "Self-test is disabled while strict remote streaming is on. It downloads a test torrent over peer-to-peer on this machine.":
    "الاختبار الذاتي معطّل أثناء تفعيل البثّ البعيد الصارم. فهو ينزّل تورنت اختبار عبر النظير إلى النظير على هذا الجهاز.",
  "Self-test": "اختبار ذاتي",
  Pass: "نجاح",
  Fail: "فشل",

  "Remote streaming server": "خادم بثّ بعيد",
  "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.":
    "وجّه Harbor إلى خادم بثّ على جهاز آخر، مثل خدمة Stremio على خادم منزلي. تُنزّل التورنتات وتُبثّ من ذلك الجهاز بدلًا من هذا.",
  Checking: "جارٍ التحقّق",
  Unreachable: "غير قابل للوصول",
  Forget: "نسيان",
  "Use exclusively (never fall back to local)": "الاستخدام حصريًا (عدم الرجوع إلى المحلي أبدًا)",
  "If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.":
    "إن كان الخادم غير قابل للوصول، يفشل التشغيل بدلًا من البثّ محليًا. استخدم هذا عندما تعمل VPN على جهاز الخادم ويجب ألّا تغادر حركة التورنت هذا الجهاز أبدًا.",
  "Probes the server's settings endpoint from this device.": "يفحص نقطة إعدادات الخادم من هذا الجهاز.",
  Testing: "جارٍ الاختبار",
  "Run test": "تشغيل الاختبار",
  "Server reachable": "الخادم قابل للوصول",
  "Test failed": "فشل الاختبار",
  "The server answered with status {status}. Is that a streaming server?":
    "أجاب الخادم بالحالة {status}. هل هذا خادم بثّ؟",
  "Server reachable in {ms}ms. Harbor will use it for torrent streaming.":
    "الخادم قابل للوصول خلال {ms} مللي ثانية. سيستخدمه Harbor لبثّ التورنت.",
  "Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.":
    "تعذّر الوصول إلى الخادم خلال 1.5 ثانية. تحقّق من العنوان ومن أن جهاز الخادم متصل.",

  "No limit": "بلا حدّ",
  "Internet speed": "سرعة الإنترنت",
  "Pick the cap your link can sustain. Run a real speed test if you need a number.":
    "اختر الحدّ الذي يتحمّله اتصالك. أجرِ اختبار سرعة حقيقيًا إن احتجت رقمًا.",
  "No filter. All bitrates considered equally.": "بلا تصفية. تُعامَل كل معدّلات البتّ بالتساوي.",
  "Streams over {cap} Mbps will rank lower, even when cached.":
    "تأتي البثوث التي تتجاوز {cap} ميجابت/ثانية في ترتيب أدنى، حتى عند تخزينها.",

  "Home layout": "تخطيط الرئيسية",
  "How the Home page assembles its rails.": "كيف تجمّع الصفحة الرئيسية صفوفها.",
  "Harbor curated": "تنسيق Harbor",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.":
    "عرض رئيسي دوّار، وأفضل 10، والرائج، وفي دور العرض، وصفوف لكل خدمة. تُضاف كتالوجات الإضافات أسفلها، بلا تكرار.",
  "Classic Stremio": "Stremio الكلاسيكي",
  "Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.":
    "متابعة المشاهدة، ثم إضافاتك المثبّتة. يُعرض كل كتالوج كصفّ خاص به، بترتيب التثبيت، بلا إزالة تكرار، بلا عرض رئيسي.",
  "Show every addon row": "إظهار كل صفّ إضافة",
  "Watchlist shows only saved titles": "تعرض قائمة المشاهدة العناوين المحفوظة فقط",
  "Advance Continue Watching to the next episode": "تقديم متابعة المشاهدة إلى الحلقة التالية",
  "Keep frames for": "الاحتفاظ بالإطارات لمدة",
  None: "بلا",
  "1 week": "أسبوع واحد",
  "30 days": "30 يومًا",
  "3 months": "3 أشهر",
  "6 months": "6 أشهر",
  "1 year": "سنة واحدة",
  "Clear all saved frames": "مسح كل الإطارات المحفوظة",
  "{n} frame stored. Wiping rebuilds them next time you watch.":
    "{n} إطار مخزّن. يعيد المسح بناءها في المرة القادمة التي تشاهد فيها.",
  "{n} frames stored. Wiping rebuilds them next time you watch.":
    "{n} إطار مخزّن. يعيد المسح بناءها في المرة القادمة التي تشاهد فيها.",
  "No frames stored yet. They'll appear here as you watch things.":
    "لا إطارات مخزّنة بعد. ستظهر هنا أثناء مشاهدتك للأشياء.",
  "Confirm clear": "تأكيد المسح",
  "Clear all": "مسح الكل",
  "How to get this": "كيفية الحصول على هذا",
  "Card overlays": "تراكبات البطاقة",
  "Fresh tomato for 60%+, splat for under.": "طماطم طازجة لـ 60% فأكثر، ورشّة لما دون ذلك.",
  "RPDB key above, https://btttr.cc, or a {imdbId} template": "مفتاح RPDB أعلاه، أو https://btttr.cc، أو قالب {imdbId}",
  "Hide titles under posters": "إخفاء العناوين أسفل الملصقات",
  "Cleaner grid when your poster service already prints the title on the artwork.":
    "شبكة أنظف عندما تطبع خدمة الملصقات لديك العنوان على العمل الفنّي بالفعل.",
  "Add a TMDB key above to unlock this.": "أضف مفتاح TMDB أعلاه لفتح هذا.",
  "Add an OMDb key above to unlock this.": "أضف مفتاح OMDb أعلاه لفتح هذا.",
  "Hover preview": "معاينة بالتمرير",
  "Rest the cursor on a poster to peek at the rating, runtime, and story without opening it.":
    "أبقِ المؤشّر على ملصق لإلقاء نظرة على التقييم والمدة والقصة دون فتحه.",
  Top: "الأعلى",
  "Floats over the artwork": "يطفو فوق العمل الفنّي",
  Bottom: "الأسفل",
  "Sits above the title strip": "يقع فوق شريط العنوان",

  "Title text": "نص العنوان",
  "Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.":
    "غيّر حجم عناوين الصفوف في الرئيسية والعنوان المعروض في المشغّل، دون تغيير حجم بقية الواجهة. ويمكنك أيضًا بدء عنوان المشغّل باسم المسلسل بدلًا من الحلقة.",
  "Row titles": "عناوين الصفوف",
  "Player title": "عنوان المشغّل",
  "Show series name first in the player": "إظهار اسم المسلسل أولًا في المشغّل",
  "Lead with the show name instead of the episode title at the top of the player.":
    "ابدأ باسم العمل بدلًا من عنوان الحلقة في أعلى المشغّل.",

  "Block ads & trackers": "حظر الإعلانات والمتعقّبات",
  "{n} tracker request blocked this session. Harbor itself sends zero telemetry.":
    "حُظر {n} طلب تعقّب في هذه الجلسة. ولا يرسل Harbor نفسه أي قياسات.",
  "{n} tracker requests blocked this session. Harbor itself sends zero telemetry.":
    "حُظر {n} طلب تعقّب في هذه الجلسة. ولا يرسل Harbor نفسه أي قياسات.",
  "Watching for ad, analytics, and tracking requests. Harbor itself sends zero telemetry.":
    "يراقب طلبات الإعلانات والتحليلات والتعقّب. ولا يرسل Harbor نفسه أي قياسات.",
  "Ad, analytics, and tracking requests pass through untouched.": "تمرّ طلبات الإعلانات والتحليلات والتعقّب دون تغيير.",

  "Close to the system tray": "الإغلاق إلى علبة النظام",
  "Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.":
    "يدسّ إغلاق النافذة Harbor في العلبة بدلًا من الإنهاء، ليُعاد فتحه فورًا. انقر بزرّ الفأرة الأيمن على أيقونة العلبة للتحكّم السريع، أو اختر إنهاء للخروج كليًا.",
  "Always on top": "دائمًا في المقدّمة",
  "Keep the Harbor window above other windows.": "أبقِ نافذة Harbor فوق النوافذ الأخرى.",
  "Pause when minimized": "الإيقاف المؤقّت عند التصغير",
  "Stop playback when you minimize Harbor or send it to the tray.":
    "أوقف التشغيل عند تصغيرك Harbor أو إرساله إلى العلبة.",
  "Pause when unfocused": "الإيقاف المؤقّت عند فقد التركيز",
  "Stop playback whenever another window takes focus.": "أوقف التشغيل كلّما أخذت نافذة أخرى التركيز.",

  "Export everything": "تصدير كل شيء",
  "Saves your whole Harbor setup to one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "يحفظ إعداد Harbor بالكامل في ملف واحد: السمة وتخطيط الرئيسية والإعدادات والإضافات والملفات الشخصية وقائمة المشاهدة وتخطيطات المشغّل وتقدّم المشاهدة والمزيد. يُترك تسجيل دخولك إلى Stremio خارجًا عمدًا.",
  Export: "تصدير",
  "Restore from a backup": "الاستعادة من نسخة احتياطية",
  "Loads a backup file and replaces your current setup with it. Perfect for a new computer. Your Stremio sign-in on this device stays as is.":
    "يحمّل ملف نسخة احتياطية ويستبدل إعدادك الحالي به. مثالي لحاسوب جديد. يبقى تسجيل دخولك إلى Stremio على هذا الجهاز كما هو.",
  Restore: "استعادة",
  "Could not build the backup file.": "تعذّر بناء ملف النسخة الاحتياطية.",
  "Could not read that file.": "تعذّرت قراءة ذلك الملف.",
  "an unknown date": "تاريخ غير معروف",
  "Restore this backup?": "استعادة هذه النسخة الاحتياطية؟",
  "This replaces your current Harbor setup (theme, home layout, settings, addons, profiles, and more) with the {n} saved entries in this file. Your Stremio sign-in stays as is. Harbor reloads when it finishes.":
    "يستبدل هذا إعداد Harbor الحالي (السمة وتخطيط الرئيسية والإعدادات والإضافات والملفات الشخصية والمزيد) بالمدخلات المحفوظة البالغة {n} في هذا الملف. يبقى تسجيل دخولك إلى Stremio كما هو. يُعيد Harbor التحميل عند الانتهاء.",
  "Saved {when} from Harbor {app}.": "حُفظ في {when} من Harbor {app}.",
  "Restoring...": "جارٍ الاستعادة...",
  "Restore and reload": "الاستعادة وإعادة التحميل",

  "Get beta updates": "الحصول على التحديثات التجريبية",
  "Receive early builds with the newest fixes before they reach the stable release. Betas can be rough around the edges; switch this off to return to stable at the next update.":
    "تلقَّ إصدارات مبكّرة بأحدث الإصلاحات قبل وصولها إلى الإصدار المستقرّ. قد تكون النسخ التجريبية غير مصقولة؛ عطّل هذا للعودة إلى المستقرّ في التحديث القادم.",
  "Catch stremio:// install links inside Harbor": "التقاط روابط التثبيت ‎stremio://‎ داخل Harbor",
  "Harbor's in-app installer animates the manifest install and keeps you in context. Anything Harbor installs is also synced to your Stremio account, so the official app stays the canonical library. Turn this off and Stremio becomes the only handler for stremio:// links; Harbor still installs anything you trigger from inside the app (Configure & install, paste, drag-and-drop).":
    "يحرّك مُثبّت Harbor داخل التطبيق تثبيت البيان ويبقيك في السياق. يتزامن أي شيء يثبّته Harbor أيضًا مع حساب Stremio الخاص بك، ليبقى التطبيق الرسمي المكتبة المعتمدة. عطّل هذا فيصبح Stremio المعالج الوحيد لروابط ‎stremio://‎؛ ويظل Harbor يثبّت أي شيء تطلقه من داخل التطبيق (الإعداد والتثبيت، اللصق، السحب والإفلات).",
  "Heads up: if Stremio is also installed, Windows may ask which app to use the first time a stremio:// link fires. Pick Harbor to make it stick.":
    "تنبيه: إن كان Stremio مثبّتًا أيضًا، فقد يسأل Windows عن أي تطبيق تستخدمه في أول مرة يُطلق فيها رابط ‎stremio://‎. اختر Harbor ليثبت ذلك.",
  "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.":
    "تُفتح روابط ‎stremio://‎ الآن في تطبيق Stremio. ولن يثبّت Harbor إلا عندما تطلقه من داخل Harbor.",
  "Checking harbor.site for a newer build.": "يتحقّق من harbor.site بحثًا عن إصدار أحدث.",
  "Downloading {pct}%": "جارٍ التنزيل {pct}%",
  "Downloaded. Ready to install and restart.": "تم التنزيل. جاهز للتثبيت وإعادة التشغيل.",
  "Installing. Harbor will restart.": "جارٍ التثبيت. سيُعاد تشغيل Harbor.",
  "A new version is ready to download.": "إصدار جديد جاهز للتنزيل.",
  "You're on the latest version.": "أنت على أحدث إصدار.",
  "Couldn't reach the update server. Try again in a moment.": "تعذّر الوصول إلى خادم التحديث. حاول مجددًا بعد لحظة.",
  "Harbor checks automatically every few hours.": "يتحقّق Harbor تلقائيًا كل بضع ساعات.",
  "Harbor {version} available": "Harbor {version} متاح",
  "Update now": "التحديث الآن",
  "Check for updates": "التحقّق من التحديثات",
  "Show on Discord": "الإظهار على Discord",
  "Display what you are watching on your Discord profile, with the show poster and a live progress bar. Requires the Discord desktop app to be running.":
    "اعرض ما تشاهده في ملفّك الشخصي على Discord، مع ملصق العمل وشريط تقدّم مباشر. يتطلب تشغيل تطبيق Discord لسطح المكتب.",
  "Hide the title": "إخفاء العنوان",
  "Show 'Watching something' with no show name or poster.": "اعرض «يشاهد شيئًا» بلا اسم عمل أو ملصق.",
  "Show while paused": "الإظهار أثناء الإيقاف المؤقّت",
  "Keep the presence visible when playback is paused.": "أبقِ الحضور ظاهرًا عند إيقاف التشغيل مؤقّتًا.",
  "Show while browsing": "الإظهار أثناء التصفّح",
  "Display 'Browsing Harbor' when nothing is playing.": "اعرض «يتصفّح Harbor» عندما لا يكون هناك تشغيل.",
  "Show poster": "إظهار الملصق",
  "Reveal the show or movie artwork. Off keeps the title but hides the poster.":
    "أظهر العمل الفنّي للعمل أو الفيلم. يبقي الإيقاف العنوان لكنه يخفي الملصق.",
  "Show elapsed time": "إظهار الوقت المنقضي",
  "Display the live progress bar showing how far into the title you are.":
    "اعرض شريط التقدّم المباشر الذي يبيّن مدى تقدّمك في العنوان.",
  "Watch party join button": "زرّ الانضمام إلى حفلة المشاهدة",
  "Add a Join button with your room link while you're in a watch party.":
    "أضف زرّ انضمام مع رابط غرفتك أثناء وجودك في حفلة مشاهدة.",
  "And for the naughty ones: browsing or rating an adult addon never shows on Discord.":
    "وللأشقياء: لا يظهر تصفّح أو تقييم إضافة للبالغين على Discord أبدًا.",
  "OMDB daily budget": "ميزانية OMDB اليومية",
  "Save an OMDB key in Library & metadata to enable rating fetches.":
    "احفظ مفتاح OMDB في المكتبة والبيانات الوصفية لتمكين جلب التقييمات.",
  "Key rejected. Check it on Library & metadata.": "رُفض المفتاح. تحقّق منه في المكتبة والبيانات الوصفية.",
  "{used} / {limit} requests today.": "{used} / {limit} طلب اليوم.",
  "Budget exhausted, resets at midnight UTC.": "نفدت الميزانية، تُعاد عند منتصف الليل بتوقيت UTC.",
  "Reset counter": "إعادة تعيين العدّاد",
  "Replay walkthrough": "إعادة تشغيل الجولة التعريفية",
  "Re-runs the welcome flow and clears every dismissed tip.": "يعيد تشغيل تدفّق الترحيب ويمسح كل تلميح مرفوض.",
  Done: "تم",
  Replay: "إعادة التشغيل",
  "Restore dismissed hints": "استعادة التلميحات المرفوضة",
  "Brings back the small in-app tips you've dismissed without redoing the welcome flow.":
    "يعيد التلميحات الصغيرة داخل التطبيق التي رفضتها دون إعادة تدفّق الترحيب.",
  Restored: "تمت الاستعادة",
  Version: "الإصدار",
  Build: "الإصدار البنائي",
  "Desktop (Tauri 2 / WebView2)": "سطح المكتب (Tauri 2 / WebView2)",
  Web: "الويب",
  "Bug reports": "بلاغات الأخطاء",
  "Repair library": "إصلاح المكتبة",
  "Sign in to Stremio first. The repair scans only the active profile's library.":
    "سجّل الدخول إلى Stremio أولًا. يفحص الإصلاح مكتبة الملف الشخصي النشط فقط.",
  "Failed: {error}": "فشل: {error}",
  "Library is empty. Nothing to repair.": "المكتبة فارغة. لا شيء لإصلاحه.",
  "{repaired} fixed, {clean} already clean": "أُصلح {repaired}، {clean} نظيف بالفعل",
  ", {n} unrepairable": "، {n} غير قابل للإصلاح",
  "Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Harbor synced playback.":
    "يعيد كتابة كل عنصر مكتبة ليطابق مخطط Stremio الدقيق. شغّله مرة إن بدأ تطبيق Stremio بالتعطّل بعد مزامنة Harbor للتشغيل.",
  "Fetching {n} items…": "جارٍ جلب {n} عنصر…",
  "Fetching library index…": "جارٍ جلب فهرس المكتبة…",
  "{n} items need repair.": "{n} عنصر يحتاج إصلاحًا.",
  "Checking {n} items…": "جارٍ فحص {n} عنصر…",
  "Pushing {pushed} of {total}…": "جارٍ دفع {pushed} من {total}…",
  "Done.": "تم.",
  "Working…": "جارٍ العمل…",
  "Run again": "تشغيل مجددًا",
  "Repair now": "إصلاح الآن",
  "Web build": "إصدار الويب",
  "Where your data lives": "أين تقيم بياناتك",
  "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.":
    "كل ما تحفظه هنا يبقى في هذا المتصفّح. تسجيل دخولك إلى Stremio ومفاتيح API وتقدّم المشاهدة وذاكرة الأداة المؤقّتة والتلميحات المرفوضة. لا ترى خوادم Harbor أيًا منها أبدًا. ومسح بيانات متصفّحك يمحوها.",
  "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.":
    "لا يستطيع إصدار الويب تشغيل mpv أو مولّد trickplay أو مسبار النطاق الترددي المحلي أو مُرحّل Cloudflare الخاص بك. إن أردت تمرير HDR وصوت TrueHD أو DTS-HD وتقديمًا أنعم، فاحصل على تطبيق سطح المكتب.",
  "Get Harbor for desktop": "احصل على Harbor لسطح المكتب",
  "Source code": "الشِفرة المصدرية",

  "Your relay is live": "مُرحّلك مباشر",
  "Connected to relay": "متصل بالمُرحّل",
  "Watch Together": "المشاهدة الجماعية",
  "Synchronizes playback state between participants in the same room.":
    "يزامن حالة التشغيل بين المشاركين في الغرفة نفسها.",
  "Test connection": "اختبار الاتصال",
  "Pings your Worker at /health to confirm it's reachable from this device.":
    "يرسل اختبارًا إلى عاملك على /health للتأكّد من إمكانية الوصول إليه من هذا الجهاز.",
  "Testing…": "جارٍ الاختبار…",
  "Relay version {version}. Update available.": "إصدار المُرحّل {version}. يتوفّر تحديث.",
  unknown: "غير معروف",
  "Relay is current (v{version}).": "المُرحّل محدّث (الإصدار {version}).",
  "Harbor's public relay updates automatically; nothing to do.": "يتحدّث مُرحّل Harbor العام تلقائيًا؛ لا شيء عليك فعله.",
  "Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.":
    "أعد النشر لالتقاط أحدث إصلاحات المشاهدة الجماعية. تختفي اللافتة داخل التطبيق بمجرّد أن يصبح الإصدار الجديد مباشرًا.",
  "Running the latest Watch Together protocol.": "يشغّل أحدث بروتوكول للمشاهدة الجماعية.",
  Redeploy: "إعادة النشر",
  "Redeploy instructions": "تعليمات إعادة النشر",
  "Backup credentials": "نسخ بيانات الاعتماد احتياطيًا",
  "Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.":
    "تعرض Cloudflare رموز API مرة واحدة فقط. احفظ نسخة الآن وإلا فقدت القدرة على إيقاف هذا المُرحّل أو إعادة نشره من Harbor.",
  "Relay verified end-to-end": "تم التحقّق من المُرحّل من طرف إلى طرف",
  "Relay test failed": "فشل اختبار المُرحّل",
  "Redeploy relay": "إعادة نشر المُرحّل",
  "Stopping…": "جارٍ الإيقاف…",
  "Stop relay": "إيقاف المُرحّل",
  "Forget URL": "نسيان الرابط",
  "Use a different URL": "استخدام رابط مختلف",
  "Deploy mine instead": "نشر مُرحّلي بدلًا من ذلك",
  "Deploy a relay": "نشر مُرحّل",
  "Deploy a relay (desktop only)": "نشر مُرحّل (سطح المكتب فقط)",
  "Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.":
    "يتطلب نشر المُرحّل واجهة Cloudflare API، وهي غير متاحة لعملاء المتصفّح. استخدم إصدار سطح المكتب لنشر عامل، ثم أدخل الرابط الناتج أدناه.",
  "Enter an existing relay URL:": "أدخل رابط مُرحّل موجود:",
  "Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.":
    "أدخل فقط روابط المُرحّلات التي تشغّلها أو تثق بها. لا يحمل المُرحّل سوى رسائل مزامنة المشاهدة الجماعية (تشغيل، إيقاف مؤقّت، تقديم). ولا يمرّ عبره شيء آخر.",
  "Hit your daily quota? Use Harbor's public relay, or host your own.":
    "بلغت حصّتك اليومية؟ استخدم مُرحّل Harbor العام، أو استضِف مُرحّلك الخاص.",
  "Use Harbor's public relay": "استخدام مُرحّل Harbor العام",
  "Documentation: run your own relay": "الوثائق: شغّل مُرحّلك الخاص",

  "Install failed": "فشل التثبيت",
  debrid: "Debrid",
  "Installed via {label}": "مُثبّت عبر {label}",
  "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.":
    "احفظ مفتاح Debrid أعلاه (TorBox أو Real-Debrid أو AllDebrid أو Premiumize أو Debrid-Link) لتمكين هذا.",
  Remove: "إزالة",
  Install: "تثبيت",
  Installed: "مُثبّت",
  Configure: "إعداد",
  "Couldn't install. Double-check the URL and try again.": "تعذّر التثبيت. تحقّق من الرابط وحاول مجددًا.",
  "Paste the manifest URL the configure page gave you": "الصق رابط البيان الذي أعطته إياك صفحة الإعداد",

  Usenet: "Usenet",
  "View all": "عرض الكل",

  "Where alerts go": "أين تذهب التنبيهات",
  "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Test to send yourself a sample first.":
    "قم بتوصيل Discord أو Telegram وسينشر Harbor رسالة عندما يكون شيء تتابعه على وشك الصدور. اضغط على اختبار لترسل لنفسك عينة أولاً.",
  "What to send": "ماذا سيتم إرساله",
  "Pick which calendars feed your alerts. Items are deduped across sources before sending.":
    "اختر التقويمات التي تغذي تنبيهاتك. تتم إزالة العناصر المكررة عبر المصادر قبل الإرسال.",
  "Media types": "أنواع الوسائط",
  "Filter by type after the sources merge. Leave them all on to send everything.":
    "تصفية حسب النوع بعد دمج المصادر. اتركها جميعاً قيد التشغيل لإرسال كل شيء.",
  AUTOMATIONS: "الأتمتة",

  "Anime tweaks": "تعديلات الأنمي",
  "Anime4K real-time upscaling, smooth motion, and where SVP fits in. All the anime-specific picture enhancements in one place.":
    "ترقية دقة Anime4K في الوقت الفعلي، وتنعيم الحركة، وكيفية استخدام SVP. كل تحسينات الصورة الخاصة بالأنمي في مكان واحد.",
  "Real-time GPU upscaling that sharpens lines and cleans up gradients on anime, built right into Harbor's player. The one-tap setup below grabs the shaders; nothing else to install.":
    "ترقية الدقة في الوقت الفعلي باستخدام كرت الشاشة التي تزيد من حدة الخطوط وتنظف التدرجات في الأنمي، مدمجة مباشرة في مشغل Harbor. إعداد بنقرة واحدة أدناه يجلب المظللات (shaders)؛ لا شيء آخر للتثبيت.",
  "Enable Anime4K": "تفعيل Anime4K",
  "Sharper lines and cleaner gradients on anime, in real time. Heaviest on the graphics card of everything here.":
    "خطوط أكثر حدة وتدرجات أنظف في الأنمي، في الوقت الفعلي. هو الخيار الأثقل على كرت الشاشة من بين كل شيء هنا.",
  "Show Anime4K indicator": "إظهار مؤشر Anime4K",
  "A small badge over the video (with live FPS) that only appears when Anime4K is actually running. Follows your anime-only setting.":
    "شارة صغيرة فوق الفيديو (مع معدل الإطارات المباشر) تظهر فقط عندما يكون Anime4K قيد التشغيل بالفعل. يتبع إعداد الأنمي فقط الخاص بك.",
  "Smooth motion": "حركة سلسة",
  "Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.":
    "يُرسم الأنمي على إطارين أو ثلاثة، لذا قد تتقطع اللقطات السريعة. التنعيم يملأ الفراغات لتنساب الحركة بسلاسة.",
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
    "استيفاء الإطارات المدمج في Harbor. ينعم اللقطات، وهو الأفضل للأنمي. يحتاج إلى معدل تحديث شاشة أعلى من معدل إطارات الفيديو، وقد يتقطع على كروت الشاشة الضعيفة. أخف من SVP.",
  "SVP frame interpolation": "استيفاء الإطارات SVP",
  "Genuine 48/60fps motion on anime, rendered right inside Harbor's player. SVP supplies the engine (VapourSynth + svpflow) and runs in your tray for licensing; Harbor's own player applies the interpolation, so it stays embedded and fully under your control. One-time install, then flip it on.":
    "حركة حقيقية بمعدل 48/60 إطاراً في الثانية للأنمي، يتم تصييرها داخل مشغل Harbor. يوفر SVP المحرك (VapourSynth + svpflow) ويعمل في شريط المهام للترخيص؛ يطبق مشغل Harbor نفسه الاستيفاء، لذلك يبقى مدمجاً وتحت سيطرتك بالكامل. تثبيت لمرة واحدة، ثم قم بتفعيله.",
  "SVP (free)": "SVP (مجاني)",
  "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.":
    "قم بتثبيت SVP مرة واحدة (النسخة المجانية تكفي). يحتوي على VapourSynth + svpflow؛ ويعيد Harbor استخدامهم بدون أي إعدادات إضافية.",
  "Installed and detected. Harbor found its interpolation engine and will drive it directly.":
    "مثبت ومكتشف. وجد Harbor محرك الاستيفاء الخاص به وسيقوم بتشغيله مباشرة.",
  "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.":
    "تم تثبيت SVP ولكن لم يتمكن Harbor من العثور على ملفات المحرك الخاصة به (svpflow + VapourSynth). حاول إصلاح تثبيت SVP، أو أعد فتح SVP مرة واحدة.",
  "Get SVP (free)": "احصل على SVP (مجاني)",
  "Open SVP": "فتح SVP",
  "Enable SVP": "تفعيل SVP",
  "Harbor's player applies the interpolation itself, embedded like normal playback, and starts SVP Manager in the tray for licensing. Restart playback to apply. If video goes black or won't start, turn this off.":
    "يطبق مشغل Harbor الاستيفاء بنفسه، مدمجاً مثل التشغيل العادي، ويبدأ مدير SVP في شريط المهام للترخيص. أعد التشغيل للتطبيق. إذا أصبحت شاشة الفيديو سوداء أو لم تبدأ، قم بإيقاف هذا.",
  "Finish the install above first. Flipping this on now won't do anything until Harbor can find SVP's engine.":
    "أنهِ التثبيت أعلاه أولاً. تفعيل هذا الآن لن يفعل شيئاً حتى يتمكن Harbor من العثور على محرك SVP.",
  "Couldn't start SVP Manager: {err}": "تعذّر بدء مدير SVP: {err}",
  "Couldn't set up SVP: {err}": "تعذّر إعداد SVP: {err}",
  "Anime4K and smooth-motion run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "تعمل Anime4K وتنعيم الحركة على محرك mpv المدمج في تطبيق Harbor للكمبيوتر. ليس لها أي تأثير في المتصفح.",
  "Download the desktop app to use anime enhancements.": "قم بتنزيل تطبيق الكمبيوتر لاستخدام تحسينات الأنمي.",

  "Match the picture quality to your computer, smooth out weak connections, and fine-tune the mpv engine with plain-language controls.":
    "طابق جودة الصورة مع جهازك، ونعّم الاتصالات الضعيفة، واضبط محرك mpv بدقة باستخدام أزرار تحكم بسيطة.",
  "Picture quality": "جودة الصورة",
  "One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.":
    "خيار واحد يحدد مدى جهد جهازك لجعل الفيديو يبدو في أفضل حالاته. اختر الخيار الذي يناسب جهازك. يسري المفعول على المقطع التالي الذي تقوم بتشغيله.",
  "Smooth on weak PCs": "سلس على الأجهزة الضعيفة",
  "Older laptops · low-end · battery · anything that stutters":
    "الأجهزة المحمولة القديمة · الفئة الاقتصادية · البطارية · أي شيء يتقطع",
  "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.":
    "يوقف التكبير والتأثيرات المتقدمة حتى يعمل الفيديو ببساطة. وهو الخيار الأخف على جهازك. اختر هذا إذا تقطع الفيديو أو إذا صدر صوت مرتفع من المروحة.",
  "Most computers · the default": "معظم الأجهزة · الافتراضي",
  "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.":
    "فيديو بمظهر جيد دون إرهاق جهازك. اتركه هنا إلا إذا كان لديك سبب لتغييره.",
  "Maximum quality": "أعلى جودة",
  "Strong desktops with a dedicated graphics card": "أجهزة سطح مكتب قوية مزودة بكرت شاشة منفصل",
  "Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.":
    "ترقية دقة أكثر حدة وتدرجات أكثر نعومة في المشاهد المظلمة، على حساب زيادة الحمل على كرت الشاشة. تجنبه على الحواسيب المحمولة وكروت الشاشة المدمجة.",
  "Hardware acceleration": "تسريع الأجهزة (Hardware acceleration)",
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
    "دع كرت الشاشة يقوم بالعمل الشاق لفك تشفير الفيديو. هذا يوفر البطارية ويحافظ على برودة المعالج. تلقائي هو المناسب للجميع تقريباً؛ قم بالتغيير فقط إذا كان التشغيل يبدو خاطئاً أو لم يبدأ.",
  "Force on": "فرض التشغيل",
  "Off (use CPU)": "إيقاف (استخدام المعالج)",
  "The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.":
    "يقوم المعالج بفك التشفير بالكامل. هذا الخيار الأكثر توافقاً، لكنه يرفع الحرارة وقد يتقطع في دقة 4K. استخدمه فقط إذا واجهت مشاكل في الصورة مع تشغيل تسريع الأجهزة.",
  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.":
    "يفرض تشغيل كرت الشاشة. وهو الخيار الأكثر سلاسة وبرودة، لكن بعض الملفات القديمة أو غير المعتادة قد ترفض التشغيل. عد إلى تلقائي إذا لم يبدأ شيء ما.",
  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.":
    "يستخدم Harbor كرت الشاشة عندما يكون آمناً ويعود لاستخدام المعالج عندما لا يكون كذلك. الخيار الأنسب للجميع تقريباً.",
  "Picture adjustments": "تعديلات الصورة",
  "Nudge the image to taste. Start with a one-tap look below, then fine-tune with the dials. Everything resets cleanly, so you can't break anything.":
    "قم بتعديل الصورة حسب ذوقك. ابدأ بنظرة بنقرة واحدة أدناه، ثم اضبط بدقة باستخدام الأقراص. يتم إعادة تعيين كل شيء بشكل نظيف، لذا لا يمكنك كسر أي شيء.",
  "Brighten dark movies": "تفتيح الأفلام المظلمة",
  "Lifts shadows so the pitch-black scenes are actually watchable.":
    "يرفع الظلال حتى تصبح المشاهد شديدة السواد قابلة للمشاهدة.",
  "Punchier color": "ألوان أكثر حيوية",
  "Richer, more vivid picture with a touch more contrast.": "صورة أغنى وأكثر حيوية مع القليل من التباين الإضافي.",
  "Easy on the eyes": "مريح للعين",
  "Softer and dimmer, kinder for late-night watching.": "أكثر نعومة وخفوتًا، ألطف للمشاهدة في وقت متأخر من الليل.",
  "Crisp (anime & cartoons)": "واضح (أنمي وكرتون)",
  "Sharper lines and a little more pop.": "خطوط أكثر حدة وقليل من البروز.",
  Brightness: "السطوع",
  Contrast: "التباين",
  Saturation: "التشبع",
  "Gamma (midtones)": "جاما (الدرجات المتوسطة)",
  Sharpen: "الحدة",
  "Reset picture": "إعادة تعيين الصورة",
  "Color & HDR": "اللون و HDR",
  "How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.":
    "كيف يضغط Harbor أفلام HDR لتناسب الشاشات العادية. تلقائي هو المناسب للجميع تقريباً؛ المنحنيات أدناه تغير المظهر فقط (حيوي مقابل ناعم). هذا يهم فقط في مصادر HDR.",
  "Tone-mapping curve": "منحنى تعيين النغمات (Tone-mapping)",
  "Auto (recommended)": "تلقائي (موصى به)",
  "Reference (bt.2390)": "مرجعي (bt.2390)",
  "Filmic (Hable)": "سينمائي (Hable)",
  "Balanced (Mobius)": "متوازن (Mobius)",
  "Soft (Reinhard)": "ناعم (Reinhard)",
  "Modern (Spline)": "حديث (Spline)",
  "Boost SDR video toward HDR": "تعزيز فيديو SDR نحو HDR",
  "On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.":
    "على شاشة HDR، يقوم بتوسيع الأفلام العادية (غير HDR) لاستخدام نطاق السطوع الإضافي. اتركه مغلقاً على الشاشات العادية؛ وإلا قد تبدو الألوان باهتة.",
  "Slow or unstable connection": "اتصال بطيء أو غير مستقر",
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
    "إذا استمر الفيديو في التوقف المؤقت للتحميل، أو كنت تستخدم شبكة Wi-Fi غير مستقرة أو خادماً بعيداً، فهذا يمنح Harbor بداية أكبر حتى يتجاوز التشغيل الفترات الصعبة.",
  "Build a bigger buffer": "بناء تخزين مؤقت أكبر",
  "Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.":
    "يقوم بتحميل جزء أكبر من الفيديو مقدماً قبل التشغيل. أكثر سلاسة في الاتصالات الضعيفة، ويستهلك ذاكرة أكثر قليلاً ويستغرق وقتاً أطول للبدء.",
  "For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.":
    "لمكبرات صوت الحواسيب المحمولة وسماعات الرأس. الأفلام الممزوجة بصوت محيطي 5.1 أو 7.1 قد تبدو فارغة أو يكون فيها الحوار منخفضاً على مكبري صوت. هذا يدمجهم معاً بشكل صحيح.",
  "Mix surround sound down to stereo": "دمج الصوت المحيطي إلى ستيريو (Stereo)",
  "Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.":
    "قم بتشغيله إذا كنت تشاهد على حاسوب محمول أو سماعات رأس وكان الحوار يبدو منخفضاً جداً مقارنة بالمؤثرات. اتركه مغلقاً إذا كان لديك إعداد صوت محيطي حقيقي أو مكبر صوت (soundbar).",
  "Advanced (mpv.conf)": "متقدم (mpv.conf)",
  "The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.":
    "مخرج الطوارئ للمستخدمين المتقدمين. خيار mpv واحد لكل سطر بتنسيق مفتاح=قيمة، تماماً مثل mpv.conf. يتم تطبيقها أخيراً، لذا فهي تتجاوز كل الأقراص أعلاه. أي شيء لا يستطيع Harbor قراءته يتم تخطيه، لذلك الخطأ الإملائي لن يكسر التشغيل. أعد التشغيل للتطبيق.",
  "1 option active": "خيار واحد مفعل",
  "{n} options active": "{n} خيارات مفعلة",
  "1 line skipped (not valid)": "تم تخطي سطر واحد (غير صالح)",
  "{n} lines skipped (not valid)": "تم تخطي {n} أسطر (غير صالحة)",
  "Empty. The dials above cover what most people ever need.": "فارغ. الأقراص أعلاه تغطي ما يحتاجه معظم الناس.",
  "Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.":
    "تنبيه: {keys} يمكن أن تقوم بتحميل برامج نصية خارجية أو تفتح مشغلك على الشبكة. احتفظ بها فقط إذا كنت تعرف بالضبط ما تفعله.",
  "See the mpv.conf your dials above generate": "انظر إلى ملف mpv.conf الذي تنشئه الأقراص أعلاه",
  "These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.":
    "هذه تضبط محرك mpv المدمج، والذي يعمل في تطبيق Harbor للكمبيوتر. ليس لها أي تأثير في المتصفح.",
  "Download the desktop app to use video tuning.": "قم بتنزيل تطبيق الكمبيوتر لاستخدام ضبط الفيديو.",

  "Ask to resume or start over": "السؤال عن الاستئناف أو البدء من جديد",
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
    "عند النقر على 'تشغيل' لشيء شاهدت جزءاً منه، اعرض مطالبة لاستئناف المشاهدة من حيث توقفت أو البدء من جديد. يشمل ذلك أيضاً العناصر المتزامنة من Stremio أو Trakt.",
  "Aspect ratio": "نسبة العرض إلى الارتفاع",
  "Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.":
    "شكل الصورة الافتراضي في محرك mpv. 'ملاءمة' تحافظ على المصدر كما هو مع أي أشرطة سوداء؛ أما البقية فتقوم بالتمدد أو القص لملء الشاشة، وهو خيار مفيد للعروض القديمة بنسبة 4:3 على أجهزة التلفاز العريضة.",
  Fit: "ملاءمة",
  Fill: "تعبئة",
  "16:9": "16:9",
  "4:3": "4:3",
  "21:9": "21:9",
  "1.85:1": "1.85:1",
  "2.39:1": "2.39:1",
  "Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.":
    "هل تريد تغيير النسبة أثناء التشغيل؟ زر النسبة المباشر مخفي افتراضياً للحفاظ على ترتيب المشغل.",
  "Turn it on in Player layout": "قم بتفعيله في تخطيط المشغل",
  "Auto-play next episode": "التشغيل التلقائي للحلقة التالية",
  "When an episode ends, automatically start the next one. Off lets the episode finish and stop.":
    "عندما تنتهي الحلقة، ابدأ الحلقة التالية تلقائياً. 'إيقاف' يتيح للحلقة أن تنتهي ثم يتوقف التشغيل.",
  "Show P2P status overlay": "إظهار حالة اتصال P2P (التورنت)",
  "Peers, speed and progress chip on the player during torrent playback. Turn off to keep the player clean.":
    "شريط يوضح عدد النظراء (Peers)، السرعة، والتقدم يظهر على المشغل أثناء تشغيل التورنت. قم بإيقافه للحفاظ على نظافة المشغل.",

  "Source:": "المصدر:",
  "About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "حوالي 200 سطر من JavaScript، بدون أي تبعيات. اقرأه قبل النشر إذا كنت تريد معرفة ما يتم تشغيله.",
  "For the manual path:": "للمسار اليدوي:",
  "20+ and": "الإصدار 20+ و",
  "CLI.": "واجهة سطر الأوامر (CLI).",
  "Generate a Cloudflare API token with": "قم بإنشاء رمز Cloudflare API مميز بصلاحيات",
  and: "و",
  "permissions at": "من",
  "Paste it into Harbor.": "والصقه في Harbor.",
  "Wait for the upload to finish. The relay URL gets written to": "انتظر حتى ينتهي الرفع. يتم كتابة رابط الموزع في",
  "in Harbor settings.": "ضمن إعدادات Harbor.",
  "Save the worker source. Copy": "احفظ مصدر worker. انسخ",
  "from the Harbor repo into a new directory as": "من مستودع Harbor إلى مجلد جديد باسم",
  "Save this": "احفظ هذا",
  "next to it:": "بجانبه:",
  "Note the URL Cloudflare returns. It looks like": "لاحظ الرابط الذي يعيده Cloudflare. يبدو هكذا",
  "In Harbor: Settings, Harbor Relay, then": "في Harbor: الإعدادات، Harbor Relay، ثم",
  "Paste the URL with": "الصق الرابط باستخدام",
  "as the scheme instead of": "كنظام بدلاً من",
  "Settings, Harbor Relay, then": "الإعدادات، Harbor Relay، ثم",
  "The test calls": "يقوم الاختبار باستدعاء",
  "and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "ويؤكد أن worker يمكن الوصول إليه وأنه يشغل إصداراً حالياً. اجتياز الاختبار يعني أن غرف المشاهدة معاً ستتصل.",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique":
    "رابط الموزع قابل للمشاركة. يمكن لأي شخص لديه الرابط الانضمام إلى غرف المشاهدة معاً المستضافة على الموزع الخاص بك. يعمل النطاق الفرعي",
  "subdomain acts as the access token. There is no login.": "الفريد كرمز وصول. لا يوجد تسجيل دخول.",
  "To run a public relay, post the": "لتشغيل موزع عام، انشر رابط",
  "URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay,":
    "على r/Stremio أو أينما يتواجد مجتمعك. يقوم مستخدمو Harbor الآخرون بلصقه في الإعدادات، Harbor Relay،",
  "returns JSON with the worker version. Used by the test button.":
    "يعيد JSON يحتوي على إصدار worker. يُستخدم بواسطة زر الاختبار.",
  "with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "مع ترقية WebSocket: يفتح غرفة المشاهدة معاً. يتم الاحتفاظ بالحالة في Durable Object، بدون استمرارية بعد الجلسة النشطة.",

  "Add Custom Source": "إضافة قسم خارجي",
  "Provide a JSON link or paste it directly.": "أضف رابط JSON أو الصق الكود مباشرة.",
  "JSON URL": "رابط JSON",
  "Paste JSON": "لصق JSON",
  "URL cannot be empty": "الرابط لا يمكن أن يكون فارغاً",
  "Failed to fetch JSON": "فشل جلب ملف JSON",
  "JSON cannot be empty": "JSON لا يمكن أن يكون فارغاً",
  "Invalid SourceRow JSON format": "تنسيق JSON غير صالح",
  "Add Source": "إضافة قسم",
  "Edit Folder Images": "تعديل صور المجموعة",
  "Cover Image URL": "رابط الصورة (Cover Image URL)",
  "Focus GIF URL": "رابط الصورة المتحركة (Focus GIF URL)",
  "Addon not installed": "الإضافة غير مثبتة",
  "This section depends on the addon": "هذا القسم يعتمد على إضافة",
  "You must install this addon in your Stremio account first so Harbor can fetch its works.":
    "يجب عليك تثبيت هذه الإضافة في حساب Stremio الخاص بك أولاً لكي يتمكن Harbor من جلب الأعمال الخاصة بها.",
  "Missing TMDB Key": "مفتاح TMDB مفقود",
  "This section relies on TMDB discovery features.": "يعتمد هذا القسم على ميزات الاكتشاف الخاصة بـ TMDB.",
  "Please add your TMDB API key in the Library & Metadata settings to view this folder.":
    "يرجى إضافة مفتاح TMDB API الخاص بك في إعدادات المكتبة والبيانات الوصفية لعرض هذه المجموعة.",
  OK: "حسناً",
  "Loading...": "جاري التحميل...",
  "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.":
    "قم بجلب قائمة مشاهدتك، ويومياتك، والأفلام التي أعجبتك وقوائمك من ليتربوكسد (Letterboxd) إلى Harbor عبر جسر Stremboxd.",
  "Enable Letterboxd integration": "تفعيل دمج ليتربوكسد (Letterboxd)",
  "Shows your Letterboxd catalogs on the home page and a Letterboxd panel on film pages.":
    "يعرض كتالوجات ليتربوكسد في الصفحة الرئيسية ولوحة ليتربوكسد في صفحات الأفلام.",
  Mode: "الوضع",
  Public: "عام (Public)",
  Full: "كامل (Full)",
  "Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.":
    "الوضع العام يستخدم فقط اسم المستخدم: قائمة المشاهدة، الأفلام المعجب بها، الشائعة وأفضل 250 فيلماً. لا يلزم إدخال كلمة مرور.",
  "Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.":
    "الوضع الكامل يسجل الدخول بكلمة مرور ليتربوكسد لفتح مذكراتك ونشاط أصدقائك وتقييماتك الشخصية. تُرسل كلمة مرورك إلى Stremboxd فقط للحصول على الرمز (Token) — ولا يحفظها Harbor أبدًا.",
  "Letterboxd username": "اسم مستخدم ليتربوكسد",
  "Letterboxd password": "كلمة مرور ليتربوكسد",
  "Your Letterboxd password": "كلمة مرور ليتربوكسد الخاصة بك",
  "Two-factor authentication code": "رمز المصادقة الثنائية (2FA)",
  "Connect / Verify": "ربط / تحقق",
  "Verify & connect": "تحقق وربط",
  "About Stremboxd": "حول Stremboxd",
  "Connected — {n} catalogs available": "متصل — متاح {n} من الكتالوجات",
  "Full mode — diary, friends & ratings enabled": "الوضع الكامل — تفعيل اليوميات، الأصدقاء والتقييمات",
  "Catalogs to show": "الكتالوجات المراد عرضها",
  "Custom lists": "قوائم مخصصة",
  "Remove list": "إزالة القائمة",
  "letterboxd.com/username/list/slug": "letterboxd.com/username/list/slug",
  "Show my rating on movie posters": "إظهار تقييمي على ملصقات الأفلام",
  "Overlays your Letterboxd rating on catalog posters (when available).":
    "يعرض تقييمك في ليتربوكسد على ملصقات الكتالوج (متى توفرت).",
  "Blur reviews by default": "تمويه المراجعات افتراضياً",
  "Reviews on film pages are blurred until you reveal them.": "مراجعات صفحات الأفلام مموهة حتى تطلب إظهارها.",
  "Hidden catalogs": "الكتالوجات المخفية",
  Watchlist: "قائمة المشاهدة",
  Diary: "يوميات",
  "Liked Films": "أفلام أعجبتني",
  Friends: "الأصدقاء",
  "Recommended for You": "مقترح لك",
  "Popular This Week": "الأكثر شعبية هذا الأسبوع",
  "Top 250": "أفضل 250",
  "Could not resolve that Letterboxd list URL.": "لا يمكن جلب رابط قائمة ليتربوكسد هذه.",
  "Choose an avatar": "اختر صورة رمزية",
  "{n} avatars across film, TV, and anime.": "{n} صورة رمزية من الأفلام والتلفزيون والأنمي.",
  "Rights and usage": "الحقوق والاستخدام",
  "Fan-made avatars for personal use. Harbor claims no rights to these characters; they belong to their creators and studios, shown here under fair use. Every one is optimized down to a tiny WebP.":
    "صور رمزية من صنع المعجبين للاستخدام الشخصي. لا تدّعي Harbor أي حقوق على هذه الشخصيات؛ فهي ملك لمبدعيها واستوديوهاتها، وتُعرض هنا ضمن الاستخدام العادل. كل صورة محسّنة إلى ملف WebP صغير.",
  "or use one of our avatars": "أو استخدم إحدى صورنا الرمزية",
  "Random avatar": "صورة رمزية عشوائية",
  "More soon": "المزيد قريباً",
  "More avatars coming soon": "المزيد من الصور الرمزية قريباً",
  "Scroll left": "تمرير لليسار",
  "Scroll right": "تمرير لليمين",
  Preview: "معاينة",
  "Hover to peek": "مرّر للمعاينة",
  Merged: "مدمج",
  "Every row": "كل الصفوف",
  Trending: "رائج",
  Popular: "شائع",
  "Trending · Cinemeta": "رائج · Cinemeta",
  "Popular · AIO": "شائع · AIO",
  "On: addon rails that duplicate the built-ins show too, instead of folding into one.":
    "عند التفعيل: تظهر صفوف الإضافات المكرّرة للصفوف المدمجة أيضاً بدلاً من دمجها في صف واحد.",
  auto: "تلقائي",
  "On: only titles you bookmarked. Off: also keeps the ones Stremio added when you hit play.":
    "عند التفعيل: العناوين التي حفظتها فقط. عند الإيقاف: تشمل أيضاً ما أضافه Stremio عند الضغط على تشغيل.",
  "Adds a Playlists tab to the nav for your M3U and Xtream libraries.":
    "يضيف تبويب قوائم التشغيل إلى الشريط لمكتبات M3U وXtream.",
  "Home · Continue Watching": "الرئيسية · متابعة المشاهدة",
  anime: "أنمي",
  "Anime tab": "تبويب الأنمي",
  "Anime leaves Home Continue Watching and stays in the Anime tab's own row.":
    "يغادر الأنمي متابعة المشاهدة في الرئيسية ويبقى في صف تبويب الأنمي الخاص به.",
  "0m left": "باقٍ 0 د",
  "24m": "24 د",
  "Finish an episode and the card jumps to the next one instead of sitting at 0m left.":
    "أنهِ حلقة لتنتقل البطاقة إلى الحلقة التالية بدلاً من بقائها عند 0 دقيقة متبقية.",
  "Movies you've finished and shows in progress leave the catalog rows. Continue Watching is never touched.":
    "تختفي الأفلام التي أنهيتها والمسلسلات قيد المشاهدة من صفوف الكتالوج. لا تتأثّر متابعة المشاهدة أبداً.",
  "No filter. Home shows every language.": "بدون تصفية. تعرض الرئيسية كل اللغات.",
  "language. Home filters to it.": "لغة. تصفّي الرئيسية إليها.",
  "languages. Home filters to these.": "لغات. تصفّي الرئيسية إليها.",
  Tamil: "التاميلية",
  "Each episode shows its IMDb rating, right on the still.": "تظهر لكل حلقة درجة IMDb مباشرةً على الصورة.",
  "Turn on to show each episode's synopsis under the still.": "فعّلها لإظهار ملخّص كل حلقة أسفل الصورة.",
  "Loads full-resolution artwork instead of the lighter, softer version.":
    "يحمّل الصورة بدقّتها الكاملة بدلاً من النسخة الأخف والأقل وضوحاً.",
  "Lighter (w300)": "أخف (w300)",
  Original: "الأصلية",
  "Saved frame": "الإطار المحفوظ",
  "AI search": "البحث بالذكاء الاصطناعي",
  "Type what you want in plain language and let a model find it. Bring your own OpenRouter key.":
    "اكتب ما تريد بلغة طبيعية ودع النموذج يجده. استخدم مفتاح OpenRouter الخاص بك.",
  Model: "النموذج",
  "Choose a model": "اختر نموذجاً",
  "What gets through": "ما الذي يمر",
  "No filtering": "بدون تصفية",
  blocked: "محظور",
  shown: "معروض",
  "Likely cam": "نسخة كام محتملة",
  "Wrong year": "سنة خاطئة",
  "Size outlier": "حجم شاذ",
  "Suspicious file": "ملف مريب",
  "Top pick": "أفضل اختيار",
  "All sources": "كل المصادر",
  Play: "تشغيل",
  "When a flagged ad plays, a Skip button slides in so you jump straight past it.":
    "عند تشغيل إعلان مُبلَّغ عنه، يظهر زر التخطّي لتقفز فوقه مباشرةً.",
  "Picks up right where you left off": "يكمل من حيث توقّفت تماماً",
  "Back out mid-episode and the card keeps the exact frame you stopped on, with your progress, so it looks like a pause instead of a thumbnail.":
    "اخرج في منتصف الحلقة وستحتفظ البطاقة بالإطار الذي توقّفت عنده تماماً مع تقدّمك، فتبدو كأنها إيقاف مؤقت لا مجرّد صورة مصغّرة.",
  "The Last Stand": "الصمود الأخير",
  "With the city surrounded, an unlikely alliance forms as a long-buried secret finally comes to light.":
    "مع تطويق المدينة، يتشكّل تحالف غير متوقّع بينما يخرج سرّ دفين إلى النور.",
  "No Way Out": "لا مخرج",
  "Loyalties shatter as the survivors realize the enemy has been among them all along.":
    "تتحطّم الولاءات حين يدرك الناجون أن العدو كان بينهم طوال الوقت.",
  "Previous frame": "الإطار السابق",
  "Next frame": "الإطار التالي",
  "Step back one frame and pause. Frame-accurate on mpv.":
    "ارجع إطاراً واحداً مع الإيقاف المؤقت. دقة بمستوى الإطار على mpv.",
  "Step forward one frame and pause. Frame-accurate on mpv.":
    "تقدّم إطاراً واحداً مع الإيقاف المؤقت. دقة بمستوى الإطار على mpv.",
};

export default settings;
