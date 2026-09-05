const settings: Record<string, string> = {
  "Smooth scrolling": "スムーズスクロール",
  "Eases mouse-wheel scrolling instead of jumping line by line. Turn off if you prefer an instant response or notice any lag.":
    "マウスホイールで1行ずつ飛ぶのではなく、滑らかにスクロールします。即時に反応させたい場合や遅延が気になる場合はオフにしてください。",
  "Sign in to Harbor": "Harborにサインイン",
  "Create Harbor account": "Harborアカウントを作成",
  "Claim your handle": "ハンドルネームを取得",
  "Reset password (recovery key)": "パスワードをリセット（リカバリーキー）",
  "Sign out of Harbor account": "Harborアカウントからサインアウト",
  "Verified status": "認証ステータス",
  "Settings for this profile (shared or independent)": "このプロフィールの設定（共有または個別）",
  "PIN-locked profiles": "PINロック付きプロフィール",
  "Home style (Harbor curated / Classic Stremio)":
    "ホームのスタイル（Harborセレクション / クラシックStremio）",
  "When the latest episode ends (Hide / Timer)": "最新エピソードの終了時（非表示 / タイマー）",
  "Remove shows once you're caught up": "最新話まで視聴した作品を削除",
  "AI search provider (OpenRouter / Groq)": "AI検索プロバイダー（OpenRouter / Groq）",
  "Custom model id": "カスタムモデルID",
  "Use live web context (Jina Reader)": "リアルタイムのWebコンテキストを使用（Jina Reader）",
  "Jina API key": "Jina APIキー",
  "Song ID provider (AudD / Gemini)": "楽曲認識プロバイダー（AudD / Gemini）",
  "Show an on-disk badge on cards": "カードにローカル保存済みバッジを表示",
  "Minimum file size (local scan)": "最小ファイルサイズ（ローカルスキャン）",
  "Local playback preference (Ask / Play local / Stream)":
    "ローカル再生の優先設定（確認 / ローカル再生 / ストリーミング）",
  "Export artwork sizes (Poster / Backdrop / Logo)":
    "アートワークの書き出しサイズ（ポスター / 背景 / ロゴ）",
  "Sync indicator position": "同期インジケーターの位置",
  "Scrobble to Simkl": "Simklに視聴履歴を送信",
  "Display Simkl Community Ratings": "Simklコミュニティ評価を表示",
  "Home rail categories (Movies, TV, Anime)": "ホームのレールカテゴリー（映画、TV、アニメ）",
  "Relay version status": "Relayのバージョン状況",
  "Download relay documentation": "Relayのドキュメントをダウンロード",
  "Set active filter": "有効なフィルターに設定",
  "Resolution filter": "解像度フィルター",
  "Source filter": "ソースフィルター",
  "Codec filter": "コーデックフィルター",
  "Audio filter": "音声フィルター",
  "Snapdragon SGSR upscaler": "Snapdragon SGSRアップスケーラー",
  "RAVU Lite prescaler": "RAVU Liteプレスケーラー",
  "NNEDI3 neural upscaler": "NNEDI3ニューラルアップスケーラー",
  "SSimSuperRes detail refinement": "SSimSuperResディテール補正",
  "KrigBilateral chroma upscaler": "KrigBilateral色差アップスケーラー",
  "Adaptive Sharpen": "適応シャープ化",
  "Short seek back": "短く巻き戻す",
  "Short seek forward": "短く早送りする",
  "Live controller preview": "コントローラーのライブプレビュー",
  "Normalize embedded subtitle size": "埋め込み字幕のサイズを統一",
  "SUBDL subtitle source": "SUBDL字幕ソース",
  "Subsource subtitle source": "Subsource字幕ソース",
  "Auto-apply audio-derived sync fixes": "音声ベースの同期補正を自動適用",
  "Community sync server URL": "コミュニティ同期サーバーのURL",
  "Private mode (no community sync contact)": "プライベートモード（コミュニティ同期に接続しない）",
  "Poster image quality": "ポスター画像の品質",
  "Home hero featured source": "ホームのヒーロー表示のソース",
  "Export badge setup": "バッジ設定をエクスポート",
  "Reset badges to default": "バッジをデフォルトに戻す",
  "Downloaded community badge packs": "ダウンロード済みのコミュニティ製バッジパック",
  "Test badge rules (Try it)": "バッジルールをテスト（試す）",
  "Tracked person release rule": "フォロー中の人物のリリースルール",
  "Genre release rule": "ジャンル別リリースルール",
  "Streamer release rule": "配信サービス別リリースルール",
  "Country release rule": "国別リリースルール",
  "Live TV reminder": "ライブTVのリマインダー",
  "Enable or disable rule": "ルールを有効または無効にする",
  "Rule notify channels": "ルールの通知チャンネル",
  "Contact email or Discord": "連絡先メールアドレスまたはDiscord",
  "Settings storage breakdown": "設定データの使用量内訳",
  "Create folders for movies and shows": "映画とシリーズ用のフォルダーを作成",
  "Delete {name}": "{name}を削除",
  "My filter": "マイフィルター",
  Codec: "コーデック",
  "HDR only": "HDRのみ",
  "Keep Dolby Vision, HDR10, HLG. Drop SDR.": "Dolby Vision、HDR10、HLGを残し、SDRを除外します。",
  "Only streams already in your debrid library.": "debridライブラリにすでにあるストリームのみ。",
  "Min seeders": "最小シーダー数",
  "Excludes direct and debrid streams with no seeders.":
    "シーダーがいない直接ストリームとdebridストリームを除外します。",
  "Max size (GB)": "最大サイズ（GB）",
  "Caps file size. Unknown sizes still pass.":
    "ファイルサイズに上限を設定します。サイズ不明のファイルは除外されません。",
  "No dimensions set. This filter matches every stream.":
    "条件が設定されていません。このフィルターはすべてのストリームに一致します。",
  "Trying source {n}": "ソース{n}を試しています",
  "Last source wasn't actually cached on your debrid yet. Trying another.":
    "前のソースはまだdebridにキャッシュされていませんでした。別のソースを試します。",
  "A TOP 10 corner ribbon on the Top 10 rail posters. The watchlist marker auto-moves to the opposite corner so nothing overlaps.":
    "トップ10レールのポスター隅に表示されるTOP 10リボンです。重ならないよう、ウォッチリストマーカーは自動的に反対側の隅へ移動します。",
  "A live preview of your player. Open the editor to move, hide, or reorder any control.":
    "プレーヤーのライブプレビューです。エディターを開くと、各コントロールの移動、非表示、並べ替えができます。",
  "AI Search · Groq LPU inference": "AI検索 · Groq LPU推論",
  "Above ratings": "評価の上",
  "Add a TMDB key above to unlock.": "上にTMDBキーを追加すると利用できます。",
  "Add an MDBList key above to unlock.": "上にMDBListキーを追加すると利用できます。",
  "Add an OMDb key above to unlock.": "上にOMDbキーを追加すると利用できます。",
  "Add rule": "ルールを追加",
  "Adds a timer button next to Downloads. Set a time or episode limit from anywhere; playback pauses when it runs out.":
    "「ダウンロード」の横にタイマーボタンを追加します。どの画面からでも時間またはエピソード数の上限を設定でき、上限に達すると再生が一時停止します。",
  "After a moment on a slide, the featured title's trailer plays muted in the background. Uses more bandwidth.":
    "スライドをしばらく表示すると、注目作品の予告編がバックグラウンドでミュート再生されます。通信量が増加します。",
  "After the current show's episodes, Next flows into your queue. Off keeps Next/Previous within the current show only.":
    "現在の番組のエピソードが終わると、「次へ」でキューに進みます。オフにすると、「次へ」/「前へ」は現在の番組内でのみ移動します。",
  "After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Harbor keeps picking one for you automatically.":
    "ソースを選んだ後、動画の再生前に字幕選択を表示し、トラックと言語を指定できます。デフォルトではオフで、Harborが自動的に選択します。",
  Aired: "放送順",
  "All badges back to default": "すべてのバッジをデフォルトに戻しました",
  "All custom rules removed": "すべてのカスタムルールを削除しました",
  "Any badges.json link works: a raw gist, Pastebin, or repo file. Broken JSON gets auto-repaired.":
    "raw gist、Pastebin、リポジトリ内のファイルなど、任意のbadges.jsonリンクを使用できます。壊れたJSONは自動修復されます。",
  "App icon": "アプリアイコン",
  "App logo": "アプリロゴ",
  Applied: "適用済み",
  Apply: "適用",
  "Apply now": "今すぐ適用",
  "Art remap": "アートの置き換え",
  "As aired": "放送順",
  Audience: "視聴者",
  "Augments AI picks with current web results before asking the model. Powered by":
    "モデルに問い合わせる前に、現在のWeb検索結果をAIのおすすめに追加します。提供元:",
  "Award Icons": "受賞アイコン",
  "Award tab on cards": "カードの受賞タブ",
  "Award tab position": "受賞タブの位置",
  Backdrop: "背景画像",
  "Badge art": "バッジ画像",
  "Badge art back to default": "バッジ画像をデフォルトに戻しました",
  "Badge remaps": "バッジの置き換え",
  "Badge updated": "バッジを更新しました",
  "Below ratings": "評価の下",
  "Top of card": "カード上部",
  Bottom: "下",
  "Build a named quality preference once and set it active. The picker prefers streams that match it, including the instant pick, and falls back to the next best source when nothing matches. Each filter ANDs its dimensions and ignores any you leave blank.":
    "名前を付けた画質設定を一度作成し、有効にします。即時選択を含め、条件に一致するストリームが優先され、一致しない場合は次に最適なソースが選ばれます。各フィルターでは指定した項目をAND条件で組み合わせ、空欄の項目は無視します。",
  "Build a pack in any of these, export the JSON, host it as a gist, and paste the raw link below.":
    "いずれかのツールでパックを作成してJSONをエクスポートし、gistでホストして、下にrawリンクを貼り付けます。",
  "Card size": "カードサイズ",
  Cards: "カード",
  "Choose subtitles before playback": "再生前に字幕を選択",
  Cinematic: "シネマティック",
  "Control bar": "コントロールバー",
  "Copy filename": "ファイル名をコピー",
  "Corners keep it clear of subtitles along the bottom.":
    "隅に配置すると、画面下部の字幕を遮りません。",
  "Could not apply": "適用できませんでした",
  "Couldn't reach that pack": "そのパックにアクセスできませんでした",
  "Couldn't reach that pack (HTTP {n})": "そのパックにアクセスできませんでした（HTTP {n}）",
  "Custom art": "カスタム画像",
  "Custom rules": "カスタムルール",
  "Customize each award": "受賞項目を個別に設定",
  "Default art": "デフォルト画像",
  "Delete rule": "ルールを削除",
  "Disable all": "すべて無効化",
  "Disable rule": "ルールを無効化",
  "Disable torrents entirely": "トレントを完全に無効化",
  "Disabled because torrents are disabled above":
    "上でトレントが無効になっているため使用できません",
  "Edit layout": "レイアウトを編集",
  "Enable TV navigation above to use focus navigation in the player.":
    "プレーヤーでフォーカス移動を使用するには、上でテレビナビゲーションを有効にしてください。",
  "Enable all": "すべて有効化",
  "Enable rule": "ルールを有効化",
  "Episode 2": "エピソード2",
  "Episode 3": "エピソード3",
  "Episode 4": "エピソード4",
  "Every format badge Harbor can show on streams. Click one to swap its art, hide it, or reset it. Changes apply everywhere badges appear.":
    "Harborがストリームに表示できるすべての形式バッジです。クリックすると、画像の変更、非表示、リセットができます。変更はバッジが表示されるすべての場所に適用されます。",
  "Export artwork": "アートワークをエクスポート",
  "Export my setup": "設定をエクスポート",
  "Extra large": "特大",
  "Fetches DuckDuckGo results and feeds top hits into the model prompt.":
    "DuckDuckGoの検索結果を取得し、上位の結果をモデルへのプロンプトに追加します。",
  "Fetching…": "取得中…",
  "Files smaller than this are skipped when scanning a folder, so clips and samples stay out. Set to 0 to include everything.":
    "フォルダーのスキャン時、このサイズ未満のファイルはスキップされるため、クリップやサンプルは除外されます。すべて含めるには0に設定してください。",
  "Finds anime saved under a movie or series id (which breaks Continue Watching and Trakt) and removes just those so they re-add correctly.":
    "映画またはシリーズのidで保存されたアニメを検出し（「視聴を続ける」とTraktが正しく機能しなくなる原因です）、該当項目だけを削除して正しい状態で再追加できるようにします。",
  "Flags anime with an English dub. Also tags dub / sub / dual on stream sources.":
    "英語吹替版があるアニメに印を付けます。ストリームソースにもdub / sub / dualのタグを付けます。",
  "Force player menus and panels to pure black, ignoring your theme tint.":
    "テーマの色合いを無視して、プレーヤーのメニューとパネルを完全な黒にします。",
  "Found {n}: {names}. These are saved under the wrong id, which breaks Continue Watching and Trakt marking.":
    "{n}件見つかりました: {names}。誤ったidで保存されているため、「視聴を続ける」とTraktのマークが正しく機能しません。",
  "Free tier": "無料プラン",
  "Give each score a home: on poster cards, on the detail page, or both. Flip the switch in each column.":
    "各スコアの表示先を、ポスターカード、詳細ページ、または両方から選べます。各列のスイッチで切り替えてください。",
  Glass: "ガラス",
  "Groq API key (gsk-...)": "Groq APIキー（gsk-...）",
  "Group Refresh on the left beside Back instead of the far right of the header.":
    "「更新」をヘッダー右端ではなく、左側の「戻る」の横に配置します。",
  "Harbor will not start the torrent engine, contact trackers, or run DHT. Use this if you only want debrid and direct links. Turn off to re-enable torrent streaming.":
    "Harborはトレントエンジンを起動せず、トラッカーへの接続やDHTの実行も行いません。デブリッドと直接リンクだけを使う場合に有効にしてください。オフにするとトレントストリーミングが再び有効になります。",
  "Hide badge": "バッジを非表示",
  "Hide manga": "マンガを非表示",
  "Hide pack instructions": "パックの説明を隠す",
  "Home hero audio": "ホームのヒーロー音声",
  "How big episode cards are in the strip and grid layouts. Bigger cards show larger artwork.":
    "ストリップ表示とグリッド表示のエピソードカードの大きさです。大きくするとアートワークも大きく表示されます。",
  "How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "トレーラーの画質です。自動では通信速度に合わせ、「トレーラーを見る」ボタンでは1080pを優先します。高画質に固定するには、1080pまたは最高（ソースが対応していれば最大4K）を選んでください。1080pと最高では、同梱のffmpegで別々の映像と音声を結合するため、再生開始まで少し時間がかかります。",
  "How the on-screen controls read while you watch.": "視聴中の画面上のコントロール表示です。",
  "How to make an award pack": "アワードパックの作り方",
  "Image URL (optional)": "画像URL（任意）",
  "Image too large. Keep badge files under 250 KB.":
    "画像が大きすぎます。バッジファイルは250 KB未満にしてください。",
  Import: "インポート",
  "Import a .zip pack": " .zipパックをインポート",
  "Import a file instead": "代わりにファイルをインポート",
  "Import any pack": "任意のパックをインポート",
  "Install a pack": "パックをインストール",
  "Installing...": "インストール中...",
  "Jina API key (optional)": "Jina APIキー（任意）",
  "Keep downloading after you leave": "画面を離れてもダウンロードを続ける",
  "Live web (Jina Reader)": "リアルタイムWeb（Jina Reader）",
  Logo: "ロゴ",
  "Logo & app icon": "ロゴとアプリアイコン",
  MB: "MB",
  "Make Harbor yours: swap the sidebar logo and the window/taskbar icon.":
    "Harborを自分好みに。サイドバーのロゴとウィンドウ／タスクバーのアイコンを変更できます。",
  "Make your own": "自作する",
  "Max scores per card": "カードごとの評価数上限",
  "Minimum file size": "最小ファイルサイズ",
  Modern: "モダン",
  "Move Refresh next to Back": "更新を戻るの隣に移動",
  "Move focus with the keyboard, like a TV remote.":
    "テレビのリモコンのように、キーボードでフォーカスを移動します。",
  NEW: "新着",
  "Name (e.g. REMUX)": "名前（例: REMUX）",
  "Native to Harbor. No RPDB or ratings addon needed.":
    "Harborの標準機能です。RPDBや評価アドオンは不要です。",
  "No badges match this title.": "このタイトルに一致するバッジはありません。",
  "No custom rules yet. Add one below, or install a pack to bring some in.":
    "カスタムルールはまだありません。下で追加するか、パックをインストールして取り込んでください。",
  "No issues found. Your anime library looks clean.":
    "問題は見つかりませんでした。アニメライブラリは正常です。",
  "No rules match your search.": "検索に一致するルールはありません。",
  "Nothing usable in that file": "このファイルには使用できるデータがありません",
  "One-click community packs. Rulesets bring full badge sets with their own matching; art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link on the Nuvio Discord or Reddit imports here too.":
    "ワンクリックで使えるコミュニティパックです。ルールセットでは、独自の一致条件を持つ完全なバッジセットを追加できます。アートのリマップでは、Harbor内蔵バッジの画像だけを差し替えます。Nuvio DiscordやRedditでbadges.jsonのリンクとして共有されたものも、ここからインポートできます。",
  "Optional overlays that appear over the video.": "映像の上に表示できる追加オーバーレイです。",
  "Or just zip up images": "または画像をzipにまとめるだけ",
  "Or try one of ours": "または公式パックを試す",
  "Packs & import": "パックとインポート",
  "Paste an image URL (png, webp, svg)": "画像URLを貼り付け（png、webp、svg）",
  "Pick a source once and Harbor keeps playing the rest of that season from the same release, no re-picking. Works best with a debrid season pack. For anime it locks the whole series to that release.":
    "ソースを一度選ぶと、同じシーズンの残りも同じリリースから再生され、選び直す必要はありません。debridのシーズンパックで最適に動作します。アニメではシリーズ全体がそのリリースに固定されます。",
  "Play a short sound when changing the player volume. Off by default.":
    "プレイヤーの音量変更時に短い音を鳴らします。初期設定ではオフです。",
  "Play trailers in the hero": "ヒーローエリアでトレーラーを再生",
  "Player style": "プレイヤーのスタイル",
  "Player volume sounds": "プレイヤーの音量変更音",
  Poster: "ポスター",
  Provider: "プロバイダー",
  "Queue drives Next/Previous": "次へ／前へをキューに連動",
  "Re-apply to the window and taskbar now": "今すぐウィンドウとタスクバーに再適用",
  "Refresh button": "更新ボタン",
  Reinstall: "再インストール",
  Remap: "リマップ",
  "Remove remap": "リマップを削除",
  "Removes the Anime tab and every anime title from all rows everywhere: Home, Discover, Top 10, and catalogs. Western animation like Pixar is kept, and you can still find anime by searching.":
    "「アニメ」タブと、ホーム、見つける、トップ10、カタログなど、すべての行から全アニメ作品を非表示にします。Pixarなどの欧米アニメーションは残り、検索では引き続きアニメを見つけられます。",
  "Removes the Manga tab from the sidebar.": "サイドバーから「マンガ」タブを非表示にします。",
  "Repair anime library": "アニメライブラリを修復",
  Replace: "置き換える",
  "Reset all": "すべてリセット",
  "Reset all art": "すべてのアートをリセット",
  "Reset everything": "すべてをリセット",
  "Restore previous settings": "以前の設定を復元",
  Retro: "レトロ",
  "Ribbon corner": "リボンの位置",
  "Rich season and order panel": "詳細なシーズン／視聴順パネル",
  "Rotten Tomatoes": "Rotten Tomatoes",
  Ruleset: "ルールセット",
  "Score badges on cards": "カードに評価バッジを表示",
  "Score position": "評価の位置",
  "Search rules by name or pattern…": "名前またはパターンでルールを検索…",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer. You can also use the phone remote to control playback and cast to another device on this machine.":
    "このHarborを、ネットワーク上でWebアプリとしてそのまま公開します。スマートフォン、ノートPC、テレビのブラウザで開いてログインすると、このコンピューター経由でストリーミングできます。スマートフォンのリモコンで再生を操作したり、このマシン上の別のデバイスにキャストしたりすることもできます。",
  "Set active": "有効にする",
  "Settings for this profile": "このプロフィールの設定",
  "Setup copied to clipboard as JSON": "設定をJSONとしてクリップボードにコピーしました",
  "Show DUB badge on anime cards": "アニメカードにDUBバッジを表示",
  "Show a bookmark on saved titles": "保存した作品にブックマークを表示",
  "Show a laurel award tab on winning titles, like Netflix. Replaces the corner award chip and sits centered so it clears the rating and watchlist pills. Pick where it sits below.":
    "Netflixのように、受賞作品に月桂冠のアワードタブを表示します。隅のアワードチップの代わりに中央へ配置されるため、評価やウォッチリストのピルと重なりません。表示位置は下で選べます。",
  "Show badge": "バッジを表示",
  "Show controls when pausing with keyboard": "キーボードで一時停止したときにコントロールを表示",
  "Show sync indicator": "同期インジケーターを表示",
  "Show tags on cards": "カードにタグを表示",
  "Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they don't cover subtitles.":
    "キーボードで一時停止または再開したときに、プレイヤーのコントロールを表示します。字幕に重ならないよう非表示のままにするには、オフにしてください。",
  "Sleep timer in the top bar": "トップバーのスリープタイマー",
  "Sound effects": "効果音",
  "Sound effects volume": "効果音の音量",
  "Square mark in the sidebar. Transparent PNG or SVG works best.":
    "サイドバーに表示する正方形のシンボル。透過PNGまたはSVGが最適です。",
  Structured: "構造化",
  "Subtle audio feedback as you navigate and click. Off by default; pick a style to turn it on.":
    "移動やクリック時に控えめな操作音を鳴らします。デフォルトではオフです。スタイルを選ぶと有効になります。",
  "Sync indicator": "同期インジケーター",
  "TV navigation": "TVナビゲーション",
  "TV navigation in player": "プレイヤーのTVナビゲーション",
  "Tap again to delete {n} rules": "もう一度タップすると{n}件のルールを削除",
  "Tap again to reset everything": "もう一度タップするとすべてリセット",
  "Tap again to reset {n}": "もう一度タップすると{n}をリセット",
  "Tap again to reset {n} badges": "もう一度タップすると{n}個のバッジをリセット",
  "Tap to switch": "タップして切り替え",
  "That doesn't look like an image URL": "画像のURLではないようです",
  "That file isn't valid JSON": "このファイルは有効なJSONではありません",
  "That pack's file isn't valid JSON": "このパックのファイルは有効なJSONではありません",
  "The New, In Cinema, Rerun, and Awards chips. Turn off for a cleaner grid. Score chips are separate, below.":
    "「新着」「劇場公開中」「再上映」「受賞」のバッジです。オフにするとグリッドがすっきりします。スコアバッジは下で別に設定できます。",
  "The TMDB community score.": "TMDBコミュニティのスコア。",
  "The badge that appears over the player when an episode syncs to your tracker.":
    "エピソードがトラッカーと同期されたとき、プレイヤー上に表示されるバッジです。",
  "The button set your layout is built on. Your customizations are kept separately for each style.":
    "レイアウトの基盤となるボタンセットです。カスタマイズ内容はスタイルごとに個別に保存されます。",
  "The free tier is $0 for personal use. Just pick the first option, no payment needed.":
    "個人利用なら無料プランは$0です。最初のオプションを選ぶだけで、支払いは不要です。",
  "The home hero trailer plays with sound and a mute button in the corner, then shows a replay button when it ends. Auto-rotation pauses so it stays on the featured title.":
    "ホームのヒーローにある予告編を音声付きで再生し、隅にミュートボタンを表示します。終了後はリプレイボタンが表示されます。自動切り替えは一時停止し、注目作品をそのまま表示します。",
  "The little 4K, HDR, codec, and audio chips that ride along each stream in the play picker.":
    "再生ストリームの選択画面で、各ストリームに表示される小さな4K、HDR、コーデック、音声バッジです。",
  "The little score chip printed on poster cards across your rows and grids.":
    "各行やグリッドのポスターカードに表示される小さなスコアバッジです。",
  "The ratings row on a title's detail page, next to runtime and genre.":
    "作品の詳細ページで、再生時間やジャンルの横に表示される評価欄です。",
  "The resolution Harbor downloads for each image when you export a title's metadata next to the file on disk.":
    "作品のメタデータをディスク上のファイルの横に書き出す際、Harborが各画像をダウンロードする解像度です。",
  "The window and taskbar icon updates right away. The installed shortcut refreshes on the next update.":
    "ウィンドウとタスクバーのアイコンはすぐに更新されます。インストール済みのショートカットは次回のアップデート時に更新されます。",
  "These badges are drawn on posters as you browse. RPDB, in the keys above, is a separate option that bakes scores into the poster image itself.":
    "閲覧中、これらのバッジがポスター上に表示されます。上のキーにあるRPDBは別のオプションで、スコアをポスター画像自体に埋め込みます。",
  "This score only appears on cards.": "このスコアはカードにのみ表示されます。",
  "Top 10 ribbon": "トップ10リボン",
  "Torrents are disabled. Uncached streams will not play unless they come from a debrid service or a direct link. To use torrents, toggle this off.":
    "Torrentは無効です。キャッシュされていないストリームは、debridサービスまたは直接リンク経由でない限り再生できません。Torrentを使用するにはオフにしてください。",
  "True black menus": "完全な黒のメニュー",
  "Try it": "試す",
  "Turn off to hide the sync badge during playback.":
    "オフにすると、再生中の同期バッジが非表示になります。",
  "Type what you want in plain language and let a model find it. Bring your own API key.":
    "探したいものを普段の言葉で入力すると、モデルが検索します。ご自身のAPIキーが必要です。",
  "Updating separated settings per profile, which may have reset your theme and keys. Harbor still has your old setup saved. Bring it back on this profile, then reload.":
    "アップデートにより設定がプロフィールごとに分けられたため、テーマやキーがリセットされた可能性があります。以前の設定はHarborに保存されています。このプロフィールに復元してから、再読み込みしてください。",
  Upload: "アップロード",
  "Upload image": "画像をアップロード",
  "Upload multiple images": "複数の画像をアップロード",
  "Use arrows and Select/Space to move focus between player controls. Turn this off to keep arrows for seeking and Space for play/pause.":
    "矢印キーとSelect/Spaceでプレイヤーの操作項目間を移動します。オフにすると、矢印キーはシーク、Spaceは再生と一時停止に使用されます。",
  "Use in Nuvio": "Nuvioで使用",
  "Use live web context": "最新のWeb情報を使用",
  "Use the arrow keys and Enter to move focus through Harbor. Turn this off to keep arrow keys free and disable focus navigation everywhere.":
    "矢印キーとEnterでHarbor内のフォーカスを移動します。オフにすると矢印キーが解放され、すべてのフォーカスナビゲーションが無効になります。",
  "Use your own image as the app icon": "自分の画像をアプリアイコンに使用",
  "Watchlist bookmark": "ウォッチリストのブックマーク",
  "When off, a torrent stops the moment you close or switch the stream, so nothing keeps downloading in the background. Turn on to let it keep going after you leave; manage or pause those from the Downloads tab.":
    "オフの場合、ストリームを閉じるか切り替えるとTorrentはすぐに停止し、バックグラウンドでのダウンロードは続きません。オンにすると離れた後も続行できます。管理や一時停止は「ダウンロード」タブで行えます。",
  "Where scores appear": "スコアの表示場所",
  "Where the Refresh button sits in the picker header. Default keeps it on the right, across from Back.":
    "選択画面のヘッダーで更新ボタンを表示する位置です。デフォルトでは「戻る」の反対側にあたる右側に表示されます。",
  "Which order": "並び順",
  "While you watch": "視聴中",
  "Wide logo shown beside the mark when the sidebar is expanded.":
    "サイドバーを展開したとき、シンボルの横に表示される横長のロゴです。",
  Wordmark: "ワードマーク",
  "Your own badges, matched against the stream's name with a pattern. Great for release groups, providers, or anything the built-in badges don't cover. Imported packs land here too.":
    "ストリーム名とパターンを照合して表示するカスタムバッジです。リリースグループやプロバイダーなど、標準バッジで対応できない項目に最適です。インポートしたパックもここに追加されます。",
  "by {name}": "{name}作",
  "copied!": "コピーしました！",
  "for higher rate limits; leave blank for the free anonymous tier.":
    "レート上限を引き上げるために使用します。無料の匿名枠では空欄にしてください。",
  "jina_...": "jina_...",
  skipped: "スキップ",
  "{a} badges remapped, {b} rules added": "{a}個のバッジを再割り当て、{b}件のルールを追加",
  "{n} Harbor icons": "Harborアイコン {n}個",
  "{n} badges customized": "{n}個のバッジをカスタマイズ済み",
  "{n} enabled": "{n}個が有効",
  "{n} rules · {m} on": "ルール {n}件 · 有効 {m}件",
  "{themeName} theme": "{themeName}テーマ",
  "Home hero": "ホームのヒーロー",
  "Make the featured banner on Home bigger and sharper.":
    "ホームの注目バナーを大きく鮮明にします。",
  "Full hero banner": "全幅ヒーローバナー",
  "Stretch the featured hero edge to edge and taller, across every layout.":
    "すべてのレイアウトで、注目ヒーローを画面の端から端まで広げて高く表示します。",
  "Full quality hero image": "最高画質のヒーロー画像",
  "Load the highest-resolution artwork for the featured hero. Uses more bandwidth.":
    "注目ヒーローの画像を最高解像度で読み込みます。通信量が増加します。",
  "Display language": "表示言語",
  "Interface language": "インターフェースの言語",
  "Metadata language": "メタデータの言語",
  Region: "地域",
  "Region & language": "地域と言語",
  "English (default)": "英語（デフォルト）",
  "Apply {language}": "{language}を適用",
  "Switch Harbor to {language}?": "Harborを{language}に切り替えますか？",
  "Just change region": "地域だけ変更",
  "Translate titles": "タイトルを翻訳",
  "If disabled, titles remain in their original language.":
    "無効にすると、タイトルは原語のまま表示されます。",
  "Translate descriptions": "説明を翻訳",
  "If disabled, overviews and taglines remain in their original language. (Applies only inside the details page)":
    "無効にすると、あらすじとキャッチコピーは原語のまま表示されます。（詳細ページ内のみ適用）",
  "Translate posters": "ポスターを翻訳",
  "If disabled, posters remain in their original language. (Applies only inside the details page)":
    "無効にすると、ポスターは原語のまま表示されます。（詳細ページ内のみ適用）",
  "Poster translation is disabled because a custom poster service is active.":
    "カスタムポスターサービスが有効なため、ポスターの翻訳は無効です。",
  "Metadata providers": "メタデータプロバイダー",
  "Content filters": "コンテンツフィルター",
  "Sets the language of Harbor's own interface: menus, buttons, and labels. Arabic switches the layout to right to left. This is separate from subtitle and metadata languages below.":
    "Harbor自体のインターフェース（メニュー、ボタン、ラベル）の言語を設定します。アラビア語ではレイアウトが右から左に切り替わります。以下の字幕やメタデータの言語とは別の設定です。",
  "Switch the menus and buttons to your language. Arabic flips the layout to right to left.":
    "メニューとボタンを選択した言語に切り替えます。アラビア語ではレイアウトが右から左に切り替わります。",
  "This sets the interface, metadata, subtitle, and audio languages to match.":
    "インターフェース、メタデータ、字幕、音声の言語を同じ言語に設定します。",
  "Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.":
    "翻訳がある場合、TMDBのタイトル、あらすじ、キャッチコピーをこの言語で表示します。TMDBキーが必要です。",
  "Used for streaming availability and the Now Playing release window. Pick a country and Harbor can match the interface, metadata, and subtitle languages to it.":
    "配信状況と「上映中」の公開期間に使用します。国を選ぶと、Harborのインターフェース、メタデータ、字幕の言語をその国に合わせられます。",
  "A free TMDB key is highly recommended. It unlocks the full Harbor experience. The rest are optional, and Cinemeta works out of the box without any.":
    "無料のTMDBキーを強くおすすめします。Harborの全機能を利用できるようになります。その他は任意で、Cinemetaはキーなしですぐに使えます。",
  "TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.":
    "キーの作成時にTMDBからアプリのURLを求められます。https://harbor.app など、任意のURLを入力してください。必要なのは発行されるAPIキーだけです。",
  "RPDB already paints scores onto the poster. Toggle to override.":
    "RPDBではすでにポスターに評価が表示されます。上書きするにはオンにしてください。",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays optional.":
    "アニメ作品のMyAnimeList評価です。RPDBはアニメに対応していないため、任意の設定です。",
  "v3 API key": "v3 APIキー",
  "8-character key": "8文字のキー",
  "personal key": "個人用キー",
  "subscriber API key": "サブスクライバーAPIキー",
  "mdblist api key": "mdblist APIキー",
  "rpdb key": "rpdbキー",
  "https://posters.example.com or a pattern with {id}":
    "https://posters.example.com または {id} を含むパターン",
  "The yellow chip in the poster corner.": "ポスターの隅にある黄色のバッジです。",
  "Hide adult content": "成人向けコンテンツを非表示",
  "Filters out streams from adult catalogs and addons. On by default.":
    "成人向けカタログやアドオンのストリームを除外します。デフォルトでオンです。",
  "Hide anime": "アニメを非表示",
  "Removes the Anime tab and any Trending/Popular/Upcoming/New anime rows from Home.":
    "「アニメ」タブと、ホームの「トレンド」「人気」「近日公開」「新着」のアニメ行を削除します。",
  "Hide Live TV": "ライブTVを非表示",
  "Removes the Live TV tab from the sidebar.": "サイドバーから「ライブTV」タブを削除します。",
  "Hide entire categories. Toggling these also removes the matching sidebar entries and rails.":
    "カテゴリー全体を非表示にします。切り替えると、対応するサイドバー項目とコンテンツ行も削除されます。",
  "Show Playlists tab": "「プレイリスト」タブを表示",
  "Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.":
    "ナビゲーションに「プレイリスト」を追加し、M3UまたはXtreamプレイリスト（ライブTVに追加するものと同じ）から映画や番組を視聴できるようにします。ナビゲーションをすっきり保つため、デフォルトではオフです。",
  "Show IMDb score on cards": "カードにIMDb評価を表示",
  "Use mpv engine": "mpvエンジンを使用",
  "Show sources hidden by the trust filter": "信頼性フィルターで非表示になったソースを表示",
  "Blur spoilers": "ネタバレをぼかす",
  "Blur thumbnails": "サムネイルをぼかす",
  "Blur titles": "タイトルをぼかす",
  "Blur descriptions": "説明をぼかす",
  Spoilers: "ネタバレ",
  "Hides spoiler-prone episode details in episode lists until you have watched them.":
    "視聴するまで、エピソード一覧でネタバレを含む可能性のある詳細を非表示にします。",
  "Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.":
    "ドラマとアニメの両方で、未視聴エピソードの画像、タイトル、説明をぼかします。エピソードにカーソルを合わせると確認できます。",
  "Leave the episode you are up to clear and only blur the ones after it.":
    "現在視聴中のエピソードはそのまま表示し、それより後のエピソードだけをぼかします。",
  "Keep the next episode visible": "次のエピソードを表示したままにする",
  "Blur episode images on detail page": "詳細ページのエピソード画像をぼかす",
  "Blurs the hero image and stills on the episode detail page until you click reveal.":
    "エピソードの詳細ページで、表示をクリックするまでメイン画像と場面写真をぼかします。",
  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
    "ホームの「視聴を続ける」行からアニメを非表示にします。「アニメ」タブ内の「視聴を続ける」には引き続き表示されます。",
  "Keep anime in the Anime room only": "アニメは「アニメ」内にのみ表示",
  "Start with subtitles off": "字幕をオフで再生開始",
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
    "Harborは引き続き字幕を検索して読み込むため、プレイヤーでワンクリックで選べます。ただし、自動ではオンにしません。",
  "Prefer embedded subtitles": "埋め込み字幕を優先",
  "When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.":
    "ファイルに字幕トラックが含まれている場合は、ダウンロードした字幕に切り替えず、そのトラックを選択したままにします。通常、内蔵字幕が最も正確に同期します。",
  "Forced subs with native audio": "オリジナル音声では強制字幕を表示",
  "When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.":
    "音声が字幕の言語と一致している場合、完全字幕ではなく強制字幕（外国語の会話と表示のみ）を選びます。ファイルに強制字幕がない場合、字幕はオフのままです。",
  "Preferred languages": "優先言語",
  "Only show streams in my languages": "自分の言語のストリームのみ表示",
  "Show {langs} only": "{langs}のみ表示",
  "{langs} only · {n} hidden": "{langs}のみ・{n}件を非表示",
  "Hides streams with no detected preferred language. Multi-audio releases count as a match.":
    "優先言語が検出されないストリームを非表示にします。複数音声のリリースは一致と見なされます。",
  "Streams in these languages rank first. Toggle below to drop everything else.":
    "これらの言語のストリームを優先表示します。以下をオンにすると、それ以外はすべて除外されます。",
  "When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.":
    "再生開始時に、Harborがこれらの言語のいずれかの字幕を自動で検索して読み込むため、手動で探す必要はありません。最初に見つかった字幕が選ばれるので、メインの言語を先頭にしてください。",
  "Never auto-select tracks containing": "次を含むトラックを自動選択しない",
  "commentary, descriptive": "コメンタリー、音声解説",
  "Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.":
    "カンマ区切りの単語です。名前がいずれかに一致する音声または字幕トラックは、自動選択時にスキップされます。プレイヤーでは手動で選べます。",
  "When a release ships multiple audio tracks, Harbor selects the first match from this list.":
    "リリースに複数の音声トラックがある場合、Harborはこのリストで最初に一致するものを選びます。",
  "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.":
    "デフォルトでは、内蔵の行（「トレンド」「人気」「高評価」など）と重複するアドオンの行は統合され、同じ行が二重に表示されないようになります。重複を含めてすべて表示するにはオンにしてください。",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left. Tune how long they stick around, or wipe them all.":
    "作品の視聴を終了すると、Harborはその場面のフレームを保存し、「視聴を続ける」カードに中断した場面を表示します。保存期間を調整したり、すべて削除したりできます。",
  "When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.":
    "エピソードを最後まで見ると、ホームの「視聴を続ける」カードは「残り0分」のままにならず、次のエピソードに進みます。",
  "Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.":
    "ライブラリの「ウォッチリスト」タブを、Stremioで自分が追加した作品のみに限定します。オフにすると、再生時にStremioが自動追加した作品も含まれます。",
  "Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.":
    "お知らせ: Harborは英語を基準に開発されています。多言語対応は一部に限られるため、通常はHarborのフィルターで検出できないものをアドオンが補います。他の言語を話し、不足を補う支援をしたい方のために、ソースコードを公開しています。",
  "Contribute on GitHub": "GitHubで貢献",
  Settings: "設定",
  "Stremio account": "Stremioアカウント",
  Custom: "カスタム",
  "Search settings": "設定を検索",
  Account: "アカウント",
  "Your Stremio sign-in. Library, watch progress, and addons sync from here.":
    "Stremioへのサインインです。ライブラリ、視聴状況、アドオンがここから同期されます。",
  "Library & metadata": "ライブラリとメタデータ",
  "Optional keys that unlock TMDB rails, baked-in poster ratings, fanart, and TVDB episode data.":
    "TMDBのコンテンツ行、ポスターに埋め込まれた評価、ファンアート、TVDBのエピソードデータを利用できるようにする任意のキーです。",
  "Connect your Trakt account to scrobble playback, sync your watchlist, and pull personalized recommendations.":
    "Traktアカウントを接続すると、再生履歴の記録、ウォッチリストの同期、パーソナライズされたおすすめの取得ができます。",
  AniList: "AniList",
  "Connect your AniList account to show your anime lists as rails on the Anime page.":
    "AniListアカウントを接続すると、自分のアニメリストを「アニメ」ページにコンテンツ行として表示できます。",
  Simkl: "Simkl",
  "Connect your Simkl account to mark what you finish as watched and sync your plan-to-watch list across apps.":
    "Simklアカウントを接続すると、見終わった作品を視聴済みにし、「視聴予定」リストをアプリ間で同期できます。",
  "Harbor Relay": "Harbor Relay",
  "A Cloudflare Worker on your own account that hosts your Watch Together rooms.":
    "自分のアカウントで運用し、「一緒に観る」ルームをホストするCloudflare Workerです。",
  "Streaming sources": "ストリーミングソース",
  "How Harbor finds and resolves playable streams. Debrid keys and addon installs live here.":
    "Harborが再生可能なストリームを検索・解決する方法を設定します。Debridキーとアドオンのインストールもここで管理します。",
  Languages: "言語",
  "Which audio and subtitle languages rank first in stream lists.":
    "ストリーム一覧で優先する音声と字幕の言語を設定します。",
  Hotkeys: "ホットキー",
  "Every shortcut Harbor responds to. Click a binding to rebind it.":
    "Harborで使えるすべてのショートカットです。キー設定をクリックすると変更できます。",
  "Theme & appearance": "テーマと外観",
  "Color presets, custom backgrounds, and the font pair Harbor renders in.":
    "カラープリセット、カスタム背景、Harborで使用するフォントの組み合わせを設定します。",
  Webhooks: "Webhook",
  "Push upcoming releases to Discord or Telegram. Pick which calendars feed the notifications.":
    "今後のリリース情報をDiscordまたはTelegramに送信します。通知に使用するカレンダーを選択してください。",
  "Report a bug": "不具合を報告",
  "Send a bug report straight to the Harbor team. Screenshots and screen recordings welcome.":
    "Harborチームに不具合を直接報告します。スクリーンショットや画面録画も歓迎します。",
  "Show Rotten Tomatoes score on cards": "カードにRotten Tomatoesの評価を表示",
  "Fresh tomatoes for 60% and up, splat for anything under.":
    "60%以上はフレッシュ、60%未満はロッテンのアイコンを表示します。",
  "Show MAL score on cards": "カードにMALの評価を表示",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays an opt-in.":
    "アニメ作品にMyAnimeListの評価を表示します。RPDBはアニメに対応していないため、必要な場合のみ有効にできます。",
  "Hover a poster to peek at its rating, runtime, and synopsis without opening it.":
    "ポスターにカーソルを合わせると、開かずに評価、再生時間、あらすじを確認できます。",
  "Badge position": "バッジの位置",
  "TMDB · catalogs and rails": "TMDB・カタログとレール",
  "OMDb · Rotten Tomatoes scores": "OMDb・Rotten Tomatoesの評価",
  "RPDB · scores baked into posters": "RPDB・ポスターに埋め込まれた評価",
  "MDBList · Letterboxd and Trakt scores": "MDBList・LetterboxdとTraktの評価",
  "Custom poster service": "カスタムポスターサービス",
  "Cleaner grid for when your poster service already prints the title onto the artwork.":
    "ポスターサービスがアートワークに作品名を印字している場合に適した、すっきりしたグリッドです。",
  "Fanart.tv · logos and backdrops": "Fanart.tv・ロゴと背景画像",
  "TheTVDB · episode data": "TheTVDB・エピソード情報",
  Advanced: "詳細設定",
  "1 frame stored. Wiping rebuilds them next time you watch.":
    "1フレーム保存されています。消去すると、次回の視聴時に再生成されます。",
  "{count} frames stored. Wiping rebuilds them next time you watch.":
    "{count}フレーム保存されています。消去すると、次回の視聴時に再生成されます。",
  "Diagnostics, manual overrides, things most users never need.":
    "診断、手動オーバーライドなど、ほとんどのユーザーには不要な設定です。",
  "Watch Together rooms are routed through Harbor's hosted relay.":
    "一緒に観るルームは、Harborがホストするリレーを経由します。",
  Streaming: "ストリーミング",
  Playback: "再生",
  Appearance: "外観",
  Notifications: "通知",
  Help: "ヘルプ",
  "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left.":
    "作品ページに戻ると、Harborがその時点のフレームを保存し、「視聴を続ける」カードに中断した場面を表示します。",
  "Used for streaming availability and the Now Playing release window.":
    "ストリーミング配信状況と「上映中」の公開期間に使用します。",
  "MyAnimeList scores for anime titles.": "アニメ作品にMyAnimeListの評価を表示します。",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails.":
    "ヒーローカルーセル、トップ10、トレンド、劇場公開中、サービス別レール。",
  Updates: "アップデート",
  "Harbor checks harbor.site for new versions and installs them in place.":
    "Harborはharbor.siteで新しいバージョンを確認し、そのまま上書きインストールします。",
  "Backup & restore": "バックアップと復元",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup.":
    "Harborの設定一式を1つのファイルにエクスポートし、新しいパソコンで復元したり、バックアップとして保管したりできます。",
  Privacy: "プライバシー",
  "System tray": "システムトレイ",
  "Stremio install links": "Stremioインストールリンク",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app.":
    "Harborがstremio://インストールリンクを処理し、設定からインストールまでアプリ内で完了できるようにします。",
  "Discord Rich Presence": "Discord Rich Presence",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar.":
    "視聴中の作品を、ポスターとリアルタイムの進行状況バー付きでDiscordのフレンドに表示します。",
  "API budget": "API使用量",
  "Daily call counter for OMDb rating lookups. Reset if it stops returning fresh scores.":
    "OMDbの評価取得に使った1日あたりのAPI呼び出し回数です。最新の評価が取得できなくなった場合はリセットしてください。",
  Onboarding: "初期ガイド",
  "Replay the walkthrough or unhide every dismissed tip in the app.":
    "チュートリアルをもう一度再生するか、閉じたすべてのヒントを再表示します。",
  "Stremio library repair": "Stremioライブラリの修復",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema.":
    "Stremioライブラリをスキャンし、Stremioの正確なスキーマに一致しない項目を書き換えます。",
  About: "Harborについて",
  "Build identity. Useful when filing a bug report at bugs@harbor.site.":
    "ビルド情報です。bugs@harbor.siteへの不具合報告時に役立ちます。",
  "Reveal the show or movie artwork.": "番組または映画のアートワークを表示します。",
  Legal: "法的情報",
  "Made with": "制作:",
  "by Harbor contributors": "Harborコントリビューター",
  "Know more": "詳しく見る",
  "A special thank you to the team at Stremio-Addons. Please consider supporting them.":
    "Stremio-Addonsチームに心より感謝します。ぜひご支援をご検討ください。",
  "Debrid services": "Debridサービス",
  "TorBox API key": "TorBox APIキー",
  "AllDebrid API key": "AllDebrid APIキー",
  "Premiumize API key": "Premiumize APIキー",
  "Debrid-Link API key": "Debrid-Link APIキー",
  "Streaming catalogs": "ストリーミングカタログ",
  "Top titles per service. Toggle off the ones you don't pay for.":
    "サービス別の人気作品です。契約していないサービスはオフにしてください。",
  "Stream safety filter": "ストリーム安全性フィルター",
  "Result order": "結果の並び順",
  "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.":
    "「コンパクト」ではおすすめ、画質タイル、ドロワーを表示します。「Stremio」ではアドオン別にまとめたフラットなリストを表示し、スコア付けはしません。",
  "Stream format chips": "ストリーム形式タグ",
  "The little 4K · HDR · codec · audio chips that ride along each stream in the play picker.":
    "再生選択画面で各ストリームに付く小さな4K · HDR · コーデック · 音声タグです。",
  "Synced addons": "同期済みアドオン",
  "How aggressively Harbor rejects shady or mismatched streams before showing them in the picker.":
    "再生選択画面に表示する前に、Harborが怪しいストリームや内容の一致しないストリームをどの程度厳しく除外するかを設定します。",
  Strict: "厳格",
  "Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs (for episode requests), trailers, and likely cams.":
    "デフォルト。サイズが極端なもの、不審な拡張子、年やエピソードが一致しないもの、シーズンパック（エピソード検索時）、予告編、盗撮版と思われるものを除外します。",
  Balanced: "バランス",
  "Keeps the malware/year/episode-mismatch checks but allows season packs and oversized files. Same as hitting Search wider in the picker.":
    "マルウェア、年、エピソード不一致のチェックは維持しつつ、シーズンパックや大容量ファイルを許可します。再生選択画面で「検索範囲を広げる」を押した場合と同じです。",
  "No filtering. Every stream every addon returns shows up, including obvious junk. You'll be on your own.":
    "フィルターなし。すべてのアドオンが返した全ストリームを、明らかな不要データも含めて表示します。利用は自己責任です。",
  Condensed: "コンパクト",
  "Default. Top pick at the top, quality tiles, and an All-Sources drawer. Harbor scores and ranks results.":
    "デフォルト。最上部におすすめ、その下に画質タイルと「すべてのソース」ドロワーを表示します。Harborが結果を評価して順位付けします。",
  "Flat list of sources grouped by addon, with a filter dropdown. No re-ranking. Closest match to the Stremio app's stream picker.":
    "アドオン別にまとめたソースのフラットなリストと、絞り込みメニューを表示します。並べ替えはしません。Stremioアプリのストリーム選択画面に最も近い形式です。",
  "Harbor ranking": "Harborの順位付け",
  "Default. Harbor parses and scores every source and surfaces the best quality first.":
    "デフォルト。Harborが各ソースを解析・評価し、最高画質を最初に表示します。",
  "Addon order": "アドオン順",
  "Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps.":
    "各アドオンの結果を取得順のまま、アドオンリストの順にまとめて表示します。StremioやVidiアプリと同じ形式です。",
  "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Cached streams play direct. Keys stay local.":
    "Real-Debrid、TorBox、AllDebrid、Premiumize、Debrid-Link。キャッシュ済みストリームは直接再生されます。キーはローカルに保存されます。",
  "Real-Debrid API token": "Real-Debrid APIトークン",
  "API token": "APIトークン",
  "API key": "APIキー",
  "Faster and quieter than torrents if you already pay for Usenet. Configure on the addon page, paste the manifest URL it returns.":
    "すでにUsenetを契約している場合は、Torrentより高速で静かです。アドオンのページで設定し、返されたマニフェストURLを貼り付けてください。",
  "Searches and streams directly off Easynews. No debrid needed. Just your Easynews login.":
    "Easynewsから直接検索してストリーミングします。Debridは不要です。Easynewsのログイン情報だけで利用できます。",
  Expired: "期限切れ",
  "Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.":
    "HarborがStremioからアドオンコレクションを取得します。個別のアドオンは「ストリーミングソース」で管理できます。",
  "A specific summary lands faster than a long paragraph. Steps to reproduce help most of all.":
    "長い文章より、具体的で簡潔な説明のほうが早く伝わります。特に再現手順が役立ちます。",
  Summary: "概要",
  "Steps to reproduce": "再現手順",
  "What broke?": "何が壊れましたか？",
  "What actually happened": "実際に起きたこと",
  "What you expected": "期待していた動作",
  Severity: "深刻度",
  "Screenshots and recordings": "スクリーンショットと録画",
  "Credit (optional)": "クレジット（任意）",
  "Bug reporters get listed in the release notes when their report leads to a shipped fix. Leave blank to stay anonymous.":
    "報告をもとに修正がリリースされた場合、報告者名をリリースノートに掲載します。匿名を希望する場合は空欄にしてください。",
  Theme: "テーマ",
  "Theme Library": "テーマライブラリ",
  "Your themes": "あなたのテーマ",
  "Ships with Harbor. Always available.": "Harborに付属し、いつでも利用できます。",
  "Themes you imported or built.": "インポートまたは作成したテーマです。",
  "Build a new theme": "新しいテーマを作成",
  "Copy theme": "テーマをコピー",
  Copy: "コピー",
  "Apply custom theme": "カスタムテーマを適用",
  "Background image": "背景画像",
  Ambience: "雰囲気",
  "The quick brown fox jumps over the lazy dog": "素早い茶色のキツネが、のろまな犬を飛び越える",
  "Default. Humanist serif, warm sans.":
    "デフォルト。ヒューマニスト系セリフ体と温かみのあるサンセリフ体。",
  "Classic. Was Harbor's original pair.": "クラシック。Harborで最初に採用された組み合わせです。",
  "Clean modern. Sans across the board.": "クリーンでモダン。すべてサンセリフ体。",
  "Editorial. Headline-strong display.": "エディトリアル。見出しが際立つディスプレイ書体。",
  "Technical. IBM's open family.": "テクニカル。IBMのオープンフォントファミリー。",
  "Stremio's typeface. Geometric humanist sans.":
    "Stremioの書体。幾何学的なヒューマニスト系サンセリフ体。",
  "Whatever your OS uses.": "OSのシステムフォント。",
  Typography: "タイポグラフィ",
  Colors: "カラー",
  "Color tokens": "カラートークン",
  "Theme cheat sheet": "テーマ早見表",
  "Stable selectors": "安定したセレクター",
  "Now using": "現在使用中",
  "Custom palette": "カスタムパレット",
  "Hand-tuned colors. Edit them in the section above.":
    "手動で調整した配色です。上のセクションで編集できます。",
  "Edit colors": "カラーを編集",
  Bokeh: "ボケ",
  "Top dock": "上部ドック",
  "Side rail": "サイドレール",
  "Stremio rail": "Stremioレール",
  "Floating dock": "フローティングドック",
  "Dracula sidebar": "Draculaサイドバー",
  "Nord sidebar": "Nordサイドバー",
  "Forest sidebar": "Forestサイドバー",
  "Royal top bar": "Royalトップバー",
  "Cinematic overlay": "シネマティックオーバーレイ",
  "tvOS chrome": "tvOS風UI",
  tvOS: "tvOS",
  "Living-room focus, floating glass chrome.": "リビング向けの、浮遊感のあるガラス調UI。",
  "Custom chrome": "カスタムUI",
  "Sidebar layout": "サイドバーレイアウト",
  "Glass cards": "ガラスカード",
  "Stremio cards": "Stremioカード",
  "Hairline cards": "極細枠カード",
  "Crunch cards": "Crunchカード",
  "Noir cards": "Noirカード",
  "Custom cards": "カスタムカード",
  "Flat cards": "フラットカード",
  "No background image": "背景画像なし",
  "Dim overlay": "暗めのオーバーレイ",
  "Use the native window title bar": "OS標準のウィンドウタイトルバーを使用",
  "Bokeh background": "ボケ背景",
  "Pick a layout, set colors and fonts, save it to your library. No code needed.":
    "レイアウトを選び、色とフォントを設定してライブラリに保存できます。コードは不要です。",
  "Open studio": "スタジオを開く",
  "Every variable, selector, hook, and recipe for building custom Harbor themes.":
    "Harborのカスタムテーマ作成に必要な変数、セレクター、フック、レシピをすべて掲載しています。",
  "Make your own in the Theme Studio, or import one a friend shared.":
    "テーマスタジオで自作するか、友達から共有されたテーマをインポートできます。",
  "Open library": "ライブラリを開く",
  "Build a Theme": "テーマを作成",
  "Pick a layout, set colors and fonts. No code needed.":
    "レイアウトを選び、色とフォントを設定できます。コードは不要です。",
  "Import a Theme": "テーマをインポート",
  "Got a theme a friend shared? Drop it in.":
    "友達から共有されたテーマをここにドロップしてください。",
  "Choose file": "ファイルを選択",
  "Window title bar": "ウィンドウタイトルバー",
  "Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.":
    "Harbor内蔵のタイトルバーとウィンドウボタンの代わりに、OS標準のものを使用します。再生中など、アプリ内のボタンに手が届きにくい場合に便利です。",
  "{name} imported to your library": "{name}をライブラリにインポートしました",
  "Click any binding to rebind it. Press Esc while capturing to cancel. Letters ignore Shift (so K and Shift+K trigger the same action).":
    "キー設定をクリックすると変更できます。入力待機中にEscを押すとキャンセルします。英字ではShiftが無視されるため、KとShift+Kは同じ操作になります。",
  Global: "グローバル",
  "Anywhere in Harbor.": "Harbor内のどこでも有効です。",
  NAVIGATION: "ナビゲーション",
  PLAYBACK: "再生",
  VOLUME: "音量",
  TRACKS: "トラック",
  SPEED: "速度",
  PANELS: "パネル",
  Conflict: "競合",
  "Press a key…": "キーを押してください…",
  "Focus search": "検索にフォーカス",
  "Jump to the top-bar search from anywhere.": "どこからでもトップバーの検索欄に移動します。",
  "Open Harbor's settings outside playback.": "再生画面以外でHarborの設定を開きます。",
  "Your face in Watch Together rooms, sessions, and chat. Sits on top of your Stremio account.":
    "Watch Togetherのルーム、セッション、チャットに表示されるあなたの顔です。Stremioアカウントのプロフィールに追加されます。",
  "Use my AniList avatar as my Harbor avatar": "AniListのアバターをHarborのアバターとして使用",
  "Use my Trakt avatar as my Harbor avatar": "TraktのアバターをHarborのアバターとして使用",
  "Use my Simkl avatar as my Harbor avatar": "SimklのアバターをHarborのアバターとして使用",
  "Not signed in": "未ログイン",
  "addon synced": "アドオンを同期済み",
  "addons synced": "アドオンを同期済み",
  "Sync now": "今すぐ同期",
  "Syncing…": "同期中…",
  "Stremio ID": "Stremio ID",
  "Re-authenticate": "再認証",
  "Sign in to sync your library, watch progress, and addons.":
    "ログインすると、ライブラリ、視聴進捗、アドオンを同期できます。",
  "Deploy your relay": "自分のリレーをデプロイ",
  "Spins up a tiny server on Cloudflare's free Workers tier. Stays online forever (or until you stop it). Friends connect by URL.":
    "Cloudflareの無料Workersプランに小規模なサーバーを立ち上げます。停止するまで常時稼働し、友達はURLから接続できます。",
  "Click the button below. It opens Cloudflare's token page in your browser. Sign in (free, takes 30 seconds if you don't have an account).":
    "下のボタンをクリックすると、ブラウザでCloudflareのトークンページが開きます。ログインしてください。アカウントがなくても無料で、登録は30秒ほどです。",
  "Fill the top of the form to look exactly like this:":
    "フォーム上部を次の例とまったく同じように入力してください。",
  "Open Cloudflare token page": "Cloudflareのトークンページを開く",
  "I have my token": "トークンを取得済み",
  "40-character token": "40文字のトークン",
  "Which account should the relay live in?": "リレーを配置するアカウントを選択してください。",
  "Uploading worker, wiring durable object…": "Workerをアップロードし、Durable Objectを接続中…",
  "Takes about 10 seconds.": "約10秒かかります。",
  "Relay is live": "リレーが稼働中",
  "URL is saved and ready to share.": "URLを保存しました。共有できます。",
  "Your relay URL": "リレーURL",
  "Copied. Paste it to your friend.": "コピーしました。友達に貼り付けて送ってください。",
  "Send this to anyone you want to watch with. They paste it in their Settings → Harbor Relay. After that, share a 6-character room code from the people icon up top.":
    "一緒に視聴したい相手にこれを送ってください。相手は「設定 → Harbor Relay」に貼り付けます。その後、上部のユーザーアイコンから6文字のルームコードを共有してください。",
  "One last thing on Cloudflare's side": "Cloudflare側で最後の設定が必要です",
  "Click the button below to open Cloudflare's Workers page.":
    "下のボタンをクリックしてCloudflareのWorkersページを開いてください。",
  "Open Cloudflare Workers": "Cloudflare Workersを開く",
  "Try deploy again": "もう一度デプロイ",
  "Paste your API token first.": "先にAPIトークンを貼り付けてください。",
  "Token works, but no accounts came back. Check the token's permissions.":
    "トークンは有効ですが、アカウントを取得できませんでした。トークンの権限を確認してください。",
  "No Cloudflare accounts found for this token.":
    "このトークンに対応するCloudflareアカウントが見つかりません。",
  "Connect your Trakt account": "Traktアカウントを接続",
  "Connect Trakt": "Traktに接続",
  "About Trakt": "Traktについて",
  "Harbor will scrobble your playback to Trakt and sync your watchlist.":
    "Harborは再生状況をTraktに記録し、ウォッチリストを同期します。",
  Authorized: "認証済み",
  "Open profile": "プロフィールを開く",
  "Wear your Trakt profile picture across Harbor instead of the default.":
    "デフォルトの代わりに、Traktのプロフィール画像をHarbor全体で使用します。",
  "Disconnect from Trakt": "Traktとの接続を解除",
  "Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.":
    "Traktとの接続を解除しますか？再接続するまで、視聴記録の送信と同期は停止します。",
  Disconnect: "接続解除",
  "Blur comments by default": "コメントをデフォルトでぼかす",
  "Comments on episode/show pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "エピソードや番組のページでは、ネタバレに指定されていないコメントも、表示するまでぼかされます。",
  "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "アニメページでは、ネタバレに指定されていないコメントも、表示するまでぼかされます。",
  "Show AniList comments": "AniListのコメントを表示",
  "Show forum threads and comments from AniList on anime detail pages.":
    "アニメ詳細ページにAniListのフォーラムスレッドとコメントを表示します。",
  today: "今日",
  "Connect your Simkl account": "Simklアカウントを接続",
  "Connect Simkl": "Simklに接続",
  "About Simkl": "Simklについて",
  "Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.":
    "Harborで見終えた作品をSimklで視聴済みにし、視聴予定リストを同期します。",
  "Authorized on this device": "このデバイスで認証済み",
  "Wear your Simkl profile picture across Harbor instead of the default.":
    "デフォルトの代わりに、Harbor全体でSimklのプロフィール画像を使用します。",
  "Disconnect from Simkl": "Simklとの接続を解除",
  "Disconnect Simkl? Syncing will stop until you reconnect.":
    "Simklとの接続を解除しますか？再接続するまで同期は停止します。",
  "Connect your AniList account": "AniListアカウントを接続",
  "Connect AniList": "AniListを連携",
  "About AniList": "AniListについて",
  "Harbor shows your AniList lists on the Anime page and keeps your progress in sync.":
    "Harborでは、「アニメ」ページにAniListのリストを表示し、進捗を同期します。",
  "Sync watch progress": "視聴進捗を同期",
  "Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.":
    "アニメのエピソードを見終えると、AniListの進捗が更新されます。進捗は増える方向にのみ同期され、すでに登録されている話数が減ることはありません。",
  "Show your AniList profile picture as your Harbor avatar.":
    "AniListのプロフィール画像をHarborのアバターとして表示します。",
  "Disconnect from AniList": "AniListとの接続を解除",
  "Discord webhook URL": "DiscordウェブフックURL",
  Sources: "ソース",
  "Pick which calendars feed your webhook. Items are deduped across sources before sending.":
    "ウェブフックに反映するカレンダーを選択します。送信前にソース間の重複は除外されます。",
  "Filter by media type after the sources merge. Leave them all on to send everything.":
    "ソースの統合後にメディアタイプで絞り込みます。すべて送信するには、全項目をオンのままにしてください。",
  "Episodes and movies from shows you've saved on Stremio.":
    "Stremioに保存した番組のエピソードと映画。",
  "Sign in to Stremio first.": "まずStremioにログインしてください。",
  "All upcoming": "すべての配信予定",
  "Everything releasing in the current month from TMDB.":
    "TMDBのデータに基づく、今月公開の全作品。",
  "Add a TMDB key in Library settings.": "「ライブラリ」設定でTMDBキーを追加してください。",
  "My Trakt": "マイTrakt",
  "Upcoming episodes and movies from your Trakt watchlist.":
    "Traktウォッチリストにある今後配信予定のエピソードと映画。",
  "Connect Trakt first.": "まずTraktに接続してください。",
  "The most anticipated upcoming releases on Trakt. No login needed.":
    "Traktで最も期待されている今後のリリース。ログインは不要です。",
  "Anything matching your Custom calendar: tracked people, genres, providers, countries.":
    "カスタムカレンダーの条件に一致するすべての作品: 追跡中の人物、ジャンル、配信サービス、国。",
  "Sent. Check your channel.": "送信しました。チャンネルを確認してください。",
  "Each rule fires independently. Define what triggers a ping and where it goes.":
    "各ルールは個別に実行されます。通知の条件と送信先を設定してください。",
  "New rule": "新しいルール",
  "Add a Discord or Telegram URL above before creating rules.":
    "ルールを作成する前に、上でDiscordまたはTelegramのURLを追加してください。",
  "No automations yet. Hit New rule to wire one up.":
    "自動化はまだありません。「新しいルール」を押して設定してください。",
  "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.":
    "Discordでは、Harborから通知が送られるたびにチャンネルへメッセージを投稿します。設定は約1分で完了します。",
  "Open the Discord server where you want notifications to land.":
    "通知を送信するDiscordサーバーを開きます。",
  "Edit Channel": "チャンネルを編集",
  Integrations: "連携サービス",
  "New Webhook": "新しいウェブフック",
  "Copy Webhook URL": "ウェブフックURLをコピー",
  "Paste the URL into the box above and send a test.":
    "URLを上の欄に貼り付け、テスト送信してください。",
  "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.":
    "「連携サービス」が見つかりませんか？「ウェブフックの管理」権限が必要です。サーバーの所有者に依頼してください。",
  "Open Discord's webhook help": "Discordのウェブフックヘルプを開く",
  "Telegram bot": "Telegramボット",
  "bot token": "ボットトークン",
  "chat ID": "チャットID",
  "Open BotFather": "BotFatherを開く",
  "Bot token": "ボットトークン",
  "Open the bot BotFather just made (he sends you a link). Send it any message so it's allowed to message you back.":
    "BotFatherが作成したボットを開きます（リンクが届きます）。ボットから返信を受け取れるよう、任意のメッセージを送信してください。",
  "Open userinfobot": "userinfobotを開く",
  "Chat ID": "チャットID",
  "Send test": "テスト送信",
  "Open Settings": "設定を開く",
  "Open Library settings": "ライブラリ設定を開く",
  "add one in settings": "設定で追加",
  "Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.":
    "AIOStreamsなどのアグリゲーターアドオンを使っていますか？アドオン側の並べ替えと絞り込みは、Harborに結果が届く前にアドオン内で行われ、その後、上記のHarborのストリームフィルターと結果の並び順が適用されます。結果が予想より少ない場合は、どちらか一方の条件を緩めてください。アドオン内のフィルターを緩めるか、Harborのストリームフィルターを「バランス」または「オフ」に設定します。",
  "Easynews+": "Easynews+",
  "{n} services need attention": "{n}件のサービスに対応が必要です",
  "Health for {n} services below": "下記{n}件のサービスの稼働状況",
  "{n}d left": "残り{n}日",
  "Save a TMDB key in Library & metadata to turn on streaming catalogs.":
    "「ライブラリとメタデータ」にTMDBキーを保存すると、ストリーミングカタログが有効になります。",
  "Sign in to Stremio first. Your installed addons sync from there.":
    "まずStremioにログインしてください。インストール済みのアドオンはStremioから同期されます。",
  Manage: "管理",
  "Last synced {n}s ago.": "{n}秒前に同期しました。",
  "Show {n} more addons": "アドオンをさらに{n}件表示",
  "All addons ({n})": "すべてのアドオン（{n}）",
  "Who's watching?": "どなたが視聴しますか？",
  "Pick a profile to continue.": "続行するプロフィールを選択してください。",
  "Add profile": "プロフィールを追加",
  "Profile not found.": "プロフィールが見つかりません。",
  Back: "戻る",
  "Harbor identity": "Harborプロフィール",
  "Edit {name}": "{name}を編集",
  "New profile": "新しいプロフィール",
  "Display name": "表示名",
  "Upload photo": "写真をアップロード",
  "Use Trakt avatar": "Traktのアバターを使用",
  "Use AniList avatar": "AniListのアバターを使用",
  "Use Simkl avatar": "Simklのアバターを使用",
  "Share with {name}": "{name}と共有",
  "Use the primary profile's Stremio library, watchlist, and addons.":
    "メインプロフィールのStremioライブラリ、ウォッチリスト、アドオンを使用します。",
  "Use a separate Stremio account": "別のStremioアカウントを使用",
  "Sign in from the sidebar after saving. Library and addons stay separate.":
    "保存後、サイドバーからサインインしてください。ライブラリとアドオンは別々に保持されます。",
  "Delete profile": "プロフィールを削除",
  "Delete this profile?": "このプロフィールを削除しますか？",
  Confirm: "確定",
  "Save changes": "変更を保存",
  "Create profile": "プロフィールを作成",
  "Only the primary profile can edit other profiles.":
    "他のプロフィールを編集できるのはメインプロフィールだけです。",
  Security: "セキュリティ",
  "PIN on": "PINオン",
  "PIN off": "PINオフ",
  "no tab locks": "タブのロックなし",
  "{n} tab locked": "{n}個のタブがロックされています",
  "{n} tabs locked": "{n}個のタブをロック",
  "Profile security": "プロフィールのセキュリティ",
  "PIN & sidebar locks": "PINとサイドバーのロック",
  "Pick a PIN and which sidebar tabs require it.":
    "PINを設定し、入力が必要なサイドバーのタブを選択してください。",
  PIN: "PIN",
  "4-digit PIN is set.": "4桁のPINが設定されています。",
  "No PIN set.": "PINが設定されていません。",
  "Set PIN": "PINを設定",
  Change: "変更",
  "Sidebar access": "サイドバーへのアクセス",
  "No locks. All sidebar tabs open without a PIN.":
    "ロックはありません。すべてのサイドバータブをPINなしで開けます。",
  "{n} tab requires this profile's PIN.": "{n}個のタブでこのプロフィールのPINが必要です。",
  "{n} tabs require this profile's PIN.": "{n}個のタブでこのプロフィールのPINが必要です。",
  "Lock sidebar tabs": "サイドバーのタブをロック",
  "Locks only activate once a PIN is set.": "ロックはPINを設定すると有効になります。",
  "Play button behavior": "再生ボタンの動作",
  "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.":
    "作品で再生を押したときの動作を選択します。手動なら、画質とソースを自由に選べます。",
  "Player engine": "プレーヤーエンジン",
  "HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.":
    "HTML5ではWebView2が対応するすべての形式を再生できます。mpvはTrueHD、DTS-HD、AV1、特殊なコンテナ、HDRに対応します。自動ではソースに応じて選択します。",
  "Seek bar": "シークバー",
  "Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.":
    "プレーヤー下部のタイムラインをカスタマイズします。つまみをステッカーに変えたり、バーの高さや色を変更したりできます。設定はここにリアルタイムで反映されます。",
  "Subtitle style": "字幕スタイル",
  "How subtitles look during playback. Live preview below.":
    "再生中の字幕の表示を設定します。下にリアルタイムプレビューが表示されます。",
  "Show format chips on stream rows": "ストリーム行に形式タグを表示",
  "The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.":
    "選択画面で各ストリームに解像度、HDR形式、コーデック、音声形式のタグを表示します。オフにするとすべて非表示になります。",
  "Poster size": "ポスターサイズ",
  "Scale every poster and card across Home, Discover, and your library. Bump it up on a 4K or large display where the defaults feel small, or shrink it for a denser grid.":
    "ホーム、見つける、ライブラリにあるすべてのポスターとカードのサイズを調整します。初期設定では小さく感じる4Kディスプレイや大画面では大きくし、グリッドに多く表示するなら小さくできます。",
  Compact: "コンパクト",
  Default: "デフォルト",
  Large: "大",
  Huge: "特大",
  Accessibility: "アクセシビリティ",
  "Make everything bigger and easier to read: sidebar, menus, popups, every page. The whole interface scales live as you drag, so you can see the change right here. Great on 4K and ultrawide monitors, or whenever the text feels small.":
    "サイドバー、メニュー、ポップアップ、各ページなど、すべてを大きく見やすくします。ドラッグ中もインターフェース全体の表示倍率が変わるため、ここですぐに確認できます。4Kやウルトラワイドモニターをお使いの場合や、文字が小さく感じる場合に便利です。",
  "Interface scale": "インターフェースの表示倍率",
  "Trailer quality": "予告編の画質",
  "How sharp the trailer is when you hit the preview button. Auto picks from your connection speed. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "プレビューボタンを押したときに再生する予告編の画質です。自動では接続速度に応じて選択します。1080pと最高では、付属のffmpegで別々の映像と音声を結合するため、再生開始まで少し時間がかかります。",
  Auto: "自動",
  Best: "最高",
  Audio: "オーディオ",
  "Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.":
    "システムのEQを変更せずに音質を調整します。mpvエンジンに適用され、HTML5エンジンでは音声がそのまま再生されます。",
  "Normalize loudness": "音量を均一化",
  "Maximum volume boost": "最大音量ブースト",
  "How far you can boost past 100 percent on the volume bar. Higher settings can get very loud.":
    "音量バーで100%を超えて増幅できる上限です。高く設定すると非常に大きな音になる場合があります。",
  "Evens out quiet dialogue and loud action scenes with a dynamic normalizer.":
    "ダイナミックノーマライザーで、小さな会話音と大きなアクションシーンの音量差を抑えます。",
  Flat: "フラット",
  "Bass boost": "低音ブースト",
  "Vocal clarity": "音声を明瞭に",
  "Less bass": "低音を抑える",
  "Night mode": "ナイトモード",
  "Night mode gently compresses loud moments for late-night watching. Profiles take effect when the next track loads and stack with the normalizer.":
    "ナイトモードでは、深夜でも視聴しやすいよう大きな音を穏やかに圧縮します。プロファイルは次のトラックの読み込み時に適用され、ノーマライザーと併用されます。",
  "Skip intros": "イントロをスキップ",
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
    "HarborはAniSkip、TheIntroDB、ファイル内のチャプターからイントロとクレジットの時間を検出し、適切なタイミングでスキップボタンを表示します。",
  "Auto-skip intros": "イントロを自動スキップ",
  "Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.":
    "オープニングが始まると自動的にスキップします。この設定にかかわらずスキップボタンは表示されます。シークでイントロに戻った場合は、再度スキップせずに再生します。",
  "Next episode prompt": "次のエピソードの案内",
  "When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.":
    "エピソード終了の何秒前に「次のエピソード」を表示するかを設定します。自動ではエピソードの長さに合わせて調整し、短いエピソードで早く表示されすぎないようにします。オフにすると非表示になります。",
  Off: "オフ",
  "30s": "30秒",
  "45s": "45秒",
  "1 min": "1分",
  "1.5 min": "1分30秒",
  "2 min": "2分",
  Downloads: "ダウンロード",
  "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.":
    "プレーヤーでダウンロードを押したときにHarborが動画を保存する場所です。別のドライブを含む任意のフォルダーを選べます。",
  HTML5: "HTML5",
  mpv: "mpv",
  "Anime4K upscaling": "Anime4Kアップスケーリング",
  Flat_Style: "Flat_Style",
  Background: "背景",
  "{name} will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "{name}をHarborから削除します。これを使用するよう設定した項目はInterに戻ります。",
  "Player & quality": "プレーヤーと画質",
  "Pick the playback engine and which quality chips show up on cards.":
    "再生エンジンと、カードに表示する画質タグを選択します。",
  Starting: "起動中",
  "Not running": "停止中",
  Copied: "コピーしました",
  Stop: "停止",
  Restart: "最初から再生",
  "Start server": "サーバーを起動",
  "Your streaming server address": "ストリーミングサーバーのアドレス",
  "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.":
    "Harborはこのパソコン上で小規模なストリーミングサーバーを実行します。その接続先がこちらです。このパソコンから別のデバイスへストリーミングするには、Wi-Fi用アドレスをコピーし、そのデバイスのHarborにある「リモートストリーミングサーバー」に貼り付けます。",
  "On this computer": "このパソコンから",
  "From other devices on your Wi-Fi": "同じWi-Fi上の他のデバイスから",
  "Harbor in your browser": "ブラウザー版Harbor",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer.":
    "現在インストールされているHarborを、ネットワーク上でWebアプリとして利用できるようにします。スマートフォン、ノートパソコン、テレビのブラウザーで開いてログインすると、このパソコン経由でストリーミングできます。",
  "From any browser on your Wi-Fi": "同じWi-Fi上の任意のブラウザーから",
  "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.":
    "ポート{WEB_PORT}で起動できませんでした。別のアプリが使用している可能性があります。オフにしてから再度オンにしてください。",
  Connected: "接続済み",
  "Custom CSS": "カスタムCSS",
  "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.":
    "ドキュメントにリアルタイムで挿入されます。ボタンのデザイン、間隔、色などを自由に変更できます。",
  "Custom JS": "カスタムJS",
  "Runs in the app's WebView. You're modding your own client. No sandbox, no safety net. Errors land in the console.":
    "アプリのWebView内で実行されます。自分のクライアントを改造する機能です。サンドボックスも安全策もありません。エラーはコンソールに出力されます。",
  "Custom HTML overlay": "カスタムHTMLオーバーレイ",
  "Injected into a fixed-position layer above the app (pointer-events disabled by default). Wrap in a div with pointer-events:auto to make it interactive.":
    "アプリ上部の固定レイヤーに挿入されます（デフォルトではpointer-eventsは無効）。操作可能にするには、pointer-events:autoを指定したdivで囲んでください。",
  "Custom code": "カスタムコード",
  "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.":
    "上級者向けの機能です。独自のCSS、JS、HTMLをHarborに挿入できます。ローカル設定に保存され、端末外には送信されません。",
  "You're modding your own client. Custom JS has full access to your Harbor session. Only paste code you wrote or fully trust.":
    "自分のクライアントを改造する機能です。カスタムJSはHarborセッションに完全アクセスできます。自分で書いたコードか、完全に信頼できるコードだけを貼り付けてください。",
  "{n} chars": "{n}文字",
  "Player layout": "プレーヤーレイアウト",
  "Pick a theme, then rearrange every button in the player chrome. Hide what you never use, promote what you do.":
    "テーマを選び、プレーヤーの操作バーにある各ボタンを並べ替えます。使わないものは非表示にし、よく使うものは目立つ位置に配置できます。",
  "Click any control in the live preview to move, hide, or reorder it.":
    "ライブプレビューのコントロールをクリックすると、移動、非表示、並べ替えができます。",
  Profile: "プロファイル",
  visible: "表示",
  hidden: "非表示",
  "on the {themeName} theme.": "{themeName}テーマ。",
  "Edit player layout": "プレーヤーレイアウトを編集",
  "Harbor's native player chrome.": "Harbor標準のプレーヤー操作バー。",
  Stremio: "Stremio",
  "Familiar Stremio button order.": "Stremioでおなじみのボタン配置。",
  "Confirm full reset": "完全リセットの確認",
  "Reset all to default": "すべて初期設定に戻す",
  "Discard changes": "変更を破棄",
  "Designing the player layout": "プレーヤーレイアウトを設計",
  "Customizing the player": "プレーヤーをカスタマイズ",
  "Couldn't save your layout. {error}": "レイアウトを保存できませんでした。{error}",
  "You have unsaved changes that will be lost when switching profiles. Continue?":
    "プロファイルを切り替えると、未保存の変更は失われます。続行しますか？",
  "Couldn't switch profile. {error}": "プロフィールを切り替えられませんでした。{error}",
  "Couldn't create the profile. {error}": "プロフィールを作成できませんでした。{error}",
  "Couldn't rename the profile. {error}": "プロフィール名を変更できませんでした。{error}",
  "Delete this profile permanently? This cannot be undone.":
    "このプロフィールを完全に削除しますか？この操作は元に戻せません。",
  "Couldn't delete the profile. {error}": "プロフィールを削除できませんでした。{error}",
  "Couldn't import that file. {error}": "そのファイルをインポートできませんでした。{error}",
  "You have unsaved changes. Close the editor and discard them?":
    "保存されていない変更があります。エディターを閉じて変更を破棄しますか？",
  "Time format": "時間表示",
  "What the clock labels show on the seek bar.": "シークバーの時刻ラベルに表示する内容です。",
  "Elapsed and remaining": "経過時間と残り時間",
  "00:23 on the left, -1:12 on the right.": "左に00:23、右に-1:12と表示します。",
  "Remaining only": "残り時間のみ",
  "Single -1:12 label, both ends collapse.": "-1:12のラベルを1つだけ表示し、両端をまとめます。",
  "Elapsed only": "経過時間のみ",
  "Single 00:23 label, both ends collapse.": "00:23のラベルを1つだけ表示し、両端をまとめます。",
  "Volume control": "音量コントロール",
  "How the volume widget behaves on click and hover.":
    "クリックやホバー時の音量コントロールの動作です。",
  Slider: "スライダー",
  "Hover the speaker to reveal a horizontal slider.":
    "スピーカーにカーソルを合わせると、横向きのスライダーが表示されます。",
  Stepper: "段階式",
  "Click to cycle 100 / 75 / 50 / 25 / 0.":
    "クリックするたびに100 / 75 / 50 / 25 / 0へ切り替わります。",
  "Icon only": "アイコンのみ",
  "Click toggles mute. Wheel scrolls volume.":
    "クリックでミュートを切り替え、ホイールで音量を調整します。",
  "Back to relay": "リレーに戻る",
  Documentation: "ドキュメント",
  "Self-host": "セルフホスト",
  "Run your own Harbor Relay": "独自の Harbor Relay を運用する",
  "Two paths: Harbor handles the deploy for you, or you do it yourself with wrangler.":
    "方法は2つあります。Harbor にデプロイを任せるか、wrangler を使って自分でデプロイします。",
  Overview: "あらすじ",
  "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.":
    "Harborリレーは、ウォッチパーティー用のWebSocketルームをホストするCloudflare Workerです。各ユーザーが自分で運用します。Harborの中央サーバーはありません。",
  "Source: {code}. About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "ソース: {code}。約200行のJavaScriptで、依存関係はありません。何が実行されるか確認したい場合は、デプロイ前にお読みください。",
  Requirements: "要件",
  "A free Cloudflare account.": "無料の Cloudflare アカウント。",
  "About two minutes for the auto-deploy path.": "自動デプロイなら約2分。",
  "For the manual path: {code} 20+ and {code} CLI.":
    "手動で行う場合は、{code} 20+と{code} CLIが必要です。",
  "Auto-deploy from Harbor": "Harbor から自動デプロイ",
  "Easiest path. Harbor uploads the worker, creates the Durable Object namespace, and stores the resulting URL.":
    "最も簡単な方法です。HarborがWorkerをアップロードし、Durable Object名前空間を作成して、生成されたURLを保存します。",
  "Open Settings, then Harbor Relay.": "「設定」を開き、「Harbor Relay」を選択します。",
  "Click {kbd}.": "{kbd}をクリックします。",
  "Generate a Cloudflare API token with {code1} and {code2} permissions at {code3}. Paste it into Harbor.":
    "{code3}で、{code1}と{code2}の権限を持つCloudflare APIトークンを生成します。Harborに貼り付けてください。",
  "Pick the Cloudflare account to deploy under.":
    "デプロイ先の Cloudflare アカウントを選択します。",
  "Wait for the upload to finish. The relay URL gets written to {code} in Harbor settings.":
    "アップロードが完了するまでお待ちください。リレーURLはHarborの設定にある{code}へ保存されます。",
  "Manual deploy with wrangler": "wrangler で手動デプロイ",
  "For users who want to deploy themselves or already have a wrangler workflow.":
    "自分でデプロイしたい方、または既に wrangler のワークフローを使用している方向けです。",
  "Install wrangler and authenticate:": "wrangler をインストールして認証します:",
  "Save the worker source. Copy {code1} from the Harbor repo into a new directory as {code2}.":
    "Workerのソースを保存します。Harborリポジトリの{code1}を新しいディレクトリに{code2}という名前でコピーしてください。",
  "Save this {code} next to it:": "この{code}を同じ場所に保存します:",
  "Deploy:": "デプロイします:",
  "Note the URL Cloudflare returns. It looks like {code}.":
    "Cloudflareから返されたURLを控えてください。形式は{code}です。",
  "In Harbor: Settings, Harbor Relay, then {kbd}. Paste the URL with {code1} as the scheme instead of {code2}.":
    "Harborで「設定」、「Harborリレー」の順に開き、{kbd}を選択します。{code2}ではなく{code1}をスキームにしたURLを貼り付けてください。",
  "Verify it works": "動作を確認する",
  "Settings, Harbor Relay, then {kbd}.":
    "「設定」、「Harborリレー」の順に開き、{kbd}を選択します。",
  "The test calls {code} and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "テストでは{code}を呼び出し、Workerにアクセスでき、最新バージョンが実行されていることを確認します。テストに合格すれば、ウォッチパーティーのルームに接続できます。",
  "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.":
    "ウォッチパーティーのポップオーバーにリレーが古いというバナーが表示された場合は、上記の手順で再デプロイしてください。リレーから最新バージョンが報告されると、次回の接続時にバナーは自動的に消えます。",
  "Sharing your relay": "リレーを共有する",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique {code} subdomain acts as the access token. There is no login.":
    "リレーURLは共有できます。そのURLを知っている人は誰でも、あなたのリレー上のウォッチパーティールームに参加できます。一意の{code}サブドメインがアクセストークンとして機能します。ログインはありません。",
  "To run a public relay, post the {code} URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay, {kbd}.":
    "公開リレーを運用するには、{code}のURLをr/Stremioやコミュニティーの活動場所に投稿してください。他のHarborユーザーは「設定」、「Harborリレー」、{kbd}の順に開いて貼り付けます。",
  Costs: "料金",
  "Cloudflare Workers free tier:": "Cloudflare Workers の無料枠:",
  "100,000 requests per day.": "1日あたり100,000リクエスト。",
  "10ms CPU time per request.": "1リクエストあたり10msの CPU 時間。",
  "Unlimited Durable Object storage at $0.20 per million reads.":
    "Durable Object ストレージは無制限で、読み取り100万回あたり $0.20。",
  "A typical Watch Together session uses a few hundred messages per hour. Solo and small-group use stays well under free tier limits.":
    "通常のウォッチパーティーでは、1時間あたり数百件のメッセージが送信されます。1人または少人数での利用なら、無料枠の上限を大きく下回ります。",
  "If you exceed free tier, the Workers Paid plan is $5 per month and bumps the request allowance to 10 million per day.":
    "無料枠を超える場合、Workers Paidプランは月額$5で、リクエスト上限が1日あたり1,000万件に増えます。",
  Troubleshooting: "トラブルシューティング",
  Symptom: "症状",
  Cause: "原因",
  Fix: "解決方法",
  "Health check returns 5xx": "ヘルスチェックで 5xx が返される",
  "Worker crashed or hit memory limits": "Worker がクラッシュしたか、メモリ上限に達した",
  "Check logs in Cloudflare dashboard, then redeploy":
    "Cloudflare ダッシュボードでログを確認し、再デプロイします",
  "Connection refused / DNS does not resolve": "接続が拒否される / DNS で名前解決できない",
  "Worker deleted or URL wrong": "Worker が削除されているか、URL が間違っている",
  "Re-run deploy or paste the correct URL": "デプロイを再実行するか、正しい URL を貼り付けます",
  "Watch Together rooms drop after 6 hours": "Watch Together のルームが6時間後に終了する",
  "Durable Object idle eviction": "アイドル状態の Durable Object の退避",
  "Expected. Rooms recreate on next join.": "正常な動作です。次回参加時にルームが再作成されます。",
  "What the worker does": "Worker の機能",
  "{code}: returns JSON with the worker version. Used by the test button.":
    "{code}: WorkerのバージョンをJSONで返します。テストボタンで使用されます。",
  "{code} with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "WebSocketアップグレード付きの{code}: ウォッチパーティールームを開きます。状態はDurable Objectに保持され、アクティブなセッションが終了すると破棄されます。",
  "Saving…": "保存中…",
  Download: "ダウンロード",
  "Plain text (.txt)": "プレーンテキスト（.txt）",
  "JSON (.json)": "JSON（.json）",
  "PDF (print)": "PDF（印刷）",
  Relay: "リレー",
  "On Cloudflare, click {b1}, then find {b2} and click {b3}.":
    "Cloudflareで{b1}をクリックし、{b2}を見つけて{b3}をクリックします。",
  "Create Token": "トークンを作成",
  "Create Custom Token": "カスタムトークンを作成",
  "Get started": "始める",
  "Cloudflare token form filled with name 'Harbor Relay' and one permission row set to Account / Workers Scripts / Edit":
    "名前が「Harbor Relay」で、権限の行が「アカウント / Workers Scripts / 編集」に設定されたCloudflareのトークンフォーム",
  "Token name can be anything. The permission row must be exactly {b1} + {b2} + {b3}.":
    "トークン名は自由です。権限の行は必ず{b1} + {b2} + {b3}にしてください。",
  "Workers Scripts": "Workers Scripts",
  Edit: "編集",
  "Leave everything below it alone. Scroll down, click {b1}, then {b2}. Copy the long string it shows you (you only see it once) and bring it back here.":
    "それより下の項目は変更しないでください。下へスクロールして{b1}、次に{b2}をクリックします。表示された長い文字列をコピーして、ここに戻ってください。この文字列が表示されるのは一度だけです。",
  "Continue to summary": "概要に進む",
  Continue: "続ける",
  "Copy URL": "URLをコピー",
  "Something went wrong.": "問題が発生しました。",
  "Your account hasn't picked its free {code} address yet. Cloudflare only asks the first time. Quick to set up.":
    "アカウントの無料の{code}アドレスがまだ設定されていません。Cloudflareで初回のみ求められる、簡単な設定です。",
  "Click {b1} in the top right. Pick the {b2} template (it's the default, should already be selected).":
    "右上の{b1}をクリックします。{b2}テンプレートを選択してください。デフォルトなので、すでに選択されているはずです。",
  Create: "作成",
  "Hello World": "Hello World",
  "Cloudflare asks you to pick a name (this becomes {code}). Type any name (your first name works). Then click {b1}.":
    "Cloudflareで名前の入力を求められます。この名前が{code}になります。任意の名前を入力してください。自分の名前でもかまいません。次に{b1}をクリックします。",
  Deploy: "デプロイ",
  "Come back here and hit {b1}. The Hello World can stay where it is. It's free and harmless.":
    "ここに戻って{b1}をクリックします。Hello Worldはそのままでかまいません。無料で、問題はありません。",
  Close: "閉じる",
  "Try again": "再試行",
  "Reset all ({count})": "すべてリセット（{count}）",
  Player: "プレイヤー",
  "Inside the playback view.": "再生画面内の操作です。",
  Other: "その他",
  Navigation: "ナビゲーション",
  Seeking: "シーク",
  Volume: "音量",
  Tracks: "トラック",
  Speed: "再生速度",
  Panels: "パネル",
  "Close player": "プレイヤーを閉じる",
  "Exit playback and return to the previous view.": "再生を終了して前の画面に戻ります。",
  "Play / pause": "再生 / 一時停止",
  "Toggle playback.": "再生と一時停止を切り替えます。",
  "Toggle fullscreen": "全画面表示を切り替え",
  "Enter or exit fullscreen.": "全画面表示を開始または終了します。",
  "Toggle stats overlay": "統計オーバーレイを切り替え",
  "Show or hide the playback stats overlay.": "再生統計オーバーレイの表示と非表示を切り替えます。",
  "Cycle aspect / crop": "アスペクト比 / クロップを切り替え",
  "Cycle aspect and crop modes: Fit, Fill, Zoom, 16:9, 4:3, Original.":
    "アスペクト比とクロップモードを切り替えます: フィット、フィル、ズーム、16:9、4:3、オリジナル。",
  "Zoom out": "ズームアウト",
  "Step zoom out to restore baked-in black bars (Zoom mode).":
    "段階的にズームアウトして、映像に焼き込まれた黒帯を復元します（ズームモード）。",
  "Zoom in": "ズームイン",
  "Step zoom in to crop baked-in black bars (Zoom mode).":
    "段階的にズームインして、映像に焼き込まれた黒帯をクロップします（ズームモード）。",
  Screenshot: "スクリーンショット",
  "Save the current frame (video only, no subtitles) as a PNG to Pictures/Harbor.":
    "現在のフレームを動画のみ（字幕なし）のPNGとしてPictures/Harborに保存します。",
  "Record GIF": "GIFを録画",
  "Start or stop recording a GIF of the video (no subtitles). Saves to Pictures/Harbor.":
    "動画のGIF録画（字幕なし）を開始または停止します。Pictures/Harborに保存されます。",
  "Seek back": "早戻し",
  "Jump back by the Back seek step set under Behavior.":
    "「動作」で設定した巻き戻し幅だけ戻ります。",
  "Seek forward": "早送り",
  "Jump forward by the Forward seek step set under Behavior.":
    "「動作」で設定した早送り幅だけ進みます。",
  "Seek back 30s": "30秒戻る",
  "Jump back thirty seconds.": "30秒戻ります。",
  "Seek forward 30s": "30秒進む",
  "Jump forward thirty seconds.": "30秒進みます。",
  "Jump to start": "先頭へ移動",
  "Seek to the beginning.": "先頭までシークします。",
  "Jump to end": "末尾へ移動",
  "Seek to the last half second.": "最後の0.5秒までシークします。",
  "Volume up": "音量を上げる",
  "Raise volume (hold Shift for big steps).": "音量を上げます（Shiftを押しながらで大幅に調整）。",
  "Volume down": "音量を下げる",
  "Lower volume (hold Shift for big steps).": "音量を下げます（Shiftを押しながらで大幅に調整）。",
  "Toggle mute": "ミュートを切り替え",
  "Mute or unmute audio.": "音声のミュートとミュート解除を切り替えます。",
  "Cycle subtitles": "字幕を切り替え",
  "Cycle through available subtitle tracks.": "利用可能な字幕トラックを順に切り替えます。",
  "Cycle subtitles (alt)": "字幕を切り替え（別キー）",
  "A second binding for the same action so muscle memory survives.":
    "使い慣れた操作を維持できるよう、同じ操作に2つ目のキーを割り当てます。",
  "Subtitle delay −0.1s": "字幕の遅延 −0.1秒",
  "Shift subtitle timing earlier (Shift for fine steps).":
    "字幕のタイミングを早めます（Shiftを押しながらで微調整）。",
  "Subtitle delay +0.1s": "字幕の遅延 +0.1秒",
  "Shift subtitle timing later (Shift for fine steps).":
    "字幕のタイミングを遅らせます（Shiftを押しながらで微調整）。",
  "Next episode": "次のエピソード",
  "Skip to the next episode if available.": "次のエピソードがある場合はスキップします。",
  "Previous episode": "前のエピソード",
  "Skip to the previous episode if available.": "前のエピソードがある場合は戻ります。",
  "Previous channel": "前のチャンネル",
  "Jump back to the last live channel you watched (live TV only).":
    "最後に視聴していたライブチャンネルに戻ります（ライブTVのみ）。",
  "Speed down": "再生速度を下げる",
  "Slow playback by 0.25x.": "再生速度を0.25x下げます。",
  "Speed up": "再生速度を上げる",
  "Speed playback up by 0.25x.": "再生速度を0.25x上げます。",
  "Stream switcher": "ストリーム切り替え",
  "Open or close the in-player stream switcher.":
    "プレーヤー内のストリーム切り替えを開くか閉じます。",
  "Up next / episodes": "次のエピソード / エピソード一覧",
  "Open or close the episode panel.": "エピソードパネルを開くか閉じます。",
  "TV guide": "テレビ番組表",
  "Open or close the live TV guide (live channels only).":
    "ライブTVの番組表を開くか閉じます（ライブチャンネルのみ）。",
  "DVR / record": "DVR / 録画",
  "Open or close the live TV recorder (live channels only).":
    "ライブTVの録画画面を開くか閉じます（ライブチャンネルのみ）。",
  "Sleep at end of episode": "エピソード終了時にスリープ",
  "Toggle a sleep timer that pauses when this episode ends.":
    "このエピソードの終了時に一時停止するスリープタイマーを切り替えます。",
  Low: "低",
  "cosmetic, minor": "見た目上の問題、軽微",
  Normal: "標準",
  annoying: "不便",
  High: "高",
  "feature broken": "機能が動作しない",
  Critical: "重大",
  "app unusable": "アプリを使用できない",
  "Drop a clip of the bug if you can. A 5-second screen recording usually says more than five paragraphs.":
    "可能であれば、バグの動画も添付してください。通常、5秒の画面録画は5段落の説明よりも多くを伝えられます。",
  "Drop screenshots or screen recordings, or click to browse":
    "スクリーンショットや画面録画をドロップするか、クリックして選択",
  "PNG, JPG, WebP, GIF, MP4, WebM, MOV. Up to 6 files, 100 MB each.":
    "PNG、JPG、WebP、GIF、MP4、WebM、MOV。最大6ファイル、各100 MBまで。",
  "Credit me in the release notes if this report leads to a fix.":
    "この報告によって修正された場合、リリースノートに私の名前を掲載する。",
  "Want to fix it yourself?": "自分で修正してみませんか？",
  "Harbor is open source. PRs that reference a bug get reviewed within 48h and ship with credit in the release notes.":
    "Harborはオープンソースです。バグを参照するPRは48時間以内にレビューされ、リリースノートに貢献者名を掲載してリリースされます。",
  "Open repo on GitHub": "GitHubでリポジトリを開く",
  "Browse pull requests": "プルリクエストを見る",
  "What gets sent": "送信される内容",
  "Could not send:": "送信できませんでした:",
  "Ready to send": "送信準備完了",
  "Player freezes after the second episode autoplays":
    "2話目の自動再生後にプレーヤーがフリーズする",
  "Stream should start playing within a few seconds.":
    "ストリームは数秒以内に再生を開始するはずです。",
  "Spinner stays forever and nothing in the player loads.":
    "読み込みインジケーターが回り続け、プレーヤーには何も読み込まれません。",
  "Email or Discord": "メールアドレスまたはDiscord",
  "Loading environment details…": "環境情報を読み込んでいます…",
  "Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go faster.":
    "自動的に含まれます。キー、ライブラリ、URLは含まれません。問題をすばやく再現するための構造フラグのみです。",
  "Harbor test message (Discord). If you can read this, your webhook is wired up.":
    "Harborのテストメッセージ（Discord）。これを読める場合、webhookは正しく接続されています。",
  "Harbor test message (Telegram). If you can read this, your webhook is wired up.":
    "Harborのテストメッセージ（Telegram）。これを読める場合、webhookは正しく接続されています。",
  Failed: "失敗",
  Types: "種類",
  Movies: "映画",
  TV: "TVシリーズ",
  Anime: "アニメ",
  "Right-click a text channel, pick": "テキストチャンネルを右クリックし、次を選択します",
  Click: "クリック",
  "on the left, then": "を左側でクリックし、次に",
  "name it Harbor, hit": "名前をHarborにして、次を押します",
  "Telegram sends through a bot you create. You need two things: a":
    "Telegramでは、作成したボット経由で送信します。必要なのは次の2つです:",
  "and your": "とあなたの",
  "Both go in the boxes above. Harbor builds the URL for you.":
    "両方を上の欄に入力してください。URLはHarborが自動で生成します。",
  Tap: "タップ",
  "below. In Telegram, send him": "を下でタップします。Telegramで相手に",
  "Pick any name. Pick a username ending in":
    "名前は自由です。ユーザー名は末尾が次の文字列になるようにします",
  "BotFather replies with a token like": "BotFatherから次のようなトークンが届きます",
  "Long string with a colon in it. Copy it. Paste it into the":
    "コロンを含む長い文字列です。コピーして、上の",
  "box above.": "欄に貼り付けます。",
  "below. Send it": "を下でタップし、相手に次を送信します",
  "It replies with your numeric ID. Copy that number. Paste it into the":
    "数値IDが返信されます。その番号をコピーして、上の",
  Hit: "を押します",
  "You should get a message from your new bot.": "新しいボットからメッセージが届けば成功です。",
  "A new movie comes out": "新作映画が公開されたとき",
  "A new series comes out": "新作シリーズが配信されたとき",
  "A new anime comes out": "新作アニメが配信されたとき",
  "Someone I track has a new release": "フォロー中の人物の新作が公開されたとき",
  "A specific genre releases": "指定ジャンルの新作が公開されたとき",
  "A streamer releases something": "ストリーミングサービスで新作が配信されたとき",
  "A country releases something": "指定した国の新作が公開されたとき",
  "Trakt anticipated picks up something": "Traktの期待作に追加されたとき",
  "My Trakt watchlist updates": "Traktのウォッチリストが更新されたとき",
  "A Live TV program is about to start": "ライブTV番組の開始が近づいたとき",
  "Any new movie": "すべての新作映画",
  "Any new series": "すべての新作シリーズ",
  "Any new anime": "すべての新作アニメ",
  "Any of your {n} tracked people": "フォロー中の{n}人のいずれか",
  "Tracked people": "フォロー中の人物",
  "Any genre": "すべてのジャンル",
  Series: "シリーズ",
  "Any streamer": "すべてのストリーミングサービス",
  "Any country": "すべての国",
  "Trakt anticipated": "Traktの期待作",
  "Your Trakt watchlist": "Traktのウォッチリスト",
  "Live TV": "ライブTV",
  favorites: "お気に入り",
  "all channels": "すべてのチャンネル",
  "{n} min lead": "{n}分前",
  Automations: "自動化",
  "no channel": "チャンネルなし",
  "Edit rule": "ルールを編集",
  Name: "名前",
  WHEN: "条件",
  "Media type": "メディアタイプ",
  Genres: "ジャンル",
  Streamers: "ストリーミングサービス",
  Countries: "国",
  "Only my favorited channels": "お気に入りのチャンネルのみ",
  "Heads up": "お知らせ",
  "Harbor scans your IPTV playlists' EPG every 30 min for programs about to start.":
    "Harborは30分ごとにIPTVプレイリストのEPGをスキャンし、まもなく始まる番組を確認します。",
  "Add people in the Custom calendar manager first, then come back here.":
    "先にカスタムカレンダー管理で人物を追加してから、ここに戻ってください。",
  "People (empty = all tracked)": "人物（空欄 = フォロー中の全員）",
  "THEN notify on": "通知先",
  "Save rule": "ルールを保存",
  "My library": "マイライブラリ",
  Anticipated: "期待作",
  "Custom calendar": "カスタムカレンダー",
  "Harbor checks harbor.site for new versions and installs them in place. Nothing installs until you choose to, and a dismissed update never nags you again.":
    "Harborはharbor.siteで新しいバージョンを確認し、アプリをそのまま更新します。選択するまで何もインストールされず、一度スキップした更新が再び表示されることもありません。",
  "Library, watch progress, and addon collection sync from this account.":
    "ライブラリ、視聴進捗、アドオンコレクションがこのアカウントから同期されます。",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your Stremio sign-in.":
    "Harborの設定全体を1つのファイルにエクスポートし、新しいPCで復元したり、バックアップとして保管したりできます。Stremioのログイン情報を除くすべてが含まれます。",
  "Harbor sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.":
    "Harborはテレメトリを送信しません。また、アドオンやメタデータプロバイダーによる広告、分析、トラッカーへの外部リクエストも、端末の外へ送信される前にブロックします。",
  "Keep Harbor a click away. Close it to the system tray instead of quitting, and control it from the tray menu. These also mirror into the tray menu live.":
    "Harborへすぐアクセスできるようにします。終了せずにシステムトレイへ格納し、トレイメニューから操作できます。これらの設定はトレイメニューにもリアルタイムで反映されます。",
  "Your color": "あなたのカラー",
  "Used for your cursor in Watch Together, your draw color, and your name pill in chat.":
    "「一緒に観る」でのカーソル、描画色、チャットの名前ラベルに使われます。",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app. Every install also syncs to your Stremio account, so the official app remains the canonical home for your library.":
    "Harborがstremio://インストールリンクを処理するため、設定からインストールまでアプリ内で完結します。インストール内容は毎回Stremioアカウントにも同期されるため、公式アプリが引き続きライブラリの基準となります。",
  "Let your Discord friends see what you are watching, with the show poster and a live progress bar. Desktop only, and only your own Discord client is involved (nothing touches a Harbor server).":
    "番組ポスターとリアルタイムの進捗バー付きで、視聴中の作品をDiscordのフレンドに表示します。デスクトップ版のみ対応し、ご自身のDiscordクライアントだけを使用します（Harborサーバーには一切接続しません）。",
  "Saved {d} from Harbor {a}.": "Harbor {a}から{d}を保存しました。",
  "MPV (native, recommended)": "MPV（ネイティブ、推奨）",
  "HTML5 (browser-based)": "HTML5（ブラウザベース）",
  "Player shell": "プレイヤーUI",
  "Seek bar style": "シークバーのスタイル",
  "Playback speed": "再生速度",
  "Subtitle appearance": "字幕の表示",
  "Subtitle font size": "字幕の文字サイズ",
  "Subtitle background": "字幕の背景",
  "Play mode": "再生モード",
  "Auto next episode": "次のエピソードを自動再生",
  "Automatically play the next episode when the current one ends.":
    "現在のエピソードが終わると、次のエピソードを自動で再生します。",
  "Local engine address": "ローカルエンジンのアドレス",
  "Remote server": "リモートサーバー",
  "Custom MPV code": "カスタムMPVコード",
  "Anime4K shaders": "Anime4Kシェーダー",
  "Server address": "サーバーアドレス",
  Connection: "接続",
  "Downloading to": "ダウンロード先",
  "Downloads folder": "ダウンロードフォルダー",
  "Speed test": "速度テスト",
  "Run speed test": "速度テストを実行",
  Test: "テスト",
  Internals: "内部設定",
  Layouts: "レイアウト",
  "New layout": "新しいレイアウト",
  "Save layout": "レイアウトを保存",
  "Delete layout": "レイアウトを削除",
  "Layout name": "レイアウト名",
  "Upload icon": "アイコンをアップロード",
  "Add element": "要素を追加",
  "Top bar": "上部バー",
  "Bottom bar": "下部バー",
  Inspector: "インスペクター",
  Options: "オプション",
  Controls: "コントロール",
  "Reset layout": "レイアウトをリセット",
  "Deploy relay": "リレーをデプロイ",
  "Relay URL": "リレーURL",
  "Test relay": "リレーをテスト",
  "Relay status": "リレーの状態",
  "Relay docs": "リレーのドキュメント",
  "Your relay": "自分のリレー",
  "Relay panel": "リレーパネル",
  "Set up a Cloudflare relay for Watch Together": "Watch Together用のCloudflareリレーを設定",
  "Copy relay URL": "リレーURLをコピー",
  "Relay is up to date": "リレーは最新です",
  "Relay needs update": "リレーの更新が必要です",
  "Relay not reachable": "リレーに接続できません",
  "Checking…": "確認中…",
  "Check relay": "リレーを確認",
  "Relay test passed": "リレーテストに合格しました",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.":
    "Stremioライブラリをスキャンし、構造がStremioの正確なスキーマと一致しない項目を書き換えます。いつ実行しても安全で、修正が必要な項目だけが変更されます。",
  "Translate series and movie posters to Arabic if available on TMDB":
    "TMDBで利用可能な場合、シリーズや映画のポスターをアラビア語版にする",
  "If enabled, posters will display the Arabic title. Disable this to keep the original English poster.":
    "有効にすると、ポスターにアラビア語のタイトルが表示されます。元の英語版ポスターを使うには無効にしてください。",
  "Translate descriptions and synopsis to Arabic": "説明とあらすじをアラビア語に翻訳",
  "Enable this to fetch Arabic descriptions for series and movies when available on TMDB.":
    "有効にすると、TMDBで利用可能なシリーズや映画のアラビア語の説明を取得します。",
  "Summary needs at least 6 characters": "概要は6文字以上必要です",
  "Preparing…": "準備中…",
  "Sending…": "送信中…",
  "Submit bug report": "バグレポートを送信",
  "Move to previous slot": "前のスロットに移動",
  "Move to next slot": "次のスロットに移動",
  "Move up": "上へ移動",
  "Move down": "下へ移動",
  "Preview state": "プレビュー状態",
  "Show this control": "このコントロールを表示",
  "Hide this control": "このコントロールを非表示",
  "Slot is getting crowded ({n}/{limit}). May overflow on narrow screens.":
    "スロットが混み合っています（{n}/{limit}）。画面幅が狭いと収まらない場合があります。",
  "Series tab": "シリーズタブ",
  "Watch Together panel": "Watch Togetherパネル",
  "Show this panel": "このパネルを表示",
  "Hide this panel": "このパネルを非表示",
  "No matches": "一致する結果はありません",
  "Sign in": "サインイン",
  "Sign out": "サインアウト",
  "Reset to default": "デフォルトに戻す",
  "Manual picker": "手動選択",
  "Hitting Play jumps straight into playback with the best stream Harbor finds.":
    "「再生」を押すと、Harborが見つけた最適なストリームですぐに再生を開始します。",
  "Hitting Play opens the source list so you can choose quality, debrid, and audio yourself.":
    "「再生」を押すとソース一覧が開き、画質、デブリッド、音声を自分で選べます。",
  "Remember last stream": "最後のストリームを記憶",
  "Auto-skip stalled streams": "停止したストリームを自動スキップ",
  "If a stream hasn't started playing within 10 seconds (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "ストリームが10秒以内に再生を開始しない場合（無効なソースや停止中のアドオンなど）、次に利用可能なストリームを自動的に試します。初期設定ではオフです。",
  "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.":
    "視聴を再開するとき、選択画面を再度開かず、前回とまったく同じストリーム（同じアドオンとソース）を再生します。毎回新しく選ぶにはオフにしてください。",
  "mpv on the desktop app, HTML5 in the browser. The right engine without thinking about it.":
    "デスクトップアプリではmpv、ブラウザーではHTML5。意識せずに最適なエンジンを使えます。",
  "Native webview playback. Smooth and integrated, but limited codec coverage.":
    "ネイティブwebview再生。スムーズで一体感がありますが、対応コーデックは限られます。",
  "Bundled with Harbor. Plays anything you throw at it.":
    "Harborに同梱。どんな形式でも再生できます。",
  "Embed mpv inside Harbor window": "Harborウィンドウ内にmpvを埋め込む",
  "Renders mpv inline so playback lives in Harbor itself. Disable to open it in a separate window instead.":
    "mpvをHarbor内に表示し、アプリ内でそのまま再生します。別ウィンドウで開くには無効にしてください。",
  "HDR-to-SDR tonemapping": "HDRからSDRへのトーンマッピング",
  "Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.":
    "bt.2446aを使用してHDRソースをSDRに変換します。SDRディスプレイでの使用を推奨します。",
  "HDR in a separate window": "HDRを別ウィンドウで再生",
  "Plays HDR content in its own window so Windows treats it as true HDR (the SDR brightness slider stops dimming it). Turn off HDR-to-SDR tonemapping above to use this on an HDR display.":
    "HDRコンテンツを専用ウィンドウで再生し、Windowsに真のHDRとして認識させます（SDR輝度スライダーによる暗転を防ぎます）。HDRディスプレイで使用するには、上の「HDRからSDRへのトーンマッピング」をオフにしてください。",
  "HDR display mode": "HDR表示モード",
  "Keeps Harbor embedded but lifts the HDR video onto its own opaque plane with the controls floating above, so Windows shows true HDR without the brightness slider dimming it. Needs HDR-to-SDR tonemapping off.":
    "Harbor内への埋め込みを維持しながら、HDR映像を独立した不透明レイヤーに表示し、その上にコントロールを重ねます。これにより、SDR輝度スライダーで暗くなることなく、Windowsで真のHDRを表示できます。「HDRからSDRへのトーンマッピング」をオフにする必要があります。",
  "Line-free video mode": "輝線除去モード",
  "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer (this mode bypasses the HDR display path). Leave OFF unless you see that line. Restart playback to apply.":
    "一部のモニターで画面端に表示される細い輝線を除去するため、互換性重視の表示モードを強制します。副作用として、4K再生がスライドショーのように重くなったり、HDRコンテンツが暗く見えたりする場合があります（このモードではHDR表示経路を使用しません）。輝線が見える場合以外はオフのままにしてください。適用するには再生をやり直してください。",
  "Motion smoothing": "モーションスムージング",
  "Interpolates frames for smoother panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. mpv only.":
    "フレームを補間してパン映像を滑らかにします。特にアニメに適しています。ディスプレイのリフレッシュレートが動画のフレームレートを上回っている必要があり、性能の低いGPUではカクつくことがあります。mpv専用です。",
  "Direct torrent streaming": "Torrentを直接ストリーミング",
  "When you have no debrid set up, or a torrent isn't cached, stream it straight from the bundled engine on localhost:11470. This connects to peers over your own connection, the same way Stremio's built-in streaming does.":
    "デブリッドが未設定の場合やTorrentがキャッシュされていない場合、localhost:11470の同梱エンジンから直接ストリーミングします。Stremioの内蔵ストリーミングと同様に、ご自身の回線を介してピアに接続します。",
  "Use Harbor's built-in engine (beta)": "Harborの内蔵エンジンを使用（ベータ）",
  "Stream torrents through Harbor's own Rust peer-to-peer engine instead of the bundled Stremio Server. Falls back automatically if it can't connect. Status and a self-test live in the Local engine card below.":
    "同梱のStremio Serverではなく、Harbor独自のRust製ピアツーピアエンジンでTorrentをストリーミングします。接続できない場合は自動的に代替手段へ切り替わります。状態とセルフテストは、下の「ローカルエンジン」カードで確認できます。",
  "Always re-encode when casting (recommended)": "キャスト時は常に再エンコード（推奨）",
  "On by default. Pipes every cast through ffmpeg as H.264 + AAC + MPEG-TS so Samsung, LG, Sony, and other DLNA TVs accept the stream regardless of source codec. Turn off only if you have a beefy receiver that handles raw HEVC/DTS and want max quality. Requires ffmpeg in PATH.":
    "初期設定ではオンです。すべてのキャストをffmpegでH.264 + AAC + MPEG-TSに変換し、ソースコーデックにかかわらずSamsung、LG、SonyなどのDLNAテレビで再生できるようにします。元のHEVC/DTSを処理できる高性能なレシーバーで最高画質を優先する場合のみオフにしてください。PATHにffmpegが必要です。",
  "Sharper lines and cleaner gradients on anime, in real time. One-tap setup below.":
    "アニメの線をより鮮明にし、グラデーションをより滑らかにします。リアルタイムで処理され、下からワンタップで設定できます。",
  "Disabled while strict remote streaming is on":
    "厳格なリモートストリーミングがオンの間は無効です",
  "Custom location": "カスタム位置",
  "System default": "システム設定",
  "Detecting...": "検出中...",
  "Choose folder": "フォルダーを選択",
  "Drop shadow": "ドロップシャドウ",
  "Soft halo around the text. Cleanest on most content.":
    "テキストの周囲に柔らかな光彩を付けます。ほとんどの映像ですっきり表示されます。",
  "Hard stroke around each letter. High contrast.":
    "各文字をくっきり縁取ります。高コントラストです。",
  "Black bar": "黒い帯",
  "Rounded background panel behind the text. Most readable.":
    "テキストの背後に角丸の背景を表示します。最も読みやすい設定です。",
  "Keep original": "オリジナルを維持",
  "Styled (ASS) subs keep their own fonts, colors, and effects. Truest to the release.":
    "装飾付き（ASS）字幕のフォント、色、効果をそのまま維持します。リリース版に最も忠実です。",
  "Resize only": "サイズのみ変更",
  "Keep the original look but apply your size and position.":
    "元の見た目を維持し、設定したサイズと位置だけを適用します。",
  "Use my style": "自分のスタイルを使用",
  "Force your font, size, and color onto styled subs. Use this for Arabic or any subs showing boxes. Can affect karaoke and signs.":
    "スタイル付き字幕にも指定したフォント、サイズ、色を強制適用します。アラビア語や文字が四角で表示される字幕に使用してください。カラオケ字幕や看板などの表示に影響する場合があります。",
  "Styled (ASS) subtitles": "装飾付き（ASS）字幕",
  "Seeing empty boxes instead of letters? Choose Arabic under Font and switch to Use my style.":
    "文字の代わりに空の四角が表示されますか？「フォント」でアラビア語を選び、「自分のスタイルを使う」に切り替えてください。",
  "Background opacity": "背景の不透明度",
  "Outline thickness": "縁取りの太さ",
  "Bold text": "太字",
  "Render subtitles in a heavier weight. Turn off to use your font's normal weight.":
    "字幕を太めのウェイトで表示します。オフにすると、フォント本来の標準ウェイトを使用します。",
  "Show subtitles in Picture-in-Picture": "ピクチャーインピクチャーで字幕を表示",
  "Hide subtitles when the player shrinks into the floating PiP window.":
    "プレーヤーがフローティング PiP ウィンドウに縮小されたとき、字幕を非表示にします。",
  "Distance from bottom": "下端からの距離",
  "Text color": "文字色",
  "Outline color": "縁取り色",
  "Box color": "ボックスの色",
  "Reset to defaults": "デフォルトに戻す",
  "{n} custom": "カスタム {n} 件",
  "Remove {name}": "{name}を削除",
  "Upload font": "フォントをアップロード",
  "Delete this font?": "このフォントを削除しますか？",
  "will be removed from Harbor. Anything you've set to use it will fall back to Inter.":
    "は Harbor から削除されます。これを使用するよう設定した項目は Inter に戻ります。",
  "Show thumbnail preview on hover": "ホバー時にサムネイルプレビューを表示",
  "Generates a frame on the fly as you scrub the seek bar. Works on debrid streams and local files.":
    "シークバーを操作すると、その場でフレームを生成します。デブリッドストリームとローカルファイルで利用できます。",
  "Bar style": "バーのスタイル",
  "Solid fill, no texture. Cleanest baseline.":
    "テクスチャなしの単色。最もシンプルな基本スタイルです。",
  "Subtle Apple-like sheen on the filled portion.": "塗りつぶし部分に Apple 風の控えめな光沢。",
  "Diagonal stripes across the fill, retro vibe.":
    "塗りつぶし部分に斜めのストライプ。レトロな雰囲気です。",
  "Six horizontal stripes. Pairs with nyan cat dot.":
    "6本の横ストライプ。nyan cat のドットと相性が良いです。",
  "Image bar active. Pick a style above to switch back, or clear the image below.":
    "画像バーが有効です。元に戻すには上のスタイルを選ぶか、下の画像を削除してください。",
  "Bar height": "バーの高さ",
  "Bar color": "バーの色",
  "Default (gold accent)": "デフォルト（ゴールドのアクセント）",
  "Bar image": "バーの画像",
  "Upload a pattern to tile across the bar": "バー全体に並べるパターンをアップロード",
  "Tiles horizontally; the bar's height crops it vertically. Animated GIFs up to 2 MB play.":
    "横方向に繰り返し、縦方向はバーの高さに合わせて切り抜かれます。2 MB までのアニメーション GIF を再生できます。",
  "Seek dot shape": "シークドットの形",
  "The default round dot.": "デフォルトの丸いドットです。",
  "Rounded square in the same color.": "同じ色の角丸四角形です。",
  "Custom image": "カスタム画像",
  "PNG, GIF, WebP, or SVG. Animated GIFs play.":
    "PNG、GIF、WebP、SVG。アニメーション GIF を再生できます。",
  "No dot, just the bar.": "ドットなし、バーのみ。",
  "Image size": "画像サイズ",
  "Dot size": "ドットサイズ",
  "Dot image": "ドット画像",
  "Upload nyan cat, a sticker, anything": "nyan cat やステッカーなどをアップロード",
  "PNG, JPEG, WebP, or SVG (auto-shrunk if huge). Animated GIFs up to 2 MB play live.":
    "PNG、JPEG、WebP、SVG（大きすぎる場合は自動縮小）。2 MB までのアニメーション GIF をそのまま再生できます。",
  "Desktop only": "デスクトップのみ",
  "Local engine": "ローカルエンジン",
  "Built-in peer-to-peer streaming, served from your own machine.":
    "このデバイスから配信する、内蔵P2Pストリーミングです。",
  "Active torrents": "アクティブなトレント",
  "Run self-test": "セルフテストを実行",
  "Running self-test": "セルフテストを実行中",
  "Restart engine": "エンジンを再起動",
  "Self-test is disabled while strict remote streaming is on. It downloads a test torrent over peer-to-peer on this machine.":
    "厳格なリモートストリーミングがオンの間、セルフテストは無効です。このデバイスでテスト用トレントをP2Pダウンロードします。",
  "Self-test": "セルフテスト",
  "Remote streaming server": "リモートストリーミングサーバー",
  "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.":
    "Harbor を、ホームサーバー上の Stremio サービスなど、別のマシンにあるストリーミングサーバーへ接続します。トレントはこのマシンではなく、そのマシンでダウンロード、ストリーミングされます。",
  "Use exclusively (never fall back to local)": "排他的に使用（ローカルに切り替えない）",
  "If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.":
    "サーバーに接続できない場合、ローカルストリーミングへ切り替えず、再生に失敗します。VPN がサーバーマシンで動作し、トレント通信をそのマシンの外へ一切出せない場合に使用してください。",
  "Probes the server's settings endpoint from this device.":
    "このデバイスからサーバーの設定エンドポイントを確認します。",
  "Run test": "テストを実行",
  "Server reachable": "サーバーに接続可能",
  "Test failed": "テスト失敗",
  "The server answered with status {status}. Is that a streaming server?":
    "サーバーからステータス {status} が返されました。ストリーミングサーバーのアドレスで間違いありませんか？",
  "Server reachable in {ms}ms. Harbor will use it for torrent streaming.":
    "サーバーに {ms}ms で接続できました。Harbor はトレントストリーミングにこのサーバーを使用します。",
  "Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.":
    "1.5秒以内にサーバーへ接続できませんでした。アドレスと、サーバーマシンがオンラインかどうかを確認してください。",
  "No limit": "制限なし",
  "Internet speed": "インターネット速度",
  "Pick the cap your link can sustain. Run a real speed test if you need a number.":
    "回線で安定して維持できる上限を選んでください。数値が必要な場合は、実際に速度テストを行ってください。",
  "No filter. All bitrates considered equally.":
    "フィルターなし。すべてのビットレートを同等に扱います。",
  "Streams over {cap} Mbps will rank lower, even when cached.":
    "{cap} Mbps を超えるストリームは、キャッシュ済みでも順位が下がります。",
  "Home layout": "ホームのレイアウト",
  "How the Home page assembles its rails.": "ホーム画面にコンテンツ列を配置する方法を設定します。",
  "Harbor curated": "Harborセレクト",
  "Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.":
    "ヒーローカルーセル、トップ10、トレンド、公開中、サービス別の列を表示します。アドオンのカタログは重複を除いて下に追加されます。",
  "Classic Stremio": "クラシックStremio",
  "Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.":
    "「視聴を続ける」の後に、インストール済みのアドオンを表示します。各カタログはインストール順に個別の行として表示され、重複除外もヒーロー表示もありません。",
  "Show every addon row": "すべてのアドオン列を表示",
  "Watchlist shows only saved titles": "保存した作品のみ表示",
  "Advance Continue Watching to the next episode": "「視聴を続ける」を次のエピソードに進める",
  "Keep frames for": "フレームの保存期間",
  "1 week": "1週間",
  "30 days": "30日",
  "3 months": "3か月",
  "6 months": "6か月",
  "1 year": "1年",
  "Clear all saved frames": "保存済みフレームをすべて削除",
  "{n} frame stored. Wiping rebuilds them next time you watch.":
    "{n}フレーム保存済み。消去すると、次回の視聴時に再生成されます。",
  "{n} frames stored. Wiping rebuilds them next time you watch.":
    "保存済みフレーム: {n} 件。消去すると、次回の視聴時に再生成されます。",
  "No frames stored yet. They'll appear here as you watch things.":
    "まだフレームは保存されていません。作品を視聴すると、ここに表示されます。",
  "Confirm clear": "消去を確認",
  "Clear all": "すべて消去",
  "How to get this": "入手方法",
  "Card overlays": "カードのオーバーレイ",
  "Fresh tomato for 60%+, splat for under.": "60%以上はフレッシュトマト、未満はスプラット。",
  "RPDB key above, https://btttr.cc, or a {imdbId} template":
    "上記の RPDB キー、https://btttr.cc、または {imdbId} テンプレート",
  "Hide titles under posters": "ポスター下のタイトルを非表示",
  "Cleaner grid when your poster service already prints the title on the artwork.":
    "ポスター画像にタイトルが入っている場合、グリッドをすっきり表示できます。",
  "Add a TMDB key above to unlock this.": "上でTMDBキーを追加すると利用できます。",
  "Add an OMDb key above to unlock this.": "上でOMDbキーを追加すると利用できます。",
  "Hover preview": "ホバーでプレビュー",
  "Rest the cursor on a poster to peek at the rating, runtime, and story without opening it.":
    "ポスターにカーソルを合わせると、開かずに評価、再生時間、あらすじを確認できます。",
  "Floats over the artwork": "アートワークの上に重ねて表示",
  "Sits above the title strip": "タイトル帯の上に表示",
  "Title text": "タイトルのテキスト",
  "Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.":
    "UI全体を拡大せずに、ホームの行タイトルとプレイヤーに表示されるタイトルのサイズを変更します。プレイヤーのタイトルでは、エピソード名より先にシリーズ名を表示することもできます。",
  "Row titles": "行タイトル",
  "Player title": "プレイヤーのタイトル",
  "Show series name first in the player": "プレイヤーでシリーズ名を先に表示",
  "Lead with the show name instead of the episode title at the top of the player.":
    "プレイヤー上部で、エピソード名ではなくシリーズ名を先頭に表示します。",
  "Block ads & trackers": "広告とトラッカーをブロック",
  "{n} tracker request blocked this session. Harbor itself sends zero telemetry.":
    "このセッションでトラッカーのリクエストを{n}件ブロックしました。Harbor自体はテレメトリを一切送信しません。",
  "{n} tracker requests blocked this session. Harbor itself sends zero telemetry.":
    "このセッションで {n} 件のトラッカーリクエストをブロックしました。Harbor 自体はテレメトリを一切送信しません。",
  "Watching for ad, analytics, and tracking requests. Harbor itself sends zero telemetry.":
    "広告、解析、トラッキングのリクエストを監視しています。Harbor自体はテレメトリを一切送信しません。",
  "Ad, analytics, and tracking requests pass through untouched.":
    "広告、分析、トラッキングのリクエストをそのまま通過させます。",
  "Close to the system tray": "閉じたらシステムトレイに格納",
  "Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.":
    "ウィンドウを閉じてもHarborを終了せずトレイに格納するため、すぐに再表示できます。トレイアイコンを右クリックするとクイック操作ができ、終了を選ぶと完全に終了します。",
  "Always on top": "常に手前に表示",
  "Keep the Harbor window above other windows.":
    "Harborウィンドウをほかのウィンドウより手前に表示します。",
  "Pause when minimized": "最小化時に一時停止",
  "Stop playback when you minimize Harbor or send it to the tray.":
    "Harborを最小化するかトレイに格納したとき、再生を停止します。",
  "Pause when unfocused": "フォーカス解除時に一時停止",
  "Stop playback whenever another window takes focus.":
    "別のウィンドウにフォーカスが移ると、再生を停止します。",
  "Export everything": "すべてエクスポート",
  "Saves your whole Harbor setup to one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "テーマ、ホーム画面のレイアウト、設定、アドオン、プロフィール、ウォッチリスト、プレイヤーレイアウト、視聴進捗など、Harborの設定一式を1つのファイルに保存します。Stremioのログイン情報は意図的に含まれません。",
  "Restore from a backup": "バックアップから復元",
  "Loads a backup file and replaces your current setup with it. Perfect for a new computer. Your Stremio sign-in on this device stays as is.":
    "バックアップファイルを読み込み、現在の設定一式を置き換えます。新しいパソコンへの移行に最適です。このデバイスのStremioログイン状態はそのまま維持されます。",
  "Could not build the backup file.": "バックアップファイルを作成できませんでした。",
  "Could not read that file.": "そのファイルを読み込めませんでした。",
  "an unknown date": "不明な日付",
  "Restore this backup?": "このバックアップを復元しますか？",
  "This replaces your current Harbor setup (theme, home layout, settings, addons, profiles, and more) with the {n} saved entries in this file. Your Stremio sign-in stays as is. Harbor reloads when it finishes.":
    "現在のHarbor設定（テーマ、ホーム画面のレイアウト、設定、アドオン、プロフィールなど）を、このファイルに保存された{n}件のデータで置き換えます。Stremioのログイン状態はそのまま維持されます。完了するとHarborが再読み込みされます。",
  "Saved {when} from Harbor {app}.": "{when}にHarbor {app}から保存。",
  "Restoring...": "復元中...",
  "Restore and reload": "復元して再読み込み",
  "Xtream credentials were left out of this backup.":
    "Xtreamの認証情報はこのバックアップに含まれていません。",
  "Get beta updates": "ベータ版の更新を受け取る",
  "Receive early builds with the newest fixes before they reach the stable release. Betas can be rough around the edges; switch this off to return to stable at the next update.":
    "安定版のリリース前に、最新の修正を含む先行ビルドを受け取ります。ベータ版は動作が不安定な場合があります。オフにすると、次回の更新時に安定版へ戻ります。",
  "Catch stremio:// install links inside Harbor": "stremio://インストールリンクをHarbor内で開く",
  "Harbor's in-app installer animates the manifest install and keeps you in context. Anything Harbor installs is also synced to your Stremio account, so the official app stays the canonical library. Turn this off and Stremio becomes the only handler for stremio:// links; Harbor still installs anything you trigger from inside the app (Configure & install, paste, drag-and-drop).":
    "Harborのアプリ内インストーラーでは、マニフェストのインストールがアニメーションで表示され、そのまま操作を続けられます。HarborでインストールしたものはStremioアカウントにも同期されるため、公式アプリのライブラリが常に正となります。オフにすると、stremio://リンクはStremioのみで開かれます。Harbor内から実行したインストールは引き続きHarborで行われます（「設定してインストール」、貼り付け、ドラッグ＆ドロップ）。",
  "Heads up: if Stremio is also installed, Windows may ask which app to use the first time a stremio:// link fires. Pick Harbor to make it stick.":
    "注意: Stremioもインストールされている場合、stremio://リンクを初めて開く際に、使用するアプリをWindowsが確認することがあります。Harborを選ぶと、以後もHarborで開きます。",
  "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.":
    "stremio://リンクはStremioアプリで開くようになりました。Harborでインストールされるのは、Harbor内から実行した場合のみです。",
  "Checking harbor.site for a newer build.": "harbor.siteで新しいビルドを確認しています。",
  "Downloading {pct}%": "ダウンロード中 {pct}%",
  "Downloaded. Ready to install and restart.":
    "ダウンロードが完了しました。インストールして再起動できます。",
  "Installing. Harbor will restart.": "インストール中です。Harborが再起動します。",
  "A new version is ready to download.": "新しいバージョンをダウンロードできます。",
  "You're on the latest version.": "最新バージョンです。",
  "Couldn't reach the update server. Try again in a moment.":
    "更新サーバーに接続できませんでした。しばらくしてからもう一度お試しください。",
  "Harbor checks automatically every few hours.": "Harborは数時間ごとに自動で更新を確認します。",
  "Harbor {version} available": "Harbor {version}を利用できます",
  "Update now": "今すぐ更新",
  "Check for updates": "更新を確認",
  "Show on Discord": "Discordに表示",
  "Display what you are watching on your Discord profile, with the show poster and a live progress bar. Requires the Discord desktop app to be running.":
    "視聴中の作品を、ポスターとリアルタイムの進行状況バー付きでDiscordプロフィールに表示します。Discordデスクトップアプリが起動している必要があります。",
  "Hide the title": "タイトルを隠す",
  "Show 'Watching something' with no show name or poster.":
    "作品名やポスターを表示せず、「何かを視聴中」と表示します。",
  "Show while paused": "一時停止中も表示",
  "Keep the presence visible when playback is paused.":
    "再生を一時停止している間もステータスを表示します。",
  "Show while browsing": "閲覧中も表示",
  "Display 'Browsing Harbor' when nothing is playing.":
    "何も再生していないときに「Harborを閲覧中」と表示します。",
  "Show poster": "ポスターを表示",
  "Reveal the show or movie artwork. Off keeps the title but hides the poster.":
    "アニメ、番組、映画のアートワークを表示します。オフにすると、タイトルはそのままでポスターだけが非表示になります。",
  "Show elapsed time": "経過時間を表示",
  "Display the live progress bar showing how far into the title you are.":
    "作品をどこまで視聴したか、リアルタイムの進行状況バーで表示します。",
  "Watch party join button": "同時視聴の参加ボタン",
  "Add a Join button with your room link while you're in a watch party.":
    "同時視聴中に、ルームへのリンクが付いた「参加」ボタンを表示します。",
  "And for the naughty ones: browsing or rating an adult addon never shows on Discord.":
    "ちょっと刺激の強い作品も安心。成人向けアドオンの閲覧や評価はDiscordに一切表示されません。",
  "OMDB daily budget": "OMDBの1日あたりの上限",
  "Save an OMDB key in Library & metadata to enable rating fetches.":
    "評価を取得するには、「ライブラリとメタデータ」でOMDBキーを保存してください。",
  "Key rejected. Check it on Library & metadata.":
    "キーが拒否されました。「ライブラリとメタデータ」で確認してください。",
  "{used} / {limit} requests today.": "今日のリクエスト数: {used} / {limit}",
  "Budget exhausted, resets at midnight UTC.": "上限に達しました。UTCの午前0時にリセットされます。",
  "Reset counter": "カウンターをリセット",
  "Replay walkthrough": "ガイドをもう一度見る",
  "Re-runs the welcome flow and clears every dismissed tip.":
    "ウェルカムガイドをもう一度開始し、非表示にしたヒントをすべて元に戻します。",
  "Restore dismissed hints": "非表示にしたヒントを復元",
  "Brings back the small in-app tips you've dismissed without redoing the welcome flow.":
    "ウェルカムガイドをやり直さずに、閉じたアプリ内のヒントを再表示します。",
  "Desktop (Tauri 2 / WebView2)": "デスクトップ版（Tauri 2 / WebView2）",
  "Bug reports": "バグ報告",
  "Repair library": "ライブラリを修復",
  "Sign in to Stremio first. The repair scans only the active profile's library.":
    "先にStremioへログインしてください。修復では、現在のプロフィールのライブラリのみをスキャンします。",
  "Failed: {error}": "失敗: {error}",
  "Library is empty. Nothing to repair.": "ライブラリは空です。修復する項目はありません。",
  "{repaired} fixed, {clean} already clean": "{repaired}件を修復、{clean}件は修復不要",
  ", {n} unrepairable": "、{n}件は修復不可",
  "Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Harbor synced playback.":
    "すべてのライブラリ項目をStremioの正確なスキーマに合わせて書き換えます。Harborが再生状況を同期した後にStremioアプリがクラッシュするようになった場合は、一度実行してください。",
  "Fetching {n} items…": "{n}件を取得中…",
  "Fetching library index…": "ライブラリのインデックスを取得中…",
  "{n} items need repair.": "{n}件の項目を修復する必要があります。",
  "Checking {n} items…": "{n}件を確認中…",
  "Pushing {pushed} of {total}…": "{total}件中{pushed}件を送信中…",
  "Done.": "完了しました。",
  "Working…": "処理中…",
  "Run again": "もう一度実行",
  "Repair now": "今すぐ修復",
  "Web build": "Web版",
  "Where your data lives": "データの保存場所",
  "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.":
    "ここで保存したデータはすべて、このブラウザ内にのみ保持されます。Stremioのログイン情報、APIキー、視聴状況、ストリーム選択キャッシュ、非表示にしたヒントなどです。Harborのサーバーに送信されることはありません。ブラウザのデータを消去すると、すべて削除されます。",
  "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.":
    "Web版では、mpv、トリックプレイ生成、ローカル帯域幅テスト、独自のCloudflareリレーは利用できません。HDRパススルー、TrueHDまたはDTS-HD音声、よりスムーズなシークが必要な場合は、デスクトップ版をご利用ください。",
  "Get Harbor for desktop": "Harborデスクトップ版を入手",
  "Source code": "ソースコード",
  "Your relay is live": "リレーは稼働中です",
  "Connected to relay": "リレーに接続しました",
  "Watch Together": "同時視聴",
  "Synchronizes playback state between participants in the same room.":
    "同じルームの参加者間で再生状態を同期します。",
  "Test connection": "接続をテスト",
  "Pings your Worker at /health to confirm it's reachable from this device.":
    "Workerの/healthにアクセスし、このデバイスから接続できるか確認します。",
  "Testing…": "テスト中…",
  "Relay version {version}. Update available.": "リレーのバージョンは{version}です。更新できます。",
  "Relay is current (v{version}).": "リレーは最新です（v{version}）。",
  "Harbor's public relay updates automatically; nothing to do.":
    "Harborの公開リレーは自動で更新されます。操作は不要です。",
  "Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.":
    "再デプロイして、同時視聴の最新修正を適用してください。新しいバージョンが稼働すると、アプリ内のバナーは消えます。",
  "Running the latest Watch Together protocol.": "最新の同時視聴プロトコルで動作しています。",
  "Redeploy instructions": "再デプロイ手順",
  "Backup credentials": "認証情報をバックアップ",
  "Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.":
    "CloudflareでAPIトークンが表示されるのは一度だけです。今すぐコピーを保存してください。保存しないと、Harborからこのリレーを停止または再デプロイできなくなります。",
  "Relay verified end-to-end": "リレーの全経路を確認済み",
  "Relay test failed": "リレーのテストに失敗しました",
  "Redeploy relay": "リレーを再デプロイ",
  "Stopping…": "停止中…",
  "Stop relay": "リレーを停止",
  "Forget URL": "URLを削除",
  "Use a different URL": "別のURLを使用",
  "Deploy mine instead": "代わりに自分のリレーをデプロイ",
  "Deploy a relay": "リレーを導入",
  "Deploy a relay (desktop only)": "リレーをデプロイ（デスクトップ版のみ）",
  "Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.":
    "リレーのデプロイにはCloudflare APIが必要ですが、ブラウザクライアントでは利用できません。デスクトップ版でWorkerをデプロイし、生成されたURLを下に入力してください。",
  "Enter an existing relay URL:": "既存のリレーURLを入力:",
  "Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.":
    "自分で運用しているか、信頼できるリレーのURLのみ入力してください。リレーを通るのは、一緒に観る機能の同期メッセージ（再生、一時停止、シーク）だけです。それ以外のデータは一切送信されません。",
  "Hit your daily quota? Use Harbor's public relay, or host your own.":
    "1日の上限に達しましたか？Harborの公開リレーを使うか、自分でリレーをホストできます。",
  "Use Harbor's public relay": "Harborの公開リレーを使用",
  "Documentation: run your own relay": "ドキュメント: 自分のリレーを運用",
  "Install failed": "インストールに失敗しました",
  "Installed via {label}": "{label}経由でインストール済み",
  "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.":
    "この機能を有効にするには、上でデブリッドキー（TorBox、Real-Debrid、AllDebrid、Premiumize、Debrid-Linkのいずれか）を保存してください。",
  "Couldn't install. Double-check the URL and try again.":
    "インストールできませんでした。URLを確認して、もう一度お試しください。",
  "Paste the manifest URL the configure page gave you":
    "設定ページで発行されたマニフェストURLを貼り付け",
  "View all": "すべて表示",
  "Where alerts go": "通知先",
  "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Test to send yourself a sample first.":
    "DiscordまたはTelegramを接続すると、フォロー中の作品がまもなく配信される際にHarborがメッセージを送信します。まず「テスト」を押して、サンプルを自分宛てに送信できます。",
  "What to send": "送信内容",
  "Pick which calendars feed your alerts. Items are deduped across sources before sending.":
    "通知に使うカレンダーを選択してください。複数のソースで重複する項目は、送信前にまとめられます。",
  "Media types": "メディアの種類",
  "Filter by type after the sources merge. Leave them all on to send everything.":
    "ソースの統合後に種類で絞り込みます。すべて送信するには、全項目をオンのままにしてください。",
  AUTOMATIONS: "自動化",
  "Anime tweaks": "アニメ向け調整",
  "Anime4K real-time upscaling, smooth motion, and where SVP fits in. All the anime-specific picture enhancements in one place.":
    "Anime4Kのリアルタイムアップスケーリング、モーションスムージング、SVPの使い分けなど、アニメ専用の画質向上機能をまとめています。",
  "Real-time GPU upscaling that sharpens lines and cleans up gradients on anime, built right into Harbor's player. The one-tap setup below grabs the shaders; nothing else to install.":
    "Harborのプレイヤーに組み込まれたリアルタイムGPUアップスケーリングで、アニメの線をくっきりさせ、グラデーションを滑らかにします。下のワンタップ設定でシェーダーを取得でき、ほかにインストールするものはありません。",
  "Enable Anime4K": "Anime4Kを有効化",
  "Sharper lines and cleaner gradients on anime, in real time. Heaviest on the graphics card of everything here.":
    "アニメの線をくっきりさせ、グラデーションをリアルタイムで滑らかにします。ここにある機能の中で、グラフィックカードへの負荷が最も高くなります。",
  "Show Anime4K indicator": "Anime4Kインジケーターを表示",
  "A small badge over the video (with live FPS) that only appears when Anime4K is actually running. Follows your anime-only setting.":
    "Anime4Kの動作中にのみ映像上へ表示される小さなバッジです。リアルタイムFPSも表示します。アニメのみに適用する設定と連動します。",
  "Smooth motion": "モーションスムージング",
  "Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.":
    "アニメは2コマ打ちや3コマ打ちで描かれるため、高速パンがカクつくことがあります。スムージングで間のフレームを補い、動きを滑らかにします。",
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
    "Harbor内蔵のフレーム補間です。パンを滑らかにし、特にアニメに適しています。ディスプレイのリフレッシュレートが動画のフレームレートを上回っている必要があり、性能の低いGPUではカクつくことがあります。SVPより軽量です。",
  "SVP frame interpolation": "SVPフレーム補間",
  "Genuine 48/60fps motion on anime, rendered right inside Harbor's player. SVP supplies the engine (VapourSynth + svpflow) and runs in your tray for licensing; Harbor's own player applies the interpolation, so it stays embedded and fully under your control. One-time install, then flip it on.":
    "Harborのプレイヤー内で直接処理し、アニメを本格的な48/60fpsの動きで再生します。SVPはエンジン（VapourSynth + svpflow）を提供し、ライセンス管理のためシステムトレイで動作します。補間はHarbor独自のプレイヤーが適用するため、プレイヤーに統合されたまま、すべて自分で制御できます。一度インストールしたら、あとはオンにするだけです。",
  "SVP (free)": "SVP（無料）",
  "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.":
    "SVPは一度だけインストールしてください。無料版で十分です。VapourSynth + svpflowが同梱されており、Harborがそれらを利用するため、追加設定は不要です。",
  "Installed and detected. Harbor found its interpolation engine and will drive it directly.":
    "インストール済みで、検出されました。Harborが補間エンジンを検出し、直接制御します。",
  "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.":
    "SVPはインストールされていますが、Harborがエンジンファイル（svpflow + VapourSynth）を検出できませんでした。SVPのインストールを修復するか、SVPを一度起動し直してください。",
  "Get SVP (free)": "SVPを入手（無料）",
  "Open SVP": "SVPを開く",
  "Enable SVP": "SVPを有効化",
  "Harbor's player applies the interpolation itself, embedded like normal playback, and starts SVP Manager in the tray for licensing. Restart playback to apply. If video goes black or won't start, turn this off.":
    "Harborのプレイヤー自体が補間を適用するため、通常の再生と同じようにプレイヤーへ統合されます。また、ライセンス管理のためSVP Managerをシステムトレイで起動します。適用するには再生をやり直してください。映像が真っ黒になるか再生できない場合は、オフにしてください。",
  "Finish the install above first. Flipping this on now won't do anything until Harbor can find SVP's engine.":
    "先に上のインストールを完了してください。HarborがSVPのエンジンを検出するまで、今オンにしても何も起こりません。",
  "Couldn't start SVP Manager: {err}": "SVP Managerを起動できませんでした: {err}",
  "Couldn't set up SVP: {err}": "SVPを設定できませんでした: {err}",
  "Anime4K and smooth-motion run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "Anime4Kとモーションスムージングは、Harborデスクトップアプリに同梱されたmpvエンジンで動作します。ブラウザでは効果がありません。",
  "Download the desktop app to use anime enhancements.":
    "アニメ向け画質向上機能を使うには、デスクトップアプリをダウンロードしてください。",
  "Match the picture quality to your computer, smooth out weak connections, and fine-tune the mpv engine with plain-language controls.":
    "PCに合った画質を選び、不安定な接続でも再生を滑らかにし、わかりやすい項目でmpvエンジンを細かく調整できます。",
  "Picture quality": "画質",
  "One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.":
    "動画を最高の見栄えにするためにPCへどの程度の処理をさせるかを、1つの選択肢で設定します。お使いのPCに合うものを選んでください。次に再生する動画から適用されます。",
  "Smooth on weak PCs": "低スペックPCでも滑らか",
  "Older laptops · low-end · battery · anything that stutters":
    "古いノートPC · 低スペック · バッテリー駆動 · カクつく環境すべて",
  "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.":
    "高度なスケーリングやエフェクトをオフにし、動画の再生を最優先します。PCへの負荷が最も軽い設定です。少しでもカクついたり、ファンがうるさくなったりする場合は、これを選んでください。",
  "Most computers · the default": "ほとんどのPC · デフォルト",
  "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.":
    "PCに大きな負荷をかけず、きれいな映像を楽しめます。特に変更する理由がなければ、このままにしてください。",
  "Maximum quality": "最高画質",
  "Strong desktops with a dedicated graphics card":
    "専用グラフィックカード搭載の高性能デスクトップPC",
  "Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.":
    "よりシャープなアップスケーリングと、暗いシーンでより滑らかなグラデーションを実現しますが、グラフィックカードへの負荷が高くなります。ノートPCや内蔵グラフィックスでは使用しないでください。",
  "Hardware acceleration": "ハードウェアアクセラレーション",
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
    "グラフィックカードに負荷の高い動画デコードを任せます。バッテリーを節約し、CPUの発熱も抑えられます。ほとんどの場合は「自動」が最適です。映像が正しく表示されないか、再生できない場合にのみ切り替えてください。",
  "Force on": "強制的にオン",
  "Off (use CPU)": "オフ（CPUを使用）",
  "The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.":
    "すべてCPUでデコードします。互換性は最も高い一方、発熱が増え、4Kではカクつくことがあります。ハードウェアデコードをオンにすると映像が乱れる場合にのみ使用してください。",
  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.":
    "グラフィックカードを強制的に使用します。最も滑らかに再生でき、発熱も抑えられますが、一部の古いファイルや特殊なファイルは再生できないことがあります。再生できない場合は「自動」に戻してください。",
  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.":
    "安全に使える場合はHarborがグラフィックカードを使用し、使えない場合はCPUに切り替えます。ほとんどの方に最適な設定です。",
  "Picture adjustments": "画質調整",
  "Nudge the image to taste. Start with a one-tap look below, then fine-tune with the dials. Everything resets cleanly, so you can't break anything.":
    "好みに合わせて映像を調整できます。まず下のプリセットをワンタップで選び、その後スライダーで微調整してください。すべてきれいにリセットできるので、設定を壊す心配はありません。",
  "Brighten dark movies": "暗い映画を明るく",
  "Lifts shadows so the pitch-black scenes are actually watchable.":
    "シャドウを持ち上げ、真っ暗なシーンも見やすくします。",
  "Punchier color": "色を鮮やかに",
  "Richer, more vivid picture with a touch more contrast.":
    "コントラストを少し上げ、より深みのある鮮やかな映像にします。",
  "Easy on the eyes": "目にやさしい",
  "Softer and dimmer, kinder for late-night watching.":
    "柔らかく暗めの映像にし、深夜でも目に負担をかけずに視聴できます。",
  "Crisp (anime & cartoons)": "くっきり（アニメ・カートゥーン）",
  "Sharper lines and a little more pop.": "線をよりくっきりさせ、少しメリハリを加えます。",
  Brightness: "明るさ",
  Contrast: "コントラスト",
  Saturation: "彩度",
  "Gamma (midtones)": "ガンマ（中間調）",
  Sharpen: "シャープネス",
  "Reset picture": "画質をリセット",
  "Color & HDR": "カラーとHDR",
  "How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.":
    "HarborがHDR映画を通常の画面に合わせて表示する方法を設定します。ほとんどの場合は「自動」が最適です。下のカーブでは、鮮やかさや柔らかさなどの見え方だけが変わります。HDRソースにのみ影響します。",
  "Tone-mapping curve": "トーンマッピングカーブ",
  "Auto (recommended)": "自動（推奨）",
  "Reference (bt.2390)": "リファレンス（bt.2390）",
  "Filmic (Hable)": "フィルム調（Hable）",
  "Balanced (Mobius)": "バランス（Mobius）",
  "Soft (Reinhard)": "ソフト（Reinhard）",
  "Modern (Spline)": "モダン（Spline）",
  "Boost SDR video toward HDR": "SDR映像をHDRに近づける",
  "On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.":
    "HDRディスプレイで、通常の非HDR映画を拡張された明るさの範囲に合わせます。通常の画面ではオフにしてください。色が薄く見えることがあります。",
  "Slow or unstable connection": "低速または不安定な接続",
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
    "動画のバッファリングが頻繁に発生する場合や、Wi-Fiが不安定な場合、遠方のサーバーを利用している場合に、Harborがより多くのデータを先読みし、通信が不安定でも再生を続けやすくします。",
  "Build a bigger buffer": "バッファを増やす",
  "Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.":
    "再生前に、より多くの動画を先読みします。接続が弱くても再生が安定しますが、メモリ使用量が少し増え、再生開始までの時間もやや長くなります。",
  "For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.":
    "ノートPCのスピーカーやヘッドホン向けです。5.1または7.1サラウンドでミックスされた映画は、2つのスピーカーでは音が薄くなったり、セリフが小さく聞こえたりすることがあります。これを適切にステレオへダウンミックスします。",
  "Mix surround sound down to stereo": "サラウンド音声をステレオにダウンミックス",
  "Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.":
    "ノートPCやヘッドホンで視聴していて、効果音に比べてセリフが小さく感じる場合はオンにしてください。本格的なサラウンド環境やサウンドバーを使用している場合はオフにしてください。",
  "Advanced (mpv.conf)": "詳細設定（mpv.conf）",
  "The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.":
    "上級者向けの設定です。mpv.confと同じ形式で、1行に1つずつmpvオプションをkey=valueとして入力します。これらは最後に適用されるため、上のすべての設定より優先されます。Harborが読み取れない行は無視されるので、入力ミスがあっても再生に支障はありません。適用するには再生をやり直してください。",
  "1 option active": "1個のオプションが有効",
  "{n} options active": "{n}個のオプションが有効",
  "1 line skipped (not valid)": "無効な1行をスキップしました",
  "{n} lines skipped (not valid)": "無効な{n}行をスキップしました",
  "Empty. The dials above cover what most people ever need.":
    "空です。ほとんどの場合、上の設定だけで十分です。",
  "Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.":
    "注意: {keys}は外部スクリプトを読み込んだり、プレイヤーをネットワークに公開したりする可能性があります。動作を正確に理解している場合のみ残してください。",
  "See the mpv.conf your dials above generate": "上の設定から生成されるmpv.confを表示",
  "These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.":
    "これらはHarborデスクトップアプリで動作する内蔵mpvエンジンを調整します。ブラウザには影響しません。",
  "Download the desktop app to use video tuning.":
    "映像を調整するにはデスクトップアプリをダウンロードしてください。",
  "Ask to resume or start over": "続きから再生するか最初から再生するか確認",
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
    "途中まで視聴した作品を再生するときに、続きから再生するか最初から再生するかを確認します。StremioやTraktから同期した作品も対象です。",
  "Aspect ratio": "アスペクト比",
  "Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.":
    "mpvエンジンで使用する既定の画面比率です。「全体を表示」では黒帯を含めて元の映像をそのまま表示します。それ以外では、画面いっぱいになるよう引き伸ばすか切り抜きます。ワイドテレビで昔の4:3番組を見るときに便利です。",
  Fit: "全体を表示",
  Fill: "画面いっぱいに表示",
  "16:9": "16:9",
  "4:3": "4:3",
  "21:9": "21:9",
  "1.85:1": "1.85:1",
  "2.39:1": "2.39:1",
  "Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.":
    "再生中に比率を変えたい場合は、プレイヤーをすっきり保つため既定で非表示になっているアスペクト比ボタンを使用できます。",
  "Turn it on in Player layout": "「プレイヤーレイアウト」でオンにする",
  "Auto-play next episode": "次のエピソードを自動再生",
  "When an episode ends, automatically start the next one. Off lets the episode finish and stop.":
    "エピソードの終了後、次のエピソードを自動的に再生します。オフの場合は、そのエピソードの終了時に再生が停止します。",
  "Show P2P status overlay": "P2Pステータスを映像上に表示",
  "Peers, speed and progress chip on the player during torrent playback. Turn off to keep the player clean.":
    "Torrent再生中に、ピア数、速度、進捗をプレイヤー上に表示します。プレイヤーをすっきり保つにはオフにしてください。",
  "Source:": "ソース:",
  "About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.":
    "依存関係のない約200行のJavaScriptです。何が実行されるか確認したい場合は、デプロイ前にお読みください。",
  "For the manual path:": "手動で設定する場合:",
  "20+ and": "20+と",
  "CLI.": "CLI。",
  "Generate a Cloudflare API token with": "次の権限を持つCloudflare APIトークンを生成します:",
  and: "および",
  "permissions at": "権限。作成先:",
  "Paste it into Harbor.": "Harborに貼り付けます。",
  "Wait for the upload to finish. The relay URL gets written to":
    "アップロードが完了するまで待ちます。リレーURLはHarbor設定の",
  "in Harbor settings.": "に保存されます。",
  "Save the worker source. Copy": "ワーカーのソースを保存します。Harborリポジトリから",
  "from the Harbor repo into a new directory as": "を新しいディレクトリに次の名前でコピーします:",
  "Save this": "次の",
  "next to it:": "をその隣に保存します:",
  "Note the URL Cloudflare returns. It looks like":
    "Cloudflareから返されたURLを控えてください。形式は次のとおりです:",
  "In Harbor: Settings, Harbor Relay, then": "Harborで「設定」>「Harbor Relay」を開き、次に",
  "Paste the URL with": "URLを貼り付けます。スキームには",
  "as the scheme instead of": "を使用し、次のスキームは使用しません:",
  "Settings, Harbor Relay, then": "「設定」>「Harbor Relay」を開き、次に",
  "The test calls": "テストでは",
  "and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "を呼び出し、ワーカーに到達でき、最新バージョンで動作していることを確認します。テストに合格すれば、Watch Togetherルームに接続できます。",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique":
    "リレーURLは共有できます。そのURLを知っている人は誰でも、あなたのリレーでホストされているWatch Togetherルームに参加できます。固有の",
  "subdomain acts as the access token. There is no login.":
    "サブドメインがアクセストークンとして機能します。ログインはありません。",
  "To run a public relay, post the": "公開リレーとして運用するには、",
  "URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay,":
    "URLをr/Stremioやコミュニティの活動場所に投稿します。他のHarborユーザーは、そのURLを「設定」>「Harbor Relay」に貼り付けます。",
  "returns JSON with the worker version. Used by the test button.":
    "はワーカーのバージョンを含むJSONを返します。テストボタンで使用されます。",
  "with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "にWebSocketアップグレードを指定すると、Watch Togetherルームが開きます。状態はDurable Objectに保持され、アクティブなセッションの終了後は保持されません。",
  "Add Custom Source": "カスタムソースを追加",
  "Provide a JSON link or paste it directly.":
    "JSONリンクを入力するか、JSONを直接貼り付けてください。",
  "JSON URL": "JSON URL",
  "Paste JSON": "JSONを貼り付け",
  "URL cannot be empty": "URLを入力してください",
  "Failed to fetch JSON": "JSONの取得に失敗しました",
  "JSON cannot be empty": "JSONを入力してください",
  "Invalid SourceRow JSON format": "SourceRowのJSON形式が無効です",
  "Add Source": "ソースを追加",
  "Edit Folder Images": "フォルダー画像を編集",
  "Cover Image URL": "カバー画像URL",
  "Focus GIF URL": "フォーカス時のGIF URL",
  "Addon not installed": "アドオンがインストールされていません",
  "This section depends on the addon": "このセクションにはアドオンが必要です",
  "You must install this addon in your Stremio account first so Harbor can fetch its works.":
    "Harborで作品を取得するには、まずStremioアカウントにこのアドオンをインストールしてください。",
  "Missing TMDB Key": "TMDBキーがありません",
  "This section relies on TMDB discovery features.":
    "このセクションではTMDBのコンテンツ検索機能を使用します。",
  "Please add your TMDB API key in the Library & Metadata settings to view this folder.":
    "このフォルダーを表示するには、「ライブラリとメタデータ」設定でTMDB APIキーを追加してください。",
  OK: "OK",
  "Loading...": "読み込み中...",
  "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.":
    "Stremboxd連携を使って、Letterboxdのウォッチリスト、日記、いいねした映画、リストをHarborに取り込めます。",
  "Enable Letterboxd integration": "Letterboxd連携を有効にする",
  "Shows your Letterboxd catalogs on the home page and a Letterboxd panel on film pages.":
    "ホームにLetterboxdのカタログを、映画ページにLetterboxdパネルを表示します。",
  Mode: "モード",
  Public: "公開",
  Full: "全体",
  "Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.":
    "公開モードではユーザー名のみを使用し、ウォッチリスト、いいねした映画、人気作品、Top 250を利用できます。パスワードは不要です。",
  "Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.":
    "フルモードではLetterboxdのパスワードでログインし、日記、フレンドのアクティビティ、自分の評価も利用できます。パスワードはトークン取得のためにStremboxdにのみ送信され、Harborには保存されません。",
  "Letterboxd username": "Letterboxdユーザー名",
  "Letterboxd password": "Letterboxdパスワード",
  "Your Letterboxd password": "Letterboxdのパスワード",
  "Two-factor authentication code": "2段階認証コード",
  "Connect / Verify": "接続 / 確認",
  "Verify & connect": "確認して接続",
  "About Stremboxd": "Stremboxdについて",
  "Connected — {n} catalogs available": "接続済み: {n}件のカタログを利用できます",
  "Full mode — diary, friends & ratings enabled": "フルモード: 日記、フレンド、評価が有効です",
  "Catalogs to show": "表示するカタログ",
  "Custom lists": "カスタムリスト",
  "Remove list": "リストを削除",
  "letterboxd.com/username/list/slug": "letterboxd.com/username/list/slug",
  "Show my rating on movie posters": "映画ポスターに自分の評価を表示",
  "Overlays your Letterboxd rating on catalog posters (when available).":
    "カタログのポスターにLetterboxdでの自分の評価を重ねて表示します（評価がある場合）。",
  "Blur reviews by default": "レビューをデフォルトでぼかす",
  "Reviews on film pages are blurred until you reveal them.":
    "映画ページのレビューは、表示するまでぼかされます。",
  "Hidden catalogs": "非表示のカタログ",
  Watchlist: "ウォッチリスト",
  Diary: "日記",
  "Liked Films": "いいねした映画",
  Friends: "フレンド",
  "Recommended for You": "あなたへのおすすめ",
  "Popular This Week": "今週の人気作品",
  "Top 250": "Top 250",
  "Could not resolve that Letterboxd list URL.":
    "そのLetterboxdリストのURLを特定できませんでした。",
  "Choose an avatar": "アバターを選択",
  "{n} avatars across film, TV, and anime.": "映画、テレビ、アニメのアバター{n}個。",
  "Rights and usage": "権利と利用について",
  "Fan-made avatars for personal use. Harbor claims no rights to these characters; they belong to their creators and studios, shown here under fair use. Every one is optimized down to a tiny WebP.":
    "個人利用向けのファンメイドアバターです。Harborはこれらのキャラクターに関する権利を主張しません。権利は各制作者およびスタジオに帰属し、ここではフェアユースの範囲で掲載しています。すべて小容量のWebPに最適化されています。",
  "or use one of our avatars": "または用意されたアバターを使用",
  "Random avatar": "ランダムなアバター",
  "More soon": "近日追加",
  "More avatars coming soon": "新しいアバターを近日追加予定",
  "Scroll left": "左にスクロール",
  "Scroll right": "右にスクロール",
  Preview: "プレビュー",
  "Hover to peek": "カーソルを合わせてプレビュー",
  Merged: "統合",
  "Every row": "すべての行",
  Trending: "トレンド",
  Popular: "人気",
  "Trending · Cinemeta": "トレンド · Cinemeta",
  "Popular · AIO": "人気 · AIO",
  "On: addon rails that duplicate the built-ins show too, instead of folding into one.":
    "オン: 標準機能と重複するアドオンの行も、1つに統合せず個別に表示します。",
  auto: "自動",
  "On: only titles you bookmarked. Off: also keeps the ones Stremio added when you hit play.":
    "オン: 自分でブックマークした作品のみ表示します。オフ: 再生時にStremioが追加した作品も残します。",
  "Adds a Playlists tab to the nav for your M3U and Xtream libraries.":
    "M3UとXtreamのライブラリ用に、ナビゲーションへ「プレイリスト」タブを追加します。",
  "Home · Continue Watching": "ホーム · 視聴を続ける",
  anime: "アニメ",
  "Anime tab": "「アニメ」タブ",
  "Anime leaves Home Continue Watching and stays in the Anime tab's own row.":
    "アニメをホームの「視聴を続ける」から除外し、「アニメ」タブ内の専用行にのみ表示します。",
  "0m left": "残り0分",
  "24m": "24分",
  "Finish an episode and the card jumps to the next one instead of sitting at 0m left.":
    "エピソードを見終えると、カードは「残り0分」のままにならず、次のエピソードに切り替わります。",
  "Movies you've finished and shows in progress leave the catalog rows. Continue Watching is never touched.":
    "見終えた映画と視聴中の番組は、カタログの各行から除外されます。「視聴を続ける」には影響しません。",
  "No filter. Home shows every language.": "フィルターなし。ホームにすべての言語が表示されます。",
  "language. Home filters to it.": "言語。ホームがこの言語で絞り込まれます。",
  "languages. Home filters to these.": "言語。ホームがこれらの言語で絞り込まれます。",
  Tamil: "タミル語",
  "Each episode shows its IMDb rating, right on the still.":
    "各エピソードのIMDb評価を場面画像に直接表示します。",
  "Turn on to show each episode's synopsis under the still.":
    "オンにすると、各エピソードのあらすじが場面画像の下に表示されます。",
  "Loads full-resolution artwork instead of the lighter, softer version.":
    "軽量で低画質なバージョンではなく、フル解像度のアートワークを読み込みます。",
  "Lighter (w300)": "軽量版 (w300)",
  Original: "オリジナル",
  "Saved frame": "保存したフレーム",
  "AI search": "AI検索",
  "Type what you want in plain language and let a model find it. Bring your own OpenRouter key.":
    "欲しい作品を普段の言葉で入力すると、モデルが検索します。ご自身のOpenRouterキーをご用意ください。",
  Model: "モデル",
  "Choose a model": "モデルを選択",
  "What gets through": "通過するもの",
  "No filtering": "フィルターなし",
  blocked: "ブロック",
  shown: "表示",
  "Likely cam": "CAM版の可能性",
  "Wrong year": "年が違う",
  "Size outlier": "サイズ異常",
  "Suspicious file": "不審なファイル",
  "Top pick": "最優先候補",
  "All sources": "すべてのソース",
  Play: "再生",
  "When a flagged ad plays, a Skip button slides in so you jump straight past it.":
    "フラグ付きの広告が再生されると「スキップ」ボタンが表示され、広告をすぐに飛ばせます。",
  "Picks up right where you left off": "中断したところからすぐに再開",
  "Back out mid-episode and the card keeps the exact frame you stopped on, with your progress, so it looks like a pause instead of a thumbnail.":
    "エピソードの途中で戻ると、カードには停止した瞬間のフレームと進捗がそのまま残り、サムネイルではなく一時停止画面のように表示されます。",
  "The Last Stand": "最後の砦",
  "With the city surrounded, an unlikely alliance forms as a long-buried secret finally comes to light.":
    "包囲された街で思いがけない同盟が結ばれ、長く埋もれていた秘密がついに明らかになる。",
  "No Way Out": "逃げ場なし",
  "Loyalties shatter as the survivors realize the enemy has been among them all along.":
    "生存者たちは敵がずっと仲間の中にいたと気づき、忠誠は崩れ去る。",
  "Previous frame": "前のフレーム",
  "Next frame": "次のフレーム",
  "Step back one frame and pause. Frame-accurate on mpv.":
    "1フレーム戻して一時停止します。mpvではフレーム単位で正確に操作できます。",
  "Step forward one frame and pause. Frame-accurate on mpv.":
    "1フレーム進めて一時停止します。mpvではフレーム単位で正確に操作できます。",
  "Recovery": "復旧",
  "Reload source": "ソースを再読み込み",
  "Re-open the stream you are watching and pick it back up where you left off.":
    "視聴中のストリームを開き直し、中断したところから再生を再開します。",
  "Restart streaming server": "ストリーミングサーバーを再起動",
  "Restart Harbor's own streaming server, then reload the stream once it is back. Desktop only.":
    "Harbor内蔵のストリーミングサーバーを再起動し、復帰後にストリームを再読み込みします。デスクトップアプリでのみ利用できます。",
  "Buffer size": "バッファサイズ",
  "Small": "小",
  "Medium": "中",
  "Adaptive": "自動調整",
  "Reads ahead": "先読み",
  "Memory cap": "メモリ上限",
  "Wait before playing": "再生開始までの待機",
  "Holds up to {size} in memory while a video plays.":
    "動画の再生中、最大{size}をメモリに保持します。",
  "Harbor sizes the head start for each title and grows it once playback settles. Right for almost everyone.":
    "Harborが作品ごとに先読み量を調整し、再生が安定してから増やします。ほとんどの場合はこの設定が最適です。",
  "The quickest start and the least memory used. Good on a fast, steady connection, or on a machine that is short on memory.":
    "最も早く再生が始まり、メモリ使用量も最小です。高速で安定した接続や、メモリに余裕のないパソコンに向いています。",
  "A couple of minutes of head start. Rides out a brief hiccup without much of a wait before playback begins.":
    "数分ぶんを先読みします。再生開始までほとんど待つことなく、短い通信の乱れを乗り切れます。",
  "Ten minutes of head start. Built for spotty Wi-Fi or a far-away server, at the cost of a longer wait before playback begins.":
    "10分ぶんを先読みします。不安定なWi-Fiや遠方のサーバー向けですが、再生が始まるまでの待ち時間は長くなります。",
  "Half an hour of head start. Only worth it on a badly unreliable connection.":
    "30分ぶんを先読みします。接続が極端に不安定な場合にのみ効果があります。",
  "Ignored titles": "非表示にした作品",
  "Titles you ignore on the advisory card never show it again.":
    "コンテンツに関する注意カードで非表示にした作品には、以降このカードは表示されません。",
  "{count} titles will never show the content advisory again.":
    "{count}件の作品では、今後コンテンツに関する注意が表示されません。",
  "{count} titles will never show the content advisory again.#one":
    "{count}件の作品では、今後コンテンツに関する注意が表示されません。",
  "{count} titles will never show the content advisory again.#few":
    "{count}件の作品では、今後コンテンツに関する注意が表示されません。",
};

export default settings;
