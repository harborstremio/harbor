const surfaces3: Record<string, string> = {
  "No JavaScript. Scripts, inline handlers, and javascript: URLs are removed.":
    "Без JavaScript. Скрипты, встроенные обработчики и URL-адреса javascript: удаляются.",
  "No nested iframes, objects, or embeds.":
    "Без вложенных iframe, объектов и встроенного содержимого.",
  "No forms or popups. The canvas cannot navigate the page.":
    "Без форм и всплывающих окон. Холст не может переходить на другие страницы.",
  "{first} and {second}": "{first} и {second}",
  "Syncs to your {services}": "Синхронизируется с вашими сервисами: {services}",
  "Play trailer": "Воспроизвести трейлер",
  "Open on computer": "Открыть на компьютере",
  "Send this title to your Harbor app": "Отправить это название в приложение Harbor",
  "Saved to your favorites": "Сохранено в избранном",
  "Save to your favorites": "Сохранить в избранное",
  "Add to your watchlist": "Добавить в список к просмотру",
  "Marked as watched": "Отмечено как просмотренное",
  "Connect to your computer to manage your library.":
    "Подключитесь к компьютеру, чтобы управлять своей библиотекой.",
  "Season {number}": "Сезон {number}",
  "No episodes to show here yet.": "Здесь пока нет эпизодов.",
  "{count} min": "{count} мин",
  "Episode {number}": "Серия {number}",
  "Volumes not reported": "Количество томов не указано",
  "Chapters not reported": "Количество глав не указано",
  "{count} volume": "{count} том",
  "Marked as unread": "Отмечено как непрочитанное",
  "Added to Shelf": "Добавлено на полку",
  "Removed from Shelf": "Удалено с полки",
  "Bookmarked to read later": "Добавлено в закладки для чтения позже",
  "Bookmark removed": "Закладка удалена",
  "New & notable": "Новое и примечательное",
  "could not be optimized": "не удалось оптимизировать",
  "is not an image we can read": "не удалось распознать как изображение",
  "exceeds the {count} slot limit": "превышает лимит в {count} слотов",
  "did not match a slot (rename it after the slot)":
    "не соответствует ни одному слоту (переименуйте файл по названию слота)",
  "What are you sharing?": "Чем вы хотите поделиться?",
  "Badge pack": "Набор значков",
  "Award pack": "Набор наград",
  "Reskin the quality chips (4K, HDR, Dolby Vision, Atmos and more) that ride each stream in the play picker. Click any slot to drop in your own PNG or animated GIF, or import a whole set at once. You do not have to fill every slot.":
    "Измените оформление меток качества (4K, HDR, Dolby Vision, Atmos и других), которые отображаются у каждого потока в меню выбора воспроизведения. Нажмите на любой слот, чтобы добавить собственный PNG или анимированный GIF, либо импортируйте сразу целый набор. Заполнять все слоты необязательно.",
  "Reskin the award trophies shown across Harbor. Click any award to add a PNG or animated GIF, add your own custom award types, or import a whole set at once.":
    "Измените оформление наград, отображаемых в Harbor. Нажмите на любую награду, чтобы добавить PNG или анимированный GIF, создайте собственные типы наград либо импортируйте сразу целый набор.",
  "Import a set": "Импортировать набор",
  "Drop many images, GIFs, or a .zip at once. Name each file after its slot ({example}) and we match them. Any size is fine, we resize big images and keep animated GIFs light.":
    "Перетащите сразу несколько изображений, GIF-файлов или архив .zip. Назовите каждый файл по соответствующему слоту ({example}), и мы сопоставим их. Размер может быть любым: большие изображения мы уменьшим, а анимированные GIF-файлы оптимизируем.",
  "Naming guide": "Правила именования",
  "Reading…": "Чтение…",
  "Import images or .zip": "Импортировать изображения или .zip",
  "{count} file was skipped": "Пропущен {count} файл",
  "{count} files were skipped": "Пропущено файлов: {count}",
  "Resized {count} image to fit. Nothing was skipped for size.":
    "Размер {count} изображения изменён. Ни один файл не был пропущен из-за размера.",
  "Resized {count} images to fit. Nothing was skipped for size.":
    "Изменён размер изображений: {count}. Ни один файл не был пропущен из-за размера.",
  "{count} GIF was over 2 MB, so we kept the first frame. Export it smaller to keep the animation.":
    "{count} GIF-файл превышал 2 МБ, поэтому мы сохранили только первый кадр. Чтобы сохранить анимацию, экспортируйте файл меньшего размера.",
  "{count} GIFs were over 2 MB, so we kept the first frame. Export it smaller to keep the animation.":
    "GIF-файлов размером более 2 МБ: {count}. Поэтому мы сохранили только первый кадр. Чтобы сохранить анимацию, экспортируйте их в меньшем размере.",
  "Quality badges": "Значки качества",
  "{count} slot reskinned": "Изменено оформление {count} слота",
  "{count} slots reskinned": "Изменено оформление слотов: {count}",
  "Custom award name (e.g. My Festival)":
    "Название собственной награды (например, «Мой фестиваль»)",
  "Pick art": "Выбрать изображение",
  "Add a custom award type": "Добавить собственный тип награды",
  "Add art to at least one slot to continue.":
    "Чтобы продолжить, добавьте изображение хотя бы в один слот.",
  "Too short": "Слишком короткий",
  "Too common": "Слишком распространённый",
  Weak: "Слабый",
  Fair: "Средний",
  Good: "Хороший",
  Strong: "Надёжный",
  item: "элемент",
  "link text": "текст ссылки",
  "Any HTML layout: headings, paragraphs, lists, tables, sections, divs.":
    "Любая HTML-разметка: заголовки, абзацы, списки, таблицы, секции и div-элементы.",
  "Any CSS: colors, gradients, grid, flex, animations, web fonts via @import from https.":
    "Любой CSS: цвета, градиенты, grid, flex, анимации и веб-шрифты через @import с https.",
  "Images and video from https or data URLs.":
    "Изображения и видео с https или из URL-адресов data.",
  "Links open in a new tab automatically.": "Ссылки автоматически открываются в новой вкладке.",
  "Publishing as": "Публикация от имени",
  "Tied to your account. Manage it in My themes.":
    "Привязано к вашей учётной записи. Управляйте этим в разделе «Мои темы».",
  "Picture and feel": "Изображение и атмосфера",
  "Getting around the TV": "Навигация на телевизоре",
  "Starting a show": "Запуск сериала",
  Bingeing: "Непрерывный просмотр",
  "Episodes and spoilers": "Серии и спойлеры",
  "Languages on the TV": "Языки на телевизоре",
  "Services on the TV": "Сервисы на телевизоре",
};

export default surfaces3;
