const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "सुनने की प्रोफ़ाइल",
  "music.lab.profilesHelp":
    "हर हेडफ़ोन या स्पीकर के लिए सुधार सहेजें। लोड करने से ड्राफ़्ट बदलता है; आउटपुट और वॉल्यूम सीमा बनी रहती है। सुनने के लिए लागू करें।",
  "music.lab.profileName": "प्रोफ़ाइल का नाम",
  "music.lab.saveProfile": "ड्राफ़्ट को प्रोफ़ाइल में सहेजें",
  "music.lab.selectProfile": "प्रोफ़ाइल चुनें",
  "music.lab.loadProfile": "ड्राफ़्ट में लोड करें",
  "music.lab.delete": "मिटाएँ",
  "music.lab.response": "गणना की गई इक्वलाइज़र प्रतिक्रिया",
  "music.lab.curveHelp":
    "प्रीऐम्प से पहले {rate} kHz पर EQ प्रतिक्रिया। ठोस रेखा: ड्राफ़्ट। टूटी रेखा: लागू सेटिंग। यह गणना है, डिवाइस का मापन नहीं।",
  "music.lab.strength": "सुधार की तीव्रता",
  "music.lab.strengthHelp":
    "पीक और शेल्फ गेन को बदलता है। पास और नॉच फ़िल्टर का आकार बना रहता है; 0% सभी पैरामीट्रिक फ़िल्टर बायपास करता है।",
  "music.lab.filter": "फ़िल्टर",
  "music.lab.enabled": "चालू",
  "music.lab.peak": "पीक",
  "music.lab.lowShelf": "लो शेल्फ",
  "music.lab.highShelf": "हाई शेल्फ",
  "music.lab.lowPass": "लो पास",
  "music.lab.highPass": "हाई पास",
  "music.lab.notch": "नॉच",
  "music.lab.addFilter": "फ़िल्टर जोड़ें",
  "music.lab.headroomHelp":
    "स्वचालित हेडरूम: {db} dB। संयुक्त फ़िल्टर पीक का अनुमान, साथ में 0.5 dB अतिरिक्त गुंजाइश। सकारात्मक मैन्युअल प्रीऐम्प यह गुंजाइश खर्च कर सकता है।",
  "music.lab.importExport": "सुधार आयात / निर्यात",
  "music.lab.importHelp":
    "Equalizer APO / AutoEQ फ़िल्टर टेक्स्ट चिपकाएँ। Q के साथ PK, LSC, HSC, LP, HP और NO समर्थित हैं। आयात फ़ाइल का प्रीऐम्प उपयोग करता है और स्वचालित हेडरूम बंद करता है। निर्यात तीव्रता और हेडरूम को नीचे के टेक्स्ट में शामिल करता है।",
  "music.lab.correctionText": "सुधार टेक्स्ट",
  "music.lab.import": "ड्राफ़्ट में आयात",
  "music.lab.export": "निर्यात टेक्स्ट बनाएँ",
  "music.lab.importError":
    "अमान्य या असमर्थित सुधार। 1–24 फ़िल्टर, 20–20,000 Hz, ±18 dB और Q 0.1–12 उपयोग करें। अन्य प्रोसेसिंग कमांड समर्थित नहीं हैं।",
  "music.lab.preamp": "प्रीऐम्प · dB",
  "music.lab.crossfeed": "हेडफ़ोन क्रॉसफ़ीड",
  "music.lab.crossfeedHelp":
    "हर स्टीरियो चैनल का फ़िल्टर किया हिस्सा दूसरे में मिलाता है ताकि हेडफ़ोन में अलगाव कम हो। 0% पर बंद।",
  "music.lab.bypass": "Harbor DSP बायपास करें",
  "music.lab.bypassHelp":
    "लागू करने के बाद EQ, प्रीऐम्प, क्रॉसफ़ीड, बैलेंस और ReplayGain बायपास होते हैं। आउटपुट और प्लेबैक वॉल्यूम सक्रिय रहते हैं। यह बिट-परफ़ेक्ट प्लेबैक की पुष्टि नहीं है।",
  "music.lab.exclusive": "एक्सक्लूसिव आउटपुट का अनुरोध",
  "music.lab.exclusiveHelp":
    "समर्थित आउटपुट सिस्टम मिक्सर बायपास कर सकते हैं और अन्य ऐप रोक सकते हैं। ड्राइवर समर्थन अलग होता है; यह स्विच अनुरोध है, एक्सक्लूसिव पहुँच की पुष्टि नहीं।",
  "music.lab.sampleRate": "आउटपुट सैंपल रेट",
  "music.lab.sourceRate": "स्रोत का अनुसरण",
  "music.lab.rateHelp":
    "निश्चित रेट का अनुरोध नहीं करता। डिवाइस दूसरा रेट चुन सकता है। निश्चित रेट ज़रूरत पर रीसैंपल करता है; कंप्रेशन में खोई जानकारी वापस नहीं आती।",
  "music.lab.equalizer": "इक्वलाइज़र",
  "music.lab.mode": "इक्वलाइज़र मोड",
  "music.lab.parametric": "पैरामीट्रिक · अधिकतम 24 फ़िल्टर",
};
export default musicListeningLab;
