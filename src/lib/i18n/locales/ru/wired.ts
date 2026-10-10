const wired: Record<string, string> = {
  "Most read right now": "Самое читаемое сейчас",
  "Most popular, critically acclaimed, award winners and more":
    "Самое популярное, признанное критиками, лауреаты премий и многое другое",
  "Spinning disc beside the title with a small control bar.":
    "Вращающийся диск рядом с названием и небольшая панель управления.",
  "Large centered cover on a dark card with the disc behind it.":
    "Крупная обложка по центру тёмной карточки, диск расположен позади.",
  "Adds an Identify-song button to the player that recognizes the current music via AudD and shows a Now Playing card. Off by default; needs an AudD key below.":
    "Добавляет в плеер кнопку «Распознать песню»: AudD определяет текущую композицию и показывает карточку «Сейчас играет». По умолчанию выключено; ниже нужно указать ключ AudD.",
  "Show the in-player Identify-song button and Now Playing card.":
    "Показывать в плеере кнопку «Распознать песню» и карточку «Сейчас играет».",
  "Display the artist and album under the title on the card.":
    "Показывать исполнителя и альбом под названием на карточке.",
  "Name your theme": "Назовите тему",
  "One line for the picker (optional)": "Одна строка для выбора (необязательно)",
  "Minimize panel": "Свернуть панель",
  "Minimize to preview (Esc)": "Свернуть к предпросмотру (Esc)",
  "Theme studio": "Студия тем",
  "Untitled theme": "Тема без названия",
  "Undo (Ctrl/Cmd + Z)": "Отменить (Ctrl/Cmd + Z)",
  Redo: "Повторить",
  "Redo (Ctrl/Cmd + Shift + Z)": "Повторить (Ctrl/Cmd + Shift + Z)",
  "Close studio": "Закрыть студию",
  Button: "Кнопка",
  "Sample title": "Пример названия",
  "Panel surface": "Поверхность панели",
  "Secondary copy sits here.": "Здесь располагается дополнительный текст.",
  Primary: "Основной",
  Secondary: "Дополнительный",
  "Organize downloads into folders by movie or series name":
    "Раскладывать загрузки по папкам с названиями фильмов или сериалов",
  eBooks: "Электронные книги",
  "Create folders for eBooks": "Создавать папки для электронных книг",
  "Store each title in its own folder with its EPUB or PDF":
    "Сохранять каждое название в отдельной папке с файлом EPUB или PDF",
  "Default location": "Папка по умолчанию",
  "{deviceName} is an audio-only device. Harbor can't transcode video to audio yet, so this device can only stream audio files. Pick a TV, Chromecast, or display-equipped device to stream video.":
    "Устройство {deviceName} поддерживает только звук. Harbor пока не умеет преобразовывать видео в аудио, поэтому на это устройство можно транслировать только аудиофайлы. Для видео выберите телевизор, Chromecast или устройство с экраном.",
  '{deviceLabel} can\'t play this stream ({reasons}). Click "Pick another" first to load alternatives, then try casting again.':
    "{deviceLabel} не может воспроизвести этот поток ({reasons}). Сначала нажмите «Выбрать другой», чтобы загрузить альтернативы, затем повторите трансляцию.",
  "{deviceLabel} can't play this stream ({reasons}) and none of the {count} available alternatives match its capabilities.":
    "{deviceLabel} не может воспроизвести этот поток ({reasons}), и ни один из {count} доступных вариантов не соответствует возможностям устройства.",
  "Install ffmpeg": "Установить ffmpeg",
  "{deviceLabel} can't decode this stream natively ({reasons}). Harbor uses ffmpeg to convert it into a format your TV understands.":
    "{deviceLabel} не может напрямую декодировать этот поток ({reasons}). Harbor использует ffmpeg, чтобы преобразовать его в формат, понятный телевизору.",
  "Restart Harbor after the install completes.": "После завершения установки перезапустите Harbor.",
  "Open the cast menu and try this device again.":
    "Откройте меню трансляции и снова выберите это устройство.",
  "Enable Roku Network Access": "Разрешить сетевой доступ к Roku",
  "Your Roku is set to block control requests from apps on your network, so Harbor can't reach it. This is a one-time setting on the Roku.":
    "В настройках Roku заблокированы команды управления от приложений в вашей сети, поэтому Harbor не может подключиться. Этот параметр нужно изменить на Roku только один раз.",
  "On your Roku remote, press Home.": "На пульте Roku нажмите Home.",
  "Open Settings, then System, then Advanced system settings.":
    "Откройте Settings, затем System и Advanced system settings.",
  'Select "Control by mobile apps" and set Network access to "Default".':
    "Выберите «Control by mobile apps» и установите для Network access значение «Default».",
  "Come back to Harbor and try casting again.": "Вернитесь в Harbor и повторите трансляцию.",
  "Couldn't reach this Roku": "Не удалось подключиться к Roku",
  "Harbor found something at this address that looked like a Roku, but it didn't respond like one. The device may be offline or another product picked up the same broadcast.":
    "Harbor обнаружил по этому адресу устройство, похожее на Roku, но оно ответило иначе. Возможно, устройство не в сети или на тот же сетевой сигнал откликнулся другой продукт.",
  "Make sure the Roku is powered on and on the same Wi-Fi as your computer.":
    "Убедитесь, что Roku включён и подключён к той же сети Wi-Fi, что и компьютер.",
  "Close the cast menu and reopen it to rescan the network.":
    "Закройте меню трансляции и откройте его снова, чтобы повторно просканировать сеть.",
  "If multiple Rokus appear, pick the one matching your TV's name.":
    "Если показано несколько Roku, выберите устройство с именем вашего телевизора.",
  "Install Media Assistant": "Установить Media Assistant",
  "Roku changed its OS to block the built-in Media Player from accepting video from other apps. Media Assistant is a free channel built to take over that job. One-time install on your Roku and casting works.":
    "Roku изменила свою ОС и запретила встроенному Media Player принимать видео из других приложений. Бесплатный канал Media Assistant берёт эту задачу на себя. Установите его на Roku один раз, и трансляция заработает.",
  "On your Roku, open Streaming Channels from the home screen.":
    "На Roku откройте Streaming Channels на главном экране.",
  'Search for "Media Assistant" (channel ID 782875, free).':
    "Найдите «Media Assistant» (ID канала 782875, бесплатно).",
  "Install it.": "Установите его.",
  "Harbor uses ffmpeg to convert streams into formats TVs can play. It's a one-time install and Harbor will pick it up automatically.":
    "Harbor использует ffmpeg, чтобы преобразовывать потоки в форматы, которые поддерживают телевизоры. Установить его нужно только один раз, после чего Harbor обнаружит его автоматически.",
  "Could not cast to {deviceName}.": "Не удалось выполнить трансляцию на {deviceName}.",
  "Clip saved to {path}": "Клип сохранён: {path}",
  "Clip save failed": "Не удалось сохранить клип",
  "Screenshot saved to {path}": "Снимок экрана сохранён: {path}",
  "Frame grab failed": "Не удалось сохранить кадр",
  "GIF saved to {path}": "GIF сохранён: {path}",
  "GIF export failed": "Не удалось экспортировать GIF",
  "Your favorites": "Ваше избранное",
  "on Scratch": "в Scratch",
  "Restart game": "Перезапустить игру",
  "Exit full screen": "Выйти из полноэкранного режима",
  "Full screen": "Полноэкранный режим",
  "Loading {name}...": "Загрузка {name}...",
  "This game couldn't load right now.": "Сейчас не удалось загрузить эту игру.",
  "Open a folder": "Открыть папку",
  "Read EPUB, text, Markdown, and HTML books already on this device.":
    "Читайте книги EPUB, текстовые, Markdown и HTML-файлы, уже сохранённые на этом устройстве.",
  "Install an extension": "Установить расширение",
  "Add trusted eBook sources from a Harbor-compatible repository.":
    "Добавьте доверенные источники электронных книг из совместимого с Harbor репозитория.",
  "Connect a source": "Подключить источник",
  "Bring a server-rendered library aboard with your own source configuration.":
    "Подключите библиотеку, которую отдаёт ваш сервер, с помощью собственной конфигурации источника.",
  "Harbor reading room": "Читальный зал Harbor",
  "Your shelf is": "Ваша полка",
  "ready for a story.": "ждёт новую историю.",
  "Set up at least one readable eBook source to begin. Metadata can describe a book, but a folder, extension, or custom source is what lets Harbor open it.":
    "Чтобы начать, настройте хотя бы один доступный для чтения источник электронных книг. Метаданные могут описать книгу, но открыть её Harbor сможет только из папки, расширения или пользовательского источника.",
  "Set up eBooks": "Настроить электронные книги",
  "Harbor never hosts your books or source files.": "Harbor не хранит ваши книги и исходные файлы.",
  "Reserved for your next book": "Место для вашей следующей книги",
  "Ways to add an eBook source": "Способы добавить источник электронных книг",
  "Harbor {version} downloaded but did not install on its own.":
    "Версия Harbor {version} загружена, но не установилась автоматически.",
  "Mark as unwatched": "Отметить непросмотренным",
  "Mark as watched": "Отметить просмотренным",
  "Mark watched up to here": "Отметить просмотренным до этого места",
  "Show episode": "Показать серию",
  "Hide episode": "Скрыть серию",
  "Loading {hostname}": "Загрузка {hostname}",
  "Still loading?": "Всё ещё загружается?",
  "This site may not support Harbor's temporary viewer. Retry the original link or open it in your browser.":
    "Возможно, сайт не поддерживает временный просмотрщик Harbor. Повторите попытку с исходной ссылкой или откройте её в браузере.",
  "External site: {hostname}": "Внешний сайт: {hostname}",
  "External | {hostname}": "Внешний сайт | {hostname}",
  "Reload original link": "Повторно загрузить исходную ссылку",
  "Open in system browser": "Открыть в системном браузере",
  "Setting up an addon": "Настройка дополнения",
  "Addon setup": "Настройка дополнения",
  "Installing {title}": "Установка {title}",
  "Installed {title}": "Установлено: {title}",
  "Configuring {title}": "Настройка {title}",
  "Paste a stremio:// link or an https://…/manifest.json URL.":
    "Вставьте ссылку stremio:// или URL вида https://…/manifest.json.",
  "Clipboard access was blocked. Paste the link manually.":
    "Доступ к буферу обмена заблокирован. Вставьте ссылку вручную.",
  "Setup · {title}": "Настройка · {title}",
  "Loading {title}": "Загрузка {title}",
  "{title} won't load inside Harbor.": "Не удаётся загрузить {title} внутри Harbor.",
  "Open it in a regular browser, set it up there, then come back and paste the install link below.":
    "Откройте страницу в обычном браузере, выполните настройку, затем вернитесь и вставьте ссылку установки ниже.",
  "Configure the addon above, then copy its manifest URL and paste it here. The web app can't catch the Install button automatically the way the desktop app does.":
    "Настройте дополнение выше, затем скопируйте URL его манифеста и вставьте сюда. Веб-приложение не может автоматически перехватить кнопку Install, как настольное приложение.",
  "Paste the manifest URL, or click Install on the addon's configuration page above.":
    "Вставьте URL манифеста или нажмите Install на странице настройки дополнения выше.",
  "stremio://… or https://…/manifest.json": "stremio://… или https://…/manifest.json",
  "From clipboard": "Из буфера обмена",
  "Finish updating Harbor": "Завершить обновление Harbor",
  "Download and run the installer to finish updating. If it keeps failing, run it as administrator once.":
    "Скачайте и запустите установщик, чтобы завершить обновление. Если ошибка повторится, один раз запустите его от имени администратора.",
  "Restart to update": "Перезапустить для обновления",
  "Update ready": "Обновление готово",
  History: "История",
};

export default wired;
