const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Hörprofile",
  "music.lab.profilesHelp":
    "Speichere eine Korrektur pro Kopfhörer oder Lautsprecher. Laden ändert den Entwurf; Ausgang und Lautstärkegrenze bleiben erhalten. Zum Hören anwenden.",
  "music.lab.profileName": "Profilname",
  "music.lab.saveProfile": "Entwurf als Profil speichern",
  "music.lab.selectProfile": "Profil auswählen",
  "music.lab.loadProfile": "In Entwurf laden",
  "music.lab.delete": "Löschen",
  "music.lab.response": "Berechneter Equalizer-Frequenzgang",
  "music.lab.curveHelp":
    "EQ bei {rate} kHz vor dem Vorverstärker. Durchgezogen: Entwurf. Gestrichelt: angewendet. Berechnung, keine Gerätemessung.",
  "music.lab.strength": "Korrekturstärke",
  "music.lab.strengthHelp":
    "Skaliert Peak- und Shelf-Verstärkung. Pass- und Notch-Filter behalten ihre Form; 0 % umgeht alle parametrischen Filter.",
  "music.lab.filter": "Filter",
  "music.lab.enabled": "An",
  "music.lab.peak": "Peak",
  "music.lab.lowShelf": "Low Shelf",
  "music.lab.highShelf": "High Shelf",
  "music.lab.lowPass": "Tiefpass",
  "music.lab.highPass": "Hochpass",
  "music.lab.notch": "Kerbfilter",
  "music.lab.addFilter": "Filter hinzufügen",
  "music.lab.headroomHelp":
    "Automatische Reserve: {db} dB. Schätzt gemeinsame Filterspitzen mit 0,5 dB Reserve. Positive Vorverstärkung kann diese Reserve aufbrauchen.",
  "music.lab.importExport": "Korrektur importieren / exportieren",
  "music.lab.importHelp":
    "Equalizer-APO-/AutoEQ-Text einfügen. Unterstützt PK, LSC, HSC, LP, HP und NO mit Q. Import übernimmt den Vorverstärkerwert und deaktiviert die automatische Reserve. Export berücksichtigt Stärke und Reserve im Text unten.",
  "music.lab.correctionText": "Korrekturtext",
  "music.lab.import": "In Entwurf importieren",
  "music.lab.export": "Exporttext erstellen",
  "music.lab.importError":
    "Ungültige oder nicht unterstützte Korrektur. 1–24 Filter, 20–20.000 Hz, ±18 dB und Q 0,1–12. Andere Verarbeitungsbefehle werden nicht unterstützt.",
  "music.lab.preamp": "Vorverstärker · dB",
  "music.lab.crossfeed": "Kopfhörer-Crossfeed",
  "music.lab.crossfeedHelp":
    "Mischt einen gefilterten Anteil jedes Stereokanals in den anderen für weniger getrennte Kopfhörerwiedergabe. 0 % ist aus.",
  "music.lab.bypass": "Harbor-DSP umgehen",
  "music.lab.bypassHelp":
    "Umgeht nach Anwenden EQ, Vorverstärker, Crossfeed, Balance und ReplayGain. Ausgang und Wiedergabelautstärke bleiben aktiv. Kein Nachweis bitgenauer Wiedergabe.",
  "music.lab.exclusive": "Exklusiven Ausgang anfordern",
  "music.lab.exclusiveHelp":
    "Unterstützte Ausgänge können den Systemmixer umgehen und andere Apps blockieren. Treiberunterstützung variiert; dies fordert Zugriff an, bestätigt ihn aber nicht.",
  "music.lab.sampleRate": "Ausgabe-Abtastrate",
  "music.lab.sourceRate": "Quelle folgen",
  "music.lab.rateHelp":
    "Keine feste Rate anfordern. Das Ausgabegerät kann eine andere Rate aushandeln. Eine feste Rate führt bei Bedarf zu Resampling; verlorene Kompressionsdetails werden nicht wiederhergestellt.",
  "music.lab.equalizer": "Equalizer",
  "music.lab.mode": "Equalizer-Modus",
  "music.lab.parametric": "Parametrisch · bis zu 24 Filter",
};
export default musicListeningLab;
