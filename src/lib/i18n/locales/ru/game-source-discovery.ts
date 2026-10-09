export default {
  "games.sources.links.copy": "Копировать ссылку",
  "games.sources.links.copied": "Скопировано",

  "games.sources.catalogProgress": "Проверка источников · {checked}/{total}",
  "games.sources.source_capacity": "Каталоги превышают лимит профиля в 2 ГБ. Удалите ненужные источники и повторите попытку. Сохранённые каталоги не изменены.",
  "games.sources.source_quota": "Недостаточно места для сохранения источников. Освободите место или удалите ненужные источники и повторите попытку. Сохранённые каталоги не изменены.",

  "games.sources.batch.busy": "Подготавливается другой набор файлов. Повторите попытку чуть позже.",
  "games.sources.batch.limit": "Выберите не более 200 файлов за раз.",

  "games.sources.batch.failedFile": "Не удалось подготовить {file}.",

  "games.sources.batch.restart": "Перезапустите Harbor после обновления, чтобы скачивать выбранные файлы вместе.",

  "games.torrent.start": "Скачать файлы",

  "games.sources.download": "Скачать файл",

  "games.sources.verification.action": "Проверить источник",

  "games.sources.verification.waiting": "Завершите проверку в окне источника. Затем Harbor проверит его каталог.",

  "games.sources.source_verify_busy": "Уже проверяется другой источник. Сначала завершите проверку или закройте его окно.",

  "games.sources.source_verify_failed": "Не удалось завершить проверку. Повторите попытку или измените адрес источника.",

  "games.sources.source_verify_timeout": "Время проверки истекло. Повторите попытку, когда будете готовы.",

  "games.sources.source_verify_unavailable": "Обновите и перезапустите Harbor, чтобы проверить этот источник.",

  "games.sources.browser.direct": "Прямая загрузка",

  "games.sources.site.title": "Открыть сайт",
  "games.sources.site.note": "Вставьте страницу загрузки с любого сайта. Harbor откроет её в отдельном окне, вы выберете там файл, и он загрузится в Harbor.",
  "games.sources.site.url": "Ссылка на страницу",
  "games.sources.site.open": "Открыть сайт",
  "games.sources.site.invalid": "Нужна публичная https-ссылка.",
  "games.sources.browser.intro": "Аккаунт debrid не нужен. Выберите файл на {host}, затем укажите папку сохранения в Harbor.",
  "games.sources.browser.fallback": "Если загрузка не началась сама, воспользуйтесь запасной ссылкой, которую {host} показывает на странице. Harbor всё равно подхватит файл.",

  "games.sources.browser.choose": "Выбрать файл на {host}",

  "games.sources.browser.waiting": "Выберите файл в окне {host}. Harbor спросит, куда его сохранить.",

  "games.sources.browser.selected": "Готово к загрузке в Harbor",

  "games.sources.browser.another": "Выбрать другой файл",

  "games.sources.browser.failed": "{host} не удалось передать файл в Harbor. Повторите попытку или откройте его на {host}.",

  "games.sources.browser.timeout": "Время выбора файла истекло. Снова откройте {host}, чтобы выбрать файл.",

  "games.sources.browser.restart": "Перезапустите Harbor после обновления, чтобы загружать напрямую с {host}.",

  "games.sources.retrySavedCatalog": "Повторить чтение сохранённого каталога",

  "games.sources.catalogUnavailable": "Сохранённый каталог недоступен",

  "games.sources.catalogRepair": "Обновите этот источник, чтобы восстановить его релизы. Другие источники по-прежнему доступны.",

  "games.sources.restoreCatalog": "Обновить источник",

  "games.sources.partialResults": "Недоступные источники: {count}. Результаты могут быть неполными.",

  "games.sources.partialRecent": "Недоступные источники: {count}. Список последних релизов может быть неполным.",

  "games.sources.source_incomplete": "Не удалось прочитать некоторые сохранённые каталоги. Восстановите или удалите их перед добавлением новых данных.",

  "games.sources.saving": "Сохранение источника…",

  "games.sources.filter": "Поиск источников",

  "games.sources.subscriptionCount": "Источники: {count}",

  "games.sources.filterEmpty": "Нет источников, соответствующих запросу.",

  "games.sources.back": "Назад",

  "games.sources.source_blocked": "Источник заблокировал запрос. Его каталог сейчас недоступен.",

  "games.sources.source_restricted": "Источник недоступен по юридическим причинам (HTTP 451).",

  "games.sources.singleRelease": "1 релиз",

  "games.sources.count": "Релизов: {count}",

  "games.sources.more": "Показать ещё (осталось: {count})",

  "games.sources.matchNote": "Выберите источник, чтобы сравнить его релизы и варианты загрузки.",

  "games.sources.platform.native": "Версия для {platform}",

  "games.sources.platform.nativeNote": "Перед загрузкой проверьте требования к процессору и системе.",

  "games.sources.platform.compatibility": "Версия Windows · нужен Wine или Proton",

  "games.sources.platform.compatibilityNote": "В Linux настройте Wine или Proton в локальной библиотеке. Совместимость, включая античит, зависит от игры. Для игр Steam используйте настройки совместимости Steam.",

  "games.sources.platform.other": "Версия {platform} · не нативная для {host}",

  "games.sources.platform.otherNote": "Выберите версию для вашей ОС. Harbor не может установить или запустить этот пакет на данном устройстве без средств совместимости.",

  "games.sources.platform.unknown": "Платформа не указана",

  "games.sources.platform.unknownNote": "Источник не указал ОС пакета. Перед загрузкой проверьте информацию издателя.",

  "games.sources.platform.browseNote": "Используйте Harbor для компьютера, чтобы загружать файлы локальных игр и управлять ими.",

  "games.sources.platform.browse": "Версия для {platform}",

  "games.custom.allowExecution": "Разрешить выполнение",

  "games.setup.openNative": "Открыть установщик",



  "games.sources.art.torrent": "Загрузка торрента",

  "games.sources.art.engine": "Торрент-движок Harbor",

  "games.sources.art.reviewTorrent": "Скачать в Harbor",



  "games.sources.ad.note": "Подготовьте файл через AllDebrid, затем выберите место сохранения.",

  "games.sources.ad.password": "Пароль ссылки (необязательно)",

  "games.sources.ad.passwordRequired": "Для этой ссылки нужен пароль. Введите его и повторите попытку.",

  "games.sources.ad.blocked": "AllDebrid требует подтвердить подключение. Проверьте почту или аккаунт AllDebrid и повторите попытку.",

  "games.sources.ad.quota": "Лимит AllDebrid для этого хостинга исчерпан.",

  "games.sources.ad.unsupported": "AllDebrid не поддерживает эту ссылку. Откройте источник и выберите другую.",

  "games.sources.ad.preparing": "Подготовка в AllDebrid",

  "games.sources.ad.failed": "AllDebrid не удалось подготовить этот файл.",

  "games.sources.ad.check": "Проверить AllDebrid",

  "games.sources.ad.open": "Открыть AllDebrid",

  "games.sources.ad.kept": "Запрос сохранится после закрытия. Откройте ссылку снова, чтобы проверить его.",

  "games.sources.ad.uncertain": "Этот запрос уже может быть в AllDebrid. Проверьте аккаунт перед повторной подготовкой.",

  "games.sources.ad.renew": "Подготовьте новую ссылку для скачивания этого файла.",

  "games.sources.ad.again": "Подготовить снова",

  "games.sources.repair.title": "Изменить ссылку для {name}",

  "games.sources.repair.note": "Текущий список сохранится, пока вы не проверите и не сохраните замену.",

  "games.sources.source_changed": "Этот источник изменился. Проверьте его ссылку ещё раз перед сохранением.",

  "games.sources.source_website_limit": "Этот сайт вернул более 4 МБ в одном ответе.",

  "games.sources.discovery.address": "Сайт или ссылка на каталог",

  "games.sources.discovery.hint": "Вставьте адрес сайта, каталога JSON или ссылку установки Hydra.",

  "games.sources.discovery.choose": "Выберите каталог, опубликованный на этом сайте.",

  "games.sources.discovery.change": "Изменить ссылку",

  "games.sources.discovery.harbor": "Каталог Harbor",

  "games.sources.discovery.community": "Каталог, совместимый с Hydra",

  "games.sources.discovery.preview": "Предпросмотр каталога",

  "games.sources.discovery.reviewNote": "Сохраняются только записи каталога. Файлы скачиваются после вашего выбора.",

  "games.sources.source_no_catalog": "На этом сайте нет ссылки на каталог, который может прочитать Harbor. Вставьте ссылку на его каталог JSON.",

  "games.sources.source_url": "Введите адрес сайта, HTTP(S)-ссылку на каталог или ссылку установки Hydra.",

  "games.sources.source_limit": "Лимит каталога: 64 МБ или 150 000 выпусков. Лимит профиля: 2 ГБ или 128 источников.",

  "games.sources.source_processing": "Не удалось обработать каталог. Попробуйте ещё раз.",

  "games.sources.discovery.website": "Каталог сайта",

  "games.sources.website.recent": "{count} недавних записей",

  "games.sources.website.search": "Поиск на этом сайте",

  "games.sources.website.results": "Загружено релизов: {count}",

  "games.sources.website.loading": "Загрузка релизов…",

  "games.sources.website.noResults": "На этой странице нет подходящих релизов.",

  "games.sources.website.more": "Загрузить ещё релизы",

  "games.sources.website.checking": "Проверка ваших сайтов…",

  "games.sources.website.unavailable": "Не удалось проверить некоторые сайты.",

  "games.sources.website.note": "Недавние записи сохраняются в кэше. Поиск выполняется по каталогу сайта.",

  "games.sources.links.title": "Варианты загрузки",

  "games.sources.links.intro": "Выберите подключённый сервис для подготовки ссылки.",

  "games.sources.links.service": "Сервис загрузки",

  "games.sources.links.connected": "Подключён",

  "games.sources.links.connect": "Подключите {name} в настройках источников, чтобы использовать его здесь.",

  "games.sources.links.settings": "Настройки источников",

  "games.sources.links.preparing": "Подготовка ссылки…",

  "games.sources.links.files": "Доступные файлы",

  "games.sources.links.unknownSize": "Размер не указан",

  "games.sources.links.more": "Ещё файлы",

  "games.sources.links.note": "Перед загрузкой выберите файл и место сохранения.",

  "games.sources.links.prepare": "Подготовить ссылку",

  "games.sources.links.account": "Сервис отклонил подключение. Проверьте ключ в настройках источников.",

  "games.sources.links.rate": "Сервис попросил Harbor подождать. Повторите попытку чуть позже.",

  "games.sources.links.limit": "Сервис вернул слишком много файлов для одновременного просмотра.",

  "games.sources.links.empty": "Сервис не вернул файлов для загрузки.",

  "games.sources.links.invalid": "Сервис вернул неполные сведения о файлах. Откройте источник или повторите попытку.",

  "games.sources.links.failed": "Сервис не смог подготовить ссылку. Проверьте её доступность и свой аккаунт.",

  "games.sources.links.destination": "Выбрать место сохранения",

  "games.sources.links.desktop": "Откройте Harbor на компьютере, чтобы загрузить файлы.",

  "games.sources.web.web": "Веб-загрузки",

  "games.sources.web.torrents": "Торренты",

  "games.sources.web.start": "Запустить в TorBox",

  "games.sources.web.note": "TorBox загрузит эту ссылку в ваш аккаунт. Затем выберите файл и место на устройстве.",

  "games.sources.web.kept": "При закрытии окна задание сохраняется в TorBox.",

  "games.sources.web.uncertain": "Этот запрос уже может быть в TorBox. Проверьте перед созданием нового.",

  "games.sources.web.check": "Проверить TorBox",

  "games.sources.web.browse": "Открыть TorBox",

  "games.sources.web.more": "Проверить старые задания",

  "games.sources.web.notFound": "Подходящее задание не найдено. Новое может дублировать задержавшийся запрос.",

  "games.sources.web.nextPage": "Страница {page} проверена. Продолжите проверку старых заданий.",

  "games.sources.web.again": "Создать ещё одно задание",

  "games.sources.web.storage": "Harbor не смог сохранить задание. Оно не будет отправлено повторно автоматически.",

  "games.sources.web.preparing": "Подготовка в TorBox",

  "games.sources.web.ready": "Готово к загрузке",

  "games.sources.web.failed": "TorBox не смог завершить задание",

  "games.sources.web.missing": "Файл больше недоступен",

  "games.sources.host.check": "Проверить хостинг",

  "games.sources.host.refresh": "Обновить статус хостинга",

  "games.sources.host.available": "Доступен",

  "games.sources.host.listed": "Указан как поддерживаемый",

  "games.sources.host.down": "Сейчас недоступен",

  "games.sources.host.unsupported": "Не поддерживается сервисом",

  "games.sources.host.queue": "Требуется облачный перенос",

  "games.sources.host.unknown": "Нет в списке",

  "games.sources.host.limited": "Лимит исчерпан",

  "games.sources.host.data": "Данные",

  "games.sources.host.downloads": "Загрузки",

  "games.sources.host.daily": "Сегодня",

  "games.sources.host.weekly": "На этой неделе",

  "games.sources.host.monthly": "В этом месяце",

  "games.sources.host.current": "Текущий период",

  "games.sources.host.cap": "Лимит: {limit}",

  "games.sources.host.left": "Осталось {left}",

  "games.sources.host.remaining": "Осталось {left} из {total}",

  "games.sources.host.file": "На файл",

  "games.sources.host.cost": "Коэффициент расхода квоты",

  "games.sources.host.limitsUnavailable": "Не удалось получить остаток квоты.",

  "games.sources.host.checked": "Проверено в {time}",

  "games.sources.host.queueNote": "Этот хостинг использует облачный перенос сервиса.",

  "games.sources.host.unknownNote": "Домен отсутствует в каталоге провайдера. Вы всё равно можете попробовать ссылку.",

  "games.sources.host.fileNote": "Доступность файла проверяется при подготовке ссылки.",

  "games.sources.host.account": "Подключите сервис заново, чтобы проверить квоту.",

  "games.sources.host.rate": "Слишком много проверок. Повторите чуть позже.",

  "games.sources.host.error": "Не удалось проверить статус хостинга. Повторите попытку.",

  "games.sources.pm.start": "Запустить в Premiumize",

  "games.sources.pm.note": "Premiumize сохранит эту ссылку в вашем облаке. Выберите файл, когда он будет готов.",

  "games.sources.pm.kept": "После закрытия передача Premiumize сохранится.",

  "games.sources.pm.uncertain": "Этот запрос уже может быть в Premiumize. Проверьте недавние передачи, прежде чем создавать новую.",

  "games.sources.pm.check": "Проверить Premiumize",

  "games.sources.pm.browse": "Открыть Premiumize",

  "games.sources.pm.preparing": "Подготовка в Premiumize",

  "games.sources.pm.failed": "Ошибка передачи",

  "games.sources.pm.notFound": "Передача не выбрана. Повторный запуск может создать дубликат запроса.",

  "games.sources.pm.select": "Использовать эту передачу",

  "games.sources.pm.review": "Выберите отправленную передачу. Harbor не может автоматически определить её источник.",

  "games.sources.pm.retry": "Повторить передачу",

  "games.sources.pm.direct": "Прямая ссылка",

  "games.sources.pm.cloud": "Передача в облако",

  "games.sources.pm.transfers": "Передачи",

  "games.sources.pm.files": "Файлы",

  "games.sources.pm.container": "Этот источник содержит ссылки. Откройте его и выберите ссылку на отдельный файл.",

  "games.sources.pm.folder": "Открыть папку",

  "games.sources.public.services": "Подключённые сервисы",

  "games.sources.public.intro": "Просмотрите файлы на {host} перед выбором места сохранения.",

  "games.sources.public.files": "Просмотреть файлы",

  "games.sources.public.count": "Файлов: {count}",

  "games.sources.public.checksum": "Контрольная сумма SHA-256",

  "games.sources.public.speed": "Лимит сервера: {speed}/с",

  "games.sources.public.open": "Открыть на {host}",

  "games.sources.public.empty": "В этом списке нет файлов.",

  "games.sources.public.review": "Перейдите на {host}, чтобы проверить доступ к этому файлу.",

  "games.sources.public.restricted": "Сервис {host} ограничил доступ к этому файлу.",

  "games.sources.public.limited": "Сервис {host} ограничил этот запрос. Повторите позже.",

  "games.sources.public.missing": "Этот файл недоступен.",

  "games.sources.public.limit": "Ответ слишком большой для просмотра. Откройте его на {host}.",

  "games.sources.public.invalid": "Не удалось прочитать ссылку или сведения о файле.",

  "games.sources.public.failed": "Не удалось подключиться к {host}. Повторите попытку.",

  "games.sources.public.state.review": "Открыть у провайдера",

  "games.sources.public.state.restricted": "Доступ ограничен",

  "games.sources.public.state.limited": "Лимит достигнут",

  "games.sources.public.state.missing": "Недоступно",

  "games.sources.batch.selected": "Выбрано: {count}",

  "games.sources.batch.all": "Выбрать всё",

  "games.sources.batch.clear": "Снять выделение",

  "games.sources.batch.note": "Сохранить исходные имена в одной папке.",

  "games.sources.batch.destination": "Выбрать папку",

  "games.download.transfer_batch_names": "Некоторые имена файлов совпадают или не могут быть сохранены без изменений. Выберите эти файлы по отдельности."

};

