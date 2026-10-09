const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Profils d’écoute",
  "music.lab.profilesHelp":
    "Enregistrez une correction par casque ou enceinte. Le chargement modifie le brouillon ; la sortie et la limite de volume sont conservées. Appliquez pour écouter.",
  "music.lab.profileName": "Nom du profil",
  "music.lab.saveProfile": "Enregistrer le brouillon comme profil",
  "music.lab.selectProfile": "Choisir un profil",
  "music.lab.loadProfile": "Charger dans le brouillon",
  "music.lab.delete": "Supprimer",
  "music.lab.response": "Réponse calculée de l’égaliseur",
  "music.lab.curveHelp":
    "Réponse EQ à {rate} kHz, avant préamplification. Trait plein : brouillon. Pointillés : réglages appliqués. Calcul, pas une mesure du matériel.",
  "music.lab.strength": "Intensité de correction",
  "music.lab.strengthHelp":
    "Ajuste les gains des filtres en cloche et en plateau. Les filtres passe et coupe-bande gardent leur forme ; 0 % contourne tous les filtres paramétriques.",
  "music.lab.filter": "Filtre",
  "music.lab.enabled": "Activé",
  "music.lab.peak": "Cloche",
  "music.lab.lowShelf": "Plateau grave",
  "music.lab.highShelf": "Plateau aigu",
  "music.lab.lowPass": "Passe-bas",
  "music.lab.highPass": "Passe-haut",
  "music.lab.notch": "Coupe-bande",
  "music.lab.addFilter": "Ajouter un filtre",
  "music.lab.headroomHelp":
    "Marge automatique : {db} dB. Estime les crêtes combinées avec une réserve de 0,5 dB. Une préamplification positive peut consommer cette réserve.",
  "music.lab.importExport": "Importer / exporter une correction",
  "music.lab.importHelp":
    "Collez des filtres Equalizer APO / AutoEQ. Accepte PK, LSC, HSC, LP, HP et NO avec Q. L’import utilise le préampli du fichier et désactive la marge automatique. L’export intègre intensité et marge dans le texte ci-dessous.",
  "music.lab.correctionText": "Texte de correction",
  "music.lab.import": "Importer dans le brouillon",
  "music.lab.export": "Générer le texte d’export",
  "music.lab.importError":
    "Correction invalide ou incompatible. Utilisez 1–24 filtres, 20–20 000 Hz, ±18 dB et Q 0,1–12. Les autres commandes ne sont pas prises en charge.",
  "music.lab.preamp": "Préampli · dB",
  "music.lab.crossfeed": "Crossfeed pour casque",
  "music.lab.crossfeedHelp":
    "Mélange une partie filtrée de chaque canal dans l’autre pour réduire la séparation au casque. 0 % désactive l’effet.",
  "music.lab.bypass": "Contourner le DSP Harbor",
  "music.lab.bypassHelp":
    "Après application, contourne EQ, préampli, crossfeed, balance et ReplayGain. Sortie et volume restent actifs. Ne vérifie pas une lecture bit-perfect.",
  "music.lab.exclusive": "Demander une sortie exclusive",
  "music.lab.exclusiveHelp":
    "Les sorties compatibles peuvent contourner le mixeur système et bloquer les autres apps. Cela dépend du pilote ; cette option demande l’accès sans le confirmer.",
  "music.lab.sampleRate": "Fréquence d’échantillonnage de sortie",
  "music.lab.sourceRate": "Suivre la source",
  "music.lab.rateHelp":
    "Ne demande aucune fréquence fixe. Le périphérique peut en négocier une autre. Une fréquence fixe rééchantillonne au besoin ; elle ne restaure pas les détails perdus par compression.",
  "music.lab.equalizer": "Égaliseur",
  "music.lab.mode": "Mode d’égaliseur",
  "music.lab.parametric": "Paramétrique · jusqu’à 24 filtres",
};
export default musicListeningLab;
