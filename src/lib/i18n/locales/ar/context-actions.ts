const contextActions: Record<string, string> = {
  "Anime watched changes are not synced to this provider. Manage progress there.":
    "لا تتم مزامنة تغييرات حالة مشاهدة الأنمي مع هذا المزوّد. عدّل تقدّم المشاهدة لديه.",
  "Checking watched status…": "جارٍ التحقّق من حالة المشاهدة…",
  "Watched status unavailable": "حالة المشاهدة غير متاحة",
  "{watched} of {total} released episodes known watched":
    "تمت مشاهدة {watched} من أصل {total} حلقة صدرت وفق البيانات المتاحة",
  "Could not check watched status: {providers}": "تعذّر التحقّق من حالة المشاهدة لدى: {providers}",
  "Delete local copy only": "حذف النسخة المحلية فقط",
  "Harbor will check your account and remove this collection there if it exists, then remove the local collection. Other account collections are preserved.":
    "سيتحقّق Harbor من حسابك ويحذف هذه المجموعة منه إن كانت موجودة، ثم يحذف المجموعة المحلية. ستبقى المجموعات الأخرى في حسابك كما هي.",
  "Local-only deletion removes this collection from this device. Any copy in your Harbor account remains unchanged; its current status has not been verified.":
    "يؤدي الحذف المحلي فقط إلى إزالة هذه المجموعة من هذا الجهاز. ستبقى أي نسخة في حسابك على Harbor كما هي؛ لم يتم التحقّق من حالتها الحالية.",
  "Retry account check": "إعادة التحقّق من الحساب",
  "The account collection data could not be read safely.":
    "تعذّرت قراءة بيانات مجموعات الحساب بأمان.",
  "The Harbor account changed while reading its collections.":
    "تغيّر حساب Harbor أثناء قراءة مجموعاته.",
  "The Harbor account collections could not be read.": "تعذّرت قراءة مجموعات حساب Harbor.",
  "The Harbor account could not be verified.": "تعذّر التحقّق من حساب Harbor.",
  "The server did not confirm access to your complete account collections.":
    "لم يؤكّد الخادم إمكانية الوصول إلى جميع مجموعات حسابك.",
  "Your Harbor account copy could not be checked. Nothing was deleted. You can retry, or delete only the local copy and leave any account copy unchanged.":
    "تعذّر التحقّق من نسختك في حساب Harbor. لم يُحذف أي شيء. يمكنك إعادة المحاولة، أو حذف النسخة المحلية فقط والإبقاء على أي نسخة في الحساب كما هي.",
  "Updated: {providers}.": "تم التحديث لدى: {providers}.",
  "No changes were made.": "لم تُجرَ أي تغييرات.",
  "Harbor watchlist cache": "ذاكرة قائمة المشاهدة المؤقتة في Harbor",
  "Stremio cleared this title's history for the previous account. The active profile or account changed; the current view was kept.":
    "مسح Stremio سجل هذا العمل للحساب السابق. تغيّر الملف الشخصي النشط أو الحساب؛ بقي العرض الحالي كما هو.",
  "Simkl removal also deletes watched history. Manage this title in Simkl.":
    "تؤدي الإزالة من Simkl إلى حذف سجل المشاهدة أيضًا. أدر هذا العمل في Simkl.",
  "This title already has a Simkl status. Change its status in Simkl.":
    "لهذا العمل حالة محدّدة في Simkl بالفعل. غيّر حالته في Simkl.",
  "No verified Trakt identity is available for this title.":
    "لا يتوفر معرّف مؤكّد لهذا العمل في Trakt.",
  "No verified Simkl identity is available for this title.":
    "لا يتوفر معرّف مؤكّد لهذا العمل في Simkl.",
  "Unchanged: Simkl removal also deletes watched history. Manage this title in Simkl.":
    "لم يتغيّر شيء: تؤدي الإزالة من Simkl إلى حذف سجل المشاهدة أيضًا. أدر هذا العمل في Simkl.",
  "Unchanged: this title already has a Simkl status. Change its status in Simkl.":
    "لم يتغيّر شيء: لهذا العمل حالة محدّدة في Simkl بالفعل. غيّر حالته في Simkl.",
  "This title cannot be synced to Stremio's watchlist.":
    "لا يمكن مزامنة هذا العمل مع قائمة المشاهدة في Stremio.",
  "No verified Trakt episode mapping is available for this anime.":
    "لا تتوفر مطابقة مؤكّدة لحلقات هذا الأنمي في Trakt.",
  "Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.":
    "لا يمكن لـSimkl إلغاء مشاهدة فيلم دون إزالته من مكتبته. أدر هذا العمل في Simkl.",
  "Unchanged: Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.":
    "لم يتغيّر شيء: لا يمكن لـSimkl إلغاء مشاهدة فيلم دون إزالته من مكتبته. أدر هذا العمل في Simkl.",
  "Anime episode watched state is not synced to Stremio.":
    "لا تُزامَن حالة مشاهدة حلقات الأنمي مع Stremio.",
  "No Stremio identity is available for this title.": "لا يتوفر معرّف لهذا العمل في Stremio.",
  "The selected episodes could not be aligned with Stremio's episode list.":
    "تعذّرت مطابقة الحلقات المحددة مع قائمة حلقات Stremio.",
  "The Trakt account or session changed. Open the menu again.":
    "تغيّر حساب Trakt أو جلسته. افتح القائمة مجددًا.",
  "The current Trakt watched state could not be read safely.":
    "تعذّرت قراءة حالة المشاهدة الحالية في Trakt بأمان.",
  "Trakt repeated a watched-state page. No Trakt history was added.":
    "أعاد Trakt صفحة مكررة من حالة المشاهدة. لم تُضف أي مشاهدة إلى سجل Trakt.",
  "The complete Trakt watched state could not be checked. No Trakt history was added.":
    "تعذّر التحقّق من حالة المشاهدة الكاملة في Trakt. لم تُضف أي مشاهدة إلى سجل Trakt.",
  "The server did not confirm your profile. Reload it before making changes.":
    "لم يؤكّد الخادم ملفك الشخصي. أعد تحميله قبل إجراء تغييرات.",
  "Your profile items could not be read safely. No changes were made.":
    "تعذّرت قراءة عناصر ملفك الشخصي بأمان. لم تُجرَ أي تغييرات.",
  "Sign in to publish your collections.": "سجّل الدخول لنشر مجموعاتك.",
  "The active profile or Harbor account changed. Reopen the collection action.":
    "تغيّر الملف الشخصي النشط أو حساب Harbor. أعد فتح إجراء المجموعة.",
  "The Harbor account changed. Reopen the collection action.":
    "تغيّر حساب Harbor. أعد فتح إجراء المجموعة.",
  "The server response did not confirm the requested collections. Your local collections were kept; refresh the published collection before retrying.":
    "لم تؤكّد استجابة الخادم المجموعات المطلوبة. بقيت مجموعاتك المحلية محفوظة؛ حدّث المجموعة المنشورة قبل إعادة المحاولة.",
  "The server accepted the collection changes, but the local profile or account changed. Reopen the collection to reconcile its state.":
    "قبل الخادم تغييرات المجموعة، لكن تغيّر الملف الشخصي المحلي أو الحساب. أعد فتح المجموعة لمطابقة حالتها.",
  "Files were deleted, but the download record could not be removed. Retry removal.":
    "حُذفت الملفات، لكن تعذّرت إزالة سجل التنزيل. أعد محاولة الإزالة.",
  "The download record could not be removed. Retry removal.":
    "تعذّرت إزالة سجل التنزيل. أعد محاولة الإزالة.",
  "{n} versions on home servers": "{n} نسخة على الخوادم المنزلية",
  "A local library entry changed. Open the menu again.":
    "تغيّر عنصر في المكتبة المحلية. افتح القائمة مجددًا.",
  "Choose episode": "اختيار حلقة",
  "Choose source for this episode": "اختيار مصدر لهذه الحلقة",
  "Choose version": "اختيار نسخة",
  "Choose version to download": "اختيار نسخة لتنزيلها",
  "Download is unavailable.": "التنزيل غير متاح.",
  "Download this version": "تنزيل هذه النسخة",
  "Manage home servers": "إدارة الخوادم المنزلية",
  "No local files are selected.": "لم تُحدّد أي ملفات محلية.",
  "Play this file": "تشغيل هذا الملف",
  "Play this version": "تشغيل هذه النسخة",
  "Playback is unavailable.": "التشغيل غير متاح.",
  "Remove {count} entries from library; keep files":
    "إزالة {count} عنصرًا من المكتبة مع الاحتفاظ بالملفات",
  "Remove {count} entries from the local library? Files on disk are kept.\n\n{title}":
    "هل تريد إزالة {count} عنصرًا من المكتبة المحلية؟ ستبقى الملفات على القرص.\n\n{title}",
  "Remove from library; keep file": "إزالة من المكتبة مع الاحتفاظ بالملف",
  "The library change could not be saved. Your entries and files were kept.":
    "تعذّر حفظ التغيير في المكتبة. بقيت عناصر المكتبة وملفاتك محفوظة.",
  "This local file is missing or is not a regular file.":
    "هذا الملف المحلي مفقود أو ليس ملفًا عاديًا.",
  "This local file is no longer available.": "لم يعد هذا الملف المحلي متاحًا.",
  "This local library entry changed. Open the menu again.":
    "تغيّر هذا العنصر في المكتبة المحلية. افتح القائمة مجددًا.",
  "This server connection changed. Choose a source again.":
    "تغيّر اتصال هذا الخادم. اختر مصدرًا مجددًا.",
  "This server connection is no longer available.": "لم يعد اتصال هذا الخادم متاحًا.",
  "This server episode is no longer available.": "لم تعد هذه الحلقة متاحة على الخادم.",
  "This server item is no longer available.": "لم يعد هذا العنصر متاحًا على الخادم.",
  "This server version changed. Choose a source again.":
    "تغيّرت هذه النسخة على الخادم. اختر مصدرًا مجددًا.",
  "{done} completed, {failed} failed, {skipped} changed or unavailable.":
    "اكتمل {done}، وفشل {failed}، وتغيّر {skipped} أو لم يعد متاحًا.",
  "{visible} visible downloads of {all} total": "يظهر {visible} من أصل {all} تنزيلًا",
  "{visible} visible of {all} downloads": "يظهر {visible} من أصل {all} تنزيلًا",
  "A movie cannot have an episode watched action.":
    "لا يمكن تغيير حالة مشاهدة حلقة لعمل من نوع فيلم.",
  "A profile update is already in progress.": "يجري تحديث الملف الشخصي بالفعل.",
  "Add to list or collection": "إضافة إلى قائمة أو مجموعة",
  "Add to my profile": "إضافة إلى ملفي الشخصي",
  "All {count} downloads for this series": "جميع تنزيلات هذا المسلسل وعددها {count}",
  "Already added": "تمت إضافته بالفعل",
  'Already in "{name}"': 'موجود بالفعل في "{name}"',
  "Already in my profile": "موجود بالفعل في ملفي الشخصي",
  "An update is already in progress.": "يجري التحديث بالفعل.",
  "Cancel {count} downloads": "إلغاء {count} تنزيلًا",
  "Cancel {count} downloads? Partial files are kept.\n\n{scope}":
    "هل تريد إلغاء {count} تنزيلًا؟ ستبقى الملفات غير المكتملة محفوظة.\n\n{scope}",
  "Choose a download source again to retry this item.":
    "اختر مصدر التنزيل مجددًا لإعادة محاولة تنزيل هذا العنصر.",
  "Choose a download source again; this item's source cannot be recovered.":
    "اختر مصدر التنزيل مجددًا؛ تعذّر استعادة مصدر هذا العنصر.",
  "Choose one explicit episode scope.": "حدّد نطاقًا واحدًا واضحًا للحلقات.",
  "Clear Stremio watch history for this title?": "هل تريد مسح سجل مشاهدة هذا العمل في Stremio؟",
  "Clear Stremio watch history for this title…": "مسح سجل مشاهدة هذا العمل في Stremio…",
  "Clear title history": "مسح سجل العمل",
  "Clearing Stremio history is not supported for this title ID.":
    "مسح سجل Stremio غير مدعوم لمعرّف هذا العمل.",
  Comment: "تعليق",
  "Confirm delete comment": "تأكيد حذف التعليق",
  "Copy comment text": "نسخ نص التعليق",
  "Copy game link": "نسخ رابط اللعبة",
  "Copy image": "نسخ الصورة",
  "Copy image is unavailable here. Save the image instead.":
    "نسخ الصور غير متاح هنا. يمكنك حفظ الصورة.",
  "Copy image link": "نسخ رابط الصورة",
  "Copy post text": "نسخ نص المنشور",
  "Copy profile link": "نسخ رابط الملف الشخصي",
  "Copy selected text": "نسخ النص المحدد",
  "Copy share link": "نسخ رابط المشاركة",
  "Copy username": "نسخ اسم المستخدم",
  "Could not clear watch history.": "تعذّر مسح سجل المشاهدة.",
  "Could not copy comment text.": "تعذّر نسخ نص التعليق.",
  "Could not copy image.": "تعذّر نسخ الصورة.",
  "Could not copy selected text.": "تعذّر نسخ النص المحدد.",
  "Could not copy the link.": "تعذّر نسخ الرابط.",
  "Could not copy to the clipboard.": "تعذّر النسخ إلى الحافظة.",
  "Could not copy. Select and copy the text manually.": "تعذّر النسخ. حدّد النص وانسخه يدويًا.",
  "Could not delete collection.": "تعذّر حذف المجموعة.",
  "Could not delete comment.": "تعذّر حذف التعليق.",
  "Could not load image.": "تعذّر تحميل الصورة.",
  "Could not publish the collection.": "تعذّر نشر المجموعة.",
  "Could not read saved collections safely. Reopen the menu after resolving storage changes.":
    "تعذّرت قراءة المجموعات المحفوظة بأمان. أعد فتح القائمة بعد معالجة تغييرات التخزين.",
  "Could not read saved collections safely. Resolve pending storage changes and try again.":
    "تعذّرت قراءة المجموعات المحفوظة بأمان. عالج تغييرات التخزين المعلّقة ثم حاول مجددًا.",
  "Could not save image.": "تعذّر حفظ الصورة.",
  "Could not save the change. Check available storage and try again.":
    "تعذّر حفظ التغيير. تحقّق من مساحة التخزين المتاحة ثم حاول مجددًا.",
  "Could not save the collection deletion. Your local collection was preserved.":
    "تعذّر حفظ حذف المجموعة. بقيت مجموعتك المحلية محفوظة.",
  "Create another destination first.": "أنشئ وجهة أخرى أولًا.",
  "Delete {count} downloads": "حذف {count} تنزيلًا",
  "Delete collection": "حذف المجموعة",
  "Delete this comment? This cannot be undone.":
    "هل تريد حذف هذا التعليق؟ لا يمكن التراجع عن هذا الإجراء.",
  "Delete post…": "حذف المنشور…",
  "Delete this post from the group?": "هل تريد حذف هذا المنشور من المجموعة؟",
  "Deleting…": "جارٍ الحذف…",
  "Deletion is in progress.": "جارٍ الحذف.",
  "Download actions for {title}": "إجراءات تنزيل {title}",
  "Edit post": "تعديل المنشور",
  "Episode actions": "إجراءات الحلقة",
  "Episode information is unavailable.": "معلومات الحلقة غير متاحة.",
  "Episode information is unavailable. No watched state was changed.":
    "معلومات الحلقة غير متاحة. لم تتغيّر حالة المشاهدة.",
  "Episode watched state could not be encoded.": "تعذّر ترميز حالة مشاهدة الحلقة.",
  "Go to": "الانتقال إلى",
  "Image copied": "تم نسخ الصورة",
  "Image copying is not supported on this platform.": "نسخ الصور غير مدعوم على هذه المنصة.",
  "Image copying is unavailable.": "نسخ الصور غير متاح.",
  "Image loading cancelled.": "أُلغي تحميل الصورة.",
  "Image loading timed out.": "انتهت مهلة تحميل الصورة.",
  "Image saved": "تم حفظ الصورة",
  "Image viewer": "عارض الصور",
  "Invalid episode identity.": "معرّف الحلقة غير صالح.",
  Like: "إعجاب",
  "Loading image…": "جارٍ تحميل الصورة…",
  "Local changes could not be fully saved.": "تعذّر حفظ جميع التغييرات المحلية.",
  "Local images require the desktop app.": "تتطلب الصور المحلية تطبيق سطح المكتب.",
  "Manga page": "صفحة مانغا",
  "Mark {count} episodes up to here": "تحديد {count} حلقة حتى هنا كمُشاهدة",
  "Mark episode as unwatched": "تحديد الحلقة كغير مُشاهدة",
  "Mark episode as watched": "تحديد الحلقة كمُشاهدة",
  "Mark released episodes as unwatched": "تحديد الحلقات الصادرة كغير مُشاهدة",
  "Mark released episodes as watched": "تحديد الحلقات الصادرة كمُشاهدة",
  "Move to": "نقل إلى",
  'Moved to "{name}"': 'تم النقل إلى "{name}"',
  "My profile": "ملفي الشخصي",
  "Network file URLs are not supported.": "روابط الملفات على الشبكة غير مدعومة.",
  "No downloads are currently eligible for this action.":
    "لا توجد تنزيلات يمكن تطبيق هذا الإجراء عليها حاليًا.",
  "No episodes were selected.": "لم تُحدّد أي حلقات.",
  "No released episodes are available. No watched state was changed.":
    "لا تتوفر حلقات صادرة. لم تتغيّر حالة المشاهدة.",
  "Only the original author can publish a saved community collection.":
    "يمكن للمؤلف الأصلي فقط نشر مجموعة محفوظة من المجتمع.",
  "Only your saved copy is deleted. The original remains available.":
    "تُحذف نسختك المحفوظة فقط. تبقى النسخة الأصلية متاحة.",
  "Open author profile": "فتح الملف الشخصي للمؤلف",
  "Open collection": "فتح المجموعة",
  "Open episode": "فتح الحلقة",
  "Open game page": "فتح صفحة اللعبة",
  "Open image link externally": "فتح رابط الصورة خارج التطبيق",
  "Open link": "فتح الرابط",
  "Open list": "فتح القائمة",
  "Open page": "فتح الصفحة",
  "Open related title": "فتح العمل المرتبط",
  "Page {number}": "الصفحة {number}",
  "Page actions": "إجراءات الصفحة",
  "Pause {count} downloads": "إيقاف {count} تنزيلًا مؤقتًا",
  "Pin channel": "تثبيت القناة",
  "Play channel": "تشغيل القناة",
  "Play from beginning": "التشغيل من البداية",
  "Provider could not identify the requested content.": "تعذّر على المزوّد تحديد المحتوى المطلوب.",
  "Provider did not confirm every requested item.": "لم يؤكّد المزوّد جميع العناصر المطلوبة.",
  "Refresh history": "تحديث السجل",
  "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}":
    "هل تريد إزالة {count} تنزيلًا وحذف ملفاتها المحفوظة أو غير المكتملة؟ ستبقى المجلدات.\n\n{details}",
  "Remove {count} PDF print records from Downloads? Harbor did not save these PDF files.":
    "هل تريد إزالة {count} سجل طباعة PDF من التنزيلات؟ لم يحفظ Harbor ملفات PDF هذه.",
  "Remove @{handle} from your friends?": "هل تريد إزالة @{handle} من أصدقائك؟",
  "Remove friend…": "إزالة الصديق…",
  'Remove from "{name}"': 'إزالة من "{name}"',
  "Remove from downloads": "إزالة من التنزيلات",
  "Resume {count} downloads": "استئناف {count} تنزيلًا",
  "Resume playback": "استئناف التشغيل",
  "Retry {count} downloads": "إعادة محاولة {count} تنزيلًا",
  "Save image": "حفظ الصورة",
  "Save image…": "حفظ الصورة…",
  "Shared copies on your profile are preserved.": "تبقى النسخ المشتركة على ملفك الشخصي محفوظة.",
  "Sign in and reopen the share dialog.": "سجّل الدخول ثم أعد فتح نافذة المشاركة.",
  "Sign in to Harbor to add items to your profile.":
    "سجّل الدخول إلى Harbor لإضافة عناصر إلى ملفك الشخصي.",
  "Sign in to Harbor to open your profile.": "سجّل الدخول إلى Harbor لفتح ملفك الشخصي.",
  "Sign in to perform this action.": "سجّل الدخول لتنفيذ هذا الإجراء.",
  "Simkl did not confirm plan-to-watch status.": "لم يؤكّد Simkl حالة التخطيط للمشاهدة.",
  "Simkl disconnected.": "انقطع اتصال Simkl.",
  source: "المصدر",
  "Stremio account changed.": "تغيّر حساب Stremio.",
  "Stremio has not confirmed this change; a failed write may be queued for retry.":
    "لم يؤكّد Stremio هذا التغيير؛ قد تكون عملية الحفظ الفاشلة في انتظار إعادة المحاولة.",
  "The account or theme changed. Reopen the comment menu.":
    "تغيّر الحساب أو السمة. أعد فتح قائمة التعليق.",
  "The action could not be completed.": "تعذّر إكمال الإجراء.",
  "The active profile changed.": "تغيّر الملف الشخصي النشط.",
  "The active profile changed. Open the menu again.":
    "تغيّر الملف الشخصي النشط. افتح القائمة مجددًا.",
  "The active profile could not be read.": "تعذّرت قراءة الملف الشخصي النشط.",
  "The active profile or account changed. Reopen the comment menu.":
    "تغيّر الملف الشخصي النشط أو الحساب. أعد فتح قائمة التعليق.",
  "The active profile or Harbor account changed. Reopen the share dialog.":
    "تغيّر الملف الشخصي النشط أو حساب Harbor. أعد فتح نافذة المشاركة.",
  "The active profile or Stremio account changed. Reopen the menu.":
    "تغيّر الملف الشخصي النشط أو حساب Stremio. أعد فتح القائمة.",
  "The browser could not copy this image.": "تعذّر على المتصفح نسخ هذه الصورة.",
  "The collection was unpublished, but local deletion could not be saved. Your local collection was preserved; retry after resolving storage or concurrent edits.":
    "أُلغي نشر المجموعة، لكن تعذّر حفظ الحذف المحلي. بقيت مجموعتك المحلية محفوظة؛ حاول مجددًا بعد معالجة التخزين أو التعديلات المتزامنة.",
  "The collection was unpublished, but the local profile or account changed. Your local collection was preserved.":
    "أُلغي نشر المجموعة، لكن تغيّر الملف الشخصي المحلي أو الحساب. بقيت مجموعتك المحلية محفوظة.",
  "The comment was deleted, but replies could not be refreshed.":
    "حُذف التعليق، لكن تعذّر تحديث الردود.",
  "The comment update could not be confirmed. Refresh its current state.":
    "تعذّر تأكيد تحديث التعليق. حدّث حالته الحالية.",
  "The collections exceed the publication limit. No collections were published.":
    "تتجاوز المجموعات حد النشر. لم تُنشر أي مجموعة.",
  "The destination is no longer available.": "لم تعد الوجهة متاحة.",
  "The download finished or failed before this action completed.":
    "اكتمل التنزيل أو فشل قبل اكتمال هذا الإجراء.",
  "The download path is not a regular file; folders cannot be deleted here.":
    "مسار التنزيل لا يشير إلى ملف عادي؛ لا يمكن حذف المجلدات هنا.",
  "The download path is not a regular file.": "مسار التنزيل لا يشير إلى ملف عادي.",
  "The downloaded file is missing or no longer exists.": "الملف المنزّل مفقود أو لم يعد موجودًا.",
  "The episode identity is invalid.": "معرّف الحلقة غير صالح.",
  "The friend request is no longer available.": "لم يعد طلب الصداقة متاحًا.",
  "The Harbor account changed. Reopen the delete confirmation.":
    "تغيّر حساب Harbor. أعد فتح نافذة تأكيد الحذف.",
  "The image content does not match its reported format.": "محتوى الصورة لا يطابق تنسيقها المعلن.",
  "The image is too large (maximum 32 MB).": "الصورة كبيرة جدًا (الحد الأقصى 32 ميغابايت).",
  "The image is too large to copy. Save the original image instead.":
    "الصورة كبيرة جدًا لنسخها. يمكنك حفظ الصورة الأصلية.",
  "The image response is empty.": "استجابة الصورة فارغة.",
  "The inline image is invalid.": "الصورة المضمّنة غير صالحة.",
  "The provider did not confirm this change. Any completed changes were kept.":
    "لم يؤكّد المزوّد هذا التغيير. حُفظت التغييرات التي اكتملت.",
  "The provider episode identity is invalid.": "معرّف الحلقة لدى المزوّد غير صالح.",
  "The provider episode needs a verified title identity.": "تتطلب حلقة المزوّد معرّفًا مؤكّدًا للعمل.",
  "The provider's current state could not be checked. No changes were made.":
    "تعذّر التحقّق من الحالة الحالية لدى المزوّد. لم تُجرَ أي تغييرات.",
  "The relationship changed. Open the menu again.": "تغيّرت حالة العلاقة. افتح القائمة مجددًا.",
  "The saved collections exceed the publication limit.": "تتجاوز المجموعات المحفوظة حد النشر.",
  "The saved list data could not be read safely.": "تعذّرت قراءة بيانات القائمة المحفوظة بأمان.",
  "The saved watched state cannot be aligned with this episode list.":
    "تعذّرت مطابقة حالة المشاهدة المحفوظة مع قائمة الحلقات هذه.",
  "The saved watched state could not be decoded.": "تعذّر فك ترميز حالة المشاهدة المحفوظة.",
  "The saved watched state has an invalid anchor.":
    "تحتوي حالة المشاهدة المحفوظة على مرجع غير صالح.",
  "The saved watched state is malformed.": "تنسيق حالة المشاهدة المحفوظة غير صحيح.",
  "The saved watchlist could not be read.": "تعذّرت قراءة قائمة المشاهدة المحفوظة.",
  "The saved watchlist view could not be updated.": "تعذّر تحديث عرض قائمة المشاهدة المحفوظة.",
  "The server accepted the publication change, but local storage could not be updated. Your local collection was preserved; retry after resolving storage or concurrent edits.":
    "قبل الخادم تغيير النشر، لكن تعذّر تحديث التخزين المحلي. بقيت مجموعتك المحلية محفوظة؛ حاول مجددًا بعد معالجة التخزين أو التعديلات المتزامنة.",
  "The server accepted the publication change, but the local profile or account changed. Reopen this collection to reconcile its sharing state.":
    "قبل الخادم تغيير النشر، لكن تغيّر الملف الشخصي المحلي أو الحساب. أعد فتح هذه المجموعة لمطابقة حالة مشاركتها.",
  "The server did not save the requested profile items.":
    "لم يحفظ الخادم عناصر الملف الشخصي المطلوبة.",
  "The source did not return an image.": "لم يُرجع المصدر صورة.",
  "The source is no longer available.": "لم يعد المصدر متاحًا.",
  "The source is not a supported image.": "المصدر ليس صورة بتنسيق مدعوم.",
  "The source is not an image.": "المصدر ليس صورة.",
  "The update was saved to the previous profile. The active profile changed.":
    "حُفظ التحديث في الملف الشخصي السابق. تغيّر الملف الشخصي النشط.",
  "The watchlist was not saved.": "لم تُحفظ قائمة المشاهدة.",
  "There are unsaved list changes. Free storage space and try again.":
    "توجد تغييرات غير محفوظة في القائمة. وفّر مساحة تخزين ثم حاول مجددًا.",
  "This action is already running.": "يجري تنفيذ هذا الإجراء بالفعل.",
  "This action is no longer available.": "لم يعد هذا الإجراء متاحًا.",
  "This clears playback progress and watched status for all of “{title}” in Stremio, including every episode. Your watchlist membership and Trakt history are preserved.":
    "سيؤدي هذا إلى مسح تقدّم التشغيل وحالة المشاهدة للعمل «{title}» بالكامل في Stremio، بما في ذلك جميع الحلقات. ستبقى حالة إدراجه في قائمة المشاهدة وسجل Trakt كما هما.",
  "This collection no longer exists.": "لم تعد هذه المجموعة موجودة.",
  "This comment cannot be deleted.": "لا يمكن حذف هذا التعليق.",
  "This comment is being updated.": "يجري تحديث هذا التعليق.",
  "This comment is no longer available.": "لم يعد هذا التعليق متاحًا.",
  "This destination is full.": "هذه الوجهة ممتلئة.",
  "This download has changed. Try again.": "تغيّر هذا التنزيل. حاول مجددًا.",
  "This download has no file path.": "لا يوجد مسار ملف لهذا التنزيل.",
  "This download is a book, not a video.": "هذا التنزيل كتاب وليس مقطع فيديو.",
  "This download is already being deleted.": "يجري حذف هذا التنزيل بالفعل.",
  "This download is no longer available.": "لم يعد هذا التنزيل متاحًا.",
  "This download no longer exists.": "لم يعد هذا التنزيل موجودًا.",
  "This file is shared with another download or is in use by the player.":
    "هذا الملف مشترك مع تنزيل آخر أو يستخدمه المشغّل حاليًا.",
  "This image could not be decoded.": "تعذّر فك ترميز هذه الصورة.",
  "This image has no source.": "لا يوجد مصدر لهذه الصورة.",
  "This image source is not supported.": "مصدر هذه الصورة غير مدعوم.",
  "This item is no longer available.": "لم يعد هذا العنصر متاحًا.",
  "This item is no longer in the source.": "لم يعد هذا العنصر موجودًا في المصدر.",
  "This item opened a PDF print dialog; Harbor has no saved file to open.":
    "فتح هذا العنصر نافذة طباعة PDF؛ لا يملك Harbor ملفًا محفوظًا لفتحه.",
  "This page is already refreshing.": "يجري تحديث هذه الصفحة بالفعل.",
  "This page refresh is no longer available.": "لم يعد تحديث هذه الصفحة متاحًا.",
  "This removes the collection and its title memberships.":
    "يؤدي هذا إلى حذف المجموعة وإزالة الأعمال المدرجة فيها من المجموعة.",
  "This title has no Stremio watch history to clear.":
    "لا يوجد سجل مشاهدة لهذا العمل في Stremio لمسحه.",
  "This title is already being updated.": "يجري تحديث هذا العمل بالفعل.",
  "This title is no longer in Stremio history.": "لم يعد هذا العمل موجودًا في سجل Stremio.",
  "Trakt disconnected.": "انقطع اتصال Trakt.",
  Unlike: "إلغاء الإعجاب",
  "View author profile": "عرض الملف الشخصي للمؤلف",
  "View creator": "عرض المنشئ",
  "View image": "عرض الصورة",
  "View page {number}": "عرض الصفحة {number}",
  "View person": "عرض الشخص",
  "View program details": "عرض تفاصيل البرنامج",
  "Visible downloads ({visible} of {all})": "التنزيلات الظاهرة ({visible} من {all})",
  "Visible pages": "الصفحات الظاهرة",
  "Watched actions are not available for this content type.":
    "إجراءات المشاهدة غير متاحة لهذا النوع من المحتوى.",
  "You no longer have permission to delete this comment.": "لم تعد لديك صلاحية حذف هذا التعليق.",
  "Your profile section is full. Remove an item before adding another.":
    "قسم ملفك الشخصي ممتلئ. أزل عنصرًا قبل إضافة عنصر آخر.",
  "Your published copy will also be removed from the community.":
    "ستُزال نسختك المنشورة من المجتمع أيضًا.",
};

export default contextActions;
