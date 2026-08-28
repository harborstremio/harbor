const settingsFill: Record<string, string> = {
  "Your avatar, name, and handle across Harbor.":
    "Seu avatar, nome e identificador em todo o Harbor.",
  'Adds an "Ask AI" button to search, so you can type things like a plain-language request.':
    'Adiciona um botão "Perguntar à IA" à busca, para você digitar pedidos em linguagem simples.',
  "Get a key at": "Obtenha uma chave em",
  "It only runs when you tap that button, so it never costs anything unless you ask.":
    "Só é executado quando você toca nesse botão, então nunca custa nada, a menos que você peça.",
  "Groq runs open-source models on its LPU hardware with a generous free tier; every model listed below runs on the free tier.":
    "O Groq executa modelos de código aberto em seu hardware LPU com um generoso nível gratuito; todos os modelos listados abaixo funcionam no nível gratuito.",
  "Custom model id (optional)": "ID de modelo personalizado (opcional)",
  "Use model": "Usar modelo",
  "Any model id from console.groq.com/docs/models works here.":
    "Qualquer ID de modelo de console.groq.com/docs/models funciona aqui.",
  "Any model id from openrouter.ai/models works here, including :free variants.":
    "Qualquer ID de modelo de openrouter.ai/models funciona aqui, incluindo as variantes :free.",
  ". Works without a key at low volume; add a key for higher quotas.":
    ". Funciona sem chave em baixo volume; adicione uma chave para cotas maiores.",
  "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.":
    'Os arquivos do SVP estão aqui, mas o mecanismo VapourSynth dele não carrega ({err}). Isso geralmente indica uma entrada obsoleta do VapourSynth ou a ausência do runtime Microsoft VC++. Reinstale o SVP ou instale a versão mais recente do "Visual C++ Redistributable (x64)" da Microsoft e reabra o Harbor.',
  "Smooth motion runs on the bundled mpv engine in the Harbor desktop app. It has no effect in the browser.":
    "O movimento suave é executado no mecanismo mpv integrado ao aplicativo de desktop do Harbor. Não tem efeito no navegador.",
  "Subtitle auto-sync": "Sincronização automática de legendas",
  "Harbor times out-of-sync subtitles to the audio for you, on any external subtitle. It works on the mpv player and leaves embedded tracks alone, since those are already in sync.":
    "O Harbor sincroniza para você as legendas fora de sincronia com o áudio, em qualquer legenda externa. Funciona no reprodutor mpv e não mexe nas faixas incorporadas, já que essas já estão sincronizadas.",
  "Auto-sync subtitles": "Sincronizar legendas automaticamente",
  "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own. Off by default.":
    "Quando uma legenda adianta ou atrasa, o Harbor mede a fala e corrige o tempo sozinho. Desativado por padrão.",
  "Let structural tiers auto-apply": "Permitir aplicação automática dos níveis estruturais",
  "Identity matches from content hashing and the community database always apply on their own. Timing worked out from the audio only offers a fix until it has earned trust. Turn this on to let those audio-derived fixes apply automatically too.":
    "Correspondências de identidade obtidas por hashing de conteúdo e pelo banco de dados da comunidade sempre são aplicadas por conta própria. O tempo calculado a partir do áudio apenas sugere uma correção até conquistar confiança. Ative esta opção para que essas correções derivadas do áudio também sejam aplicadas automaticamente.",
  "Drift monitor": "Monitor de desvio",
  "Keeps watching through playback and gently re-nudges the timing if the subtitle slips out of sync partway through.":
    "Continua monitorando durante a reprodução e reajusta suavemente o tempo se a legenda sair de sincronia no meio do caminho.",
  "Smart resync with speech recognition": "Ressincronização inteligente com reconhecimento de fala",
  "For the hardest files and the Try again button, Harbor transcribes a little speech on your device and lines the subtitle up to the actual words. Needs a build with the asr-whisper feature and downloads a small model the first time you use it.":
    "Para os arquivos mais difíceis e o botão Tentar novamente, o Harbor transcreve um trecho da fala no seu dispositivo e alinha a legenda às palavras reais. Requer uma compilação com o recurso asr-whisper e baixa um modelo pequeno na primeira vez que você o usa.",
  "Community sync": "Sincronização da comunidade",
  "A good correction only has to be found once. Harbor can share verified fixes so the next person with the same file and subtitle gets an instant result. Records are keyed by salted fingerprints, never your files or anything personal.":
    "Uma boa correção só precisa ser encontrada uma vez. O Harbor pode compartilhar correções verificadas para que a próxima pessoa com o mesmo arquivo e a mesma legenda obtenha um resultado instantâneo. Os registros são indexados por impressões digitais salgadas, nunca pelos seus arquivos nem por nada pessoal.",
  "Use community corrections": "Usar correções da comunidade",
  "Check the shared database first. When this exact subtitle has already been synced by someone else, yours snaps into place with no analysis.":
    "Consulta primeiro o banco de dados compartilhado. Quando esta legenda exata já tiver sido sincronizada por outra pessoa, a sua se encaixa no lugar sem nenhuma análise.",
  "Community sync server": "Servidor de sincronização da comunidade",
  "https://sync.harbor.site": "https://sync.harbor.site",
  "Leave blank to use Harbor's own community server. Enter a URL to point at your own server instead. Private mode below stops all contact either way.":
    "Deixe em branco para usar o próprio servidor da comunidade do Harbor. Insira uma URL para apontar para o seu próprio servidor. O modo privado abaixo interrompe todo contato de qualquer forma.",
  "Private mode": "Modo privado",
  "Never contact the community server in either direction. Nothing is looked up and nothing is contributed from this device.":
    "Nunca entra em contato com o servidor da comunidade em nenhuma direção. Nada é consultado e nada é compartilhado a partir deste dispositivo.",
  "Harbor ships a neutral trophy for every award. Install an icon pack or upload your own image per award to make them yours. Packs are hosted by whoever makes them, so the artwork is theirs, not bundled with Harbor.":
    "O Harbor inclui um troféu neutro para cada prêmio. Instale um pacote de ícones ou envie a sua própria imagem para cada prêmio para torná-los seus. Os pacotes são hospedados por quem os cria, então a arte é deles, não vem incluída no Harbor.",
  "View community award packs": "Ver pacotes de prêmios da comunidade",
  "Icon packs and single-award art from the community":
    "Pacotes de ícones e arte de prêmio individual da comunidade",
  "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.":
    "Envie uma imagem por prêmio ou nomeie os seus arquivos zip com o ID mostrado abaixo de cada um (toque para copiar). Nomes naturais também funcionam, então best_soundtrack, movie_of_the_year, etc. ainda correspondem.",
  "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.":
    "Um pacote de prêmios é um único arquivo JSON mais as imagens que ele referencia. Hospede ambos em qualquer lugar público (o seu próprio servidor, um repositório do GitHub, etc.) e compartilhe a URL do JSON. O Harbor armazena apenas as URLs que você instala, nunca as imagens.",
  "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.":
    "Cada chave acima é um ID de prêmio. Qualquer chave que você omitir recorre ao troféu padrão (ou a um pacote de menor prioridade). A lista completa de IDs abrange todos os prêmios mostrados na grade acima.",
  'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.':
    'Nomeie cada arquivo de imagem com o ID do seu prêmio e coloque-os em um .zip, depois use "Importar um pacote .zip" acima. Sem JSON, sem necessidade de hospedagem. O Harbor associa cada arquivo ao seu prêmio, armazena-o localmente, redimensiona-o e ignora tudo o que não reconhece.',
  "Watched badge": "Selo de assistido",
  "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.":
    "Como os episódios são agrupados para séries e anime. O TVDB é o padrão: ele oferece as ordenações por arco, DVD e absoluta que os fãs de anime esperam, sem necessidade de chave. O TMDB mantém a ordem simples de exibição. De qualquer forma, cada episódio continua sendo reproduzido e marcado como assistido da mesma maneira.",
  "Turns the season button into a full panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. On by default for anime through Harbor's TVDB service, no key needed. Add your own TVDB key to use it for regular shows too.":
    "Transforma o botão de temporada em um painel completo: abas de ordenação (Exibição, DVD, Absoluta e qualquer outra que a série tenha) mais uma tabela de temporadas com intervalos de datas de exibição e contagem de episódios. Ativado por padrão para anime através do serviço TVDB do Harbor, sem necessidade de chave. Adicione sua própria chave TVDB para usá-lo em séries comuns também.",
  'When Esc would close the player, show a quick confirm first. You can tick "Don\'t ask me again" in that prompt to always leave on Esc.':
    'Quando o Esc for fechar o player, mostra primeiro uma confirmação rápida. Você pode marcar "Não perguntar novamente" nesse aviso para sempre sair com o Esc.',
  "Short seek (Shift + arrows)": "Salto curto (Shift + setas)",
  "A shorter jump on Shift plus the arrow keys, for nudging a few seconds at a time.":
    "Um salto menor com Shift mais as teclas de seta, para pular alguns segundos por vez.",
  'Posters, logos, and title art load in the first available language from this list, falling back down the order. "Original" uses the title\'s own language. Put your main language first. Needs a TMDB key.':
    'Pôsteres, logotipos e artes de título carregam no primeiro idioma disponível desta lista, recorrendo aos seguintes na ordem. "Original" usa o idioma do próprio título. Coloque seu idioma principal primeiro. Precisa de uma chave TMDB.',
  "Keep Continue Watching private to each profile":
    "Manter o Continuar Assistindo privado para cada perfil",
  "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.":
    "Mostra o Continuar Assistindo apenas para o perfil ativo. Cada perfil vê somente o próprio progresso, então o que você assiste fica oculto dos outros perfis que compartilham esta conta Stremio.",
  "Show pages": "Páginas de séries",
  "How a show or movie detail page behaves when you open it.":
    "Como uma página de detalhes de série ou filme se comporta quando você a abre.",
  "When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.":
    "Quando você reabre uma série que já estava navegando, volta direto para o ponto onde estava (geralmente a lista de episódios) em vez de começar do topo. O salto acontece antes de a página aparecer, então não há piscada.",
  "Hide and skip episodes": "Ocultar e pular episódios",
  "Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.":
    "Adiciona uma opção Ocultar quando você clica com o botão direito em um episódio. Episódios ocultos desaparecem da lista e são ignorados pelo A Seguir. Uma opção Mostrar ocultos em cada série permite trazê-los de volta.",
  "Poster shine on hover": "Brilho no pôster ao passar o mouse",
  "A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.":
    "Uma sutil passagem de luz no estilo tvOS sobre o pôster quando você passa o mouse. Desativado por padrão; a elevação do card permanece de qualquer forma.",
  "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.":
    "Procurando o Harbor no seu navegador, o controle remoto do celular ou o controle remoto do leitor de mangá? Eles foram movidos para a página Controles Remotos.",
  "X-Ray (experimental)": "X-Ray (experimental)",
  "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.":
    "X-Ray no estilo Amazon: abra o elenco enquanto assiste e toque em qualquer pessoa para ver sua biografia e tudo em que já atuou. A correspondência facial no dispositivo para mostrar quem está na tela vem a seguir. Desativado por padrão.",
  "Enable X-Ray": "Ativar X-Ray",
  "Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.":
    "Adiciona um botão X-Ray no player para ver o elenco completo com fotos e navegar até qualquer ator. Precisa de uma chave TMDB para fotos e filmografias.",
  "Scan who is on screen while playing": "Detectar quem está na tela durante a reprodução",
  "Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.":
    "Compara periodicamente os rostos no quadro atual com o elenco para mostrar quem está na tela agora. Tudo no próprio dispositivo, nada sai da sua máquina. Usa um pouco mais de CPU durante a reprodução.",
  "Performance notice": "Aviso de desempenho",
  "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.":
    "A detecção facial ao vivo carrega modelos de IA no dispositivo e pode aumentar significativamente o uso de RAM, CPU e GPU durante a reprodução. Desative-a se o Harbor ficar lento ou se o dispositivo aquecer.",
  "X-Ray needs a TMDB key": "O X-Ray precisa de uma chave do TMDB",
  "X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.":
    "O X-Ray lê o elenco e suas fotos do TMDB. Sem uma chave do TMDB não há elenco para comparar. Adicione sua chave gratuita em Biblioteca e metadados.",
  "Ask if you're still watching": "Perguntar se você ainda está assistindo",
  "After several episodes auto-play in a row with no input, pause and check you're still there before continuing. Off by default.":
    "Depois de vários episódios reproduzidos automaticamente em sequência sem interação, pausa e verifica se você ainda está por perto antes de continuar. Desativado por padrão.",
  "After 2": "Após 2",
  "After 3": "Após 3",
  "After 4": "Após 4",
  "After 5": "Após 5",
  "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.":
    "Os controles remotos são fornecidos pelo aplicativo de desktop. Abra estas configurações no Harbor do seu computador para obter os links.",
  "Harbor on other devices": "Harbor em outros dispositivos",
  "Serve Harbor on your network": "Disponibilizar o Harbor na sua rede",
  "One switch powers everything on this page: the web app, the phone remote, and the manga reader remote.":
    "Uma única chave ativa tudo nesta página: o aplicativo web, o controle pelo celular e o controle remoto do leitor de mangá.",
  "Phone remote": "Controle pelo celular",
  "Turns your phone into a remote for this computer: play, pause, seek, volume, and casting, all from the couch. Open the Wi-Fi address on your phone's browser.":
    "Transforma seu celular em um controle remoto para este computador: reproduzir, pausar, avançar, volume e transmissão, tudo do sofá. Abra o endereço de Wi-Fi no navegador do seu celular.",
  "Manga reader remote": "Controle remoto do leitor de mangá",
  "Control the manga flipbook from your phone while reading on the big screen: turn pages, zoom, and switch modes. The reader also shows this link while you read.":
    "Controle o flipbook de mangá pelo celular enquanto lê na tela grande: vire as páginas, use o zoom e alterne os modos. O leitor também mostra este link enquanto você lê.",
  "Manga remote (this computer)": "Controle remoto de mangá (este computador)",
  "Manga remote (Wi-Fi)": "Controle remoto de mangá (Wi-Fi)",
  "Flip the switch above and the phone remote and manga reader remote addresses appear here.":
    "Ligue a chave acima e os endereços do controle pelo celular e do controle do leitor de mangá aparecem aqui.",
  "On a beta that's giving you trouble? Pick an earlier build below and run its installer over your current copy. Your library, settings, and downloads all stay put.":
    "Está tendo problemas com uma versão beta? Escolha uma versão anterior abaixo e execute o instalador dela sobre a sua cópia atual. Sua biblioteca, configurações e downloads continuam onde estão.",
  "While beta updates are on, Harbor offers the newest build again on its next check. Turn beta updates off above to stay on an earlier one.":
    "Enquanto as atualizações beta estiverem ativadas, o Harbor volta a oferecer a versão mais recente na próxima verificação. Desative as atualizações beta acima para permanecer em uma versão anterior.",
  "Picture shaders run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "Os shaders de imagem são executados no motor mpv integrado ao aplicativo Harbor para desktop. Eles não têm efeito no navegador.",
  "Download the desktop app to use shaders.": "Baixe o aplicativo para desktop para usar shaders.",
  "More picture shaders": "Mais shaders de imagem",
  "Neural upscalers, sharpeners, and HDR tone-mapping ported for mpv. Each is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.":
    "Upscalers neurais, filtros de nitidez e mapeamento de tons HDR portados para o mpv. Cada um é hospedado pelo seu autor, não incluído no Harbor. Baixe os que quiser; o Harbor os encadeia na ordem certa e os aplica no player.",
  Cleared: "Limpo",
  "Sure?": "Tem certeza?",
  "Storage overview": "Visão geral do armazenamento",
  "Everything Harbor saves lives on this computer. If space runs low, clear a cache below; Harbor rebuilds them as you browse.":
    "Tudo o que o Harbor salva fica neste computador. Se faltar espaço, limpe um cache abaixo; o Harbor os reconstrói conforme você navega.",
  "App storage": "Armazenamento do aplicativo",
  "{quota} available": "{quota} disponível",
  "Settings storage": "Armazenamento das configurações",
  "Clear caches": "Limpar caches",
  "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.":
    "Seguro limpar a qualquer momento. Nada aqui afeta seu histórico de exibição, biblioteca, temas ou logins.",
  "Stream picker cache": "Cache do seletor de streams",
  "Remembered source lists per title. Clears stale results after changing addons or debrid.":
    "Listas de fontes memorizadas por título. Limpa resultados desatualizados após alterar complementos ou debrid.",
  "Manga browse cache": "Cache de navegação de mangá",
  "Cached chapter lists and browse pages. Downloads stay untouched.":
    "Listas de capítulos e páginas de navegação em cache. Os downloads permanecem intactos.",
  "Live TV caches": "Caches de TV ao vivo",
  "Parsed playlists, program guide, and series info. Re-downloads on next open.":
    "Playlists analisadas, guia de programação e informações de séries. Baixados novamente na próxima abertura.",
  "Dead stream marks": "Marcações de streams mortos",
  "Sources Harbor flagged as broken. Clear to give them another chance.":
    "Fontes que o Harbor marcou como quebradas. Limpe para dar outra chance a elas.",
  "Continue Watching suggestions cache": "Cache de sugestões de Continuar assistindo",
  "Resurface picks for the home rail. Rebuilds overnight.":
    "Traz de volta seleções para a faixa inicial. Reconstruído durante a noite.",
  "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.":
    "Os temas baixados são gerenciados em Tema e aparência. Os downloads de vídeo e mangá são gerenciados na página Downloads.",
  "Pattern (e.g. \\bremux\\b)": "Padrão (ex. \\bremux\\b)",
  "Downloaded from community": "Baixados da comunidade",
  "Badge art packs you installed from the community store. Remove one to put its badges back to default.":
    "Pacotes de arte de emblemas que você instalou na loja da comunidade. Remova um para restaurar os emblemas dele ao padrão.",
  "{n} badges": "{n} emblemas",
  "Pack removed, badges back to default": "Pacote removido, emblemas restaurados ao padrão",
  "Remove pack": "Remover pacote",
  "View community badge packs": "Ver pacotes de emblemas da comunidade",
  packs: "pacotes",
  "Any Stremio subtitle addons you have installed are searched here too.":
    "Quaisquer complementos de legendas do Stremio que você tenha instalado também são pesquisados aqui.",
  "{count} installed. Add or remove them under Streaming sources.":
    "{count} instalados. Adicione ou remova em Fontes de streaming.",
  "None installed yet. Add Stremio subtitle addons under Streaming sources.":
    "Nenhum addon instalado ainda. Adicione addons de legendas do Stremio em Fontes de streaming.",
  "Subtitle sources": "Fontes de legendas",
  "Harbor searches every source you enable at the same time, then merges and de-duplicates the results into one clean list. Turn a source off to stop pulling from it.":
    "O Harbor pesquisa ao mesmo tempo todas as fontes que você ativa, depois mescla os resultados e remove as duplicatas em uma única lista organizada. Desative uma fonte para parar de buscar resultados nela.",
  OpenSubtitles: "OpenSubtitles",
  "Harbor's built-in OpenSubtitles search, on by default. If you install an OpenSubtitles addon, this steps aside automatically so your results are never duplicated.":
    "A busca de OpenSubtitles integrada ao Harbor, ativada por padrão. Se você instalar um addon do OpenSubtitles, ela se desativa automaticamente para que seus resultados nunca sejam duplicados.",
  Wyzie: "Wyzie",
  "A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.":
    "Um índice rápido de legendas da comunidade. Desativado por padrão; ative-o para ter cobertura extra em lançamentos mais recentes ou de nicho.",
  "Subtitle addons": "Addons de legendas",
  SUBDL: "SUBDL",
  "A large multi-language subtitle database. Off until you add your free SUBDL API key.":
    "Um grande banco de dados de legendas em vários idiomas. Desativado até você adicionar sua chave de API gratuita do SUBDL.",
  "Paste your SUBDL API key": "Cole sua chave de API do SUBDL",
  "Get a free key at subdl.com": "Obtenha uma chave gratuita em subdl.com",
  Subsource: "Subsource",
  "A community subtitle source. Off until you add your Subsource API key.":
    "Uma fonte de legendas da comunidade. Desativada até você adicionar sua chave de API do Subsource.",
  "Paste your Subsource API key": "Cole sua chave de API do Subsource",
  "Get your key at subsource.net": "Obtenha sua chave em subsource.net",
  "Manage subtitle addons in Streaming sources":
    "Gerencie addons de legendas em Fontes de streaming",
  "The languages above all obey your preferred subtitle language order, which lives in the Languages page.":
    "Todos os idiomas acima seguem sua ordem preferida de idiomas de legenda, que fica na página Idiomas.",
  "Open Languages": "Abrir Idiomas",
  Quality: "Qualidade",
  Maximum: "Máxima",
  "Resolution posters are decoded at. High is sized to your screen with headroom and looks identical to full res while using far less memory; Balanced saves the most; Maximum keeps original resolution.":
    "A resolução em que os pôsteres são decodificados. Alta é dimensionada para a sua tela com folga e parece idêntica à resolução total usando muito menos memória; Equilibrada é a que mais economiza; Máxima mantém a resolução original.",
  "Poster dock magnification": "Ampliação do dock de pôsteres",
  "Gently magnify nearby posters as you move across a poster row, like a dock. Off by default.":
    "Amplia suavemente os pôsteres próximos conforme você percorre uma linha de pôsteres, como um dock. Desativado por padrão.",
  "Liquid Glass": "Vidro líquido",
  "Use liquid glass": "Usar vidro líquido",
  "Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.":
    "Use vidro líquido na barra de pesquisa e nas setas de rolagem das fileiras. As configurações de aparência abaixo são compartilhadas pelas superfícies de vidro do Harbor.",
  "Enhanced liquid glass": "Vidro líquido aprimorado",
  "A richer glass treatment. May look better while using more graphics resources.":
    "Um efeito de vidro mais rico. Pode parecer melhor, mas consome mais recursos gráficos.",
  "Glass opacity": "Opacidade do vidro",
  "Glass blur": "Desfoque do vidro",
  "Glass tint": "Tonalidade do vidro",
  "Featured source": "Fonte do destaque",
  "What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.":
    "O que preenche o destaque. Em alta é uma nova lista dos mais populares do Harbor, atualizada ao longo do dia. Clássico usa as suas próprias linhas da tela Início.",
  Classic: "Clássico",
  Screensaver: "Proteção de tela",
  "When Harbor sits idle in the foreground, it drifts through cinematic backdrops with a clock and what's trending. Any movement or key brings you back. Off by default.":
    "Quando o Harbor fica ocioso em primeiro plano, ele desliza por cenários cinematográficos com um relógio e o que está em alta. Qualquer movimento ou tecla traz você de volta. Desativado por padrão.",
  "Ambient screensaver": "Proteção de tela ambiente",
  "Start after": "Iniciar após",
  "3 min": "3 min",
  "5 min": "5 min",
  "10 min": "10 min",
  "15 min": "15 min",
  "Moving the window": "Mover a janela",
  "Choose where you can grab Harbor to drag it around your screen.":
    "Escolha onde você pode pegar o Harbor para arrastá-lo pela tela.",
  "Native-style hybrid bar": "Barra híbrida de estilo nativo",
  "Turn off the native window title bar above to use Harbor's hybrid bar instead.":
    "Desative a barra de título nativa da janela acima para usar a barra híbrida do Harbor em vez dela.",
  "Tuck clean, native-looking window buttons into the top corner, with hover labels. On macOS they become traffic-light dots. Blends into Harbor while feeling like your system's own title bar.":
    "Encaixa botões de janela limpos e com aparência nativa no canto superior, com rótulos ao passar o mouse. No macOS, eles se tornam pontos de semáforo. Combina com o Harbor e ao mesmo tempo parece a barra de título do seu próprio sistema.",
  "Frost the top bar on scroll": "Deixar a barra superior fosca ao rolar",
  "As you scroll, the top bar frosts over the content beneath it. Off by default; it uses a blur, so leave it off on lower-end machines.":
    "Ao rolar, a barra superior fica fosca sobre o conteúdo abaixo dela. Desativado por padrão; usa desfoque, então deixe desativado em máquinas mais fracas.",
  "Top-right controls": "Controles do canto superior direito",
  "The operating system draws native window controls, so Harbor cannot change their appearance.":
    "O sistema operacional desenha os controles nativos da janela, portanto o Harbor não pode alterar sua aparência.",
  "Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.":
    "Escolha a aparência de Assistir juntos e dos botões minimizar, maximizar e fechar. O vidro líquido substitui os controles transparentes limpos.",
  "Clean transparent": "Transparente limpo",
  "Liquid glass": "Vidro líquido",
  Filled: "Preenchido",
  "Drag the window from anywhere": "Arrastar a janela de qualquer lugar",
  "Move Harbor by dragging any empty space on a page, not just the top bar. Leave this off to keep clicks inside pages from nudging the window.":
    "Mova o Harbor arrastando qualquer espaço vazio de uma página, não apenas a barra superior. Deixe desativado para evitar que cliques dentro das páginas movam a janela sem querer.",
  "Stream priority": "Prioridade de streams",
  "Results from addons higher in this list come first. If one finds nothing, the next fills in.":
    "Os resultados dos addons mais acima nesta lista vêm primeiro. Se um não encontrar nada, o próximo assume.",
  "Following addon order": "Seguindo a ordem dos addons",
  "Use addon order": "Usar a ordem dos addons",
  "Not installed": "Não instalado",
  "Remove from list": "Remover da lista",
  "Priority applies once you have two or more stream addons.":
    "A prioridade passa a valer quando você tem dois ou mais addons de stream.",
  "{n} addons don't provide streams and aren't listed.":
    "{n} addons não fornecem streams e não aparecem aqui.",
  "Moved {name} to position {n} of {total}": "{name} movido para a posição {n} de {total}",
  "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.":
    "A classificação do Harbor coloca as fontes com melhor pontuação primeiro. A ordem dos addons mantém os resultados de cada addon na ordem em que foram retornados, como nos apps Stremio e Vidi. A prioridade de streams abaixo decide qual addon lidera, nos dois modos.",
  "If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "Se um stream não começar a reproduzir a tempo (uma fonte morta ou um addon fora do ar), tenta automaticamente o próximo stream disponível. Desativado por padrão.",
  "How long to wait first": "Quanto tempo esperar antes",
  "Slow addons and P2P sources often need more than 10 seconds to start. Raise this if streams are being skipped before they get a fair chance.":
    "Addons lentos e fontes P2P costumam precisar de mais de 10 segundos para começar. Aumente isto se os streams estiverem a ser saltados antes de terem hipótese.",
  "{n} sec": "{n} s",
  "Only start the torrent engine when needed": "Só iniciar o motor de torrents quando necessário",
  "Harbor normally starts its torrent engine at launch so the first P2P stream connects faster. That keeps a DHT node running and talking to the network even when you are not watching anything. Turn this on if you are on a metered or limited connection: the engine then starts the first time you actually play a torrent. Takes effect next launch.":
    "Normalmente o Harbor inicia o motor de torrents ao arrancar para que o primeiro stream P2P ligue mais depressa. Isso mantém um nó DHT ativo e a comunicar com a rede mesmo quando não está a ver nada. Ative isto se tiver uma ligação limitada ou tarifada: o motor passa a arrancar só na primeira vez que reproduzir um torrent. Aplica-se no próximo arranque.",
  "What fullscreen does": "O que o ecrã inteiro faz",
  "True fullscreen covers the whole screen and hides the taskbar. Maximize fills the screen but keeps the taskbar and title bar, so you can still switch apps.":
    "O ecrã inteiro real cobre todo o ecrã e esconde a barra de tarefas. Maximizar preenche o ecrã mas mantém a barra de tarefas e a barra de título, para continuar a trocar de aplicações.",
  "True fullscreen": "Ecrã inteiro real",
  Maximize: "Maximizar",
  "Dual subtitles": "Legendas duplas",
  "Show a second subtitle in another language at the same time. Handy when you are learning a language: keep the one you are learning as your main subtitle, and put your own language here.":
    "Mostra uma segunda legenda noutro idioma ao mesmo tempo. Útil quando está a aprender um idioma: mantenha o que está a aprender como legenda principal e coloque o seu próprio idioma aqui.",
  "Second subtitle language": "Idioma da segunda legenda",
  "Harbor loads it automatically when a track in that language exists. You can also set or clear the second track for one video from the subtitle menu in the player.":
    "O Harbor carrega-a automaticamente quando existe uma faixa nesse idioma. Também pode definir ou remover a segunda faixa para um vídeo no menu de legendas do reprodutor.",
  "Where it shows": "Onde aparece",
  "Top of the screen": "No topo do ecrã",
  "Above the main line": "Acima da linha principal",
  "Second line size": "Tamanho da segunda linha",
  "Get your own": "Tenha o seu",
  "Trial for ${n}": "Teste por ${n}",
  ElfHosted: "ElfHosted",
  "Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.":
    "O Debridge é a parte que lhe encontra um ficheiro que funciona. Vem com uma conta TorBox e uma de Usenet, por isso não precisa de comprar um serviço de debrid à parte. Já tem Real-Debrid ou AllDebrid? Basta ligá-lo.",
  "No Docker, no server, nothing to configure.": "Sem Docker, sem servidor, nada para configurar.",
  "${n} for {days} days": "${n} por {days} dias",
  "cancel anytime": "cancele quando quiser",
  "Rather not set any of this up?": "Prefere não configurar nada disto?",
  "Get {name} hosted, plus {n} more addons.": "Tenha o {name} alojado, e mais {n} addons.",
  "{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.":
    "{n} addons geridos por si, com Debridge incluído: contas TorBox e Usenet, sem serviço de debrid para comprar à parte.",
  "Try it for ${n}": "Experimente por ${n}",
  "Hide this": "Ocultar",
  "Includes Comet, MediaFusion, AIOStreams, StremThru, Jackettio and more, plus TorBox and Usenet accounts. No Docker, no server, no config.":
    "Inclui Comet, MediaFusion, AIOStreams, StremThru, Jackettio e mais, além de contas TorBox e Usenet. Sem Docker, sem servidor, sem configuração.",
  "Support Harbor": "Apoiar o Harbor",
  "Who keeps this running": "Quem mantém isto a funcionar",
  "Harbor's backend runs on ElfHosted. They took it on without being asked, and Harbor has never charged for anything.":
    "O backend do Harbor corre na ElfHosted. Assumiram-no sem lhes ser pedido, e o Harbor nunca cobrou nada.",
  "If you want to put money somewhere and you use Harbor, an ElfHosted subscription is the most useful place for it. You get a managed instance, and the servers Harbor depends on stay paid for.":
    "Se quiser gastar dinheiro em algo e usa o Harbor, uma subscrição da ElfHosted é o sítio mais útil. Fica com uma instância gerida, e os servidores de que o Harbor depende continuam pagos.",
  "Browse ElfHosted": "Ver a ElfHosted",
  "One-off donation": "Doação única",
  "Donating to Harbor": "Doar ao Harbor",
  "Short version: don't. Harbor takes no donations and no cut of anything on this page.":
    "Versão curta: não. O Harbor não aceita doações nem leva qualquer parte do que está nesta página.",
  "People have offered plenty of times and the answer has stayed no. If you were going to send something, send it to ElfHosted above so the infrastructure stays up, or to one of the charities below. Both do more good than paying me would.":
    "Já ofereceram muitas vezes e a resposta manteve-se não. Se ia enviar algo, envie à ElfHosted acima para a infraestrutura se manter de pé, ou a uma das instituições abaixo. Ambas fazem mais bem do que pagar-me a mim.",
  "If you would rather give it away": "Se preferir doar",
  "No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.":
    "Sem afiliação, sem links de referência, e o Harbor não recebe nada destes. São apenas sítios onde o dinheiro rende mais do que aqui.",
  "Insecticide-treated nets. One of the most cost-effective interventions measured.":
    "Redes tratadas com inseticida. Uma das intervenções com melhor relação custo-eficácia já medidas.",
  "Cash straight to people living in extreme poverty, no strings.":
    "Dinheiro directo a pessoas em pobreza extrema, sem condições.",
  "Emergency medical care in crisis zones.": "Cuidados médicos de emergência em zonas de crise.",
  "Keeps the web's memory alive. Harbor would be poorer without it.":
    "Mantém viva a memória da web. O Harbor seria mais pobre sem ela.",
  "Who pays for the servers, and where to put money if you want to.":
    "Quem paga pelos servidores e onde colocar dinheiro, se você quiser.",
  "Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.":
    "O backend do Harbor funciona na ElfHosted. Eles mantêm nossos servidores sem custo para a comunidade.",
  "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.":
    "Manter o backend do Harbor no ar custa dinheiro de verdade, e a ElfHosted arca com isso para que a comunidade não precise. Assinar é a melhor forma de manter isso funcionando, e não é uma doação. Você ganha uma infraestrutura de verdade para a sua própria configuração, e o Harbor continua financiado ao mesmo tempo.",
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.":
    "Add-ons privados do Stremio com 10x mais limites de requisições e proxy de streams embutido, a partir de $9 por mês.",
  "Managed Plex, Emby, or Jellyfin, running in minutes with no hardware and no Docker.":
    "Plex, Emby ou Jellyfin gerenciados, funcionando em minutos, sem hardware e sem Docker.",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.":
    "Mais de 100 apps auto-hospedados: o stack *arr, ferramentas de debrid, livros e audiolivros, e muito mais.",
  "Daily backups, automatic updates, and monitoring, all handled for you.":
    "Backups diários, atualizações automáticas e monitoramento, tudo cuidado por eles.",
  "Month to month, cancel anytime, and you can try the whole thing for $1 for a week.":
    "Mês a mês, cancele quando quiser, e você pode testar tudo por $1 durante uma semana.",
  "See what you get": "Veja o que você ganha",
  "Short version: don't. Harbor takes no donations.":
    "Versão curta: não. O Harbor não aceita doações.",
  "If you were going to send something, send it to ElfHosted above so the servers stay paid for, or to one of the charities below. Both do more good with it.":
    "Se você ia enviar algo, envie para a ElfHosted acima, para manter os servidores pagos, ou para uma das instituições abaixo. Ambas fazem mais bem com isso.",
  "Badges for giving": "Emblemas por contribuir",
  "Give to any charity below or subscribe to ElfHosted, and the badge lands on your profile.":
    "Doe para qualquer instituição abaixo ou assine a ElfHosted, e o emblema aparece no seu perfil.",
  Charity: "Caridade",
  "For donating to a charity.": "Por doar para uma instituição de caridade.",
  "Charity $100+": "Caridade $100+",
  "For giving more than $100 to charity.": "Por doar mais de $100 para caridade.",
  "For an active ElfHosted subscription.": "Por ter uma assinatura ativa da ElfHosted.",
  "To get a Charity badge, forward your donation receipt or invoice to":
    "Para receber um emblema de Caridade, encaminhe o recibo ou a fatura da sua doação para",
  "with your @handle in the body so we can match it to your account.":
    "com o seu @handle no corpo do e-mail, para associarmos à sua conta.",
  "Childhood cancer research and treatment. Families are never billed for care, travel, housing, or food.":
    "Pesquisa e tratamento do câncer infantil. As famílias nunca pagam por tratamento, transporte, hospedagem ou alimentação.",
  "Funds research into less toxic, more targeted treatments for childhood cancer.":
    "Financia pesquisas por tratamentos menos tóxicos e mais direcionados para o câncer infantil.",
  "Defends privacy, free expression, and the open internet, in the courts and in the code.":
    "Defende a privacidade, a liberdade de expressão e a internet aberta, nos tribunais e no código.",
  "Emergency medical care in crisis zones, independent of politics.":
    "Atendimento médico de emergência em zonas de crise, independente de política.",
  "Look any of them up on Charity Navigator": "Consulte qualquer uma delas no Charity Navigator",
  "Built on Stremio": "Construído sobre o Stremio",
  "Harbor would not be possible without Stremio. It is the foundation everything here is built on.":
    "O Harbor não seria possível sem o Stremio. É a base sobre a qual tudo aqui é construído.",
  "Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.":
    "O Harbor fala o protocolo de addons do Stremio, e todo o ecossistema de addons nasce do trabalho deles. O Stremio é financiado pela sua comunidade, e quem contribui ganha acesso antecipado a recursos experimentais. Se você puder, mande algo para eles também.",
  "Support Stremio": "Apoiar o Stremio",
  "Stremio Supporters get a special badge on their Harbor profile.":
    "Apoiadores do Stremio ganham um emblema especial no seu perfil do Harbor.",
  "Your own private {name}, bundled with Debridge": "O seu {name} privado, com Debridge incluído",
  "Who keeps the lights on, what Harbor is built on, and where to put money if you want to.":
    "Quem mantém tudo funcionando, sobre o que o Harbor é construído, e onde colocar dinheiro se você quiser.",
  "If you were going to send something, send it to ElfHosted or Stremio above, or to one of the charities below. They all do more good with it.":
    "Se você ia enviar algo, envie para a ElfHosted ou o Stremio acima, ou para uma das instituições abaixo. Todos fazem mais bem com isso.",
  "Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.":
    "Apoie a ElfHosted ou o Stremio, ou doe para qualquer instituição abaixo, e o emblema aparece no seu perfil.",
  "Fullscreen clock": "Relógio em tela cheia",
  "Keep your local time visible during fullscreen playback and choose how it looks.":
    "Mantenha o horário local visível durante a reprodução em tela cheia e escolha como ele aparece.",
  "Show fullscreen clock": "Mostrar relógio em tela cheia",
  "The clock appears with the player controls.":
    "O relógio aparece junto com os controles do player.",
  "Clock format": "Formato do relógio",
  "12-hour": "12 horas",
  "24-hour": "24 horas",
  "Show seconds": "Mostrar segundos",
  "Update the clock every second.": "Atualiza o relógio a cada segundo.",
  "Show estimated finish time": "Mostrar horário estimado de término",
  "Display the local time when the current video is expected to end.":
    "Exibe o horário local em que o vídeo atual deve terminar.",
  "Clock size": "Tamanho do relógio",
  "Clock style": "Estilo do relógio",
  Minimal: "Minimalista",
  Solid: "Sólido",
  Accent: "Destaque",
  "Soft blur with a floating pill.": "Desfoque suave em uma pílula flutuante.",
  "Time only, with a subtle shadow.": "Apenas o horário, com uma sombra sutil.",
  "High-contrast panel for busy scenes.": "Painel de alto contraste para cenas movimentadas.",
  "Uses your theme's accent color.": "Usa a cor de destaque do seu tema.",
  "Focused Card": "Cartão em foco",
  "Expanding Cards": "Cartões expansíveis",
  "Emphasize the selected card across the page while gently darkening and blurring the other cards.":
    "Destaca o cartão selecionado na página, escurecendo e desfocando suavemente os outros cartões.",
  "Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.":
    "Expande os cartões de pôster durante a navegação por teclado ou controle nas fileiras de pôsteres, usando arte larga pré-carregada.",
  "Add a TMDB key in Settings to identify the cast.":
    "Adicione uma chave TMDB nas Configurações para identificar o elenco.",
  "No cast photos are available for this title.":
    "Não há fotos do elenco disponíveis para este título.",
};

export default settingsFill;
