const musicQuality: Record<string, string> = {
  "music.quality.title": "Параметры сигнала",
  "music.quality.lossy": "С потерями",
  "music.quality.lossless": "Без потерь",
  "music.quality.hiRes": "Hi-Res без потерь",
  "music.quality.unverified": "Не проверено",
  "music.quality.lossyHelp": "Сжатое аудио. Кодек и битрейт описывают текущий поток.",
  "music.quality.losslessHelp":
    "Кодек без потерь подтверждён. Это не доказывает качество исходного мастера.",
  "music.quality.hiResHelp":
    "Без потерь, не менее 24 бит и выше 48 кГц. Высокое разрешение не гарантирует лучший мастер.",
  "music.quality.unverifiedHelp": "Доступные метаданные не подтверждают точность источника.",
  "music.quality.source": "Источник",
  "music.quality.codec": "Кодек / формат",
  "music.quality.sourceDepth": "Разрядность источника",
  "music.quality.decodedRate": "Частота после декодирования",
  "music.quality.bitrate": "Битрейт",
  "music.quality.bits": "{depth} бит",
  "music.quality.output": "Выход",
  "music.quality.selectedOutput": "Выбранный выход",
  "music.quality.outputRate": "Частота выхода движка",
  "music.quality.outputHelp":
    "Система или ЦАП может менять частоту дискретизации. Настройки выхода не меняют точность источника.",
  "music.quality.on": "Вкл.",
  "music.quality.levels": "Уровни сигнала",
  "music.quality.unavailable": "Недоступно",
  "music.quality.channel": "Канал {number}",
  "music.quality.inactive": "Неактивно",
  "music.quality.meterHelp":
    "После обработки, до громкости плеера. Полосы показывают RMS, отметки — пиковые значения сэмплов.",
};
export default musicQuality;
