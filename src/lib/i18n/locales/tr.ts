import jlDesktop026 from "./tr/jl-desktop-026";
import playOrders from "./tr/play-orders";
import gameRomLibrary from "./tr/game-rom-library";
import gameNotes from "./tr/game-notes";
import gameLibraryRefinements from "./tr/game-library-refinements";
import gamePokemonUi from "./tr/game-pokemon-ui";
import customArtwork from "./tr/custom-artwork";
import gameAtlasDiscovery from "./tr/game-atlas-discovery";
import gameDiscoveryPicker from "./tr/game-discovery-picker";
import gameLibraryManagement from "./tr/game-library-management";
import gameHydraImport from "./tr/game-hydra-import";
import gameStudioCatalog from "./tr/game-studio-catalog";
import gameArtwork from "./tr/game-artwork";
import gameCommunity from "./tr/game-community";
import gameMetadataMatching from "./tr/game-metadata-matching";
import gameAgeRatings from "./tr/game-age-ratings";
import gameLibraryLinks from "./tr/game-library-links";
import gameModHub from "./tr/game-mod-hub";
import gameLibraryTitles from "./tr/game-library-titles";
import gameStoreSearch from "./tr/game-store-search";
import gameSteamShortcuts from "./tr/game-steam-shortcuts";
import gameGallery from "./tr/game-gallery";
import gameStardew from "./tr/game-stardew";
import gameSourceAlerts from "./tr/game-source-alerts";
import gameSims from "./tr/game-sims";
import gameTarkov from "./tr/game-tarkov";
import gameTft from "./tr/game-tft";
import gameEve from "./tr/game-eve";
import gameOsrs from "./tr/game-osrs";
import gameFfxiv from "./tr/game-ffxiv";
import gameFortnite from "./tr/game-fortnite";
import gameSetup from "./tr/game-setup";
import torrentDialog from "./tr/torrent-dialog";
import gameDownloadNotifications from "./tr/game-download-notifications";
import gameDownloadCenter from "./tr/game-download-center";
import warhammerUniverse from "./tr/warhammer-universe";
import gameLeague from "./tr/game-league";
import gameValorant from "./tr/game-valorant";
import gameAudience from "./tr/game-audience";
import gameDetailFlow from "./tr/game-detail-flow";
import gameWowTalents from "./tr/game-wow-talents";
import gameWowProgress from "./tr/game-wow-progress";
import gameWowRuns from "./tr/game-wow-runs";
import gameMediaRelations from "./tr/game-media-relations";
import gameDota from "./tr/game-dota";
import gameOverwatch from "./tr/game-overwatch";
import gameWowEquipment from "./tr/game-wow-equipment";
import gameRecommendations from "./tr/game-recommendations";
import gameOwnedDiscovery from "./tr/game-owned-discovery";
import gameBackups from "./tr/game-backups";
import gameArchives from "./tr/game-archives";
import gameUnifiedLibrary from "./tr/game-unified-library";
import gamePlaytime from "./tr/game-playtime";
import gameLaunchHealth from "./tr/game-launch-health";
import gameSourceDiscovery from "./tr/game-source-discovery";
import gameGuides from "./tr/game-guides";
import gameModUpdates from "./tr/game-mod-updates";
import gameMinecraft from "./tr/game-minecraft";
import gameRoms from "./tr/game-roms";
import gameExploreRows from "./tr/game-explore-rows";
import gameHackDiscovery from "./tr/game-hack-discovery";
import gameHub from "./tr/game-hub";
import gameRetro from "./tr/game-retro";
import floatingPlayer from "./tr/floating-player";
import gameAntiCheat from "./tr/game-anti-cheat";
import gameDock from "./tr/game-dock";
import gameCompanion from "./tr/game-companion";
import gameWow from "./tr/game-wow";
import gameSearch from "./tr/game-search";
import mediaStart from "./tr/media-start";
import spooktober from "./tr/spooktober";
import listenTogether from "./tr/listen-together";
import music from "./tr/music";
import sportsConsent from "./tr/sports-consent";
import sportsStatistics from "./tr/sports-statistics";
import sportsApi from "./tr/sports-api";
import esportsArena from "./tr/esports-arena";
import sportsHub from "./tr/sports-hub";
import ebookSources from "./tr/ebook-sources";
import settingsRefinements from "./tr/settings-refinements";
import miscA from "./tr/misc-a";
import miscB from "./tr/misc-b";
import miscC from "./tr/misc-c";
import common from "./tr/common";
import playback from "./tr/playback";
import settings from "./tr/settings";
import personalization from "./tr/personalization";
import library from "./tr/library";
import social from "./tr/social";
import discovery from "./tr/discovery";
import addons from "./tr/addons";
import recent from "./tr/recent";
import residual from "./tr/residual";
import finalResidual from "./tr/final";
import coverage from "./tr/coverage";
import plugins from "./tr/plugins";
import brands from "./tr/brands";
import bpSports from "./tr/bp-sports";

import nytTv from "./tr/nyt-tv";

import gameAchievements from "./tr/game-achievements";

const tr: Record<string, string> = {
  "collections.feed.more": "Daha fazla koleksiyon yükle",
  "collections.feed.error": "Koleksiyonlar yüklenemedi. Tekrar deneyin.",
  "Show content ratings?": "İçerik derecelendirmeleri gösterilsin mi?",
  "Age ratings and content notes when playback starts.":
    "Oynatma başladığında yaş sınırları ve içerik uyarıları.",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "Oyunlar",
  "games.explore": "Keşfet",
  "games.library": "Kütüphane",
  "games.saved": "Favoriler",
  "games.download.nav": "İndirmeler",
  "games.search": "Oyun ara",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "Çeviriler",
  "Translating…": "Çevriliyor…",
  "Showing {lang}": "{lang} gösteriliyor",
  "Show all": "Tümünü göster",
  "games.download.speed.title": "İndirme hızı",
  "games.download.speed.note": "Bu profilin doğrudan indirmeleri ve torrentleri arasında paylaşılır. Bir torrentin kendi sınırı daha düşük olabilir.",
  "games.download.speed.unlimited": "Sınırsız",
  "games.download.speed.limited": "Hızı sınırla",
  "games.download.speed.rate": "Saniyede kilobayt",
  "games.download.speed.range": "{min} ile {max} arasında bir tam sayı girin.",
  "games.download.speed.error": "Hız ayarı yüklenemedi veya kaydedilemedi. Tekrar deneyin.",
  "games.download.speed.current": "Dosya indirme hızı: {rate}",
  "games.discovery.sale.cards.included": "Koleksiyon kartları",
  "games.discovery.sale.cards.none": "İndirim kartı yok",
  "games.discovery.sale.cards.unknown": "Kartlar doğrulanmadı",
  "games.discovery.sale.cards.includedNote": "Steam’in güncel indirim kartı kurallarına göre dahildir. Kazanma koşullarını görmek için Steam’i açın.",
  "games.discovery.sale.cards.noneNote": "Steam’in güncel kuralları bu mevsimsel indirim için koleksiyon kartlarını kapsamıyor. Diğer etkinlik ödülleri ayrıdır.",
  "games.discovery.sale.cards.unknownNote": "Steam’in güncel kart kuralları doğrulanamadı. Kullanılabilirliği kontrol etmek için Steam’i açın.",
  "games.discovery.sale.cards.badgeNote": "İndirim rozeti, ifade ve profil arka planı oluşturmak için bir set toplayın.",
  "games.download.storage.title": "İndirme alanı",
  "games.download.storage.note": "Tahminler, duraklatılmış indirmeler dahil doğrudan indirmeleri, torrentleri ve geçici dosyaları kapsar. Harici yükleyiciler dahil değildir.",
  "games.download.storage.error": "Depolama alanı kontrol edilemedi.",
  "games.download.storage.unavailable": "Boş alan bilgisi alınamadı",
  "games.download.storage.free": "{size} boş",
  "games.download.storage.remaining": "Ek alan: {size}",
  "games.download.storage.estimate": "Mevcut dosyaların bazıları henüz kontrol edilmedi. Gereken alan daha az olabilir.",
  "games.download.storage.unknown": "Boyutu bilinmeyen: {count} dosya",
  "games.download.storage.other": "Diğer Harbor işlemleri için {size} ayrıldı",
  "games.download.storage.shortfall": "{size} daha fazla alan gerekli",
  "games.download.state.retrying": "Bağlantı yeniden deneniyor",
  "games.download.queueOrder": "Kuyruk sırası: {position}",
  "games.download.earlier": "{name} öğesini öne taşı",
  "games.download.later": "{name} öğesini arkaya taşı",
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
  "games.selection.partial": "{total} oyundan {count} tanesi güncellendi. Kalan oyunlar hâlâ seçili; tekrar dene.",
  "games.selection.failed": "Seçilen oyunlar güncellenemedi. Tekrar dene.",
  "games.custom.nav": "Yerel oyunlar",
  "games.libraryPersonal.visibility": "Kitaplık görünürlüğü",
  "games.libraryPersonal.visible": "Oyunlarınız",
  "games.libraryPersonal.pinned": "Sabitlenenler",
  "games.libraryPersonal.hidden": "Gizli",
  "games.library.sort": "Kitaplığı sırala",
  "games.selection.start": "Seç",
  "games.selection.game": "{name} oyununu seç",
  "games.selection.actions": "Seçili oyun işlemleri",
  "games.selection.count": "{count} seçildi",
  "games.selection.clear": "Seçimi temizle",
  "games.selection.all": "Tümünü seç ({count})",
  "games.selection.pinned": "Sabitlenen oyunlar: {count}.",
  "games.selection.unpinned": "Sabitlemesi kaldırılan oyunlar: {count}.",
  "games.selection.hidden": "Gizlenen oyunlar: {count}. Gizli bölümünde bulabilirsiniz.",
  "games.selection.shown": "Kitaplığında gösterilen oyunlar: {count}.",
  "games.selection.show": "Kitaplıkta göster",
  "games.selection.hide": "Gizle",
  "games.selection.pin": "Sabitle",
  "games.selection.unpin": "Sabitlemeyi kaldır",
  "games.selection.matchNote": "Seçilen bazı oyunlar kullanılamıyor. Kitaplığınızı yenileyip tekrar deneyin.",
  "games.selection.collection": "Koleksiyona ekle",
  "games.collections.localMissing": "Artık bu profilin kitaplığında değil",
  "games.collections.dynamic": "Filtre tabanlı koleksiyon",
  "games.collections.manual": "Oyunları kendiniz seçin",
  "games.collections.type": "Koleksiyon türü",
  "games.collections.filters": "Koleksiyon filtreleri",
  "games.collections.ruleQuery": "Oyun başlığı şunu içerir",
  "games.collections.autoNote": "Oyunlar, kitaplığınızda bu koleksiyonun filtreleriyle eşleşmelerine göre koleksiyona otomatik olarak eklenir veya koleksiyondan çıkarılır.",
  "games.collections.pickerAutoNote": "Filtre tabanlı koleksiyonlar otomatik olarak güncellenir. Filtrelerini Koleksiyonlar bölümünden yönetin.",
  "games.collections.matches": "Eşleşen oyunlar: {count}",
  "games.collections.emptyDynamic": "Kitaplığınızdaki hiçbir oyun bu filtrelerle eşleşmiyor. Filtreleri değiştirin veya kitaplığınıza daha fazla oyun ekleyin.",
  "games.collections.collections_rules": "Bu koleksiyonun filtreleri okunamadı. Kayıtlı veriler değiştirilmedi.",
  "games.collections.collections_dynamic": "Bu koleksiyon otomatik olarak güncellenir. Görünen oyunları değiştirmek için Koleksiyonlar bölümünden filtrelerini değiştirin.",
  "games.collections.title": "Koleksiyonlar",
  "games.collections.personal": "Sizin oluşturduklarınız",
  "games.collections.note": "Her tür oyun için bir yer. Favorileri, daha sonra oynayacaklarınızı ve geri dönmeye değer dünyaları gruplandırın.",
  "games.collections.addTo": "Koleksiyona ekle",
  "games.collections.count": "{count} oyun",
  "games.collections.one": "1 oyun",
  "games.collections.search": "Koleksiyonlarınızda arayın",
  "games.collections.name": "Koleksiyon adı",
  "games.collections.newName": "Yeni koleksiyona ad verin",
  "games.collections.create": "Oluştur",
  "games.collections.first": "İlk koleksiyonunuz burada başlıyor.",
  "games.collections.noMatches": "Eşleşen koleksiyon yok.",
  "games.collections.pickerNote": "İstediğiniz kadar seçin. Değişiklikler seçim yaptıkça kaydedilir.",
  "games.collections.empty": "Bir sonraki tutkunuz için yer var.",
  "games.collections.findGames": "Oyun bul",
  "games.collections.description": "Hakkında birkaç söz",
  "games.collections.edit": "Koleksiyonu düzenle",
  "games.collections.pin": "Koleksiyonu sabitle",
  "games.collections.unpin": "Koleksiyonun sabitlemesini kaldır",
  "games.collections.remove": "Koleksiyonu kaldır",
  "games.collections.removeNote": "Yalnızca bu koleksiyon kaldırılır. Oyunlarınız, oyun kayıtlarınız, indirmeleriniz ve diğer koleksiyonlarınız olduğu gibi kalır.",
  "games.collections.confirmRemove": "Bu koleksiyonu kaldır",
  "games.collections.removeGame": "{name} oyununu bu koleksiyondan çıkar",
  "games.collections.removeShort": "Koleksiyondan çıkar",
  "games.collections.added": "Son eklenenler önce",
  "games.collections.done": "Bitti",
  "games.collections.save": "Değişiklikleri kaydet",
  "games.collections.collections_name": "Koleksiyona 1–80 karakterlik bir ad ve en fazla 240 karakterlik bir açıklama verin.",
  "games.collections.collections_duplicate": "Bu ada sahip bir koleksiyonunuz zaten var.",
  "games.collections.collections_limit": "Bu profil koleksiyon depolama sınırına ulaştı. Kullanılmayan koleksiyonları veya oyunları kaldırıp tekrar deneyin.",
  "games.collections.collections_missing": "Bu koleksiyon kaldırıldı. Başka bir koleksiyon seçin.",
  "games.collections.collections_read": "Koleksiyonlarınız okunamadı. Kayıtlı veriler değiştirilmedi. Yeniden yüklemeyi deneyin.",
  "games.collections.collections_write": "Değişiklik kaydedilemedi. Önceki koleksiyonunuz hâlâ burada. Cihazda biraz depolama alanı açıp tekrar deneyin.",
  "games.collections.collections_game": "Bu oyun tanımlanamadı. Kitaplığınızı yenileyip tekrar deneyin.",
  "games.collections.firstNote": "Bir koleksiyon oluşturun, ardından oyunları ayrıntı sayfalarından ekleyin veya kitaplığınızda seçin. PC oyunları ve ROM’lar bir arada bulunabilir.",
  "games.collections.emptyNote": "Oyunları ayrıntı sayfalarından ekleyin veya kitaplığınızda oyunları seçip Koleksiyona ekle seçeneğini kullanın.",
  "games.cache.saved": "Kaydedilen veriler · {date}",
  "games.cache.refresh": "Yenile",
  "games.cache.refreshing": "Yenileniyor…",
  "games.cache.price": "Güncel fiyatı görmek için Steam’i açın.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...miscA,
  ...miscB,
  ...miscC,
  ...common,
  ...playback,
  ...settings,
  ...personalization,
  ...library,
  ...social,
  ...discovery,
  ...addons,
  ...recent,
  ...residual,
  ...finalResidual,
  ...coverage,
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
  "games.torrent.share.title": "Torrenti paylaş",
  "games.torrent.share.note": "Doğrulanmış dosyaları eşlerle paylaş. Sınırlardan birine ulaşılınca veya Harbor kapanınca durur. Dosyaları değiştirmeden önce paylaşımı durdur.",
  "games.torrent.share.upload": "Yükleme sınırı (KB/sn)",
  "games.torrent.share.ratio": "Paylaşım oranı (1–10)",
  "games.torrent.share.minutes": "Süre sınırı (dakika)",
  "games.torrent.share.start": "Paylaşımı başlat",
  "games.torrent.share.stop": "Paylaşımı durdur",
  "games.torrent.share.resume": "Paylaşıma devam et",
  "games.torrent.share.checking": "Dosyalar denetleniyor",
  "games.torrent.share.seeding": "Paylaşılıyor",
  "games.torrent.share.stopped": "Paylaşım durdu",
  "games.torrent.share.limitReached": "Paylaşım sınırına ulaşıldı",
  "games.torrent.share.failed": "Paylaşım başarısız. Dosyaları denetleyip tekrar dene.",
  "games.torrent.share.stats": "{uploaded} yüklendi · {minutes} dk",
  "games.torrent.torrent_seed_files": "Tamamlanan dosyalar eksik, değiştirilmiş veya kullanımda. Paylaşmadan önce indirme klasörünü denetle.",
  "games.torrent.torrent_seed_limits": "32–1.048.576 KB/sn, 1–10 oran ve 1–1.440 dakika seç.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default tr;
import videoCast from "./tr/video-cast";
