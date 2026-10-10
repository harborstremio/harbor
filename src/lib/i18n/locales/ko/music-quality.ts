const musicQuality: Record<string, string> = {
  "music.quality.title": "신호 정보",
  "music.quality.lossy": "손실 압축",
  "music.quality.lossless": "무손실",
  "music.quality.hiRes": "고해상도 무손실",
  "music.quality.unverified": "미확인",
  "music.quality.lossyHelp": "압축된 오디오입니다. 코덱과 비트레이트는 현재 스트림을 설명합니다.",
  "music.quality.losslessHelp":
    "무손실 코덱이 확인되었습니다. 원본 마스터의 품질을 증명하지는 않습니다.",
  "music.quality.hiResHelp":
    "최소 24비트 및 48 kHz 초과의 무손실 오디오입니다. 높은 해상도가 더 좋은 마스터를 보장하지 않습니다.",
  "music.quality.unverifiedHelp": "사용 가능한 메타데이터로는 소스의 충실도를 확인할 수 없습니다.",
  "music.quality.source": "소스",
  "music.quality.codec": "코덱 / 형식",
  "music.quality.sourceDepth": "소스 비트 심도",
  "music.quality.decodedRate": "디코딩된 샘플 레이트",
  "music.quality.bitrate": "비트레이트",
  "music.quality.bits": "{depth}비트",
  "music.quality.output": "출력",
  "music.quality.selectedOutput": "선택한 출력",
  "music.quality.outputRate": "엔진 출력 레이트",
  "music.quality.outputHelp":
    "시스템이나 DAC가 리샘플링할 수 있습니다. 출력 설정은 소스의 충실도를 바꾸지 않습니다.",
  "music.quality.on": "켜짐",
  "music.quality.levels": "신호 레벨",
  "music.quality.unavailable": "사용 불가",
  "music.quality.channel": "채널 {number}",
  "music.quality.inactive": "비활성",
  "music.quality.meterHelp":
    "처리 후, 플레이어 볼륨 적용 전입니다. 막대는 RMS를, 표시는 샘플 피크를 나타냅니다.",
};
export default musicQuality;
