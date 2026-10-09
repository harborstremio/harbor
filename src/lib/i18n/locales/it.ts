import jlDesktop026 from "./it/jl-desktop-026";
import playOrders from "./it/play-orders";
import gameRomLibrary from "./it/game-rom-library";
import gameNotes from "./it/game-notes";
import gameLibraryRefinements from "./it/game-library-refinements";
import gamePokemonUi from "./it/game-pokemon-ui";
import customArtwork from "./it/custom-artwork";
import gameAtlasDiscovery from "./it/game-atlas-discovery";
import gameDiscoveryPicker from "./it/game-discovery-picker";
import gameLibraryManagement from "./it/game-library-management";
import gameHydraImport from "./it/game-hydra-import";
import gameStudioCatalog from "./it/game-studio-catalog";
import gameArtwork from "./it/game-artwork";
import gameCommunity from "./it/game-community";
import gameMetadataMatching from "./it/game-metadata-matching";
import gameAgeRatings from "./it/game-age-ratings";
import gameLibraryLinks from "./it/game-library-links";
import gameModHub from "./it/game-mod-hub";
import gameLibraryTitles from "./it/game-library-titles";
import gameStoreSearch from "./it/game-store-search";
import gameSteamShortcuts from "./it/game-steam-shortcuts";
import gameGallery from "./it/game-gallery";
import gameStardew from "./it/game-stardew";
import gameSourceAlerts from "./it/game-source-alerts";
import gameSims from "./it/game-sims";
import gameTarkov from "./it/game-tarkov";
import gameTft from "./it/game-tft";
import gameEve from "./it/game-eve";
import gameOsrs from "./it/game-osrs";
import gameFfxiv from "./it/game-ffxiv";
import gameFortnite from "./it/game-fortnite";
import gameSetup from "./it/game-setup";
import torrentDialog from "./it/torrent-dialog";
import gameDownloadNotifications from "./it/game-download-notifications";
import gameDownloadCenter from "./it/game-download-center";
import warhammerUniverse from "./it/warhammer-universe";
import gameLeague from "./it/game-league";
import gameValorant from "./it/game-valorant";
import gameAudience from "./it/game-audience";
import gameDetailFlow from "./it/game-detail-flow";
import gameWowTalents from "./it/game-wow-talents";
import gameWowProgress from "./it/game-wow-progress";
import gameWowRuns from "./it/game-wow-runs";
import gameMediaRelations from "./it/game-media-relations";
import gameDota from "./it/game-dota";
import gameOverwatch from "./it/game-overwatch";
import gameWowEquipment from "./it/game-wow-equipment";
import gameRecommendations from "./it/game-recommendations";
import gameOwnedDiscovery from "./it/game-owned-discovery";
import gameBackups from "./it/game-backups";
import gameArchives from "./it/game-archives";
import gameUnifiedLibrary from "./it/game-unified-library";
import gamePlaytime from "./it/game-playtime";
import gameLaunchHealth from "./it/game-launch-health";
import gameSourceDiscovery from "./it/game-source-discovery";
import gameGuides from "./it/game-guides";
import gameModUpdates from "./it/game-mod-updates";
import gameMinecraft from "./it/game-minecraft";
import gameRoms from "./it/game-roms";
import gameExploreRows from "./it/game-explore-rows";
import gameHackDiscovery from "./it/game-hack-discovery";
import gameHub from "./it/game-hub";
import gameRetro from "./it/game-retro";
import floatingPlayer from "./it/floating-player";
import gameAntiCheat from "./it/game-anti-cheat";
import gameDock from "./it/game-dock";
import gameCompanion from "./it/game-companion";
import gameWow from "./it/game-wow";
import gameSearch from "./it/game-search";
import mediaStart from "./it/media-start";
import spooktober from "./it/spooktober";
import listenTogether from "./it/listen-together";
import music from "./it/music";
import sportsConsent from "./it/sports-consent";
import sportsStatistics from "./it/sports-statistics";
import sportsApi from "./it/sports-api";
import esportsArena from "./it/esports-arena";
import sportsHub from "./it/sports-hub";
import ebookSources from "./it/ebook-sources";
import settingsRefinements from "./it/settings-refinements";
import catalog01 from "./it/catalog-01";
import catalog02 from "./it/catalog-02";
import catalog03 from "./it/catalog-03";
import catalog04 from "./it/catalog-04";
import catalog05 from "./it/catalog-05";
import catalog06 from "./it/catalog-06";
import catalog07 from "./it/catalog-07";
import catalog08 from "./it/catalog-08";
import catalog09 from "./it/catalog-09";
import catalog10 from "./it/catalog-10";
import catalog11 from "./it/catalog-11";
import catalog12 from "./it/catalog-12";
import coverage from "./it/coverage";
import plugins from "./it/plugins";
import brands from "./it/brands";
import bpSports from "./it/bp-sports";

import nytTv from "./it/nyt-tv";

import gameAchievements from "./it/game-achievements";

const it: Record<string, string> = {
  "collections.feed.more": "Carica altre raccolte",
  "collections.feed.error": "Impossibile caricare le raccolte. Riprova.",
  "Show content ratings?": "Mostrare le classificazioni dei contenuti?",
  "Age ratings and content notes when playback starts.":
    "Classificazioni per età e avvisi all’avvio della riproduzione.",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "Giochi",
  "games.explore": "Esplora",
  "games.library": "Libreria",
  "games.saved": "Preferiti",
  "games.download.nav": "Download",
  "games.search": "Cerca giochi",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  Translations: "Traduzioni",
  "Translating…": "Traduzione in corso…",
  "Showing {lang}": "Visualizzazione: {lang}",
  "Show all": "Mostra tutto",
  "games.download.speed.title": "Velocità di download",
  "games.download.speed.note":
    "Condivisa tra download diretti e torrent di questo profilo. Il limite di un singolo torrent può essere inferiore.",
  "games.download.speed.unlimited": "Illimitata",
  "games.download.speed.limited": "Limita velocità",
  "games.download.speed.rate": "Kilobyte al secondo",
  "games.download.speed.range": "Inserisci un numero intero da {min} a {max}.",
  "games.download.speed.error":
    "Impossibile caricare o salvare l’impostazione della velocità. Riprova.",
  "games.download.speed.current": "Velocità di download: {rate}",
  "games.discovery.sale.cards.included": "Carte collezionabili",
  "games.discovery.sale.cards.none": "Nessuna carta dei saldi",
  "games.discovery.sale.cards.unknown": "Carte non confermate",
  "games.discovery.sale.cards.includedNote":
    "Incluse secondo le regole attuali di Steam per le carte dei saldi. Apri Steam per sapere come ottenerle.",
  "games.discovery.sale.cards.noneNote":
    "Le regole attuali di Steam non prevedono carte per questi saldi stagionali. Le altre ricompense dell’evento sono separate.",
  "games.discovery.sale.cards.unknownNote":
    "Impossibile verificare le regole attuali di Steam per le carte. Apri Steam per verificarne la disponibilità.",
  "games.discovery.sale.cards.badgeNote":
    "Raccogli un set per creare una medaglia dei saldi, un’emoticon e uno sfondo del profilo.",
  "games.download.storage.title": "Spazio per i download",
  "games.download.storage.note":
    "Le stime includono download diretti, torrent e file temporanei, anche per i download in pausa. I programmi di installazione esterni sono esclusi.",
  "games.download.storage.error": "Impossibile verificare lo spazio di archiviazione.",
  "games.download.storage.unavailable": "Spazio libero non disponibile",
  "games.download.storage.free": "{size} liberi",
  "games.download.storage.remaining": "Spazio aggiuntivo: {size}",
  "games.download.storage.estimate":
    "Alcuni file esistenti non sono ancora stati controllati. Lo spazio necessario potrebbe essere inferiore.",
  "games.download.storage.unknown": "Dimensione sconosciuta: {count} file",
  "games.download.storage.other": "{size} riservati da altre operazioni Harbor",
  "games.download.storage.shortfall": "Servono altri {size} di spazio",
  "games.download.state.retrying": "Nuovo tentativo di connessione",
  "games.download.queueOrder": "Posizione in coda: {position}",
  "games.download.earlier": "Sposta {name} prima",
  "games.download.later": "Sposta {name} dopo",
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
    "Aggiornati {count} giochi su {total}. Gli altri giochi restano selezionati; riprova.",
  "games.selection.failed": "Impossibile aggiornare i giochi selezionati. Riprova.",
  "games.custom.nav": "Giochi locali",
  "games.libraryPersonal.visibility": "Visibilità nella libreria",
  "games.libraryPersonal.visible": "I tuoi giochi",
  "games.libraryPersonal.pinned": "Fissati",
  "games.libraryPersonal.hidden": "Nascosti",
  "games.library.sort": "Ordina libreria",
  "games.selection.start": "Seleziona",
  "games.selection.game": "Seleziona {name}",
  "games.selection.actions": "Azioni per i giochi selezionati",
  "games.selection.count": "{count} selezionati",
  "games.selection.clear": "Cancella selezione",
  "games.selection.all": "Seleziona tutti ({count})",
  "games.selection.pinned": "Giochi fissati: {count}.",
  "games.selection.unpinned": "Giochi non più fissati: {count}.",
  "games.selection.hidden": "Giochi nascosti: {count}. Li trovi in Nascosti.",
  "games.selection.shown": "Giochi mostrati nella tua libreria: {count}.",
  "games.selection.show": "Mostra nella libreria",
  "games.selection.hide": "Nascondi",
  "games.selection.pin": "Fissa",
  "games.selection.unpin": "Rimuovi dai fissati",
  "games.selection.matchNote":
    "Alcuni giochi selezionati non sono disponibili. Aggiorna la libreria e riprova.",
  "games.selection.collection": "Aggiungi a raccolta",
  "games.collections.localMissing": "Non è più nella libreria di questo profilo",
  "games.collections.dynamic": "Raccolta basata su filtri",
  "games.collections.manual": "Scegli tu i giochi",
  "games.collections.type": "Tipo di raccolta",
  "games.collections.filters": "Filtri della raccolta",
  "games.collections.ruleQuery": "Il titolo del gioco contiene",
  "games.collections.autoNote":
    "I giochi vengono aggiunti o rimossi automaticamente da questa raccolta in base alla corrispondenza con i suoi filtri nella tua libreria.",
  "games.collections.pickerAutoNote":
    "Le raccolte basate su filtri si aggiornano automaticamente. Gestisci i loro filtri in Raccolte.",
  "games.collections.matches": "Giochi corrispondenti: {count}",
  "games.collections.emptyDynamic":
    "Nessun gioco della libreria corrisponde a questi filtri. Modifica i filtri o aggiungi altri giochi alla libreria.",
  "games.collections.collections_rules":
    "Non è stato possibile leggere i filtri di questa raccolta. I dati salvati non sono stati sostituiti.",
  "games.collections.collections_dynamic":
    "Questa raccolta si aggiorna automaticamente. Modifica i suoi filtri in Raccolte per cambiare i giochi visualizzati.",
  "games.collections.title": "Raccolte",
  "games.collections.personal": "Create da te",
  "games.collections.note":
    "Un posto per ogni tipo di gioco. Raggruppa i preferiti, i giochi da provare e i mondi in cui vale la pena tornare.",
  "games.collections.addTo": "Aggiungi a raccolta",
  "games.collections.count": "{count} giochi",
  "games.collections.one": "1 gioco",
  "games.collections.search": "Cerca nelle tue raccolte",
  "games.collections.name": "Nome della raccolta",
  "games.collections.newName": "Dai un nome a una nuova raccolta",
  "games.collections.create": "Crea",
  "games.collections.first": "La tua prima raccolta inizia qui.",
  "games.collections.noMatches": "Nessuna raccolta corrispondente.",
  "games.collections.pickerNote": "Scegline quante vuoi. Le modifiche vengono salvate man mano.",
  "games.collections.empty": "Spazio per la tua prossima passione.",
  "games.collections.findGames": "Trova giochi",
  "games.collections.description": "Qualche parola sulla raccolta",
  "games.collections.edit": "Modifica raccolta",
  "games.collections.pin": "Fissa raccolta",
  "games.collections.unpin": "Non fissare più la raccolta",
  "games.collections.remove": "Rimuovi raccolta",
  "games.collections.removeNote":
    "Viene rimossa solo questa raccolta. Giochi, salvataggi, download e altre raccolte rimangono al loro posto.",
  "games.collections.confirmRemove": "Rimuovi questa raccolta",
  "games.collections.removeGame": "Rimuovi {name} da questa raccolta",
  "games.collections.removeShort": "Rimuovi dalla raccolta",
  "games.collections.added": "Ultimi aggiunti per primi",
  "games.collections.done": "Fatto",
  "games.collections.save": "Salva modifiche",
  "games.collections.collections_name":
    "Assegna alla raccolta un nome di 1–80 caratteri e una descrizione di massimo 240 caratteri.",
  "games.collections.collections_duplicate": "Hai già una raccolta con questo nome.",
  "games.collections.collections_limit":
    "Questo profilo ha raggiunto il limite di archiviazione delle raccolte. Rimuovi raccolte o giochi inutilizzati e riprova.",
  "games.collections.collections_missing": "Questa raccolta è stata rimossa. Scegline un’altra.",
  "games.collections.collections_read":
    "Non è stato possibile leggere le tue raccolte. I dati salvati non sono stati sostituiti. Prova a caricarle di nuovo.",
  "games.collections.collections_write":
    "Non è stato possibile salvare la modifica. La raccolta precedente è ancora qui. Libera spazio sul dispositivo e riprova.",
  "games.collections.collections_game":
    "Non è stato possibile identificare questo gioco. Aggiorna la libreria e riprova.",
  "games.collections.firstNote":
    "Crea una raccolta, poi aggiungi giochi dalle loro pagine dei dettagli o selezionali nella libreria. I giochi per PC e le ROM possono stare insieme.",
  "games.collections.emptyNote":
    "Aggiungi giochi dalle loro pagine dei dettagli, oppure seleziona giochi nella libreria e scegli Aggiungi a raccolta.",
  "games.cache.saved": "Dati salvati · {date}",
  "games.cache.refresh": "Aggiorna",
  "games.cache.refreshing": "Aggiornamento…",
  "games.cache.price": "Apri Steam per verificare il prezzo attuale.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
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
  "games.torrent.share.title": "Condividi torrent",
  "games.torrent.share.note":
    "Condividi file verificati con i peer. Si ferma al raggiungimento di un limite o alla chiusura di Harbor. Interrompi la condivisione prima di modificare i file.",
  "games.torrent.share.upload": "Limite invio (KB/s)",
  "games.torrent.share.ratio": "Rapporto (1–10)",
  "games.torrent.share.minutes": "Limite di tempo (minuti)",
  "games.torrent.share.start": "Avvia condivisione",
  "games.torrent.share.stop": "Interrompi condivisione",
  "games.torrent.share.resume": "Riprendi condivisione",
  "games.torrent.share.checking": "Verifica dei file",
  "games.torrent.share.seeding": "Condivisione in corso",
  "games.torrent.share.stopped": "Condivisione interrotta",
  "games.torrent.share.limitReached": "Limite raggiunto",
  "games.torrent.share.failed": "Condivisione non riuscita. Controlla i file e riprova.",
  "games.torrent.share.stats": "{uploaded} inviati · {minutes} min",
  "games.torrent.torrent_seed_files":
    "I file sono mancanti, modificati o in uso. Controlla la cartella di download prima di condividerli.",
  "games.torrent.torrent_seed_limits":
    "Scegli 32–1.048.576 KB/s, un rapporto di 1–10 e 1–1.440 minuti.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default it;
import videoCast from "./it/video-cast";
