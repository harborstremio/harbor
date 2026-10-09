import jlDesktop026 from "./vi/jl-desktop-026";
import playOrders from "./vi/play-orders";
import gameRomLibrary from "./vi/game-rom-library";
import gameNotes from "./vi/game-notes";
import gameLibraryRefinements from "./vi/game-library-refinements";
import gamePokemonUi from "./vi/game-pokemon-ui";
import customArtwork from "./vi/custom-artwork";
import gameAtlasDiscovery from "./vi/game-atlas-discovery";
import gameDiscoveryPicker from "./vi/game-discovery-picker";
import gameLibraryManagement from "./vi/game-library-management";
import gameHydraImport from "./vi/game-hydra-import";
import gameStudioCatalog from "./vi/game-studio-catalog";
import gameArtwork from "./vi/game-artwork";
import gameCommunity from "./vi/game-community";
import gameMetadataMatching from "./vi/game-metadata-matching";
import gameAgeRatings from "./vi/game-age-ratings";
import gameLibraryLinks from "./vi/game-library-links";
import gameModHub from "./vi/game-mod-hub";
import gameLibraryTitles from "./vi/game-library-titles";
import gameStoreSearch from "./vi/game-store-search";
import gameSteamShortcuts from "./vi/game-steam-shortcuts";
import gameGallery from "./vi/game-gallery";
import gameStardew from "./vi/game-stardew";
import gameSourceAlerts from "./vi/game-source-alerts";
import gameSims from "./vi/game-sims";
import gameTarkov from "./vi/game-tarkov";
import gameTft from "./vi/game-tft";
import gameEve from "./vi/game-eve";
import gameOsrs from "./vi/game-osrs";
import gameFfxiv from "./vi/game-ffxiv";
import gameFortnite from "./vi/game-fortnite";
import gameSetup from "./vi/game-setup";
import torrentDialog from "./vi/torrent-dialog";
import gameDownloadNotifications from "./vi/game-download-notifications";
import gameDownloadCenter from "./vi/game-download-center";
import warhammerUniverse from "./vi/warhammer-universe";
import gameLeague from "./vi/game-league";
import gameValorant from "./vi/game-valorant";
import gameAudience from "./vi/game-audience";
import gameDetailFlow from "./vi/game-detail-flow";
import gameWowTalents from "./vi/game-wow-talents";
import gameWowProgress from "./vi/game-wow-progress";
import gameWowRuns from "./vi/game-wow-runs";
import gameMediaRelations from "./vi/game-media-relations";
import gameDota from "./vi/game-dota";
import gameOverwatch from "./vi/game-overwatch";
import gameWowEquipment from "./vi/game-wow-equipment";
import gameRecommendations from "./vi/game-recommendations";
import gameOwnedDiscovery from "./vi/game-owned-discovery";
import gameBackups from "./vi/game-backups";
import gameArchives from "./vi/game-archives";
import gameUnifiedLibrary from "./vi/game-unified-library";
import gamePlaytime from "./vi/game-playtime";
import gameLaunchHealth from "./vi/game-launch-health";
import gameSourceDiscovery from "./vi/game-source-discovery";
import gameGuides from "./vi/game-guides";
import gameModUpdates from "./vi/game-mod-updates";
import gameMinecraft from "./vi/game-minecraft";
import gameRoms from "./vi/game-roms";
import gameExploreRows from "./vi/game-explore-rows";
import gameHackDiscovery from "./vi/game-hack-discovery";
import gameHub from "./vi/game-hub";
import gameRetro from "./vi/game-retro";
import floatingPlayer from "./vi/floating-player";
import gameAntiCheat from "./vi/game-anti-cheat";
import gameDock from "./vi/game-dock";
import gameCompanion from "./vi/game-companion";
import gameWow from "./vi/game-wow";
import gameSearch from "./vi/game-search";
import mediaStart from "./vi/media-start";
import spooktober from "./vi/spooktober";
import listenTogether from "./vi/listen-together";
import music from "./vi/music";
import sportsConsent from "./vi/sports-consent";
import sportsStatistics from "./vi/sports-statistics";
import sportsApi from "./vi/sports-api";
import esportsArena from "./vi/esports-arena";
import sportsHub from "./vi/sports-hub";
import ebookSources from "./vi/ebook-sources";
import settingsRefinements from "./vi/settings-refinements";
import coverage from "./vi/coverage";
import gap from "./vi/gap";
import plurals from "./vi/plurals";
import settingsFill from "./vi/settings-fill";
import profileFill from "./vi/profile-fill";
import appFill from "./vi/app-fill";
import used from "./vi/used";
import sweep from "./vi/sweep";
import sourceWiring from "./vi/source-wiring";
import residual from "./vi/residual";
import residualFinal from "./vi/residual-final";
import chrome from "./vi/chrome";
import common from "./vi/common";
import catalog from "./vi/catalog";
import detail from "./vi/detail";
import player from "./vi/player";
import live from "./vi/live";
import settings from "./vi/settings";
import library from "./vi/library";
import sync from "./vi/sync";
import lists from "./vi/lists";
import downloads from "./vi/downloads";
import together from "./vi/together";
import rails from "./vi/rails";
import masthead from "./vi/masthead";
import discover from "./vi/discover";
import spotlights from "./vi/spotlights";
import misc from "./vi/misc";
import awards from "./vi/awards";
import addons from "./vi/addons";
import extra from "./vi/extra";
import manga from "./vi/manga";
import controllers from "./vi/controllers";
import bpSources from "./vi/bp-sources";
import ageGate from "./vi/age-gate";
import plugins from "./vi/plugins";
import brands from "./vi/brands";
import bpSports from "./vi/bp-sports";

import nytTv from "./vi/nyt-tv";

import gameAchievements from "./vi/game-achievements";

const vi: Record<string, string> = {
  "collections.feed.more": "Tải thêm bộ sưu tập",
  "collections.feed.error": "Không tải được bộ sưu tập. Hãy thử lại.",
  "Show content ratings?": "Hiển thị phân loại nội dung?",
  "Age ratings and content notes when playback starts.":
    "Phân loại độ tuổi và lưu ý về nội dung khi bắt đầu phát.",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "Trò chơi",
  "games.explore": "Khám phá",
  "games.library": "Thư viện",
  "games.saved": "Yêu thích",
  "games.download.nav": "Tải xuống",
  "games.search": "Tìm trò chơi",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  Translations: "Bản dịch",
  "Translating…": "Đang dịch…",
  "Showing {lang}": "Đang hiển thị {lang}",
  "Show all": "Hiển thị tất cả",
  "games.download.speed.title": "Tốc độ tải xuống",
  "games.download.speed.note":
    "Dùng chung cho tải trực tiếp và torrent của hồ sơ này. Giới hạn riêng của một torrent có thể thấp hơn.",
  "games.download.speed.unlimited": "Không giới hạn",
  "games.download.speed.limited": "Giới hạn tốc độ",
  "games.download.speed.rate": "Kilobyte mỗi giây",
  "games.download.speed.range": "Nhập số nguyên từ {min} đến {max}.",
  "games.download.speed.error": "Không thể tải hoặc lưu cài đặt tốc độ. Vui lòng thử lại.",
  "games.download.speed.current": "Tốc độ tải tệp: {rate}",
  "games.discovery.sale.cards.included": "Thẻ sưu tầm",
  "games.discovery.sale.cards.none": "Không có thẻ đợt giảm giá",
  "games.discovery.sale.cards.unknown": "Thẻ chưa xác nhận",
  "games.discovery.sale.cards.includedNote":
    "Có theo quy định hiện hành của Steam về thẻ đợt giảm giá. Mở Steam để xem điều kiện nhận thẻ.",
  "games.discovery.sale.cards.noneNote":
    "Quy định hiện hành của Steam không có thẻ sưu tầm cho đợt giảm giá theo mùa này. Các phần thưởng sự kiện khác được tính riêng.",
  "games.discovery.sale.cards.unknownNote":
    "Không thể xác minh quy định hiện hành của Steam về thẻ. Mở Steam để kiểm tra tình trạng cung cấp.",
  "games.discovery.sale.cards.badgeNote":
    "Thu thập đủ một bộ để chế tạo huy hiệu đợt giảm giá, biểu tượng cảm xúc và nền hồ sơ.",
  "games.download.storage.title": "Dung lượng tải xuống",
  "games.download.storage.note":
    "Ước tính bao gồm tải trực tiếp, torrent và tệp tạm, kể cả các lượt tải đang tạm dừng. Không bao gồm trình cài đặt bên ngoài.",
  "games.download.storage.error": "Không thể kiểm tra dung lượng lưu trữ.",
  "games.download.storage.unavailable": "Không rõ dung lượng trống",
  "games.download.storage.free": "Còn trống {size}",
  "games.download.storage.remaining": "Dung lượng bổ sung: {size}",
  "games.download.storage.estimate":
    "Một số tệp hiện có chưa được kiểm tra. Dung lượng cần thiết có thể thấp hơn.",
  "games.download.storage.unknown": "Chưa rõ kích thước: {count} tệp",
  "games.download.storage.other": "Đã dành {size} cho tác vụ Harbor khác",
  "games.download.storage.shortfall": "Cần thêm {size} dung lượng",
  "games.download.state.retrying": "Đang thử kết nối lại",
  "games.download.queueOrder": "Thứ tự hàng đợi: {position}",
  "games.download.earlier": "Đưa {name} lên trước",
  "games.download.later": "Đưa {name} xuống sau",
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
    "Đã cập nhật {count} trên {total} trò chơi. Các trò chơi còn lại vẫn được chọn; hãy thử lại.",
  "games.selection.failed": "Không thể cập nhật các trò chơi đã chọn. Hãy thử lại.",
  "games.custom.nav": "Trò chơi cục bộ",
  "games.libraryPersonal.visibility": "Hiển thị trong thư viện",
  "games.libraryPersonal.visible": "Trò chơi của bạn",
  "games.libraryPersonal.pinned": "Đã ghim",
  "games.libraryPersonal.hidden": "Đã ẩn",
  "games.library.sort": "Sắp xếp thư viện",
  "games.selection.start": "Chọn",
  "games.selection.game": "Chọn {name}",
  "games.selection.actions": "Thao tác với trò chơi đã chọn",
  "games.selection.count": "Đã chọn {count}",
  "games.selection.clear": "Bỏ chọn",
  "games.selection.all": "Chọn tất cả ({count})",
  "games.selection.pinned": "Trò chơi đã ghim: {count}.",
  "games.selection.unpinned": "Trò chơi đã bỏ ghim: {count}.",
  "games.selection.hidden": "Trò chơi đã ẩn: {count}. Tìm trong mục Đã ẩn.",
  "games.selection.shown": "Trò chơi đã hiện trong thư viện: {count}.",
  "games.selection.show": "Hiện trong thư viện",
  "games.selection.hide": "Ẩn",
  "games.selection.pin": "Ghim",
  "games.selection.unpin": "Bỏ ghim",
  "games.selection.matchNote":
    "Một số trò chơi đã chọn không khả dụng. Hãy làm mới thư viện và thử lại.",
  "games.selection.collection": "Thêm vào bộ sưu tập",
  "games.collections.localMissing": "Không còn trong thư viện của hồ sơ này",
  "games.collections.dynamic": "Bộ sưu tập theo bộ lọc",
  "games.collections.manual": "Tự chọn trò chơi",
  "games.collections.type": "Loại bộ sưu tập",
  "games.collections.filters": "Bộ lọc của bộ sưu tập",
  "games.collections.ruleQuery": "Tên trò chơi chứa",
  "games.collections.autoNote":
    "Trò chơi tự động được thêm vào hoặc rời khỏi bộ sưu tập này tùy theo việc chúng có khớp với bộ lọc trong thư viện hay không.",
  "games.collections.pickerAutoNote":
    "Bộ sưu tập theo bộ lọc tự động cập nhật. Quản lý bộ lọc của chúng trong Bộ sưu tập.",
  "games.collections.matches": "Trò chơi phù hợp: {count}",
  "games.collections.emptyDynamic":
    "Không có trò chơi nào trong thư viện khớp với các bộ lọc này. Hãy đổi bộ lọc hoặc thêm trò chơi vào thư viện.",
  "games.collections.collections_rules":
    "Không thể đọc bộ lọc của bộ sưu tập này. Dữ liệu đã lưu chưa bị thay thế.",
  "games.collections.collections_dynamic":
    "Bộ sưu tập này tự động cập nhật. Hãy đổi bộ lọc trong Bộ sưu tập để thay đổi các trò chơi xuất hiện.",
  "games.collections.title": "Bộ sưu tập",
  "games.collections.personal": "Do bạn tạo",
  "games.collections.note":
    "Một nơi cho mọi loại trò chơi. Nhóm các trò yêu thích, những trò định chơi và những thế giới đáng quay lại.",
  "games.collections.addTo": "Thêm vào bộ sưu tập",
  "games.collections.count": "{count} trò chơi",
  "games.collections.one": "1 trò chơi",
  "games.collections.search": "Tìm trong bộ sưu tập của bạn",
  "games.collections.name": "Tên bộ sưu tập",
  "games.collections.newName": "Đặt tên bộ sưu tập mới",
  "games.collections.create": "Tạo",
  "games.collections.first": "Bộ sưu tập đầu tiên của bạn bắt đầu từ đây.",
  "games.collections.noMatches": "Không có bộ sưu tập phù hợp.",
  "games.collections.pickerNote": "Chọn bao nhiêu tùy thích. Thay đổi được lưu khi bạn chọn.",
  "games.collections.empty": "Chỗ dành cho niềm đam mê tiếp theo của bạn.",
  "games.collections.findGames": "Tìm trò chơi",
  "games.collections.description": "Vài lời giới thiệu",
  "games.collections.edit": "Chỉnh sửa bộ sưu tập",
  "games.collections.pin": "Ghim bộ sưu tập",
  "games.collections.unpin": "Bỏ ghim bộ sưu tập",
  "games.collections.remove": "Xóa bộ sưu tập",
  "games.collections.removeNote":
    "Chỉ bộ sưu tập này bị xóa. Trò chơi, bản lưu tiến trình, nội dung tải xuống và các bộ sưu tập khác của bạn vẫn được giữ nguyên.",
  "games.collections.confirmRemove": "Xóa bộ sưu tập này",
  "games.collections.removeGame": "Xóa {name} khỏi bộ sưu tập này",
  "games.collections.removeShort": "Xóa khỏi bộ sưu tập",
  "games.collections.added": "Thêm gần đây nhất trước",
  "games.collections.done": "Xong",
  "games.collections.save": "Lưu thay đổi",
  "games.collections.collections_name":
    "Đặt tên bộ sưu tập dài 1–80 ký tự và phần mô tả tối đa 240 ký tự.",
  "games.collections.collections_duplicate": "Bạn đã có một bộ sưu tập mang tên này.",
  "games.collections.collections_limit":
    "Hồ sơ này đã đạt giới hạn lưu trữ bộ sưu tập. Xóa bộ sưu tập hoặc trò chơi không dùng rồi thử lại.",
  "games.collections.collections_missing": "Bộ sưu tập này đã bị xóa. Hãy chọn bộ sưu tập khác.",
  "games.collections.collections_read":
    "Không thể đọc các bộ sưu tập của bạn. Dữ liệu đã lưu chưa bị thay thế. Hãy thử tải lại.",
  "games.collections.collections_write":
    "Không thể lưu thay đổi. Bộ sưu tập trước đó của bạn vẫn còn. Hãy giải phóng một ít dung lượng trên thiết bị rồi thử lại.",
  "games.collections.collections_game":
    "Không thể xác định trò chơi này. Hãy làm mới thư viện và thử lại.",
  "games.collections.firstNote":
    "Tạo một bộ sưu tập, rồi thêm trò chơi từ trang chi tiết hoặc chọn trò chơi trong thư viện. Trò chơi PC và ROM có thể ở cùng một bộ sưu tập.",
  "games.collections.emptyNote":
    "Thêm trò chơi từ trang chi tiết, hoặc chọn trò chơi trong thư viện và chọn Thêm vào bộ sưu tập.",
  "games.cache.saved": "Dữ liệu đã lưu · {date}",
  "games.cache.refresh": "Làm mới",
  "games.cache.refreshing": "Đang làm mới…",
  "games.cache.price": "Mở Steam để xem giá hiện tại.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...coverage,
  ...gap,
  ...plurals,
  ...settingsFill,
  ...profileFill,
  ...appFill,
  ...used,
  ...sweep,
  ...sourceWiring,
  ...residual,
  ...residualFinal,
  ...chrome,
  ...common,
  ...catalog,
  ...detail,
  ...player,
  ...live,
  ...settings,
  ...library,
  ...sync,
  ...lists,
  ...downloads,
  ...together,
  ...rails,
  ...masthead,
  ...discover,
  ...spotlights,
  ...misc,
  ...awards,
  ...addons,
  ...extra,
  ...manga,
  ...controllers,
  ...bpSources,
  ...ageGate,
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
  "games.torrent.share.title": "Chia sẻ torrent",
  "games.torrent.share.note":
    "Chia sẻ tệp đã xác minh với các máy ngang hàng. Dừng khi đạt một giới hạn hoặc đóng Harbor. Dừng chia sẻ trước khi thay đổi tệp.",
  "games.torrent.share.upload": "Giới hạn tải lên (KB/giây)",
  "games.torrent.share.ratio": "Tỷ lệ chia sẻ (1–10)",
  "games.torrent.share.minutes": "Giới hạn thời gian (phút)",
  "games.torrent.share.start": "Bắt đầu chia sẻ",
  "games.torrent.share.stop": "Dừng chia sẻ",
  "games.torrent.share.resume": "Tiếp tục chia sẻ",
  "games.torrent.share.checking": "Đang kiểm tra tệp",
  "games.torrent.share.seeding": "Đang chia sẻ",
  "games.torrent.share.stopped": "Đã dừng chia sẻ",
  "games.torrent.share.limitReached": "Đã đạt giới hạn",
  "games.torrent.share.failed": "Chia sẻ thất bại. Kiểm tra tệp và thử lại.",
  "games.torrent.share.stats": "Đã tải lên {uploaded} · {minutes} phút",
  "games.torrent.torrent_seed_files":
    "Tệp hoàn tất bị thiếu, đã thay đổi hoặc đang được sử dụng. Kiểm tra thư mục tải xuống trước khi chia sẻ.",
  "games.torrent.torrent_seed_limits":
    "Chọn 32–1.048.576 KB/giây, tỷ lệ 1–10 và thời gian 1–1.440 phút.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default vi;
import videoCast from "./vi/video-cast";
