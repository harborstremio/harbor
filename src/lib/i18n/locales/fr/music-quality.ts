const musicQuality: Record<string, string> = {
  "music.quality.title": "Détails du signal",
  "music.quality.lossy": "Avec perte",
  "music.quality.lossless": "Sans perte",
  "music.quality.hiRes": "Haute résolution sans perte",
  "music.quality.unverified": "Non vérifié",
  "music.quality.lossyHelp": "Audio compressé. Le codec et le débit décrivent le flux actuel.",
  "music.quality.losslessHelp":
    "Un codec sans perte est vérifié. Cela ne prouve pas la qualité du master original.",
  "music.quality.hiResHelp":
    "Sans perte, au moins 24 bits et au-delà de 48 kHz. Une résolution supérieure ne garantit pas un meilleur master.",
  "music.quality.unverifiedHelp":
    "Les métadonnées disponibles ne permettent pas de confirmer la fidélité de la source.",
  "music.quality.source": "Source",
  "music.quality.codec": "Codec / format",
  "music.quality.sourceDepth": "Profondeur de la source",
  "music.quality.decodedRate": "Fréquence décodée",
  "music.quality.bitrate": "Débit",
  "music.quality.bits": "{depth} bits",
  "music.quality.output": "Sortie",
  "music.quality.selectedOutput": "Sortie sélectionnée",
  "music.quality.outputRate": "Fréquence de sortie du moteur",
  "music.quality.outputHelp":
    "Le système ou le DAC peut rééchantillonner. Les réglages de sortie ne changent pas la fidélité de la source.",
  "music.quality.on": "Activé",
  "music.quality.levels": "Niveaux du signal",
  "music.quality.unavailable": "Indisponible",
  "music.quality.channel": "Canal {number}",
  "music.quality.inactive": "Inactif",
  "music.quality.meterHelp":
    "Après traitement, avant le volume du lecteur. Les barres indiquent le RMS, les repères les crêtes des échantillons.",
};
export default musicQuality;
