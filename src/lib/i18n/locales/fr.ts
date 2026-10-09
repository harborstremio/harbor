import jlDesktop026 from "./fr/jl-desktop-026";
import playOrders from "./fr/play-orders";
import gameRomLibrary from "./fr/game-rom-library";
import gameNotes from "./fr/game-notes";
import gameLibraryRefinements from "./fr/game-library-refinements";
import gamePokemonUi from "./fr/game-pokemon-ui";
import customArtwork from "./fr/custom-artwork";
import gameAtlasDiscovery from "./fr/game-atlas-discovery";
import gameDiscoveryPicker from "./fr/game-discovery-picker";
import gameLibraryManagement from "./fr/game-library-management";
import gameHydraImport from "./fr/game-hydra-import";
import gameStudioCatalog from "./fr/game-studio-catalog";
import gameArtwork from "./fr/game-artwork";
import gameCommunity from "./fr/game-community";
import gameMetadataMatching from "./fr/game-metadata-matching";
import gameAgeRatings from "./fr/game-age-ratings";
import gameLibraryLinks from "./fr/game-library-links";
import gameModHub from "./fr/game-mod-hub";
import gameLibraryTitles from "./fr/game-library-titles";
import gameStoreSearch from "./fr/game-store-search";
import gameSteamShortcuts from "./fr/game-steam-shortcuts";
import gameGallery from "./fr/game-gallery";
import gameStardew from "./fr/game-stardew";
import gamePokemon from "./fr/game-pokemon";
import gameSourceAlerts from "./fr/game-source-alerts";
import gameSims from "./fr/game-sims";
import gameTarkov from "./fr/game-tarkov";
import gameTft from "./fr/game-tft";
import gameEve from "./fr/game-eve";
import gameOsrs from "./fr/game-osrs";
import gameFfxiv from "./fr/game-ffxiv";
import gameFortnite from "./fr/game-fortnite";
import gameSetup from "./fr/game-setup";
import torrentDialog from "./fr/torrent-dialog";
import gameDownloadNotifications from "./fr/game-download-notifications";
import gameDownloadCenter from "./fr/game-download-center";
import warhammerUniverse from "./fr/warhammer-universe";
import gameLeague from "./fr/game-league";
import gameValorant from "./fr/game-valorant";
import gameAudience from "./fr/game-audience";
import gameDetailFlow from "./fr/game-detail-flow";
import gameWowTalents from "./fr/game-wow-talents";
import gameWowProgress from "./fr/game-wow-progress";
import gameWowRuns from "./fr/game-wow-runs";
import gameMediaRelations from "./fr/game-media-relations";
import gameDota from "./fr/game-dota";
import gameOverwatch from "./fr/game-overwatch";
import gameWowEquipment from "./fr/game-wow-equipment";
import gameRecommendations from "./fr/game-recommendations";
import gameOwnedDiscovery from "./fr/game-owned-discovery";
import gameBackups from "./fr/game-backups";
import gameArchives from "./fr/game-archives";
import gameUnifiedLibrary from "./fr/game-unified-library";
import gamePlaytime from "./fr/game-playtime";
import gameLaunchHealth from "./fr/game-launch-health";
import gameSourceDiscovery from "./fr/game-source-discovery";
import gameGuides from "./fr/game-guides";
import gameModUpdates from "./fr/game-mod-updates";
import gameMinecraft from "./fr/game-minecraft";
import gameRoms from "./fr/game-roms";
import gameExploreRows from "./fr/game-explore-rows";
import gameHackDiscovery from "./fr/game-hack-discovery";
import gameHub from "./fr/game-hub";
import gameRetro from "./fr/game-retro";
import floatingPlayer from "./fr/floating-player";
import gameAntiCheat from "./fr/game-anti-cheat";
import gameDock from "./fr/game-dock";
import gameCompanion from "./fr/game-companion";
import gameWow from "./fr/game-wow";
import gameSearch from "./fr/game-search";
import mediaStart from "./fr/media-start";
import spooktober from "./fr/spooktober";
import listenTogether from "./fr/listen-together";
import music from "./fr/music";
import sportsConsent from "./fr/sports-consent";
import sportsStatistics from "./fr/sports-statistics";
import sportsApi from "./fr/sports-api";
import esportsArena from "./fr/esports-arena";
import sportsHub from "./fr/sports-hub";
import ebookSources from "./fr/ebook-sources";
import settingsRefinements from "./fr/settings-refinements";
import inventory from "./fr/inventory";
import wired from "./fr/wired";
import sweep from "./fr/sweep";
import used from "./fr/used";
import extra from "./fr/extra";
import appFill from "./fr/app-fill";
import profileFill from "./fr/profile-fill";
import settingsFill from "./fr/settings-fill";
import chrome from "./fr/chrome";
import common from "./fr/common";
import catalog from "./fr/catalog";
import detail from "./fr/detail";
import player from "./fr/player";
import live from "./fr/live";
import settings from "./fr/settings";
import library from "./fr/library";
import sync from "./fr/sync";
import lists from "./fr/lists";
import downloads from "./fr/downloads";
import together from "./fr/together";
import rails from "./fr/rails";
import masthead from "./fr/masthead";
import discover from "./fr/discover";
import spotlights from "./fr/spotlights";
import misc from "./fr/misc";
import awards from "./fr/awards";
import addons from "./fr/addons";
import manga from "./fr/manga";
import controllers from "./fr/controllers";
import plurals from "./fr/plurals";
import bpSources from "./fr/bp-sources";
import coverage from "./fr/coverage";
import plugins from "./fr/plugins";
import brands from "./fr/brands";
import bpSports from "./fr/bp-sports";

import nytTv from "./fr/nyt-tv";

import gameAchievements from "./fr/game-achievements";

const fr: Record<string, string> = {
  "collections.feed.more": "Charger plus de collections",
  "collections.feed.error": "Impossible de charger les collections. Réessayez.",
  "Show content ratings?": "Afficher les classifications du contenu ?",
  "Age ratings and content notes when playback starts.":
    "Âge conseillé et avertissements au début de la lecture.",
  ...gameCommunity,
  ...gamePokemon,
  ...torrentDialog,
  "nav.games": "Jeux",
  "games.explore": "Explorer",
  "games.library": "Bibliothèque",
  "games.saved": "Favoris",
  "games.download.nav": "Téléchargements",
  "games.search": "Rechercher des jeux",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "Traductions",
  "Translating…": "Traduction en cours…",
  "Showing {lang}": "Affichage : {lang}",
  "Show all": "Tout afficher",
  "games.download.speed.title": "Vitesse de téléchargement",
  "games.download.speed.note": "Partagée entre les téléchargements directs et les torrents de ce profil. Un torrent peut avoir une limite individuelle plus basse.",
  "games.download.speed.unlimited": "Illimitée",
  "games.download.speed.limited": "Limiter la vitesse",
  "games.download.speed.rate": "Kilooctets par seconde",
  "games.download.speed.range": "Saisissez un nombre entier entre {min} et {max}.",
  "games.download.speed.error": "Impossible de charger ou d’enregistrer le réglage de vitesse. Réessayez.",
  "games.download.speed.current": "Vitesse de téléchargement : {rate}",
  "games.discovery.sale.cards.included": "Cartes à échanger",
  "games.discovery.sale.cards.none": "Pas de cartes de soldes",
  "games.discovery.sale.cards.unknown": "Cartes non confirmées",
  "games.discovery.sale.cards.includedNote": "Incluses selon les règles actuelles de Steam pour les cartes de soldes. Ouvrez Steam pour savoir comment les obtenir.",
  "games.discovery.sale.cards.noneNote": "Les règles actuelles de Steam ne prévoient pas de cartes pour ces soldes saisonnières. Les autres récompenses de l’évènement sont distinctes.",
  "games.discovery.sale.cards.unknownNote": "Impossible de vérifier les règles actuelles de Steam pour les cartes. Ouvrez Steam pour vérifier leur disponibilité.",
  "games.discovery.sale.cards.badgeNote": "Réunissez un ensemble pour créer un badge de soldes, une émoticône et un arrière-plan de profil.",
  "games.download.storage.title": "Espace pour les téléchargements",
  "games.download.storage.note": "Les estimations couvrent les téléchargements directs, les torrents et les fichiers temporaires, y compris les téléchargements en pause. Les programmes d’installation externes sont exclus.",
  "games.download.storage.error": "Impossible de vérifier le stockage.",
  "games.download.storage.unavailable": "Espace libre indisponible",
  "games.download.storage.free": "{size} libres",
  "games.download.storage.remaining": "Espace supplémentaire : {size}",
  "games.download.storage.estimate": "Certains fichiers existants n’ont pas encore été vérifiés. L’espace nécessaire peut être inférieur.",
  "games.download.storage.unknown": "Taille inconnue : {count} fichiers",
  "games.download.storage.other": "{size} réservés par d'autres opérations Harbor",
  "games.download.storage.shortfall": "{size} d’espace supplémentaire nécessaire",
  "games.download.state.retrying": "Nouvelle tentative de connexion",
  "games.download.queueOrder": "Position {position} dans la file",
  "games.download.earlier": "Avancer {name}",
  "games.download.later": "Reculer {name}",
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
  "games.selection.partial": "{count} jeux sur {total} ont été mis à jour. Les autres jeux restent sélectionnés ; réessayez.",
  "games.selection.failed": "Impossible de mettre à jour les jeux sélectionnés. Réessayez.",
  "games.custom.nav": "Jeux locaux",
  "games.libraryPersonal.visibility": "Visibilité dans la bibliothèque",
  "games.libraryPersonal.visible": "Vos jeux",
  "games.libraryPersonal.pinned": "Épinglés",
  "games.libraryPersonal.hidden": "Masqués",
  "games.library.sort": "Trier la bibliothèque",
  "games.selection.start": "Sélectionner",
  "games.selection.game": "Sélectionner {name}",
  "games.selection.actions": "Actions pour les jeux sélectionnés",
  "games.selection.count": "{count} sélectionnés",
  "games.selection.clear": "Effacer la sélection",
  "games.selection.all": "Tout sélectionner ({count})",
  "games.selection.pinned": "Jeux épinglés : {count}.",
  "games.selection.unpinned": "Jeux désépinglés : {count}.",
  "games.selection.hidden": "Jeux masqués : {count}. Retrouvez-les dans les jeux masqués.",
  "games.selection.shown": "Jeux affichés dans votre bibliothèque : {count}.",
  "games.selection.show": "Afficher dans la bibliothèque",
  "games.selection.hide": "Masquer",
  "games.selection.pin": "Épingler",
  "games.selection.unpin": "Désépingler",
  "games.selection.matchNote": "Certains jeux sélectionnés sont indisponibles. Actualisez votre bibliothèque et réessayez.",
  "games.selection.collection": "Ajouter à une collection",
  "games.collections.localMissing": "N’est plus dans la bibliothèque de ce profil",
  "games.collections.dynamic": "Collection basée sur des filtres",
  "games.collections.manual": "Choisir les jeux vous-même",
  "games.collections.type": "Type de collection",
  "games.collections.filters": "Filtres de la collection",
  "games.collections.ruleQuery": "Le titre du jeu contient",
  "games.collections.autoNote": "Les jeux sont ajoutés à cette collection ou retirés automatiquement selon qu’ils correspondent à ses filtres dans votre bibliothèque.",
  "games.collections.pickerAutoNote": "Les collections basées sur des filtres se mettent à jour automatiquement. Gérez leurs filtres dans Collections.",
  "games.collections.matches": "Jeux correspondants : {count}",
  "games.collections.emptyDynamic": "Aucun jeu de votre bibliothèque ne correspond à ces filtres. Modifiez les filtres ou ajoutez des jeux à votre bibliothèque.",
  "games.collections.collections_rules": "Les filtres de cette collection n’ont pas pu être lus. Les données enregistrées n’ont pas été remplacées.",
  "games.collections.collections_dynamic": "Cette collection se met à jour automatiquement. Modifiez ses filtres dans Collections pour changer les jeux qui apparaissent.",
  "games.collections.title": "Collections",
  "games.collections.personal": "Créées par vous",
  "games.collections.note": "Une place pour chaque type de jeu. Regroupez vos favoris, vos prochaines découvertes et les mondes qui méritent d’être revisités.",
  "games.collections.addTo": "Ajouter à une collection",
  "games.collections.count": "{count} jeux",
  "games.collections.one": "1 jeu",
  "games.collections.search": "Rechercher dans vos collections",
  "games.collections.name": "Nom de la collection",
  "games.collections.newName": "Nommer une nouvelle collection",
  "games.collections.create": "Créer",
  "games.collections.first": "Votre première collection commence ici.",
  "games.collections.noMatches": "Aucune collection correspondante.",
  "games.collections.pickerNote": "Choisissez-en autant que vous le souhaitez. Les modifications sont enregistrées au fur et à mesure.",
  "games.collections.empty": "De la place pour votre prochaine passion.",
  "games.collections.findGames": "Trouver des jeux",
  "games.collections.description": "Quelques mots à son sujet",
  "games.collections.edit": "Modifier la collection",
  "games.collections.pin": "Épingler la collection",
  "games.collections.unpin": "Désépingler la collection",
  "games.collections.remove": "Supprimer la collection",
  "games.collections.removeNote": "Seule cette collection est supprimée. Vos jeux, sauvegardes, téléchargements et autres collections sont conservés.",
  "games.collections.confirmRemove": "Supprimer cette collection",
  "games.collections.removeGame": "Retirer {name} de cette collection",
  "games.collections.removeShort": "Retirer de la collection",
  "games.collections.added": "Derniers ajouts en premier",
  "games.collections.done": "Terminé",
  "games.collections.save": "Enregistrer les modifications",
  "games.collections.collections_name": "Donnez à la collection un nom de 1 à 80 caractères et une description de 240 caractères maximum.",
  "games.collections.collections_duplicate": "Vous avez déjà une collection portant ce nom.",
  "games.collections.collections_limit": "Ce profil a atteint la limite de stockage des collections. Supprimez des collections ou des jeux inutilisés, puis réessayez.",
  "games.collections.collections_missing": "Cette collection a été supprimée. Choisissez-en une autre.",
  "games.collections.collections_read": "Vos collections n’ont pas pu être lues. Les données enregistrées n’ont pas été remplacées. Essayez de les charger à nouveau.",
  "games.collections.collections_write": "La modification n’a pas pu être enregistrée. Votre collection précédente est toujours là. Libérez de l’espace sur l’appareil et réessayez.",
  "games.collections.collections_game": "Ce jeu n’a pas pu être identifié. Actualisez votre bibliothèque et réessayez.",
  "games.collections.firstNote": "Créez une collection, puis ajoutez des jeux depuis leurs pages de détails ou sélectionnez-les dans votre bibliothèque. Les jeux PC et les ROMs peuvent y cohabiter.",
  "games.collections.emptyNote": "Ajoutez des jeux depuis leurs pages de détails, ou sélectionnez des jeux dans votre bibliothèque et choisissez Ajouter à une collection.",
  "games.cache.saved": "Données enregistrées · {date}",
  "games.cache.refresh": "Actualiser",
  "games.cache.refreshing": "Actualisation…",
  "games.cache.price": "Ouvrez Steam pour consulter le prix actuel.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...inventory,
  ...wired,
  ...sweep,
  ...used,
  ...extra,
  ...appFill,
  ...profileFill,
  ...settingsFill,
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
  ...manga,
  ...controllers,
  ...plurals,
  ...bpSources,
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
  "games.torrent.share.title": "Partager le torrent",
  "games.torrent.share.note": "Partagez les fichiers vérifiés avec les pairs. Arrêt dès qu’une limite est atteinte ou que Harbor se ferme. Arrêtez le partage avant de modifier les fichiers.",
  "games.torrent.share.upload": "Limite d’envoi (Ko/s)",
  "games.torrent.share.ratio": "Ratio de partage (1–10)",
  "games.torrent.share.minutes": "Durée limite (minutes)",
  "games.torrent.share.start": "Partager",
  "games.torrent.share.stop": "Arrêter le partage",
  "games.torrent.share.resume": "Reprendre le partage",
  "games.torrent.share.checking": "Vérification des fichiers",
  "games.torrent.share.seeding": "Partage en cours",
  "games.torrent.share.stopped": "Partage arrêté",
  "games.torrent.share.limitReached": "Limite atteinte",
  "games.torrent.share.failed": "Échec du partage. Vérifiez les fichiers et réessayez.",
  "games.torrent.share.stats": "{uploaded} envoyés · {minutes} min",
  "games.torrent.torrent_seed_files": "Les fichiers sont absents, modifiés ou utilisés. Vérifiez le dossier de téléchargement avant le partage.",
  "games.torrent.torrent_seed_limits": "Choisissez 32–1 048 576 Ko/s, un ratio de 1–10 et une durée de 1–1 440 minutes.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default fr;
import videoCast from "./fr/video-cast";
