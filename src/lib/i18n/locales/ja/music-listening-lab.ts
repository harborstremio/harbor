const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "リスニングプロファイル",
  "music.lab.profilesHelp":
    "ヘッドホンやスピーカーごとに補正を保存します。読み込みは下書きだけを変更し、出力先と音量上限を維持します。適用すると音に反映されます。",
  "music.lab.profileName": "プロファイル名",
  "music.lab.saveProfile": "下書きをプロファイルに保存",
  "music.lab.selectProfile": "プロファイルを選択",
  "music.lab.loadProfile": "下書きに読み込む",
  "music.lab.delete": "削除",
  "music.lab.response": "計算したイコライザー応答",
  "music.lab.curveHelp":
    "{rate} kHzでのプリアンプ前のEQ応答。実線：下書き。破線：適用済み設定。機器の測定値ではなく計算値です。",
  "music.lab.strength": "補正の強さ",
  "music.lab.strengthHelp":
    "ピークとシェルフのゲインを調整します。パスとノッチの形状は維持されます。0%ですべてのパラメトリックフィルターを迂回します。",
  "music.lab.filter": "フィルター",
  "music.lab.enabled": "オン",
  "music.lab.peak": "ピーク",
  "music.lab.lowShelf": "ローシェルフ",
  "music.lab.highShelf": "ハイシェルフ",
  "music.lab.lowPass": "ローパス",
  "music.lab.highPass": "ハイパス",
  "music.lab.notch": "ノッチ",
  "music.lab.addFilter": "フィルターを追加",
  "music.lab.headroomHelp":
    "自動ヘッドルーム：{db} dB。フィルター全体のピークを推定し、0.5 dBの余裕を設けます。プリアンプの正のゲインはこの余裕を消費します。",
  "music.lab.importExport": "補正のインポート / エクスポート",
  "music.lab.importHelp":
    "Equalizer APO / AutoEQのテキストを貼り付けます。Q付きのPK、LSC、HSC、LP、HP、NOに対応。インポートはファイルのプリアンプ値を使用し、自動ヘッドルームを無効にします。エクスポートは強さとヘッドルームを下のテキストに反映します。",
  "music.lab.correctionText": "補正テキスト",
  "music.lab.import": "下書きにインポート",
  "music.lab.export": "エクスポート用テキストを生成",
  "music.lab.importError":
    "未対応または無効な補正です。フィルター1～24個、20～20,000 Hz、±18 dB、Q 0.1～12を使用してください。他の処理コマンドには対応していません。",
  "music.lab.preamp": "プリアンプ · dB",
  "music.lab.crossfeed": "ヘッドホンクロスフィード",
  "music.lab.crossfeedHelp":
    "各ステレオチャンネルの一部をフィルター処理して反対側に混ぜ、ヘッドホンの左右分離を緩和します。0%でオフ。",
  "music.lab.bypass": "Harbor DSPを迂回",
  "music.lab.bypassHelp":
    "適用後、EQ、プリアンプ、クロスフィード、バランス、ReplayGainを迂回します。出力設定と再生音量は有効なままです。ビットパーフェクト再生を検証する機能ではありません。",
  "music.lab.exclusive": "排他出力を要求",
  "music.lab.exclusiveHelp":
    "対応出力はシステムミキサーを迂回し、他のアプリを制限する場合があります。対応はドライバー次第です。この設定は要求であり、排他アクセスの確認ではありません。",
  "music.lab.sampleRate": "出力サンプルレート",
  "music.lab.sourceRate": "ソースに合わせる",
  "music.lab.rateHelp":
    "固定レートを要求しません。機器が別のレートを選ぶ場合があります。固定レートでは必要に応じて再サンプリングしますが、圧縮で失われた情報は復元できません。",
  "music.lab.equalizer": "イコライザー",
  "music.lab.mode": "イコライザーモード",
  "music.lab.parametric": "パラメトリック · 最大24フィルター",
};
export default musicListeningLab;
