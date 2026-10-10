const books: Record<string, string> = {
  eBook: "电子书",
  "{n} award": "{n} 个奖项",
  "Customize anime": "自定义动漫页",
  "Award Winner": "获奖者",
  "Award Nominee": "提名者",
  "Award Winning Anime": "获奖动漫",
  "Anime of the Year": "年度动漫",
  "Use live web context (Jina Reader)": "使用实时网页上下文（Jina Reader）",
  "Home rail categories (Movies, TV, Anime)": "首页横栏类别（电影、电视剧、动漫）",
  "Award Icons": "奖项图标",
  "Award tab on cards": "卡片上的奖项标签",
  "Award tab position": "奖项标签位置",
  "Customize each award": "自定义每个奖项",
  "Finds anime saved under a movie or series id (which breaks Continue Watching and Trakt) and removes just those so they re-add correctly.":
    "查找保存在电影或剧集 ID 下的动漫（这会导致“继续观看”和 Trakt 异常），并仅移除这些条目，以便正确重新添加。",
  "Hide manga": "隐藏漫画",
  "How to make an award pack": "如何制作奖项包",
  "Live web (Jina Reader)": "实时网页（Jina Reader）",
  "No issues found. Your anime library looks clean.": "未发现问题。你的动漫媒体库一切正常。",
  "Removes the Anime tab and every anime title from all rows everywhere: Home, Discover, Top 10, and catalogs. Western animation like Pixar is kept, and you can still find anime by searching.":
    "移除动漫标签页，并从首页、发现、Top 10 和目录等所有位置的各行中移除全部动漫内容。Pixar 等欧美动画会保留，你仍可通过搜索找到动漫。",
  "Removes the Manga tab from the sidebar.": "从侧边栏移除漫画标签页。",
  "Repair anime library": "修复动漫媒体库",
  "Show DUB badge on anime cards": "在动漫卡片上显示 DUB 徽章",
  "Show a laurel award tab on winning titles, like Netflix. Replaces the corner award chip and sits centered so it clears the rating and watchlist pills. Pick where it sits below.":
    "像 Netflix 一样，在获奖影片上显示月桂奖标签。它会替代角落的获奖标记并居中显示，避免遮挡评分和片单按钮。请在下方选择其位置。",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays optional.":
    "显示动漫作品的 MyAnimeList 评分。RPDB 不涵盖动漫，因此此项为可选。",
  "Hide anime": "隐藏动漫",
  "Removes the Anime tab and any Trending/Popular/Upcoming/New anime rows from Home.":
    "从首页移除“动漫”标签，以及所有“趋势”“热门”“即将上线”和“最新”动漫内容行。",
  "Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.":
    "在剧集和动漫中，模糊尚未观看剧集的剧照、标题和简介。将鼠标悬停在某一集上可预览。",
  "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.":
    "从首页的“继续观看”内容栏中隐藏动漫。动漫仍会显示在“动漫”标签页自己的“继续观看”内容栏中。",
  "Keep anime in the Anime room only": "仅在动漫专区显示动漫",
  "Connect your AniList account to show your anime lists as rails on the Anime page.":
    "连接 AniList 账户，将你的动漫列表作为内容栏显示在“动漫”页面上。",
  "MyAnimeList scores for anime titles. RPDB doesn't cover anime, so this stays an opt-in.":
    "显示动漫作品的 MyAnimeList 评分。RPDB 不涵盖动漫，因此此项需手动开启。",
  "MyAnimeList scores for anime titles.": "动漫作品的 MyAnimeList 评分。",
  "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "动漫页面上的评论在你主动显示前会被模糊处理，即使未标记为剧透。",
  "Show forum threads and comments from AniList on anime detail pages.":
    "在动漫详情页显示 AniList 论坛主题和评论。",
  "Harbor shows your AniList lists on the Anime page and keeps your progress in sync.":
    "Harbor 会在动漫页面显示你的 AniList 列表，并持续同步观看进度。",
  "Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.":
    "看完一集动漫后会更新你的 AniList 进度。只增不减：绝不会降低已有集数。",
  Anime: "动漫",
  "A new anime comes out": "有新动漫上线",
  "Any new anime": "任意新动漫",
  "Sharper lines and cleaner gradients on anime, in real time. One-tap setup below.":
    "实时让动漫线条更锐利、渐变更干净。可在下方一键设置。",
  "Anime tweaks": "动漫优化",
  "Anime4K real-time upscaling, smooth motion, and where SVP fits in. All the anime-specific picture enhancements in one place.":
    "Anime4K 实时放大、运动平滑，以及 SVP 的适用场景。所有动漫专属画质增强功能都集中在这里。",
  "Sharper lines and cleaner gradients on anime, in real time. Heaviest on the graphics card of everything here.":
    "实时锐化动漫线条并改善渐变。这是这里对显卡负载最高的功能。",
  "Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.":
    "动漫通常一张画面会连续显示两到三帧，因此快速摇镜时可能出现抖动。平滑处理会补充中间帧，让运动更流畅。",
  "Download the desktop app to use anime enhancements.": "下载桌面应用以使用动漫增强功能。",
  "Crisp (anime & cartoons)": "清晰（动漫和卡通）",
  "{n} avatars across film, TV, and anime.": "{n} 个涵盖电影、电视和动漫的头像。",
  anime: "动漫",
  "Anime tab": "动漫标签页",
  "Anime leaves Home Continue Watching and stays in the Anime tab's own row.":
    "动漫内容会从首页的“继续观看”中移除，并仅保留在“动漫”标签页自己的内容行中。",
  "Harbor ships a neutral trophy for every award. Install an icon pack or upload your own image per award to make them yours. Packs are hosted by whoever makes them, so the artwork is theirs, not bundled with Harbor.":
    "Harbor 为每个奖项都提供一个中性风格的奖杯。安装图标包或为各奖项上传自己的图片，即可打造专属外观。图标包由其制作者托管，因此其中的美术作品归制作者所有，并未内置于 Harbor。",
  "View community award packs": "查看社区奖项图标包",
  "Icon packs and single-award art from the community": "社区提供的图标包和单个奖项图稿",
  "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.":
    "为每个奖项上传一张图片，或按各奖项下方显示的 ID 为 .zip 文件命名（点按即可复制）。自然名称也能识别，例如 best_soundtrack、movie_of_the_year 等仍可正确匹配。",
  "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.":
    "奖项图标包由一个 JSON 文件及其指向的图片组成。你可以将两者托管在任何公开位置（自己的服务器、GitHub 仓库等），然后分享 JSON URL。Harbor 只会存储你安装的 URL，绝不会存储图片。",
  "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.":
    "上方每个键都是一个奖项 ID。任何省略的键都会回退到默认奖杯（或优先级较低的图标包）。完整 ID 列表就是上方网格中显示的所有奖项。",
  'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.':
    "以对应奖项 ID 为每个图片文件命名并放入 .zip，然后使用上方的“导入 .zip 图标包”。无需 JSON，也无需托管。Harbor 会将每个文件与对应奖项匹配，存储在本地并调整尺寸，同时跳过无法识别的文件。",
  "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.":
    "剧集和动漫的分集编排方式。默认使用 TVDB：无需密钥即可提供动漫爱好者需要的篇章顺序、DVD 顺序和绝对顺序。TMDB 则保留普通的首播顺序。无论选择哪种方式，所有单集的播放和已观看标记都不受影响。",
  "Turns the season button into a full panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. On by default for anime through Harbor's TVDB service, no key needed. Add your own TVDB key to use it for regular shows too.":
    "将季按钮变成完整面板，其中包含顺序标签页（首播、DVD、绝对顺序以及该剧提供的任何其他顺序）和显示播出日期范围及集数的季表格。通过 Harbor 的 TVDB 服务，此功能默认对动漫开启且无需密钥。添加你自己的 TVDB 密钥后，也可用于普通剧集。",
  "Control the manga flipbook from your phone while reading on the big screen: turn pages, zoom, and switch modes. The reader also shows this link while you read.":
    "在大屏幕上阅读时，用手机控制漫画翻页阅读器：翻页、缩放和切换模式。阅读期间，阅读器也会显示此链接。",
  "Manga browse cache": "漫画浏览缓存",
  "Cached chapter lists and browse pages. Downloads stay untouched.":
    "缓存的章节列表和浏览页面。不会影响下载内容。",
  "Tap the heart on any movie, show, manga, or character to save it here.":
    "点按任意电影、剧集、漫画或角色上的爱心，即可保存到这里。",
  "Rate movies, shows, anime, and manga to build your ratings":
    "为电影、剧集、动漫和漫画评分，创建你的评分记录",
  "Search for a book": "搜索书籍",
  "Could not reach the book database": "无法连接书籍数据库",
  "Book search needs an API key before it can run.": "需要先设置 API 密钥才能搜索书籍。",
  "Tune anime": "调整动漫偏好",
  "Shape your anime feed.": "定制你的动漫推荐。",
  "Hide anime I've already watched": "隐藏我已看过的动漫",
  "Read the Manga": "阅读漫画",
  "Open manga": "打开漫画",
  "Reading your search": "正在理解你的搜索内容",
  "Favorite Anime": "最喜欢的动漫",
  "Favorite Manga": "最喜欢的漫画",
  "Tap the star on any movie, show, or manga, or the heart on a character, to save it here.":
    "点按电影、剧集或漫画上的星标，或角色上的心形图标，即可保存到这里。",
  Manga: "漫画",
  "Related Anime": "相关动漫",
  "Add anime to your MyAnimeList and they show up here, grouped by status and ready to edit.":
    "将动画添加到 MyAnimeList 后，它们会按状态分组显示在这里，并可随时编辑。",
  "Add a manga source": "添加漫画源",
  "Harbor does not host any manga or any sources. Connect a self-hosted server you run, install a source plugin from a repository you trust, or open a folder you already have.":
    "Harbor 不托管任何漫画或内容源。你可以连接自己运行的自托管服务器、从信任的仓库安装源插件，或打开已有的文件夹。",
  "Browse manga": "浏览漫画",
  "Read manga in Harbor": "在 Harbor 中阅读漫画",
  "Harbor does not host any manga. Add a source plugin from a repository you trust, connect your own server, or open a local folder. You can turn this off anytime in Settings.":
    "Harbor 不托管任何漫画。你可以从信任的仓库添加源插件、连接自己的服务器，或打开本地文件夹。你可以随时在“设置”中关闭此功能。",
  "Enable manga sources": "启用漫画源",
  "Keep going in the manga behind the anime you've been watching": "继续阅读你所看动画的原作漫画",
  "Open this link on a phone on the same Wi-Fi to flip pages, zoom, and pick chapters with gestures. Keep this reader open.":
    "在连接同一 Wi-Fi 的手机上打开此链接，即可使用手势翻页、缩放和选择章节。请保持此阅读器打开。",
  "Chapter finished": "本章已读完",
  "This is a Mangayomi repo, but its sources use Dart or are not manga, so Harbor can't import them.":
    "这是 Mangayomi 仓库，但其中的内容源使用 Dart 或并非漫画源，因此 Harbor 无法导入。",
  "This is a Mangayomi repo. Harbor runs its JavaScript sources natively. Import them to add these sources to your manga library.":
    "这是 Mangayomi 仓库。Harbor 可原生运行其中的 JavaScript 内容源。导入后即可将这些内容源添加到你的漫画库。",
  "Reading subtitles...": "正在读取字幕…",
  "Chapter-finished hint": "章节结束提示",
  "Open in Anime": "在动漫中打开",
  "New shows and anime premiering this month, from Simkl": "Simkl 中本月首播的新节目和动漫",
  "Add anime to your AniList and they show up here, grouped by status and ready to edit.":
    "添加到 AniList 的动漫会按状态分组显示在这里，并可随时编辑。",
  "Simkl lists no new shows or anime premiering this month. Try a different month.":
    "Simkl 本月没有新剧或动漫首播。请尝试其他月份。",
  "Show your AniList lists as rails on the Anime page, keep your watch progress in sync as you finish episodes, and use your AniList avatar as your Harbor photo. Free at anilist.co.":
    "在动漫页面以横向内容栏显示您的 AniList 列表，在看完单集后同步观看进度，并将 AniList 头像用作您的 Harbor 头像。可在 anilist.co 免费使用。",
  "Disconnect AniList? Your lists will stop showing on the Anime page until you reconnect.":
    "要断开 AniList 连接吗？重新连接前，您的列表将不再显示在动漫页面。",
  "Sync and track movies, shows, and anime across everything you use. Harbor marks what you finish as watched on Simkl and keeps your plan-to-watch list in step. Free at simkl.com.":
    "在您使用的所有平台间同步并追踪电影、剧集和动漫。Harbor 会在 Simkl 上将您看完的内容标记为已观看，并同步您的待看列表。可在 simkl.com 免费使用。",
  "Trending Anime": "热门动漫",
  "New Anime Releases": "动漫新作",
  "Popular Anime": "热门动漫",
  "Upcoming Anime": "即将上线的动漫",
  Reading: "正在读取",
  "Reading manifest": "正在读取清单",
  "Reading new manifest": "正在读取新清单",
  "Anime sources are usually richer through Torrentio's anime config or AIOStreams. Make sure one is installed in Stremio.":
    "通过 Torrentio 的动漫配置或 AIOStreams，通常可以找到更多动漫资源。请确保已在 Stremio 中安装其中一个。",
  "Browse by Award": "按奖项浏览",
  "Open the editor to add the movies, shows, and manga that belong in this collection.":
    "打开编辑器，添加属于此合集的电影、剧集和漫画。",
  "No data shipped for this award yet. Re-run": "此奖项尚无随附数据。请重新运行",
  "No data shipped for this award yet.": "此奖项尚无随附数据。",
  "Add a TMDB key in Settings to unlock posters and the artists behind this award.":
    "在设置中添加 TMDB 密钥，即可查看海报和该奖项的相关艺人。",
  "No winners are catalogued for this award yet.": "此奖项尚未收录获奖者。",
  "Anime award": "动画奖项",
  "Anime done right": "更专业的动漫体验",
  "{n} anime titles will be left out (Trakt has no IDs for them).":
    "将排除 {n} 部动漫作品（Trakt 中没有对应 ID）。",
  "Allow rating movies, shows, and anime directly using the star picker.":
    "允许直接使用星级选择器为电影、剧集和动漫评分。",
  "Anime card rating source": "动漫卡片评分来源",
  "Anime only": "仅动漫",
  "Anime Title Language": "动漫标题语言",
  "Anime4K isn't set up yet. Turn it on in Settings under Anime.":
    "Anime4K 尚未设置。请前往“设置”的“动漫”中启用。",
  "Display today's trending movies, TV shows, and anime from Simkl.":
    "显示 Simkl 今日热门电影、剧集和动漫。",
  "Download anime diagnostics": "下载动漫诊断信息",
  "Finds anime that got saved under a movie/series id by the 0.9.65 bug (breaks Continue Watching + Trakt), and removes just those so they re-add correctly.":
    "查找因 0.9.65 版本错误而保存到电影/剧集 ID 下的动漫（会导致“继续观看”和 Trakt 失效），并只移除这些条目，以便重新正确添加。",
  "Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.":
    "看完一集动漫后会更新你的 MyAnimeList 进度。只增不减：绝不会降低已有集数。",
  "Fix corrupted anime": "修复损坏的动漫条目",
  "No corrupted anime found. You're clean.": "未发现损坏的动漫，一切正常。",
  "Nothing to send. All {n} watchlist items are anime, which Trakt can't track.":
    "没有可发送的内容。片单中的全部 {n} 个项目都是动漫，而 Trakt 无法跟踪动漫。",
  "On shows titles in your metadata language (English by default). Off keeps each title's original language, so anime and foreign films show their native names.":
    "开启后，内容标题会以你的元数据语言显示（默认为英语）。关闭后则保留各内容的原始语言标题，因此动漫和外国电影会显示原名。",
  "Pick which score anime cards show. IMDb falls back to MAL when a title has no IMDb rating yet.":
    "选择动漫卡片显示的评分。若作品尚无 IMDb 评分，则改用 MAL 评分。",
  "Preferred language for anime titles displayed on poster cards.":
    "海报卡片上显示的动漫标题所使用的首选语言。",
  "Reader review": "读者评论",
  "Real-time anime upscaling. GPU-intensive.": "实时提升动漫画质。会大量占用 GPU。",
  "Saved harbor-anime-diagnostics.txt ({n} entries). Send us that file.":
    "已保存 harbor-anime-diagnostics.txt（{n} 条记录）。请将该文件发送给我们。",
  "Saves a .txt of your watched anime + series entries so we can see the exact shape and finish the fix. Just titles, ids, and episode numbers.":
    "将你看过的动漫和剧集记录保存为 .txt，以便我们查看确切的数据结构并完成修复。仅包含标题、ID 和集数。",
  "skipped {n} anime": "已跳过 {n} 部动漫",
  "Trakt comments are not available for anime titles.": "动漫作品不支持 Trakt 评论。",
  "Hide the top and bottom bars while reading. Arrows, page number, and bookmark stay; the bars return when your cursor reaches the screen edge.":
    "阅读时隐藏顶部栏和底部栏。箭头、页码和书签仍会保留；当光标移到屏幕边缘时，这些栏会重新显示。",
  "Add chapter folders of images, or .cbz / .zip files.":
    "添加包含图片的章节文件夹，或 .cbz / .zip 文件。",
  "Anime Adaptation": "动画改编",
  "Anime ends": "动画结束于",
  "Auto next chapter": "自动进入下一章",
  Book: "书籍",
  "Chapter complete": "本章读完",
  "Chapter {n}": "第 {n} 章",
  "Choose manga download folder": "选择漫画下载文件夹",
  "Choose manga folder": "选择漫画文件夹",
  "Close reader": "关闭阅读器",
  "Continue reading": "继续阅读",
  "Do it once on a browse page, once on a series page, once in the reader.":
    "分别在浏览页面、系列页面和阅读器中执行一次。",
  "Download chapter": "下载章节",
  "Featured manga": "精选漫画",
  "Harbor does not host any manga or any sources. Connect your own server or open a folder you already have, and mix as many as you like.":
    "Harbor 不托管任何漫画或来源。请连接你自己的服务器或打开已有文件夹，并可按需混合使用任意数量的来源。",
  "Harbor ships no manga sources and hosts nothing. Extensions come from repositories other people maintain. Paste a repository URL below to browse its plugins, then install the ones you want. Every plugin runs sandboxed in an isolated worker with no access to your files, accounts, or the rest of the app.":
    "Harbor 不内置任何漫画来源，也不托管任何内容。扩展来自他人维护的仓库。请在下方粘贴仓库 URL 以浏览其中的插件，然后安装所需插件。每个插件都在隔离的 Worker 沙盒中运行，无法访问你的文件、账号或应用的其他部分。",
  "Inside it, one folder per manga, named like the title.":
    "在其中为每部漫画创建一个以漫画标题命名的文件夹。",
  "Loading chapter...": "正在加载章节…",
  "Loading your manga sources": "正在加载你的漫画来源",
  "Manga sources": "漫画来源",
  "Next chapter": "下一章",
  "No bookmarks yet. Save your spot with the button above, in any reading mode.":
    "暂无书签。在任意阅读模式下，使用上方按钮保存阅读位置。",
  "No manga found": "未找到漫画",
  "Open manga details": "打开漫画详情",
  "Open the site in a browser. Right-click the thing you want (a cover, a title, a chapter link) and choose Inspect.":
    "在浏览器中打开网站。右键点击所需内容（封面、标题或章节链接），然后选择“检查”。",
  "Pick one folder. Each subfolder inside is one manga, so name it exactly like the title. In each, add chapter folders of images or .cbz / .zip files. A cover.jpg sets a custom cover.":
    "选择一个文件夹。其中每个子文件夹代表一部漫画，因此请严格按漫画标题命名。在每个子文件夹中添加包含图片的章节文件夹或 .cbz / .zip 文件。cover.jpg 可用于设置自定义封面。",
  "Pick up the manga at {label}.": "从 {label} 处继续阅读漫画。",
  "Pick up the manga where the anime ends.": "从动画结尾处继续阅读漫画。",
  "Previous chapter": "上一章",
  "Reader settings": "阅读器设置",
  "Reading mode": "阅读模式",
  "Remove from continue reading": "从“继续阅读”中移除",
  "Resume reading": "继续阅读",
  "Search manga...": "搜索漫画…",
  "Tap the star on any manga to save it here.": "点按任意漫画上的星标，即可将其保存到这里。",
  "The anime adaptation covers ": "动画改编涵盖 ",
  "The anime adaptation ends at this chapter": "动画改编到本章结束",
  "The anime adaptation runs through ": "动画改编到 ",
  "The anime adaptation starts at ": "动画改编从 ",
  "The source returned a bad response for this manga. It may be temporary, or the title may have moved. Try another source, or head back and pick something else.":
    "该来源为此漫画返回了异常响应。这可能只是暂时问题，也可能是作品页面已迁移。请尝试其他来源，或返回选择其他作品。",
  "This chapter could not be loaded from this source.": "无法从此来源加载本章。",
  "Use the download arrow next to any chapter to save it for reading offline.":
    "使用任意章节旁边的下载箭头进行保存，以便离线阅读。",
  "Watch the anime": "观看动画",
  "You have reached the latest chapter available.": "您已读到当前最新话。",
  "if the reader loads images from the chapter URL plus a suffix (like":
    "如果阅读器从话 URL 加后缀后的地址加载图片（例如",
  "is each chapter row": "是每一话所在的行",
  "is the box around one manga; inside it": "是包含一部漫画的容器；其中",
  "is the manga URL": "是漫画 URL",
  "the chapter links on a series page.": "作品页面上的各话链接。",
  "the chapter number": "话数",
  "the reader.": "阅读器。",
  "{n} chapter": "{n} 话",
  "← name it like the manga": "← 按漫画名称命名",
  "Add a manga source to open these": "添加漫画源以打开这些内容",
  "Add tags (anime, horror, cozy...)": "添加标签（动漫、恐怖、治愈等）",
  "Award winner": "获奖者",
  "Manga cannot be matched to a Harbor title yet, so {n} were left out.":
    "漫画目前无法与 Harbor 作品匹配，因此有 {n} 部漫画未导入。",
  "Search movies, shows, anime, manga": "搜索电影、剧集、动漫、漫画",
  "Top Manga": "漫画排行榜",
  "{award} winner": "{award} 得主",
  "{n} {award} wins": "获得 {n} 次 {award}",
  "{wins} major award wins, {noms} nominations": "获得 {wins} 项重要奖项和 {noms} 项提名",
  "A neural network that doubles luma resolution. The sharpest general-purpose upscaler, strong on both live action and anime. Pick one variant.":
    "将亮度分辨率翻倍的神经网络。这是最锐利的通用放大器，对真人影像和动漫都表现出色。请选择一个变体。",
  "A real poster with your scores on it. It swaps to an anime title every few seconds so you can check both sets.":
    "一张显示你评分的真实海报。它每隔几秒会切换为一部动漫作品，方便你检查两套设置。",
  "A trained luma doubler that is cheap enough to leave on. Excellent on anime and flat-shaded sources. Pick a radius, larger is sharper and heavier.":
    "经过训练且性能开销较低的亮度倍增器，适合常开。尤其适合动漫和平涂风格片源。请选择半径，半径越大，画面越锐利，负载越高。",
  "Academy Award": "奥斯卡金像奖",
  "AniList forum threads on anime detail pages.": "在动漫详情页显示 AniList 论坛主题帖。",
  "Anime award bodies": "动漫颁奖机构",
  "Anime categories": "动漫类别",
  "Anime detail-page logos": "动漫详情页徽标",
  "Anime episodes airing this month, sub or dub": "本月播出的动漫剧集，字幕版或配音版",
  "Anime is hidden": "动漫已隐藏",
  "Anime of the year": "年度动漫",
  "Anime titles": "动漫标题",
  "Annie Award": "安妮奖",
  Award: "奖项",
  "Award icons": "奖项图标",
  "Best Anime Song": "最佳动漫歌曲",
  "Best Original Anime": "最佳原创动画",
  "Couldn't load anime": "无法加载动画",
  "Crunchyroll Anime Awards": "Crunchyroll Anime Awards",
  "César Award": "凯撒奖",
  "Everything on this page of {genre} is hidden by your anime filter.":
    "此 {genre} 页面中的所有内容均已被你的动漫筛选条件隐藏。",
  "For series and anime, keep playing the rest of the season from the release you first picked. Applies whether Play is instant or manual.":
    "对于剧集和动漫，继续播放你首次所选版本的本季其余内容。无论“播放”是即时还是手动均适用。",
  "Goya Award": "戈雅奖",
  "Make an award pack": "制作奖项包",
  "Name each file after its award ID. Harbor resizes them and skips anything it cannot match.":
    "请以奖项 ID 为每个文件命名。Harbor 会调整文件尺寸，并跳过无法匹配的文件。",
  "New Face Award": "新人奖",
  "Only on anime": "仅限动漫",
  "Popular Manga": "热门漫画",
  "Read manga files you already have": "阅读已有的漫画文件",
  "Reading this device": "正在读取此设备",
  "Restore + upscale. The best all-rounder for most anime.":
    "修复并放大。适合大多数动画的最佳全能方案。",
  "Run Anime4K on everything, not just anime": "对所有内容运行 Anime4K，而不只限于动画",
  "SAG Award": "美国演员工会奖",
  "Saturn Award": "土星奖",
  "Spirit Award": "独立精神奖",
  "Tokyo Anime Award Festival": "东京动画奖节",
  "Turn anime back on in Harbor's content settings to browse it here.":
    "请在 Harbor 的内容设置中重新启用动漫，以便在此浏览。",
  "Which language anime titles appear in on poster cards.": "海报卡片上的动漫标题使用哪种语言。",
  "Your {n} character and manga favorites live on the desktop Favorites tab.":
    "你收藏的 {n} 个角色和漫画项目可在桌面版的“收藏”标签页中查看。",
  "{n} award wins": "获奖 {n} 次",
  "{n} {award}": "{n} 个{award}",
  "{n} {award}s": "{n} 个{award}",
  "Search movies, shows, and manga to add": "搜索电影、剧集和漫画并添加",
  "Nothing to send. All {n} watchlist items are anime, which Trakt can't track.#one":
    "没有可发送的内容。片单中的 {n} 个条目全是动漫，Trakt 无法追踪。",
  "Nothing to send. All {n} watchlist items are anime, which Trakt can't track.#few":
    "没有可发送的内容。片单中的 {n} 个条目全是动漫，Trakt 无法追踪。",
  "Saved harbor-anime-diagnostics.txt ({n} entries). Send us that file.#one":
    "已保存 harbor-anime-diagnostics.txt（{n} 条记录）。请将该文件发送给我们。",
  "Saved harbor-anime-diagnostics.txt ({n} entries). Send us that file.#few":
    "已保存 harbor-anime-diagnostics.txt（{n} 条记录）。请将该文件发送给我们。",
  "{n} avatars across film, TV, and anime.#one": "{n} 个头像，涵盖电影、电视剧和动漫。",
  "{n} avatars across film, TV, and anime.#few": "{n} 个头像，涵盖电影、电视剧和动漫。",
  "{n} award#one": "{n} 个奖项",
  "{n} award#few": "{n} 个奖项",
  "{n} chapter#one": "{n} 章",
  "{n} chapter#few": "{n} 章",
  "What everyone is reading": "大家都在读",
  "Featured at Anime Expo": "Anime Expo 精选作品",
  "Eisner Award Winners": "艾斯纳奖获奖作品",
  "Eisner Winner": "艾斯纳奖获奖作品",
  "Harvey Award Winners": "哈维奖获奖作品",
  "Best Manga honorees": "最佳漫画获奖作品",
  "Harvey Winner": "哈维奖获奖作品",
  "Seiun Award Winners": "星云赏获奖作品",
  "Japan's top science-fiction comic honor": "日本顶级科幻漫画奖项",
  "Seiun Winner": "星云赏获奖作品",
  "Anime Expo": "Anime Expo",
  "Latest chapter": "最新章节",
  "Hugo Award Winners": "雨果奖获奖作品",
  "Nebula Award Winners": "星云奖获奖作品",
  "The eBook download was canceled.": "已取消下载电子书。",
  "Harbor eBook": "Harbor 电子书",
  "This eBook is not connected to an installed source.": "此电子书未关联到已安装的来源。",
  "Loading chapter list…": "正在加载章节列表…",
  "EPUB eBook": "EPUB 电子书",
  "The eBook export was canceled.": "已取消导出电子书。",
  "Download a movie, episode, or eBook and it will appear here with its progress and offline status.":
    "下载电影、剧集或电子书后，它会显示在此处，并展示下载进度和离线状态。",
  "Add trusted eBook sources from a Harbor-compatible repository.":
    "从 Harbor 兼容仓库添加可信的电子书来源。",
  "Harbor reading room": "Harbor 阅览室",
  "Set up at least one readable eBook source to begin. Metadata can describe a book, but a folder, extension, or custom source is what lets Harbor open it.":
    "请至少设置一个可读取的电子书来源。元数据可以描述图书，但只有文件夹、扩展或自定义来源才能让 Harbor 打开图书。",
  "Reserved for your next book": "留给你的下一本书",
  "Ways to add an eBook source": "添加电子书来源的方式",
  "Add a Google Books API key for book titles, covers, authors, and descriptions. Wikidata works automatically as the final metadata fallback.":
    "添加 Google Books API 密钥，以获取书名、封面、作者和简介。Wikidata 会自动作为最后的元数据备用来源。",
  "Translation runs when a chapter opens and keeps the original if a request fails or is truncated.":
    "翻译会在章节打开时进行；如果请求失败或内容被截断，则保留原文。",
  "DeepSeek chapter translation": "DeepSeek 章节翻译",
  "Sends only the chapter you open to DeepSeek. Volumes, chapters, and metadata stay unchanged.":
    "仅将你打开的章节发送给 DeepSeek。卷、章节和元数据均不会更改。",
  "Pick one library folder. Each subfolder is one eBook. Put its chapters inside as TXT, Markdown, HTML, or EPUB files and optionally add a cover image.":
    "选择一个书库文件夹。每个子文件夹代表一本电子书，其中可放入 TXT、Markdown、HTML 或 EPUB 格式的章节文件，也可选择添加封面图片。",
  "Choose eBook folder": "选择电子书文件夹",
  "Read eBook files you already have": "阅读你已有的电子书文件",
  "This repository lists no eBook extensions.": "此仓库中没有电子书扩展。",
  "Could not load that eBook extension repository": "无法加载该电子书扩展仓库",
  "eBook extensions use Harbor’s isolated worker, HTTP bridge, and HTML parser—the same sandbox used by Manga extensions. Only add repositories you trust.":
    "电子书扩展使用 Harbor 的隔离式 Worker、HTTP 桥接和 HTML 解析器，与漫画扩展使用相同的沙盒。请仅添加你信任的仓库。",
  "No repositories yet. Add one above to browse eBook extensions.":
    "暂无仓库。请在上方添加仓库以浏览电子书扩展。",
  "Connect books you own, trusted reading sources, and metadata services. Harbor keeps the shelf coherent while every source stays under your control.":
    "连接你拥有的图书、可信的阅读来源和元数据服务。Harbor 会保持书架井然有序，而所有来源始终由你掌控。",
  "Private reading collection": "私人阅读收藏",
  "eBook source settings": "电子书来源设置",
  "Shape the metadata and reading language Harbor uses without changing your original files.":
    "设置 Harbor 使用的元数据和阅读语言，而不更改原始文件。",
  "{count} chapter": "{count} 章",
  "This eBook could not be exported": "无法导出此电子书",
  "Continue Reading": "继续阅读",
  "Start Reading": "开始阅读",
  "Book Details": "图书详情",
  "Close eBook menu": "关闭电子书菜单",
  "eBook actions": "电子书操作",
  "Back to eBook actions": "返回电子书操作",
  "Offline Reading": "离线阅读",
  "Book metadata": "图书元数据",
  "No story summary is available for this eBook.": "此电子书暂无故事简介。",
  "Save every available chapter from {source} for offline reading.":
    "保存 {source} 中所有可用章节以供离线阅读。",
  "Reflowable eBook": "可重排电子书",
  "Chapter {chapter}": "第 {chapter} 章",
  Chapter: "章节",
  "Search chapter": "搜索章节",
  "Preparing book…": "正在准备图书…",
  "Harbor Reader": "Harbor 阅读器",
  "Translate chapter": "翻译章节",
  "Read chapter with Edge TTS": "使用 Edge TTS 朗读章节",
  "Read the complete chapter with Edge TTS": "使用 Edge TTS 朗读完整章节",
  "Complete-chapter generation progress": "整章生成进度",
  "Select a chapter": "选择章节",
  "Reading settings": "阅读设置",
  "Reading adjustments": "阅读调整",
  "Book Series": "丛书",
  "Award Winners": "获奖作品",
  "Loading book collections…": "正在加载图书合集…",
  "Open the wheel menu on any eBook and choose Add to Shelf.":
    "打开任意电子书的轮盘菜单，然后选择“添加到书架”。",
  "Resume from your saved reading position": "从已保存的阅读位置继续",
  "Popular titles from book metadata": "图书元数据中的热门作品",
  "Refresh eBook source": "刷新电子书源",
  "Manage eBook sources": "管理电子书源",
  "A remarkable book for your shelf": "一本值得珍藏于书架的佳作",
  "Open featured book": "打开精选图书",
  "Previous featured book": "上一本精选图书",
  "Next featured book": "下一本精选图书",
  "Show featured book {number}: {title}": "显示精选图书 {number}：{title}",
  "Reading progress": "阅读进度",
  "Complete book": "已读完",
  "Ch. {chapter}": "第 {chapter} 章",
  "Manga adaptation": "漫画改编作品",
  "Close Manga selection": "关闭漫画选择界面",
  "Loading eBook…": "正在加载电子书…",
  "No description is available for this eBook.": "此电子书暂无简介。",
  "This chapter could not be loaded.": "无法加载此章节。",
  "Most popular, critically acclaimed, award winners and more": "热门作品、口碑佳作、获奖作品等",
  "Loading chapter": "正在加载章节",
  "Book flip": "书籍翻页",
  "{chapter} · page {page}": "{chapter} · 第{page}页",
  "Reading {chapter}": "正在阅读 {chapter}",
  "Start of manga": "漫画开头",
  "End of manga": "漫画结尾",
  "Reader closed on your computer": "电脑上的阅读器已关闭",
  "Open a manga on Harbor to control the reader from here.":
    "在 Harbor 中打开漫画，即可从这里控制阅读器。",
  "Recognized at the {award}.": "获得 {award} 认可。",
  "Jina Reader": "Jina Reader",
  "GPU shaders that sharpen lines and clean up gradients on anime as it plays. Pick a mode, Harbor handles the shaders.":
    "在动漫播放时实时锐化线条并平滑渐变的 GPU 着色器。选择一种模式，其余交给 Harbor。",
  "Your award pack": "你的奖杯包",
  "Award pack": "奖杯包",
  "Reskin the award trophies shown across Harbor. Click any award to add a PNG or animated GIF, add your own custom award types, or import a whole set at once.":
    "更换 Harbor 各处所显示奖杯的外观。点击任意奖项即可添加 PNG 或动态 GIF，也可添加自定义奖项类型，或一次导入整套素材。",
  "Reading…": "正在读取…",
  "Custom award name (e.g. My Festival)": "自定义奖项名称（例如：我的电影节）",
  "Add a custom award type": "添加自定义奖项类型",
  "Invent your own award types": "创建自己的奖项类型",
  "Awards are not a fixed list. Add a custom award type, name it anything, and give it its own art. It shows up alongside the built-in trophies.":
    "奖项并非固定列表。你可以添加自定义奖项类型，随意命名并为其设置专属图片。它会与内置奖杯一同显示。",
  "How award packs work": "奖杯包的工作方式",
  "Not here? Add a custom award type on the previous screen and name its file anything you like.":
    "没有需要的槽位？请在上一页添加自定义奖项类型，其文件可使用任意名称。",
  "Anime Awards & Recognition": "动漫奖项与荣誉",
  "Add a TMDB key in Settings to unlock award winners.":
    "在“设置”中添加 TMDB 密钥，即可查看获奖者。",
  "Fills in where TMDB comes up empty (anime, older catalog). Free at":
    "在 TMDB 数据缺失时进行补充（动漫、旧片库）。可在此免费获取",
  "Applies to anime when you play it.": "播放动漫时应用。",
};

export default books;
