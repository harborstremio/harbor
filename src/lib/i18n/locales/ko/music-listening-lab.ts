const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "청취 프로필",
  "music.lab.profilesHelp":
    "헤드폰이나 스피커별 보정을 저장합니다. 불러오기는 초안만 변경하며 출력 경로와 음량 한도는 유지합니다. 적용하면 소리에 반영됩니다.",
  "music.lab.profileName": "프로필 이름",
  "music.lab.saveProfile": "초안을 프로필로 저장",
  "music.lab.selectProfile": "프로필 선택",
  "music.lab.loadProfile": "초안으로 불러오기",
  "music.lab.delete": "삭제",
  "music.lab.response": "계산된 이퀄라이저 응답",
  "music.lab.curveHelp":
    "{rate} kHz에서 프리앰프 전 EQ 응답. 실선: 초안. 점선: 적용된 설정. 기기 측정값이 아닌 계산값입니다.",
  "music.lab.strength": "보정 강도",
  "music.lab.strengthHelp":
    "피크와 셸프 게인을 조절합니다. 패스와 노치 필터는 형태를 유지하며, 0%는 모든 파라메트릭 필터를 우회합니다.",
  "music.lab.filter": "필터",
  "music.lab.enabled": "켜짐",
  "music.lab.peak": "피크",
  "music.lab.lowShelf": "로우 셸프",
  "music.lab.highShelf": "하이 셸프",
  "music.lab.lowPass": "로우 패스",
  "music.lab.highPass": "하이 패스",
  "music.lab.notch": "노치",
  "music.lab.addFilter": "필터 추가",
  "music.lab.headroomHelp":
    "자동 헤드룸: {db} dB. 필터의 합산 피크를 추정하고 0.5 dB 여유를 둡니다. 양의 프리앰프 게인은 이 여유를 소모할 수 있습니다.",
  "music.lab.importExport": "보정 가져오기 / 내보내기",
  "music.lab.importHelp":
    "Equalizer APO / AutoEQ 필터 텍스트를 붙여넣으세요. Q가 있는 PK, LSC, HSC, LP, HP, NO를 지원합니다. 가져오기는 파일의 프리앰프를 사용하고 자동 헤드룸을 끕니다. 내보내기는 강도와 헤드룸을 아래 텍스트에 반영합니다.",
  "music.lab.correctionText": "보정 텍스트",
  "music.lab.import": "초안으로 가져오기",
  "music.lab.export": "내보낼 텍스트 생성",
  "music.lab.importError":
    "잘못되었거나 지원하지 않는 보정입니다. 필터 1–24개, 20–20,000 Hz, ±18 dB, Q 0.1–12를 사용하세요. 다른 처리 명령은 지원하지 않습니다.",
  "music.lab.preamp": "프리앰프 · dB",
  "music.lab.crossfeed": "헤드폰 크로스피드",
  "music.lab.crossfeedHelp":
    "각 스테레오 채널의 일부를 필터링해 반대 채널에 섞어 헤드폰의 좌우 분리를 줄입니다. 0%는 꺼짐입니다.",
  "music.lab.bypass": "Harbor DSP 우회",
  "music.lab.bypassHelp":
    "적용 후 EQ, 프리앰프, 크로스피드, 밸런스, ReplayGain을 우회합니다. 출력 설정과 재생 음량은 유지됩니다. 비트 퍼펙트 재생을 검증하지는 않습니다.",
  "music.lab.exclusive": "독점 출력 요청",
  "music.lab.exclusiveHelp":
    "지원 출력은 시스템 믹서를 우회하고 다른 앱을 차단할 수 있습니다. 드라이버에 따라 다릅니다. 이 스위치는 접근 요청이며 독점 접근 확인이 아닙니다.",
  "music.lab.sampleRate": "출력 샘플레이트",
  "music.lab.sourceRate": "소스 따르기",
  "music.lab.rateHelp":
    "고정 레이트를 요청하지 않습니다. 출력 기기가 다른 레이트를 협상할 수 있습니다. 고정 레이트는 필요 시 리샘플링하며 압축으로 잃은 정보를 복원하지 않습니다.",
  "music.lab.equalizer": "이퀄라이저",
  "music.lab.mode": "이퀄라이저 모드",
  "music.lab.parametric": "파라메트릭 · 최대 24개 필터",
};
export default musicListeningLab;
