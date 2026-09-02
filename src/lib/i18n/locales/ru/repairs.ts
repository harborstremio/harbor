const repairs: Record<string, string> = {
  "Annie Award": "Премия «Энни»",
  "Annie Awards": "Премии «Энни»",
  "BAFTA Television": "Телевизионная премия BAFTA",
  "Crunchyroll Anime Awards": "Премия Crunchyroll Anime Awards",
  "Discord Rich Presence": "Расширенный статус Discord",
  "Harbor Relay": "Ретранслятор Harbor",
  "{n} ms": "{n} мс",
  "{n} px/s": "{n} пикс./с",
  "{n} titles need review — help us identify them.":
    "{n} названий требуют проверки – помогите их определить.",
  "{n} titles need review — help us identify them.#few":
    "{n} названия требуют проверки – помогите их определить.",
  "{n} titles need review — help us identify them.#one":
    "{n} название требует проверки – помогите его определить.",
  "★ {rating} — Change": "★ {rating} – изменить",
  "1 title needs review — help us identify it.":
    "1 название требует проверки – помогите его определить.",
  "10s": "10 с",
  "14s": "14 с",
  "15s": "15 с",
  "20s": "20 с",
  "30s": "30 с",
  "45s": "45 с",
  "5s": "5 с",
  "A classic neural edge-directed luma doubler. Very high quality, heavy on the GPU. More neurons means sharper and slower.":
    "Классический нейросетевой удвоитель яркости с учётом краёв. Очень высокое качество, тяжело для GPU. Больше нейронов – резче и медленнее.",
  "A client for the Stremio protocol. Two minutes to set up; most of it optional. You stay in control of every key.":
    "Клиент для протокола Stremio. Две минуты на настройку, и почти всё – по желанию. Все ключи остаются под вашим контролем.",
  "A relay is a tiny Cloudflare Worker that passes play/pause/seek messages between you and your friends. No video data ever touches it. Deploy your own in one click (free tier is plenty), or paste a friend's invite link to use theirs.":
    "Ретранслятор – это крошечный Cloudflare Worker, который передаёт команды воспроизведения, паузы и перемотки между вами и друзьями. Видеоданные через него никогда не проходят. Разверните свой в один клик (бесплатного тарифа хватит с запасом) или вставьте ссылку-приглашение друга, чтобы использовать его ретранслятор.",
  "A trained luma doubler that is cheap enough to leave on. Excellent on anime and flat-shaded sources. Pick a radius, larger is sharper and heavier.":
    "Обученный удвоитель яркости, достаточно лёгкий, чтобы держать его включённым. Отлично работает с аниме и плоской заливкой. Выберите радиус: больше – резче и тяжелее.",
  "Accept the terms": "Примите условия",
  "Already have a TMDB login? Sign in and skip ahead. Otherwise press Register and fill in a username, password and email.":
    "Уже есть аккаунт TMDB? Войдите и пропустите следующие шаги. Если нет, нажмите Register и укажите имя пользователя, пароль и адрес эл. почты.",
  "Autoplay trailer on detail pages": "Автовоспроизведение трейлера на страницах контента",
  "Back on the API page, scroll to the bottom. Copy the value under API Key and paste it into Harbor. Harbor saves it on its own.":
    "На странице API прокрутите вниз. Скопируйте значение в поле API Key и вставьте его в Harbor. Harbor сохранит его автоматически.",
  "Back on TMDB, click your avatar in the top right and choose Settings from the menu.":
    "Вернувшись на TMDB, нажмите свой аватар в правом верхнем углу и выберите в меню Settings.",
  Born: "Дата рождения",
  Both: "Оба варианта",
  "Bring your own keys": "Используйте свои ключи",
  "Change your handle?": "Изменить никнейм?",
  "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.":
    "При изменении языка метаданных Harbor перезапустится, чтобы применить новый язык. Закончив с параметрами выше, нажмите «Применить».",
  "Choose API in the sidebar": "Выберите API на боковой панели",
  "Click Activate in the email": "Нажмите Activate в письме",
  "Click to apply · Right-click to delete": "Клик – применить · Правый клик – удалить",
  "Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.":
    "При закрытии окна Harbor сворачивается в трей, а не завершается, поэтому открывается мгновенно. Правый клик по значку в трее – быстрые действия, «Выход» – полное завершение.",
  Colored: "Цветной",
  "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.":
    "«Компактно» показывает лучший вариант, плитки качества и панель. «Stremio» – плоский список по дополнениям, без оценок.",
  "Confirm personal use once more and tick the box to agree to the API terms.":
    "Ещё раз подтвердите личное использование и установите флажок согласия с условиями API.",
  "Connect Trakt or Simkl, or start watching, and your stats will build themselves.":
    "Подключите Trakt или Simkl либо просто начните смотреть – статистика соберётся сама.",
  "Connected — {n} catalogs available": "Подключено – доступно каталогов: {n}",
  "Content advisory style": "Вид предупреждений о содержании",
  "Copy your API Key": "Скопируйте API Key",
  "Cursor speed": "Скорость курсора",
  "Daily backups, automatic updates, and monitoring, all handled for you.":
    "Ежедневные резервные копии, автоматические обновления и мониторинг – всё берут на себя.",
  "Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.":
    "Debridge – это то, что находит вам рабочий файл. В комплекте идут аккаунты TorBox и Usenet, так что отдельно покупать debrid-сервис не нужно. Уже есть Real-Debrid или AllDebrid? Просто подключите его.",
  "Deeper cuts from every catalog and add-on you have installed.":
    "Менее известное из всех установленных каталогов и дополнений.",
  "Defends privacy, free expression, and the open internet, in the courts and in the code.":
    "Защищает приватность, свободу слова и открытый интернет – в судах и в коде.",
  "Drag the corner to resize. Left and right change width; up and down change height; Home resets the size.":
    "Перетащите угол для изменения размера. Стрелки влево и вправо меняют ширину, вверх и вниз – высоту, а Home сбрасывает размер.",
  "Drag to resize. Use arrow keys to adjust, or Home to reset.":
    "Перетащите для изменения размера. Используйте клавиши со стрелками для настройки, а Home – для сброса.",
  Edge: "Край",
  "Edge-aware sharpening that lifts soft detail without the halos of a naive sharpen. An alternative to CAS, run one or the other, not both.":
    "Резкость с учётом краёв: проявляет мягкие детали без ореолов, свойственных обычному повышению резкости. Альтернатива CAS – включайте что-то одно.",
  Email: "Эл. почта",
  "Empty — click to add filters": "Пусто – нажмите, чтобы добавить фильтры",
  Ended: "Завершено",
  "Engine status and your P2P settings as JSON, ready to paste into a bug report.":
    "Состояние движка и ваши настройки P2P в JSON – можно вставить в отчёт об ошибке.",
  Ep: "Сер.",
  "Esc or click outside to close": "Esc или клик вне окна – закрыть",
  "Every addon": "Все дополнения",
  "Every Harbor that announces itself on this network appears here as it answers, with the theme it is wearing.":
    "Каждый Harbor, объявивший себя в этой сети, появляется здесь по мере ответа – вместе с темой, в которую он одет.",
  "Every winner Harbor ships, browsable offline by year and category.":
    "Все победители, входящие в Harbor, – просмотр офлайн по годам и категориям.",
  "Everything else, via your own server": "Всё остальное – через свой сервер",
  "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.":
    "Экспортируйте настройки Harbor в один файл и выберите, что именно сохранить. При восстановлении вернутся только данные из файла. Вход в Stremio никогда не включается.",
  "Fill in the details, then Subscribe": "Заполните данные и нажмите Subscribe",
  "For Application URL anything works, for example https://harbor.site. TMDB never visits it.":
    "В поле Application URL подойдёт любой адрес, например https://harbor.site. TMDB не будет его открывать.",
  "Free forever for personal use. No payment, ever.":
    "Бесплатно навсегда для личного использования. Оплата не требуется.",
  "Fresh tomato for 60%+, splat for under.": "Свежий помидор при 60%+, клякса – ниже.",
  "From your addons": "Из ваших дополнений",
  "Full mode — diary, friends & ratings enabled":
    "Полный режим – дневник, друзья и оценки включены",
  "Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.":
    "Полный режим выполняет вход с паролем Letterboxd и дополнительно открывает дневник, активность друзей и ваши оценки. Пароль отправляется только в Stremboxd для получения токена – Harbor его не хранит.",
  "Genres are only recorded for files scanned after this feature was added — re-add a folder to pick them up.":
    "Жанры записываются только для файлов, просканированных после появления этой функции – добавьте папку заново, чтобы их подтянуть.",
  "Get your free TMDB key": "Получите бесплатный ключ TMDB",
  "Give each addon": "Давать каждому дополнению",
  "Give to any charity below or subscribe to ElfHosted, and the badge lands on your profile.":
    "Пожертвуйте любой организации ниже или оформите подписку ElfHosted – и значок появится в вашем профиле.",
  "Group the movies and shows you love. Rewatch shelf, weekend picks, whatever keeps them close.":
    "Соберите любимые фильмы и сериалы. Полка для пересмотра, подборка на выходные – что угодно, лишь бы они были под рукой.",
  "Harbor asks your addons for titles and descriptions in this language. The TV menus stay in English.":
    "Harbor запрашивает у ваших дополнений названия и описания на этом языке. Меню на ТВ остаются на английском.",
  "Harbor is an independent client. It is not affiliated with or endorsed by Stremio.":
    "Harbor – независимый клиент. Он не связан со Stremio и не одобрен им.",
  "Harbor leads with one big title. Classic leads with rows.":
    "Harbor начинает с одного крупного названия. Classic – с рядов.",
  "Harbor needs at least one streaming source before it can play {title}. Install a stream addon or add a debrid key in settings.":
    "Harbor нужен хотя бы один источник, чтобы воспроизвести {title}. Установите дополнение с потоками или добавьте ключ debrid в настройках.",
  "Harbor sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.":
    "Harbor не отправляет телеметрию. Также блокируются исходящие рекламные, аналитические и трекерные запросы дополнений и провайдеров метаданных ещё до выхода с вашего устройства.",
  "Harbor tried {n} sources for {title} and none of them played. Usually that means a debrid key has expired, no stream addon is installed yet, or nothing has this title cached.":
    "Harbor перепробовал источники для {title} (всего: {n}), и ни один не заработал. Обычно это значит, что истёк ключ debrid, ещё не установлено дополнение с потоками или это название нигде не закешировано.",
  "Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help, the source is open.":
    "Harbor создавался на английском. Поддержка других языков неполная, поэтому ваши дополнения обычно находят то, что пропускают собственные фильтры Harbor. Если вы владеете другим языком и хотите помочь, исходный код открыт.",
  "Head to Discover. Cinemeta and OpenSubtitles cover the basics; Torrentio + a debrid key cover almost everything else.":
    "Загляните в «Обзор». Cinemeta и OpenSubtitles закрывают основное; Torrentio + ключ debrid – почти всё остальное.",
  "Hero, Top 10, Trending, In Theaters, per-service rails. Your addons append underneath.":
    "Баннер, Топ-10, «В тренде», «В кино», ряды по сервисам. Ваши дополнения – ниже.",
  "How quickly the Harbor cursor moves with the right stick.":
    "Скорость движения курсора Harbor при использовании правого стика.",
  "How the 4K and HDR tags beside the title look. Bar draws a vertical accent line and reveals each line as it appears; Chips shows small outlined pills that slide in.":
    "Как выглядят метки 4K и HDR рядом с названием. «Полоса» рисует вертикальную акцентную линию и показывает строки по мере появления; «Чипы» – маленькие контурные плашки, которые выезжают сбоку.",
  "If a stream hasn't started playing within 10 seconds (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "Если поток не начал воспроизводиться за 10 секунд (мёртвый источник или недоступное дополнение), автоматически пробовать следующий доступный поток. По умолчанию выключено.",
  "If you want to put money somewhere and you use Harbor, an ElfHosted subscription is the most useful place for it. You get a managed instance, and the servers Harbor depends on stay paid for.":
    "Если вы пользуетесь Harbor и хотите куда-то вложить деньги, подписка ElfHosted – самое полезное место. Вы получаете управляемый экземпляр, а серверы, от которых зависит Harbor, остаются оплаченными.",
  "Inside it, one folder per manga, named like the title.":
    "Внутри – по одной папке на каждую мангу, названной по её названию.",
  "Install a Stremio addon and its catalogs show up here as poster rails, ready to browse.":
    "Установите дополнение Stremio – его каталоги появятся здесь рядами постеров, готовые к просмотру.",
  "is a page number. Add": "– номер страницы. Добавьте",
  "is a regex for the part to change": "– регулярное выражение для заменяемой части",
  "is each chapter row": "– строка каждой главы",
  "is how many items to skip, starting at 0. Harbor auto-detects the site's page size and walks it for you, so you never set a page size. Use this when the URL counts items.":
    "– сколько элементов пропустить, начиная с 0. Harbor сам определяет размер страницы сайта и листает её за вас, поэтому размер страницы задавать не нужно. Используйте, если URL считает элементы.",
  "is the box around one manga; inside it": "– контейнер вокруг одной манги; внутри него",
  "is the manga URL": "– URL манги",
  "is the search text (searchPath only).": "– текст поиска (только searchPath).",
  "is what to swap in. The example turns": "– то, на что заменить. Пример превращает",
  "Jina Reader": "Jina Reader",
  "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.":
    "Поддержание бэкенда Harbor в сети стоит реальных денег, и ElfHosted берёт это на себя, чтобы сообществу не пришлось. Оформить подписку – лучший способ сохранить это, и это не пожертвование. Вы получаете полноценную инфраструктуру для собственной настройки, и при этом Harbor остаётся профинансированным.",
  "Keyboard size": "Размер клавиатуры",
  "Library is everything from Stremio, Trakt, and this device. Watchlist is only titles you haven't watched yet. History is what you've watched. Local is files on your computer.":
    "Библиотека – это всё из Stremio, Trakt и с этого устройства. Список к просмотру – только названия, которые вы ещё не смотрели. История – то, что уже просмотрено. Локальные – файлы на вашем компьютере.",
  "Library, watch progress, and addon collection sync from this account.":
    "Библиотека, прогресс просмотра и набор дополнений синхронизируются с этим аккаунтом.",
  "Live web": "Поиск в интернете",
  "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.":
    "Внедряется в документ на лету. Меняйте оформление кнопок, отступы, цвета – что угодно.",
  "Monochrome (White)": "Монохромный (белый)",
  "Movies you've watched and shows you've made progress on stop appearing in the built-in Discover rows, using your Trakt history. Needs Trakt connected. Continue Watching is never touched.":
    "Просмотренные фильмы и начатые сериалы перестанут появляться во встроенных рядах раздела Обзор – по вашей истории Trakt. Нужен подключённый Trakt. Продолжить просмотр не затрагивается.",
  "Official age rating": "Официальный возрастной рейтинг",
  "On shows titles in your metadata language (English by default). Off keeps titles in English.":
    "Если включено, названия показываются на языке метаданных (по умолчанию на английском). Если выключено, они остаются на английском.",
  "once every 14 days": "раз в 14 дней",
  "Open the email TMDB sent to the address you registered with and press the activate button inside it. Check spam if it has not arrived.":
    "Откройте письмо от TMDB, отправленное на указанный адрес, и нажмите в нём кнопку активации. Если письма нет, проверьте папку «Спам».",
  "Open the TMDB API page": "Открыть страницу API TMDB",
  "Open your account settings": "Откройте настройки аккаунта",
  "People have offered plenty of times and the answer has stayed no. If you were going to send something, send it to ElfHosted above so the infrastructure stays up, or to one of the charities below. Both do more good than paying me would.":
    "Предлагали много раз, и ответ остаётся прежним – нет. Если хотите что-то отправить, отправьте это ElfHosted выше, чтобы инфраструктура продолжала работать, или одному из фондов ниже. И то и другое принесёт больше пользы, чем деньги мне.",
  "Pick one folder. Each subfolder inside is one manga, so name it exactly like the title. In each, add chapter folders of images or .cbz / .zip files. A cover.jpg sets a custom cover.":
    "Выберите одну папку. Каждая вложенная папка – это одна манга, поэтому назовите её точно как название. Внутри добавьте папки глав с изображениями или файлы .cbz / .zip. Файл cover.jpg задаёт свою обложку.",
  "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "Выберите, что сохранить, и всё выбранное попадёт в один файл: тема, оформление главной, настройки, дополнения, профили, список к просмотру, раскладки плеера, прогресс просмотра и другое. Вход в Stremio намеренно не включается.",
  "Play from": "Воспроизвести с",
  "Player screen lock": "Блокировка управления плеером",
  "Prove you are human": "Подтвердите, что вы не робот",
  "repo.json identifies and versions the plugin. Filtering, title cleanup, volumes, chapters, dates, and views are returned by example.plugin.js.":
    "repo.json задаёт идентификатор и версии плагина. Фильтрацию, очистку названий, тома, главы, даты и представления возвращает example.plugin.js.",
  "Request a key": "Запросите ключ",
  "Result order (ranking / addon order)": "Порядок результатов (рейтинг / порядок дополнений)",
  "Right after registering TMDB tells you the account is not active yet. Nothing is broken, the email is on its way.":
    "Сразу после регистрации TMDB сообщает, что аккаунт ещё не активирован. Всё в порядке: письмо уже отправлено.",
  "Say it is for personal use": "Укажите личное использование",
  "Sets streaming availability and the Now Playing release window. Pick a country and Harbor offers to match the interface, metadata, subtitle, and audio languages to it.":
    "Определяет доступность стриминговых сервисов и период премьер для раздела «Сейчас в кино». Выберите страну, и Harbor предложит привести в соответствие язык интерфейса, метаданных, субтитров и аудио.",
  "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.":
    "Показывать в плеере кнопку блокировки, которая отключает мышь, клавиатуру, пульт и мультимедийные клавиши до разблокировки.",
  "Sign in, or make an account": "Войдите или создайте аккаунт",
  "Six places to start. Tap one and we'll filter the catalog for you.":
    "Шесть точек старта. Выберите одну – отфильтруем каталог.",
  "Size of the controller on-screen keyboard.": "Размер экранной клавиатуры для контроллера.",
  soon: "скоро",
  "Spoiler — Click": "Спойлер – нажмите",
  "Spoiler — Click to reveal": "Спойлер – нажмите, чтобы показать",
  "Stream torrents through Harbor's own Rust peer-to-peer engine instead of the bundled Stremio Server. Falls back automatically if it can't connect. Status and a self-test live in the Local engine card below.":
    "Воспроизводить торренты через собственный P2P-движок Harbor на Rust вместо встроенного Stremio Server. При сбое подключения автоматически используется запасной вариант. Состояние и самопроверка – в карточке «Локальный движок» ниже.",
  "Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.":
    "Поддержите ElfHosted или Stremio, или пожертвуйте любой организации ниже – и значок появится в вашем профиле.",
  "Take the short API Key at the very bottom, not the long API Read Access Token above it.":
    "Возьмите короткий API Key в самом низу, а не длинный API Read Access Token над ним.",
  "That was the hard part": "Самое сложное позади",
  "The dotted line is a flat squeeze of the whole range. A curve that stays high keeps midtones punchy and compresses the highlights late; a lower curve rolls off early and looks gentler.":
    "Пунктир – это равномерное сжатие всего диапазона. Кривая, идущая высоко, сохраняет сочность средних тонов и сжимает света в конце; более низкая кривая спадает раньше и выглядит мягче.",
  "The editor is a working copy of the player. Click any control on it to move, resize, restyle or hide that control.":
    "Редактор – это рабочая копия плеера. Нажмите на любой элемент, чтобы переместить, изменить размер, оформление или скрыть его.",
  "The engine listens on a local port and joins the DHT to find peers. Active torrents are the streams it currently has open.":
    "Движок слушает локальный порт и подключается к DHT для поиска пиров. Активные торренты – это потоки, открытые сейчас.",
  "The next three screens need typing. Scan this and your phone does it for you.":
    "На следующих трёх экранах нужно вводить текст. Отсканируйте код – телефон сделает это за вас.",
  "The same camera pan on each setting. The lit lane is what you get right now.":
    "Одно и то же движение камеры при каждой настройке. Подсвеченная дорожка – то, что у вас сейчас.",
  "The settings page has a list down the left. Click API near the bottom.":
    "Слева на странице настроек есть список. Нажмите API ближе к его концу.",
  "The two clock labels are ordinary controls. Move or hide either of them in the layout editor.":
    "Две метки времени – обычные элементы управления. Их можно переместить или скрыть в редакторе макета.",
  "This instance of Harbor is made for desktop. Our standalone iOS and Android apps are coming soon, each with a bespoke, mobile-first experience built for its native platform.":
    "Эта версия Harbor сделана для десктопа. Отдельные приложения для iOS и Android скоро выйдут – каждое со своим мобильным интерфейсом под родную платформу.",
  "This is the part people get stuck on. None of it is checked and nothing is billed. Give the app any name, any URL, pick a type of use, and write a sentence for the summary. The contact fields can be anything real enough to look sensible. Tick the agreement and press Subscribe.":
    "На этом шаге часто возникают вопросы. Данные не проверяются, оплата не взимается. Укажите любое название приложения и URL, выберите тип использования и напишите одно предложение в описании. В контактных полях укажите правдоподобные данные. Установите флажок согласия и нажмите Subscribe.",
  "TMDB asks what the key is for. Choose Yes, this is for my own personal use only.":
    "TMDB спросит, для чего нужен ключ. Выберите Yes, this is for my own personal use only.",
  "TMDB confirms the key is created. Follow the link it gives you to see your API key details.":
    "TMDB подтвердит создание ключа. Перейдите по предложенной ссылке, чтобы открыть сведения о ключе API.",
  "TMDB may show a captcha while you register. Complete it to carry on.":
    "Во время регистрации TMDB может показать капчу. Пройдите её, чтобы продолжить.",
  "TMDB powers the firehose of every release this month. The free tier covers it. About 60 seconds to set up. Switch to My Library if you'd rather only see what you've saved.":
    "TMDB даёт полный поток всех релизов месяца. Бесплатного тарифа хватает. Настройка – около 60 секунд. Переключитесь на «Мою библиотеку», если хотите видеть только сохранённое.",
  "Trending tracks star growth across your Harbor visits. Open the addons page again tomorrow and the top risers will appear here.":
    "Тренды отслеживают прирост звёзд между вашими визитами в Harbor. Откройте страницу дополнений завтра – здесь появятся лидеры роста.",
  "Type what you want in plain language and let a model find it. Bring your own API key from either service.":
    "Опишите обычными словами, что хотите найти, и модель выполнит поиск. Нужен собственный API-ключ одного из сервисов.",
  "Use color to distinguish severity, or keep every advisory monochrome.":
    "Выделять уровни серьёзности цветом или показывать все предупреждения монохромными.",
  "Use the button below. If you are not signed in yet TMDB says you do not have permission, which is normal. Click the link in that message to sign in.":
    "Нажмите кнопку ниже. Если вы ещё не вошли, TMDB сообщит, что у вас нет доступа. Это нормально. Нажмите ссылку в сообщении, чтобы войти.",
  "Version and capabilities come straight from the addon's manifest. Ratings and categories come from the":
    "Версия и возможности берутся прямо из манифеста дополнения. Рейтинги и категории – из",
  "Watchlist is what you've saved for later. History is everything you've watched. Local is files on your computer.":
    "Список просмотра – то, что сохранено на потом. История – всё просмотренное. Локальные – файлы на вашем компьютере.",
  "We need to check your age before you sail ahead. Three quick questions a working adult would know in their sleep. Get them all right and the adult shelf opens.":
    "Нужно подтвердить возраст, прежде чем плыть дальше. Три коротких вопроса, на которые взрослый ответит не задумываясь. Ответьте верно на все – раздел для взрослых откроется.",
  "What happens when you hit Play on a title. Instant just starts; Manual lets you pick the source.":
    "Что происходит при нажатии «Воспроизвести» на названии. «Мгновенно» – сразу запуск, «Вручную» – выбор источника.",
  "When a movie or episode starts, briefly show its Common Sense Media parental guide (violence, nudity, profanity, substances) with severity. Fades on its own.":
    "В начале фильма или серии ненадолго показывать родительскую памятку Common Sense Media с уровнем сцен насилия, наготы, ненормативной лексики и употребления веществ. Она исчезнет автоматически.",
  "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.":
    "При продолжении просмотра запускать тот же поток, что и в прошлый раз (то же дополнение и источник), не открывая выбор заново. Отключите, чтобы каждый раз выбирать заново.",
  "Where you watch from": "Страна просмотра",
  "You have no key yet, so TMDB asks you to request one. Follow the link to create it.":
    "Ключа у вас пока нет, поэтому TMDB предложит запросить его. Перейдите по ссылке, чтобы создать ключ.",
  "Your account needs activating": "Аккаунт нужно активировать",
  "Your Continue Watching, your watchlist and your addons, on this TV.":
    "Ваш раздел «Продолжить просмотр», список к просмотру и дополнения на этом телевизоре.",
  "Your Continue Watching, your watchlist and your addons.":
    "Ваш раздел «Продолжить просмотр», список к просмотру и дополнения.",
  "YOUR FILTERS": "ВАШИ ФИЛЬТРЫ",
  "Deploy your relay": "Развернуть свой ретранслятор",
  "Which account should the relay live in?": "В каком аккаунте разместить ретранслятор?",
  "Relay is live": "Ретранслятор запущен",
  "Your relay URL": "Ваш URL ретранслятора",
  "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.":
    "Ретранслятор Harbor работает как Cloudflare Worker и содержит WebSocket-комнаты для совместного просмотра. Каждый пользователь запускает свой. Центрального сервера Harbor нет.",
  "Wait for the upload to finish. The relay URL gets written to {code} in Harbor settings.":
    "Дождитесь окончания загрузки. URL ретранслятора записывается в {code} в настройках Harbor.",
  "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.":
    "Если во всплывающем окне совместного просмотра появляется баннер об устаревшем ретрансляторе, поможет повторное развёртывание по шагам выше. Баннер исчезнет сам при следующем подключении, когда ретранслятор сообщит об актуальной версии.",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique {code} subdomain acts as the access token. There is no login.":
    "URL ретранслятора можно передавать другим. Любой, у кого есть этот URL, сможет входить в комнаты совместного просмотра на вашем ретрансляторе. Уникальный поддомен {code} служит токеном доступа. Входа в аккаунт нет.",
  "To run a public relay, post the {code} URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay, {kbd}.":
    "Чтобы сделать ретранслятор публичным, опубликуйте URL {code} на r/Stremio или там, где живёт ваше сообщество. Другие пользователи Harbor вставят его в «Настройки», «Ретранслятор Harbor», {kbd}.",
  "Deploy relay": "Развернуть ретранслятор",
  "Relay URL": "URL ретранслятора",
  "Test relay": "Тест ретранслятора",
  "Relay status": "Состояние ретранслятора",
  "Relay docs": "Документация ретранслятора",
  "Your relay": "Ваш ретранслятор",
  "Relay panel": "Панель ретранслятора",
  "Set up a Cloudflare relay for Watch Together":
    "Настроить ретранслятор Cloudflare для совместного просмотра",
  "Copy relay URL": "Копировать URL ретранслятора",
  "Relay is up to date": "Ретранслятор обновлён",
  "Relay needs update": "Ретранслятор требует обновления",
  "Relay not reachable": "Ретранслятор недоступен",
  "Check relay": "Проверить ретранслятор",
  "Relay test passed": "Тест ретранслятора пройден",
  "Deploy a relay": "Развернуть ретранслятор",
  "Wait for the upload to finish. The relay URL gets written to":
    "Дождитесь окончания выгрузки. URL ретранслятора записывается в",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique":
    "URL ретранслятора можно передавать другим. Любой, у кого есть этот URL, сможет войти в комнаты совместного просмотра на вашем ретрансляторе. Уникальный",
  "To run a public relay, post the": "Чтобы сделать ретранслятор публичным, опубликуйте",
  "Watch Together needs a relay.": "Для совместного просмотра нужен ретранслятор.",
  "Harbor's public relay has not rolled out the latest protocol yet.":
    "Публичный ретранслятор Harbor ещё не обновлён до последней версии протокола.",
  "Relay outdated. Your self-hosted relay is running an older version.":
    "Ретранслятор устарел. На вашем ретрансляторе работает более старая версия.",
  "Redeploy it to get the latest Watch Together fixes. Harbor's public relay updates on its own.":
    "Разверните его заново, чтобы получить свежие исправления совместного просмотра. Публичный ретранслятор Harbor обновляется сам.",
  "Open relay settings": "Открыть настройки ретранслятора",
  "Once you're in a room you can copy a link that joins anyone instantly: it sets the relay URL and the room code in one click.":
    "Когда вы в комнате, можно скопировать ссылку для мгновенного подключения: она задаёт URL ретранслятора и код комнаты в один клик.",
  "Anyone who opens this link gets the relay URL and room code set automatically. Works in the browser too: no install required for the joiner.":
    "У всех, кто откроет эту ссылку, URL ретранслятора и код комнаты подставятся автоматически. Работает и в браузере: гостю ничего устанавливать не нужно.",
  "Get a relay": "Получить ретранслятор",
  "Chinese (Simplified)": "Китайский (упрощённый)",
  Indonesian: "Индонезийский",
  "Your face in Watch Together rooms, sessions, and chat. Sits on top of your Stremio account.":
    "Ваш аватар в комнатах совместного просмотра, сессиях и чате. Он используется поверх вашего аккаунта Stremio.",
  "Watch Together rooms drop after 6 hours":
    "Комнаты совместного просмотра закрываются через 6 часов",
  "How you appear in Watch Together, sessions, and chat. Sits on top of your Stremio account.":
    "Так вы отображаетесь при совместном просмотре, в сессиях и чате. Эти данные используются поверх аккаунта Stremio.",
  "A passing test means Watch Together rooms will connect from this machine.":
    "Успешная проверка означает, что с этого компьютера можно подключаться к комнатам совместного просмотра.",
  "Get {name} hosted, plus {n} more addons.":
    "Разместите {name} на хостинге вместе с ещё {n} дополнениями.",
  "{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.":
    "Для вас работают {n} дополнений, включая Debridge с аккаунтами TorBox и Usenet, поэтому отдельный debrid-сервис покупать не нужно.",
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.":
    "Частные дополнения Stremio с десятикратными лимитами запросов и встроенным проксированием потоков, от $9 в месяц.",
  "Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.":
    "Harbor использует протокол дополнений Stremio, и вся экосистема дополнений выросла из их работы. Stremio финансируется сообществом, а поддержавшие проект получают ранний доступ к экспериментальным функциям. Если можете, поддержите и их.",
  "Only turn this off if you already have a metadata addon installed, such as AIOMetadata or AIOStreams. Without one, titles and collections can open completely blank. Cinemeta can go stale and show released episodes as TBA, which is the reason to replace it.":
    "Отключайте этот параметр, только если у вас уже установлено дополнение метаданных, например AIOMetadata или AIOStreams. Без него страницы контента и коллекции могут открываться пустыми. Данные Cinemeta могут устаревать и показывать вышедшие серии как TBA, поэтому её и заменяют.",
  "No metadata addon detected. Harbor is falling back to Cinemeta so titles still load, but turn this back on unless you are installing one.":
    "Дополнение метаданных не найдено. Harbor использует Cinemeta, чтобы страницы контента продолжали загружаться. Включите этот параметр обратно, если не устанавливаете другое дополнение.",
  "Your addons": "Ваши дополнения",
  "What each addon is actually serving up right now.":
    "Что сейчас предоставляет каждое дополнение.",
  "This addon provides streams only. It has no catalog to browse, but it still works behind every title you open.":
    "Это дополнение предоставляет только потоки. У него нет каталога для просмотра, но оно работает на каждой открываемой странице контента.",
  "This catalog came back empty. Try another one, or check the addon in Settings.":
    "Этот каталог оказался пустым. Попробуйте другой или проверьте дополнение в настройках.",
  "Couldn't load this title.": "Не удалось загрузить страницу контента.",
  "Nothing saved yet. Add a title from any details page.":
    "Пока ничего не сохранено. Добавьте название с любой страницы сведений.",
  "No cast photos are available for this title.": "Для этого названия нет фотографий актёров.",
  "70s": "70-е",
  "80s": "80-е",
  "90s": "90-е",
  "2000s": "2000-е",
  "2010s": "2010-е",
  Rec: "Запись",
};

export default repairs;
