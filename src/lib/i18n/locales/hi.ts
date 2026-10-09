import jlDesktop026 from "./hi/jl-desktop-026";
import playOrders from "./hi/play-orders";
import gameRomLibrary from "./hi/game-rom-library";
import gameNotes from "./hi/game-notes";
import gameLibraryRefinements from "./hi/game-library-refinements";
import gamePokemonUi from "./hi/game-pokemon-ui";
import customArtwork from "./hi/custom-artwork";
import gameAtlasDiscovery from "./hi/game-atlas-discovery";
import gameDiscoveryPicker from "./hi/game-discovery-picker";
import gameLibraryManagement from "./hi/game-library-management";
import gameHydraImport from "./hi/game-hydra-import";
import gameStudioCatalog from "./hi/game-studio-catalog";
import gameArtwork from "./hi/game-artwork";
import gameCommunity from "./hi/game-community";
import gameMetadataMatching from "./hi/game-metadata-matching";
import gameAgeRatings from "./hi/game-age-ratings";
import gameLibraryLinks from "./hi/game-library-links";
import gameModHub from "./hi/game-mod-hub";
import gameLibraryTitles from "./hi/game-library-titles";
import gameStoreSearch from "./hi/game-store-search";
import gameSteamShortcuts from "./hi/game-steam-shortcuts";
import gameGallery from "./hi/game-gallery";
import gameStardew from "./hi/game-stardew";
import gameSourceAlerts from "./hi/game-source-alerts";
import gameSims from "./hi/game-sims";
import gameTarkov from "./hi/game-tarkov";
import gameTft from "./hi/game-tft";
import gameEve from "./hi/game-eve";
import gameOsrs from "./hi/game-osrs";
import gameFfxiv from "./hi/game-ffxiv";
import gameFortnite from "./hi/game-fortnite";
import gameSetup from "./hi/game-setup";
import torrentDialog from "./hi/torrent-dialog";
import gameDownloadNotifications from "./hi/game-download-notifications";
import gameDownloadCenter from "./hi/game-download-center";
import warhammerUniverse from "./hi/warhammer-universe";
import gameLeague from "./hi/game-league";
import gameValorant from "./hi/game-valorant";
import gameAudience from "./hi/game-audience";
import gameDetailFlow from "./hi/game-detail-flow";
import gameWowTalents from "./hi/game-wow-talents";
import gameWowProgress from "./hi/game-wow-progress";
import gameWowRuns from "./hi/game-wow-runs";
import gameMediaRelations from "./hi/game-media-relations";
import gameDota from "./hi/game-dota";
import gameOverwatch from "./hi/game-overwatch";
import gameWowEquipment from "./hi/game-wow-equipment";
import gameRecommendations from "./hi/game-recommendations";
import gameOwnedDiscovery from "./hi/game-owned-discovery";
import gameBackups from "./hi/game-backups";
import gameArchives from "./hi/game-archives";
import gameUnifiedLibrary from "./hi/game-unified-library";
import gamePlaytime from "./hi/game-playtime";
import gameLaunchHealth from "./hi/game-launch-health";
import gameSourceDiscovery from "./hi/game-source-discovery";
import gameGuides from "./hi/game-guides";
import gameModUpdates from "./hi/game-mod-updates";
import gameMinecraft from "./hi/game-minecraft";
import gameRoms from "./hi/game-roms";
import gameExploreRows from "./hi/game-explore-rows";
import gameHackDiscovery from "./hi/game-hack-discovery";
import gameHub from "./hi/game-hub";
import gameRetro from "./hi/game-retro";
import floatingPlayer from "./hi/floating-player";
import gameAntiCheat from "./hi/game-anti-cheat";
import gameDock from "./hi/game-dock";
import gameCompanion from "./hi/game-companion";
import gameWow from "./hi/game-wow";
import gameSearch from "./hi/game-search";
import mediaStart from "./hi/media-start";
import spooktober from "./hi/spooktober";
import listenTogether from "./hi/listen-together";
import music from "./hi/music";
import sportsConsent from "./hi/sports-consent";
import sportsStatistics from "./hi/sports-statistics";
import sportsApi from "./hi/sports-api";
import esportsArena from "./hi/esports-arena";
import sportsHub from "./hi/sports-hub";
import ebookSources from "./hi/ebook-sources";
import settingsRefinements from "./hi/settings-refinements";
import catalogSymbols from "./hi/catalog-symbols";
import catalogAC from "./hi/catalog-a-c";
import catalogDF from "./hi/catalog-d-f";
import catalogGI from "./hi/catalog-g-i";
import catalogJL from "./hi/catalog-j-l";
import catalogMO from "./hi/catalog-m-o";
import catalogPR from "./hi/catalog-p-r";
import catalogSU from "./hi/catalog-s-u";
import catalogVZ from "./hi/catalog-v-z";
import coverage from "./hi/coverage";
import plugins from "./hi/plugins";
import brands from "./hi/brands";
import bpSports from "./hi/bp-sports";

import nytTv from "./hi/nyt-tv";

import gameAchievements from "./hi/game-achievements";

const hi: Record<string, string> = {
  "collections.feed.more": "और संग्रह लोड करें",
  "collections.feed.error": "संग्रह लोड नहीं हो सके। फिर से कोशिश करें।",
  "Show content ratings?": "कॉन्टेंट की रेटिंग दिखाएँ?",
  "Age ratings and content notes when playback starts.":
    "प्लेबैक शुरू होने पर उम्र की रेटिंग और कॉन्टेंट की जानकारी।",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "गेम",
  "games.explore": "खोजें",
  "games.library": "लाइब्रेरी",
  "games.saved": "पसंदीदा",
  "games.download.nav": "डाउनलोड",
  "games.search": "गेम खोजें",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "अनुवाद",
  "Translating…": "अनुवाद हो रहा है…",
  "Showing {lang}": "{lang} दिखाया जा रहा है",
  "Show all": "सभी दिखाएँ",
  "games.download.speed.title": "डाउनलोड की गति",
  "games.download.speed.note": "इस प्रोफ़ाइल के सीधे डाउनलोड और टोरेंट के बीच साझा सीमा। किसी टोरेंट की अपनी सीमा इससे कम हो सकती है।",
  "games.download.speed.unlimited": "असीमित",
  "games.download.speed.limited": "गति सीमित करें",
  "games.download.speed.rate": "किलोबाइट प्रति सेकंड",
  "games.download.speed.range": "{min} से {max} तक की पूर्ण संख्या दर्ज करें।",
  "games.download.speed.error": "गति की सेटिंग लोड या सेव नहीं हो सकी। फिर से कोशिश करें।",
  "games.download.speed.current": "फ़ाइल डाउनलोड की गति: {rate}",
  "games.discovery.sale.cards.included": "ट्रेडिंग कार्ड",
  "games.discovery.sale.cards.none": "सेल कार्ड नहीं",
  "games.discovery.sale.cards.unknown": "कार्ड की पुष्टि नहीं",
  "games.discovery.sale.cards.includedNote": "Steam के मौजूदा सेल कार्ड नियमों के अनुसार शामिल हैं। इन्हें पाने की शर्तें देखने के लिए Steam खोलें।",
  "games.discovery.sale.cards.noneNote": "Steam के मौजूदा नियमों में इस मौसमी सेल के ट्रेडिंग कार्ड शामिल नहीं हैं। इवेंट के अन्य इनाम अलग हैं।",
  "games.discovery.sale.cards.unknownNote": "Steam के मौजूदा कार्ड नियमों की पुष्टि नहीं हो सकी। उपलब्धता जाँचने के लिए Steam खोलें।",
  "games.discovery.sale.cards.badgeNote": "सेल बैज, इमोटिकॉन और प्रोफ़ाइल बैकग्राउंड बनाने के लिए पूरा सेट इकट्ठा करें।",
  "games.download.storage.title": "डाउनलोड के लिए जगह",
  "games.download.storage.note": "अनुमान में सीधे डाउनलोड, टोरेंट और अस्थायी फ़ाइलें शामिल हैं, रोके गए डाउनलोड भी। बाहरी इंस्टॉलर शामिल नहीं हैं।",
  "games.download.storage.error": "स्टोरेज की जाँच नहीं हो सकी।",
  "games.download.storage.unavailable": "खाली जगह की जानकारी उपलब्ध नहीं",
  "games.download.storage.free": "{size} खाली",
  "games.download.storage.remaining": "अतिरिक्त जगह: {size}",
  "games.download.storage.estimate": "कुछ मौजूदा फ़ाइलें अभी जाँची नहीं गई हैं। ज़रूरी जगह कम हो सकती है।",
  "games.download.storage.unknown": "अज्ञात आकार: {count} फ़ाइलें",
  "games.download.storage.other": "Harbor की अन्य प्रक्रियाओं के लिए {size} आरक्षित",
  "games.download.storage.shortfall": "{size} और जगह चाहिए",
  "games.download.state.retrying": "कनेक्शन दोबारा आज़माया जा रहा है",
  "games.download.queueOrder": "कतार में क्रम: {position}",
  "games.download.earlier": "{name} को पहले रखें",
  "games.download.later": "{name} को बाद में रखें",
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
  "games.selection.partial": "{total} में से {count} गेम अपडेट हुए। बाकी गेम अब भी चुने हुए हैं; फिर से कोशिश करें।",
  "games.selection.failed": "चुने गए गेम अपडेट नहीं हो सके। फिर से कोशिश करें।",
  "games.custom.nav": "स्थानीय गेम",
  "games.libraryPersonal.visibility": "लाइब्रेरी में दिखने की स्थिति",
  "games.libraryPersonal.visible": "आपके गेम",
  "games.libraryPersonal.pinned": "पिन किए गए",
  "games.libraryPersonal.hidden": "छिपे हुए",
  "games.library.sort": "लाइब्रेरी क्रमबद्ध करें",
  "games.selection.start": "चुनें",
  "games.selection.game": "{name} चुनें",
  "games.selection.actions": "चुने गए गेम की कार्रवाइयाँ",
  "games.selection.count": "{count} चुने गए",
  "games.selection.clear": "चयन हटाएँ",
  "games.selection.all": "सभी {count} चुनें",
  "games.selection.pinned": "पिन किए गए गेम: {count}।",
  "games.selection.unpinned": "जिन गेम का पिन हटाया गया: {count}।",
  "games.selection.hidden": "छिपाए गए गेम: {count}। उन्हें छिपे हुए गेम में देखें।",
  "games.selection.shown": "आपकी लाइब्रेरी में दिखाए गए गेम: {count}।",
  "games.selection.show": "लाइब्रेरी में दिखाएँ",
  "games.selection.hide": "छिपाएँ",
  "games.selection.pin": "पिन करें",
  "games.selection.unpin": "पिन हटाएँ",
  "games.selection.matchNote": "कुछ चुने गए गेम उपलब्ध नहीं हैं। अपनी लाइब्रेरी रीफ़्रेश करें और फिर से कोशिश करें।",
  "games.selection.collection": "संग्रह में जोड़ें",
  "games.collections.localMissing": "अब इस प्रोफ़ाइल की लाइब्रेरी में नहीं है",
  "games.collections.dynamic": "फ़िल्टर पर आधारित संग्रह",
  "games.collections.manual": "गेम खुद चुनें",
  "games.collections.type": "संग्रह का प्रकार",
  "games.collections.filters": "संग्रह के फ़िल्टर",
  "games.collections.ruleQuery": "गेम के नाम में शामिल है",
  "games.collections.autoNote": "आपकी लाइब्रेरी के गेम इन फ़िल्टर से मेल खाने पर अपने आप इस संग्रह में जुड़ते हैं और मेल न खाने पर इससे हट जाते हैं।",
  "games.collections.pickerAutoNote": "फ़िल्टर पर आधारित संग्रह अपने आप अपडेट होते हैं। संग्रह में उनके फ़िल्टर प्रबंधित करें।",
  "games.collections.matches": "मेल खाने वाले गेम: {count}",
  "games.collections.emptyDynamic": "लाइब्रेरी का कोई गेम इन फ़िल्टर से मेल नहीं खाता। फ़िल्टर बदलें या लाइब्रेरी में और गेम जोड़ें।",
  "games.collections.collections_rules": "इस संग्रह के फ़िल्टर पढ़े नहीं जा सके। सहेजा गया डेटा बदला नहीं गया है।",
  "games.collections.collections_dynamic": "यह संग्रह अपने आप अपडेट होता है। कौन से गेम दिखें, यह बदलने के लिए संग्रह में इसके फ़िल्टर बदलें।",
  "games.collections.title": "संग्रह",
  "games.collections.personal": "आपके बनाए हुए",
  "games.collections.note": "हर तरह के गेम के लिए एक जगह। पसंदीदा गेम, आगे खेलने वाले गेम और उन दुनियाओं को साथ रखें जहाँ फिर लौटना चाहते हैं।",
  "games.collections.addTo": "संग्रह में जोड़ें",
  "games.collections.count": "{count} गेम",
  "games.collections.one": "1 गेम",
  "games.collections.search": "अपने संग्रह खोजें",
  "games.collections.name": "संग्रह का नाम",
  "games.collections.newName": "नए संग्रह को नाम दें",
  "games.collections.create": "बनाएँ",
  "games.collections.first": "आपका पहला संग्रह यहीं से शुरू होता है।",
  "games.collections.noMatches": "कोई मेल खाता संग्रह नहीं मिला।",
  "games.collections.pickerNote": "जितने चाहें उतने चुनें। बदलाव साथ-साथ सहेजे जाते हैं।",
  "games.collections.empty": "आपके अगले पसंदीदा गेम के लिए जगह।",
  "games.collections.findGames": "गेम खोजें",
  "games.collections.description": "इसके बारे में कुछ शब्द",
  "games.collections.edit": "संग्रह संपादित करें",
  "games.collections.pin": "संग्रह पिन करें",
  "games.collections.unpin": "संग्रह का पिन हटाएँ",
  "games.collections.remove": "संग्रह हटाएँ",
  "games.collections.removeNote": "केवल यह संग्रह हटाया जाता है। आपके गेम, गेम की सेव फ़ाइलें, डाउनलोड और दूसरे संग्रह बने रहते हैं।",
  "games.collections.confirmRemove": "यह संग्रह हटाएँ",
  "games.collections.removeGame": "इस संग्रह से {name} हटाएँ",
  "games.collections.removeShort": "संग्रह से हटाएँ",
  "games.collections.added": "हाल में जोड़े गए पहले",
  "games.collections.done": "हो गया",
  "games.collections.save": "बदलाव सहेजें",
  "games.collections.collections_name": "संग्रह को 1–80 अक्षरों का नाम और अधिकतम 240 अक्षरों का विवरण दें।",
  "games.collections.collections_duplicate": "इस नाम का संग्रह आपके पास पहले से है।",
  "games.collections.collections_limit": "इस प्रोफ़ाइल में संग्रहों के लिए स्टोरेज की सीमा पूरी हो गई है। इस्तेमाल न होने वाले संग्रह या गेम हटाएँ और फिर से कोशिश करें।",
  "games.collections.collections_missing": "यह संग्रह हटा दिया गया है। कोई दूसरा चुनें।",
  "games.collections.collections_read": "आपके संग्रह पढ़े नहीं जा सके। सहेजा गया डेटा बदला नहीं गया है। उन्हें फिर से लोड करके देखें।",
  "games.collections.collections_write": "बदलाव सहेजा नहीं जा सका। आपका पहले वाला संग्रह अभी भी मौजूद है। डिवाइस में कुछ जगह खाली करें और फिर से कोशिश करें।",
  "games.collections.collections_game": "इस गेम की पहचान नहीं हो सकी। अपनी लाइब्रेरी रीफ़्रेश करें और फिर से कोशिश करें।",
  "games.collections.firstNote": "एक संग्रह बनाएँ, फिर गेम के विवरण पेज से उन्हें जोड़ें या अपनी लाइब्रेरी में उन्हें चुनें। PC गेम और ROM एक ही संग्रह में रह सकते हैं।",
  "games.collections.emptyNote": "गेम के विवरण पेज से उन्हें जोड़ें, या अपनी लाइब्रेरी में गेम चुनें और संग्रह में जोड़ें विकल्प चुनें।",
  "games.cache.saved": "सहेजा गया डेटा · {date}",
  "games.cache.refresh": "रीफ़्रेश करें",
  "games.cache.refreshing": "रीफ़्रेश हो रहा है…",
  "games.cache.price": "मौजूदा कीमत देखने के लिए Steam खोलें।",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...catalogSymbols,
  ...catalogAC,
  ...catalogDF,
  ...catalogGI,
  ...catalogJL,
  ...catalogMO,
  ...catalogPR,
  ...catalogSU,
  ...catalogVZ,
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
  "games.torrent.share.title": "टोरेंट साझा करें",
  "games.torrent.share.note": "सत्यापित फ़ाइलें अन्य पीयर से साझा करें। किसी सीमा पर पहुँचने या Harbor बंद होने पर रुकता है। फ़ाइलें बदलने से पहले साझाकरण रोकें।",
  "games.torrent.share.upload": "अपलोड सीमा (KB/s)",
  "games.torrent.share.ratio": "साझाकरण अनुपात (1–10)",
  "games.torrent.share.minutes": "समय सीमा (मिनट)",
  "games.torrent.share.start": "साझा करना शुरू करें",
  "games.torrent.share.stop": "साझाकरण रोकें",
  "games.torrent.share.resume": "साझाकरण फिर शुरू करें",
  "games.torrent.share.checking": "फ़ाइलों की जाँच हो रही है",
  "games.torrent.share.seeding": "साझा हो रहा है",
  "games.torrent.share.stopped": "साझाकरण रुका",
  "games.torrent.share.limitReached": "साझाकरण सीमा पूरी",
  "games.torrent.share.failed": "साझाकरण विफल। फ़ाइलें जाँचकर फिर कोशिश करें।",
  "games.torrent.share.stats": "{uploaded} अपलोड · {minutes} मिनट",
  "games.torrent.torrent_seed_files": "पूरी हुई फ़ाइलें गायब हैं, बदल गई हैं या उपयोग में हैं। साझा करने से पहले डाउनलोड फ़ोल्डर जाँचें।",
  "games.torrent.torrent_seed_limits": "32–1,048,576 KB/s अपलोड, 1–10 अनुपात और 1–1,440 मिनट चुनें।",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default hi;
import videoCast from "./hi/video-cast";
