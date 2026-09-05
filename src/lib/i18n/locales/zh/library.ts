const library: Record<string, string> = {
  Library: "媒体库",
  "My Library": "我的媒体库",
  "Couldn't find a Trakt avatar on your account.": "未在你的 Trakt 账号中找到头像。",
  "Couldn't reach Trakt.": "无法连接 Trakt。",
  "Couldn't find a Simkl avatar on your account.": "未在你的 Simkl 账号中找到头像。",
  "Couldn't reach Simkl.": "无法连接 Simkl。",
  "Use Trakt avatar": "使用 Trakt 头像",
  "Use Simkl avatar": "使用 Simkl 头像",
  "Use the primary profile's Stremio library, watchlist, and addons.":
    "使用主个人资料的 Stremio 媒体库、待看列表和插件。",
  "Sign in from the sidebar after saving. Library and addons stay separate.":
    "保存后从侧边栏登录。媒体库和插件将保持独立。",
  "{label} · {n} collection": "{label} · {n} 个合集",
  "Play without sync": "不同步播放",
  "Preparing download": "正在准备下载",
  "Couldn't download, try again": "下载失败，请重试",
  "Back to library": "返回媒体库",
  Download: "下载",
  "Download failed": "下载失败",
  "Download to disk": "下载到磁盘",
  List: "列表",
  "Reset sync": "重置同步",
  Saved: "已保存",
  "Saved to disk": "已保存到磁盘",
  "Saved to {folder} · open folder": "已保存到 {folder} · 打开文件夹",
  "Search {n} favorite": "搜索 {n} 个收藏项",
  Sync: "同步",
  "Your copy runs {guest}, host's runs {host}. Sync may drift.":
    "你的版本时长为 {guest}，房主的版本时长为 {host}。同步可能会逐渐偏移。",
  "Next and Previous follow your queue": "“下一项”和“上一项”将按你的队列顺序跳转",
  "URL saved": "URL 已保存",
  "Sync indicator position": "同步指示器位置",
  "Scrobble to Simkl": "将播放记录同步到 Simkl",
  "Display Simkl Community Ratings": "显示 Simkl 社区评分",
  "Download relay documentation": "下载中继文档",
  "Community sync server URL": "社区同步服务器 URL",
  "Private mode (no community sync contact)": "私密模式（不连接社区同步）",
  "A TOP 10 corner ribbon on the Top 10 rail posters. The watchlist marker auto-moves to the opposite corner so nothing overlaps.":
    "Top 10 横栏海报角上的 TOP 10 丝带标记。片单标记会自动移到对角，避免重叠。",
  "After the current show's episodes, Next flows into your queue. Off keeps Next/Previous within the current show only.":
    "当前剧集的各集播放完后，“下一项”会接着播放队列中的内容。关闭后，“上一项/下一项”仅在当前剧集中切换。",
  "Found {n}: {names}. These are saved under the wrong id, which breaks Continue Watching and Trakt marking.":
    "找到 {n} 项：{names}。这些内容保存在错误的 ID 下，导致“继续观看”和 Trakt 标记异常。",
  "Queue drives Next/Previous": "由队列决定下一项/上一项",
  "Show a bookmark on saved titles": "在已收藏的影片上显示书签",
  "Show sync indicator": "显示同步指示器",
  "Sync indicator": "同步指示器",
  "Updating separated settings per profile, which may have reset your theme and keys. Harbor still has your old setup saved. Bring it back on this profile, then reload.":
    "正在升级为按配置文件分别保存设置，这可能已重置你的主题和密钥。Harbor 仍保留着之前的设置。请将其恢复到此配置文件，然后重新加载。",
  "Watchlist bookmark": "待看列表书签",
  "Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.":
    "让媒体库的“稍后观看”标签页仅显示你在 Stremio 中添加的作品。关闭此项后，还会显示你按下播放时由 Stremio 自动添加的所有内容。",
  "Your Stremio sign-in. Library, watch progress, and addons sync from here.":
    "你的 Stremio 登录账户。媒体库、观看进度和插件均从这里同步。",
  "Library & metadata": "媒体库和元数据",
  Simkl: "Simkl",
  "Connect your Simkl account to mark what you finish as watched and sync your plan-to-watch list across apps.":
    "连接 Simkl 账户，将看完的内容标记为已观看，并在不同应用间同步计划观看列表。",
  "MDBList · Letterboxd and Trakt scores": "MDBList · Letterboxd 和 Trakt 评分",
  "Stremio library repair": "修复 Stremio 媒体库",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema.":
    "扫描 Stremio 媒体库，并重写所有不完全符合 Stremio 架构的项目。",
  "Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps.":
    "按各插件返回的原始顺序显示结果，并依照你的插件列表分组。与 Stremio 和 Vidi 应用一致。",
  "Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.":
    "Harbor 会从 Stremio 获取你的插件集合。可在“流媒体来源”中管理各个插件。",
  "Theme Library": "主题库",
  "Pick a layout, set colors and fonts, save it to your library. No code needed.":
    "选择布局并设置颜色和字体，然后保存到主题库。无需编写代码。",
  "Open library": "打开主题库",
  "{name} imported to your library": "已将 {name} 导入主题库",
  "Use my Trakt avatar as my Harbor avatar": "使用我的 Trakt 头像作为 Harbor 头像",
  "Use my Simkl avatar as my Harbor avatar": "使用我的 Simkl 头像作为 Harbor 头像",
  "Sync now": "立即同步",
  "Sign in to sync your library, watch progress, and addons.": "登录以同步媒体库、观看进度和插件。",
  "URL is saved and ready to share.": "URL 已保存，可以分享。",
  "Connect your Trakt account": "连接你的 Trakt 账户",
  "Connect Trakt": "连接 Trakt",
  "About Trakt": "关于 Trakt",
  "Wear your Trakt profile picture across Harbor instead of the default.":
    "在 Harbor 各处使用你的 Trakt 头像，而非默认头像。",
  "Disconnect from Trakt": "断开 Trakt 连接",
  "Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.":
    "要断开 Trakt 连接吗？重新连接前，播放记录上报和同步将停止。",
  "Connect your Simkl account": "连接你的 Simkl 账户",
  "Connect Simkl": "连接 Simkl",
  "About Simkl": "关于 Simkl",
  "Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.":
    "Harbor 会在 Simkl 上将你看完的内容标记为已观看，并同步你的想看片单。",
  "Wear your Simkl profile picture across Harbor instead of the default.":
    "在 Harbor 各处使用你的 Simkl 头像，而非默认头像。",
  "Disconnect from Simkl": "断开 Simkl 连接",
  "Disconnect Simkl? Syncing will stop until you reconnect.":
    "要断开 Simkl 连接吗？重新连接前，同步将停止。",
  "Sync watch progress": "同步观看进度",
  "Episodes and movies from shows you've saved on Stremio.":
    "你在 Stremio 上收藏的节目所包含的剧集和电影。",
  "Add a TMDB key in Library settings.": "请在媒体库设置中添加 TMDB 密钥。",
  "My Trakt": "我的 Trakt",
  "Upcoming episodes and movies from your Trakt watchlist.":
    "你的 Trakt 片单中即将上线的剧集和电影。",
  "Connect Trakt first.": "请先连接 Trakt。",
  "The most anticipated upcoming releases on Trakt. No login needed.":
    "Trakt 上最受期待的即将上线内容。无需登录。",
  "Anything matching your Custom calendar: tracked people, genres, providers, countries.":
    "与你的自定义日历匹配的任何内容：关注的人物、类型、提供商和国家/地区。",
  "Open Library settings": "打开媒体库设置",
  "Save a TMDB key in Library & metadata to turn on streaming catalogs.":
    "在“媒体库和元数据”中保存 TMDB 密钥以启用流媒体目录。",
  "Sign in to Stremio first. Your installed addons sync from there.":
    "请先登录 Stremio。已安装的插件将从该处同步。",
  "Scale every poster and card across Home, Discover, and your library. Bump it up on a 4K or large display where the defaults feel small, or shrink it for a denser grid.":
    "缩放首页、发现和媒体库中的所有海报与卡片。在默认尺寸显得较小的 4K 或大屏幕上可调大，也可调小以显示更紧凑的网格。",
  "Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go faster.":
    "自动包含。不含密钥、媒体库信息或 URL，仅包含结构性标记，以便更快复现问题。",
  "Trakt anticipated picks up something": "Trakt 热门期待中有新内容",
  "My Trakt watchlist updates": "我的 Trakt 片单有更新",
  "Trakt anticipated": "Trakt 热门期待",
  "Your Trakt watchlist": "你的 Trakt 片单",
  "Add people in the Custom calendar manager first, then come back here.":
    "请先在自定义日历管理器中添加人物，然后返回此处。",
  "My library": "我的媒体库",
  "Custom calendar": "自定义日历",
  "Library, watch progress, and addon collection sync from this account.":
    "媒体库、观看进度和插件集合会从此账户同步。",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app. Every install also syncs to your Stremio account, so the official app remains the canonical home for your library.":
    "Harbor 会接管 stremio:// 安装链接，让配置和安装流程始终在应用内完成。每次安装也会同步到你的 Stremio 账户，确保官方应用中的媒体库始终为准。",
  "Saved {d} from Harbor {a}.": "已从 Harbor {a} 保存 {d}。",
  "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.":
    "扫描你的 Stremio 媒体库，并重写结构不符合 Stremio 精确数据规范的项目。可随时安全运行，只会修改需要修复的项目。",
  "Watchlist shows only saved titles": "片单仅显示已保存的内容",
  "Clear all saved frames": "清除所有已保存的帧",
  "This replaces your current Harbor setup (theme, home layout, settings, addons, profiles, and more) with the {n} saved entries in this file. Your Stremio sign-in stays as is. Harbor reloads when it finishes.":
    "这会用该文件中保存的 {n} 个条目替换当前 Harbor 配置，包括主题、首页布局、设置、插件、个人资料等。Stremio 登录状态保持不变。完成后 Harbor 将重新加载。",
  "Saved {when} from Harbor {app}.": "由 Harbor {app} 于 {when} 保存。",
  "Harbor's in-app installer animates the manifest install and keeps you in context. Anything Harbor installs is also synced to your Stremio account, so the official app stays the canonical library. Turn this off and Stremio becomes the only handler for stremio:// links; Harbor still installs anything you trigger from inside the app (Configure & install, paste, drag-and-drop).":
    "Harbor 的应用内安装器会以动画展示 manifest 安装过程，让你无需离开当前页面。Harbor 安装的所有内容也会同步到你的 Stremio 账户，因此官方应用仍是规范内容库。关闭此选项后，stremio:// 链接将仅由 Stremio 处理；但从 Harbor 内触发的安装仍会由 Harbor 完成，包括“配置并安装”、粘贴和拖放。",
  "A new version is ready to download.": "新版本已可下载。",
  "Save an OMDB key in Library & metadata to enable rating fetches.":
    "在“媒体库与元数据”中保存 OMDB 密钥，以启用评分获取功能。",
  "Key rejected. Check it on Library & metadata.": "密钥被拒绝。请前往“媒体库与元数据”检查。",
  "Repair library": "修复媒体库",
  "Sign in to Stremio first. The repair scans only the active profile's library.":
    "请先登录 Stremio。修复仅扫描当前个人资料的媒体库。",
  "Library is empty. Nothing to repair.": "媒体库为空，无需修复。",
  "Fetching library index…": "正在获取媒体库索引…",
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.":
    "播放看过一部分的内容时，显示提示，让您选择从上次位置继续或从头开始。也适用于从 Stremio 或 Trakt 同步的项目。",
  "Please add your TMDB API key in the Library & Metadata settings to view this folder.":
    "请在“媒体库与元数据”设置中添加 TMDB API 密钥，以查看此文件夹。",
  "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.":
    "通过 Stremboxd 桥接服务，将你的 Letterboxd 想看清单、日记、喜欢的电影和列表导入 Harbor。",
  "Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.":
    "公开模式只需用户名，即可访问想看清单、喜欢的电影、热门电影和 Top 250，无需密码。",
  "Remove list": "移除列表",
  "letterboxd.com/username/list/slug": "letterboxd.com/username/list/slug",
  Watchlist: "想看清单",
  "Could not resolve that Letterboxd list URL.": "无法解析该 Letterboxd 列表 URL。",
  "Saved frame": "保存的画面",
  "Auto-sync subtitles": "自动同步字幕",
  "Community sync": "社区同步",
  "Community sync server": "社区同步服务器",
  "https://sync.harbor.site": "https://sync.harbor.site",
  'Posters, logos, and title art load in the first available language from this list, falling back down the order. "Original" uses the title\'s own language. Put your main language first. Needs a TMDB key.':
    "海报、徽标和标题图将按此列表中的语言顺序，使用首个可用语言加载，并依次回退。“原始语言”会使用作品标题本身的语言。请将你的主要语言放在首位。需要 TMDB 密钥。",
  "When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.":
    "重新打开之前浏览过的剧集时，直接回到上次位置（通常是分集列表），而不是从页面顶部开始。跳转会在页面显示前完成，因此不会出现闪屏。",
  "Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.":
    "右键单击某一集时增加“隐藏”选项。隐藏的单集会从列表中消失，“接下来播放”也会跳过它们。每部作品中的“显示隐藏内容”开关可让它们重新显示。",
  "On a beta that's giving you trouble? Pick an earlier build below and run its installer over your current copy. Your library, settings, and downloads all stay put.":
    "当前 Beta 版有问题？在下方选择较早的构建版本，直接运行其安装程序并覆盖当前版本。你的媒体库、设置和下载内容都会原样保留。",
  "Download the desktop app to use shaders.": "下载桌面应用以使用着色器。",
  "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.":
    "可随时安全清除。这里的任何操作都不会影响观看记录、媒体库、主题或登录状态。",
  "Harbor searches every source you enable at the same time, then merges and de-duplicates the results into one clean list. Turn a source off to stop pulling from it.":
    "Harbor 会同时搜索你启用的所有来源，然后合并结果并去重，生成一份简洁列表。关闭某个来源即可停止从中获取字幕。",
  "What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.":
    "决定主视觉区显示的内容。“热门趋势”显示 Harbor 提供的最新热门榜单，并在一天中持续刷新。“经典”则使用你自己的首页横栏。",
  "Results from addons higher in this list come first. If one finds nothing, the next fills in.":
    "此列表中位置较高的插件结果会优先显示。如果某个插件没有结果，则由下一个插件补上。",
  "Remove from list": "从列表中移除",
  "Connected: {list}": "已连接：{list}",
  "Replace the saved key": "替换已保存的密钥",
  "Sync, themes and friends": "同步、主题与好友",
  "Your Stremio library": "你的 Stremio 媒体库",
  "Show your Simkl card": "显示你的 Simkl 卡片",
  "Off by default. Shows your Simkl avatar, name and watch stats on your profile for anyone who visits. Manage the connection itself in Settings, Simkl.":
    "默认关闭。启用后，任何访问者都能在你的个人资料中看到 Simkl 头像、名称和观看统计数据。连接本身可在“设置”的“Simkl”中管理。",
  "On Simkl": "在 Simkl 上查看",
  "Open Simkl profile": "打开 Simkl 个人资料",
  "Nothing tracked on Simkl yet": "Simkl 尚未跟踪任何内容",
  "Link Simkl and everything you watch shows up right here.":
    "关联 Simkl 后，你观看的所有内容都会显示在这里。",
  "Could not reach Simkl.": "无法连接 Simkl。",
  "Rating saved": "评分已保存",
  "Review saved": "短评已保存",
  "Unlike list": "取消点赞列表",
  "Like list": "点赞列表",
  "Harbor list": "Harbor 列表",
  "Share list": "分享列表",
  "List link": "列表链接",
  "Create lists in your library to feature them here": "在媒体库中创建列表，即可在此展示",
  "List full": "列表已满",
  "Untitled list": "未命名列表",
  "Pick lists from your library to show them here": "从你的媒体库中选择要在此展示的列表",
  "not in your library": "不在你的媒体库中",
  "Favourite games": "喜爱的游戏",
  "Favourite books": "喜爱的书籍",
  "Favourite music": "喜爱的音乐",
  "We couldn't load your saved favourites": "无法加载已保存的收藏",
  "Add favourite games": "添加喜爱的游戏",
  "Add favourite books": "添加喜爱的书籍",
  "Add favourite artists": "添加喜爱的艺人",
  "Show your favourite games, books and music on your profile":
    "在个人资料中展示你喜爱的游戏、书籍和音乐",
  "Not enough dialogue to sync": "对白不足，无法同步",
  "Couldn't auto-sync": "无法自动同步",
  "Sync manually": "手动同步",
  "Sync is unavailable right now.": "暂时无法同步。",
  "Remove from queue": "从播放队列中移除",
  "Add to queue": "添加到播放队列",
  "In your queue": "已在播放队列中",
  "Your queue is empty. Add movies or shows and they'll play back-to-back here.":
    "你的播放队列为空。添加电影或剧集后，即可在此连续播放。",
  "{count} in queue · {time}": "队列中有 {count} 项 · {time}",
  "{count} in queue": "队列中有 {count} 项",
  "Create new list": "新建列表",
  "Added to new list": "已添加到新列表",
  "{n} in your library": "你的媒体库中有 {n} 个",
  "Pick one or many images. They collect in an Uploads set in your library. PNG, JPG, WebP, and GIF all work.":
    "选择一张或多张图片。它们会归入媒体库中的“上传”集合。支持 PNG、JPG、WebP 和 GIF。",
  "Bring your own avatars into the library.": "将你自己的头像添加到媒体库。",
  "Removed from My List": "已从“我的列表”中移除",
  "Added to My List": "已添加到“我的列表”",
  "Add to my list": "添加到我的列表",
  "My List": "我的列表",
  "Couldn't load this collection right now.": "暂时无法加载此合集。",
  "Weekend watchlist": "周末片单",
  "Your queue": "你的队列",
  "Your queue is full. Start whenever you're ready.": "队列已满。准备好后即可开始。",
  "Your queue is saved until you clear it.": "队列会一直保存，直到你将其清空。",
  "Blended across TMDB, Trakt, Simkl and Cinemeta.": "综合 TMDB、Trakt、Simkl 和 Cinemeta 的数据。",
  "Add to list": "添加到片单",
  "New list": "新建片单",
  "List name": "片单名称",
  "Favorite Characters": "最喜欢的角色",
  "Favorite Movies": "最喜欢的电影",
  "Favorite Shows": "最喜欢的剧集",
  "Confirm remove from history": "确认从历史记录中移除",
  "Remove from history": "从历史记录中移除",
  "Loading your history…": "正在加载历史记录…",
  "This list is full ({max} items)": "此片单已满（{max} 项）",
  "Add a movie or show to this list...": "将电影或剧集添加到此片单…",
  "List settings": "片单设置",
  "Rename list": "重命名片单",
  "Delete list": "删除片单",
  "List renamed": "片单已重命名",
  "Estimated from your local history. Connect Trakt or Simkl for the full picture.":
    "根据本地历史记录估算。连接 Trakt 或 Simkl 可查看完整统计。",
  "Connect Trakt or Simkl, or start watching, and your stats will build themselves.":
    "连接 Trakt 或 Simkl，或开始观看，统计数据将自动生成。",
  "Download this season": "下载本季",
  "Season saved offline": "本季已保存，可离线观看",
  "Auto-download new episodes": "自动下载新剧集",
  "Point Harbor at your self-hosted library to browse and install sources":
    "将 Harbor 连接到你的自托管媒体库，以浏览和安装源",
  "Create your first list": "创建你的第一个列表",
  "Library is everything from Stremio, Trakt, and this device. Watchlist is only titles you haven't watched yet. History is what you've watched. Local is files on your computer.":
    "媒体库包含来自 Stremio、Trakt 和此设备的所有内容。待看列表仅包含你尚未观看的片名。观看历史包含你看过的内容。本地内容是你电脑上的文件。",
  "Delete this list?": "删除此列表？",
  'Add titles with the search above, or hit "Add to list" on any movie or show\'s page.':
    "使用上方的搜索添加片名，或在任意电影或剧集页面点击“添加到列表”。",
  "Removed folder from your library": "已从媒体库中移除文件夹",
  "No titles found in this collection.": "此合集中未找到片名。",
  "Stremio didn't confirm the move. Your collection may be unchanged. Reload to see the current state.":
    "Stremio 未确认移动操作。你的收藏可能没有变化。请重新加载以查看当前状态。",
  "Moved {n} addons to your Stremio account. They now sync everywhere you sign in.":
    "已将 {n} 个插件移至你的 Stremio 账号。现在，这些插件会在你登录的所有设备上同步。",
  "Sync across your devices": "在你的设备间同步",
  "Download all": "全部下载",
  "Sync from here": "从此处同步",
  "Tap the first and last line of the section, then tap the line playing now and Sync from here.":
    "先点按该片段的第一行和最后一行，再点按当前正在播放的字幕行，然后点按“从此处同步”。",
  "Find the line you hear right now, then Sync from here. Everything shifts to match.":
    "找到你此刻听到的那一行，然后点按“从此处同步”。所有字幕都会相应调整。",
  "Set. If the subtitles drift later on, play ahead and Sync from here again at a later line to fix the drift.":
    "已设置。如果之后字幕逐渐不同步，请向前播放一段，并在后面的字幕行再次点按“从此处同步”以校正偏移。",
  "Sync subtitles": "同步字幕",
  "Loading your library…": "正在加载你的媒体库…",
  "This one installs through Harbor Setup, but the update manifest carries no signature for it. Harbor will not run an installer it cannot verify. Download it and run it yourself.":
    "此更新通过 Harbor Setup 安装，但更新清单中没有它的签名。Harbor 不会运行无法验证的安装程序。请下载后自行运行。",
  "Download installer": "下载安装程序",
  "Your collection.": "你的收藏。",
  "Watchlist is what you've saved for later. History is everything you've watched. Local is files on your computer.":
    "待看清单是你保存以便稍后观看的内容；观看历史包含你看过的所有内容；本地内容是你电脑上的文件。",
  "Watchlist only": "仅待看清单",
  "In Watchlist": "已在待看清单中",
  "Add to Watchlist": "添加到待看清单",
  "Remove from library": "从媒体库中移除",
  "Confirm remove from library": "确认从媒体库中移除",
  "No history yet": "暂无观看历史",
  "Your watchlist is empty": "你的待看清单为空",
  'Right-click any title in Harbor or hit "Add to Watchlist" on its detail page to save it here.':
    "右键单击 Harbor 中的任意标题，或在其详情页点击“添加到待看清单”，即可保存到这里。",
  "My Library shows upcoming episodes from the shows you've saved on Stremio. Sign in to wire it up.":
    "“我的媒体库”会显示你在 Stremio 中所保存节目的即将播出剧集。登录即可关联。",
  "Couldn't load the calendar": "无法加载日历",
  "Upcoming items from your watchlist": "待看清单中即将上线的内容",
  "Pick what you want in your calendar. Mix and match: tracked people, genres, streamers, countries, Trakt lists.":
    "选择要在日历中显示的内容。可任意组合：关注的演职人员、类型、流媒体平台、国家/地区和 Trakt 清单。",
  "Nothing from your library this month": "你的媒体库本月无内容",
  "Nothing from your library lands this month. Toggle Watchlist off to see all releases.":
    "你的媒体库本月没有内容上线。关闭“待看清单”即可查看所有上线内容。",
  "Your saved shows have no episodes scheduled for this month. Switch to All upcoming to browse the full release calendar.":
    "你保存的节目本月没有计划播出的剧集。切换到“全部即将上线”即可浏览完整的上线日历。",
  "TMDB powers the firehose of every release this month. The free tier covers it. About 60 seconds to set up. Switch to My Library if you'd rather only see what you've saved.":
    "TMDB 提供本月全部新内容的海量数据，免费套餐即可满足需求，设置约需 60 秒。如果你只想查看已保存的内容，请切换到“我的媒体库”。",
  "Syncing Trakt…": "正在同步 Trakt…",
  "{n} on Trakt": "Trakt 上有 {n} 项",
  "Connect Trakt in Settings to sync": "在设置中连接 Trakt 以同步",
  "{n} saved on this device": "此设备上保存了 {n} 项",
  "{n} in your Stremio library": "你的 Stremio 媒体库中有 {n} 项",
  "Trakt watchlist": "Trakt 待看清单",
  "Trakt history": "Trakt 观看历史",
  "Nothing saved on Trakt yet.": "Trakt 上尚未保存任何内容。",
  "No history yet.": "暂无观看历史。",
  "Couldn't reach Trakt. Try refreshing.": "无法连接 Trakt。请尝试刷新。",
  "Simkl plan to watch": "Simkl 计划观看",
  "Simkl history": "Simkl 观看历史",
  "Nothing on your Simkl plan-to-watch yet.": "你的 Simkl 计划观看清单中尚无内容。",
  "No Simkl history yet.": "暂无 Simkl 观看历史。",
  "Couldn't reach Simkl. Try refreshing.": "无法连接 Simkl。请尝试刷新。",
  "My Simkl": "我的 Simkl",
  "Simkl premieres": "Simkl 首播",
  "Upcoming episodes and movies from your saved shows": "你保存的节目中即将上线的剧集和电影",
  "Upcoming episodes and movies from your Trakt watchlist": "Trakt 待看清单中即将上线的剧集和电影",
  "The most anticipated upcoming releases on Trakt": "Trakt 上最受期待的即将上线内容",
  "Upcoming episodes and movies from your Simkl plan-to-watch list":
    "Simkl 计划观看清单中即将上线的剧集和电影",
  "Build your own feed from actors, directors, and Trakt lists":
    "使用演员、导演和 Trakt 清单创建专属信息流",
  "Discovery Queue": "探索队列",
  "Building tonight's queue…": "正在创建今晚的队列…",
  "Trakt sources": "Trakt 片源",
  "Synced to Trakt": "已同步到 Trakt",
  "Live sync": "实时同步",
  "Open guided live sync": "打开引导式实时同步",
  "Sync subtitles via text": "通过文本同步字幕",
  "Text sync unavailable for embedded tracks": "内嵌字幕轨不支持文本同步",
  "Text-based sync": "基于文本的同步",
  "Sync via text": "通过文本同步",
  "Sync unavailable": "无法同步",
  "Discard sync?": "要放弃同步吗？",
  "My Trakt watchlist": "我的 Trakt 待看列表",
  "Most-anticipated upcoming releases on Trakt": "Trakt 上最受期待的即将上线作品",
  "Saved locally. Connect Trakt in Settings to sync.":
    "已保存到本地。请在“设置”中连接 Trakt 以同步。",
  "Connect Trakt in settings first": "请先在“设置”中连接 Trakt",
  " Anything you save also syncs to your Trakt account.":
    " 您保存的所有内容也会同步到您的 Trakt 账号。",
  " Connect Trakt in Settings to sync this list across devices.":
    " 请在“设置”中连接 Trakt，以便跨设备同步此列表。",
  " · Syncing Trakt…": " · 正在同步 Trakt…",
  "Trakt has no upcoming releases for your watchlist this month. Past months and dates more than six months out aren't covered by Trakt's calendar feed.":
    "本月您的 Trakt 待看列表中没有即将上线的作品。Trakt 日历源不涵盖过去月份以及六个月后的日期。",
  "None of Trakt's most-anticipated upcoming releases land in this month. Try a different month.":
    "本月没有 Trakt 最受期待榜中的即将上线作品。请尝试其他月份。",
  "Nothing on Trakt this month": "Trakt 本月无内容",
  "Add to Simkl": "添加到 Simkl",
  "Add {title} to Simkl": "将 {title} 添加到 Simkl",
  "Couldn't reach Simkl": "无法连接 Simkl",
  "Simkl error (HTTP {status})": "Simkl 错误（HTTP {status}）",
  "Simkl sign-in expired, reconnect it": "Simkl 登录已过期，请重新连接",
  "No Simkl premieres this month": "本月 Simkl 没有首播作品",
  "Nothing on Simkl this month": "Simkl 本月无内容",
  "Your Simkl plan-to-watch list has no episodes airing this month. Switch to All upcoming to browse everything.":
    "您的 Simkl 待看列表中没有本月播出的单集。切换到“全部即将播出”以浏览所有内容。",
  "My list": "我的列表",
  "One list": "单个列表",
  "Every collection": "所有系列合集",
  "Sign in to filter by your library": "登录以按您的媒体库筛选",
  "Sign in to see your library calendar": "登录以查看您的媒体库日历",
  "Sign in to Stremio or connect Trakt to see what you've been watching here.":
    "登录 Stremio 或连接 Trakt，即可在此查看您的观看记录。",
  "to bring in your library.": "以导入您的媒体库。",
  "Add a list": "添加列表",
  "Add list": "添加列表",
  "List URL or ID": "列表 URL 或 ID",
  "No lists saved yet.": "尚未保存列表。",
  'Remove list "{name}"?': "要移除列表“{name}”吗？",
  "{source} list detected": "检测到 {source} 列表",
  "Keep typing, or paste the full list URL.": "继续输入，或粘贴完整的列表 URL。",
  "Paste a Trakt, MDBList, TMDB, Letterboxd, IMDb, or MAL list URL":
    "粘贴 Trakt、MDBList、TMDB、Letterboxd、IMDb 或 MAL 列表 URL",
  "Paste a public list from Trakt, MDBList, TMDB, Letterboxd, IMDb, or MyAnimeList. Harbor pulls the titles in and keeps the artwork sharp.":
    "粘贴来自 Trakt、MDBList、TMDB、Letterboxd、IMDb 或 MyAnimeList 的公开列表。Harbor 会导入其中的作品，并保持海报清晰。",
  "Search every collection on TMDB...": "搜索 TMDB 上的所有系列合集…",
  "That's every collection TMDB knows about.": "以上是 TMDB 收录的全部系列合集。",
  "That's every {category} collection we could find.": "以上是我们能找到的全部{category}系列合集。",
  "Saved movies and episodes for offline watching": "已保存供离线观看的电影和剧集单集",
  "{size} saved": "已保存 {size}",
  "Open any movie or show, hover an episode, and click the download icon. Pick the exact source you want and it saves here for offline watching.":
    "打开任意电影或剧集，将鼠标悬停在某一集上，然后点击下载图标。选择所需的指定片源，即可保存到此处供离线观看。",
  "Interrupted: re-download to finish": "下载已中断：请重新下载以完成",
  "Cancel download": "取消下载",
  "Delete download and file": "删除下载项和文件",
  "Download for offline": "下载以供离线观看",
  "Retry download": "重试下载",
  "Download failed, click to retry": "下载失败，点击重试",
  "Download failed  ·  click to retry": "下载失败 · 点击重试",
  "Saved offline": "已保存，可离线观看",
  "My Watchlist": "我的待看清单",
  "History Buff": "历史迷必看",
  "Saved for Now": "暂时收藏",
  "More from a Favorite Director": "更多心仪导演的作品",
  "Starring a Favorite": "心仪演员主演的作品",
  Collection: "合集",
  "No films found in this collection.": "此合集中未找到电影。",
  "Open the queue": "打开队列",
  "{title} will not come back in the Discovery Queue.": "{title} 将不再出现在发现队列中。",
  "American History": "美国历史",
  "Men of History": "历史人物",
  "Movies you've watched and shows you've made progress on stop appearing in the built-in Discover rows, using your Trakt history. Needs Trakt connected. Continue Watching is never touched.":
    "根据你的 Trakt 观看记录，已看过的电影和已有观看进度的剧集将不再出现在内置的“发现”内容行中。需要连接 Trakt。不会影响“继续观看”。",
  "List view": "列表视图",
  "In your watchlist": "在你的片单中",
  "In watchlist": "已在片单中",
  "Watched on Trakt": "已在 Trakt 上看过",
  "Paused on Simkl": "已在 Simkl 上暂停观看",
  "Trakt Comments": "Trakt 评论",
  "Open on Trakt": "在 Trakt 上打开",
  "Comments may take a moment to appear on Trakt": "评论可能需要片刻才会在 Trakt 上显示",
  History: "历史",
  "Harbor couldn't resolve a usable ID for this title. Add a TMDB key in Library settings or sign in to Stremio to broaden coverage.":
    "Harbor 无法为此条目解析出可用 ID。请在媒体库设置中添加 TMDB 密钥，或登录 Stremio 以扩大匹配范围。",
  "Brings in your library, watchlist, and installed addons.":
    "导入您的媒体库、待看列表和已安装的插件。",
  "update.downloadComplete": "下载完成",
  "update.download": "下载",
  "Addon order saved on this device": "插件顺序已保存在此设备上",
  "Sign in to sync your addons across devices": "登录以在设备间同步插件",
  "Saving to library": "正在保存到媒体库",
  "Your Stremio library + addons sync in untouched.": "你的 Stremio 媒体库和插件将原样同步。",
  "You can switch later in Settings under Library & metadata.":
    "之后可在“设置”的“媒体库与元数据”中切换。",
  "Library and addons will sync in once you're past setup.":
    "完成设置后，媒体库和插件将同步到 Harbor。",
  "Bring in your library": "导入你的媒体库",
  "Sign in to mirror your Continue Watching, watchlist, and any addons you've already curated. Optional; Harbor works fully signed-out.":
    "登录后可同步“继续观看”、片单和已配置的插件。此操作可选；不登录也能完整使用 Harbor。",
  "Your Discovery Queue": "你的发现队列",
  "Explore your queue": "探索你的队列",
  "Share collection": "分享合集",
  "Anyone with the link can open this collection once your Harbor server is live.":
    "Harbor 服务器上线后，任何获得链接的人都可以打开此合集。",
  "Paste this code into Harbor to open the collection.": "将此代码粘贴到 Harbor 中即可打开合集。",
  "The collection shows up as its own row you can reorder or hide from that page.":
    "该合集会显示为一个独立内容栏，你可以在该页面调整其顺序或将其隐藏。",
  "This collection is no longer here.": "此合集已不在这里。",
  "Couldn't load your Stremio collection. Nothing can be reordered safely without it.":
    "无法加载你的 Stremio 插件合集。没有合集数据就无法安全地调整顺序。",
  "Reload list": "重新加载列表",
  "Backed up. The current account order is saved in the Backups panel.":
    "已备份。账户当前的插件顺序已保存到“备份”面板。",
  "Couldn't save: the reordered list failed safety validation. Nothing was written.":
    "无法保存：重新排序后的列表未通过安全验证。未写入任何内容。",
  "Couldn't reach Stremio to confirm your collection. Nothing was written.":
    "无法连接 Stremio 以确认你的合集。未写入任何内容。",
  "Your addon collection changed on another device. Nothing was written.":
    "你的插件合集已在其他设备上更改。未写入任何内容。",
  "Stremio didn't confirm the save. Your collection may be unchanged. Retry will re-check before writing again.":
    "Stremio 未确认保存。你的合集可能没有变化。重试时会先重新检查，再尝试写入。",
  "Saved, but Harbor couldn't confirm the new order. Retry to re-check.":
    "已保存，但 Harbor 无法确认新顺序。请重试以重新检查。",
  "Stremio reports a different order than was saved.": "Stremio 报告的顺序与已保存的顺序不同。",
  "A safety copy of your addon order. One is saved automatically before Harbor writes any change, and you can save one yourself any time. The five most recent are kept.":
    "插件顺序的安全副本。Harbor 每次写入更改前都会自动保存一个，你也可以随时手动保存。系统会保留最近五个。",
  "+ Watchlist": "+ 片单",
  "Add {n} titles from your Harbor watchlist to Trakt? Trakt skips any it already has.":
    "要将 Harbor 片单中的 {n} 部作品添加到 Trakt 吗？Trakt 会跳过已有的作品。",
  "Add {n} titles from your Trakt watchlist to Harbor?":
    "要将 Trakt 片单中的 {n} 部作品添加到 Harbor 吗？",
  "Add a profile for someone else and everyone keeps their own Continue Watching, watch history, and progress.":
    "为其他人添加个人资料，每个人都能保留各自的“继续观看”、观看历史和进度。",
  "Add a TMDB key in Settings → Library to power this view.":
    "在“设置 → 媒体库”中添加 TMDB 密钥以启用此视图。",
  "Add a TMDB key in Settings → Library to search.":
    "在“设置 → 媒体库”中添加 TMDB 密钥以进行搜索。",
  "Add to watchlist": "添加到片单",
  "Added {n} to your Harbor watchlist": "已将 {n} 部作品添加到你的 Harbor 片单",
  "Authorize Harbor on Simkl": "在 Simkl 上授权 Harbor",
  "Authorize Harbor on Trakt": "在 Trakt 上授权 Harbor",
  Calendar: "日历",
  "Choose which Simkl rails appear on your home screen.": "选择要在主屏幕上显示的 Simkl 内容栏。",
  "Clear history": "清除历史记录",
  "Community comments from Trakt that appear on movie and show pages.":
    "来自 Trakt 社区的评论，会显示在电影和剧集页面上。",
  "Connect your Trakt account to see comments and reviews.":
    "连接你的 Trakt 账号以查看评论和影评。",
  "Connected to Simkl": "已连接到 Simkl",
  "Connected to Trakt": "已连接到 Trakt",
  "Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor. Safe to run again, Trakt skips anything it already has.":
    "将 Harbor 片单复制到 Trakt，或将 Trakt 片单导入 Harbor。可以安全地重复运行，Trakt 会跳过已有内容。",
  "Could not identify this title on Trakt.": "无法在 Trakt 上识别此条目。",
  "Couldn't load this list. Check the URL and try again.": "无法加载此列表。请检查 URL 后重试。",
  "Couldn't reach Trakt": "无法连接到 Trakt",
  "Couldn't reach Trakt. Check your connection and try again.":
    "无法连接到 Trakt。请检查网络连接后重试。",
  "Couldn't read your watchlist. Try again.": "无法读取你的片单。请重试。",
  "Display SIMKL Community Ratings": "显示 SIMKL 社区评分",
  "Display SIMKL community score badge on details pages.": "在详情页显示 SIMKL 社区评分徽章。",
  "Download the whole file while streaming": "流式播放时下载整个文件",
  "Download this build": "下载此版本",
  "Download this build's installer, then run it over your current copy":
    "下载此版本的安装程序，然后运行并覆盖当前安装。",
  "Everyone who uses this Harbor gets their own watch history, avatar, color, and optional PIN. Switch anytime.":
    "使用此 Harbor 的每个人都拥有各自的观看历史、头像、颜色和可选 PIN。可随时切换。",
  "Exit sync mode": "退出同步模式",
  "Export to Trakt": "导出到 Trakt",
  Favorite: "收藏",
  "Found {n}: {names}. Saved under the wrong id by the 0.9.65 bug, which breaks Continue Watching and Trakt marking.":
    "找到 {n} 个：{names}。由于 0.9.65 版本的错误，这些内容被保存到了错误的 ID 下，导致“继续观看”和 Trakt 标记失效。",
  "Full list": "完整列表",
  "Harbor keeps your MyAnimeList watch progress in sync.":
    "Harbor 会同步你的 MyAnimeList 观看进度。",
  "Import from Trakt": "从 Trakt 导入",
  "In your local library": "在你的本地媒体库中",
  "Live preview is on. Done and Save both keep what you've picked as your Custom theme. Reset reverts the editor to the saved palette.":
    "实时预览已开启。“完成”和“保存”都会将当前选择保留为自定义主题。“重置”会将编辑器恢复为已保存的配色。",
  "Local library": "本地媒体库",
  "Mark watched on Trakt": "在 Trakt 上标为已看",
  "Marks movies and shows across Home, the catalogs, and detail pages when a matching file already exists in your local library.":
    "当本地媒体库中已有匹配文件时，在首页、目录和详情页中标记对应的电影和节目。",
  "Mirror plays + ratings to Trakt.tv. Uses Trakt's device flow: enter a short code in your browser.":
    "将播放记录和评分同步到 Trakt.tv。使用 Trakt 的设备授权流程：在浏览器中输入短代码。",
  "Move your watchlist": "迁移你的片单",
  "Movies you've watched and shows you've made progress on stop appearing in the built-in catalog rows, using your local watch history (and Trakt if connected). Continue Watching is never touched.":
    "你看过的电影和已有观看进度的剧集将不再出现在内置目录栏中。此功能使用本地观看历史记录（如已连接 Trakt，也会使用其记录）。“继续观看”不受影响。",
  "No saved filters yet. Hit New filter to build one.":
    "暂无已保存的筛选器。点击“新建筛选器”创建一个。",
  "Options for the Library → Local tab: folders you scan from your own drive. When you export metadata, Harbor writes a Kodi-style .nfo and downloads artwork next to each file at the sizes below.":
    "“媒体库”→“本地”选项卡的设置：从你自己的硬盘中扫描的文件夹。导出元数据时，Harbor 会写入 Kodi 样式的 .nfo 文件，并按下方尺寸将图片下载到每个文件旁边。",
  "Pick a list to view it.": "选择一个列表即可查看。",
  "Pick up partly-watched episodes and movies at your saved spot. Anything watched past 80% always restarts. Turn this off to always start from the beginning, handy if you rewatch shows.":
    "从保存的位置继续播放未看完的剧集和电影。观看进度超过 80% 的内容始终会从头播放。关闭此项后所有内容都会从头播放，适合重看剧集。",
  "Plays + ratings sync from Harbor to Trakt.tv.": "播放记录和评分会从 Harbor 同步到 Trakt.tv。",
  Queue: "播放队列",
  "Rate on SIMKL": "在 SIMKL 上评分",
  "Read titles, ids, and any poster/logo/backdrop already saved next to your files. Missing images are filled from TMDB.":
    "读取标题、ID，以及已保存在文件旁的海报、Logo 和背景图。缺失的图片将从 TMDB 补充。",
  "Refresh list": "刷新列表",
  "Remove {n} items from your library? Files on your disk are not deleted.":
    "要从媒体库中移除 {n} 个项目吗？磁盘上的文件不会被删除。",
  "Remove from saved": "从已保存内容中移除",
  "Remove from watchlist": "从想看列表中移除",
  "Requesting code from Simkl…": "正在向 Simkl 请求代码…",
  "Requesting code from Trakt…": "正在向 Trakt 请求代码…",
  "Save sync": "保存同步设置",
  "Saved .nfo and artwork": "已保存 .nfo 和图片",
  "Saved {n} entries to {path}. Send us that file.":
    "已将 {n} 条记录保存到 {path}。请将该文件发送给我们。",
  "Scanning your library…": "正在扫描媒体库…",
  "Scrobble to SIMKL": "将观看记录同步到 SIMKL",
  "Sending to Trakt…": "正在发送到 Trakt…",
  "Sent {n} to Trakt": "已向 Trakt 发送 {n} 项",
  "Show a button on the detail page to mark a title or episode as watched. Syncs to Trakt and Simkl if connected.":
    "在详情页显示按钮，用于将影片或单集标记为已看。连接 Trakt 和 Simkl 后会同步。",
  "Show Simkl rails on Home": "在首页显示 Simkl 内容栏",
  "Show SIMKL score on cards": "在卡片上显示 SIMKL 评分",
  "Show Simkl Trending Today rail": "显示“Simkl 今日热门”内容栏",
  "Show the IMDb rating and synopsis on episodes across the list, grid, and panel layouts.":
    "在列表、网格和面板布局的单集中显示 IMDb 评分和剧情简介。",
  "Show Trakt score on cards": "在卡片上显示 Trakt 评分",
  "Show Up Next on Simkl rail": "在 Simkl 内容栏中显示“接下来播放”",
  "Sign in to Stremio first so Harbor knows which watchlist to sync.":
    "请先登录 Stremio，以便 Harbor 确定要同步哪个片单。",
  "Sign in to Stremio first. This reads the active profile's library.":
    "请先登录 Stremio。此操作会读取当前个人资料的媒体库。",
  "Sign in to Stremio first. This scans the active profile's library.":
    "请先登录 Stremio。此操作会扫描当前个人资料的媒体库。",
  SIMKL: "SIMKL",
  "SIMKL community rating. Works independently, no API key required.":
    "SIMKL 社区评分。可独立使用，无需 API 密钥。",
  "Step 1 · Open Simkl": "第 1 步 · 打开 Simkl",
  "Step 1 · Open Trakt": "第 1 步 · 打开 Trakt",
  "Sync options": "同步选项",
  "Sync Offset": "同步偏移量",
  "Sync your library, watch progress, and installed addons across every device.":
    "在所有设备间同步媒体库、观看进度和已安装的插件。",
  "Sync your MyAnimeList watch progress and list as you finish episodes.":
    "看完单集时，将观看进度和列表同步到 MyAnimeList。",
  "Text Sync": "文本同步",
  "That list is private or doesn't exist. Public lists only.":
    "该列表为私密列表或不存在。仅支持公开列表。",
  "This is in your local library": "此内容位于你的本地媒体库中",
  "This list is empty, or its items couldn't be matched.": "此列表为空，或无法匹配其中的项目。",
  "This list needs your {key} API key. Add it in Settings, then refresh.":
    "此列表需要你的 {key} API 密钥。请在设置中添加，然后刷新。",
  "Track everything you watch, see your watchlist, and get personalized recommendations on Harbor's home page. Free at trakt.tv.":
    "记录你观看的所有内容、查看片单，并在 Harbor 首页获取个性化推荐。可在 trakt.tv 免费使用。",
  Trakt: "Trakt",
  "Trakt account limit reached. Upgrade to Trakt VIP or trim your watchlist.":
    "已达到 Trakt 账户上限。请升级到 Trakt VIP 或精简片单。",
  "Trakt community rating as a percentage.": "以百分比显示 Trakt 社区评分。",
  "Trakt is having server trouble (HTTP {n}). Try again shortly.":
    "Trakt 服务器出现问题（HTTP {n}）。请稍后重试。",
  "Trakt is rate-limiting. Wait a minute and try again.":
    "Trakt 正在限制请求频率。请等待一分钟后重试。",
  "Trakt rejected the request (account locked or permission denied).":
    "Trakt 拒绝了请求（账户已锁定或权限被拒绝）。",
  "Trakt rejected the request (HTTP {n}).": "Trakt 拒绝了请求（HTTP {n}）。",
  "Trakt reported that authorization was denied. Try again if this was unintentional.":
    "Trakt 报告授权被拒绝。如果并非有意拒绝，请重试。",
  "Trakt sign-in expired. Reconnect Trakt in settings and try again.":
    "Trakt 登录已过期。请在设置中重新连接 Trakt，然后重试。",
  "Tune the size and corner radius of every poster across Home, Discover, and your library. The preview updates live.":
    "调整首页、发现和媒体库中所有海报的大小与圆角半径。预览会实时更新。",
  "Turn on to show the Trakt comments section on movies, shows, and episodes.":
    "开启后，在电影、剧集和单集中显示 Trakt 评论区。",
  "Waiting for Trakt…": "正在等待 Trakt…",
  "Waiting for you to authorize on simkl.com…": "正在等待你在 simkl.com 上授权…",
  "Waiting for you to authorize on trakt.tv…": "正在等待你在 trakt.tv 上授权…",
  "Watchlist badge": "片单徽标",
  "When a title is in your local library": "当影片位于你的本地媒体库中时",
  "Your library and watch progress sync here.": "你的媒体库和观看进度会在此同步。",
  "Your Trakt watchlist is empty, nothing to import.": "你的 Trakt 片单为空，没有可导入的内容。",
  "Your watchlist is empty, nothing to send.": "你的片单为空，没有可发送的内容。",
  "Add favorite": "添加收藏",
  "Could not reach the source list": "无法连接到来源列表",
  "Delete download": "删除下载内容",
  "Download cheat sheet": "下载速查表",
  "Download full API reference": "下载完整 API 参考文档",
  "Make one folder for your library.": "为你的漫画库创建一个文件夹。",
  "New downloads are saved here. Chapters you already saved stay where they are.":
    "新下载内容将保存到此处。已保存的章节仍保留在原位置。",
  "Remove favorite": "取消收藏",
  "Saved on your server": "已保存到您的服务器",
  "Saved on your server, reads instantly": "已保存到您的服务器，可即时读取",
  "That config is not valid. Check baseUrl, popularPath, list, chapters, and pages.":
    "该配置无效。请检查 baseUrl、popularPath、list、chapters 和 pages。",
  "That config is not valid. It needs baseUrl, popularPath, list (item + link), chapters (item + link), and pages (image).":
    "该配置无效。需要包含 baseUrl、popularPath、list（item + link）、chapters（item + link）和 pages（image）。",
  "Your sources are saved, we just could not load their details. Check your connection and try again.":
    "您的来源已保存，但无法加载其详细信息。请检查网络连接后重试。",
  "if the series page shows only the latest few chapters and the full list lives on another URL, this rewrites the series URL to it.":
    "如果作品页面只显示最近几话，而完整列表位于另一个 URL，此项会将作品 URL 重写为该 URL。",
  "list view": "列表视图",
  "Couldn't load this collection": "无法加载此合集",
  "How cards look across Home, Discover, and your library. The preview updates live.":
    "卡片在首页、发现和媒体库中的外观。预览会实时更新。",
  "Installed and detected. Harbor found the native svpflow plugins and VapourSynth script library.":
    "已安装且已检测到。Harbor 已找到原生 svpflow 插件和 VapourSynth 脚本库。",
  "Nothing was saved.": "未保存任何内容。",
  "Sign in to your Harbor account first. Imported ratings are saved to your profile.":
    "请先登录你的 Harbor 账号。导入的评分会保存到你的个人资料中。",
  "{n} ratings were saved before you stopped.": "你停止前已保存 {n} 条评分。",
  "Account & sync": "账号与同步",
  "Blur Trakt comments by default": "默认模糊 Trakt 评论",
  "Bring in your Stremio library": "导入你的 Stremio 媒体库",
  "Changes not saved to your Harbor account yet": "更改尚未保存到你的 Harbor 账户",
  "Changes you make below will be saved on this computer, but they will not reach your TV. This is a fault in Harbor, not something you did.":
    "你在下方所做的更改会保存在这台电脑上，但不会同步到电视。这是 Harbor 的故障，并非你的操作有误。",
  "Clears the saved URL so you can point Harbor at another relay.":
    "清除已保存的 URL，以便将 Harbor 指向其他中继。",
  "Comments and reviews on detail pages stay blurred until you reveal them, even when they are not tagged as spoilers. This one switch covers Trakt and Letterboxd.":
    "详情页上的评论和影评会保持模糊，直到你主动显示，即使它们未标记为剧透。此开关同时适用于 Trakt 和 Letterboxd。",
  "Could not reach the extension list. Check your server connection and try again.":
    "无法获取扩展列表。请检查服务器连接后重试。",
  "Couldn't load your library. Try refreshing.": "无法加载你的媒体库。请尝试刷新。",
  "Delete {name}? Saved filters cannot be brought back.": "删除 {name}？已保存的筛选条件无法恢复。",
  "Download failed. Check your connection and try again.": "下载失败。请检查网络连接后重试。",
  "Download shader": "下载着色器",
  "Everything here took effect straight away, and it is saved on this device.":
    "此处的所有更改均已立即生效，并保存在此设备上。",
  "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.":
    "你选择的所有内容都会保存到一个文件中。日后恢复时只会影响该文件中包含的内容。你的 Stremio 登录信息始终不会导出。",
  "Extra scores are dropped from the end of the chip. Turn scores on or off in the list above.":
    "多余评分会从标签末尾移除。可在上方列表中开启或关闭评分。",
  "How long a saved frame sticks around before the oldest roll off.":
    "保存的画面保留多久，之后最早的画面会依次移除。",
  "I have saved my recovery code": "我已保存恢复代码",
  "In order: {list}": "按顺序：{list}",
  "In sync": "已同步",
  "Letterboxd, Trakt, Metacritic, and audience scores.":
    "Letterboxd、Trakt、Metacritic 和观众评分。",
  "Library, watch progress, and addons are syncing.": "媒体库、观看进度和插件正在同步。",
  "My collection": "我的收藏",
  "New versions are ready for themes you saved.": "您保存的主题已有新版本。",
  "Nobody has shared a collection yet.": "还没有人分享合集。",
  "Not signed in to Stremio. Your library stays local.":
    "尚未登录 Stremio。您的媒体库仍保存在本地。",
  "Nothing on your TV changes until you confirm you have saved this.":
    "在您确认已保存此设置之前，电视上的任何内容都不会改变。",
  "Nudge the daily Home rows toward your region and languages so local releases surface instead of the same worldwide list. Turn it off to see the unweighted picks.":
    "根据您的地区和语言调整每日首页内容行的推荐权重，优先呈现本地新作，而不是总显示相同的全球榜单。关闭后可查看未加权的精选内容。",
  "Open Trakt profile": "打开 Trakt 个人资料",
  "Picks up at your saved spot instead of the start.": "从保存的位置继续，而不是从头开始。",
  'Posters, logos, and title art load in the first available language from this list. "Original" uses the title\'s own language. Needs a TMDB key.':
    "海报、徽标和标题图会优先使用此列表中首个可用的语言加载。“原始语言”会使用作品自身的语言。需要 TMDB 密钥。",
  "Press Play and Harbor picks the source itself instead of opening the list.":
    "按下“播放”后，Harbor 会自行选择片源，而不会打开列表。",
  "Publish a theme, share a list, keep both when you reinstall.":
    "发布主题、分享片单，并在重新安装后保留两者。",
  "Re-download": "重新下载",
  "Rotten Tomatoes, Metacritic, Letterboxd, Trakt and Simkl scores on the TV need an MDBList key entered on the TV.":
    "电视端的 Rotten Tomatoes、Metacritic、Letterboxd、Trakt 和 Simkl 评分需要在电视上输入 MDBList 密钥。",
  "Saved on this device": "已保存在此设备上",
  "Saved on this device. Another Harbor install starts fresh.":
    "已保存在此设备上。其他 Harbor 实例将从全新状态开始。",
  "Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.":
    "已于 {when} 从 Harbor {app} 保存。你的 Stremio 登录状态不受影响。",
  "Search your library": "搜索你的媒体库",
  "See every TVDB list": "查看所有 TVDB 列表",
  "Shader library": "着色器库",
  "Sign in to Stremio or connect Trakt in Settings to see what you have been watching.":
    "登录 Stremio 或在设置中连接 Trakt，即可查看你的观看记录。",
  "Sign in to Stremio or connect Trakt in Settings to see your library here.":
    "登录 Stremio 或在设置中连接 Trakt，即可在此查看你的媒体库。",
  "Signed in. Your library is on the TV.": "已登录。你的媒体库现已显示在电视上。",
  "Signing the TV in to Stremio, Trakt, AniList and the metadata keys. Scan the code with your phone from the TV itself.":
    "正在电视上登录 Stremio、Trakt 和 AniList，并添加元数据密钥。请直接用手机扫描电视上的代码。",
  "Simkl community scores on detail pages, and your own star ratings.":
    "在详情页显示 Simkl 社区评分和你自己的星级评分。",
  "Simkl connection": "Simkl 连接",
  "Skip this and Harbor still works. Your library just stays local.":
    "跳过后 Harbor 仍可正常使用，只是你的媒体库将仅保存在本地。",
  "Sources & library": "来源与媒体库",
  "Stremio library signed in": "已登录 Stremio 媒体库",
  "Strips the source list back to name and size.": "将来源列表精简为仅显示名称和大小。",
  "Subtitles: {list}": "字幕：{list}",
  "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.":
    "切换为共享模式？此个人资料将使用 {name} 的媒体库、观看列表和插件。其自身数据会保留，但在切换回来前将被隐藏。",
  "Sync everywhere": "在所有设备上同步",
  "Sync your profile, themes, lists and friends. You can do this any time.":
    "同步你的个人资料、主题、列表和好友。可随时进行。",
  "TVDB list": "TVDB 列表",
  "That's every TVDB list we could find.": "这就是我们能找到的全部 TVDB 列表。",
  "That's every TVDB list we could reach. Some are unavailable right now.":
    "这就是我们能访问的全部 TVDB 列表。部分列表目前不可用。",
  "That's every shared collection right now.": "这就是目前所有共享收藏集。",
  "The key is saved on this device only.": "密钥仅保存在此设备上。",
  "This build cannot carry TV settings to the account yet. Everything on this page saves on this computer and will go up the moment the sync section names are enabled.":
    "此版本尚无法将电视设置同步到账户。此页面上的所有设置都会保存在此电脑上，并会在相关同步项目启用后立即上传。",
  "This collection is empty.": "此收藏集为空。",
  "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.":
    "此文件会恢复其中保存的 {n} 个条目，并仅替换设置中的相应部分。未包含的内容将保持原样。",
  "Trakt connection": "Trakt 连接",
  "Upcoming episodes and movies from your Simkl watching and plan-to-watch lists":
    "Simkl 在看和计划观看列表中即将上线的剧集与电影",
  "Watched history": "观看历史",
  "Watchlist ({n})": "片单（{n}）",
  "Which Simkl lists show up as rows on your home screen.":
    "哪些 Simkl 列表会作为内容栏显示在主屏幕上。",
  "While auto-sync is on": "开启自动同步时",
  "You have not made a collection yet.": "你还没有创建合集。",
  "Your Continue Watching, your watchlist and your addons, on this TV.":
    "你在这台电视上的“继续观看”、片单和插件。",
  "Your Continue Watching, your watchlist and your addons.": "你的“继续观看”、片单和插件。",
  "Your collection": "你的收藏",
  "Your library": "你的媒体库",
  "Your library is aboard.": "你的媒体库已就位。",
  "{label}, sync options": "{label}，同步选项",
  "Saved on your device, but it couldn't be uploaded for others to see. Try again.":
    "已保存到你的设备，但无法上传供他人查看。请重试。",
  "Auto sync": "自动同步",
  "Cancel sync": "取消同步",
  "Choose one season package. Harbor will match and download every available episode from it.":
    "请选择一个整季资源包。Harbor 会匹配并下载其中所有可用剧集。",
  "Delete this collection?": "要删除此合集吗？",
  "Edit collection": "编辑合集",
  "Enter your username and the recovery key you saved. We'll set a new password and sign you in.":
    "输入你的用户名和已保存的恢复密钥。我们会设置新密码并让你登录。",
  "Fills the backdrop when someone opens the collection.": "他人打开合集时，此图片会铺满背景。",
  "Friends list": "好友列表",
  "In this collection": "此合集中",
  "Make your first collection": "创建你的第一个合集",
  "Name this collection": "为此合集命名",
  "New collection": "新建合集",
  "One free account for your handle, themes, and sync.":
    "一个免费账号，涵盖你的用户名、主题和同步功能。",
  "Saved from @{handle}. You can share their link, but only they can list it in the community.":
    "已从 @{handle} 保存。你可以分享对方的链接，但只有对方能将其列入社区。",
  "Saved to your collections": "已保存到你的合集",
  "Show a featured banner at the top of your library": "在媒体库顶部显示精选横幅",
  "This collection does not have any titles in it right now.": "此合集目前没有任何作品。",
  "Turn off auto-sync": "关闭自动同步",
  "Untitled collection": "未命名合集",
  "View collection page": "查看合集页面",
  "When people share a collection it shows up here. Build one you love and share it, that is how it starts.":
    "当有人分享合集时，它就会显示在这里。创建一个你喜欢的合集并分享出去，一切就从这里开始。",
  "Your Letterboxd watchlist is empty.": "你的 Letterboxd 想看列表为空。",
  "Loading your library...": "正在加载你的媒体库…",
  "Nothing saved yet. Add a title from any details page.":
    "尚未保存任何内容。可从任意详情页添加作品。",
  "Your watchlist is empty.": "你的观看列表为空。",
  "Sync point {n}": "同步点 {n}",
  "Could not queue these episodes.": "无法将这些剧集加入队列。",
  "Download episode by episode": "逐集下载",
  "Add {n} titles from your Harbor watchlist to Trakt? Trakt skips any it already has.#one":
    "要将 Harbor 片单中的 {n} 个条目添加到 Trakt 吗？Trakt 会跳过已有条目。",
  "Add {n} titles from your Harbor watchlist to Trakt? Trakt skips any it already has.#few":
    "要将 Harbor 片单中的 {n} 个条目添加到 Trakt 吗？Trakt 会跳过已有条目。",
  "Add {n} titles from your Trakt watchlist to Harbor?#one":
    "要将 Trakt 片单中的 {n} 个条目添加到 Harbor 吗？",
  "Add {n} titles from your Trakt watchlist to Harbor?#few":
    "要将 Trakt 片单中的 {n} 个条目添加到 Harbor 吗？",
  "Remove {n} items from your library? Files on your disk are not deleted.#one":
    "要从媒体库中移除 {n} 个条目吗？不会删除磁盘上的文件。",
  "Remove {n} items from your library? Files on your disk are not deleted.#few":
    "要从媒体库中移除 {n} 个条目吗？不会删除磁盘上的文件。",
  "Saved {n} entries to {path}. Send us that file.#one":
    "已将 {n} 条记录保存到 {path}。请将该文件发送给我们。",
  "Saved {n} entries to {path}. Send us that file.#few":
    "已将 {n} 条记录保存到 {path}。请将该文件发送给我们。",
  "Search {n} favorite#one": "搜索 {n} 个收藏项",
  "Search {n} favorite#few": "搜索 {n} 个收藏项",
  "{label} · {n} collection#one": "{label} · {n} 个合集",
  "{label} · {n} collection#few": "{label} · {n} 个合集",
  "Download and run the installer to finish updating. If it keeps failing, run it as administrator once.":
    "下载并运行安装程序以完成更新。如果仍然失败，请尝试以管理员身份运行一次。",
  "EPUB saved": "EPUB 已保存",
  "Add a series to auto-download": "添加剧集以自动下载",
  "Auto-download": "自动下载",
  "download error": "下载错误",
  "Resume download": "继续下载",
  "Saved movies, episodes, and eBooks for offline use": "已保存供离线使用的电影、剧集和电子书",
  "Or set a series to auto-download": "或将剧集设为自动下载",
  "Bring a server-rendered library aboard with your own source configuration.":
    "使用你自己的来源配置，接入由服务器渲染的书库。",
  "living library.": "鲜活书库。",
  "01 · Collection": "01 · 收藏",
  "Library sources": "书库来源",
  "Library intelligence": "书库智能服务",
  "Saved locally; AniList sync is pending": "已保存到本地；正在等待同步到 AniList",
  "No saved passages yet.": "暂无已保存的段落。",
  "Saved to this passage": "已保存到此段落",
  "{count} books saved to your shelf": "书架中已保存 {count} 本书",
  "{count} books saved": "已保存 {count} 本书",
  "Saved to your favorites": "已保存到收藏夹",
  "Add to your watchlist": "添加到想看列表",
  "Connect to your computer to manage your library.": "连接到你的电脑以管理媒体库。",
  "Saved to {service} as {status}": "已在 {service} 中保存为 {status}",
  "This collection has no titles to show yet.": "此合集暂时没有可显示的作品。",
  "Clip saved to {path}": "剪辑已保存到 {path}",
  "Screenshot saved to {path}": "截图已保存到 {path}",
  "GIF saved to {path}": "GIF 已保存到 {path}",
  "Download interrupted": "下载中断",
  "No saved profiles yet.": "还没有已保存的配置方案。",
  "I've saved my recovery code somewhere safe.": "我已将恢复代码妥善保存在安全的位置。",
  "Re-sync from your Harbor profile picture": "从你的 Harbor 头像重新同步",
  "Your icons, in everyone's library": "让你的图标进入每个人的图标库",
  "Appears in the community library once approved.": "获批后会显示在社区资源库中。",
  "Thanks for sharing. It'll appear in the library once it's approved. You can manage it any time from your uploads.":
    "感谢分享。获批后，它将显示在资源库中。你可以随时在“我的上传”中管理。",
  "Every theme is sandboxed, scanned, and reviewed before it reaches the library, so you can try any look without a second thought.":
    "每个主题都在沙盒中运行，并会经过扫描和审核后才进入资源库，因此你可以放心尝试任何外观。",
  "Could not reach the bundle library.": "无法连接到素材包资源库。",
  "Could not reach the theme library.": "无法连接到主题资源库。",
  "Your theme, in everyone's library": "让你的主题进入每个人的资源库",
  "Download {file}": "下载 {file}",
  "The settings page has a list down the left. Click API near the bottom.":
    "设置页面左侧有一个列表。点击接近底部的 API 选项。",
  "Sends the context above straight to the Harbor team. No keys or library data.":
    "将上述上下文直接发送给 Harbor 团队，不含任何密钥或媒体库数据。",
  "Saved to your library.": "已保存到你的媒体库。",
  "In My List": "已在我的列表中",
  "Add to My List": "添加到我的列表",
  "Your library lives on Harbor. Connect to your computer and it shows up here.":
    "你的媒体库在 Harbor 中。连接到电脑后，就会显示在这里。",
  "A favorite title or one of your themes will appear here": "收藏的影片或您的某个主题将显示在这里",
  "Adds Letterboxd and Trakt community ratings to detail pages, covering what OMDb misses.":
    "在详情页添加 Letterboxd 和 Trakt 社区评分，补充 OMDb 未涵盖的内容。",
  "Once saved, every poster gets re-rendered with IMDb, Rotten Tomatoes, and Metacritic stamped on it.":
    "保存后，每张海报都会重新渲染，并印上 IMDb、Rotten Tomatoes 和 Metacritic 评分。",
  "Added to library": "已添加到媒体库",
  "1 download": "1 次下载",
  "Release to add it to your library": "松开即可添加到媒体库",
  "Every theme you share gets a private owner token. On the device where you shared it, Harbor saved it automatically, so those themes show up right here to claim in one tap. To claim one from a different device, paste that token below. New shares now bind straight to your account, so you will not need this again.":
    "你分享的每个主题都有一个私密所有者令牌。在分享该主题的设备上，Harbor 会自动保存令牌，因此这些主题会显示在这里，轻点一下即可认领。要认领其他设备上分享的主题，请在下方粘贴对应令牌。现在新分享的主题会直接绑定到你的账号，因此以后无需再执行此操作。",
  "Loading history": "正在加载历史记录",
  "No previous versions yet. Your next update starts the history.":
    "暂无旧版本。下次更新后将开始记录版本历史。",
  "Open the library, hit Share a theme, and your first publication shows up here with its review status, downloads, and version history.":
    "打开媒体库，点击“分享主题”。首次发布后，这里将显示审核状态、下载量和版本历史。",
  "Paused on Trakt": "已在 Trakt 上暂停观看",
  "On Letterboxd": "在 Letterboxd 上查看",
  "Open Letterboxd profile": "打开 Letterboxd 个人资料",
  "Connect Letterboxd": "连接 Letterboxd",
  "No Letterboxd lists shared yet": "尚未分享任何 Letterboxd 列表",
  "Link Letterboxd and the films and lists you keep there show up right here.":
    "关联 Letterboxd，你在那里收藏的电影和列表就会显示在这里。",
  "Show your Letterboxd card": "显示你的 Letterboxd 卡片",
  "Off by default. Shows your Letterboxd name, lists and film counts on your profile for anyone who visits. Manage the connection itself in Settings, Letterboxd.":
    "默认关闭。启用后，任何访问者都能在你的个人资料中看到 Letterboxd 名称、列表和电影数量。连接本身可在“设置”的“Letterboxd”中管理。",
};

export default library;
