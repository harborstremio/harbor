/// The Portuguese (Brazilian) translation catalog. Keys are the English
/// source strings; any key not present here falls back to English. The web
/// app's authoritative `src/lib/i18n/locales/pt.ts` values are used verbatim
/// where they exist; the remaining UI strings — which the web app never
/// localised — are translated to match, mirroring the [arCatalog] key set.
const ptCatalog = <String, String>{
  '#{position} in {label} Today': '#{position} em {label} hoje',
  'Top 10 {name}': 'Top 10 {name}',
  'Nothing in progress yet. Press Play on something.':
      'Nada em andamento ainda. Aperte Play em algo.',
  'Sign in to': 'Entrar em',
  'to bring in your library.': 'para importar sua biblioteca.',
  'Add': 'Adicionar',
  'Add Custom Source': 'Adicionar Fonte Personalizada',
  'Add Source': 'Adicionar Fonte',
  'An error occurred': 'Ocorreu um erro',
  'Failed to fetch JSON': 'Falha ao buscar o JSON',
  'Invalid SourceRow JSON format': 'Formato JSON de SourceRow inválido',
  'JSON URL': 'URL do JSON',
  'JSON cannot be empty': 'O JSON não pode estar vazio',
  'Paste JSON': 'Colar JSON',
  'Provide a JSON link or paste it directly.':
      'Forneça um link JSON ou cole-o diretamente.',
  'Source': 'Fonte',
  'URL cannot be empty': 'A URL não pode estar vazia',
  'Back': 'Voltar',
  'Cancel': 'Cancelar',
  'Change': 'Alterar',
  'Clear': 'Limpar',
  'Close': 'Fechar',
  'Collapse': 'Recolher',
  'Delete': 'Excluir',
  'Dismiss': 'Dispensar',
  'Done': 'Concluído',
  'Edit': 'Editar',
  'Favorite': 'Favoritar',
  'Favorited': 'Favoritado',
  'Hide': 'Ocultar',
  'Leave': 'Sair',
  'List': 'Lista',
  'Load more': 'Carregar mais',
  'Loading': 'Carregando',
  'Looks good': 'Parece bom',
  'Manage': 'Gerenciar',
  'More': 'Mais',
  'More actions': 'Mais ações',
  'Move down': 'Mover para baixo',
  'Move up': 'Mover para cima',
  'New': 'Novo',
  'Normal': 'Normal',
  'Playback speed': 'Velocidade de reprodução',
  'Speed & sleep': 'Velocidade e suspensão',
  'Sleep timer': 'Temporizador de suspensão',
  '1 hour': '1 hora',
  'End of episode': 'Fim do episódio',
  'End of next episode': 'Fim do próximo episódio',
  'Sleep at end of episode': 'Suspender no fim do episódio',
  'Sleep off': 'Suspensão desligada',
  'Remove': 'Remover',
  'Rename': 'Renomear',
  'Rename row': 'Renomear linha',
  'Renamed': 'Renomeado',
  'Reset': 'Redefinir',
  'Reset to default': 'Redefinir para o padrão',
  'Save': 'Salvar',
  'Saved': 'Salvo',
  'Search': 'Buscar',
  'Play this video URL': 'Reproduzir este URL de vídeo',
  'From your add-ons': 'Dos seus complementos',
  'See all': 'Ver tudo',
  'Send': 'Enviar',
  'Show': 'Mostrar',
  'Show less': 'Mostrar menos',
  'Show more': 'Mostrar mais',
  'Sign in': 'Entrar',
  'Sign out': 'Sair',
  'Status': 'Status',
  'Stop': 'Parar',
  'Sync': 'Sincronizar',
  'Try again': 'Tentar novamente',
  'Unknown': 'Desconhecido',
  'Untitled': 'Sem título',
  'Clear search': 'Limpar busca',
  'Copied to clipboard': 'Copiado para a área de transferência',
  'Copy link': 'Copiar link',
  'Copy URL': 'Copiar URL',
  'Detecting': 'Detectando',
  'Detecting...': 'Detectando...',
  'Filtered': 'Filtrado',
  'Grouped': 'Agrupado',
  'No matches': 'Nenhum resultado',
  'Nothing here yet': 'Nada aqui ainda',
  'Pinned': 'Fixado',
  'Refine search': 'Refinar busca',
  'Searching': 'Buscando',
  'Searching…': 'Buscando…',
  'loading more…': 'carregando mais…',
  '{n} item': '{n} item',
  '{n} items': '{n} itens',
  '{n} title': '{n} título',
  '{n} titles': '{n} títulos',
  '{n} source': '{n} fonte',
  '{n} sources': '{n} fontes',
  '{n} sources available': '{n} fontes disponíveis',
  '{n} source across {count} addons': '{n} fonte em {count} extensões',
  '{n} sources across {count} addons': '{n} fontes em {count} extensões',
  '{n} provider': '{n} provedor',
  '{n} providers': '{n} provedores',
  '{n} genre': '{n} gênero',
  '{n} genres': '{n} gêneros',
  '{n} people': '{n} pessoas',
  '{n} country': '{n} país',
  '{n} countries': '{n} países',
  '{n} active': '{n} ativos',
  '{n} hidden': '{n} ocultos',
  '{n} min': '{n} min',
  'min': 'min',
  '{n} votes': '{n} votos',
  '{n} award': '{n} prêmio',
  '{n} awards': '{n} prêmios',
  '{n} ep': '{n} ep',
  '{n} eps': '{n} eps',
  '{n} episode': '{n} episódio',
  '{n} episodes': '{n} episódios',
  '+{n} ep': '+{n} ep',
  '+{n} more': '+{n} mais',
  '{count} dl': '{count} dl',
  '{shown} of {total}': '{shown} de {total}',
  '{label} · {n} collection': '{label} · {n} coleção',
  '{label} · {n} collections': '{label} · {n} coleções',
  'Today': 'Hoje',
  'tomorrow': 'amanhã',
  'next week': 'próxima semana',
  'in {d} days': 'em {d} dias',
  'in {n} weeks': 'em {n} semanas',
  '{m}m ago': 'há {m}m',
  '{s}s ago': 'há {s}s',
  '{m}m {s}s ago': 'há {m}m {s}s',
  '{m}m left': '{m}m restantes',
  '{s}s left': '{s}s restantes',
  '{h}h left': '{h}h restantes',
  '{h}h {m}m left': '{h}h {m}m restantes',
  'Add to Home': 'Adicionar à Início',
  'On Home': 'No Início',
  'Watched on Trakt': 'Assistido no Trakt',
  'Paused on Simkl': 'Pausado no Simkl',
  'Ep {n}': 'Ep {n}',
  '1 new episode since you last watched':
      '1 novo episódio desde a última vez que assistiu',
  '{n} new episodes since you last watched':
      '{n} novos episódios desde a última vez que assistiu',
  '{pct}% watched': '{pct}% assistido',
  'added': 'adicionado',
  'default': 'padrão',
  'local': 'local',
  'Continue': 'Continuar',
  'Quick age check': 'Verificação rápida de idade',
  "A quick age check before adult add-ons unlock. Answer three everyday questions any adult would know, and you're in.":
      'Uma verificação rápida de idade antes de liberar as extensões adultas. Responda três perguntas cotidianas que qualquer adulto saberia, e pronto.',
  "You're verified": 'Você foi verificado',
  "That's not it. Try a fresh round in a moment.":
      'Não é isso. Tente uma nova rodada em instantes.',

  // The navigation rail labels (`chrome` namespace).
  'nav.home': 'Início',
  'nav.discover': 'Descobrir',
  'nav.movies': 'Filmes',
  'nav.shows': 'Séries',
  'nav.anime': 'Animes',
  'nav.live': 'TV ao Vivo',
  'nav.playlists': 'Playlists',
  'nav.calendar': 'Calendário',
  'nav.library': 'Minha Biblioteca',
  'nav.downloads': 'Downloads',
  'nav.addons': 'Extensões',
  'nav.settings': 'Configurações',
  'nav.collections': 'Coleções',
  'nav.arabic': 'العربية',

  // The search view (`search` / `spotlights` namespaces).
  'Search movies, shows, people…': 'Buscar filmes, séries, pessoas…',
  'Search failed.': 'A busca falhou.',
  'No matches for "{q}"': 'Nenhum resultado para "{q}"',
  "Try a different spelling, a person's name, a year like \"1972\", or a genre like \"Horror\".":
      'Tente uma grafia diferente, o nome de uma pessoa, um ano como "1972" ou um gênero como "Terror".',
  'Search for movies, shows and people.':
      'Busque por filmes, séries e pessoas.',
  'RECENT': 'RECENTES',
  'AI search': 'Busca com IA',
  'Describe a plot, a vibe, or even a specific episode by a scene — the AI finds matching titles.':
      'Descreva um enredo, um clima ou até um episódio específico por uma cena — a IA encontra os títulos correspondentes.',
  'Add an AI key': 'Adicionar uma chave de IA',
  'Set an OpenRouter or Groq key under Settings to use AI search.':
      'Defina uma chave OpenRouter ou Groq nas Configurações para usar a busca com IA.',
  'AI search failed': 'A busca com IA falhou',
  'The model could not be reached. Try again in a moment.':
      'Não foi possível acessar o modelo. Tente novamente em instantes.',
  'The AI could not find titles for that. Try describing it differently.':
      'A IA não encontrou títulos para isso. Tente descrever de outra forma.',
  'Listening…': 'Ouvindo…',
  'Say a title, a person, or describe what you want to watch.':
      'Diga um título, uma pessoa ou descreva o que você quer assistir.',
  'Microphone is off': 'O microfone está desligado',
  'Harbor needs microphone access to search by voice. Turn it on in your device settings, then try again.':
      'O Harbor precisa de acesso ao microfone para buscar por voz. Ative-o nas configurações do seu dispositivo e tente novamente.',
  'Voice search unavailable': 'Busca por voz indisponível',
  "This device doesn't offer speech recognition.":
      'Este dispositivo não oferece reconhecimento de fala.',
  "Didn't catch that": 'Não entendi',
  'The microphone stopped before anything was recognized. Try again.':
      'O microfone parou antes de reconhecer algo. Tente novamente.',
  'Movies': 'Filmes',
  'Series': 'Séries',
  'Movie': 'Filme',
  'Open': 'Abrir',

  // The downloads view (`downloads` namespace).
  'Saved movies and episodes for offline watching':
      'Filmes e episódios salvos para assistir offline',
  'Nothing downloaded yet.': 'Nada baixado ainda.',
  '{n} downloading': '{n} baixando',
  '{size} saved': '{size} salvos',
  'Paused': 'Pausado',
  'Download failed': 'Falha no download',
  'Canceled': 'Cancelado',
  'Interrupted — re-download to finish':
      'Interrompido — baixe novamente para concluir',
  'Pause': 'Pausar',
  'Resume': 'Retomar',
  'Play': 'Reproduzir',

  // The calendar view (`calendar` namespace) — chrome, months, and weekdays.
  'RELEASES': 'LANÇAMENTOS',
  'All': 'Todas',
  'Previous month': 'Mês anterior',
  'Next month': 'Próximo mês',
  'Anticipated': 'Aguardados',
  'Premieres': 'Estreias',
  'Library': 'Biblioteca',
  'Start week on Monday': 'Começar a semana na segunda',
  'TV': 'Séries',
  'Anime': 'Animes',
  'The calendar could not be loaded.':
      'Não foi possível carregar o calendário.',
  'Add a TMDB key in Settings to see the calendar.':
      'Adicione uma chave do TMDB nas Configurações para ver o calendário.',
  'Nothing in your library releases this month.':
      'Nada da sua biblioteca é lançado este mês.',
  'No upcoming releases from Trakt this month.':
      'Nenhum lançamento do Trakt este mês.',
  'Nothing in your Simkl lists releases this month.':
      'Nada das suas listas do Simkl é lançado este mês.',
  'No anticipated releases this month.':
      'Nenhum lançamento aguardado este mês.',
  'No premieres this month.': 'Nenhuma estreia este mês.',
  'No releases this month.': 'Nenhum lançamento este mês.',
  'January': 'Janeiro',
  'February': 'Fevereiro',
  'March': 'Março',
  'April': 'Abril',
  'May': 'Maio',
  'June': 'Junho',
  'July': 'Julho',
  'August': 'Agosto',
  'September': 'Setembro',
  'October': 'Outubro',
  'November': 'Novembro',
  'December': 'Dezembro',
  'Sun': 'Dom',
  'Mon': 'Seg',
  'Tue': 'Ter',
  'Wed': 'Qua',
  'Thu': 'Qui',
  'Fri': 'Sex',
  'Sat': 'Sáb',

  // The detail view's episode list (`detail` namespace).
  'Episodes': 'Episódios',
  'Oldest': 'Mais antigos',
  'Newest': 'Mais recentes',
  'Download season': 'Baixar temporada',
  'Ask AI': 'Perguntar à IA',
  'Describe the episode.': 'Descreva o episódio.',
  'Find': 'Buscar',
  'No episode matched that.': 'Nenhum episódio correspondeu a isso.',
  'Showing keyword matches instead':
      'Mostrando correspondências por palavra-chave',
  "Ask AI to find an episode by vibe — a scene you remember, a quote, or a moment you can't place.":
      'Peça à IA para encontrar um episódio pelo clima — uma cena que você lembra, uma citação ou um momento que não consegue situar.',
  'Mark as unwatched': 'Marcar como não assistido',
  'Mark as watched': 'Marcar como assistido',
  'Mark watched up to here': 'Marcar como assistido até aqui',

  // The detail view's rails, info panel, and layout editor.
  'Could not load this title.': 'Não foi possível carregar este título.',
  'Crew': 'Equipe',
  'Cast': 'Elenco',
  'Collection': 'Coleção',
  'Collections': 'Coleções',
  '{count} films': '{count} filmes',
  'View all': 'Ver tudo',
  'Upcoming': 'Em breve',
  'in {n}wks': 'em {n} sem.',
  'Add a comment…': 'Adicionar um comentário…',
  'Contains spoiler': 'Contém spoiler',
  'Post': 'Publicar',
  'Comments must be at least 5 words.':
      'Os comentários devem ter pelo menos 5 palavras.',
  'This title could not be posted to.':
      'Não foi possível publicar neste título.',
  'Could not post your comment. Try again.':
      'Não foi possível publicar seu comentário. Tente novamente.',
  'Sign in to Trakt in Settings to add a comment.':
      'Entre no Trakt nas Configurações para adicionar um comentário.',
  'Not officially released yet. Click to search anyway in case of an early release.':
      'Ainda não lançado oficialmente. Clique para buscar mesmo assim, caso haja lançamento antecipado.',
  'More Like This': 'Mais como este',
  'You Might Also Like': 'Você também pode gostar',
  'Gallery': 'Galeria',
  'Information': 'Informações',
  'Seasons': 'Temporadas',
  'First aired': 'Primeira exibição',
  'Last aired': 'Última exibição',
  'Networks': 'Emissoras',
  'Studio': 'Estúdio',
  'Country': 'País',
  'Original language': 'Idioma original',
  'Original title': 'Título original',
  'Genres': 'Gêneros',
  'Budget': 'Orçamento',
  'Revenue': 'Receita',
  'Rating': 'Avaliação',
  'Done editing': 'Concluir edição',
  'Customize layout': 'Personalizar layout',
  'episodes': 'episódios',
  'votes': 'votos',

  // The anime episode list (`detail` namespace) — search, filler, air dates.
  'Search episodes': 'Buscar episódios',
  'No episodes match your search': 'Nenhum episódio corresponde à sua busca',
  'FILLER': 'FILLER',
  'Episode {n}': 'Episódio {n}',
  // In-player episode panel ("Up Next" drawer).
  'Up Next': 'A Seguir',
  'Now Playing': 'A Reproduzir',
  'Now playing: {label}': 'A reproduzir: {label}',
  'Season {n}': 'Temporada {n}',
  'Restart': 'Recomeçar',
  'No description available.': 'Nenhuma descrição disponível.',
  'No episodes found for this season.':
      'Nenhum episódio encontrado para esta temporada.',
  'Instant Play: choosing an episode queues its stream automatically.':
      'Reprodução instantânea: escolher um episódio adiciona a sua stream automaticamente.',
  'Choosing an episode opens the source picker for it.':
      'Escolher um episódio abre o seletor de fontes.',

  // Short month names for episode air dates (the `_monthAbbr` list).
  'Jan': 'Jan',
  'Feb': 'Fev',
  'Mar': 'Mar',
  'Apr': 'Abr',
  'Jun': 'Jun',
  'Jul': 'Jul',
  'Aug': 'Ago',
  'Sep': 'Set',
  'Oct': 'Out',
  'Nov': 'Nov',
  'Dec': 'Dez',

  // The detail hero actions and the add-to-list menu.
  'Resume S{s}:E{e}': 'Retomar T{s}:E{e}',
  'In Watchlist': 'Na lista',
  'Add to Watchlist': 'Adicionar à lista',
  'No lists yet. Create your first one below.':
      'Nenhuma lista ainda. Crie a primeira abaixo.',
  'ADD TO LIST': 'ADICIONAR À LISTA',
  'List name…': 'Nome da lista…',
  'Create new list': 'Criar nova lista',

  // The episode detail page.
  'Add a TMDB key to view episode details.':
      'Adicione uma chave do TMDB para ver os detalhes do episódio.',
  'Play Episode': 'Reproduzir Episódio',
  'Stills': 'Capturas',

  // The awards block (`awards` / `misc` namespaces).
  'Awards & Recognition': 'Prêmios e Reconhecimento',
  'Academy Awards': 'Oscar',
  'Primetime Emmys': 'Emmys do Horário Nobre',
  'BAFTA Awards': 'Prêmios BAFTA',
  'Golden Globes': 'Globo de Ouro',
  'Screen Actors Guild Awards': 'Prêmios do Sindicato dos Atores',
  "Critics' Choice Awards": 'Prêmios da Escolha da Crítica',
  'Cannes Film Festival': 'Festival de Cinema de Cannes',
  'Venice Film Festival': 'Festival de Cinema de Veneza',
  'Berlin Film Festival': 'Festival de Cinema de Berlim',
  'Other Awards': 'Outros Prêmios',
  'Awards': 'Prêmios',
  'WIN': 'VITÓRIA',
  'WINS': 'VITÓRIAS',
  '{n} NOMINATION': '{n} INDICAÇÃO',
  '{n} NOMINATIONS': '{n} INDICAÇÕES',
  'ALSO NOMINATED': 'TAMBÉM INDICADO',
  'Recognized at the {award}.': 'Reconhecido em {award}.',

  // The home screen (rails, continue-watching, hero).
  'Could not load catalogs.': 'Não foi possível carregar os catálogos.',
  'Retry': 'Tentar novamente',
  'No catalogs yet.': 'Nenhum catálogo ainda.',
  'Continue Watching': 'Continuar assistindo',
  'Home': 'Início',
  'Your TV': 'Sua TV',
  'at {time}': 'às {time}',
  'On now': 'No ar agora',
  'Browse by country': 'Navegar por país',
  'Continue watching': 'Continuar assistindo',
  'Your favorites': 'Seus favoritos',
  'View details': 'Ver detalhes',
  'In watchlist': 'Na lista',
  'Add to watchlist': 'Adicionar à lista',
  'Remove from Continue Watching': 'Remover de Continuar assistindo',
  'Year': 'Ano',
  'Runtime': 'Duração',
  'My Watchlist': 'Minha Lista',
  'Your Streaming': 'Seu Streaming',

  // The Live TV screen (`live` namespace).
  'Add source': 'Adicionar fonte',
  'Copy as M3U': 'Copiar como M3U',
  'Uncategorized': 'Sem categoria',
  'Unpin': 'Desafixar',
  'Pin to top': 'Fixar no topo',
  'Remove favourite': 'Remover dos favoritos',
  'Add favourite': 'Adicionar aos favoritos',
  'Match EPG': 'Vincular EPG',
  'No EPG is loaded for this source.': 'Nenhum EPG carregado para esta fonte.',
  'No IPTV sources yet.': 'Nenhuma fonte IPTV ainda.',
  'Could not load this playlist.': 'Não foi possível carregar esta playlist.',
  'Grid': 'Grade',
  'Guide': 'Guia',
  'Search channels': 'Buscar canais',
  'No channels in this group.': 'Nenhum canal neste grupo.',
  'No channels match "{q}"': 'Nenhum canal corresponde a "{q}"',
  'No program info': 'Sem informações de programa',

  // The IPTV add/edit-source form.
  'Type': 'Tipo',
  'Name': 'Nome',
  'Direct .m3u link': 'Link .m3u direto',
  'Server + login': 'Servidor + login',
  'XMLTV only': 'Apenas XMLTV',
  'M3U URL': 'URL M3U',
  'EPG URL (optional)': 'URL do EPG (opcional)',
  'Server': 'Servidor',
  'Username': 'Usuário',
  'Password': 'Senha',
  'XMLTV URL': 'URL XMLTV',

  // The anime tracker-sync status toast ({tracker} = MyAnimeList / AniList).
  'Syncing to {tracker}': 'Sincronizando com {tracker}',
  'Synced to {tracker}': 'Sincronizado com {tracker}',
  'Now watching on {tracker}': 'Assistindo agora no {tracker}',
  '{tracker} sync': 'Sincronização com {tracker}',

  // The Live TV program guide + EPG-match dialog.
  'CHANNEL': 'CANAL',
  'Loading program listings… channels are ready to play in the meantime.':
      'Carregando a programação… os canais já estão prontos para reproduzir enquanto isso.',
  'Search guide channels': 'Buscar canais do guia',
  'No guide channels match.': 'Nenhum canal do guia corresponde.',
  'Clear current match': 'Limpar vínculo atual',
  'Pick the guide channel for "{name}".':
      'Escolha o canal do guia para "{name}".',

  // The profile switcher + editor.
  'Switch profile': 'Alternar perfil',
  'No profiles yet.': 'Nenhum perfil ainda.',
  'Add profile': 'Adicionar perfil',
  'Profile': 'Perfil',
  'KID': 'INFANTIL',
  'Edit profile': 'Editar perfil',
  'New profile': 'Novo perfil',
  'Profile name': 'Nome do perfil',
  'Kid profile': 'Perfil infantil',
  'A simplified, kid-safe experience.':
      'Uma experiência simplificada e segura para crianças.',
  'Create': 'Criar',

  // The parental PIN dialogs (unlock + set).
  'Enter PIN': 'Digite o PIN',
  'This profile is locked. Enter the PIN to continue.':
      'Este perfil está bloqueado. Digite o PIN para continuar.',
  'Incorrect PIN. Try again.': 'PIN incorreto. Tente novamente.',
  'Unlock': 'Desbloquear',
  'Set a PIN': 'Definir um PIN',
  "Pick a PIN. You'll be asked for it before this profile's locked tabs open.":
      'Escolha um PIN. Ele será solicitado antes de abrir as abas bloqueadas deste perfil.',
  'New PIN': 'Novo PIN',
  'Confirm PIN': 'Confirmar PIN',
  'Use at least 4 digits.': 'Use pelo menos 4 dígitos.',
  'Enter current PIN': 'Digite o PIN atual',
  'Confirm your current PIN, then pick a new one.':
      'Confirme o PIN atual e escolha um novo.',
  'Confirm your current PIN to remove the lock.':
      'Confirme o PIN atual para remover o bloqueio.',

  // The Library and On-Demand (VOD) screens.
  'MY LIBRARY': 'MINHA BIBLIOTECA',
  'Watchlist': 'Lista',
  'Your collection.': 'Sua coleção.',
  'Watchlist is what you’ve saved for later. History is everything you’ve watched.':
      'A lista é o que você salvou para depois. O histórico é tudo o que você assistiu.',
  'Title': 'Título',
  'Nothing here.': 'Nada aqui.',
  'Could not load this library.': 'Não foi possível carregar esta biblioteca.',
  'This week': 'Esta semana',
  'This month': 'Este mês',
  'Filter your watchlist': 'Filtrar sua lista',
  'Your Trakt library is empty.': 'Sua biblioteca do Trakt está vazia.',
  'Your Simkl library is empty.': 'Sua biblioteca do Simkl está vazia.',
  'Your Letterboxd library is empty.': 'Sua biblioteca do Letterboxd está vazia.',
  'Your MyAnimeList library is empty.': 'Sua biblioteca do MyAnimeList está vazia.',
  'Your watchlist is empty': 'Sua lista está vazia',
  'Add titles to your watchlist and they will show up here.':
      'Adicione títulos à sua lista e eles aparecerão aqui.',
  'No on-demand movies or series in your sources.':
      'Nenhum filme ou série sob demanda nas suas fontes.',
  'On Demand': 'Sob Demanda',
  'Search on-demand': 'Buscar sob demanda',

  // Custom lists — import, create and manage saved lists.
  'Add a list': 'Adicionar uma lista',
  'Add list': 'Adicionar lista',
  'Bring your lists with you': 'Leve suas listas com você',
  'Create your first list': 'Crie sua primeira lista',
  'List URL or ID': 'URL ou ID da lista',
  'My Lists': 'Minhas Listas',
  'My list': 'Minha lista',
  'New list': 'Nova lista',
  'No lists saved yet.': 'Nenhuma lista salva ainda.',
  'No lists yet': 'Nenhuma lista ainda',
  'One list': 'Uma lista',
  'Paste a Trakt, MDBList, TMDB, Letterboxd, IMDb, or MAL list URL':
      'Cole uma URL de lista do Trakt, MDBList, TMDB, Letterboxd, IMDb ou MAL',
  'Paste a public list from Trakt, MDBList, TMDB, Letterboxd, IMDb, or MyAnimeList. Harbor pulls the titles in and keeps the artwork sharp.':
      'Cole uma lista pública do Trakt, MDBList, TMDB, Letterboxd, IMDb ou MyAnimeList. O Harbor traz os títulos e mantém as imagens nítidas.',
  'Remove list "{name}"?': 'Remover a lista "{name}"?',
  'Rename list': 'Renomear lista',
  'This list is empty. Add titles from any detail page.':
      'Esta lista está vazia. Adicione títulos de qualquer página de detalhes.',
  "Use the primary profile's Stremio library, watchlist, and addons.":
      'Usar a biblioteca, a lista e as extensões do Stremio do perfil principal.',
  'Weekend watchlist': 'Lista de fim de semana',
  '{n} / {max} lists': '{n} / {max} listas',
  '{source} list detected': '{source} lista detectada',

  // The AniList library tab.
  'Add anime to your AniList and they show up here, grouped by status and ready to edit.':
      'Adicione animes ao seu AniList e eles aparecerão aqui, agrupados por status e prontos para editar.',
  'AniList': 'AniList',
  "Couldn't reach AniList. Try refreshing.":
      'Não foi possível acessar o AniList. Tente atualizar.',
  'Loading your AniList…': 'Carregando seu AniList…',
  'Your AniList is empty': 'Seu AniList está vazio',

  // The watch-history tab.
  'History': 'Histórico',
  'Loading your history…': 'Carregando seu histórico…',
  'No history yet': 'Nenhum histórico ainda',
  'Nothing watched yet': 'Nada assistido ainda',
  'Watched': 'Assistido',

  // The profile picker and profile management.
  'Manage profiles': 'Gerenciar perfis',
  'Pick a profile to continue.': 'Escolha um perfil para continuar.',
  "Press play on something. It'll show up here once you start watching.":
      'Dê play em algo. Aparecerá aqui assim que você começar a assistir.',
  'Select a profile to edit.': 'Selecione um perfil para editar.',
  "Sign in to Stremio or connect Trakt to see what you've been watching here.":
      'Entre no Stremio ou conecte o Trakt para ver o que você tem assistido aqui.',
  "Who's watching?": 'Quem está assistindo?',

  // Profile PINs and the parental sidebar lock.
  'A 4-digit PIN is required to open this profile.':
      'É necessário um PIN de 4 dígitos para abrir este perfil.',
  'A grown-up can enter the parent PIN to keep watching.':
      'Um adulto pode inserir o PIN dos pais para continuar assistindo.',
  'Confirm your PIN': 'Confirme seu PIN',
  'Enter the parent PIN': 'Insira o PIN dos pais',
  "Enter {name}'s PIN": 'Insira o PIN de {name}',
  'Hide sidebar tabs behind the PIN.':
      'Ocultar as abas da barra lateral atrás do PIN.',
  'Keep typing, or paste the full list URL.':
      'Continue digitando ou cole a URL completa da lista.',
  'Lock sidebar tabs': 'Bloquear abas da barra lateral',
  'Lock this profile behind a 4-digit PIN.':
      'Bloqueie este perfil com um PIN de 4 dígitos.',
  'Locked tabs': 'Abas bloqueadas',
  'Locks only activate once a PIN is set.':
      'Os bloqueios só são ativados após definir um PIN.',
  'PIN set': 'PIN definido',
  "PINs didn't match. Start over.": 'Os PINs não coincidem. Comece de novo.',
  'Parent PIN': 'PIN dos pais',
  "Pick a 4-digit PIN. You'll be asked for it before this profile opens.":
      'Escolha um PIN de 4 dígitos. Ele será solicitado antes de abrir este perfil.',
  'Profile PIN': 'PIN do perfil',
  'Profile is locked. Enter the 4-digit PIN to continue.':
      'O perfil está bloqueado. Insira o PIN de 4 dígitos para continuar.',
  'Set PIN': 'Definir PIN',
  'Set a PIN for {name}': 'Definir um PIN para {name}',
  'Set parent PIN': 'Definir PIN dos pais',
  'Set the parent PIN': 'Defina o PIN dos pais',
  'Sidebar access': 'Acesso à barra lateral',
  'Sign in from the sidebar after saving. Library and addons stay separate.':
      'Entre pela barra lateral após salvar. Biblioteca e extensões permanecem separadas.',
  'Type the same 4-digit PIN again.':
      'Digite o mesmo PIN de 4 dígitos novamente.',
  "When time's up, the ship sails away until a parent unlocks it.":
      'Quando o tempo acabar, o navio parte até que um dos pais o desbloqueie.',
  'Wrong PIN': 'PIN incorreto',
  '{n} tabs locked': '{n} abas bloqueadas',

  // The kids time-limit lock screen.
  'Age level': 'Faixa etária',
  'Ask a grown-up to switch profiles.':
      'Peça a um adulto para trocar de perfil.',
  'Daily watch time': 'Tempo de exibição diário',
  'Shows titles suitable up to age {age}.':
      'Mostra títulos adequados até {age} anos.',
  "The ship is sailing away. Thanks for watching with Harbor, it's time to listen to your grown-ups.":
      'O navio está partindo. Obrigado por assistir com o Harbor, hora de dar ouvidos aos adultos.',
  "Time's up!": 'Acabou o tempo!',
  "Used to lift Time's Up and to leave the kids space.":
      'Usado para suspender o "Acabou o tempo" e para sair do espaço infantil.',

  // Casting to an external device.
  'Cast to a device': 'Transmitir para um dispositivo',
  'Searching for devices…': 'Procurando dispositivos…',
  'Stop casting': 'Parar transmissão',

  // The trailer sheet.
  'This trailer plays on YouTube.': 'Este trailer é reproduzido no YouTube.',
  'Watch on YouTube': 'Assistir no YouTube',

  // Shared sort, layout and status labels.
  '1 item': '1 item',
  'A-Z': 'A-Z',
  'Almost done': 'Quase lá',
  'Change photo': 'Alterar foto',
  'Choose avatar': 'Escolher avatar',
  'Upload photo': 'Enviar foto',
  'Choose an avatar': 'Escolha um avatar',
  'Search characters or shows…': 'Buscar personagens ou séries…',
  'No avatars match your search.': 'Nenhum avatar corresponde à busca.',
  'Pick an avatar': 'Escolha um avatar',
  'A friendly face for the kids space.':
      'Um rosto amigável para o espaço infantil.',
  'From {source}': 'De {source}',
  'Group the movies and shows you love. Rewatch shelf, weekend picks, whatever keeps them close.':
      'Agrupe os filmes e séries que você ama. Prateleira de rewatch, escolhas de fim de semana, o que mantiver eles por perto.',
  'Group the movies and shows you want to keep close.':
      'Agrupe os filmes e séries que você quer manter por perto.',
  'Name (optional)': 'Nome (opcional)',
  'No matches for these filters.': 'Nenhum resultado para estes filtros.',
  'No tabs selected': 'Nenhuma aba selecionada',
  'No titles match your filters.':
      'Nenhum título corresponde aos seus filtros.',
  'Posters': 'Pôsteres',
  'Primary': 'Principal',
  'Recent': 'Recentes',
  'Search title…': 'Buscar título…',
  'Share with {name}': 'Compartilhar com {name}',
  'Shows': 'Séries',
  'Stremio account': 'Conta Stremio',
  'Syncing Trakt…': 'Sincronizando o Trakt…',
  'Type on your keyboard or tap the digits above.':
      'Digite no teclado ou toque nos dígitos acima.',
  'Updated {when}': 'Atualizado {when}',
  'Uploading…': 'Enviando…',
  'Use a separate Stremio account': 'Usar uma conta Stremio separada',
  "We'll name it from the URL.": 'Daremos um nome a ela a partir da URL.',
  '{n}m left': '{n}m restantes',

  // The Discover "Browse by Award" tiles (award bodies and their taglines).
  'Browse by Award': 'Navegar por prêmio',
  'BAFTA': 'BAFTA',
  'Emmys': 'Emmy',
  'SAG Awards': 'Prêmios SAG',
  "Critics' Choice": 'Escolha da Crítica',
  'Cannes': 'Cannes',
  'Venice': 'Veneza',
  'Berlinale': 'Berlinale',
  'Best Picture and beyond': 'Melhor Filme e além',
  'Film and television': 'Cinema e televisão',
  'The British Academy': 'A Academia Britânica',
  "Television's finest": 'O melhor da televisão',
  'Chosen by actors': 'Escolhidos pelos atores',
  "The critics' cut": 'A escolha da crítica',
  "Palme d'Or": 'Palma de Ouro',
  'Golden Lion': 'Leão de Ouro',
  'Golden Bear': 'Urso de Ouro',

  // The Discover queue CTA and the Surprise-me panel.
  'Your Discovery Queue': 'Sua fila de descobertas',
  '{count} picks ready': '{count} escolhas prontas',
  'Explore your queue': 'Explore sua fila',
  "Can't decide?": 'Não consegue decidir?',
  "Critics' Pick": 'Escolha da crítica',
  'Loved by reviewers today': 'Amado pela crítica hoje',
  'Read full': 'Ler completo',
  'Featured & Recommended': 'Destaques e recomendados',
  'Hide section': 'Ocultar seção',
  'Show section': 'Mostrar seção',
  'Hidden': 'Oculto',
  'Customize': 'Personalizar',
  'Featured tonight': 'Destaque desta noite',
  'Trending on AniList': 'Em alta no AniList',
  'Top 100 on AniList': 'Top 100 no AniList',
  'For You': 'Para você',
  'Featured anime': 'Anime em destaque',
  'Show DUB badge': 'Mostrar selo DUB',
  'Mark anime that has an English dub with a DUB badge.':
      'Marque animes com dublagem em inglês com um selo DUB.',
  'Rotate hero backdrops': 'Alternar planos de fundo do destaque',
  'Slowly cycle the detail hero through the title’s backdrop gallery. Only when there are at least two backdrops.':
      'Alterne lentamente o destaque da página entre os planos de fundo do título. Só quando houver pelo menos dois planos de fundo.',
  'Stats': 'Estatísticas',
  'hours watched': 'horas assistidas',
  'titles': 'títulos',
  'plays': 'reproduções',
  'What you watched': 'O que você assistiu',
  'Top titles': 'Principais títulos',
  'Top genres': 'Principais gêneros',
  'Your watch year': 'Seu ano de exibição',
  'Nothing to show yet': 'Nada para mostrar ainda',
  'Estimated from your local history. Connect Trakt or Simkl for the full picture.':
      'Estimado a partir do seu histórico local. Conecte o Trakt ou o Simkl para ver o quadro completo.',
  'Connect Trakt or Simkl, or start watching, and your stats will build themselves.':
      'Conecte o Trakt ou o Simkl, ou comece a assistir, e suas estatísticas se formarão sozinhas.',
  'Sound effects': 'Efeitos sonoros',
  'Audio feedback for navigation and actions.':
      'Retorno sonoro para navegação e ações.',
  'Enable sound effects': 'Ativar efeitos sonoros',
  'Play sounds for navigation and actions.':
      'Tocar sons na navegação e nas ações.',
  'Glass': 'Vidro',
  'Modern': 'Moderno',
  'Retro': 'Retrô',
  'Cinematic': 'Cinemático',
  'Sound effects volume': 'Volume dos efeitos sonoros',
  'Player volume sounds': 'Sons de volume do player',
  'Play a tick when you change the volume in the player. Needs a sound theme enabled above.':
      'Toca um clique ao mudar o volume no player. Requer um tema de som ativado acima.',
  'Tune': 'Ajustar',
  'Tune anime': 'Ajustar anime',
  'Shape your anime feed.': 'Molde o seu feed de anime.',
  'Steer your picks toward what you love, and hide what you don’t.':
      'Direcione suas escolhas para o que você ama e oculte o que não ama.',
  'Genres you want more of': 'Gêneros que você quer ver mais',
  'Hide from your picks': 'Ocultar das suas escolhas',
  'Hide anime I’ve already watched': 'Ocultar anime que já assisti',
  'Clear all': 'Limpar tudo',
  'None yet': 'Nenhum ainda',
  '{n} selected': '{n} selecionado(s)',
  'Watching': 'Assistindo',
  'Plan to Watch': 'Planejo assistir',
  'Completed': 'Concluído',
  'On Hold': 'Em espera',
  'Dropped': 'Abandonado',
  'Surprise me': 'Surpreenda-me',
  'Pick a random title': 'Escolher um título aleatório',

  // The Discover "Browse by Language" tiles and the language filter header.
  'Browse by Language': 'Navegar por idioma',
  'Language': 'Idioma',
  'Everything originally in {name}: movies and series across every genre, era, and hidden gems.':
      'Tudo originalmente em {name}: filmes e séries de todos os gêneros, épocas e joias escondidas.',
  'Korean': 'Coreano',
  'Japanese': 'Japonês',
  'Spanish': 'Espanhol',
  'French': 'Francês',
  'Chinese': 'Chinês',
  'Hindi': 'Hindi',
  'German': 'Alemão',
  'Italian': 'Italiano',
  'Portuguese': 'Português',
  'Turkish': 'Turco',
  'Swedish': 'Sueco',
  'Danish': 'Dinamarquês',
  'Norwegian': 'Norueguês',
  'Russian': 'Russo',
  'Polish': 'Polonês',
  'Thai': 'Tailandês',
  'Dutch': 'Holandês',
  'Arabic': 'Árabe',

  // The filter browse header (year, runtime, studio, country, network).
  'Network': 'Emissora',
  'TV Shows': 'Séries de TV',
  'Around {min} min': 'Cerca de {min} min',
  'Everything from {year}, sorted across trending, top rated, and hidden gems.':
      'Tudo de {year}, organizado entre em alta, mais bem avaliados e joias escondidas.',
  '{media} between {lo}-{hi} minutes. Pick a length, not a wall of options.':
      '{media} entre {lo}-{hi} minutos. Escolha uma duração, não um mural de opções.',
  '{media} produced by {name}, ranked from biggest hits to overlooked gems.':
      '{media} produzidos por {name}, dos maiores sucessos às joias esquecidas.',
  '{media} from {name}: popular, acclaimed, and hidden alike.':
      '{media} de {name}: populares, aclamados e escondidos por igual.',
  'Series from {name}: current hits, classics, and the deep cuts.':
      'Séries de {name}: sucessos atuais, clássicos e as raridades.',

  // The Discover "Browse by Genre" tiles and the genre filter header.
  'Browse by Genre': 'Navegar por gênero',
  'Genre': 'Gênero',
  'TV Genre': 'Gênero de TV',
  "The best {genre} {media}, layered by mood. Browse trending, dive into a director's run, sort by decade, find quiet gems.":
      'Os melhores {media} de {genre}, dispostos por clima. Explore os em alta, mergulhe na obra de um diretor, ordene por década e encontre joias discretas.',
  'genre.Action': 'Ação',
  'genre.Adventure': 'Aventura',
  'genre.Thriller': 'Suspense',
  'genre.Crime': 'Crime',
  'genre.Drama': 'Drama',
  'genre.Romance': 'Romance',
  'genre.Mystery': 'Mistério',
  'genre.Sci-Fi': 'Ficção Científica',
  'genre.Fantasy': 'Fantasia',
  'genre.Horror': 'Terror',
  'genre.Comedy': 'Comédia',
  'genre.Family': 'Família',
  'genre.Animation': 'Animação',
  'genre.Western': 'Faroeste',
  'genre.War': 'Guerra',
  'genre.History': 'História',
  'genre.Documentary': 'Documentário',
  'genre.Music': 'Música',

  // Settings: the Account (Stremio sign-in) and Language sections.
  'Account': 'Conta',
  'Sign in to Stremio to sync your library and add-ons across devices.':
      'Entre no Stremio para sincronizar sua biblioteca e extensões entre dispositivos.',
  'Could not load your account.': 'Não foi possível carregar sua conta.',
  'Signed in': 'Conectado',
  'On your phone, open Stremio and enter this code:':
      'No seu telefone, abra o Stremio e insira este código:',
  'On your phone, open {link} and enter this code:':
      'No seu telefone, abra {link} e insira este código:',
  'Waiting for confirmation…': 'Aguardando confirmação…',
  'Sign in with Stremio': 'Entrar com o Stremio',
  'App language': 'Idioma do aplicativo',
  'Choose the app language. Arabic lays the interface out right-to-left.':
      'Escolha o idioma do aplicativo. O árabe exibe a interface da direita para a esquerda.',

  // Settings: the Trakt, Simkl, MyAnimeList and AniList tracker sections.
  'Connected': 'Conectado',
  'Connected as {name}': 'Conectado como {name}',
  'Disconnect': 'Desconectar',
  'Sync watch progress': 'Sincronizar progresso',
  'Connect': 'Conectar',
  'Connecting…': 'Conectando…',
  'Waiting for authorization…': 'Aguardando autorização…',
  'On your phone or computer, open {url} and enter this code:':
      'No seu telefone ou computador, abra {url} e insira este código:',
  'Connect Trakt to scrobble playback and sync your watchlist and watched history.':
      'Conecte o Trakt para registrar a reprodução e sincronizar sua lista e histórico de exibição.',
  'Connect Simkl to sync your watched history and watchlist across services.':
      'Conecte o Simkl para sincronizar seu histórico e sua lista de exibição entre serviços.',
  'Connect MyAnimeList to sync your anime watch progress.':
      'Conecte o MyAnimeList para sincronizar seu progresso de anime.',
  'Connect AniList to sync your anime watch progress.':
      'Conecte o AniList para sincronizar seu progresso de anime.',
  'Connect Trakt': 'Conectar Trakt',
  'Connect Simkl': 'Conectar Simkl',
  'Connect MyAnimeList': 'Conectar MyAnimeList',
  'Connect AniList': 'Conectar AniList',
  'Authorize Harbor in the MyAnimeList page that opened, then paste the code shown there below.':
      'Autorize o Harbor na página do MyAnimeList que abriu e cole o código exibido lá abaixo.',
  'Authorize Harbor in the AniList page that opened, then paste the code shown there below.':
      'Autorize o Harbor na página do AniList que abriu e cole o código exibido lá abaixo.',
  'Paste the MyAnimeList code': 'Cole o código do MyAnimeList',
  'Paste the AniList code': 'Cole o código do AniList',
  'Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.':
      'Concluir um episódio de anime atualiza seu progresso no MyAnimeList. Apenas para frente: nunca reduz uma contagem que você já tem.',
  'Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.':
      'Concluir um episódio de anime atualiza seu progresso no AniList. Apenas para frente: nunca reduz uma contagem que você já tem.',

  // Settings: the Parental controls section (PIN + lockable sidebar tabs).
  'Parental controls': 'Controle dos pais',
  'Create or select a profile to set up parental controls.':
      'Crie ou selecione um perfil para configurar o controle dos pais.',
  'Set a PIN and choose which sidebar tabs it protects for {name}.':
      'Defina um PIN e escolha quais abas da barra lateral ele protege para {name}.',
  'LOCKED TABS · none': 'ABAS BLOQUEADAS · nenhuma',
  'LOCKED TABS · {n}': 'ABAS BLOQUEADAS · {n}',
  'Set a PIN above to enforce these locks.':
      'Defina um PIN acima para aplicar estes bloqueios.',
  'PIN': 'PIN',
  'A PIN is set.': 'Um PIN está definido.',
  'No PIN set.': 'Nenhum PIN definido.',
  'Discover': 'Descobrir',
  'Sports': 'Esportes',
  'Live TV': 'TV ao Vivo',
  'Calendar': 'Calendário',
  'My Library': 'Minha Biblioteca',
  'Addons': 'Extensões',

  // Settings: the Anime4K presets section.
  'Anime4K presets': 'Predefinições do Anime4K',
  'GPU shaders that sharpen lines and clean up gradients on anime as it plays. Pick a mode, Harbor handles the shaders.':
      'Shaders de GPU que aguçam as linhas e limpam os gradientes do anime durante a reprodução. Escolha um modo, o Harbor cuida dos shaders.',
  'Quality tier': 'Nível de qualidade',
  'Quality': 'Qualidade',
  'Performance': 'Desempenho',
  'Mode': 'Modo',
  'One-time setup downloads the shader pack (about 1 MB) into Harbor. No files to hunt down.':
      'A configuração única baixa o pacote de shaders (cerca de 1 MB) no Harbor. Nenhum arquivo para procurar.',
  'Downloading shaders…': 'Baixando shaders…',
  'Set up Anime4K': 'Configurar Anime4K',
  'Shaders installed': 'Shaders instalados',
  'Updating…': 'Atualizando…',
  'Updated': 'Atualizado',
  'Re-download': 'Baixar novamente',
  'Download failed. Check your connection and try again.':
      'Falha no download. Verifique sua conexão e tente novamente.',
  'Mode A': 'Modo A',
  'Mode B': 'Modo B',
  'Mode C': 'Modo C',
  'Mode A+A': 'Modo A+A',
  'Mode B+B': 'Modo B+B',
  'Mode C+A': 'Modo C+A',
  'Restore + upscale. The best all-rounder for most anime.':
      'Restauração + aumento de escala. O melhor para a maioria dos animes.',
  'Softer restore. Kinder to compressed or noisy sources.':
      'Restauração mais suave. Melhor para fontes comprimidas ou com ruído.',
  'Denoise + upscale. Lightest, cleanest on already-sharp video.':
      'Remoção de ruído + aumento de escala. Mais leve e limpo em vídeos já nítidos.',
  'Double restore. Sharpest detail, for high-quality sources.':
      'Restauração dupla. Detalhes mais nítidos, para fontes de alta qualidade.',
  'Double soft restore. For heavy compression artifacts.':
      'Restauração suave dupla. Para artefatos de compressão pesados.',
  'Denoise then restore. Balanced cleanup and detail.':
      'Remoção de ruído e depois restauração. Limpeza e detalhe equilibrados.',

  // Settings: the custom-theme colour editor.
  'Canvas': 'Tela',
  'Surface': 'Superfície',
  'Elevated': 'Elevado',
  'Raised': 'Destacado',
  'Ink': 'Tinta',
  'Ink muted': 'Tinta suave',
  'Ink subtle': 'Tinta sutil',
  'Edge': 'Borda',
  'Accent': 'Destaque',
  'Danger': 'Perigo',
  'The app background behind everything.': 'O fundo do app atrás de tudo.',
  'Cards and rails.': 'Cartões e trilhos.',
  'Raised cards and menus.': 'Cartões elevados e menus.',
  'Controls and inputs.': 'Controles e campos.',
  'Primary text.': 'Texto principal.',
  'Secondary text.': 'Texto secundário.',
  'Hints and tertiary text.': 'Dicas e texto terciário.',
  'Borders and hairlines.': 'Bordas e linhas finas.',
  'Brand, focus, and actions.': 'Marca, foco e ações.',
  'Destructive actions and errors.': 'Ações destrutivas e erros.',
  'Tap a colour to change it. Changes apply to the whole app immediately.':
      'Toque em uma cor para alterá-la. As mudanças se aplicam a todo o app imediatamente.',
  'Custom theme': 'Tema personalizado',

  // Settings: the Home-languages multi-select filter.
  'English': 'Inglês',
  'Tamil': 'Tâmil',
  'No filter. Home shows every language.':
      'Sem filtro. A tela inicial mostra todos os idiomas.',
  '1 language. Home filters to it.': '1 idioma. A tela inicial filtra por ele.',
  '{n} languages. Home filters to these.':
      '{n} idiomas. A tela inicial filtra por eles.',

  // settings_view: the Metadata/API-keys and AI-search sections.
  'Metadata & API keys': 'Metadados e chaves de API',
  'Personal keys unlock richer catalogs, posters, and ratings. Each key is stored securely on this device, never in plaintext.':
      'Chaves pessoais liberam catálogos, pôsteres e avaliações mais ricos. Cada chave é armazenada com segurança neste dispositivo, nunca em texto simples.',
  'TMDB · catalogs and rails': 'TMDB · catálogos e trilhos',
  'v3 API key': 'Chave da API v3',
  'OMDb · Rotten Tomatoes scores': 'OMDb · notas do Rotten Tomatoes',
  '8-character key': 'Chave de 8 caracteres',
  'RPDB · scores baked into posters': 'RPDB · notas embutidas nos pôsteres',
  'rpdb key': 'chave rpdb',
  'MDBList · Letterboxd and Trakt scores':
      'MDBList · notas do Letterboxd e Trakt',
  'mdblist api key': 'chave da api mdblist',
  'Type what you want in plain language and let a model find it. Bring your own OpenRouter or Groq API key.':
      'Digite o que você quer em linguagem simples e deixe um modelo encontrar. Traga sua própria chave OpenRouter ou Groq.',
  'Provider': 'Provedor',
  'Groq · LPU inference': 'Groq · inferência LPU',
  'OpenRouter · natural-language search':
      'OpenRouter · busca em linguagem natural',
  'Groq API key (gsk-…)': 'Chave da API Groq (gsk-…)',
  'OpenRouter key (sk-or-…)': 'Chave OpenRouter (sk-or-…)',
  'Model': 'Modelo',
  'Free': 'Grátis',
  'Use live web context': 'Usar contexto web ao vivo',
  'Before asking the model, fetch DuckDuckGo results through Jina Reader and feed the top hits into the prompt. Works without a key at low volume; add a Jina key below for higher quotas.':
      'Antes de perguntar ao modelo, busca resultados do DuckDuckGo via Jina Reader e alimenta os melhores no prompt. Funciona sem chave em baixo volume; adicione uma chave Jina abaixo para cotas maiores.',
  'Jina API key · optional': 'Chave da API Jina · opcional',

  // settings_view: the Home-languages section wrapper.
  'Home languages': 'Idiomas da tela inicial',
  'Only show titles in these original languages on the Home catalogs. Leave all off to show everything.':
      'Mostrar apenas títulos nestes idiomas originais nos catálogos da tela inicial. Deixe tudo desativado para mostrar tudo.',

  // settings_view: the Streaming sources and Debrid services sections.
  'Streaming sources': 'Fontes de streaming',
  'How the play picker filters, sorts, and lays out the streams your add-ons return.':
      'Como o seletor de reprodução filtra, ordena e organiza os streams que suas extensões retornam.',
  'Stream safety filter': 'Filtro de segurança de stream',
  'Strict': 'Rígido',
  'Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs for episode requests, trailers, and likely cams.':
      'Padrão. Rejeita tamanhos discrepantes, extensões suspeitas, incompatibilidades de ano/episódio, pacotes de temporada para pedidos de episódio, trailers e prováveis cams.',
  'Balanced': 'Equilibrado',
  'Keeps the malware, year, and episode-mismatch checks but allows season packs and oversized files.':
      'Mantém as verificações de malware, ano e incompatibilidade de episódio, mas permite pacotes de temporada e arquivos grandes.',
  'Off': 'Desligado',
  'No filtering. Every stream every add-on returns shows up, including obvious junk.':
      'Sem filtragem. Todo stream que cada extensão retorna aparece, incluindo lixo óbvio.',
  'Result order': 'Ordem dos resultados',
  'Harbor ranking': 'Classificação do Harbor',
  'Puts the best-scoring sources first.':
      'Coloca as fontes com melhor pontuação primeiro.',
  'Addon order': 'Ordem das extensões',
  "Follows your add-on priority and keeps each add-on's results in the order it returned them.":
      'Segue a prioridade das suas extensões e mantém os resultados de cada uma na ordem em que foram retornados.',
  'Picker layout': 'Layout do seletor',
  'Condensed': 'Condensado',
  'A top pick, quality tiles, and a drawer.':
      'Uma escolha principal, blocos de qualidade e uma gaveta.',
  'Stremio': 'Stremio',
  'A flat list grouped by add-on, no scoring.':
      'Uma lista simples agrupada por extensão, sem pontuação.',
  'Show torrent name': 'Mostrar nome do torrent',
  "Show each source's full release filename on the condensed layout.":
      'Mostrar o nome de arquivo completo de cada fonte no layout condensado.',
  'Debrid services': 'Serviços de debrid',
  'Cached-torrent providers for instant, high-quality streams. Keys are stored securely on this device.':
      'Provedores de torrent em cache para streams instantâneos de alta qualidade. As chaves são armazenadas com segurança neste dispositivo.',
  'Real-Debrid API token': 'Token da API Real-Debrid',
  'API token': 'Token da API',
  'TorBox API key': 'Chave da API TorBox',
  'API key': 'Chave da API',
  'AllDebrid API key': 'Chave da API AllDebrid',
  'Premiumize API key': 'Chave da API Premiumize',
  'Debrid-Link API key': 'Chave da API Debrid-Link',

  // settings_view: the Languages and Theme sections.
  'Languages': 'Idiomas',
  'Which languages Harbor prefers when ranking streams and choosing an audio track.':
      'Quais idiomas o Harbor prefere ao classificar streams e escolher uma faixa de áudio.',
  'Preferred stream languages': 'Idiomas de stream preferidos',
  'Streams in these languages rank first in the picker.':
      'Streams nesses idiomas aparecem primeiro no seletor.',
  'Preferred audio languages': 'Idiomas de áudio preferidos',
  'The player auto-selects the first matching audio track when a title has more than one.':
      'O player seleciona automaticamente a primeira faixa de áudio correspondente quando um título tem mais de uma.',
  'Start with subtitles off': 'Começar com legendas desativadas',
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
      'O Harbor ainda busca e carrega legendas para ficarem a um clique de distância no player, apenas não as ativa automaticamente.',
  'Theme': 'Tema',
  'The colour theme for the whole app.': 'O tema de cores de todo o app.',
  'FEATURED': 'EM DESTAQUE',
  'Community-inspired palettes ported to Harbor.':
      'Paletas inspiradas na comunidade portadas para o Harbor.',
  'Custom': 'Personalizado',
  'Build your own palette': 'Crie sua própria paleta',

  // settings_view: the Home layout section.
  'Home layout': 'Layout da tela inicial',
  'How the Home page assembles its rails.':
      'Como a tela inicial monta suas linhas.',
  'Harbor curated': 'Curadoria do Harbor',
  'Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.':
      'Carrossel principal, Top 10, Em alta, Nos cinemas, linhas por serviço. Catálogos de extensões são anexados abaixo, sem duplicatas.',
  'Classic Stremio': 'Stremio clássico',
  'Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.':
      'Continuar assistindo, depois suas extensões instaladas. Cada catálogo aparece como sua própria linha, na ordem de instalação, sem remoção de duplicatas, sem banner.',
  'Show every addon row': 'Mostrar todas as linhas de extensão',
  "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.":
      'Por padrão, as linhas de extensão que duplicam as integradas (Em alta, Populares, Mais avaliados, etc.) são mescladas para você não ver a mesma linha duas vezes. Ative isto para mostrar todas, inclusive as duplicatas.',
  'Watchlist shows only saved titles': 'A lista mostra apenas títulos salvos',
  'Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.':
      'Mantenha a aba Lista da Biblioteca limitada aos títulos que você adicionou no Stremio. Desative isto para incluir também o que o Stremio adicionou automaticamente ao pressionar play.',
  'Show Playlists tab': 'Mostrar a aba Playlists',
  'Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.':
      'Adiciona um item Playlists à navegação para explorar filmes e séries das suas playlists M3U ou Xtream (as mesmas que você adiciona para a TV ao Vivo). Desativado por padrão para manter a navegação organizada.',
  'Keep anime in the Anime room only': 'Manter animes apenas na sala Anime',
  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
      'Oculta animes da linha Continuar assistindo da tela inicial. Ainda aparecem no Continuar assistindo da própria aba Anime.',
  'Advance Continue Watching to the next episode':
      'Avançar Continuar assistindo para o próximo episódio',
  'When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.':
      'Quando você termina um episódio, o cartão Continuar assistindo da tela inicial passa para o próximo episódio em vez de ficar em 0 minutos restantes.',
  'Hide watched titles in catalogs': 'Ocultar títulos assistidos nos catálogos',
  "Movies you've watched and shows you've made progress on stop appearing in the built-in catalog rows, using your local watch history (and Trakt if connected). Continue Watching is never touched.":
      'Filmes que você assistiu e séries em que avançou deixam de aparecer nas linhas de catálogo integradas, usando seu histórico local (e o Trakt, se conectado). Continuar assistindo nunca é afetado.',
  'Hide unreleased titles': 'Ocultar títulos não lançados',
  'Movies and shows with a future release date stop appearing in the built-in home catalog rows, so Home only shows what you can watch right now.':
      'Filmes e séries com data de lançamento futura deixam de aparecer nas linhas de catálogo da tela inicial, então a tela inicial mostra apenas o que você pode assistir agora.',

  // settings_view: the Spoilers and Episode-cards sections.
  'Spoilers': 'Spoilers',
  'Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Focus an episode to peek.':
      'Borra a arte, os títulos e as descrições dos episódios que você ainda não assistiu, tanto em séries quanto em animes. Foque um episódio para espiar.',
  'Blur spoilers': 'Borrar spoilers',
  'Hides spoiler-prone episode details in episode lists until you have watched them.':
      'Oculta detalhes de episódios sujeitos a spoiler nas listas de episódios até você assisti-los.',
  'Blur thumbnails': 'Borrar miniaturas',
  'Blur titles': 'Borrar títulos',
  'Blur descriptions': 'Borrar descrições',
  'Blur episode images on detail page':
      'Borrar imagens dos episódios na página de detalhes',
  'Blurs the hero image and stills on the episode detail page until you click reveal.':
      'Borra a imagem principal e as capturas na página de detalhes do episódio até você clicar para revelar.',
  'Keep the next episode visible': 'Manter o próximo episódio visível',
  'Leave the episode you are up to clear and only blur the ones after it.':
      'Deixe o episódio em que você está claro e borre apenas os posteriores.',
  'Blur stream backdrop': 'Borrar o fundo do stream',
  'Adds a blurred glass effect behind the stream picker panel.':
      'Adiciona um efeito de vidro borrado atrás do painel do seletor de streams.',
  'Episode cards': 'Cartões de episódio',
  'Show the IMDb rating and synopsis on episodes across the list, grid, and panel layouts.':
      'Mostrar a nota do IMDb e a sinopse nos episódios nos layouts de lista, grade e painel.',
  'Show IMDb rating on episodes': 'Mostrar nota do IMDb nos episódios',
  "Shows each episode's rating. Add your free OMDb API key for real IMDb scores; without it, ratings fall back to TMDB.":
      'Mostra a nota de cada episódio. Adicione sua chave gratuita da API OMDb para notas reais do IMDb; sem ela, as notas usam o TMDB.',
  'Show episode description': 'Mostrar descrição do episódio',
  'Shows the episode synopsis on the cards. Turn it off to hide it.':
      'Mostra a sinopse do episódio nos cartões. Desative para ocultá-la.',
  'High-quality episode images': 'Imagens de episódio em alta qualidade',
  'Loads full-resolution episode artwork (original) instead of lighter w300 images. Turn off for slow connections or low-end devices.':
      'Carrega a arte dos episódios em resolução total (original) em vez das imagens w300 mais leves. Desative para conexões lentas ou dispositivos fracos.',
  'Group episodes by story arc': 'Agrupar episódios por arco narrativo',
  'Adds a Seasons/Arcs switch on shows that have a story-arc grouping (like One Piece), so you can browse by saga instead of scrolling seasons. Needs a TMDB key. Off by default.':
      'Adiciona um seletor Temporadas/Arcos em séries com agrupamento por arco narrativo (como One Piece), para você navegar por saga em vez de rolar temporadas. Precisa de uma chave TMDB. Desativado por padrão.',

  // settings_view: the Skip intros & credits section.
  'Skip intros & credits': 'Pular aberturas e créditos',
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
      'O Harbor encontra os tempos de abertura e créditos pelo AniSkip, TheIntroDB e pelos capítulos do próprio arquivo, e mostra um botão Pular no momento certo.',
  'Show the Skip button': 'Mostrar o botão Pular',
  'Show a Skip Intro / Skip Credits button when Harbor detects one. Turn this off to never show it. You can also dismiss a wrong one for the rest of the episode.':
      'Mostra um botão Pular abertura / Pular créditos quando o Harbor detecta um. Desative para nunca mostrá-lo. Você também pode dispensar um botão incorreto pelo resto do episódio.',
  'Auto-skip intros': 'Pular aberturas automaticamente',
  'Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.':
      'Pula automaticamente as aberturas no momento em que uma começa. O botão Pular ainda aparece de qualquer forma, e voltar para dentro de uma abertura a reproduz sem pular novamente.',
  'Auto-skip recaps': 'Pular recapitulações automaticamente',
  'Automatically jump past recap segments.':
      'Pula automaticamente os segmentos de recapitulação.',
  'Auto-skip credit outros': 'Pular créditos finais automaticamente',
  'Automatically skip ending credits and trigger the next episode countdown immediately.':
      'Pula automaticamente os créditos finais e inicia a contagem regressiva do próximo episódio imediatamente.',
  'Auto-hide the Skip button after':
      'Ocultar o botão Pular automaticamente após',
  "Hides the button on its own after a few seconds so a wrong one doesn't sit there the whole episode.":
      'Oculta o botão sozinho após alguns segundos para que um botão incorreto não fique lá o episódio inteiro.',
  '5s': '5s',
  '10s': '10s',
  '15s': '15s',
  '30s': '30s',

  // settings_view: the Playback section.
  'Playback': 'Reprodução',
  'How the player resumes titles and shows on-screen feedback.':
      'Como o player retoma títulos e mostra feedback na tela.',
  'Resume where you left off': 'Retomar de onde parou',
  'Pick up partly-watched episodes and movies at your saved spot. Anything watched past 80% always restarts. Turn this off to always start from the beginning, handy if you rewatch shows.':
      'Retoma episódios e filmes parcialmente assistidos no ponto salvo. Qualquer coisa assistida além de 80% sempre reinicia. Desative para sempre começar do início, útil se você reassiste séries.',
  'Ask to resume or start over': 'Perguntar se retoma ou recomeça',
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
      'Quando você aperta Play em algo parcialmente assistido, mostra um aviso para retomar de onde parou ou recomeçar. Também cobre itens sincronizados do Stremio ou Trakt.',
  'Auto-play next episode': 'Reprodução automática do próximo episódio',
  'When an episode ends, automatically start the next one. Off lets the episode finish and stop.':
      'Quando um episódio termina, inicia o próximo automaticamente. Off deixa o episódio terminar e parar.',
  'Next episode prompt': 'Aviso do próximo episódio',
  'When the Up Next card appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.':
      'Quando o cartão A seguir aparece antes de um episódio terminar. Auto se ajusta à duração do episódio, então episódios curtos param de avisar tão cedo. Off oculta-o.',
  'Show controls when pausing': 'Mostrar controles ao pausar',
  "Show the player controls when you pause or resume with the remote or a key. Turn off to keep them hidden so they don't cover subtitles.":
      'Mostra os controles do player quando você pausa ou retoma com o controle remoto ou uma tecla. Desative para mantê-los ocultos e não cobrir as legendas.',
  'Volume pop-up while watching': 'Pop-up de volume durante a reprodução',
  'Show a quick volume overlay when you change the volume with the player controls hidden, so the change is always visible.':
      'Mostra uma sobreposição rápida de volume quando você altera o volume com os controles ocultos, para a mudança ser sempre visível.',
  'Pop-up position': 'Posição do pop-up',
  'Where the volume overlay appears on the video.':
      'Onde a sobreposição de volume aparece no vídeo.',
  'Auto': 'Auto',
  '45s': '45s',
  '1 min': '1 min',
  '1.5 min': '1.5 min',
  '2 min': '2 min',
  'Center': 'Centro',
  'Top': 'Topo',
  'Top left': 'Superior esquerdo',
  'Top right': 'Superior direito',

  // settings_view: the Picture-quality, Smooth-motion and Hardware-accel sections.
  'Picture quality': 'Qualidade da imagem',
  'One choice that sets how hard your device works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.':
      'Uma escolha que define o quanto seu dispositivo trabalha para deixar o vídeo com a melhor aparência. Escolha a que combina com sua máquina. Tem efeito na próxima coisa que você reproduzir.',
  'Smooth on weak PCs': 'Suave em PCs fracos',
  'Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.':
      'Desliga o dimensionamento e os efeitos sofisticados para o vídeo apenas tocar. O mais leve para sua máquina. Escolha se algo travar ou o ventilador gritar.',
  'Good-looking video without working your machine hard. Leave it here unless you have a reason to change.':
      'Vídeo com boa aparência sem exigir muito da sua máquina. Deixe aqui a menos que tenha um motivo para mudar.',
  'Maximum quality': 'Qualidade máxima',
  'Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.':
      'Upscaling mais nítido e gradientes mais suaves em cenas escuras, ao custo de mais carga na placa de vídeo. Pule em notebooks e placas integradas.',
  'Smooth motion': 'Movimento suave',
  'Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.':
      'Anime é desenhado em dois e três quadros, então panorâmicas rápidas podem tremer. A suavização preenche as lacunas para o movimento deslizar.',
  'Motion smoothing': 'Suavização de movimento',
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
      'Interpolação de quadros integrada do Harbor. Suaviza panorâmicas, melhor em animes. Precisa de uma taxa de atualização da tela acima da taxa de quadros do vídeo, e pode travar em GPUs fracas. Mais leve que o SVP.',
  'Hardware acceleration': 'Aceleração de hardware',
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
      'Deixe sua placa de vídeo fazer o trabalho pesado de decodificar o vídeo. Isso economiza bateria e mantém a CPU fria. Auto é o certo para quase todos; só mude se a reprodução parecer errada ou não iniciar.',
  'Decoder': 'Decodificador',
  'The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.':
      'A CPU decodifica tudo. Mais compatível, mas esquenta e pode travar em 4K. Use só se a imagem falhar com a decodificação por hardware ligada.',
  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.":
      'Força a placa de vídeo. Mais suave e frio, mas alguns arquivos antigos ou incomuns podem se recusar a tocar. Volte para Auto se algo não iniciar.',
  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.":
      'O Harbor usa a placa de vídeo quando é seguro e volta para a CPU quando não é. A escolha certa para quase todos.',
  'Force on': 'Forçar ligado',
  'Off (use CPU)': 'Desligado (usar CPU)',

  // settings_view: the Aspect, Color&HDR, Connection and Downmix sections.
  'Aspect ratio': 'Proporção da tela',
  'Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.':
      'Formato de imagem padrão no motor mpv. Ajustar mantém a fonte como está com quaisquer barras pretas; o resto estica ou corta para preencher, útil para séries antigas em 4:3 numa TV widescreen.',
  'Picture shape': 'Formato da imagem',
  'Fit': 'Ajustar',
  'Fill': 'Preencher',
  'Stretch': 'Esticar',
  'Zoom': 'Zoom',
  'Color & HDR': 'Cor e HDR',
  'How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.':
      'Como o Harbor comprime filmes HDR em uma tela normal. Auto é o certo para quase todos; as curvas abaixo só mudam a aparência (vibrante vs suave). Só importa em fontes HDR.',
  'Tone-mapping curve': 'Curva de mapeamento de tons',
  'Auto (recommended)': 'Auto (recomendado)',
  'Reference (bt.2390)': 'Referência (bt.2390)',
  'Filmic (Hable)': 'Cinematográfico (Hable)',
  'Balanced (Mobius)': 'Equilibrado (Mobius)',
  'Soft (Reinhard)': 'Suave (Reinhard)',
  'Modern (Spline)': 'Moderno (Spline)',
  'Boost SDR video toward HDR': 'Impulsionar vídeo SDR para HDR',
  'On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.':
      'Em uma tela HDR, estica filmes normais (não HDR) para usar a faixa extra de brilho. Deixe desligado em uma tela comum; pode parecer desbotado.',
  'Connection': 'Conexão',
  'Slow or unstable connection': 'Conexão lenta ou instável',
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
      'Se o vídeo fica pausando para carregar, ou você está num Wi-Fi instável ou servidor distante, isto dá ao Harbor uma vantagem maior para a reprodução atravessar os trechos difíceis.',
  'Build a bigger buffer': 'Criar um buffer maior',
  'Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.':
      'Carrega mais do vídeo antecipadamente antes de reproduzir. Mais suave em conexões fracas, usa um pouco mais de memória e demora um instante a mais para começar.',
  'Audio downmix': 'Downmix de áudio',
  'For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.':
      'Para alto-falantes de notebook e fones de ouvido. Filmes mixados para surround 5.1 ou 7.1 podem soar ocos ou ter diálogo baixo em dois alto-falantes. Isto os combina corretamente.',
  'Mix surround sound down to stereo': 'Combinar som surround para estéreo',
  'Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.':
      'Ative se você assiste em um notebook ou fones de ouvido e o diálogo parece baixo demais perto dos efeitos. Deixe desligado se você tem um sistema surround real ou uma soundbar.',

  // settings_view: the Title-text, Poster-card and Subtitle-style sections.
  'Title text': 'Texto do título',
  'Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.':
      'Redimensione os títulos das linhas na tela inicial e o título mostrado no player, sem redimensionar o resto da interface. Você também pode iniciar o título do player com o nome da série em vez do episódio.',
  'Row titles': 'Títulos das linhas',
  'Player title': 'Título do player',
  'Show series name first in the player':
      'Mostrar o nome da série primeiro no player',
  'Lead with the show name instead of the episode title at the top of the player.':
      'Comece com o nome da série em vez do título do episódio no topo do player.',
  'Poster card style': 'Estilo do cartão de pôster',
  'Tune the size and corner radius of every poster across Home, Discover, and your library.':
      'Ajuste o tamanho e o raio dos cantos de cada pôster na tela inicial, no Descobrir e na sua biblioteca.',
  'Width': 'Largura',
  'Corner radius': 'Raio dos cantos',
  'Load effect': 'Efeito de carregamento',
  'How posters appear as they load. Blur up looks smoothest; Fade is lighter on older or low-power devices; Instant turns it off.':
      'Como os pôsteres aparecem ao carregar. Desfoque crescente parece mais suave; Esmaecer é mais leve em dispositivos antigos ou de baixa potência; Instantâneo o desliga.',
  'Blur up': 'Desfoque crescente',
  'Fade': 'Esmaecer',
  'Instant': 'Instantâneo',
  'Subtitle style': 'Estilo das legendas',
  'How subtitles look during playback — background style, size, colour, position, and readability.':
      'Como as legendas aparecem durante a reprodução — estilo de fundo, tamanho, cor, posição e legibilidade.',
  'Background style': 'Estilo de fundo',
  'Drop shadow': 'Sombra projetada',
  'Outline': 'Contorno',
  'Black bar': 'Barra preta',
  'Size': 'Tamanho',
  'Opacity': 'Opacidade',
  'Distance from bottom': 'Distância da base',
  'Outline thickness': 'Espessura do contorno',
  'Background opacity': 'Opacidade do fundo',
  'Text colour': 'Cor do texto',
  'Outline colour': 'Cor do contorno',
  'Background colour': 'Cor do fundo',
  'Bold text': 'Texto em negrito',
  'Alignment': 'Alinhamento',
  'Left': 'Esquerda',
  'Right': 'Direita',
  // Arabic home-feed row titles (key parity with the ar catalog).
  'Ramadan 2026 Series': 'Séries do Ramadã 2026',
  'Arabic Drama': 'Drama Árabe',
  'Arabic Movies': 'Filmes Árabes',
  'Egyptian Cinema Classics': 'Clássicos do Cinema Egípcio',
  'Gulf / Khaleeji': 'Golfo / Khaleeji',
  'Arabic Comedy': 'Comédia Árabe',
  'Trending in Arabic': 'Em Alta em Árabe',
};
