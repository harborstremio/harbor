const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "聆听配置",
  "music.lab.profilesHelp":
    "为每副耳机或音箱保存校正。载入仅修改草稿，保留输出路径和音量上限。应用后即可听到效果。",
  "music.lab.profileName": "配置名称",
  "music.lab.saveProfile": "将草稿保存为配置",
  "music.lab.selectProfile": "选择配置",
  "music.lab.loadProfile": "载入草稿",
  "music.lab.delete": "删除",
  "music.lab.response": "计算的均衡器响应",
  "music.lab.curveHelp":
    "{rate} kHz 下、前级之前的 EQ 响应。实线：草稿。虚线：已应用设置。这是计算值，并非设备测量值。",
  "music.lab.strength": "校正强度",
  "music.lab.strengthHelp":
    "缩放峰值和搁架滤波器的增益。通带和陷波滤波器保持形状；0% 旁通全部参数滤波器。",
  "music.lab.filter": "滤波器",
  "music.lab.enabled": "开启",
  "music.lab.peak": "峰值",
  "music.lab.lowShelf": "低搁架",
  "music.lab.highShelf": "高搁架",
  "music.lab.lowPass": "低通",
  "music.lab.highPass": "高通",
  "music.lab.notch": "陷波",
  "music.lab.addFilter": "添加滤波器",
  "music.lab.headroomHelp":
    "自动余量：{db} dB。估算滤波器叠加峰值，并预留 0.5 dB。手动增加前级增益可能耗尽此余量。",
  "music.lab.importExport": "导入 / 导出校正",
  "music.lab.importHelp":
    "粘贴 Equalizer APO / AutoEQ 滤波器文本。支持带 Q 的 PK、LSC、HSC、LP、HP 和 NO。导入采用文件的前级值并关闭自动余量。导出将当前强度和余量写入下方文本。",
  "music.lab.correctionText": "校正文本",
  "music.lab.import": "导入草稿",
  "music.lab.export": "生成导出文本",
  "music.lab.importError":
    "校正无效或不受支持。请使用 1–24 个滤波器、20–20,000 Hz、±18 dB、Q 0.1–12。不支持其他处理命令。",
  "music.lab.preamp": "前级 · dB",
  "music.lab.crossfeed": "耳机交叉馈送",
  "music.lab.crossfeedHelp":
    "将每个立体声通道的部分信号滤波后混入另一通道，减轻耳机的左右分离感。0% 为关闭。",
  "music.lab.bypass": "旁通 Harbor DSP",
  "music.lab.bypassHelp":
    "应用后旁通 EQ、前级、交叉馈送、平衡和 ReplayGain。输出设置与播放音量仍生效。这不代表已验证比特完美播放。",
  "music.lab.exclusive": "请求独占输出",
  "music.lab.exclusiveHelp":
    "支持的输出可绕过系统混音器，并可能阻止其他应用。支持程度取决于驱动；此开关仅请求独占，并不确认已获得独占访问。",
  "music.lab.sampleRate": "输出采样率",
  "music.lab.sourceRate": "跟随音源",
  "music.lab.rateHelp":
    "不请求固定采样率。输出设备可能协商其他采样率。固定采样率会在需要时重采样，无法恢复压缩丢失的细节。",
  "music.lab.equalizer": "均衡器",
  "music.lab.mode": "均衡器模式",
  "music.lab.parametric": "参数均衡 · 最多 24 个滤波器",
};
export default musicListeningLab;
