import jlDesktop026 from "./pl/jl-desktop-026";
import playOrders from "./pl/play-orders";
import gameRomLibrary from "./pl/game-rom-library";
import gameNotes from "./pl/game-notes";
import gameLibraryRefinements from "./pl/game-library-refinements";
import gamePokemonUi from "./pl/game-pokemon-ui";
import customArtwork from "./pl/custom-artwork";
import gameAtlasDiscovery from "./pl/game-atlas-discovery";
import gameDiscoveryPicker from "./pl/game-discovery-picker";
import gameLibraryManagement from "./pl/game-library-management";
import gameHydraImport from "./pl/game-hydra-import";
import gameStudioCatalog from "./pl/game-studio-catalog";
import gameArtwork from "./pl/game-artwork";
import gameCommunity from "./pl/game-community";
import gameMetadataMatching from "./pl/game-metadata-matching";
import gameAgeRatings from "./pl/game-age-ratings";
import gameLibraryLinks from "./pl/game-library-links";
import gameModHub from "./pl/game-mod-hub";
import gameLibraryTitles from "./pl/game-library-titles";
import gameStoreSearch from "./pl/game-store-search";
import gameSteamShortcuts from "./pl/game-steam-shortcuts";
import gameGallery from "./pl/game-gallery";
import gameStardew from "./pl/game-stardew";
import gameSourceAlerts from "./pl/game-source-alerts";
import gameSims from "./pl/game-sims";
import gameTarkov from "./pl/game-tarkov";
import gameTft from "./pl/game-tft";
import gameEve from "./pl/game-eve";
import gameOsrs from "./pl/game-osrs";
import gameFfxiv from "./pl/game-ffxiv";
import gameFortnite from "./pl/game-fortnite";
import gameSetup from "./pl/game-setup";
import torrentDialog from "./pl/torrent-dialog";
import gameDownloadNotifications from "./pl/game-download-notifications";
import gameDownloadCenter from "./pl/game-download-center";
import warhammerUniverse from "./pl/warhammer-universe";
import gameLeague from "./pl/game-league";
import gameValorant from "./pl/game-valorant";
import gameAudience from "./pl/game-audience";
import gameDetailFlow from "./pl/game-detail-flow";
import gameWowTalents from "./pl/game-wow-talents";
import gameWowProgress from "./pl/game-wow-progress";
import gameWowRuns from "./pl/game-wow-runs";
import gameMediaRelations from "./pl/game-media-relations";
import gameDota from "./pl/game-dota";
import gameOverwatch from "./pl/game-overwatch";
import gameWowEquipment from "./pl/game-wow-equipment";
import gameRecommendations from "./pl/game-recommendations";
import gameOwnedDiscovery from "./pl/game-owned-discovery";
import gameBackups from "./pl/game-backups";
import gameArchives from "./pl/game-archives";
import gameUnifiedLibrary from "./pl/game-unified-library";
import gamePlaytime from "./pl/game-playtime";
import gameLaunchHealth from "./pl/game-launch-health";
import gameSourceDiscovery from "./pl/game-source-discovery";
import gameGuides from "./pl/game-guides";
import gameModUpdates from "./pl/game-mod-updates";
import gameMinecraft from "./pl/game-minecraft";
import gameRoms from "./pl/game-roms";
import gameExploreRows from "./pl/game-explore-rows";
import gameHackDiscovery from "./pl/game-hack-discovery";
import gameHub from "./pl/game-hub";
import gameRetro from "./pl/game-retro";
import floatingPlayer from "./pl/floating-player";
import gameAntiCheat from "./pl/game-anti-cheat";
import gameDock from "./pl/game-dock";
import gameCompanion from "./pl/game-companion";
import gameWow from "./pl/game-wow";
import gameSearch from "./pl/game-search";
import mediaStart from "./pl/media-start";
import spooktober from "./pl/spooktober";
import listenTogether from "./pl/listen-together";
import music from "./pl/music";
import sportsConsent from "./pl/sports-consent";
import sportsStatistics from "./pl/sports-statistics";
import sportsApi from "./pl/sports-api";
import esportsArena from "./pl/esports-arena";
import sportsHub from "./pl/sports-hub";
import ebookSources from "./pl/ebook-sources";
import settingsRefinements from "./pl/settings-refinements";
import catalog01 from "./pl/catalog-01";
import catalog02 from "./pl/catalog-02";
import catalog03 from "./pl/catalog-03";
import catalog04 from "./pl/catalog-04";
import catalog05 from "./pl/catalog-05";
import catalog06 from "./pl/catalog-06";
import catalog07 from "./pl/catalog-07";
import catalog08 from "./pl/catalog-08";
import catalog09 from "./pl/catalog-09";
import catalog10 from "./pl/catalog-10";
import catalog11 from "./pl/catalog-11";
import catalog12 from "./pl/catalog-12";
import catalog13 from "./pl/catalog-13";
import catalog14 from "./pl/catalog-14";
import catalog15 from "./pl/catalog-15";
import catalog16 from "./pl/catalog-16";
import coverage from "./pl/coverage";
import plurals from "./pl/plurals";
import plugins from "./pl/plugins";
import brands from "./pl/brands";
import bpSports from "./pl/bp-sports";

import nytTv from "./pl/nyt-tv";

import gameAchievements from "./pl/game-achievements";

const pl: Record<string, string> = {
  "collections.feed.more": "Wczytaj więcej kolekcji",
  "collections.feed.error": "Nie udało się wczytać kolekcji. Spróbuj ponownie.",
  "Show content ratings?": "Pokazywać klasyfikację treści?",
  "Age ratings and content notes when playback starts.":
    "Ograniczenia wiekowe i informacje o treści na początku odtwarzania.",
  ...gameCommunity,
  ...torrentDialog,
  "nav.games": "Gry",
  "games.explore": "Odkrywaj",
  "games.library": "Biblioteka",
  "games.saved": "Ulubione",
  "games.download.nav": "Pobieranie",
  "games.search": "Szukaj gier",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "Tłumaczenia",
  "Translating…": "Tłumaczenie…",
  "Showing {lang}": "Wyświetlanie: {lang}",
  "Show all": "Pokaż wszystkie",
  "games.download.speed.title": "Prędkość pobierania",
  "games.download.speed.note": "Wspólna dla pobrań bezpośrednich i torrentów tego profilu. Osobny limit torrenta może być niższy.",
  "games.download.speed.unlimited": "Bez limitu",
  "games.download.speed.limited": "Ogranicz prędkość",
  "games.download.speed.rate": "Kilobajty na sekundę",
  "games.download.speed.range": "Wpisz liczbę całkowitą od {min} do {max}.",
  "games.download.speed.error": "Nie udało się wczytać lub zapisać ustawienia prędkości. Spróbuj ponownie.",
  "games.download.speed.current": "Prędkość pobierania plików: {rate}",
  "games.discovery.sale.cards.included": "Karty kolekcjonerskie",
  "games.discovery.sale.cards.none": "Bez kart wyprzedaży",
  "games.discovery.sale.cards.unknown": "Karty niepotwierdzone",
  "games.discovery.sale.cards.includedNote": "Dostępne według aktualnych zasad Steam dotyczących kart wyprzedaży. Warunki zdobycia sprawdzisz na Steam.",
  "games.discovery.sale.cards.noneNote": "Aktualne zasady Steam nie przewidują kart dla tej sezonowej wyprzedaży. Inne nagrody wydarzenia są odrębne.",
  "games.discovery.sale.cards.unknownNote": "Nie udało się sprawdzić aktualnych zasad Steam dotyczących kart. Sprawdź ich dostępność na Steam.",
  "games.discovery.sale.cards.badgeNote": "Zbierz zestaw, aby wytworzyć odznakę wyprzedaży, emotikon i tło profilu.",
  "games.download.storage.title": "Miejsce na pobieranie",
  "games.download.storage.note": "Szacunki obejmują pobieranie bezpośrednie, torrenty i pliki tymczasowe, także przy wstrzymanym pobieraniu. Zewnętrzne instalatory nie są uwzględniane.",
  "games.download.storage.error": "Nie udało się sprawdzić miejsca na dysku.",
  "games.download.storage.unavailable": "Wolne miejsce niedostępne",
  "games.download.storage.free": "{size} wolnego",
  "games.download.storage.remaining": "Dodatkowe miejsce: {size}",
  "games.download.storage.estimate": "Niektóre istniejące pliki nie zostały jeszcze sprawdzone. Potrzebne miejsce może być mniejsze.",
  "games.download.storage.unknown": "Nieznany rozmiar: {count} plików",
  "games.download.storage.other": "Zarezerwowane przez inne operacje Harbor: {size}",
  "games.download.storage.shortfall": "Potrzeba jeszcze {size} miejsca",
  "games.download.state.retrying": "Ponawianie połączenia",
  "games.download.queueOrder": "Miejsce w kolejce: {position}",
  "games.download.earlier": "Przesuń {name} wcześniej",
  "games.download.later": "Przesuń {name} później",
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
  "games.selection.partial": "Zaktualizowano {count} z {total} gier. Pozostałe gry są nadal zaznaczone; spróbuj ponownie.",
  "games.selection.failed": "Nie udało się zaktualizować wybranych gier. Spróbuj ponownie.",
  "games.custom.nav": "Gry lokalne",
  "games.libraryPersonal.visibility": "Widoczność w bibliotece",
  "games.libraryPersonal.visible": "Twoje gry",
  "games.libraryPersonal.pinned": "Przypięte",
  "games.libraryPersonal.hidden": "Ukryte",
  "games.library.sort": "Sortuj bibliotekę",
  "games.selection.start": "Wybierz",
  "games.selection.game": "Wybierz {name}",
  "games.selection.actions": "Działania dla wybranych gier",
  "games.selection.count": "Wybrano: {count}",
  "games.selection.clear": "Wyczyść wybór",
  "games.selection.all": "Wybierz wszystkie ({count})",
  "games.selection.pinned": "Przypięte gry: {count}.",
  "games.selection.unpinned": "Odpięte gry: {count}.",
  "games.selection.hidden": "Ukryte gry: {count}. Znajdziesz je w sekcji Ukryte.",
  "games.selection.shown": "Gry pokazane w twojej bibliotece: {count}.",
  "games.selection.show": "Pokaż w bibliotece",
  "games.selection.hide": "Ukryj",
  "games.selection.pin": "Przypnij",
  "games.selection.unpin": "Odepnij",
  "games.selection.matchNote": "Niektóre wybrane gry są niedostępne. Odśwież bibliotekę i spróbuj ponownie.",
  "games.selection.collection": "Dodaj do kolekcji",
  "games.collections.localMissing": "Nie ma już tej gry w bibliotece tego profilu",
  "games.collections.dynamic": "Kolekcja oparta na filtrach",
  "games.collections.manual": "Wybierz gry samodzielnie",
  "games.collections.type": "Typ kolekcji",
  "games.collections.filters": "Filtry kolekcji",
  "games.collections.ruleQuery": "Tytuł gry zawiera",
  "games.collections.autoNote": "Gry są automatycznie dodawane do tej kolekcji lub z niej usuwane zależnie od tego, czy pasują do jej filtrów w twojej bibliotece.",
  "games.collections.pickerAutoNote": "Kolekcje oparte na filtrach aktualizują się automatycznie. Zarządzaj ich filtrami w Kolekcjach.",
  "games.collections.matches": "Pasujące gry: {count}",
  "games.collections.emptyDynamic": "Żadna gra z biblioteki nie pasuje do tych filtrów. Zmień filtry lub dodaj więcej gier do biblioteki.",
  "games.collections.collections_rules": "Nie udało się odczytać filtrów tej kolekcji. Zapisane dane nie zostały zastąpione.",
  "games.collections.collections_dynamic": "Ta kolekcja aktualizuje się automatycznie. Zmień jej filtry w Kolekcjach, aby zmienić wyświetlane gry.",
  "games.collections.title": "Kolekcje",
  "games.collections.personal": "Utworzone przez ciebie",
  "games.collections.note": "Miejsce na każdy rodzaj gry. Grupuj ulubione gry, te na później i światy, do których warto wracać.",
  "games.collections.addTo": "Dodaj do kolekcji",
  "games.collections.count": "Gry: {count}",
  "games.collections.one": "1 gra",
  "games.collections.search": "Szukaj w swoich kolekcjach",
  "games.collections.name": "Nazwa kolekcji",
  "games.collections.newName": "Nazwij nową kolekcję",
  "games.collections.create": "Utwórz",
  "games.collections.first": "Tutaj zaczyna się twoja pierwsza kolekcja.",
  "games.collections.noMatches": "Brak pasujących kolekcji.",
  "games.collections.pickerNote": "Wybierz dowolną liczbę. Zmiany są zapisywane na bieżąco.",
  "games.collections.empty": "Miejsce na twoją kolejną pasję.",
  "games.collections.findGames": "Znajdź gry",
  "games.collections.description": "Kilka słów o kolekcji",
  "games.collections.edit": "Edytuj kolekcję",
  "games.collections.pin": "Przypnij kolekcję",
  "games.collections.unpin": "Odepnij kolekcję",
  "games.collections.remove": "Usuń kolekcję",
  "games.collections.removeNote": "Usunięta zostanie tylko ta kolekcja. Gry, zapisy rozgrywki, pobrane pliki i pozostałe kolekcje pozostaną na miejscu.",
  "games.collections.confirmRemove": "Usuń tę kolekcję",
  "games.collections.removeGame": "Usuń {name} z tej kolekcji",
  "games.collections.removeShort": "Usuń z kolekcji",
  "games.collections.added": "Ostatnio dodane najpierw",
  "games.collections.done": "Gotowe",
  "games.collections.save": "Zapisz zmiany",
  "games.collections.collections_name": "Nadaj kolekcji nazwę o długości 1–80 znaków i opis do 240 znaków.",
  "games.collections.collections_duplicate": "Masz już kolekcję o takiej nazwie.",
  "games.collections.collections_limit": "Ten profil osiągnął limit przechowywania kolekcji. Usuń nieużywane kolekcje lub gry i spróbuj ponownie.",
  "games.collections.collections_missing": "Ta kolekcja została usunięta. Wybierz inną.",
  "games.collections.collections_read": "Nie udało się odczytać twoich kolekcji. Zapisane dane nie zostały zastąpione. Spróbuj wczytać je ponownie.",
  "games.collections.collections_write": "Nie udało się zapisać zmiany. Poprzednia kolekcja nadal jest dostępna. Zwolnij trochę miejsca na urządzeniu i spróbuj ponownie.",
  "games.collections.collections_game": "Nie udało się rozpoznać tej gry. Odśwież bibliotekę i spróbuj ponownie.",
  "games.collections.firstNote": "Utwórz kolekcję, a potem dodawaj gry z ich stron szczegółów lub zaznaczaj je w bibliotece. Gry PC i ROM-y mogą być w jednej kolekcji.",
  "games.collections.emptyNote": "Dodawaj gry z ich stron szczegółów albo zaznacz gry w bibliotece i wybierz Dodaj do kolekcji.",
  "games.cache.saved": "Zapisane dane · {date}",
  "games.cache.refresh": "Odśwież",
  "games.cache.refreshing": "Odświeżanie…",
  "games.cache.price": "Otwórz Steam, aby sprawdzić aktualną cenę.",
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
  ...catalog13,
  ...catalog14,
  ...catalog15,
  ...catalog16,
  ...coverage,
  ...plurals,
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
  "games.torrent.share.title": "Udostępnij torrent",
  "games.torrent.share.note": "Udostępniaj sprawdzone pliki innym uczestnikom. Zatrzyma się po osiągnięciu limitu lub zamknięciu Harbor. Zatrzymaj udostępnianie przed zmianą plików.",
  "games.torrent.share.upload": "Limit wysyłania (KB/s)",
  "games.torrent.share.ratio": "Współczynnik (1–10)",
  "games.torrent.share.minutes": "Limit czasu (minuty)",
  "games.torrent.share.start": "Rozpocznij",
  "games.torrent.share.stop": "Zatrzymaj udostępnianie",
  "games.torrent.share.resume": "Wznów udostępnianie",
  "games.torrent.share.checking": "Sprawdzanie plików",
  "games.torrent.share.seeding": "Udostępnianie",
  "games.torrent.share.stopped": "Udostępnianie zatrzymane",
  "games.torrent.share.limitReached": "Osiągnięto limit",
  "games.torrent.share.failed": "Udostępnianie nie powiodło się. Sprawdź pliki i spróbuj ponownie.",
  "games.torrent.share.stats": "Wysłano {uploaded} · {minutes} min",
  "games.torrent.torrent_seed_files": "Gotowe pliki zniknęły, zostały zmienione lub są używane. Sprawdź folder pobierania przed udostępnieniem.",
  "games.torrent.torrent_seed_limits": "Wybierz 32–1 048 576 KB/s, współczynnik 1–10 i czas 1–1 440 minut.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlDesktop026,
};

export default pl;
import videoCast from "./pl/video-cast";
