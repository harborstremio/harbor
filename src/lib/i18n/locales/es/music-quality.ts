const musicQuality: Record<string, string> = {
  "music.quality.title": "Detalles de la señal",
  "music.quality.lossy": "Con pérdida",
  "music.quality.lossless": "Sin pérdida",
  "music.quality.hiRes": "Alta resolución sin pérdida",
  "music.quality.unverified": "Sin verificar",
  "music.quality.lossyHelp":
    "Audio comprimido. El códec y la tasa de bits describen la transmisión actual.",
  "music.quality.losslessHelp":
    "Se ha verificado un códec sin pérdida. Esto no acredita la calidad del máster original.",
  "music.quality.hiResHelp":
    "Sin pérdida, al menos 24 bits y más de 48 kHz. Una mayor resolución no garantiza un mejor máster.",
  "music.quality.unverifiedHelp":
    "Los metadatos disponibles no acreditan la fidelidad de la fuente.",
  "music.quality.source": "Fuente",
  "music.quality.codec": "Códec / formato",
  "music.quality.sourceDepth": "Profundidad de bits de la fuente",
  "music.quality.decodedRate": "Frecuencia de muestreo decodificada",
  "music.quality.bitrate": "Tasa de bits",
  "music.quality.bits": "{depth} bits",
  "music.quality.output": "Salida",
  "music.quality.selectedOutput": "Salida seleccionada",
  "music.quality.outputRate": "Frecuencia de salida del motor",
  "music.quality.outputHelp":
    "El sistema o DAC puede remuestrear. Los ajustes de salida no cambian la fidelidad de la fuente.",
  "music.quality.on": "Activado",
  "music.quality.levels": "Niveles de señal",
  "music.quality.unavailable": "No disponible",
  "music.quality.channel": "Canal {number}",
  "music.quality.inactive": "Inactivo",
  "music.quality.meterHelp":
    "Después del procesamiento, antes del volumen del reproductor. Las barras indican RMS; las marcas, picos de muestra.",
};
export default musicQuality;
