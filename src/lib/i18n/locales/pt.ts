import jlMediaVision from "./pt/jl-media-vision";
import playOrders from "./pt/play-orders";
import gameRomLibrary from "./pt/game-rom-library";
import gameNotes from "./pt/game-notes";
import gameLibraryRefinements from "./pt/game-library-refinements";
import gamePokemonUi from "./pt/game-pokemon-ui";
import customArtwork from "./pt/custom-artwork";
import gameAtlasDiscovery from "./pt/game-atlas-discovery";
import gameDiscoveryPicker from "./pt/game-discovery-picker";
import gameLibraryManagement from "./pt/game-library-management";
import gameHydraImport from "./pt/game-hydra-import";
import gameStudioCatalog from "./pt/game-studio-catalog";
import gameArtwork from "./pt/game-artwork";
import gameCommunity from "./pt/game-community";
import gameMetadataMatching from "./pt/game-metadata-matching";
import gameAgeRatings from "./pt/game-age-ratings";
import gameLibraryLinks from "./pt/game-library-links";
import gameModHub from "./pt/game-mod-hub";
import gameLibraryTitles from "./pt/game-library-titles";
import gameStoreSearch from "./pt/game-store-search";
import gameSteamShortcuts from "./pt/game-steam-shortcuts";
import gameGallery from "./pt/game-gallery";
import gameStardew from "./pt/game-stardew";
import gamePokemon from "./pt/game-pokemon";
import gameSourceAlerts from "./pt/game-source-alerts";
import gameSims from "./pt/game-sims";
import gameTarkov from "./pt/game-tarkov";
import gameTft from "./pt/game-tft";
import gameEve from "./pt/game-eve";
import gameOsrs from "./pt/game-osrs";
import gameFfxiv from "./pt/game-ffxiv";
import gameFortnite from "./pt/game-fortnite";
import gameSetup from "./pt/game-setup";
import torrentDialog from "./pt/torrent-dialog";
import gameDownloadNotifications from "./pt/game-download-notifications";
import gameDownloadCenter from "./pt/game-download-center";
import warhammerUniverse from "./pt/warhammer-universe";
import gameLeague from "./pt/game-league";
import gameValorant from "./pt/game-valorant";
import gameAudience from "./pt/game-audience";
import gameDetailFlow from "./pt/game-detail-flow";
import gameWowTalents from "./pt/game-wow-talents";
import gameWowProgress from "./pt/game-wow-progress";
import gameWowRuns from "./pt/game-wow-runs";
import gameMediaRelations from "./pt/game-media-relations";
import gameDota from "./pt/game-dota";
import gameOverwatch from "./pt/game-overwatch";
import gameWowEquipment from "./pt/game-wow-equipment";
import gameRecommendations from "./pt/game-recommendations";
import gameOwnedDiscovery from "./pt/game-owned-discovery";
import gameBackups from "./pt/game-backups";
import gameArchives from "./pt/game-archives";
import gameUnifiedLibrary from "./pt/game-unified-library";
import gamePlaytime from "./pt/game-playtime";
import gameLaunchHealth from "./pt/game-launch-health";
import gameSourceDiscovery from "./pt/game-source-discovery";
import gameGuides from "./pt/game-guides";
import gameModUpdates from "./pt/game-mod-updates";
import gameMinecraft from "./pt/game-minecraft";
import gameRoms from "./pt/game-roms";
import gameExploreRows from "./pt/game-explore-rows";
import gameHackDiscovery from "./pt/game-hack-discovery";
import gameHub from "./pt/game-hub";
import gameRetro from "./pt/game-retro";
import floatingPlayer from "./pt/floating-player";
import gameAntiCheat from "./pt/game-anti-cheat";
import gameDock from "./pt/game-dock";
import gameCompanion from "./pt/game-companion";
import gameWow from "./pt/game-wow";
import gameSearch from "./pt/game-search";
import mediaStart from "./pt/media-start";
import spooktober from "./pt/spooktober";
import listenTogether from "./pt/listen-together";
import music from "./pt/music";
import sportsConsent from "./pt/sports-consent";
import sportsStatistics from "./pt/sports-statistics";
import sportsApi from "./pt/sports-api";
import esportsArena from "./pt/esports-arena";
import sportsHub from "./pt/sports-hub";
import ebookSources from "./pt/ebook-sources";
import settingsRefinements from "./pt/settings-refinements";
import experimentalUpdates from "./pt/experimental-updates";
import coverage from "./pt/coverage";
import chrome from "./pt/chrome";
import common from "./pt/common";
import catalog from "./pt/catalog";
import detail from "./pt/detail";
import player from "./pt/player";
import live from "./pt/live";
import settings from "./pt/settings";
import settingsFill from "./pt/settings-fill";
import profileFill from "./pt/profile-fill";
import appFill from "./pt/app-fill";
import library from "./pt/library";
import sync from "./pt/sync";
import lists from "./pt/lists";
import downloads from "./pt/downloads";
import together from "./pt/together";
import rails from "./pt/rails";
import masthead from "./pt/masthead";
import discover from "./pt/discover";
import spotlights from "./pt/spotlights";
import misc from "./pt/misc";
import awards from "./pt/awards";
import addons from "./pt/addons";
import extra from "./pt/extra";
import manga from "./pt/manga";
import controllers from "./pt/controllers";

import bpSources from "./pt/bp-sources";
import used from "./pt/used";
import sweep from "./pt/sweep";
import sourceCoverage from "./pt/source-coverage";
import wired from "./pt/wired";
import wiringSweep from "./pt/wiring-sweep";
import wiringSweep2 from "./pt/wiring-sweep-2";
import wiringSweep3 from "./pt/wiring-sweep-3";
import wiringSweep4 from "./pt/wiring-sweep-4";
import plugins from "./pt/plugins";
import brands from "./pt/brands";
import bpSports from "./pt/bp-sports";

import nytTv from "./pt/nyt-tv";

import gameAchievements from "./pt/game-achievements";

const pt: Record<string, string> = {
  "collections.feed.more": "Carregar mais coleções",
  "collections.feed.error": "Não foi possível carregar as coleções. Tente novamente.",
  "Show content ratings?": "Mostrar classificações de conteúdo?",
  "Age ratings and content notes when playback starts.":
    "Classificação etária e avisos de conteúdo no início da reprodução.",
  ...gameCommunity,
  ...gamePokemon,
  ...torrentDialog,
  "nav.games": "Jogos",
  "games.explore": "Explorar",
  "games.library": "Biblioteca",
  "games.saved": "Favoritos",
  "games.download.nav": "Downloads",
  "games.search": "Buscar jogos",
  ...gameAudience,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "Translations": "Traduções",
  "Translating…": "Traduzindo…",
  "Showing {lang}": "Mostrando {lang}",
  "Show all": "Mostrar tudo",
  "games.download.speed.title": "Velocidade de download",
  "games.download.speed.note": "Compartilhada entre downloads diretos e torrents deste perfil. O limite individual de um torrent pode ser menor.",
  "games.download.speed.unlimited": "Sem limite",
  "games.download.speed.limited": "Limitar velocidade",
  "games.download.speed.rate": "Quilobytes por segundo",
  "games.download.speed.range": "Digite um número inteiro de {min} a {max}.",
  "games.download.speed.error": "Não foi possível carregar ou salvar o ajuste de velocidade. Tente novamente.",
  "games.download.speed.current": "Velocidade de download: {rate}",
  "games.discovery.sale.cards.included": "Cartas colecionáveis",
  "games.discovery.sale.cards.none": "Sem cartas da promoção",
  "games.discovery.sale.cards.unknown": "Cartas não confirmadas",
  "games.discovery.sale.cards.includedNote": "Incluídas nas regras atuais do Steam para cartas de promoções. Abra o Steam para ver como obtê-las.",
  "games.discovery.sale.cards.noneNote": "As regras atuais do Steam não incluem cartas para esta promoção sazonal. Outras recompensas do evento são separadas.",
  "games.discovery.sale.cards.unknownNote": "Não foi possível verificar as regras atuais do Steam para cartas. Abra o Steam para conferir a disponibilidade.",
  "games.discovery.sale.cards.badgeNote": "Reúna um conjunto para criar uma insígnia da promoção, um emoticon e um plano de fundo do perfil.",
  "games.download.storage.title": "Espaço para downloads",
  "games.download.storage.note": "As estimativas incluem downloads diretos, torrents e arquivos temporários, incluindo downloads pausados. Instaladores externos não estão incluídos.",
  "games.download.storage.error": "Não foi possível verificar o armazenamento.",
  "games.download.storage.unavailable": "Espaço livre indisponível",
  "games.download.storage.free": "{size} livres",
  "games.download.storage.remaining": "Espaço adicional: {size}",
  "games.download.storage.estimate": "Alguns arquivos existentes ainda não foram verificados. O espaço necessário pode ser menor.",
  "games.download.storage.unknown": "Tamanho desconhecido: {count} arquivos",
  "games.download.storage.other": "{size} reservados por outras operações do Harbor",
  "games.download.storage.shortfall": "São necessários mais {size} de espaço",
  "games.download.state.retrying": "Tentando conectar novamente",
  "games.download.queueOrder": "Posição na fila: {position}",
  "games.download.earlier": "Mover {name} para antes",
  "games.download.later": "Mover {name} para depois",
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
  "games.selection.partial": "{count} de {total} jogos foram atualizados. Os demais jogos continuam selecionados; tente novamente.",
  "games.selection.failed": "Não foi possível atualizar os jogos selecionados. Tente novamente.",
  "games.custom.nav": "Jogos locais",
  "games.libraryPersonal.visibility": "Visibilidade na biblioteca",
  "games.libraryPersonal.visible": "Seus jogos",
  "games.libraryPersonal.pinned": "Fixados",
  "games.libraryPersonal.hidden": "Ocultos",
  "games.library.sort": "Ordenar biblioteca",
  "games.selection.start": "Selecionar",
  "games.selection.game": "Selecionar {name}",
  "games.selection.actions": "Ações dos jogos selecionados",
  "games.selection.count": "{count} selecionados",
  "games.selection.clear": "Limpar seleção",
  "games.selection.all": "Selecionar todos ({count})",
  "games.selection.pinned": "Jogos fixados: {count}.",
  "games.selection.unpinned": "Jogos desafixados: {count}.",
  "games.selection.hidden": "Jogos ocultados: {count}. Encontre-os em Ocultos.",
  "games.selection.shown": "Jogos exibidos na sua biblioteca: {count}.",
  "games.selection.show": "Mostrar na biblioteca",
  "games.selection.hide": "Ocultar",
  "games.selection.pin": "Fixar",
  "games.selection.unpin": "Desafixar",
  "games.selection.matchNote": "Alguns jogos selecionados estão indisponíveis. Atualize sua biblioteca e tente novamente.",
  "games.selection.collection": "Adicionar à coleção",
  "games.collections.localMissing": "Não está mais na biblioteca deste perfil",
  "games.collections.dynamic": "Coleção baseada em filtros",
  "games.collections.manual": "Escolher os jogos",
  "games.collections.type": "Tipo de coleção",
  "games.collections.filters": "Filtros da coleção",
  "games.collections.ruleQuery": "O título do jogo contém",
  "games.collections.autoNote": "Os jogos entram ou saem desta coleção automaticamente conforme correspondem aos filtros na sua biblioteca.",
  "games.collections.pickerAutoNote": "As coleções baseadas em filtros são atualizadas automaticamente. Gerencie seus filtros em Coleções.",
  "games.collections.matches": "Jogos correspondentes: {count}",
  "games.collections.emptyDynamic": "Nenhum jogo da biblioteca corresponde a estes filtros. Altere os filtros ou adicione mais jogos à biblioteca.",
  "games.collections.collections_rules": "Não foi possível ler os filtros desta coleção. Os dados salvos não foram substituídos.",
  "games.collections.collections_dynamic": "Esta coleção é atualizada automaticamente. Altere seus filtros em Coleções para mudar os jogos que aparecem.",
  "games.collections.title": "Coleções",
  "games.collections.personal": "Criadas por você",
  "games.collections.note": "Um lugar para cada tipo de jogo. Agrupe favoritos, jogos para depois e mundos que merecem outra visita.",
  "games.collections.addTo": "Adicionar à coleção",
  "games.collections.count": "{count} jogos",
  "games.collections.one": "1 jogo",
  "games.collections.search": "Buscar nas suas coleções",
  "games.collections.name": "Nome da coleção",
  "games.collections.newName": "Dê um nome à nova coleção",
  "games.collections.create": "Criar",
  "games.collections.first": "Sua primeira coleção começa aqui.",
  "games.collections.noMatches": "Nenhuma coleção correspondente.",
  "games.collections.pickerNote": "Escolha quantas quiser. As alterações são salvas conforme você faz as escolhas.",
  "games.collections.empty": "Espaço para sua próxima paixão.",
  "games.collections.findGames": "Encontrar jogos",
  "games.collections.description": "Algumas palavras sobre ela",
  "games.collections.edit": "Editar coleção",
  "games.collections.pin": "Fixar coleção",
  "games.collections.unpin": "Desafixar coleção",
  "games.collections.remove": "Remover coleção",
  "games.collections.removeNote": "Apenas esta coleção é removida. Seus jogos, arquivos salvos, downloads e outras coleções permanecem.",
  "games.collections.confirmRemove": "Remover esta coleção",
  "games.collections.removeGame": "Remover {name} desta coleção",
  "games.collections.removeShort": "Remover da coleção",
  "games.collections.added": "Adicionados recentemente primeiro",
  "games.collections.done": "Concluído",
  "games.collections.save": "Salvar alterações",
  "games.collections.collections_name": "Dê à coleção um nome de 1–80 caracteres e uma descrição de até 240 caracteres.",
  "games.collections.collections_duplicate": "Você já tem uma coleção com esse nome.",
  "games.collections.collections_limit": "Este perfil atingiu o limite de armazenamento de coleções. Remova coleções ou jogos que não usa e tente novamente.",
  "games.collections.collections_missing": "Esta coleção foi removida. Escolha outra.",
  "games.collections.collections_read": "Não foi possível ler suas coleções. Os dados salvos não foram substituídos. Tente carregá-las novamente.",
  "games.collections.collections_write": "Não foi possível salvar a alteração. Sua coleção anterior continua aqui. Libere espaço no dispositivo e tente novamente.",
  "games.collections.collections_game": "Não foi possível identificar este jogo. Atualize sua biblioteca e tente novamente.",
  "games.collections.firstNote": "Crie uma coleção e adicione jogos pelas páginas de detalhes ou selecione-os na sua biblioteca. Jogos de PC e ROMs podem ficar juntos.",
  "games.collections.emptyNote": "Adicione jogos pelas páginas de detalhes ou selecione jogos na sua biblioteca e escolha Adicionar à coleção.",
  "games.cache.saved": "Dados salvos · {date}",
  "games.cache.refresh": "Atualizar",
  "games.cache.refreshing": "Atualizando…",
  "games.cache.price": "Abra o Steam para conferir o preço atual.",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...ebookSources,
  ...coverage,
  ...chrome,
  ...common,
  ...catalog,
  ...detail,
  ...player,
  ...live,
  ...settings,
  ...settingsFill,
  ...profileFill,
  ...appFill,
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
  ...used,
  ...sweep,
  ...sourceCoverage,
  ...wired,
  ...wiringSweep,
  ...wiringSweep2,
  ...wiringSweep3,
  ...wiringSweep4,
  ...experimentalUpdates,
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
  "games.torrent.share.title": "Compartilhar torrent",
  "games.torrent.share.note": "Compartilhe arquivos verificados com outros pares. Para ao atingir um limite ou fechar o Harbor. Pare o compartilhamento antes de alterar os arquivos.",
  "games.torrent.share.upload": "Limite de envio (KB/s)",
  "games.torrent.share.ratio": "Proporção (1–10)",
  "games.torrent.share.minutes": "Limite de tempo (minutos)",
  "games.torrent.share.start": "Iniciar compartilhamento",
  "games.torrent.share.stop": "Parar compartilhamento",
  "games.torrent.share.resume": "Retomar compartilhamento",
  "games.torrent.share.checking": "Verificando arquivos",
  "games.torrent.share.seeding": "Compartilhando",
  "games.torrent.share.stopped": "Compartilhamento parado",
  "games.torrent.share.limitReached": "Limite atingido",
  "games.torrent.share.failed": "Falha ao compartilhar. Verifique os arquivos e tente novamente.",
  "games.torrent.share.stats": "{uploaded} enviados · {minutes} min",
  "games.torrent.torrent_seed_files": "Os arquivos estão ausentes, alterados ou em uso. Verifique a pasta de downloads antes de compartilhar.",
  "games.torrent.torrent_seed_limits": "Escolha 32–1.048.576 KB/s, proporção de 1–10 e tempo de 1–1.440 minutos.",

  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlMediaVision,
};

export default pt;
import videoCast from "./pt/video-cast";
