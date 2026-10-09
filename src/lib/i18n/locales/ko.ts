import playOrders from "./ko/play-orders";
import gameRomLibrary from "./ko/game-rom-library";
import gameNotes from "./ko/game-notes";
import gameLibraryRefinements from "./ko/game-library-refinements";
import gamePokemonUi from "./ko/game-pokemon-ui";
import customArtwork from "./ko/custom-artwork";
import gameAtlasDiscovery from "./ko/game-atlas-discovery";
import gameDiscoveryPicker from "./ko/game-discovery-picker";
import gameLibraryManagement from "./ko/game-library-management";
import gameHydraImport from "./ko/game-hydra-import";
import gameStudioCatalog from "./ko/game-studio-catalog";
import gameArtwork from "./ko/game-artwork";
import gameCommunity from "./ko/game-community";
import gameMetadataMatching from "./ko/game-metadata-matching";
import gameAgeRatings from "./ko/game-age-ratings";
import gameLibraryLinks from "./ko/game-library-links";
import gameModHub from "./ko/game-mod-hub";
import gameLibraryTitles from "./ko/game-library-titles";
import gameStoreSearch from "./ko/game-store-search";
import gameSteamShortcuts from "./ko/game-steam-shortcuts";
import gameGallery from "./ko/game-gallery";
import gameStardew from "./ko/game-stardew";
import gameSourceAlerts from "./ko/game-source-alerts";
import gameSims from "./ko/game-sims";
import gameTarkov from "./ko/game-tarkov";
import gameTft from "./ko/game-tft";
import gameEve from "./ko/game-eve";
import gameOsrs from "./ko/game-osrs";
import gameFfxiv from "./ko/game-ffxiv";
import gameFortnite from "./ko/game-fortnite";
import gameSetup from "./ko/game-setup";
import torrentDialog from "./ko/torrent-dialog";
import gameDownloadNotifications from "./ko/game-download-notifications";
import gameDownloadCenter from "./ko/game-download-center";
import warhammerUniverse from "./ko/warhammer-universe";
import gameLeague from "./ko/game-league";
import gameValorant from "./ko/game-valorant";
import gameAudience from "./ko/game-audience";
import gameDetailFlow from "./ko/game-detail-flow";
import gameWowTalents from "./ko/game-wow-talents";
import gameWowProgress from "./ko/game-wow-progress";
import gameWowRuns from "./ko/game-wow-runs";
import gameMediaRelations from "./ko/game-media-relations";
import gameDota from "./ko/game-dota";
import gameOverwatch from "./ko/game-overwatch";
import gameWowEquipment from "./ko/game-wow-equipment";
import gameRecommendations from "./ko/game-recommendations";
import gameOwnedDiscovery from "./ko/game-owned-discovery";
import gameBackups from "./ko/game-backups";
import gameArchives from "./ko/game-archives";
import gameUnifiedLibrary from "./ko/game-unified-library";
import gamePlaytime from "./ko/game-playtime";
import gameLaunchHealth from "./ko/game-launch-health";
import gameSourceDiscovery from "./ko/game-source-discovery";
import gameGuides from "./ko/game-guides";
import gameModUpdates from "./ko/game-mod-updates";
import gameMinecraft from "./ko/game-minecraft";
import gameRoms from "./ko/game-roms";
import gameExploreRows from "./ko/game-explore-rows";
import gameHackDiscovery from "./ko/game-hack-discovery";
import gameHub from "./ko/game-hub";
import gameRetro from "./ko/game-retro";
import floatingPlayer from "./ko/floating-player";
import gameAntiCheat from "./ko/game-anti-cheat";
import gameDock from "./ko/game-dock";
import gameCompanion from "./ko/game-companion";
import gameWow from "./ko/game-wow";
import gameSearch from "./ko/game-search";
import mediaStart from "./ko/media-start";
import spooktober from "./ko/spooktober";
import listenTogether from "./ko/listen-together";
import music from "./ko/music";
import sportsConsent from "./ko/sports-consent";
import sportsStatistics from "./ko/sports-statistics";
import sportsApi from "./ko/sports-api";
import esportsArena from "./ko/esports-arena";
import sportsHub from "./ko/sports-hub";
import ebookSources from "./ko/ebook-sources";
import settingsRefinements from "./ko/settings-refinements";
import coverage from "./ko/coverage";
import catalog01 from "./ko/catalog-01";
import catalog02 from "./ko/catalog-02";
import catalog03 from "./ko/catalog-03";
import catalog04 from "./ko/catalog-04";
import catalog05 from "./ko/catalog-05";
import catalog06 from "./ko/catalog-06";
import catalog07 from "./ko/catalog-07";
import catalog08 from "./ko/catalog-08";
import catalog09 from "./ko/catalog-09";
import catalog10 from "./ko/catalog-10";
import catalog11 from "./ko/catalog-11";
import catalog12 from "./ko/catalog-12";
import catalog13 from "./ko/catalog-13";
import currentTail from "./ko/current-tail";
import plugins from "./ko/plugins";
import brands from "./ko/brands";
import bpSports from "./ko/bp-sports";

import nytTv from "./ko/nyt-tv";

import gameAchievements from "./ko/game-achievements";

const ko: Record<string, string> = {
  "collections.feed.more": "컬렉션 더 불러오기",
  "collections.feed.error": "컬렉션을 불러오지 못했습니다. 다시 시도해 주세요.",
  "Show content ratings?": "콘텐츠 등급을 표시할까요?",
  "Age ratings and content notes when playback starts.": "재생이 시작될 때 연령 등급과 콘텐츠 안내를 표시합니다.",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "게임",
  "games.explore": "둘러보기",
  "games.library": "라이브러리",
  "games.saved": "즐겨찾기",
  "games.download.nav": "다운로드",
  "games.search": "게임 검색",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "번역",
  "Translating…": "번역 중…",
  "Showing {lang}": "{lang} 표시 중",
  "Show all": "모두 표시",
  "games.download.speed.title": "다운로드 속도",
  "games.download.speed.note": "이 프로필의 직접 다운로드와 토렌트가 함께 사용하는 제한입니다. 개별 토렌트의 제한은 더 낮을 수 있습니다.",
  "games.download.speed.unlimited": "무제한",
  "games.download.speed.limited": "속도 제한",
  "games.download.speed.rate": "초당 킬로바이트",
  "games.download.speed.range": "{min}~{max} 사이의 정수를 입력하세요.",
  "games.download.speed.error": "속도 설정을 불러오거나 저장하지 못했습니다. 다시 시도하세요.",
  "games.download.speed.current": "파일 다운로드 속도: {rate}",
  "games.discovery.sale.cards.included": "트레이딩 카드",
  "games.discovery.sale.cards.none": "세일 카드 없음",
  "games.discovery.sale.cards.unknown": "카드 미확인",
  "games.discovery.sale.cards.includedNote": "Steam의 현재 세일 카드 규정에 따라 포함됩니다. 획득 조건은 Steam에서 확인하세요.",
  "games.discovery.sale.cards.noneNote": "Steam의 현재 규정상 이번 계절 세일에는 트레이딩 카드가 포함되지 않습니다. 다른 이벤트 보상은 별개입니다.",
  "games.discovery.sale.cards.unknownNote": "Steam의 현재 카드 규정을 확인하지 못했습니다. 제공 여부는 Steam에서 확인하세요.",
  "games.discovery.sale.cards.badgeNote": "한 세트를 모으면 세일 배지, 이모티콘, 프로필 배경을 제작할 수 있습니다.",
  "games.download.storage.title": "다운로드 공간",
  "games.download.storage.note": "일시 중지된 항목을 포함해 직접 다운로드, 토렌트 및 임시 파일에 필요한 공간을 추정합니다. 외부 설치 프로그램은 포함되지 않습니다.",
  "games.download.storage.error": "저장 공간을 확인할 수 없습니다.",
  "games.download.storage.unavailable": "여유 공간을 알 수 없음",
  "games.download.storage.free": "{size} 여유",
  "games.download.storage.remaining": "추가 공간: {size}",
  "games.download.storage.estimate": "아직 확인하지 않은 기존 파일이 있습니다. 실제 필요한 공간은 더 적을 수 있습니다.",
  "games.download.storage.unknown": "크기 미상: 파일 {count}개",
  "games.download.storage.other": "다른 Harbor 작업이 {size} 예약 중",
  "games.download.storage.shortfall": "{size}의 추가 공간 필요",
  "games.download.state.retrying": "연결 재시도 중",
  "games.download.queueOrder": "대기열 순서: {position}",
  "games.download.earlier": "{name} 순서 앞당기기",
  "games.download.later": "{name} 순서 뒤로 미루기",
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
  "games.selection.partial": "전체 {total}개 중 {count}개 게임을 업데이트했습니다. 나머지 게임은 계속 선택되어 있습니다. 다시 시도하세요.",
  "games.selection.failed": "선택한 게임을 업데이트하지 못했습니다. 다시 시도하세요.",
  "games.custom.nav": "로컬 게임",
  "games.libraryPersonal.visibility": "라이브러리 표시",
  "games.libraryPersonal.visible": "내 게임",
  "games.libraryPersonal.pinned": "고정됨",
  "games.libraryPersonal.hidden": "숨긴 게임",
  "games.library.sort": "라이브러리 정렬",
  "games.selection.start": "선택",
  "games.selection.game": "{name} 선택",
  "games.selection.actions": "선택한 게임 작업",
  "games.selection.count": "{count}개 선택됨",
  "games.selection.clear": "선택 해제",
  "games.selection.all": "모두 선택 ({count}개)",
  "games.selection.pinned": "고정한 게임: {count}개.",
  "games.selection.unpinned": "고정을 해제한 게임: {count}개.",
  "games.selection.hidden": "숨긴 게임: {count}개. 숨긴 게임에서 찾을 수 있습니다.",
  "games.selection.shown": "라이브러리에 표시한 게임: {count}개.",
  "games.selection.show": "라이브러리에 표시",
  "games.selection.hide": "숨기기",
  "games.selection.pin": "고정",
  "games.selection.unpin": "고정 해제",
  "games.selection.matchNote": "선택한 게임 중 일부를 이용할 수 없습니다. 라이브러리를 새로고침하고 다시 시도하세요.",
  "games.selection.collection": "컬렉션에 추가",
  "games.collections.localMissing": "이 프로필의 라이브러리에 더 이상 없음",
  "games.collections.dynamic": "필터 기반 컬렉션",
  "games.collections.manual": "직접 게임 선택",
  "games.collections.type": "컬렉션 유형",
  "games.collections.filters": "컬렉션 필터",
  "games.collections.ruleQuery": "게임 제목에 포함된 내용",
  "games.collections.autoNote": "라이브러리의 게임이 필터와 일치하는지에 따라 이 컬렉션에 자동으로 추가되거나 컬렉션에서 제외됩니다.",
  "games.collections.pickerAutoNote": "필터 기반 컬렉션은 자동으로 업데이트됩니다. 컬렉션에서 필터를 관리하세요.",
  "games.collections.matches": "일치하는 게임: {count}개",
  "games.collections.emptyDynamic": "이 필터와 일치하는 게임이 라이브러리에 없습니다. 필터를 변경하거나 라이브러리에 게임을 더 추가하세요.",
  "games.collections.collections_rules": "이 컬렉션의 필터를 읽지 못했습니다. 저장된 데이터는 대체되지 않았습니다.",
  "games.collections.collections_dynamic": "이 컬렉션은 자동으로 업데이트됩니다. 표시되는 게임을 바꾸려면 컬렉션에서 필터를 변경하세요.",
  "games.collections.title": "컬렉션",
  "games.collections.personal": "직접 만든 컬렉션",
  "games.collections.note": "모든 게임을 위한 공간입니다. 좋아하는 게임, 앞으로 플레이할 게임, 다시 돌아가고 싶은 세계를 모아 보세요.",
  "games.collections.addTo": "컬렉션에 추가",
  "games.collections.count": "게임 {count}개",
  "games.collections.one": "게임 1개",
  "games.collections.search": "내 컬렉션 검색",
  "games.collections.name": "컬렉션 이름",
  "games.collections.newName": "새 컬렉션 이름 지정",
  "games.collections.create": "만들기",
  "games.collections.first": "첫 컬렉션을 여기서 시작하세요.",
  "games.collections.noMatches": "일치하는 컬렉션이 없습니다.",
  "games.collections.pickerNote": "원하는 만큼 선택하세요. 변경 사항은 선택할 때마다 저장됩니다.",
  "games.collections.empty": "다음에 푹 빠질 게임을 위한 공간.",
  "games.collections.findGames": "게임 찾기",
  "games.collections.description": "간단한 소개",
  "games.collections.edit": "컬렉션 편집",
  "games.collections.pin": "컬렉션 고정",
  "games.collections.unpin": "컬렉션 고정 해제",
  "games.collections.remove": "컬렉션 제거",
  "games.collections.removeNote": "이 컬렉션만 제거됩니다. 게임, 저장 데이터, 다운로드 및 다른 컬렉션은 그대로 유지됩니다.",
  "games.collections.confirmRemove": "이 컬렉션 제거",
  "games.collections.removeGame": "이 컬렉션에서 {name} 제거",
  "games.collections.removeShort": "컬렉션에서 제거",
  "games.collections.added": "최근 추가한 순",
  "games.collections.done": "완료",
  "games.collections.save": "변경 사항 저장",
  "games.collections.collections_name": "컬렉션 이름은 1–80자, 설명은 최대 240자로 입력하세요.",
  "games.collections.collections_duplicate": "같은 이름의 컬렉션이 이미 있습니다.",
  "games.collections.collections_limit": "이 프로필의 컬렉션 저장 한도에 도달했습니다. 사용하지 않는 컬렉션이나 게임을 제거하고 다시 시도하세요.",
  "games.collections.collections_missing": "이 컬렉션은 제거되었습니다. 다른 컬렉션을 선택하세요.",
  "games.collections.collections_read": "컬렉션을 읽지 못했습니다. 저장된 데이터는 대체되지 않았습니다. 다시 불러오세요.",
  "games.collections.collections_write": "변경 사항을 저장하지 못했습니다. 이전 컬렉션은 그대로 남아 있습니다. 기기의 저장 공간을 확보하고 다시 시도하세요.",
  "games.collections.collections_game": "이 게임을 식별하지 못했습니다. 라이브러리를 새로고침하고 다시 시도하세요.",
  "games.collections.firstNote": "컬렉션을 만든 다음 게임의 상세 페이지에서 추가하거나 라이브러리에서 게임을 선택하세요. PC 게임과 ROM을 함께 모을 수 있습니다.",
  "games.collections.emptyNote": "게임의 상세 페이지에서 추가하거나, 라이브러리에서 게임을 선택한 뒤 컬렉션에 추가를 선택하세요.",
  "games.cache.saved": "저장된 데이터 · {date}",
  "games.cache.refresh": "새로고침",
  "games.cache.refreshing": "새로고침 중…",
  "games.cache.price": "현재 가격은 Steam에서 확인하세요.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...coverage,
  ...catalog01,
  ...catalog02,
  ...catalog03,
  ...catalog04,
  ...catalog05,
  ...catalog06,
  ...catalog07,
  ...catalog08,
  ...catalog09,
  ...catalog10,
  ...catalog11,
  ...catalog12,
  ...catalog13,
  ...currentTail,
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
  "games.torrent.share.title": "토렌트 공유",
  "games.torrent.share.note": "검증된 파일을 피어와 공유합니다. 한도에 도달하거나 Harbor를 닫으면 중지됩니다. 파일을 변경하기 전에 공유를 중지하세요.",
  "games.torrent.share.upload": "업로드 제한 (KB/초)",
  "games.torrent.share.ratio": "공유 비율 (1–10)",
  "games.torrent.share.minutes": "시간 제한 (분)",
  "games.torrent.share.start": "공유 시작",
  "games.torrent.share.stop": "공유 중지",
  "games.torrent.share.resume": "공유 재개",
  "games.torrent.share.checking": "공유할 파일 확인 중",
  "games.torrent.share.seeding": "공유 중",
  "games.torrent.share.stopped": "공유 중지됨",
  "games.torrent.share.limitReached": "공유 한도 도달",
  "games.torrent.share.failed": "공유에 실패했습니다. 파일을 확인하고 다시 시도하세요.",
  "games.torrent.share.stats": "{uploaded} 업로드 · {minutes}분",
  "games.torrent.torrent_seed_files": "완료된 파일이 없거나 변경되었거나 사용 중입니다. 공유 전에 다운로드 폴더를 확인하세요.",
  "games.torrent.torrent_seed_limits": "업로드 32–1,048,576 KB/초, 비율 1–10, 시간 1–1,440분을 선택하세요.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
};

export default ko;
import videoCast from "./ko/video-cast";
