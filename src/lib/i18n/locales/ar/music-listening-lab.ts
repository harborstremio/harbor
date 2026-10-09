const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "ملفات الاستماع",
  "music.lab.profilesHelp":
    "احفظ تصحيحًا لكل سماعة رأس أو مكبر صوت. التحميل يغيّر المسودة فقط ويحافظ على المخرج وحد الصوت. طبّق للاستماع.",
  "music.lab.profileName": "اسم الملف",
  "music.lab.saveProfile": "حفظ المسودة كملف",
  "music.lab.selectProfile": "اختيار ملف",
  "music.lab.loadProfile": "تحميل إلى المسودة",
  "music.lab.delete": "حذف",
  "music.lab.response": "استجابة المعادل المحسوبة",
  "music.lab.curveHelp":
    "استجابة EQ عند {rate} كيلوهرتز قبل التضخيم الأولي. المتصل: المسودة. المتقطع: الإعدادات المطبقة. هذه عملية حسابية وليست قياسًا للجهاز.",
  "music.lab.strength": "قوة التصحيح",
  "music.lab.strengthHelp":
    "تضبط كسب مرشحات القمة والرف. تحافظ مرشحات التمرير والحجب على شكلها؛ 0% يتجاوز جميع المرشحات البارامترية.",
  "music.lab.filter": "مرشح",
  "music.lab.enabled": "مفعّل",
  "music.lab.peak": "قمة",
  "music.lab.lowShelf": "رف منخفض",
  "music.lab.highShelf": "رف مرتفع",
  "music.lab.lowPass": "تمرير منخفض",
  "music.lab.highPass": "تمرير مرتفع",
  "music.lab.notch": "حجب نطاق",
  "music.lab.addFilter": "إضافة مرشح",
  "music.lab.headroomHelp":
    "الهامش التلقائي: {db} ديسيبل. يقدّر القمم المجمعة مع احتياطي 0.5 ديسيبل. قد يستهلك التضخيم الأولي الموجب هذا الاحتياطي.",
  "music.lab.importExport": "استيراد / تصدير التصحيح",
  "music.lab.importHelp":
    "ألصق نص مرشحات Equalizer APO / AutoEQ. يدعم PK وLSC وHSC وLP وHP وNO مع Q. يستخدم الاستيراد تضخيم الملف ويوقف الهامش التلقائي. يضمّن التصدير القوة والهامش في النص أدناه.",
  "music.lab.correctionText": "نص التصحيح",
  "music.lab.import": "استيراد إلى المسودة",
  "music.lab.export": "إنشاء نص التصدير",
  "music.lab.importError":
    "تصحيح غير صالح أو غير مدعوم. استخدم 1–24 مرشحًا، و20–20,000 هرتز، و±18 ديسيبل، وQ من 0.1 إلى 12. أوامر المعالجة الأخرى غير مدعومة.",
  "music.lab.preamp": "التضخيم الأولي · ديسيبل",
  "music.lab.crossfeed": "تغذية متقاطعة لسماعات الرأس",
  "music.lab.crossfeedHelp":
    "يمزج جزءًا مرشحًا من كل قناة ستيريو في الأخرى لتقليل الانفصال في سماعات الرأس. 0% يوقف التأثير.",
  "music.lab.bypass": "تجاوز DSP في Harbor",
  "music.lab.bypassHelp":
    "بعد التطبيق يتجاوز EQ والتضخيم الأولي والتغذية المتقاطعة والتوازن وReplayGain. يبقى المخرج ومستوى التشغيل فعالين. لا يؤكد تشغيلًا مطابقًا للبتات.",
  "music.lab.exclusive": "طلب مخرج حصري",
  "music.lab.exclusiveHelp":
    "يمكن للمخارج المدعومة تجاوز مازج النظام وحجب التطبيقات الأخرى. يعتمد الدعم على برنامج التشغيل؛ هذا طلب وصول وليس تأكيدًا للحصرية.",
  "music.lab.sampleRate": "معدل أخذ عينات المخرج",
  "music.lab.sourceRate": "اتباع المصدر",
  "music.lab.rateHelp":
    "لا يطلب معدلًا ثابتًا. قد يتفاوض الجهاز على معدل آخر. يعيد المعدل الثابت أخذ العينات عند الحاجة؛ ولا يستعيد تفاصيل فقدت بالضغط.",
  "music.lab.equalizer": "المعادل",
  "music.lab.mode": "وضع المعادل",
  "music.lab.parametric": "بارامتري · حتى 24 مرشحًا",
};
export default musicListeningLab;
