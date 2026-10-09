import playOrders from "./es/play-orders";
import gameRomLibrary from "./es/game-rom-library";
import gameNotes from "./es/game-notes";
import gameLibraryRefinements from "./es/game-library-refinements";
import gamePokemonUi from "./es/game-pokemon-ui";
import customArtwork from "./es/custom-artwork";
import gameAtlasDiscovery from "./es/game-atlas-discovery";
import gameDiscoveryPicker from "./es/game-discovery-picker";
import gameLibraryManagement from "./es/game-library-management";
import gameHydraImport from "./es/game-hydra-import";
import gameStudioCatalog from "./es/game-studio-catalog";
import gameArtwork from "./es/game-artwork";
import gameCommunity from "./es/game-community";
import gameMetadataMatching from "./es/game-metadata-matching";
import gameAgeRatings from "./es/game-age-ratings";
import gameLibraryLinks from "./es/game-library-links";
import gameModHub from "./es/game-mod-hub";
import gameLibraryTitles from "./es/game-library-titles";
import gameStoreSearch from "./es/game-store-search";
import gameSteamShortcuts from "./es/game-steam-shortcuts";
import gameGallery from "./es/game-gallery";
import gameStardew from "./es/game-stardew";
import gamePokemon from "./es/game-pokemon";
import gameSourceAlerts from "./es/game-source-alerts";
import gameSims from "./es/game-sims";
import gameTarkov from "./es/game-tarkov";
import gameTft from "./es/game-tft";
import gameEve from "./es/game-eve";
import gameOsrs from "./es/game-osrs";
import gameFfxiv from "./es/game-ffxiv";
import gameFortnite from "./es/game-fortnite";
import gameSetup from "./es/game-setup";
import torrentDialog from "./es/torrent-dialog";
import gameDownloadNotifications from "./es/game-download-notifications";
import gameDownloadCenter from "./es/game-download-center";
import warhammerUniverse from "./es/warhammer-universe";
import gameLeague from "./es/game-league";
import gameValorant from "./es/game-valorant";
import gameAudience from "./es/game-audience";
import gameDetailFlow from "./es/game-detail-flow";
import gameWowTalents from "./es/game-wow-talents";
import gameWowProgress from "./es/game-wow-progress";
import gameWowRuns from "./es/game-wow-runs";
import gameMediaRelations from "./es/game-media-relations";
import gameDota from "./es/game-dota";
import gameOverwatch from "./es/game-overwatch";
import gameWowEquipment from "./es/game-wow-equipment";
import gameRecommendations from "./es/game-recommendations";
import gameOwnedDiscovery from "./es/game-owned-discovery";
import gameBackups from "./es/game-backups";
import gameArchives from "./es/game-archives";
import gameUnifiedLibrary from "./es/game-unified-library";
import gamePlaytime from "./es/game-playtime";
import gameLaunchHealth from "./es/game-launch-health";
import gameSourceDiscovery from "./es/game-source-discovery";
import gameGuides from "./es/game-guides";
import gameModUpdates from "./es/game-mod-updates";
import gameMinecraft from "./es/game-minecraft";
import gameRoms from "./es/game-roms";
import gameExploreRows from "./es/game-explore-rows";
import gameHackDiscovery from "./es/game-hack-discovery";
import gameHub from "./es/game-hub";
import gameRetro from "./es/game-retro";
import floatingPlayer from "./es/floating-player";
import gameAntiCheat from "./es/game-anti-cheat";
import gameDock from "./es/game-dock";
import gameCompanion from "./es/game-companion";
import gameWow from "./es/game-wow";
import gameSearch from "./es/game-search";
import mediaStart from "./es/media-start";
import spooktober from "./es/spooktober";
import listenTogether from "./es/listen-together";
import music from "./es/music";
import sportsConsent from "./es/sports-consent";
import sportsStatistics from "./es/sports-statistics";
import sportsApi from "./es/sports-api";
import esportsArena from "./es/esports-arena";
import sportsHub from "./es/sports-hub";
import ebookSources from "./es/ebook-sources";
import settingsRefinements from "./es/settings-refinements";
import sweep from "./es/sweep";
import used from "./es/used";
import extra from "./es/extra";
import appFill from "./es/app-fill";
import profileFill from "./es/profile-fill";
import settingsFill from "./es/settings-fill";
import misc from "./es/misc";
import catalog from "./es/catalog";
import chrome from "./es/chrome";
import common from "./es/common";
import detail from "./es/detail";
import player from "./es/player";
import live from "./es/live";
import settings from "./es/settings";
import library from "./es/library";
import sync from "./es/sync";
import lists from "./es/lists";
import downloads from "./es/downloads";
import together from "./es/together";
import rails from "./es/rails";
import masthead from "./es/masthead";
import discover from "./es/discover";
import spotlights from "./es/spotlights";
import awards from "./es/awards";
import addons from "./es/addons";
import manga from "./es/manga";
import controllers from "./es/controllers";
import bpSources from "./es/bp-sources";
import coverage from "./es/coverage";
import plugins from "./es/plugins";
import brands from "./es/brands";
import bpSports from "./es/bp-sports";

import nytTv from "./es/nyt-tv";

import gameAchievements from "./es/game-achievements";

const es: Record<string, string> = {
  "collections.feed.more": "Cargar más colecciones",
  "collections.feed.error": "No se pudieron cargar las colecciones. Inténtalo de nuevo.",
  "Show content ratings?": "¿Mostrar clasificaciones de contenido?",
  "Age ratings and content notes when playback starts.":
    "Clasificaciones por edad y avisos de contenido al iniciar la reproducción.",
  ...gameCommunity,
  ...gamePokemon,
  ...torrentDialog,
  "nav.games": "Juegos",
  "games.explore": "Explorar",
  "games.library": "Biblioteca",
  "games.saved": "Favoritos",
  "games.download.nav": "Descargas",
  "games.search": "Buscar juegos",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "Traducciones",
  "Translating…": "Traduciendo…",
  "Showing {lang}": "Mostrando {lang}",
  "Show all": "Mostrar todo",
  "games.download.speed.title": "Velocidad de descarga",
  "games.download.speed.note": "Compartida por las descargas directas y torrents de este perfil. El límite propio de un torrent puede ser menor.",
  "games.download.speed.unlimited": "Sin límite",
  "games.download.speed.limited": "Limitar velocidad",
  "games.download.speed.rate": "Kilobytes por segundo",
  "games.download.speed.range": "Introduce un número entero entre {min} y {max}.",
  "games.download.speed.error": "No se pudo cargar o guardar el ajuste de velocidad. Inténtalo de nuevo.",
  "games.download.speed.current": "Velocidad de descarga: {rate}",
  "games.discovery.sale.cards.included": "Cromos",
  "games.discovery.sale.cards.none": "Sin cromos de oferta",
  "games.discovery.sale.cards.unknown": "Cromos sin confirmar",
  "games.discovery.sale.cards.includedNote": "Incluidos según las reglas actuales de Steam para los cromos de ofertas. Abre Steam para ver cómo conseguirlos.",
  "games.discovery.sale.cards.noneNote": "Las reglas actuales de Steam no incluyen cromos para estas ofertas de temporada. Otras recompensas del evento son independientes.",
  "games.discovery.sale.cards.unknownNote": "No se pudieron verificar las reglas actuales de Steam para los cromos. Abre Steam para comprobar su disponibilidad.",
  "games.discovery.sale.cards.badgeNote": "Reúne un conjunto para crear una insignia de las ofertas, un emoticono y un fondo de perfil.",
  "games.download.storage.title": "Espacio para descargas",
  "games.download.storage.note": "Las estimaciones incluyen descargas directas, torrents y archivos temporales, también las descargas en pausa. No incluyen instaladores externos.",
  "games.download.storage.error": "No se pudo comprobar el almacenamiento.",
  "games.download.storage.unavailable": "Espacio libre no disponible",
  "games.download.storage.free": "{size} libres",
  "games.download.storage.remaining": "Espacio adicional: {size}",
  "games.download.storage.estimate": "Algunos archivos existentes aún no se han comprobado. El espacio necesario puede ser menor.",
  "games.download.storage.unknown": "Tamaño desconocido: {count} archivos",
  "games.download.storage.other": "{size} reservados por otras operaciones de Harbor",
  "games.download.storage.shortfall": "Se necesitan {size} más de espacio",
  "games.download.state.retrying": "Reintentando conexión",
  "games.download.queueOrder": "Posición en la cola: {position}",
  "games.download.earlier": "Adelantar {name}",
  "games.download.later": "Retrasar {name}",
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
  "games.selection.partial": "Se actualizaron {count} de {total} juegos. Los juegos restantes siguen seleccionados; inténtalo de nuevo.",
  "games.selection.failed": "No se pudieron actualizar los juegos seleccionados. Inténtalo de nuevo.",
  "games.custom.nav": "Juegos locales",
  "games.libraryPersonal.visibility": "Visibilidad en la biblioteca",
  "games.libraryPersonal.visible": "Tus juegos",
  "games.libraryPersonal.pinned": "Fijados",
  "games.libraryPersonal.hidden": "Ocultos",
  "games.library.sort": "Ordenar biblioteca",
  "games.selection.start": "Seleccionar",
  "games.selection.game": "Seleccionar {name}",
  "games.selection.actions": "Acciones de juegos seleccionados",
  "games.selection.count": "{count} seleccionados",
  "games.selection.clear": "Borrar selección",
  "games.selection.all": "Seleccionar los {count}",
  "games.selection.pinned": "Juegos fijados: {count}.",
  "games.selection.unpinned": "Juegos desfijados: {count}.",
  "games.selection.hidden": "Juegos ocultados: {count}. Están en Ocultos.",
  "games.selection.shown": "Juegos mostrados en tu biblioteca: {count}.",
  "games.selection.show": "Mostrar en biblioteca",
  "games.selection.hide": "Ocultar",
  "games.selection.pin": "Fijar",
  "games.selection.unpin": "Desfijar",
  "games.selection.matchNote": "Algunos juegos seleccionados no están disponibles. Actualiza tu biblioteca e inténtalo de nuevo.",
  "games.selection.collection": "Añadir a colección",
  "games.collections.localMissing": "Ya no está en la biblioteca de este perfil",
  "games.collections.dynamic": "Colección basada en filtros",
  "games.collections.manual": "Elige los juegos",
  "games.collections.type": "Tipo de colección",
  "games.collections.filters": "Filtros de la colección",
  "games.collections.ruleQuery": "El título del juego contiene",
  "games.collections.autoNote": "Los juegos entran o salen de esta colección automáticamente según coincidan con sus filtros en tu biblioteca.",
  "games.collections.pickerAutoNote": "Las colecciones basadas en filtros se actualizan automáticamente. Gestiona sus filtros en Colecciones.",
  "games.collections.matches": "Juegos coincidentes: {count}",
  "games.collections.emptyDynamic": "Ningún juego de tu biblioteca coincide con estos filtros. Cambia los filtros o añade más juegos a tu biblioteca.",
  "games.collections.collections_rules": "No se pudieron leer los filtros de esta colección. Los datos guardados no se han reemplazado.",
  "games.collections.collections_dynamic": "Esta colección se actualiza automáticamente. Cambia sus filtros en Colecciones para elegir qué juegos aparecen.",
  "games.collections.title": "Colecciones",
  "games.collections.personal": "Creadas por ti",
  "games.collections.note": "Un lugar para cada tipo de juego. Agrupa tus favoritos, los que quieres jugar y los mundos a los que merece la pena volver.",
  "games.collections.addTo": "Añadir a colección",
  "games.collections.count": "{count} juegos",
  "games.collections.one": "1 juego",
  "games.collections.search": "Buscar en tus colecciones",
  "games.collections.name": "Nombre de la colección",
  "games.collections.newName": "Pon nombre a una nueva colección",
  "games.collections.create": "Crear",
  "games.collections.first": "Tu primera colección empieza aquí.",
  "games.collections.noMatches": "No hay colecciones que coincidan.",
  "games.collections.pickerNote": "Elige tantas como quieras. Los cambios se guardan sobre la marcha.",
  "games.collections.empty": "Un lugar para tu próxima gran pasión.",
  "games.collections.findGames": "Buscar juegos",
  "games.collections.description": "Unas palabras sobre ella",
  "games.collections.edit": "Editar colección",
  "games.collections.pin": "Fijar colección",
  "games.collections.unpin": "Desfijar colección",
  "games.collections.remove": "Eliminar colección",
  "games.collections.removeNote": "Solo se elimina esta colección. Tus juegos, partidas guardadas, descargas y otras colecciones se conservan.",
  "games.collections.confirmRemove": "Eliminar esta colección",
  "games.collections.removeGame": "Quitar {name} de esta colección",
  "games.collections.removeShort": "Quitar de la colección",
  "games.collections.added": "Últimos añadidos primero",
  "games.collections.done": "Listo",
  "games.collections.save": "Guardar cambios",
  "games.collections.collections_name": "Pon a la colección un nombre de 1–80 caracteres y una descripción de hasta 240 caracteres.",
  "games.collections.collections_duplicate": "Ya tienes una colección con ese nombre.",
  "games.collections.collections_limit": "Este perfil ha alcanzado el límite de almacenamiento de colecciones. Elimina colecciones o juegos que no uses e inténtalo de nuevo.",
  "games.collections.collections_missing": "Esta colección se ha eliminado. Elige otra.",
  "games.collections.collections_read": "No se pudieron leer tus colecciones. Los datos guardados no se han reemplazado. Intenta cargarlas de nuevo.",
  "games.collections.collections_write": "No se pudo guardar el cambio. Tu colección anterior sigue aquí. Libera espacio en el dispositivo e inténtalo de nuevo.",
  "games.collections.collections_game": "No se pudo identificar este juego. Actualiza tu biblioteca e inténtalo de nuevo.",
  "games.collections.firstNote": "Crea una colección y añade juegos desde sus páginas de detalles o selecciónalos en tu biblioteca. Los juegos de PC y las ROM pueden estar juntos.",
  "games.collections.emptyNote": "Añade juegos desde sus páginas de detalles o selecciona juegos en tu biblioteca y elige Añadir a colección.",
  "games.cache.saved": "Datos guardados · {date}",
  "games.cache.refresh": "Actualizar",
  "games.cache.refreshing": "Actualizando…",
  "games.cache.price": "Abre Steam para consultar el precio actual.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...sweep,
  ...used,
  ...extra,
  ...appFill,
  ...profileFill,
  ...settingsFill,
  ...misc,
  ...catalog,
  ...chrome,
  ...common,
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
  ...awards,
  ...addons,
  ...manga,
  ...controllers,
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
  "games.torrent.share.title": "Compartir torrent",
  "games.torrent.share.note": "Comparte archivos verificados con otros pares. Se detiene al alcanzar un límite o cerrar Harbor. Detén el envío antes de cambiar los archivos.",
  "games.torrent.share.upload": "Límite de subida (KB/s)",
  "games.torrent.share.ratio": "Proporción (1–10)",
  "games.torrent.share.minutes": "Tiempo límite (minutos)",
  "games.torrent.share.start": "Compartir",
  "games.torrent.share.stop": "Dejar de compartir",
  "games.torrent.share.resume": "Reanudar envío",
  "games.torrent.share.checking": "Comprobando archivos",
  "games.torrent.share.seeding": "Compartiendo",
  "games.torrent.share.stopped": "Envío detenido",
  "games.torrent.share.limitReached": "Límite alcanzado",
  "games.torrent.share.failed": "No se pudo compartir. Comprueba los archivos e inténtalo de nuevo.",
  "games.torrent.share.stats": "{uploaded} enviados · {minutes} min",
  "games.torrent.torrent_seed_files": "Los archivos faltan, han cambiado o están en uso. Comprueba la carpeta de descarga antes de compartir.",
  "games.torrent.torrent_seed_limits": "Elige 32–1.048.576 KB/s, una proporción de 1–10 y 1–1.440 minutos.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
};

export default es;
import videoCast from "./es/video-cast";
