const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Profili di ascolto",
  "music.lab.profilesHelp":
    "Salva una correzione per ogni cuffia o diffusore. Il caricamento modifica la bozza; uscita e limite volume restano invariati. Applica per ascoltare.",
  "music.lab.profileName": "Nome profilo",
  "music.lab.saveProfile": "Salva bozza come profilo",
  "music.lab.selectProfile": "Seleziona profilo",
  "music.lab.loadProfile": "Carica nella bozza",
  "music.lab.delete": "Elimina",
  "music.lab.response": "Risposta calcolata dell’equalizzatore",
  "music.lab.curveHelp":
    "Risposta EQ a {rate} kHz, prima del preamplificatore. Continua: bozza. Tratteggiata: impostazioni applicate. È un calcolo, non una misura del dispositivo.",
  "music.lab.strength": "Intensità della correzione",
  "music.lab.strengthHelp":
    "Scala il guadagno dei filtri a picco e shelving. Passa e notch mantengono la forma; 0% esclude tutti i filtri parametrici.",
  "music.lab.filter": "Filtro",
  "music.lab.enabled": "Attivo",
  "music.lab.peak": "Picco",
  "music.lab.lowShelf": "Shelving bassi",
  "music.lab.highShelf": "Shelving alti",
  "music.lab.lowPass": "Passa basso",
  "music.lab.highPass": "Passa alto",
  "music.lab.notch": "Notch",
  "music.lab.addFilter": "Aggiungi filtro",
  "music.lab.headroomHelp":
    "Margine automatico: {db} dB. Stima i picchi combinati con 0,5 dB di riserva. Il preamplificatore positivo può consumare la riserva.",
  "music.lab.importExport": "Importa / esporta correzione",
  "music.lab.importHelp":
    "Incolla filtri Equalizer APO / AutoEQ. Supporta PK, LSC, HSC, LP, HP e NO con Q. L’importazione usa il preamplificatore del file e disattiva il margine automatico. L’esportazione include intensità e margine nel testo sottostante.",
  "music.lab.correctionText": "Testo correzione",
  "music.lab.import": "Importa nella bozza",
  "music.lab.export": "Genera testo di esportazione",
  "music.lab.importError":
    "Correzione non valida o non supportata. Usa 1–24 filtri, 20–20.000 Hz, ±18 dB e Q 0,1–12. Altri comandi non sono supportati.",
  "music.lab.preamp": "Preamplificatore · dB",
  "music.lab.crossfeed": "Crossfeed per cuffie",
  "music.lab.crossfeedHelp":
    "Miscela una parte filtrata di ogni canale stereo nell’altro per ridurre la separazione in cuffia. 0% lo disattiva.",
  "music.lab.bypass": "Escludi DSP Harbor",
  "music.lab.bypassHelp":
    "Dopo Applica, esclude EQ, preamplificatore, crossfeed, bilanciamento e ReplayGain. Uscita e volume restano attivi. Non verifica la riproduzione bit-perfect.",
  "music.lab.exclusive": "Richiedi uscita esclusiva",
  "music.lab.exclusiveHelp":
    "Le uscite compatibili possono evitare il mixer di sistema e bloccare altre app. Dipende dal driver; questa opzione richiede l’accesso, non lo conferma.",
  "music.lab.sampleRate": "Frequenza di campionamento in uscita",
  "music.lab.sourceRate": "Segui sorgente",
  "music.lab.rateHelp":
    "Non richiede una frequenza fissa. Il dispositivo può negoziarne un’altra. Una frequenza fissa ricampiona se necessario; non recupera dettagli persi nella compressione.",
  "music.lab.equalizer": "Equalizzatore",
  "music.lab.mode": "Modalità equalizzatore",
  "music.lab.parametric": "Parametrico · fino a 24 filtri",
};
export default musicListeningLab;
