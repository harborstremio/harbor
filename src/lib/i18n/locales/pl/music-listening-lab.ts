const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Profile odsłuchu",
  "music.lab.profilesHelp":
    "Zapisz korekcję dla każdej pary słuchawek lub głośników. Wczytanie zmienia wersję roboczą; wyjście i limit głośności pozostają bez zmian. Zastosuj, aby posłuchać.",
  "music.lab.profileName": "Nazwa profilu",
  "music.lab.saveProfile": "Zapisz wersję roboczą jako profil",
  "music.lab.selectProfile": "Wybierz profil",
  "music.lab.loadProfile": "Wczytaj do wersji roboczej",
  "music.lab.delete": "Usuń",
  "music.lab.response": "Obliczona charakterystyka korektora",
  "music.lab.curveHelp":
    "Charakterystyka EQ przy {rate} kHz, przed przedwzmacniaczem. Ciągła: wersja robocza. Przerywana: zastosowane ustawienia. To obliczenie, nie pomiar urządzenia.",
  "music.lab.strength": "Siła korekcji",
  "music.lab.strengthHelp":
    "Skaluje wzmocnienie filtrów szczytowych i półkowych. Filtry przepustowe i zaporowe zachowują kształt; 0% omija wszystkie filtry parametryczne.",
  "music.lab.filter": "Filtr",
  "music.lab.enabled": "Wł.",
  "music.lab.peak": "Szczytowy",
  "music.lab.lowShelf": "Dolna półka",
  "music.lab.highShelf": "Górna półka",
  "music.lab.lowPass": "Dolnoprzepustowy",
  "music.lab.highPass": "Górnoprzepustowy",
  "music.lab.notch": "Zaporowy",
  "music.lab.addFilter": "Dodaj filtr",
  "music.lab.headroomHelp":
    "Automatyczny zapas: {db} dB. Szacuje łączne szczyty z rezerwą 0,5 dB. Dodatnie przedwzmocnienie może zużyć tę rezerwę.",
  "music.lab.importExport": "Import / eksport korekcji",
  "music.lab.importHelp":
    "Wklej filtry Equalizer APO / AutoEQ. Obsługuje PK, LSC, HSC, LP, HP i NO z Q. Import używa przedwzmocnienia pliku i wyłącza automatyczny zapas. Eksport uwzględnia siłę i zapas w tekście poniżej.",
  "music.lab.correctionText": "Tekst korekcji",
  "music.lab.import": "Importuj do wersji roboczej",
  "music.lab.export": "Utwórz tekst eksportu",
  "music.lab.importError":
    "Nieprawidłowa lub nieobsługiwana korekcja. Użyj 1–24 filtrów, 20–20 000 Hz, ±18 dB i Q 0,1–12. Inne polecenia przetwarzania nie są obsługiwane.",
  "music.lab.preamp": "Przedwzmacniacz · dB",
  "music.lab.crossfeed": "Crossfeed słuchawek",
  "music.lab.crossfeedHelp":
    "Miesza przefiltrowaną część każdego kanału stereo z drugim, zmniejszając separację w słuchawkach. 0% wyłącza efekt.",
  "music.lab.bypass": "Omiń DSP Harbor",
  "music.lab.bypassHelp":
    "Po zastosowaniu omija EQ, przedwzmacniacz, crossfeed, balans i ReplayGain. Wyjście i głośność pozostają aktywne. Nie potwierdza odtwarzania bit-perfect.",
  "music.lab.exclusive": "Zażądaj wyjścia wyłącznego",
  "music.lab.exclusiveHelp":
    "Obsługiwane wyjścia mogą omijać mikser systemowy i blokować inne aplikacje. Zależy to od sterownika; przełącznik żąda dostępu, ale go nie potwierdza.",
  "music.lab.sampleRate": "Częstotliwość próbkowania wyjścia",
  "music.lab.sourceRate": "Zgodna ze źródłem",
  "music.lab.rateHelp":
    "Nie żąda stałej częstotliwości. Urządzenie może wynegocjować inną. Stała częstotliwość powoduje resampling w razie potrzeby; nie odzyskuje szczegółów utraconych przy kompresji.",
  "music.lab.equalizer": "Korektor",
  "music.lab.mode": "Tryb korektora",
  "music.lab.parametric": "Parametryczny · do 24 filtrów",
};
export default musicListeningLab;
