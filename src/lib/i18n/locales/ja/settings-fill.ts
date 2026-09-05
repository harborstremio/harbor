const settingsFill: Record<string, string> = {
  "Your avatar, name, and handle across Harbor.":
    "Harbor全体で使用するアバター、名前、ハンドルネームです。",
  'Adds an "Ask AI" button to search, so you can type things like a plain-language request.':
    "検索に「AIに聞く」ボタンを追加し、自然な言葉でリクエストを入力できるようにします。",
  "Get a key at": "キーの取得先",
  "It only runs when you tap that button, so it never costs anything unless you ask.":
    "このボタンをタップしたときだけ実行されるため、操作しない限り費用は一切かかりません。",
  "Groq runs open-source models on its LPU hardware with a generous free tier; every model listed below runs on the free tier.":
    "Groqはオープンソースモデルを独自のLPUハードウェアで実行し、充実した無料枠を提供しています。以下のモデルはすべて無料枠で利用できます。",
  "Custom model id (optional)": "カスタムモデルID（任意）",
  "Use model": "このモデルを使用",
  "Any model id from console.groq.com/docs/models works here.":
    "console.groq.com/docs/models にある任意のモデルIDを使用できます。",
  "Any model id from openrouter.ai/models works here, including :free variants.":
    "openrouter.ai/models にある任意のモデルIDを使用できます。:freeバリアントも含まれます。",
  "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.":
    "SVPのファイルはありますが、VapourSynthエンジンを読み込めません（{err}）。通常は、古いVapourSynthエントリまたはMicrosoft VC++ランタイムの不足が原因です。SVPを再インストールするか、Microsoftから最新の「Visual C++ Redistributable (x64)」をインストールして、Harborを再起動してください。",
  "Smooth motion runs on the bundled mpv engine in the Harbor desktop app. It has no effect in the browser.":
    "スムーズモーションは、Harborデスクトップアプリに同梱のmpvエンジンで動作します。ブラウザでは効果がありません。",
  "Subtitle auto-sync": "字幕の自動同期",
  "Harbor times out-of-sync subtitles to the audio for you, on any external subtitle. It works on the mpv player and leaves embedded tracks alone, since those are already in sync.":
    "Harborが、同期のずれた外部字幕を音声に合わせて調整します。mpvプレーヤーで動作し、すでに同期している埋め込み字幕トラックには影響しません。",
  "Auto-sync subtitles": "字幕を自動同期",
  "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own. Off by default.":
    "字幕が早すぎたり遅すぎたりする場合、Harborが音声を測定してタイミングを自動補正します。初期設定ではオフです。",
  "Let structural tiers auto-apply": "構造ベースの補正を自動適用",
  "Identity matches from content hashing and the community database always apply on their own. Timing worked out from the audio only offers a fix until it has earned trust. Turn this on to let those audio-derived fixes apply automatically too.":
    "コンテンツハッシュとコミュニティデータベースで完全一致した補正は、常に自動適用されます。音声のみから算出したタイミングは、信頼性が確認されるまでは修正候補として提示されます。オンにすると、この音声ベースの補正も自動適用されます。",
  "Drift monitor": "同期ずれの監視",
  "Keeps watching through playback and gently re-nudges the timing if the subtitle slips out of sync partway through.":
    "再生中も監視を続け、途中で字幕の同期がずれた場合はタイミングを少しずつ再調整します。",
  "Smart resync with speech recognition": "音声認識によるスマート再同期",
  "For the hardest files and the Try again button, Harbor transcribes a little speech on your device and lines the subtitle up to the actual words. Needs a build with the asr-whisper feature and downloads a small model the first time you use it.":
    "特に難しいファイルや「もう一度試す」ボタンでは、Harborがデバイス上で短い音声を文字起こしし、実際の発話に字幕を合わせます。asr-whisper機能を含むビルドが必要で、初回使用時に小さなモデルをダウンロードします。",
  "Community sync": "コミュニティ同期",
  "A good correction only has to be found once. Harbor can share verified fixes so the next person with the same file and subtitle gets an instant result. Records are keyed by salted fingerprints, never your files or anything personal.":
    "適切な補正は一度見つけるだけで十分です。Harborは検証済みの補正を共有できるため、次に同じファイルと字幕を使う人はすぐに結果を得られます。記録にはソルト付きフィンガープリントが使われ、ファイルや個人情報は一切使われません。",
  "Use community corrections": "コミュニティの補正を使用",
  "Check the shared database first. When this exact subtitle has already been synced by someone else, yours snaps into place with no analysis.":
    "最初に共有データベースを確認します。同じ字幕がすでにほかのユーザーによって同期されていれば、解析せずにすぐ適用されます。",
  "Community sync server": "コミュニティ同期サーバー",
  "https://sync.harbor.site": "https://sync.harbor.site",
  "Leave blank to use Harbor's own community server. Enter a URL to point at your own server instead. Private mode below stops all contact either way.":
    "空欄にするとHarbor公式のコミュニティサーバーを使用します。独自サーバーを使う場合はURLを入力してください。下のプライベートモードを有効にすると、どちらの場合も通信をすべて停止します。",
  "Private mode": "プライベートモード",
  "Never contact the community server in either direction. Nothing is looked up and nothing is contributed from this device.":
    "コミュニティサーバーとの送受信を一切行いません。このデバイスから検索も投稿も行われません。",
  "Harbor ships a neutral trophy for every award. Install an icon pack or upload your own image per award to make them yours. Packs are hosted by whoever makes them, so the artwork is theirs, not bundled with Harbor.":
    "Harborには各アワード用の標準トロフィーが用意されています。アイコンパックをインストールするか、アワードごとに画像をアップロードしてカスタマイズできます。パックは作成者がホストしているため、アートワークはHarborには同梱されず、各作成者に帰属します。",
  "View community award packs": "コミュニティのアワードパックを見る",
  "Icon packs and single-award art from the community":
    "コミュニティ提供のアイコンパックと個別アワード画像",
  "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.":
    "アワードごとに画像をアップロードするか、各アワードの下に表示されるID（タップでコピー）をzip内のファイル名にしてください。一般的な名前にも対応しており、best_soundtrack、movie_of_the_yearなども認識されます。",
  "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.":
    "アワードパックは、1つのJSONファイルと、そのファイルが参照する画像で構成されます。両方を公開されている場所（自分のサーバーやGitHubリポジトリなど）にホストし、JSONのURLを共有してください。Harborが保存するのはインストールしたURLだけで、画像自体は保存しません。",
  "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.":
    "上の各キーはアワードIDです。省略したキーには標準トロフィー（または優先度の低いパック）が使われます。IDの完全な一覧は、上のグリッドに表示されているすべてのアワードです。",
  'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.':
    "各画像ファイルにアワードIDと同じ名前を付けて.zipにまとめ、上の「.zipパックをインポート」を選択してください。JSONもホスティングも不要です。Harborが各ファイルを対応するアワードに割り当て、ローカルに保存してサイズを調整し、認識できないものはスキップします。",
  "Watched badge": "視聴済みバッジ",
  "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.":
    "番組やアニメのエピソードをグループ化する方法です。初期設定のTVDBでは、アニメファンになじみのあるアーク順、DVD順、絶対順をキーなしで利用できます。TMDBでは通常の放送順が維持されます。どちらを選んでも、各エピソードの再生方法と視聴済みの記録方法は変わりません。",
  "Turns the season button into a full panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. On by default for anime through Harbor's TVDB service, no key needed. Add your own TVDB key to use it for regular shows too.":
    "シーズンボタンを、並び順タブ（放送順、DVD順、絶対順、および作品で利用可能なその他の順序）と、放送期間やエピソード数を示すシーズン表を備えたパネルにします。アニメではHarborのTVDBサービスを通じて初期設定でオンになり、キーは不要です。通常の番組でも使うには、自分のTVDBキーを追加してください。",
  'When Esc would close the player, show a quick confirm first. You can tick "Don\'t ask me again" in that prompt to always leave on Esc.':
    "Escでプレーヤーを閉じる前に、簡単な確認を表示します。確認画面で「今後は確認しない」にチェックすると、以後はEscですぐに終了できます。",
  "Short seek (Shift + arrows)": "短いシーク（Shift + 矢印キー）",
  "A shorter jump on Shift plus the arrow keys, for nudging a few seconds at a time.":
    "Shiftと矢印キーで短く移動し、数秒ずつ微調整できます。",
  'Posters, logos, and title art load in the first available language from this list, falling back down the order. "Original" uses the title\'s own language. Put your main language first. Needs a TMDB key.':
    "ポスター、ロゴ、タイトルアートは、このリストで最初に利用できる言語で読み込まれ、利用できない場合は順に次の言語へ切り替わります。「オリジナル」では作品本来の言語を使用します。メインの言語を先頭にしてください。TMDBキーが必要です。",
  "Keep Continue Watching private to each profile": "「視聴を続ける」をプロフィールごとに非公開",
  "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.":
    "「視聴を続ける」には、現在のプロフィールの項目だけを表示します。各プロフィールには自分の進捗だけが表示されるため、このStremioアカウントを共有するほかのプロフィールには視聴内容が表示されません。",
  "Show pages": "作品ページ",
  "How a show or movie detail page behaves when you open it.":
    "番組や映画の詳細ページを開いたときの動作を設定します。",
  "When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.":
    "以前閲覧していた番組をもう一度開くと、ページ上部ではなく前回の位置（通常はエピソード一覧）へすぐに戻ります。ページが表示される前に移動するため、画面のちらつきはありません。",
  "Hide and skip episodes": "エピソードを非表示にしてスキップ",
  "Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.":
    "エピソードの右クリックメニューに「非表示」を追加します。非表示のエピソードは一覧から消え、「次のエピソード」でもスキップされます。各番組の「非表示を表示」切り替えで再表示できます。",
  "Poster shine on hover": "ホバー時のポスター光沢効果",
  "A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.":
    "ポスターにカーソルを合わせると、tvOS風の控えめな光が流れます。初期設定ではオフです。カードが浮き上がる効果は、この設定にかかわらず維持されます。",
  "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.":
    "ブラウザ版Harbor、スマートフォンリモコン、マンガリーダーリモコンをお探しですか？これらは「リモコン」ページに移動しました。",
  "X-Ray (experimental)": "X-Ray（試験機能）",
  "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.":
    "Amazon風のX-Rayです。視聴中にキャストを開き、人物をタップすると、プロフィールと出演作をすべて確認できます。画面に映っている人物を特定するデバイス上の顔照合機能も近日対応予定です。初期設定ではオフです。",
  "Enable X-Ray": "X-Rayを有効化",
  "Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.":
    "プレーヤーにX-Rayボタンを追加し、写真付きの全キャストを表示して、各俳優のページを開けるようにします。写真とフィルモグラフィーの取得にはTMDBキーが必要です。",
  "Scan who is on screen while playing": "再生中に画面上の人物を識別",
  "Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.":
    "現在のフレーム内の顔を定期的にキャストと照合し、画面に映っている人物を表示します。処理はデバイス上で行われ、データが外部に送信されることはありません。再生中のCPU使用量が少し増えます。",
  "X-Ray needs a TMDB key": "X-RayにはTMDBキーが必要です",
  "X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.":
    "X-RayはTMDBからキャスト情報と写真を取得します。TMDBキーがないと、照合するキャスト情報を取得できません。「ライブラリとメタデータ」で無料キーを追加してください。",
  "Ask if you're still watching": "まだ視聴中か確認",
  "After several episodes auto-play in a row with no input, pause and check you're still there before continuing. Off by default.":
    "操作なしで複数のエピソードが連続自動再生されたら、一時停止して視聴を続けているか確認します。初期設定ではオフです。",
  "After 2": "2話後",
  "After 3": "3話後",
  "After 4": "4話後",
  "After 5": "5話後",
  "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.":
    "リモコンはデスクトップアプリから提供されます。リンクを取得するには、パソコンのHarborでこの設定を開いてください。",
  "Harbor on other devices": "ほかのデバイスでHarborを使う",
  "Serve Harbor on your network": "ネットワーク上でHarborを公開",
  "One switch powers everything on this page: the web app, the phone remote, and the manga reader remote.":
    "このページのすべての機能を1つのスイッチで有効にします。Webアプリ、スマートフォンリモコン、マンガリーダーリモコンが対象です。",
  "Phone remote": "スマートフォンリモコン",
  "Turns your phone into a remote for this computer: play, pause, seek, volume, and casting, all from the couch. Open the Wi-Fi address on your phone's browser.":
    "スマートフォンをこのパソコンのリモコンとして使えます。ソファから再生、一時停止、シーク、音量調整、キャストを操作できます。スマートフォンのブラウザでWi-Fiアドレスを開いてください。",
  "Manga reader remote": "マンガリーダーリモコン",
  "Control the manga flipbook from your phone while reading on the big screen: turn pages, zoom, and switch modes. The reader also shows this link while you read.":
    "大画面でマンガを読みながら、スマートフォンでページ送り、ズーム、モード切り替えを操作できます。閲覧中はリーダーにもこのリンクが表示されます。",
  "Flip the switch above and the phone remote and manga reader remote addresses appear here.":
    "上のスイッチをオンにすると、スマートフォンリモコンとマンガリーダーリモコンのアドレスがここに表示されます。",
  "On a beta that's giving you trouble? Pick an earlier build below and run its installer over your current copy. Your library, settings, and downloads all stay put.":
    "ベータ版で問題が起きていますか？下から以前のビルドを選び、現在のアプリに上書きする形でインストーラーを実行してください。ライブラリ、設定、ダウンロードはすべてそのまま維持されます。",
  "While beta updates are on, Harbor offers the newest build again on its next check. Turn beta updates off above to stay on an earlier one.":
    "ベータアップデートがオンの間は、次回の確認時にHarborが最新ビルドを再び案内します。以前のビルドを使い続けるには、上でベータアップデートをオフにしてください。",
  "Picture shaders run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "映像シェーダーは、Harborデスクトップアプリに同梱のmpvエンジンで動作します。ブラウザでは効果がありません。",
  "Download the desktop app to use shaders.":
    "シェーダーを使うにはデスクトップアプリをダウンロードしてください。",
  "More picture shaders": "その他の映像シェーダー",
  "Neural upscalers, sharpeners, and HDR tone-mapping ported for mpv. Each is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.":
    "mpv向けに移植されたニューラルアップスケーラー、シャープ化、HDRトーンマッピングです。各ツールは作者が公開しており、Harborには同梱されていません。必要なものをダウンロードすると、Harborが正しい順序で連結してプレーヤーに適用します。",
  Cleared: "消去済み",
  "Sure?": "よろしいですか？",
  "Storage overview": "ストレージ概要",
  "Everything Harbor saves lives on this computer. If space runs low, clear a cache below; Harbor rebuilds them as you browse.":
    "Harborが保存するデータはすべてこのコンピューター上にあります。空き容量が少なくなった場合は、以下のキャッシュを消去してください。閲覧に応じてHarborが再作成します。",
  "App storage": "アプリのストレージ",
  "{quota} available": "空き容量 {quota}",
  "Settings storage": "設定データ",
  "Clear caches": "キャッシュを消去",
  "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.":
    "いつでも安全に消去できます。視聴履歴、ライブラリ、テーマ、ログイン情報には影響しません。",
  "Stream picker cache": "ストリーム選択キャッシュ",
  "Remembered source lists per title. Clears stale results after changing addons or debrid.":
    "作品ごとに保存されたソース一覧です。アドオンやdebridを変更した後、古い結果を消去します。",
  "Manga browse cache": "マンガ閲覧キャッシュ",
  "Cached chapter lists and browse pages. Downloads stay untouched.":
    "キャッシュされたチャプター一覧と閲覧ページです。ダウンロード済みデータには影響しません。",
  "Live TV caches": "ライブTVのキャッシュ",
  "Parsed playlists, program guide, and series info. Re-downloads on next open.":
    "解析済みのプレイリスト、番組表、シリーズ情報です。次回開いたときに再ダウンロードされます。",
  "Dead stream marks": "無効なストリームのマーク",
  "Sources Harbor flagged as broken. Clear to give them another chance.":
    "Harborが無効と判定したソースです。もう一度試すには消去してください。",
  "Continue Watching suggestions cache": "「視聴を続ける」の候補キャッシュ",
  "Resurface picks for the home rail. Rebuilds overnight.":
    "ホームの列に候補を再表示します。毎晩再作成されます。",
  "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.":
    "ダウンロードしたテーマは「テーマと外観」で管理できます。動画とマンガのダウンロードは「ダウンロード」ページで管理できます。",
  "Pattern (e.g. \\bremux\\b)": "パターン（例: \\bremux\\b）",
  "Downloaded from community": "コミュニティからダウンロード済み",
  "Badge art packs you installed from the community store. Remove one to put its badges back to default.":
    "コミュニティストアからインストールしたバッジ画像パックです。削除すると、そのパックのバッジがデフォルトに戻ります。",
  "{n} badges": "{n}個のバッジ",
  "Pack removed, badges back to default": "パックを削除し、バッジをデフォルトに戻しました",
  "Remove pack": "パックを削除",
  "View community badge packs": "コミュニティのバッジパックを表示",
  packs: "パック",
  "Any Stremio subtitle addons you have installed are searched here too.":
    "インストール済みのStremio字幕アドオンも検索対象になります。",
  "{count} installed. Add or remove them under Streaming sources.":
    "{count}個インストール済みです。「ストリーミングソース」で追加または削除できます。",
  "None installed yet. Add Stremio subtitle addons under Streaming sources.":
    "まだインストールされていません。「ストリーミングソース」でStremio字幕アドオンを追加してください。",
  "Subtitle sources": "字幕ソース",
  "Harbor searches every source you enable at the same time, then merges and de-duplicates the results into one clean list. Turn a source off to stop pulling from it.":
    "Harborは有効なすべてのソースを同時に検索し、結果を統合して重複のない1つの一覧にまとめます。取得を停止するには、そのソースをオフにしてください。",
  OpenSubtitles: "OpenSubtitles",
  "Harbor's built-in OpenSubtitles search, on by default. If you install an OpenSubtitles addon, this steps aside automatically so your results are never duplicated.":
    "Harbor内蔵のOpenSubtitles検索です。デフォルトでオンになっています。OpenSubtitlesアドオンをインストールすると、結果が重複しないよう内蔵検索は自動的に無効になります。",
  Wyzie: "Wyzie",
  "A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.":
    "高速なコミュニティ字幕インデックスです。デフォルトではオフです。新作やニッチな作品の検索範囲を広げるにはオンにしてください。",
  "Subtitle addons": "字幕アドオン",
  SUBDL: "SUBDL",
  "A large multi-language subtitle database. Off until you add your free SUBDL API key.":
    "大規模な多言語字幕データベースです。無料のSUBDL APIキーを追加するまでオフになっています。",
  "Paste your SUBDL API key": "SUBDL APIキーを貼り付け",
  "Get a free key at subdl.com": "subdl.comで無料キーを取得",
  Subsource: "Subsource",
  "A community subtitle source. Off until you add your Subsource API key.":
    "コミュニティの字幕ソースです。Subsource APIキーを追加するまでオフになっています。",
  "Paste your Subsource API key": "Subsource APIキーを貼り付け",
  "Get your key at subsource.net": "subsource.netでキーを取得",
  "Manage subtitle addons in Streaming sources": "「ストリーミングソース」で字幕アドオンを管理",
  "The languages above all obey your preferred subtitle language order, which lives in the Languages page.":
    "上記の言語にはすべて、「言語」ページで設定した字幕言語の優先順が適用されます。",
  "Open Languages": "「言語」を開く",
  Quality: "画質",
  Maximum: "最大",
  "Resolution posters are decoded at. High is sized to your screen with headroom and looks identical to full res while using far less memory; Balanced saves the most; Maximum keeps original resolution.":
    "ポスターをデコードする解像度です。「高」は余裕を持たせて画面に合わせたサイズになり、フル解像度と同じ見た目でメモリ使用量を大幅に抑えます。「バランス」は最もメモリを節約し、「最大」は元の解像度を維持します。",
  "Poster dock magnification": "ポスター列のDock風拡大",
  "Gently magnify nearby posters as you move across a poster row, like a dock. Off by default.":
    "ポスター列を移動するとき、Dockのように周辺のポスターを滑らかに拡大します。デフォルトではオフです。",
  "Liquid Glass": "リキッドガラス",
  "Use liquid glass": "リキッドガラスを使用",
  "Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.":
    "検索ピルと列のスクロール矢印にリキッドガラスを使用します。以下の外観設定は、Harbor内のすべてのガラスサーフェスで共通です。",
  "Enhanced liquid glass": "強化リキッドガラス",
  "A richer glass treatment. May look better while using more graphics resources.":
    "より表現豊かなガラス効果です。グラフィックスリソースの使用量は増えますが、見栄えが向上する場合があります。",
  "Glass opacity": "ガラスの不透明度",
  "Glass blur": "ガラスのぼかし",
  "Glass tint": "ガラスの色合い",
  "Featured source": "注目コンテンツのソース",
  "What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.":
    "ヒーローエリアに表示する内容です。「トレンド」はHarborが提供する最新の人気ランキングで、1日に何度も更新されます。「クラシック」は自分のホームの列を使用します。",
  Classic: "クラシック",
  Screensaver: "スクリーンセーバー",
  "When Harbor sits idle in the foreground, it drifts through cinematic backdrops with a clock and what's trending. Any movement or key brings you back. Off by default.":
    "Harborを前面で操作せずにいると、時計とトレンド情報を重ねた映画のような背景がゆっくり切り替わります。マウスなどを動かすかキーを押すと戻ります。デフォルトではオフです。",
  "Ambient screensaver": "アンビエントスクリーンセーバー",
  "Start after": "開始までの時間",
  "3 min": "3分",
  "5 min": "5分",
  "10 min": "10分",
  "15 min": "15分",
  "Moving the window": "ウィンドウの移動",
  "Choose where you can grab Harbor to drag it around your screen.":
    "Harborを画面上でドラッグするときにつかめる領域を選択します。",
  "Native-style hybrid bar": "システム風ハイブリッドバー",
  "Turn off the native window title bar above to use Harbor's hybrid bar instead.":
    "Harborのハイブリッドバーを使用するには、上にあるシステム標準のウィンドウタイトルバーをオフにしてください。",
  "Tuck clean, native-looking window buttons into the top corner, with hover labels. On macOS they become traffic-light dots. Blends into Harbor while feeling like your system's own title bar.":
    "システムになじむすっきりしたウィンドウボタンを上隅に配置し、ホバー時にラベルを表示します。macOSでは信号機風の丸いボタンになります。Harborに溶け込みながら、システム標準のタイトルバーのように操作できます。",
  "Frost the top bar on scroll": "スクロール時に上部バーをすりガラス表示",
  "As you scroll, the top bar frosts over the content beneath it. Off by default; it uses a blur, so leave it off on lower-end machines.":
    "スクロールすると、上部バーが背後のコンテンツをすりガラス風にぼかします。デフォルトではオフです。ぼかし処理を使用するため、性能の低いマシンではオフのままにしてください。",
  "Top-right controls": "右上のコントロール",
  "The operating system draws native window controls, so Harbor cannot change their appearance.":
    "ウィンドウの標準コントロールはOSによって描画されるため、Harborでは外観を変更できません。",
  "Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.":
    "「一緒に観る」と、最小化、最大化、閉じるボタンの外観を選びます。リキッドガラスにすると、シンプルな透明コントロールが置き換わります。",
  "Clean transparent": "シンプルな透明",
  "Liquid glass": "リキッドガラス",
  Filled: "塗りつぶし",
  "Drag the window from anywhere": "どこをドラッグしてもウィンドウを移動",
  "Move Harbor by dragging any empty space on a page, not just the top bar. Leave this off to keep clicks inside pages from nudging the window.":
    "上部バーだけでなく、ページ内の何もない場所をドラッグしてHarborを移動できます。ページ内をクリックしたときにウィンドウがずれないようにするには、オフのままにしてください。",
  "Stream priority": "ストリームの優先順位",
  "Results from addons higher in this list come first. If one finds nothing, the next fills in.":
    "このリストで上位のアドオンの結果が優先されます。見つからなければ、次のアドオンが補います。",
  "Following addon order": "アドオン順",
  "Use addon order": "アドオン順を使用",
  "Not installed": "未インストール",
  "Remove from list": "リストから削除",
  "Priority applies once you have two or more stream addons.":
    "ストリームアドオンが2つ以上ある場合に優先順位が適用されます。",
  "{n} addons don't provide streams and aren't listed.":
    "{n}件のアドオンはストリームを提供していないため、一覧に表示されません。",
  "Moved {name} to position {n} of {total}": "{name}を{total}件中{n}番目に移動しました",
  "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.":
    "Harborランキングでは、評価の高いソースが先に表示されます。アドオン順では、StremioやVidiと同様に、各アドオンの結果が返された順に保たれます。どちらのモードでも、先頭にするアドオンは下のストリーム優先順位で決まります。",
  "If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "ストリームが時間内に再生を開始しない場合（無効なソースや停止中のアドオンなど）、次に利用できるストリームを自動的に試します。初期設定ではオフです。",
  "How long to wait first": "最初の待ち時間",
  "Slow addons and P2P sources often need more than 10 seconds to start. Raise this if streams are being skipped before they get a fair chance.":
    "低速なアドオンやP2Pソースは、開始まで10秒以上かかることがあります。開始する前にストリームがスキップされる場合は、この時間を長くしてください。",
  "{n} sec": "{n}秒",
  "Only start the torrent engine when needed": "必要なときだけトレントエンジンを起動",
  "Harbor normally starts its torrent engine at launch so the first P2P stream connects faster. That keeps a DHT node running and talking to the network even when you are not watching anything. Turn this on if you are on a metered or limited connection: the engine then starts the first time you actually play a torrent. Takes effect next launch.":
    "通常、Harborは最初のP2Pストリームへすばやく接続できるよう、起動時にトレントエンジンを開始します。そのため、何も視聴していないときもDHTノードが動作し、ネットワークと通信します。従量制または通信量に制限のある接続では、これをオンにしてください。実際にトレントを初めて再生したときにエンジンが起動するようになります。次回の起動時から有効になります。",
  "What fullscreen does": "全画面表示の動作",
  "True fullscreen covers the whole screen and hides the taskbar. Maximize fills the screen but keeps the taskbar and title bar, so you can still switch apps.":
    "全画面表示では画面全体を使用し、タスクバーを非表示にします。最大化では画面いっぱいに表示しつつ、タスクバーとタイトルバーを残すため、アプリを切り替えられます。",
  "True fullscreen": "全画面表示",
  Maximize: "最大化",
  "Dual subtitles": "2言語字幕",
  "Show a second subtitle in another language at the same time. Handy when you are learning a language: keep the one you are learning as your main subtitle, and put your own language here.":
    "別の言語の字幕を同時にもう1つ表示します。語学学習に便利です。学習中の言語をメイン字幕にして、母語をこちらに設定してください。",
  "Second subtitle language": "第2字幕の言語",
  "Harbor loads it automatically when a track in that language exists. You can also set or clear the second track for one video from the subtitle menu in the player.":
    "その言語の字幕トラックがある場合、Harborが自動的に読み込みます。プレイヤーの字幕メニューから、その動画だけ第2字幕を設定または解除することもできます。",
  "Where it shows": "表示位置",
  "Top of the screen": "画面上部",
  "Above the main line": "メイン字幕の上",
  "Second line size": "第2字幕のサイズ",
  "Get your own": "自分用を入手",
  "Trial for ${n}": "${n}でお試し",
  ElfHosted: "ElfHosted",
  "Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.":
    "Debridgeは、再生可能なファイルを見つける機能です。TorBoxとUsenetのアカウントが付属するため、debridサービスを別途購入する必要はありません。すでにReal-DebridまたはAllDebridをお持ちなら、代わりに接続できます。",
  "No Docker, no server, nothing to configure.": "Dockerもサーバーも不要。設定も不要です。",
  "${n} for {days} days": "{days}日間で${n}",
  "cancel anytime": "いつでも解約可能",
  "Rather not set any of this up?": "設定するのが面倒ですか？",
  "Get {name} hosted, plus {n} more addons.": "{name}と、さらに{n}個のアドオンをホスティング。",
  "{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.":
    "Debridgeを含む{n}個のアドオンを運用します。TorBoxとUsenetのアカウントも付属するため、debridサービスを別途購入する必要はありません。",
  "Try it for ${n}": "${n}で試す",
  "Hide this": "非表示",
  "Includes Comet, MediaFusion, AIOStreams, StremThru, Jackettio and more, plus TorBox and Usenet accounts. No Docker, no server, no config.":
    "Comet、MediaFusion、AIOStreams、StremThru、Jackettioなどに加え、TorBoxとUsenetのアカウントも含まれます。Dockerもサーバーも設定も不要です。",
  "Support Harbor": "Harborを支援",
  "Who keeps this running": "運営を支えているのは",
  "Harbor's backend runs on ElfHosted. They took it on without being asked, and Harbor has never charged for anything.":
    "HarborのバックエンドはElfHosted上で稼働しています。頼まれたわけでもないのに運営を引き受けてくれました。Harborはこれまで一切料金を請求していません。",
  "If you want to put money somewhere and you use Harbor, an ElfHosted subscription is the most useful place for it. You get a managed instance, and the servers Harbor depends on stay paid for.":
    "Harborを利用していて支援にお金を使いたいなら、ElfHostedのサブスクリプションが最も役立ちます。管理済みインスタンスを利用でき、Harborが依存するサーバーの費用も支えられます。",
  "Browse ElfHosted": "ElfHostedを見る",
  "One-off donation": "1回限りの寄付",
  "Donating to Harbor": "Harborへの寄付",
  "Short version: don't. Harbor takes no donations and no cut of anything on this page.":
    "要するに、寄付は不要です。Harborは寄付を受け付けず、このページから収益も得ていません。",
  "People have offered plenty of times and the answer has stayed no. If you were going to send something, send it to ElfHosted above so the infrastructure stays up, or to one of the charities below. Both do more good than paying me would.":
    "これまで何度も申し出をいただきましたが、答えは変わらず「いいえ」です。お金を送りたい場合は、インフラを維持できるよう上記のElfHostedへ送るか、下記の慈善団体へ寄付してください。私に支払うより、どちらも有意義に役立てられます。",
  "If you would rather give it away": "寄付するなら",
  "No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.":
    "提携も紹介リンクもなく、Harborが収益を得ることもありません。ここに送るより、お金を有効に役立てられる寄付先を紹介しているだけです。",
  "Insecticide-treated nets. One of the most cost-effective interventions measured.":
    "殺虫剤処理済みの蚊帳。費用対効果が特に高いことが実証された支援策の一つです。",
  "Cash straight to people living in extreme poverty, no strings.":
    "極度の貧困状態にある人々へ、条件なしで直接現金を届けます。",
  "Emergency medical care in crisis zones.": "危機地域での緊急医療支援。",
  "Keeps the web's memory alive. Harbor would be poorer without it.":
    "ウェブの記憶を守っています。これがなければ、Harborで得られる情報も少なくなります。",
  "Who pays for the servers, and where to put money if you want to.":
    "サーバー費用を負担しているのは誰か、支援したい場合はどこにお金を送ればよいかをご案内します。",
  "Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.":
    "HarborのバックエンドはElfHosted上で稼働しています。コミュニティに費用を負担させることなく、サーバーを運用してくれています。",
  "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.":
    "Harborのバックエンドをオンラインで維持するには実際に費用がかかりますが、コミュニティが負担せずに済むようElfHostedが負担しています。継続を支える最善の方法はサブスクリプションへの加入であり、寄付ではありません。自分用の環境に必要な本格的なインフラを利用しながら、Harborの運営も同時に支えられます。",
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.":
    "レート上限が10倍で、ストリームプロキシを内蔵したプライベートStremioアドオン。月額$9から。",
  "Managed Plex, Emby, or Jellyfin, running in minutes with no hardware and no Docker.":
    "ハードウェアもDockerも不要で、数分で使い始められる管理済みのPlex、Emby、Jellyfin。",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.":
    "100種類以上のセルフホストアプリ。*arrスタック、debridツール、電子書籍、オーディオブックなど。",
  "Daily backups, automatic updates, and monitoring, all handled for you.":
    "毎日のバックアップ、自動更新、監視をすべてお任せできます。",
  "Month to month, cancel anytime, and you can try the whole thing for $1 for a week.":
    "月単位でいつでも解約可能。すべての機能を1週間$1で試せます。",
  "See what you get": "利用できる内容を見る",
  "Short version: don't. Harbor takes no donations.":
    "要するに、寄付は不要です。Harborは寄付を受け付けていません。",
  "If you were going to send something, send it to ElfHosted above so the servers stay paid for, or to one of the charities below. Both do more good with it.":
    "お金を送りたい場合は、サーバー費用を支えられるよう上記のElfHostedへ送るか、下記の慈善団体へ寄付してください。どちらも、より有意義に役立てられます。",
  "Badges for giving": "支援でもらえるバッジ",
  "Give to any charity below or subscribe to ElfHosted, and the badge lands on your profile.":
    "下記の慈善団体に寄付するかElfHostedを購読すると、プロフィールにバッジが付与されます。",
  Charity: "チャリティー",
  "For donating to a charity.": "慈善団体への寄付で獲得。",
  "Charity $100+": "チャリティー $100以上",
  "For giving more than $100 to charity.": "慈善団体への$100を超える寄付で獲得。",
  "For an active ElfHosted subscription.": "有効なElfHostedサブスクリプションで獲得。",
  "To get a Charity badge, forward your donation receipt or invoice to":
    "チャリティバッジを受け取るには、寄付の領収書または請求書を次の宛先に転送してください",
  "with your @handle in the body so we can match it to your account.":
    "本文にご自身の@handleを記載してください。アカウントとの照合に使用します。",
  "Childhood cancer research and treatment. Families are never billed for care, travel, housing, or food.":
    "小児がんの研究と治療。治療、交通、宿泊、食事の費用を家族に請求することはありません。",
  "Funds research into less toxic, more targeted treatments for childhood cancer.":
    "より低毒性で、小児がんを狙い撃ちする治療法の研究に資金を提供しています。",
  "Defends privacy, free expression, and the open internet, in the courts and in the code.":
    "法廷とコードの両面から、プライバシー、表現の自由、開かれたインターネットを守っています。",
  "Emergency medical care in crisis zones, independent of politics.":
    "紛争・災害地域で、政治に左右されない緊急医療を提供しています。",
  "Look any of them up on Charity Navigator": "各団体の情報はCharity Navigatorで確認できます",
  "Built on Stremio": "Stremioを基盤に構築",
  "Harbor would not be possible without Stremio. It is the foundation everything here is built on.":
    "StremioなしにHarborは実現できませんでした。StremioはHarborのすべてを支える基盤です。",
  "Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.":
    "HarborはStremioのアドオンプロトコルに対応しており、アドオンのエコシステム全体も彼らの取り組みから生まれました。Stremioはコミュニティの支援で運営され、支援者は実験的な機能を先行利用できます。余裕があれば、Stremioへの支援もご検討ください。",
  "Support Stremio": "Stremioを支援",
  "Stremio Supporters get a special badge on their Harbor profile.":
    "Stremioの支援者には、Harborプロフィールで特別なバッジが付与されます。",
  "Your own private {name}, bundled with Debridge": "Debridge込みの専用プライベート{name}",
  "Who keeps the lights on, what Harbor is built on, and where to put money if you want to.":
    "Harborの運営を支える人々、基盤となる技術、支援したい場合の寄付先をご紹介します。",
  "If you were going to send something, send it to ElfHosted or Stremio above, or to one of the charities below. They all do more good with it.":
    "支援をお考えなら、上記のElfHostedかStremio、または下記の慈善団体へお送りください。どこも、その支援をより有意義に役立ててくれます。",
  "Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.":
    "ElfHostedかStremioを支援するか、下記の慈善団体に寄付すると、プロフィールにバッジが付きます。",
  "Fullscreen clock": "全画面時計",
  "Keep your local time visible during fullscreen playback and choose how it looks.":
    "全画面再生中も現地時刻を表示し、見た目を選べます。",
  "Show fullscreen clock": "全画面時計を表示",
  "The clock appears with the player controls.":
    "時計はプレイヤーの操作ボタンと一緒に表示されます。",
  "Clock format": "時刻形式",
  "12-hour": "12時間制",
  "24-hour": "24時間制",
  "Show seconds": "秒を表示",
  "Update the clock every second.": "時計を毎秒更新します。",
  "Show estimated finish time": "終了予定時刻を表示",
  "Display the local time when the current video is expected to end.":
    "現在の動画が終了する予定の現地時刻を表示します。",
  "Clock size": "時計のサイズ",
  "Clock style": "時計のスタイル",
  Minimal: "ミニマル",
  Solid: "ソリッド",
  Accent: "アクセント",
  "Soft blur with a floating pill.": "フローティングピルに柔らかなぼかしを加えます。",
  "Time only, with a subtle shadow.": "時刻のみを控えめな影付きで表示します。",
  "High-contrast panel for busy scenes.": "動きの多いシーンでも見やすい高コントラストパネルです。",
  "Uses your theme's accent color.": "テーマのアクセントカラーを使用します。",
  "Focused Card": "フォーカス中のカード",
  "Expanding Cards": "拡大カード",
  "Emphasize the selected card across the page while gently darkening and blurring the other cards.":
    "選択したカードをページ全体で強調し、ほかのカードを軽く暗くしてぼかします。",
  "Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.":
    "キーボードやリモコンでポスター列を移動する際、事前読み込みした横長画像を使ってポスターカードを拡大します。",
  "Add a TMDB key in Settings to identify the cast.":
    "出演者を識別するには、設定でTMDBキーを追加してください。",
  "No cast photos are available for this title.": "この作品には出演者の写真がありません。",
  "Accounts and TMDB": "アカウントとTMDB",
  "Add an M3U link or Xtream Codes login": "M3UリンクまたはXtream Codesのログイン情報を追加",
  "Add playlist": "プレイリストを追加",
  "Artwork, rows and collections": "アートワーク、列、コレクション",
  "Checking with TMDB…": "TMDBで確認中…",
  "Connected: {list}": "接続済み: {list}",
  "Could not reach TMDB. Check the connection.":
    "TMDBに接続できませんでした。接続を確認してください。",
  "Edge margin": "画面端の余白",
  "Finish setting up Harbor": "Harborの設定を完了",
  "Get one free at {url}": "{url}で無料取得",
  "Getting a code ready…": "コードを準備中…",
  Harbor: "Harbor",
  "Harbor needs a TMDB key for artwork, rows and collections. It is free.":
    "アートワーク、列、コレクションの表示にはTMDBキーが必要です。無料で取得できます。",
  "Harbor plays IPTV from your own provider. Add a playlist and the guide fills in.":
    "Harborでは、ご契約中のプロバイダーのIPTVを再生できます。プレイリストを追加すると、番組表が表示されます。",
  Interface: "インターフェース",
  "Live TV playlists": "ライブTVプレイリスト",
  "Nothing connected yet. Scan a code with your phone.":
    "まだ何も接続されていません。スマートフォンでコードをスキャンしてください。",
  "Phone setup is off": "スマートフォンでの設定はオフです",
  "Press OK on a field to type, or use the Harbor remote on your phone.":
    "入力欄でOKを押して文字を入力するか、スマートフォンのHarborリモコンを使用してください。",
  "Raise this only if your TV cuts off the edges of the picture.":
    "テレビで画面の端が切れる場合のみ、この値を上げてください。",
  "Replace the saved key": "保存済みのキーを置き換える",
  "Save key": "キーを保存",
  "Scan with your phone to sign in without typing on the remote.":
    "スマートフォンでスキャンすると、リモコンで入力せずにログインできます。",
  Screen: "画面",
  "Set up Live TV": "ライブTVを設定",
  Setup: "設定",
  "Setup QR code": "設定用QRコード",
  "Signed in as {name}": "{name}としてログイン中",
  "Sync, themes and friends": "同期、テーマ、フレンド",
  "TMDB API key": "TMDB APIキー",
  "TMDB did not accept that key.": "このキーはTMDBに承認されませんでした。",
  "Turn on phone setup": "スマートフォンでの設定をオンにする",
  "Type a key on this TV": "このテレビでキーを入力",
  "Your Stremio library": "Stremioライブラリ",
  "{count} added": "{count}件追加",
  "Performance notice": "パフォーマンスに関する注意",
  "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.":
    "リアルタイムの顔スキャンではデバイス上のAIモデルが読み込まれ、再生中のRAM、CPU、GPUの使用量が大幅に増える場合があります。Harborの動作が遅くなったり、デバイスが熱くなったりする場合はオフにしてください。",
  "Borderless window": "ボーダーレスウィンドウ",
  "True fullscreen covers the whole screen and hides the taskbar, but switching apps can flicker. Borderless window covers the same area with a frameless window, so alt-tab and overlays stay instant. Maximize fills the screen but keeps the taskbar and title bar.":
    "「全画面表示」は画面全体を覆ってタスクバーを隠しますが、アプリを切り替えるときにちらつくことがあります。「ボーダーレスウィンドウ」は枠のないウィンドウで同じ範囲を覆うため、Alt+Tabやオーバーレイが瞬時に切り替わります。「最大化」は画面いっぱいに広がりますが、タスクバーとタイトルバーは残ります。",
};

export default settingsFill;
