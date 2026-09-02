const addons: Record<string, string> = {
  "Installing…": "インストール中…",
  "Installed locally": "このデバイスにインストール済み",
  "Install failed.": "インストールに失敗しました。",
  "Couldn't remove. Try again.": "削除できませんでした。もう一度お試しください。",
  "Loading the catalog": "カタログを読み込み中",
  "Addon order synced to your Stremio account": "アドオンの順序をStremioアカウントと同期しました",
  "Addon order saved on this device": "アドオンの順序をこのデバイスに保存しました",
  "Hide adult addons": "成人向けアドオンを非表示",
  "Show adult addons": "成人向けアドオンを表示",
  "Curated for popularity and reliability. No paid placements. Install anything else by URL on the Browse tab.":
    "人気と信頼性を基準に厳選しています。有料掲載はありません。その他のアドオンは「閲覧」タブでURLからインストールできます。",
  "Top rated": "評価が高い順",
  "By community stars": "コミュニティの星評価順",
  "Top rising": "人気急上昇",
  "Most starred in 24 hours": "24時間で星を最も多く獲得",
  "Just added": "新着",
  "Freshest on stremio-addons.net": "stremio-addons.netの最新アドオン",
  "Search addons": "アドオンを検索",
  "No addons installed yet": "インストール済みのアドオンはまだありません",
  "Head to Discover. Cinemeta and OpenSubtitles cover the basics; Torrentio + a debrid key cover almost everything else.":
    "「見つける」を開いてみましょう。基本はCinemetaとOpenSubtitlesで、Torrentioとdebridキーがあれば、ほぼすべてをカバーできます。",
  "No installed addon matches that.": "一致するインストール済みアドオンはありません。",
  "Clear the search to see all {n} installed.":
    "検索をクリアすると、インストール済みの{n}件をすべて表示できます。",
  "Change the order addons are tried in": "アドオンを試す順序を変更",
  "Off · catalogs and streams hidden": "オフ · カタログとストリームは非表示",
  "Click to turn off": "クリックしてオフ",
  "Click to turn on": "クリックしてオン",
  "Turn {name} off": "{name}をオフにする",
  "Turn {name} on": "{name}をオンにする",
  "Re-configure this addon and apply the updated link":
    "このアドオンを再設定して新しいリンクを適用",
  "Sign in to sync your addons across devices": "ログインしてアドオンをデバイス間で同期",
  "Anything you install in Harbor pushes back to your Stremio account so it shows up on mobile too. Sign in via the avatar in the bottom-left of the sidebar.":
    "HarborでインストールしたアドオンはStremioアカウントにも反映され、モバイルでも利用できます。サイドバー左下のアバターからログインしてください。",
  "Common picks for a fresh setup.": "初期設定でよく選ばれるアドオンです。",
  "Browse by category": "カテゴリーから探す",
  "Six places to start. Tap one and we'll filter the catalog for you.":
    "6つのカテゴリーから選べます。1つタップすると、カタログを絞り込みます。",
  "Where your video comes from": "動画の配信元",
  "Posters, ratings, lists": "ポスター、評価、リスト",
  "Captions in your language": "あなたの言語の字幕",
  "Kitsu, MAL, season-aware": "Kitsu、MAL、シーズン対応",
  "P2P sources, debrid-ready": "P2Pソース、debrid対応",
  "Live TV": "ライブTV",
  "OTA channels + IPTV": "地上波チャンネル + IPTV",
  "View details": "詳細を見る",
  "Set up": "設定",
  "Debrid required": "debridが必要",
  "Manage addon": "アドオンを管理",
  "Install addon": "アドオンをインストール",
  "Add from URL": "URLから追加",
  "Configure on the addon's setup page": "アドオンの設定ページで設定",
  "Click to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "クリックして{name}の設定ページを開きます。オプションを選び、表示されたインストールリンクをコピーして下に貼り付けると、アドオンが更新されます。",
  "Click to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "クリックしてHarbor内蔵ブラウザで{name}の設定ページを開きます。オプションを選んでください。ページ上の「インストール」をクリックすると、Harborがリンクを自動取得してアドオンを更新します。",
  "Open setup page": "設定ページを開く",
  'Heads-up: a few addons (like AIOStatus) don\'t pre-fill from the URL. If the form loads blank, paste the existing manifest URL into their "Import from URL" field to restore your settings.':
    "注意: 一部のアドオン（AIOStatusなど）では、URLから設定が自動入力されません。フォームが空の場合は、既存のマニフェストURLを「URLからインポート」欄に貼り付けて設定を復元してください。",
  "Or paste the install link manually": "またはインストールリンクを手動で貼り付け",
  "Couldn't read that addon URL.": "そのアドオンURLを読み取れませんでした。",
  "Reading manifest": "マニフェストを読み込み中",
  "Reading new manifest": "新しいマニフェストを読み込み中",
  "Saving to library": "ライブラリに保存中",
  "Swapping configuration": "設定を差し替え中",
  "Syncing to Stremio": "Stremioと同期中",
  "Looks like a re-configure of {name}. We'll replace the existing entry so you don't end up with two copies.":
    "{name}の再設定のようです。重複しないよう、既存の項目を置き換えます。",
  "Updating {name}": "{name}を更新中",
  "Installing {name}": "{name}をインストール中",
  "Hang tight, won't be a sec.": "すぐに完了します。",
  "is now using your new configuration.": "に新しい設定が適用されました。",
  "is ready. Open Discover or hit Play on a title to use it.":
    "の準備ができました。「見つける」を開くか、作品の「再生」を押してご利用ください。",
  "Rate on stremio-addons.net": "stremio-addons.netで評価",
  "Opening stremio-addons.net in your browser to sign in and rate":
    "ログインして評価するため、ブラウザでstremio-addons.netを開いています",
  "Rising · +{n} star in 24h": "急上昇 · 24時間で星+{n}個",
  "Rising · +{n} stars in 24h": "急上昇 · 24時間で星+{n}個",
  "Configure & install": "設定してインストール",
  "Install default": "デフォルト設定でインストール",
  "Stremio link copied": "Stremioリンクをコピーしました",
  "Manifest URL copied": "マニフェストURLをコピーしました",
  "Couldn't copy. Select the URL manually.":
    "コピーできませんでした。URLを手動で選択してください。",
  "stremio:// link": "stremio://リンク",
  "On Stremio-Addons": "Stremio-Addonsで見る",
  "Worth knowing": "知っておきたいこと",
  "Project information": "プロジェクト情報",
  "Pulled from manifest": "マニフェストから取得",
  "ID prefixes": "IDプレフィックス",
  "Manifest URL": "マニフェストURL",
  "Hide the full URL": "完全なURLを隠す",
  "URLs can carry debrid keys or tokens; reveal when you need to copy":
    "URLにはdebridキーやトークンが含まれる場合があります。コピーが必要なときだけ表示してください",
  "Hidden by default. Manifest paths often carry API keys (debrid tokens, OMDB keys, etc.) you don't want over a shoulder.":
    "デフォルトでは非表示です。マニフェストのパスにはAPIキー（debridトークン、OMDBキーなど）が含まれることが多いため、他人に見られないようにしてください。",
  "Stremio addon, packaged into Harbor's catalog.": "StremioアドオンをHarborのカタログに収録。",
  "Version and capabilities come straight from the addon's manifest. Ratings and categories come from the":
    "バージョンと機能はアドオンのマニフェストから直接取得されます。評価とカテゴリーは",
  "community API. Star, browse, and contribute on their site.":
    "コミュニティAPIから取得されます。サイトでスターを付けたり、閲覧したり、開発に参加したりできます。",
  "More like this": "類似作品",
  "Recommended for you": "あなたへのおすすめ",
  "Catalogs & metadata": "カタログとメタデータ",
  "From stremio-addons.net": "stremio-addons.netより",
  "Show full documentation": "ドキュメントをすべて表示",
  "View more": "もっと見る",
  "You've reached the end · {n} addons": "以上です・アドオン{n}件",
  "No velocity data yet": "伸び率データはまだありません",
  "Trending tracks star growth across your Harbor visits. Open the addons page again tomorrow and the top risers will appear here.":
    "トレンドでは、Harborを訪れるたびにスター数の伸びを記録します。明日もう一度アドオンページを開くと、急上昇中のアドオンがここに表示されます。",
  "Organize addons": "アドオンを並べ替える",
  "Back to addons": "アドオンに戻る",
  "This order drives your catalog rows and the default stream order. A stream priority set in Settings overrides it for streams.":
    "この並び順がカタログの行とデフォルトのストリーム順に反映されます。設定でストリームの優先順位を指定している場合は、そちらが優先されます。",
  "Save order": "並び順を保存",
  "Couldn't load your Stremio collection. Nothing can be reordered safely without it.":
    "Stremioコレクションを読み込めませんでした。安全に並べ替えるにはコレクションが必要です。",
  "Go back": "戻る",
  "Reload list": "リストを再読み込み",
  "Something unexpected went wrong. Nothing may have been written. Retry to re-check.":
    "予期しないエラーが発生しました。変更が書き込まれていない可能性があります。再試行して確認してください。",
  "Backed up. The current account order is saved in the Backups panel.":
    "バックアップしました。現在のアカウントの並び順は「バックアップ」パネルに保存されています。",
  "Backup loaded into the editor. Addons added since stay at the end. Nothing changes until you press Save.":
    "バックアップをエディターに読み込みました。その後追加されたアドオンは末尾に残ります。「保存」を押すまで変更は反映されません。",
  "Your Stremio account": "Stremioアカウント",
  "This order syncs to every Stremio app signed into this account.":
    "この並び順は、このアカウントでログインしているすべてのStremioアプリに同期されます。",
  "No addons are synced to this account yet.":
    "このアカウントにはまだアドオンが同期されていません。",
  "On this device only": "このデバイスのみ",
  "These live in Harbor on this computer and never touch your account.":
    "これらはこのパソコンのHarbor内に保存され、アカウントには一切反映されません。",
  "On this device": "このデバイス上",
  "Sign in to Stremio to organize the addons synced to your account.":
    "アカウントに同期されたアドオンを並べ替えるには、Stremioにログインしてください。",
  "Good to know": "知っておきたいこと",
  "Number 1 answers first when you press Play, unless Settings has a stream priority.":
    "再生を押すと、1番のアドオンが最初にストリームを返します。ただし、設定でストリームの優先順位を指定している場合はそちらが優先されます。",
  "The order also decides which addon's rows win on your Home screen.":
    "この並び順によって、ホーム画面でどのアドオンの行が優先表示されるかも決まります。",
  "Nothing changes until you press Save. Leaving this page discards edits.":
    "「保存」を押すまで変更は反映されません。このページを離れると編集内容は破棄されます。",
  "The Backups button at the top keeps your last five orders. One click restores any of them.":
    "上部の「バックアップ」ボタンには、直近5件の並び順が保存されます。どれでもワンクリックで復元できます。",
  "Harbor double-checks with Stremio after saving, so a half-written order can't slip through.":
    "保存後にHarborがStremioでも再確認するため、並び順が不完全な状態で保存されることはありません。",
  "{n} addon": "{n}個のアドオン",
  "{n} addons": "{n}個のアドオン",
  "Drag to reorder": "ドラッグして並べ替え",
  "Move to top": "一番上へ移動",
  "Couldn't save: the reordered list failed safety validation. Nothing was written.":
    "保存できませんでした。並べ替えたリストが安全性チェックに合格しなかったため、何も書き込まれていません。",
  "Couldn't reach Stremio to confirm your collection. Nothing was written.":
    "コレクションを確認するためStremioに接続できませんでした。何も書き込まれていません。",
  "Your addon collection changed on another device. Nothing was written.":
    "別のデバイスでアドオンコレクションが変更されました。何も書き込まれていません。",
  "Stremio didn't confirm the save. Your collection may be unchanged. Retry will re-check before writing again.":
    "Stremioで保存を確認できませんでした。コレクションは変更されていない可能性があります。再試行すると、もう一度書き込む前に再確認します。",
  "Saved, but Harbor couldn't confirm the new order. Retry to re-check.":
    "保存しましたが、Harborで新しい並び順を確認できませんでした。再試行して確認してください。",
  "Stremio reports a different order than was saved.":
    "Stremioで確認された並び順が、保存した並び順と異なります。",
  "A safety copy of your addon order. One is saved automatically before Harbor writes any change, and you can save one yourself any time. The five most recent are kept.":
    "アドオンの並び順を保護するためのバックアップです。Harborが変更を書き込む前に自動で保存され、いつでも手動で保存できます。直近5件が保持されます。",
  "Back up current order": "現在の並び順をバックアップ",
  "No backups yet. Press the button above to save your first one.":
    "バックアップはまだありません。上のボタンを押して最初のバックアップを保存してください。",
  "{names} +{n} more": "{names}、ほか{n}件",
  "Copy URL": "URLをコピー",
  "Try again": "再試行",
  "Show less": "折りたたむ",
  "Move up": "上へ移動",
  "Move down": "下へ移動",
  "See all ({n})": "すべて表示（{n}）",
  "Loading…": "読み込み中…",
  "Untitled addon": "名称未設定のアドオン",
  "Paste manifest URL or stremio:// link": "マニフェストURLまたはstremio://リンクを貼り付け",
  "Install from URL: paste any manifest or stremio:// link":
    "URLからインストール: マニフェストURLまたはstremio://リンクを貼り付け",
  "Click below to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "下をクリックして{name}の設定ページを開きます。オプションを選び、表示されたインストールリンクをコピーして下に貼り付けると、アドオンを更新できます。",
  "Click below to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "下をクリックして、Harborの内蔵ブラウザで{name}の設定ページを開きます。オプションを選んでください。そのページで「インストール」をクリックすると、Harborがリンクを自動的に取得してアドオンを更新します。",
  "Essential addons": "必須アドオン",
  "Start here. The ones almost everyone has.":
    "まずはこちら。ほとんどの人が使っているアドオンです。",
  "Best for debrid": "debridに最適",
  "Cached on Real-Debrid, TorBox, AllDebrid. Instant play.":
    "Real-Debrid、TorBox、AllDebridにキャッシュ済み。すぐに再生できます。",
  "Free torrent + usenet": "無料のトレント + Usenet",
  "No subscription needed. Quality varies.":
    "サブスクリプションは不要です。品質にはばらつきがあります。",
  "Anime done right": "アニメを快適に",
  "Kitsu IDs, fansub-friendly, season-aware.":
    "Kitsu ID対応、ファンサブ対応、シーズンも正確に認識。",
  "Proper search across providers, foreign-language coverage.":
    "複数のプロバイダーを横断して高精度に検索。外国語コンテンツにも対応。",
  "Better posters, ratings, episode info.": "より高品質なポスター、評価、エピソード情報。",
  "Sports & live TV": "スポーツとライブTV",
  "Live streams that actually work.": "確実に再生できるライブ配信。",
  "Power tools": "上級者向けツール",
  "Quality-of-life upgrades. Sync, ratings, trailers.": "さらに便利に。同期、評価、予告編に対応。",
  "NSFW. Hidden until enabled.": "NSFW。有効にするまで非表示です。",
};

export default addons;
