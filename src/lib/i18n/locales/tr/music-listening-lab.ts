const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Dinleme profilleri",
  "music.lab.profilesHelp":
    "Her kulaklık veya hoparlör için düzeltme kaydedin. Yükleme taslağı değiştirir; çıkış ve ses sınırı korunur. Dinlemek için uygulayın.",
  "music.lab.profileName": "Profil adı",
  "music.lab.saveProfile": "Taslağı profil olarak kaydet",
  "music.lab.selectProfile": "Profil seç",
  "music.lab.loadProfile": "Taslağa yükle",
  "music.lab.delete": "Sil",
  "music.lab.response": "Hesaplanan ekolayzır yanıtı",
  "music.lab.curveHelp":
    "Ön yükselticiden önce {rate} kHz EQ yanıtı. Düz: taslak. Kesikli: uygulanan ayarlar. Bu bir hesaplamadır, cihaz ölçümü değildir.",
  "music.lab.strength": "Düzeltme gücü",
  "music.lab.strengthHelp":
    "Tepe ve raf kazançlarını ölçekler. Geçiren ve çentik filtreler şeklini korur; %0 tüm parametrik filtreleri atlar.",
  "music.lab.filter": "Filtre",
  "music.lab.enabled": "Açık",
  "music.lab.peak": "Tepe",
  "music.lab.lowShelf": "Alçak raf",
  "music.lab.highShelf": "Yüksek raf",
  "music.lab.lowPass": "Alçak geçiren",
  "music.lab.highPass": "Yüksek geçiren",
  "music.lab.notch": "Çentik",
  "music.lab.addFilter": "Filtre ekle",
  "music.lab.headroomHelp":
    "Otomatik pay: {db} dB. Birleşik filtre tepelerini 0,5 dB yedekle tahmin eder. Pozitif manuel ön kazanç bu yedeği tüketebilir.",
  "music.lab.importExport": "Düzeltme içe / dışa aktar",
  "music.lab.importHelp":
    "Equalizer APO / AutoEQ filtre metnini yapıştırın. Q ile PK, LSC, HSC, LP, HP ve NO desteklenir. İçe aktarma dosyanın ön kazancını kullanır ve otomatik payı kapatır. Dışa aktarma güç ve payı aşağıdaki metne işler.",
  "music.lab.correctionText": "Düzeltme metni",
  "music.lab.import": "Taslağa aktar",
  "music.lab.export": "Dışa aktarma metni oluştur",
  "music.lab.importError":
    "Geçersiz veya desteklenmeyen düzeltme. 1–24 filtre, 20–20.000 Hz, ±18 dB ve Q 0,1–12 kullanın. Diğer işleme komutları desteklenmez.",
  "music.lab.preamp": "Ön yükseltici · dB",
  "music.lab.crossfeed": "Kulaklık çapraz beslemesi",
  "music.lab.crossfeedHelp":
    "Her stereo kanalın filtrelenmiş bir bölümünü diğerine karıştırarak kulaklıkta ayrılığı azaltır. %0 kapatır.",
  "music.lab.bypass": "Harbor DSP’yi atla",
  "music.lab.bypassHelp":
    "Uyguladıktan sonra EQ, ön yükseltici, çapraz besleme, denge ve ReplayGain atlanır. Çıkış ve çalma sesi etkin kalır. Bu, bit-perfect çalmayı doğrulamaz.",
  "music.lab.exclusive": "Özel çıkış iste",
  "music.lab.exclusiveHelp":
    "Desteklenen çıkışlar sistem karıştırıcısını atlayabilir ve diğer uygulamaları engelleyebilir. Sürücü desteği değişir; bu anahtar erişim isteğidir, erişim onayı değildir.",
  "music.lab.sampleRate": "Çıkış örnekleme hızı",
  "music.lab.sourceRate": "Kaynağı izle",
  "music.lab.rateHelp":
    "Sabit hız istemez. Cihaz başka bir hız belirleyebilir. Sabit hız gerektiğinde yeniden örnekler; sıkıştırmada kaybolan ayrıntıları geri getirmez.",
  "music.lab.equalizer": "Ekolayzır",
  "music.lab.mode": "Ekolayzır modu",
  "music.lab.parametric": "Parametrik · en fazla 24 filtre",
};
export default musicListeningLab;
