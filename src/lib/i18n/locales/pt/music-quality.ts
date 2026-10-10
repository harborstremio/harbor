const musicQuality: Record<string, string> = {
  "music.quality.title": "Detalhes do sinal",
  "music.quality.lossy": "Com perdas",
  "music.quality.lossless": "Sem perdas",
  "music.quality.hiRes": "Alta resolução sem perdas",
  "music.quality.unverified": "Não verificado",
  "music.quality.lossyHelp":
    "Áudio comprimido. O codec e a taxa de bits descrevem a transmissão atual.",
  "music.quality.losslessHelp":
    "Foi verificado um codec sem perdas. Isso não comprova a qualidade do master original.",
  "music.quality.hiResHelp":
    "Sem perdas, pelo menos 24 bits e acima de 48 kHz. Maior resolução não garante um master melhor.",
  "music.quality.unverifiedHelp": "Os metadados disponíveis não comprovam a fidelidade da fonte.",
  "music.quality.source": "Fonte",
  "music.quality.codec": "Codec / formato",
  "music.quality.sourceDepth": "Profundidade de bits da fonte",
  "music.quality.decodedRate": "Taxa de amostragem decodificada",
  "music.quality.bitrate": "Taxa de bits",
  "music.quality.bits": "{depth} bits",
  "music.quality.output": "Saída",
  "music.quality.selectedOutput": "Saída selecionada",
  "music.quality.outputRate": "Taxa de saída do mecanismo",
  "music.quality.outputHelp":
    "O sistema ou DAC pode reamostrar. As configurações de saída não alteram a fidelidade da fonte.",
  "music.quality.on": "Ativado",
  "music.quality.levels": "Níveis do sinal",
  "music.quality.unavailable": "Indisponível",
  "music.quality.channel": "Canal {number}",
  "music.quality.inactive": "Inativo",
  "music.quality.meterHelp":
    "Após o processamento, antes do volume do reprodutor. As barras mostram RMS; as marcas, picos de amostras.",
};
export default musicQuality;
