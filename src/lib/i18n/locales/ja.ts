import jlDesktop026 from "./ja/jl-desktop-026";
import playOrders from "./ja/play-orders";
import gameRomLibrary from "./ja/game-rom-library";
import gameNotes from "./ja/game-notes";
import gameLibraryRefinements from "./ja/game-library-refinements";
import gamePokemonUi from "./ja/game-pokemon-ui";
import customArtwork from "./ja/custom-artwork";
import gameAtlasDiscovery from "./ja/game-atlas-discovery";
import gameDiscoveryPicker from "./ja/game-discovery-picker";
import gameLibraryManagement from "./ja/game-library-management";
import gameHydraImport from "./ja/game-hydra-import";
import gameStudioCatalog from "./ja/game-studio-catalog";
import gameArtwork from "./ja/game-artwork";
import gameCommunity from "./ja/game-community";
import gameMetadataMatching from "./ja/game-metadata-matching";
import gameAgeRatings from "./ja/game-age-ratings";
import gameLibraryLinks from "./ja/game-library-links";
import gameModHub from "./ja/game-mod-hub";
import gameLibraryTitles from "./ja/game-library-titles";
import gameStoreSearch from "./ja/game-store-search";
import gameSteamShortcuts from "./ja/game-steam-shortcuts";
import gameGallery from "./ja/game-gallery";
import gameStardew from "./ja/game-stardew";
import gamePokemon from "./ja/game-pokemon";
import gameSourceAlerts from "./ja/game-source-alerts";
import gameSims from "./ja/game-sims";
import gameTarkov from "./ja/game-tarkov";
import gameTft from "./ja/game-tft";
import gameEve from "./ja/game-eve";
import gameOsrs from "./ja/game-osrs";
import gameFfxiv from "./ja/game-ffxiv";
import gameFortnite from "./ja/game-fortnite";
import gameSetup from "./ja/game-setup";
import torrentDialog from "./ja/torrent-dialog";
import gameDownloadNotifications from "./ja/game-download-notifications";
import gameDownloadCenter from "./ja/game-download-center";
import warhammerUniverse from "./ja/warhammer-universe";
import gameLeague from "./ja/game-league";
import gameValorant from "./ja/game-valorant";
import gameAudience from "./ja/game-audience";
import gameDetailFlow from "./ja/game-detail-flow";
import gameWowTalents from "./ja/game-wow-talents";
import gameWowProgress from "./ja/game-wow-progress";
import gameWowRuns from "./ja/game-wow-runs";
import gameMediaRelations from "./ja/game-media-relations";
import gameDota from "./ja/game-dota";
import gameOverwatch from "./ja/game-overwatch";
import gameWowEquipment from "./ja/game-wow-equipment";
import gameRecommendations from "./ja/game-recommendations";
import gameOwnedDiscovery from "./ja/game-owned-discovery";
import gameBackups from "./ja/game-backups";
import gameArchives from "./ja/game-archives";
import gameUnifiedLibrary from "./ja/game-unified-library";
import gamePlaytime from "./ja/game-playtime";
import gameLaunchHealth from "./ja/game-launch-health";
import gameSourceDiscovery from "./ja/game-source-discovery";
import gameGuides from "./ja/game-guides";
import gameModUpdates from "./ja/game-mod-updates";
import gameMinecraft from "./ja/game-minecraft";
import gameRoms from "./ja/game-roms";
import gameExploreRows from "./ja/game-explore-rows";
import gameHackDiscovery from "./ja/game-hack-discovery";
import gameHub from "./ja/game-hub";
import gameRetro from "./ja/game-retro";
import floatingPlayer from "./ja/floating-player";
import gameAntiCheat from "./ja/game-anti-cheat";
import gameDock from "./ja/game-dock";
import gameCompanion from "./ja/game-companion";
import gameWow from "./ja/game-wow";
import gameSearch from "./ja/game-search";
import mediaStart from "./ja/media-start";
import spooktober from "./ja/spooktober";
import listenTogether from "./ja/listen-together";
import music from "./ja/music";
import sportsConsent from "./ja/sports-consent";
import sportsStatistics from "./ja/sports-statistics";
import sportsApi from "./ja/sports-api";
import esportsArena from "./ja/esports-arena";
import sportsHub from "./ja/sports-hub";
import ebookSources from "./ja/ebook-sources";
import settingsRefinements from "./ja/settings-refinements";
import addons from "./ja/addons";
import appFill from "./ja/app-fill";
import awards from "./ja/awards";
import bpSources from "./ja/bp-sources";
import catalog from "./ja/catalog";
import chrome from "./ja/chrome";
import common from "./ja/common";
import controllers from "./ja/controllers";
import coverage from "./ja/coverage";
import detail from "./ja/detail";
import discover from "./ja/discover";
import downloads from "./ja/downloads";
import extra from "./ja/extra";
import gap from "./ja/gap";
import library from "./ja/library";
import lists from "./ja/lists";
import live from "./ja/live";
import manga from "./ja/manga";
import masthead from "./ja/masthead";
import misc from "./ja/misc";
import player from "./ja/player";
import plurals from "./ja/plurals";
import profileFill from "./ja/profile-fill";
import rails from "./ja/rails";
import settingsFill from "./ja/settings-fill";
import settings from "./ja/settings";
import spotlights from "./ja/spotlights";
import sweep from "./ja/sweep";
import sync from "./ja/sync";
import together from "./ja/together";
import used from "./ja/used";
import questions from "./ja/questions";
import wired from "./ja/wired";
import plugins from "./ja/plugins";
import brands from "./ja/brands";
import bpSports from "./ja/bp-sports";

import nytTv from "./ja/nyt-tv";

import gameAchievements from "./ja/game-achievements";

const ja: Record<string, string> = {
  "collections.feed.more": "コレクションをさらに読み込む",
  "collections.feed.error": "コレクションを読み込めませんでした。もう一度お試しください。",
  "Show content ratings?": "コンテンツのレーティングを表示しますか？",
  "Age ratings and content notes when playback starts.":
    "再生開始時に年齢区分と内容に関する注意を表示します。",
  ...gameCommunity,
  ...gamePokemon,
  ...torrentDialog,
  "nav.games": "ゲーム",
  "games.explore": "見つける",
  "games.library": "ライブラリ",
  "games.saved": "お気に入り",
  "games.download.nav": "ダウンロード",
  "games.search": "ゲームを検索",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  Translations: "翻訳",
  "Translating…": "翻訳中…",
  "Showing {lang}": "{lang}を表示中",
  "Show all": "すべて表示",
  "games.download.speed.title": "ダウンロード速度",
  "games.download.speed.note":
    "このプロフィールの直接ダウンロードとトレント全体で共有されます。個別のトレントには、これより低い制限を設定できます。",
  "games.download.speed.unlimited": "無制限",
  "games.download.speed.limited": "速度を制限",
  "games.download.speed.rate": "キロバイト毎秒",
  "games.download.speed.range": "{min} から {max} までの整数を入力してください。",
  "games.download.speed.error":
    "速度設定を読み込むか保存できませんでした。もう一度お試しください。",
  "games.download.speed.current": "ファイルのダウンロード速度: {rate}",
  "games.discovery.sale.cards.included": "トレーディングカード",
  "games.discovery.sale.cards.none": "セールカードなし",
  "games.discovery.sale.cards.unknown": "カードは未確認",
  "games.discovery.sale.cards.includedNote":
    "Steamの現行のセールカード規則では対象です。入手条件はSteamで確認してください。",
  "games.discovery.sale.cards.noneNote":
    "Steamの現行の規則では、この季節のセールはトレーディングカードの対象外です。他のイベント報酬は別扱いです。",
  "games.discovery.sale.cards.unknownNote":
    "Steamの現行のカード規則を確認できませんでした。提供状況はSteamで確認してください。",
  "games.discovery.sale.cards.badgeNote":
    "セットを集めると、セールバッジ、絵文字、プロフィール背景を作成できます。",
  "games.download.storage.title": "ダウンロード容量",
  "games.download.storage.note":
    "直接ダウンロード、トレント、一時ファイルの必要容量を推定します。一時停止中のダウンロードも含みます。外部インストーラーは含みません。",
  "games.download.storage.error": "ストレージを確認できませんでした。",
  "games.download.storage.unavailable": "空き容量を取得できません",
  "games.download.storage.free": "空き容量：{size}",
  "games.download.storage.remaining": "追加の空き容量：{size}",
  "games.download.storage.estimate":
    "まだ確認していない既存ファイルがあります。実際に必要な空き容量は少ない場合があります。",
  "games.download.storage.unknown": "サイズ不明：{count}ファイル",
  "games.download.storage.other": "他のHarborの処理用に{size}を確保",
  "games.download.storage.shortfall": "あと{size}の空き容量が必要",
  "games.download.state.retrying": "接続を再試行中",
  "games.download.queueOrder": "キューの順番：{position}",
  "games.download.earlier": "{name}を前に移動",
  "games.download.later": "{name}を後ろに移動",
  ...gameAchievements,
  ...gameSearch,
  ...gameDock,
  ...gameCompanion,
  ...gameFortnite,
  ...gameFfxiv,
  ...gameOsrs,
  ...gameTarkov,
  ...gameModHub,
  ...gameSims,
  ...gameStardew,
  ...gameTft,
  ...gameEve,
  ...warhammerUniverse,
  ...gameWow,
  "games.selection.partial":
    "{total}本中{count}本を更新しました。残りのゲームは選択されたままです。もう一度お試しください。",
  "games.selection.failed": "選択したゲームを更新できませんでした。もう一度お試しください。",
  "games.custom.nav": "ローカルゲーム",
  "games.libraryPersonal.visibility": "ライブラリの表示対象",
  "games.libraryPersonal.visible": "あなたのゲーム",
  "games.libraryPersonal.pinned": "ピン留め済み",
  "games.libraryPersonal.hidden": "非表示",
  "games.library.sort": "ライブラリの並べ替え",
  "games.selection.start": "選択",
  "games.selection.game": "{name}を選択",
  "games.selection.actions": "選択したゲームの操作",
  "games.selection.count": "{count}件選択中",
  "games.selection.clear": "選択を解除",
  "games.selection.all": "すべて選択（{count}件）",
  "games.selection.pinned": "ピン留めしたゲーム：{count}件。",
  "games.selection.unpinned": "ピン留めを解除したゲーム：{count}件。",
  "games.selection.hidden": "非表示にしたゲーム：{count}件。「非表示」から確認できます。",
  "games.selection.shown": "ライブラリに表示したゲーム：{count}件。",
  "games.selection.show": "ライブラリに表示",
  "games.selection.hide": "非表示",
  "games.selection.pin": "ピン留め",
  "games.selection.unpin": "ピン留めを解除",
  "games.selection.matchNote":
    "選択したゲームの一部を利用できません。ライブラリを更新して、もう一度お試しください。",
  "games.selection.collection": "コレクションに追加",
  "games.collections.localMissing": "このプロフィールのライブラリにはもうありません",
  "games.collections.dynamic": "絞り込み条件によるコレクション",
  "games.collections.manual": "ゲームを自分で選ぶ",
  "games.collections.type": "コレクションの種類",
  "games.collections.filters": "コレクションの絞り込み条件",
  "games.collections.ruleQuery": "ゲームタイトルに含む文字",
  "games.collections.autoNote":
    "ライブラリのゲームが条件に一致するかどうかに応じて、このコレクションへの追加や削除が自動で行われます。",
  "games.collections.pickerAutoNote":
    "絞り込み条件によるコレクションは自動更新されます。「コレクション」で条件を管理してください。",
  "games.collections.matches": "条件に一致するゲーム：{count}本",
  "games.collections.emptyDynamic":
    "この条件に一致するゲームはライブラリにありません。条件を変更するか、ライブラリにゲームを追加してください。",
  "games.collections.collections_rules":
    "このコレクションの絞り込み条件を読み取れませんでした。保存済みのデータは置き換えていません。",
  "games.collections.collections_dynamic":
    "このコレクションは自動更新されます。表示されるゲームを変更するには、「コレクション」で絞り込み条件を変更してください。",
  "games.collections.title": "コレクション",
  "games.collections.personal": "あなたが作成",
  "games.collections.note":
    "どんなゲームにも居場所を。お気に入り、これから遊びたいゲーム、また訪れたい世界をまとめましょう。",
  "games.collections.addTo": "コレクションに追加",
  "games.collections.count": "{count}本のゲーム",
  "games.collections.one": "1本のゲーム",
  "games.collections.search": "コレクションを検索",
  "games.collections.name": "コレクション名",
  "games.collections.newName": "新しいコレクションに名前を付ける",
  "games.collections.create": "作成",
  "games.collections.first": "最初のコレクションをここから始めましょう。",
  "games.collections.noMatches": "一致するコレクションはありません。",
  "games.collections.pickerNote": "いくつでも選べます。変更はその都度保存されます。",
  "games.collections.empty": "次に夢中になるゲームのための場所。",
  "games.collections.findGames": "ゲームを探す",
  "games.collections.description": "簡単な紹介",
  "games.collections.edit": "コレクションを編集",
  "games.collections.pin": "コレクションをピン留め",
  "games.collections.unpin": "コレクションのピン留めを解除",
  "games.collections.remove": "コレクションを削除",
  "games.collections.removeNote":
    "このコレクションだけが削除されます。ゲーム、セーブデータ、ダウンロード、ほかのコレクションはそのまま残ります。",
  "games.collections.confirmRemove": "このコレクションを削除",
  "games.collections.removeGame": "このコレクションから{name}を削除",
  "games.collections.removeShort": "コレクションから削除",
  "games.collections.added": "追加した順（新しい順）",
  "games.collections.done": "完了",
  "games.collections.save": "変更を保存",
  "games.collections.collections_name":
    "コレクション名は1～80文字、説明は240文字以内で入力してください。",
  "games.collections.collections_duplicate": "同じ名前のコレクションがすでにあります。",
  "games.collections.collections_limit":
    "このプロフィールのコレクション保存容量が上限に達しました。使っていないコレクションやゲームを削除して、もう一度お試しください。",
  "games.collections.collections_missing":
    "このコレクションは削除されました。別のコレクションを選んでください。",
  "games.collections.collections_read":
    "コレクションを読み取れませんでした。保存済みのデータは置き換えていません。もう一度読み込んでください。",
  "games.collections.collections_write":
    "変更を保存できませんでした。変更前のコレクションは残っています。デバイスの空き容量を増やして、もう一度お試しください。",
  "games.collections.collections_game":
    "このゲームを識別できませんでした。ライブラリを更新して、もう一度お試しください。",
  "games.collections.firstNote":
    "コレクションを作成し、ゲームの詳細ページから追加するか、ライブラリでゲームを選択しましょう。PCゲームとROMを一緒にまとめられます。",
  "games.collections.emptyNote":
    "ゲームの詳細ページから追加するか、ライブラリでゲームを選択して「コレクションに追加」を選んでください。",
  "games.cache.saved": "保存済みデータ · {date}",
  "games.cache.refresh": "更新",
  "games.cache.refreshing": "更新中…",
  "games.cache.price": "現在の価格はSteamで確認してください。",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...coverage,
  ...sweep,
  ...wired,
  ...gap,
  ...appFill,
  ...profileFill,
  ...settingsFill,
  ...used,
  ...extra,
  ...addons,
  ...awards,
  ...bpSources,
  ...catalog,
  ...chrome,
  ...common,
  ...controllers,
  ...detail,
  ...discover,
  ...downloads,
  ...library,
  ...lists,
  ...live,
  ...manga,
  ...masthead,
  ...misc,
  ...player,
  ...plurals,
  ...rails,
  ...settings,
  ...spotlights,
  ...sync,
  ...together,
  ...questions,
  ...settingsRefinements,
  ...plugins,
  ...brands,
  ...sportsHub,
  ...sportsConsent,
  ...sportsStatistics,
  ...sportsApi,
  ...esportsArena,
  ...bpSports,
  ...listenTogether,
  ...nytTv,
  ...gameRetro,
  ...gameHackDiscovery,
  ...gameStudioCatalog,
  ...gameDiscoveryPicker,
  ...gameLibraryManagement,
  ...gameAtlasDiscovery,
  ...gameRoms,
  ...gameDetailFlow,
  ...gameExploreRows,
  ...gameSourceDiscovery,
  ...gameDownloadCenter,
  ...gameDownloadNotifications,
  ...gameSourceAlerts,
  ...gameModUpdates,
  ...gameMinecraft,
  ...gameGuides,
  ...gameMediaRelations,
  ...gameRecommendations,
  ...gameOverwatch,
  ...gameValorant,
  ...gameDota,
  ...gameLeague,
  ...gameWowEquipment,
  ...gameWowTalents,
  ...gameWowProgress,
  ...gameWowRuns,
  ...gameOwnedDiscovery,
  ...gameBackups,
  ...gameArchives,
  ...gameSetup,
  ...gameHydraImport,
  ...gameSteamShortcuts,
  ...gameGallery,
  ...gameAgeRatings,
  ...gameMetadataMatching,
  ...gameArtwork,
  ...gameUnifiedLibrary,
  ...gameStoreSearch,
  ...gameLibraryTitles,
  ...gameLibraryLinks,
  ...gamePlaytime,
  ...gameLaunchHealth,
  "games.torrent.share.title": "トレントを共有",
  "games.torrent.share.note":
    "検証済みファイルをピアと共有します。いずれかの上限に達するかHarborを閉じると停止します。ファイルを変更する前に共有を停止してください。",
  "games.torrent.share.upload": "アップロード上限（KB/秒）",
  "games.torrent.share.ratio": "共有比率（1～10）",
  "games.torrent.share.minutes": "制限時間（分）",
  "games.torrent.share.start": "共有を開始",
  "games.torrent.share.stop": "共有を停止",
  "games.torrent.share.resume": "共有を再開",
  "games.torrent.share.checking": "共有ファイルを確認中",
  "games.torrent.share.seeding": "共有中",
  "games.torrent.share.stopped": "共有停止",
  "games.torrent.share.limitReached": "共有上限に到達",
  "games.torrent.share.failed": "共有できませんでした。ファイルを確認して再試行してください。",
  "games.torrent.share.stats": "送信済み {uploaded} · {minutes} 分",
  "games.torrent.torrent_seed_files":
    "完了したファイルが見つからないか、変更または使用されています。共有前にダウンロードフォルダーを確認してください。",
  "games.torrent.torrent_seed_limits":
    "32～1,048,576 KB/秒、比率1～10、時間1～1,440分を選択してください。",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default ja;
import videoCast from "./ja/video-cast";
