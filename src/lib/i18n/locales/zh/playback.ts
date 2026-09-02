const playback: Record<string, string> = {
  "Cast · {n}": "演员 · {n}",
  "Download Subtitle": "下载字幕",
  "Pause · Space": "暂停 · Space",
  "Seek back": "快退",
  "Seek forward": "快进",
  "Preparing stream": "正在准备视频流",
  "Auto-loading the best stream": "正在自动加载最佳视频流",
  "Loading subtitle addons…": "正在加载字幕插件…",
  "Stream failed to load": "视频流加载失败",
  "Stream is taking a while": "视频流加载时间较长",
  "Switch stream": "切换视频流",
  "Audio tracks": "音轨",
  "Audio languages": "音频语言",
  "Subtitle languages": "字幕语言",
  "Subtitle appearance": "字幕外观",
  "Subtitle color {color}": "字幕颜色 {color}",
  "More subtitle options": "更多字幕选项",
  "Download subtitle to disk": "将字幕下载到磁盘",
  "Forced subs with native audio": "原声时使用强制字幕",
  "Playback speed": "播放速度",
  "Playback speed {label}": "播放速度：{label}",
  "Draw on video": "在视频上绘制",
  "No audio: this stream's audio format (likely Dolby or DTS) is not supported by the HTML5 engine.":
    "无音频：HTML5 引擎不支持此视频流的音频格式（可能是 Dolby 或 DTS）。",
  "This file is flagged as not web-playable. Try the mpv backend in Settings or pick another stream.":
    "此文件被标记为无法在网页中播放。请在“设置”中尝试使用 mpv 后端，或选择其他视频流。",
  "Casting comes with the mpv backend": "投屏功能仅适用于 mpv 后端",
  "Cast to TV or speaker": "投屏到电视或扬声器",
  "Subtitles are baked into the picture so they always show. Re-encodes the video.":
    "字幕将嵌入画面并始终显示，此操作会重新编码视频。",
  "Add a TMDB key in Settings to see the cast for every title.":
    "在“设置”中添加 TMDB 密钥，即可查看所有影片的演员阵容。",
  "Cast information isn't available for this title.": "此影片暂无演员信息。",
  " · left the video": " · 已离开视频",
  "Any quality": "任意画质",
  "Audio bitrate": "音频比特率",
  "Audio codec": "音频编解码器",
  "Audio track": "音轨",
  "Cancel autoplay": "取消自动播放",
  Cast: "投屏",
  "Cast to a device": "投屏到设备",
  "Couldn't load that subtitle file. Try another.": "无法加载该字幕文件。请尝试其他文件。",
  "Does this stream look right?": "此视频流看起来正常吗？",
  "Download video": "下载视频",
  "External subtitle": "外部字幕",
  "Instant Play: clicking Play queues the next stream automatically.":
    "即时播放：点击播放会自动将下一个视频流加入队列。",
  "Local subtitle": "本地字幕",
  "Manual mode: clicking Play opens the source picker here.":
    "手动模式：点击播放会在此处打开来源选择器。",
  "Playback stats · press I to hide": "播放统计 · 按 I 隐藏",
  "Saved as .ts (works in mpv, VLC, ffmpeg)": "已保存为 .ts（适用于 mpv、VLC、ffmpeg）",
  "Subtitle track": "字幕轨道",
  "The host starts playback for the whole room.": "房主会为整个房间开始播放。",
  "This file has one audio track.": "此文件只有一条音轨。",
  "Track switching isn't supported on the current engine. The file's default audio is playing.":
    "当前引擎不支持切换音轨。正在播放文件的默认音轨。",
  "Use mpv engine": "使用 mpv 引擎",
  "Video bitrate": "视频比特率",
  "Video codec": "视频编解码器",
  "Volume down": "降低音量",
  "Volume up": "提高音量",
  "Wrong episode or quality?": "集数或画质有误？",
  "Your style is overriding the embedded subtitle's own styling":
    "你的样式正在覆盖内嵌字幕自身的样式",
  "mpv is required for recording. Install mpv and restart Harbor.":
    "录制需要 mpv。请安装 mpv 并重新启动 Harbor。",
  "Show as second subtitle": "设为第二字幕显示",
  "Stop showing as second subtitle": "不再显示为第二字幕",
  "Subtitle FPS": "字幕 FPS",
  "Measure this subtitle against speech and correct delay and gradual drift together.":
    "将此字幕与语音进行比对，同时校正延迟和逐渐产生的偏移。",
  "Automatic timing correction requires an external text subtitle.":
    "自动时间轴校正需要外部文本字幕。",
  "Subtitle source FPS": "字幕源 FPS",
  "Choose the frame rate the subtitle was authored for.": "选择制作此字幕时使用的帧率。",
  "Auto (match video)": "自动（匹配视频）",
  "Custom subtitle FPS": "自定义字幕 FPS",
  "Apply custom subtitle FPS": "应用自定义字幕 FPS",
  "Video FPS": "视频 FPS",
  "Couldn't apply subtitle FPS. Try again.": "无法应用字幕 FPS。请重试。",
  "Select a subtitle track first.": "请先选择字幕轨道。",
  "Subtitle FPS is only available with the libmpv player.": "字幕 FPS 仅适用于 libmpv 播放器。",
  "Subtitle FPS conversion is only available for text-based subtitles.":
    "字幕 FPS 转换仅适用于文本字幕。",
  "Subtitle FPS is unavailable while a secondary subtitle is active.":
    "启用第二字幕时，字幕 FPS 不可用。",
  "Video FPS is unavailable.": "视频 FPS 不可用。",
  "Subtitle FPS is unavailable in this libmpv runtime.": "此 libmpv 运行时不支持字幕 FPS。",
  "Turn off Auto Sync before changing subtitle FPS.": "更改字幕 FPS 前请关闭自动同步。",
  "Resize subtitle menu": "调整字幕菜单大小",
  "Subtitle details": "字幕详情",
  "Open subtitle details": "打开字幕详情",
  Quality: "质量",
  "Couldn't save the synced subtitle. Try again.": "无法保存已同步的字幕。请重试。",
  "Connect any IPTV provider. Channels are sorted by category, EPG is pulled automatically when your provider supplies it, and playback runs through native libmpv.":
    "可连接任意 IPTV 提供商。频道按分类排序；如果提供商提供 EPG，系统会自动获取；播放则通过原生 libmpv 进行。",
  "HEVC, HDR, TrueHD, plus real subtitle and audio menus.":
    "支持 HEVC、HDR、TrueHD，并提供完整的字幕和音轨菜单。",
  "Pick channels into the grid below. Audio follows the highlighted tile.":
    "将频道选入下方网格。音频来自高亮显示的画面。",
  "Local playback preference (Ask / Play local / Stream)":
    "本地播放偏好（询问 / 播放本地文件 / 播放源）",
  "Codec filter": "编解码器筛选",
  "Audio filter": "音频筛选",
  "Short seek back": "短距离快退",
  "Short seek forward": "短距离快进",
  "Normalize embedded subtitle size": "统一内嵌字幕大小",
  "SUBDL subtitle source": "SUBDL 字幕源",
  "Subsource subtitle source": "Subsource 字幕源",
  "Auto-apply audio-derived sync fixes": "自动应用基于音频的同步修正",
  "Poster image quality": "海报图片质量",
  Codec: "编解码器",
  "Only streams already in your debrid library.": "仅显示已在你的 debrid 库中的播放源。",
  "Excludes direct and debrid streams with no seeders.": "排除没有做种者的直链和 debrid 播放源。",
  "No dimensions set. This filter matches every stream.":
    "未设置任何维度。此筛选器会匹配所有播放源。",
  "Last source wasn't actually cached on your debrid yet. Trying another.":
    "上一个片源实际上尚未缓存到你的 debrid。正在尝试其他片源。",
  "A live preview of your player. Open the editor to move, hide, or reorder any control.":
    "播放器的实时预览。打开编辑器即可移动、隐藏任意控件或调整其顺序。",
  "Adds a timer button next to Downloads. Set a time or episode limit from anywhere; playback pauses when it runs out.":
    "在“下载”旁添加计时器按钮。可随时设置时间或集数限制；达到限制后会暂停播放。",
  "After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Harbor keeps picking one for you automatically.":
    "选择片源后显示字幕选择器，以便在视频开始前指定字幕轨道和语言。此功能默认关闭；关闭时 Harbor 会自动为你选择。",
  "Build a named quality preference once and set it active. The picker prefers streams that match it, including the instant pick, and falls back to the next best source when nothing matches. Each filter ANDs its dimensions and ignores any you leave blank.":
    "创建一个命名的画质偏好并将其设为当前偏好。选择器会优先选择与其匹配的播放源，包括即时选择；如果没有匹配项，则回退到次优播放源。每个筛选器会对其各项条件执行“且”匹配，并忽略留空的条件。",
  "Choose subtitles before playback": "播放前选择字幕",
  "Enable TV navigation above to use focus navigation in the player.":
    "请先在上方启用电视端导航，才能在播放器中使用焦点导航。",
  "Flags anime with an English dub. Also tags dub / sub / dual on stream sources.":
    "标记带英语配音的动漫，并在流媒体源上标注配音/字幕/双版本。",
  "Force player menus and panels to pure black, ignoring your theme tint.":
    "强制播放器菜单和面板使用纯黑色，忽略主题色调。",
  "Harbor will not start the torrent engine, contact trackers, or run DHT. Use this if you only want debrid and direct links. Turn off to re-enable torrent streaming.":
    "Harbor 不会启动种子引擎、连接 Tracker 或运行 DHT。如果你只想使用 debrid 和直链，请启用此项。关闭即可重新启用种子流式播放。",
  "Home hero audio": "首页焦点推荐音频",
  "How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "预告片播放的清晰度。“自动”会根据连接速度调整，“观看预告片”按钮默认选择 1080p。选择 1080p 或“最佳”（片源支持时最高 4K）可强制使用更高画质。1080p 和“最佳”会使用内置 ffmpeg 合并独立的视频与音频，因此启动会稍慢。",
  "Optional overlays that appear over the video.": "显示在视频画面上的可选叠加层。",
  "Pick a source once and Harbor keeps playing the rest of that season from the same release, no re-picking. Works best with a debrid season pack. For anime it locks the whole series to that release.":
    "选择一次片源后，Harbor 会继续从同一资源版本播放该季剩余剧集，无需再次选择。搭配 debrid 季包效果最佳。对于动漫，则会将整部系列锁定为该资源版本。",
  "Play a short sound when changing the player volume. Off by default.":
    "更改播放器音量时播放简短提示音。默认关闭。",
  "Player style": "播放器样式",
  "Player volume sounds": "播放器音量提示音",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer. You can also use the phone remote to control playback and cast to another device on this machine.":
    "将当前安装的 Harbor 作为 Web 应用提供给同一网络中的设备。你可以在手机、笔记本电脑或电视浏览器上打开并登录，内容会通过这台电脑播放。还可使用手机遥控器控制播放，并投屏到此电脑上的其他设备。",
  "Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they don't cover subtitles.":
    "使用键盘暂停或继续播放时显示播放器控件。关闭后控件将保持隐藏，避免遮挡字幕。",
  "Sound effects volume": "音效音量",
  "Subtle audio feedback as you navigate and click. Off by default; pick a style to turn it on.":
    "导航和点击时提供细微的声音反馈。默认关闭；选择一种样式即可开启。",
  "TV navigation in player": "播放器中的电视导航",
  "The badge that appears over the player when an episode syncs to your tracker.":
    "剧集同步到你的追踪器时，播放器上显示的徽章。",
  "The little 4K, HDR, codec, and audio chips that ride along each stream in the play picker.":
    "播放源选择器中每个播放源旁显示的 4K、HDR、编解码器和音频小标签。",
  "Torrents are disabled. Uncached streams will not play unless they come from a debrid service or a direct link. To use torrents, toggle this off.":
    "种子功能已禁用。除非来自 debrid 服务或直接链接，否则未缓存的播放源将无法播放。要使用种子，请关闭此选项。",
  "Turn off to hide the sync badge during playback.": "关闭后，播放期间将隐藏同步徽章。",
  "Use arrows and Select/Space to move focus between player controls. Turn this off to keep arrows for seeking and Space for play/pause.":
    "使用方向键和 Select/Space 在播放器控件间移动焦点。关闭后，方向键仍用于跳转，Space 仍用于播放/暂停。",
  "When off, a torrent stops the moment you close or switch the stream, so nothing keeps downloading in the background. Turn on to let it keep going after you leave; manage or pause those from the Downloads tab.":
    "关闭后，一旦关闭或切换播放源，种子任务会立即停止，不会继续在后台下载。开启后，离开后仍会继续下载；可在“下载”标签页中管理或暂停这些任务。",
  "Your own badges, matched against the stream's name with a pattern. Great for release groups, providers, or anything the built-in badges don't cover. Imported packs land here too.":
    "使用模式匹配播放源名称的自定义徽章。非常适合发布组、提供商或内置徽章未涵盖的任何内容。导入的包也会显示在这里。",
  "Full quality hero image": "全画质焦点横幅图片",
  "Sets the language of Harbor's own interface: menus, buttons, and labels. Arabic switches the layout to right to left. This is separate from subtitle and metadata languages below.":
    "设置 Harbor 自身界面的语言，包括菜单、按钮和标签。阿拉伯语会将布局切换为从右到左。这与下方的字幕和元数据语言设置相互独立。",
  "This sets the interface, metadata, subtitle, and audio languages to match.":
    "此操作会将界面、元数据、字幕和音频语言设为一致。",
  "Used for streaming availability and the Now Playing release window. Pick a country and Harbor can match the interface, metadata, and subtitle languages to it.":
    "用于流媒体可用性和“正在上映”的上映时间范围。选择一个国家后，Harbor 可使界面、元数据和字幕语言与之匹配。",
  "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.":
    "Harbor 仍会查找并加载字幕，让你可以在播放器中一键启用，但不会自动开启字幕。",
  "When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.":
    "当文件自带字幕轨时，保持选中该字幕轨，而不切换到下载的字幕。内嵌字幕轨通常同步得最准确。",
  "When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.":
    "当音频语言已与字幕语言一致时，选择强制字幕轨（仅包含外语对白和标识），而不是完整字幕。如果文件没有强制字幕轨，则保持字幕关闭。",
  "Hides streams with no detected preferred language. Multi-audio releases count as a match.":
    "隐藏未检测到首选语言的视频流。多音轨版本也视为匹配。",
  "When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.":
    "播放开始时，Harbor 会自动查找并加载这些语言之一的字幕，无需手动搜索。系统会采用第一个可用的匹配项，因此请将主要语言放在首位。",
  "Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.":
    "关键词之间用逗号分隔。自动选择时会跳过名称与任一关键词匹配的音频轨或字幕轨。你仍可在播放器中手动选择这些轨道。",
  "When a release ships multiple audio tracks, Harbor selects the first match from this list.":
    "当一个版本包含多个音轨时，Harbor 会选择此列表中第一个匹配的音轨。",
  "Connect your Trakt account to scrobble playback, sync your watchlist, and pull personalized recommendations.":
    "连接 Trakt 账户，以自动记录播放、同步稍后观看列表并获取个性化推荐。",
  "How Harbor finds and resolves playable streams. Debrid keys and addon installs live here.":
    "Harbor 查找并解析可播放视频流的方式。Debrid 密钥和插件安装均在此处管理。",
  "Which audio and subtitle languages rank first in stream lists.":
    "视频流列表中优先显示的音频和字幕语言。",
  Playback: "播放",
  "Debrid services": "Debrid 服务",
  "Debrid-Link API key": "Debrid-Link API 密钥",
  "Stream safety filter": "播放源安全筛选",
  "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.":
    "“精简”模式会显示首选结果、画质卡片和抽屉列表。“Stremio”模式则按插件分组显示扁平列表，不进行评分。",
  "Stream format chips": "播放源格式标签",
  "The little 4K · HDR · codec · audio chips that ride along each stream in the play picker.":
    "播放选择器中每个播放源旁的 4K · HDR · 编解码器 · 音频小标签。",
  "No filtering. Every stream every addon returns shows up, including obvious junk. You'll be on your own.":
    "不进行筛选。显示所有插件返回的全部播放源，包括明显的垃圾结果。你需要自行判断。",
  "Default. Top pick at the top, quality tiles, and an All-Sources drawer. Harbor scores and ranks results.":
    "默认。顶部显示首选结果，并提供画质卡片和“全部来源”抽屉。Harbor 会对结果评分并排序。",
  "Flat list of sources grouped by addon, with a filter dropdown. No re-ranking. Closest match to the Stremio app's stream picker.":
    "按插件分组显示扁平来源列表，并提供筛选下拉菜单。不重新排序，最接近 Stremio 应用的播放源选择器。",
  "Default. Harbor parses and scores every source and surfaces the best quality first.":
    "默认。Harbor 会解析所有来源并评分，优先显示画质最佳的结果。",
  "Real-Debrid, TorBox, AllDebrid, Premiumize, Debrid-Link. Cached streams play direct. Keys stay local.":
    "支持 Real-Debrid、TorBox、AllDebrid、Premiumize 和 Debrid-Link。已缓存的播放源可直接播放。密钥仅保存在本地。",
  "Real-Debrid API token": "Real-Debrid API 令牌",
  "Searches and streams directly off Easynews. No debrid needed. Just your Easynews login.":
    "直接从 Easynews 搜索并播放。无需 Debrid，只需 Easynews 登录信息。",
  "Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.":
    "使用操作系统的原生标题栏和窗口按钮，而非 Harbor 内置的标题栏和按钮。应用内按钮难以触及时会很方便，例如播放期间。",
  PLAYBACK: "播放",
  VOLUME: "音量",
  "Open Harbor's settings outside playback.": "在播放界面外打开 Harbor 设置。",
  "Harbor will scrobble your playback to Trakt and sync your watchlist.":
    "Harbor 会向 Trakt 上报你的播放记录，并同步片单。",
  "Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.":
    "正在使用 AIOStreams 或其他聚合插件？在 Harbor 获取结果前，插件会先在内部进行排序和筛选，之后 Harbor 再应用上方的片源筛选和结果排序。如果结果少于预期，请放宽其中一方的限制：放宽插件的内部筛选，或将 Harbor 的片源筛选设为“均衡”或“关闭”。",
  "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.":
    "选择点击某个条目的“播放”按钮后执行的操作。“手动”可让你完全控制画质和片源。",
  "Player engine": "播放器引擎",
  "HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.":
    "HTML5 可播放 WebView2 支持的所有内容。mpv 支持 TrueHD、DTS-HD、AV1、特殊封装格式和 HDR。“自动”会根据片源选择。",
  "Seek bar": "进度条",
  "Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.":
    "设置播放器底部时间轴的样式。可将圆点换成贴纸、调整进度条高度或更改颜色。设置效果会在此处实时预览。",
  "Subtitle style": "字幕样式",
  "How subtitles look during playback. Live preview below.":
    "设置播放时的字幕外观。可在下方实时预览。",
  "Show format chips on stream rows": "在片源行中显示格式标签",
  "The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.":
    "选择器会为每个片源标注分辨率、HDR 类型、编解码器和音频格式。关闭后将全部隐藏。",
  "Trailer quality": "预告片画质",
  "How sharp the trailer is when you hit the preview button. Auto picks from your connection speed. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.":
    "点击预览按钮时预告片的清晰度。“自动”会根据你的网速选择。1080p 和“最佳”会使用内置 ffmpeg 合并独立的视频和音频，因此启动时间会稍长。",
  Audio: "音频",
  "Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.":
    "无需调整系统均衡器即可调整音效。适用于 mpv 引擎；HTML5 引擎会原样播放音频。",
  "Maximum volume boost": "最大音量增益",
  "How far you can boost past 100 percent on the volume bar. Higher settings can get very loud.":
    "设置音量条可超过 100% 的最大增益。较高的设置可能会非常响。",
  "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.":
    "设置在播放器中点击“下载”时 Harbor 保存视频的位置。可选择任意文件夹，包括其他驱动器上的文件夹。",
  mpv: "mpv",
  "Player & quality": "播放器与画质",
  "Pick the playback engine and which quality chips show up on cards.":
    "选择播放引擎以及卡片上显示的画质标签。",
  "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.":
    "Harbor 会直接在此计算机上运行一个小型流媒体服务器，其地址如下。要在其他设备上播放此计算机提供的内容，请复制 Wi-Fi 地址，并将其粘贴到那台设备上 Harbor 的“远程流媒体服务器”中。",
  "Player layout": "播放器布局",
  "Pick a theme, then rearrange every button in the player chrome. Hide what you never use, promote what you do.":
    "选择主题，然后重新排列播放器控制栏中的每个按钮。隐藏从不使用的按钮，将常用按钮放到显眼位置。",
  "Edit player layout": "编辑播放器布局",
  "Harbor's native player chrome.": "Harbor 原生播放器控制栏。",
  "Designing the player layout": "正在设计播放器布局",
  "Customizing the player": "正在自定义播放器",
  "What the clock labels show on the seek bar.": "设置进度条上显示的时间标签。",
  "Volume control": "音量控制",
  "How the volume widget behaves on click and hover.": "设置点击或悬停时音量控件的行为。",
  "Click toggles mute. Wheel scrolls volume.": "点击可切换静音。滚动滚轮可调节音量。",
  Player: "播放器",
  "Inside the playback view.": "在播放界面中。",
  Volume: "音量",
  "Close player": "关闭播放器",
  "Exit playback and return to the previous view.": "退出播放并返回上一界面。",
  "Play / pause": "播放/暂停",
  "Toggle playback.": "切换播放或暂停。",
  "Show or hide the playback stats overlay.": "显示或隐藏播放统计信息浮层。",
  "Save the current frame (video only, no subtitles) as a PNG to Pictures/Harbor.":
    "将当前帧（仅视频，不含字幕）保存为 PNG 文件，存入 Pictures/Harbor。",
  "Start or stop recording a GIF of the video (no subtitles). Saves to Pictures/Harbor.":
    "开始或停止将视频录制为 GIF（不含字幕）。文件会保存到 Pictures/Harbor。",
  "Jump back by the Back seek step set under Behavior.": "按“行为”中设置的后退跳转步长向后跳转。",
  "Jump forward by the Forward seek step set under Behavior.":
    "按“行为”中设置的前进跳转步长向前跳转。",
  "Seek back 30s": "后退 30 秒",
  "Seek forward 30s": "前进 30 秒",
  "Seek to the beginning.": "跳转到开头。",
  "Seek to the last half second.": "跳转到最后半秒处。",
  "Raise volume (hold Shift for big steps).": "调高音量（按住 Shift 可大幅调整）。",
  "Lower volume (hold Shift for big steps).": "调低音量（按住 Shift 可大幅调整）。",
  "Mute or unmute audio.": "将音频静音或取消静音。",
  "Cycle through available subtitle tracks.": "依次切换可用的字幕轨道。",
  "Subtitle delay −0.1s": "字幕延迟 −0.1 秒",
  "Shift subtitle timing earlier (Shift for fine steps).": "将字幕时间提前（按住 Shift 可微调）。",
  "Subtitle delay +0.1s": "字幕延迟 +0.1 秒",
  "Shift subtitle timing later (Shift for fine steps).": "将字幕时间推后（按住 Shift 可微调）。",
  "Slow playback by 0.25x.": "将播放速度降低 0.25x。",
  "Speed playback up by 0.25x.": "将播放速度提高 0.25x。",
  "Stream switcher": "视频源切换器",
  "Open or close the in-player stream switcher.": "打开或关闭播放器内的视频源切换器。",
  "Player freezes after the second episode autoplays": "自动播放第二集后播放器卡死",
  "Stream should start playing within a few seconds.": "视频流应在几秒内开始播放。",
  "Spinner stays forever and nothing in the player loads.":
    "加载指示器一直转，播放器始终没有加载任何内容。",
  "MPV (native, recommended)": "MPV（原生，推荐）",
  "Player shell": "播放器界面",
  "Seek bar style": "进度条样式",
  "Subtitle font size": "字幕字号",
  "Subtitle background": "字幕背景",
  "Custom MPV code": "自定义 MPV 代码",
  "Hitting Play jumps straight into playback with the best stream Harbor finds.":
    "点击播放后，直接使用 Harbor 找到的最佳片源开始播放。",
  "Hitting Play opens the source list so you can choose quality, debrid, and audio yourself.":
    "点击播放后打开片源列表，以便你自行选择画质、debrid 和音轨。",
  "Remember last stream": "记住上次使用的片源",
  "If a stream hasn't started playing within 10 seconds (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "如果片源在 10 秒内仍未开始播放（片源失效或插件不可用），则自动尝试下一个可用片源。默认关闭。",
  "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.":
    "继续观看时，直接使用上次的片源（相同插件和片源），不再打开选择器。关闭后每次都重新选择。",
  "mpv on the desktop app, HTML5 in the browser. The right engine without thinking about it.":
    "桌面应用使用 mpv，浏览器使用 HTML5。无需操心，自动选择合适的引擎。",
  "Native webview playback. Smooth and integrated, but limited codec coverage.":
    "原生 WebView 播放。流畅且集成度高，但支持的编解码器有限。",
  "Embed mpv inside Harbor window": "将 mpv 嵌入 Harbor 窗口",
  "Renders mpv inline so playback lives in Harbor itself. Disable to open it in a separate window instead.":
    "在 Harbor 中内嵌渲染 mpv，让播放直接在 Harbor 内进行。禁用后将在单独窗口中打开。",
  "Keeps Harbor embedded but lifts the HDR video onto its own opaque plane with the controls floating above, so Windows shows true HDR without the brightness slider dimming it. Needs HDR-to-SDR tonemapping off.":
    "保持 Harbor 内嵌显示，但将 HDR 视频置于独立的不透明平面上，并让控件浮于其上，使 Windows 显示真正的 HDR，且不会被亮度滑块调暗。需要关闭 HDR 转 SDR 色调映射。",
  "Line-free video mode": "无亮线视频模式",
  "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer (this mode bypasses the HDR display path). Leave OFF unless you see that line. Restart playback to apply.":
    "强制使用兼容性呈现模式，以消除某些显示器屏幕边缘出现的细亮线。副作用：4K 播放可能卡成幻灯片，HDR 内容也会变暗（此模式会绕过 HDR 显示路径）。除非看到该亮线，否则请保持关闭。重新开始播放后生效。",
  "Interpolates frames for smoother panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. mpv only.":
    "通过插帧让平移画面更流畅，最适合动漫。显示器刷新率需高于视频帧率，性能较弱的 GPU 可能会卡顿。仅限 mpv。",
  "Direct torrent streaming": "种子直接播放",
  "When you have no debrid set up, or a torrent isn't cached, stream it straight from the bundled engine on localhost:11470. This connects to peers over your own connection, the same way Stremio's built-in streaming does.":
    "未设置 debrid 或种子未缓存时，直接使用 localhost:11470 上的内置引擎播放。这会通过你的网络连接到其他对等节点，方式与 Stremio 的内置播放功能相同。",
  "Stream torrents through Harbor's own Rust peer-to-peer engine instead of the bundled Stremio Server. Falls back automatically if it can't connect. Status and a self-test live in the Local engine card below.":
    "使用 Harbor 自有的 Rust P2P 引擎播放种子，而非随附的 Stremio Server。无法连接时会自动回退。状态和自检功能位于下方的“本地引擎”卡片中。",
  "On by default. Pipes every cast through ffmpeg as H.264 + AAC + MPEG-TS so Samsung, LG, Sony, and other DLNA TVs accept the stream regardless of source codec. Turn off only if you have a beefy receiver that handles raw HEVC/DTS and want max quality. Requires ffmpeg in PATH.":
    "默认开启。通过 ffmpeg 将所有投屏内容转换为 H.264 + AAC + MPEG-TS，使 Samsung、LG、Sony 及其他 DLNA 电视无论源编解码器为何都能正常播放。仅当接收设备性能强劲、支持原始 HEVC/DTS 且你希望获得最高画质时才关闭。需要 ffmpeg 位于 PATH 中。",
  "Hide subtitles when the player shrinks into the floating PiP window.":
    "播放器缩小为浮动 PiP 窗口时隐藏字幕。",
  "Generates a frame on the fly as you scrub the seek bar. Works on debrid streams and local files.":
    "拖动进度条时即时生成预览画面。适用于 debrid 播放源和本地文件。",
  "Seek dot shape": "进度圆点形状",
  "Self-test is disabled while strict remote streaming is on. It downloads a test torrent over peer-to-peer on this machine.":
    "严格远程流式传输开启时无法自检。自检会在本机通过 P2P 下载测试种子。",
  "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.":
    "让 Harbor 连接另一台设备上的流媒体服务器，例如家庭服务器上的 Stremio 服务。种子将由该设备下载并播放，而非本机。",
  "If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.":
    "如果服务器无法访问，播放将失败，而不会改由本机进行流式传输。如果 VPN 运行在服务器设备上，并且种子流量绝不能经过本机，请使用此选项。",
  "Server reachable in {ms}ms. Harbor will use it for torrent streaming.":
    "服务器可访问，延迟为 {ms}ms。Harbor 将使用该服务器进行种子流式播放。",
  "Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.":
    "调整首页各行标题和播放器中所显示标题的大小，而不缩放界面其他部分。还可让播放器标题先显示剧名，而非单集标题。",
  "Player title": "播放器标题",
  "Show series name first in the player": "在播放器中优先显示剧名",
  "Lead with the show name instead of the episode title at the top of the player.":
    "在播放器顶部先显示剧名，而非单集标题。",
  "Pause when minimized": "最小化时暂停",
  "Stop playback when you minimize Harbor or send it to the tray.":
    "最小化 Harbor 或将其收起到系统托盘时暂停播放。",
  "Pause when unfocused": "窗口失去焦点时暂停",
  "Stop playback whenever another window takes focus.": "其他窗口获得焦点时暂停播放。",
  "Saves your whole Harbor setup to one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "将整个 Harbor 配置保存到一个文件中，包括主题、首页布局、设置、插件、个人资料、片单、播放器布局、观看进度等。Stremio 登录信息会特意排除。",
  "Keep the presence visible when playback is paused.": "播放暂停时仍显示活动状态。",
  "Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Harbor synced playback.":
    "重写媒体库中的每个项目，使其完全符合 Stremio 的数据结构。如果 Stremio 应用在 Harbor 同步播放状态后开始崩溃，请运行一次。",
  "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.":
    "网页版无法运行 mpv、快速预览生成器、本地带宽探测或你自己的 Cloudflare 中继。若要使用 HDR 直通、TrueHD 或 DTS-HD 音频并获得更流畅的跳转体验，请下载桌面应用。",
  "Synchronizes playback state between participants in the same room.":
    "在同一房间的参与者之间同步播放状态。",
  "Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.":
    "请仅输入由你运营或信任的中继 URL。中继只传输“一起看”同步消息（播放、暂停、跳转），不会传输任何其他内容。",
  "Save a debrid key above (TorBox, Real-Debrid, AllDebrid, Premiumize, or Debrid-Link) to enable this.":
    "请先在上方保存 Debrid 密钥（TorBox、Real-Debrid、AllDebrid、Premiumize 或 Debrid-Link）以启用此功能。",
  "Real-time GPU upscaling that sharpens lines and cleans up gradients on anime, built right into Harbor's player. The one-tap setup below grabs the shaders; nothing else to install.":
    "Harbor 播放器内置的实时 GPU 放大功能，可锐化动漫线条并改善渐变。下方一键设置会获取所需着色器，无需安装其他内容。",
  "A small badge over the video (with live FPS) that only appears when Anime4K is actually running. Follows your anime-only setting.":
    "视频上会显示一个带实时 FPS 的小徽标，仅在 Anime4K 实际运行时出现，并遵循“仅限动漫”设置。",
  "Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.":
    "Harbor 内置的帧插值功能，可让镜头移动更流畅，尤其适合动漫。显示器刷新率需高于视频帧率，在性能较弱的 GPU 上可能卡顿。负载低于 SVP。",
  "Genuine 48/60fps motion on anime, rendered right inside Harbor's player. SVP supplies the engine (VapourSynth + svpflow) and runs in your tray for licensing; Harbor's own player applies the interpolation, so it stays embedded and fully under your control. One-time install, then flip it on.":
    "直接在 Harbor 播放器内渲染动漫的真正 48/60fps 流畅画面。SVP 提供引擎（VapourSynth + svpflow），并在系统托盘中运行以完成授权；插值由 Harbor 自有播放器处理，因此始终内嵌运行并完全由你掌控。只需安装一次，之后开启即可。",
  "Harbor's player applies the interpolation itself, embedded like normal playback, and starts SVP Manager in the tray for licensing. Restart playback to apply. If video goes black or won't start, turn this off.":
    "Harbor 播放器会像正常播放一样内嵌执行插值，并启动系统托盘中的 SVP Manager 以完成授权。重新开始播放后生效。如果视频黑屏或无法开始播放，请关闭此功能。",
  "Anime4K and smooth-motion run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "Anime4K 和运动平滑功能基于 Harbor 桌面应用内置的 mpv 引擎运行，在浏览器中无效。",
  "Match the picture quality to your computer, smooth out weak connections, and fine-tune the mpv engine with plain-language controls.":
    "根据你的电脑调整画质、改善较差网络下的播放流畅度，并通过易懂的控件微调 mpv 引擎。",
  "Picture quality": "画质",
  "One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.":
    "此选项决定电脑为提升视频画质投入多少性能。请选择与设备性能相匹配的设置，下次播放时生效。",
  "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.":
    "关闭高级缩放和特效，让视频顺畅播放。这是对设备负载最低的选项。如果出现卡顿或风扇狂转，请选择此项。",
  "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.":
    "无需让设备高负载运行，也能获得良好画质。没有特殊需要时，请保持此设置。",
  "Maximum quality": "最高画质",
  "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.":
    "让显卡承担繁重的视频解码工作，可节省电量并降低 CPU 温度。自动模式适合绝大多数人；仅当播放画面异常或无法开始播放时再切换。",
  "Boost SDR video toward HDR": "将 SDR 视频增强至接近 HDR",
  "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.":
    "如果视频经常暂停缓冲，或您使用不稳定的 Wi-Fi 或距离较远的服务器，此功能会让 Harbor 提前缓冲更多内容，以便在网络波动时保持播放。",
  "Build a bigger buffer": "增大缓冲区",
  "Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.":
    "播放前预先加载更多视频。网络较差时更流畅，但会多占用少量内存，并稍微延长开始播放的时间。",
  "Advanced (mpv.conf)": "高级（mpv.conf）",
  "The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.":
    "供高级用户使用的自定义选项。每行一个 mpv 选项，格式为 key=value，与 mpv.conf 完全相同。这些选项最后应用，因此会覆盖上方所有调节设置。Harbor 无法读取的内容会被跳过，所以拼写错误不会导致播放出错。重新启动播放后生效。",
  "Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.":
    "注意：{keys} 可以加载外部脚本，或将播放器开放到网络。只有在完全了解其作用时才保留这些选项。",
  "See the mpv.conf your dials above generate": "查看上方调节项生成的 mpv.conf",
  "These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.":
    "这些设置用于调整 Harbor 桌面应用内置的 mpv 引擎，在浏览器中无效。",
  "Download the desktop app to use video tuning.": "下载桌面应用以使用视频调校功能。",
  "Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.":
    "mpv 引擎的默认画面比例。“适应”会保持片源原始比例，并保留黑边；其余选项会拉伸或裁剪画面以填满屏幕，适合在宽屏电视上观看老式 4:3 节目。",
  "Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.":
    "想在播放过程中更改比例？为保持播放器界面简洁，画面比例按钮默认隐藏。",
  "Turn it on in Player layout": "在“播放器布局”中开启",
  "Peers, speed and progress chip on the player during torrent playback. Turn off to keep the player clean.":
    "通过种子播放时，在播放器上显示对等节点数、速度和进度标签。关闭可保持播放器界面简洁。",
  "Back out mid-episode and the card keeps the exact frame you stopped on, with your progress, so it looks like a pause instead of a thumbnail.":
    "中途退出某一集后，卡片会保留你停下时的那一帧和观看进度，看起来就像暂停画面，而不是缩略图。",
  "Step back one frame and pause. Frame-accurate on mpv.":
    "后退一帧并暂停。在 mpv 上可实现精准逐帧操作。",
  "Step forward one frame and pause. Frame-accurate on mpv.":
    "前进一帧并暂停。在 mpv 上可实现精准逐帧操作。",
  "Smooth motion runs on the bundled mpv engine in the Harbor desktop app. It has no effect in the browser.":
    "运动补帧功能在 Harbor 桌面应用内置的 mpv 引擎上运行，在浏览器中无效。",
  "Subtitle auto-sync": "字幕自动同步",
  "Harbor times out-of-sync subtitles to the audio for you, on any external subtitle. It works on the mpv player and leaves embedded tracks alone, since those are already in sync.":
    "Harbor 可根据音频自动校准所有不同步外挂字幕的时间轴。此功能适用于 mpv 播放器，且不会改动内嵌字幕轨，因为它们已经同步。",
  "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own. Off by default.":
    "当字幕提前或延后时，Harbor 会分析语音并自动校正时间。默认关闭。",
  "Identity matches from content hashing and the community database always apply on their own. Timing worked out from the audio only offers a fix until it has earned trust. Turn this on to let those audio-derived fixes apply automatically too.":
    "通过内容哈希和社区数据库识别出的匹配项始终会自动应用。仅根据音频计算出的时间修正，在获得足够信任前只会提供修复建议。开启后，这些基于音频的修正也会自动应用。",
  "Keeps watching through playback and gently re-nudges the timing if the subtitle slips out of sync partway through.":
    "在播放期间持续监测；如果字幕中途逐渐不同步，会轻微调整时间，使其重新同步。",
  "For the hardest files and the Try again button, Harbor transcribes a little speech on your device and lines the subtitle up to the actual words. Needs a build with the asr-whisper feature and downloads a small model the first time you use it.":
    "对于最难处理的文件以及“重试”按钮，Harbor 会在你的设备上转录少量语音，并将字幕与实际台词对齐。需要启用了 asr-whisper 功能的版本，首次使用时还会下载一个小型模型。",
  "A good correction only has to be found once. Harbor can share verified fixes so the next person with the same file and subtitle gets an instant result. Records are keyed by salted fingerprints, never your files or anything personal.":
    "有效的修正只需发现一次。Harbor 可以共享经过验证的修正，让下一个使用相同文件和字幕的人立即获得结果。记录以加盐指纹为键，绝不会使用你的文件或任何个人信息。",
  "Check the shared database first. When this exact subtitle has already been synced by someone else, yours snaps into place with no analysis.":
    "优先查询共享数据库。如果完全相同的字幕已由其他人同步，你的字幕无需分析即可立即准确对齐。",
  'When Esc would close the player, show a quick confirm first. You can tick "Don\'t ask me again" in that prompt to always leave on Esc.':
    "当按 Esc 将关闭播放器时，先显示快速确认提示。你可以在提示中勾选“不再询问”，以后按 Esc 将直接退出。",
  "Short seek (Shift + arrows)": "短距离跳转（Shift + 方向键）",
  "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.":
    "Amazon 风格的 X-Ray：观看时打开演员阵容，点按任意演员即可查看其简介和所有参演作品。下一步将支持在设备端进行人脸匹配，以显示当前画面中的演员。默认关闭。",
  "Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.":
    "在播放器中添加 X-Ray 按钮，可查看带照片的完整演员阵容，并点按任意演员进入其详情。照片和影视作品列表需要 TMDB 密钥。",
  "Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.":
    "定期将当前帧中的人脸与演员阵容进行匹配，以显示当前画面中的演员。所有处理均在设备端进行，不会有任何数据离开你的设备。播放时会多占用少量 CPU。",
  "X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.":
    "X-Ray 从 TMDB 读取演员阵容及其照片。没有 TMDB 密钥，就没有可供匹配的演员阵容。请在“媒体库与元数据”中添加你的免费密钥。",
  "After several episodes auto-play in a row with no input, pause and check you're still there before continuing. Off by default.":
    "连续自动播放数集且没有任何操作后，暂停并确认你是否仍在观看，再继续播放。默认关闭。",
  "Turns your phone into a remote for this computer: play, pause, seek, volume, and casting, all from the couch. Open the Wi-Fi address on your phone's browser.":
    "将手机变为这台电脑的遥控器：坐在沙发上即可控制播放、暂停、跳转、音量和投屏。请在手机浏览器中打开该 Wi-Fi 地址。",
  "Picture shaders run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.":
    "画面着色器在 Harbor 桌面应用内置的 mpv 引擎上运行，在浏览器中无效。",
  "Neural upscalers, sharpeners, and HDR tone-mapping ported for mpv. Each is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.":
    "为 mpv 移植的神经网络超分辨率、锐化和 HDR 色调映射着色器。每款着色器均由其作者托管，不随 Harbor 捆绑提供。按需下载，Harbor 会按正确顺序将它们串联起来并应用到播放器中。",
  "Stream picker cache": "播放源选择器缓存",
  "Remembered source lists per title. Clears stale results after changing addons or debrid.":
    "按片名保存的播放源列表。更改插件或 debrid 服务后，可清除其中的过期结果。",
  "Dead stream marks": "失效播放源标记",
  "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.":
    "已下载的主题可在“主题与外观”中管理。视频和漫画下载可在“下载”页面管理。",
  "Any Stremio subtitle addons you have installed are searched here too.":
    "这里也会搜索你已安装的所有 Stremio 字幕插件。",
  "None installed yet. Add Stremio subtitle addons under Streaming sources.":
    "尚未安装。请在“流媒体源”中添加 Stremio 字幕插件。",
  "Subtitle sources": "字幕来源",
  "A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.":
    "快速的社区字幕索引。默认关闭；开启后可更全面地覆盖较新或小众作品。",
  "Subtitle addons": "字幕插件",
  "A large multi-language subtitle database. Off until you add your free SUBDL API key.":
    "大型多语言字幕数据库。添加免费的 SUBDL API 密钥后才会启用。",
  "A community subtitle source. Off until you add your Subsource API key.":
    "社区字幕来源。添加 Subsource API 密钥后才会启用。",
  "Manage subtitle addons in Streaming sources": "在“流媒体源”中管理字幕插件",
  "The languages above all obey your preferred subtitle language order, which lives in the Languages page.":
    "上述所有语言均遵循你在“语言”页面设置的首选字幕语言顺序。",
  "Stream priority": "播放源优先级",
  "Priority applies once you have two or more stream addons.":
    "安装两个或更多播放源插件后，优先级才会生效。",
  "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.":
    "Harbor 排序会将评分最高的播放源排在前面。插件顺序会保留每个插件返回结果的原始顺序，与 Stremio 和 Vidi 应用一致。在两种模式下，下方的播放源优先级都会决定哪个插件排在最前。",
  "If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.":
    "如果播放源未能在规定时间内开始播放（播放源失效或插件宕机），则自动尝试下一个可用播放源。默认关闭。",
  "Only start the torrent engine when needed": "仅在需要时启动种子引擎",
  "Harbor normally starts its torrent engine at launch so the first P2P stream connects faster. That keeps a DHT node running and talking to the network even when you are not watching anything. Turn this on if you are on a metered or limited connection: the engine then starts the first time you actually play a torrent. Takes effect next launch.":
    "Harbor 通常会在启动时开启种子引擎，以便更快连接第一个 P2P 播放源。即使你未观看任何内容，这也会让 DHT 节点持续运行并与网络通信。如果你使用按流量计费或流量受限的网络，请开启此项：引擎将在首次实际播放种子时才启动。下次启动时生效。",
  "Show a second subtitle in another language at the same time. Handy when you are learning a language: keep the one you are learning as your main subtitle, and put your own language here.":
    "同时显示另一种语言的第二字幕。学习语言时很方便：将正在学习的语言设为主字幕，并在此处设置你的母语。",
  "Second subtitle language": "第二字幕语言",
  "Harbor loads it automatically when a track in that language exists. You can also set or clear the second track for one video from the subtitle menu in the player.":
    "如果存在该语言的字幕轨道，Harbor 会自动加载。你也可以在播放器的字幕菜单中，为单个视频设置或清除第二字幕轨道。",
  "Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.":
    "Debridge 负责为你查找可用文件。它附带 TorBox 和 Usenet 账户，因此无需另购 debrid 服务。已经有 Real-Debrid 或 AllDebrid？也可以直接接入。",
  "{n} addons run for you, with Debridge included: TorBox and Usenet accounts, so there is no debrid service to buy separately.":
    "为你运行 {n} 个插件，并包含 Debridge：附带 TorBox 和 Usenet 账户，无需另购 debrid 服务。",
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.":
    "私有 Stremio 插件，速率限制提高 10 倍并内置播放流代理，每月 $9 起。",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.":
    "超过 100 款自托管应用：*arr 套件、debrid 工具、图书和有声书等。",
  "Keep your local time visible during fullscreen playback and choose how it looks.":
    "全屏播放时持续显示本地时间，并选择其外观。",
  "The clock appears with the player controls.": "时钟会与播放器控件一同显示。",
  "Display the local time when the current video is expected to end.":
    "显示当前视频预计结束时的本地时间。",
  "Add a TMDB key in Settings to identify the cast.": "在设置中添加 TMDB 密钥以识别演员。",
  "No cast photos are available for this title.": "此作品没有可用的演员照片。",
  "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.":
    "实时人脸扫描会加载设备端 AI 模型，并可能在播放时显著增加 RAM、CPU 和 GPU 占用。如果 Harbor 变慢或设备发热，请将其关闭。",
  "Checking sources and audio": "正在检查片源和音频",
  "Different subtitle version": "字幕版本不同",
  "No timing change was needed. This subtitle already matches the audio.":
    "无需调整时间轴。此字幕已与音频匹配。",
  "Harbor couldn't analyze the audio for this source. Try again or adjust it manually.":
    "Harbor 无法分析此片源的音频。请重试或手动调整。",
  "There isn't enough readable dialogue in this subtitle to measure its timing.":
    "此字幕中可识别的对白不足，无法测量时间轴。",
  "This subtitle appears to be for a different cut. Try another match.":
    "此字幕似乎对应不同的剪辑版本。请尝试其他匹配项。",
  "The timing checks disagreed, so Harbor left the subtitle unchanged.":
    "时间轴检测结果不一致，因此 Harbor 未更改字幕。",
  "The timing difference was too large to correct safely. Try another subtitle.":
    "时间差异过大，无法安全校正。请尝试其他字幕。",
  "Harbor couldn't find a reliable timing correction for this subtitle.":
    "Harbor 无法为此字幕找到可靠的时间轴校正方案。",
  "This subtitle looks like a different version of the video.": "此字幕似乎对应视频的其他版本。",
  "Add a TMDB key in Settings to see the cast, crew and recommendations for every title.":
    "在设置中添加 TMDB 密钥，即可查看每部作品的演员、制作人员和推荐内容。",
  "Download subtitle": "下载字幕",
  "Open stream in browser": "在浏览器中打开视频流",
  "Exit this video?": "退出此视频？",
  "You'll leave the player and open the full details page.": "你将离开播放器并打开完整详情页。",
  "Find a movie, show, or person and jump straight to it without leaving the player.":
    "查找电影、剧集或人物，无需离开播放器即可直接打开。",
  "Copy stream link": "复制视频流链接",
  "Download this subtitle": "下载此字幕",
  "Select a subtitle track to sync": "选择要同步的字幕轨道",
  "Checking plots, cast, and scenes": "正在核查剧情、演员阵容和场景",
  "Some copies of new releases have ads spliced into the video itself. This is experimental: the community marks where those ads are so others can skip them.":
    "有些新片资源会在视频中直接插入广告。此功能尚处于实验阶段：社区会标记这些广告的位置，方便其他人跳过。",
  "Your report is sent for review before it ever skips anything for anyone. Nothing about the video is uploaded, just the timestamps you mark. It is off by default and you can turn it off anytime in Settings.":
    "你的报告会先送交审核，通过后才会用于帮助他人跳过广告。不会上传任何视频内容，只会提交你标记的时间戳。此功能默认关闭，你可以随时在“设置”中将其关闭。",
  "BBCode works: [b] [url] [img] [youtube] [video] [quote]":
    "支持 BBCode：[b] [url] [img] [youtube] [video] [quote]",
  "Add a TMDB key in Settings to see the cast, crew, and details.":
    "在设置中添加 TMDB 密钥，即可查看演员、主创和详细信息。",
  "No cast information for this title.": "没有此作品的演员信息。",
  "Reading the cast": "正在读取演员信息",
  "Playback pauses when the timer runs out. Works for movies too: one movie counts as one episode.":
    "计时结束后将暂停播放。也适用于电影：一部电影计为一集。",
  "“Cached” just means your addon thinks that file is already saved on your debrid, ready to play instantly. That flag isn’t always right: sometimes the file isn’t actually there yet. When that happens the source won’t start, or it plays a short broken clip. It’s not a Harbor problem: pick another source, or give it a minute to finish caching and try again.":
    "“已缓存”仅表示你的插件认为该文件已保存到 debrid，可立即播放。此标记并非总是准确，有时文件实际上还未缓存。发生这种情况时，内容源可能无法开始播放，或只会播放一小段损坏的视频。这不是 Harbor 的问题：请选择其他内容源，或稍等片刻，待缓存完成后重试。",
  "Couldn't load subtitles. You can start anyway and add one later in the player.":
    "无法加载字幕。你仍可开始播放，稍后再在播放器中添加字幕。",
  "Start playback": "开始播放",
  "Couldn't detect your Wi-Fi address. Connect this computer to Wi-Fi, or find the phone remote link under Settings, Playback.":
    "无法检测到你的 Wi-Fi 地址。请将此电脑连接到 Wi-Fi，或前往“设置”>“播放”查找手机遥控链接。",
  "Couldn't connect to any peers for this torrent. It may be unreachable on your network (some ISPs and VPNs block torrent traffic).":
    "无法连接到此种子的任何对等节点。你的网络可能无法访问它（部分 ISP 和 VPN 会屏蔽种子流量）。",
  "Found peers but no data yet. The torrent may be slow.":
    "已找到对等节点，但尚未收到数据。此种子的下载速度可能较慢。",
  "Subtitle timing": "字幕时间轴",
  "Sync to the audio": "与音频同步",
  "Could not read this subtitle track. Pick a different subtitle, then try again.":
    "无法读取此字幕轨道。请选择其他字幕后重试。",
  "Pick the subtitle that fits this release": "选择与此发布版本匹配的字幕",
  "A relay is a tiny Cloudflare Worker that passes play/pause/seek messages between you and your friends. No video data ever touches it. Deploy your own in one click (free tier is plenty), or paste a friend's invite link to use theirs.":
    "中继服务是一个小型 Cloudflare Worker，用于在你和朋友之间传递播放、暂停和跳转消息。任何视频数据都不会经过它。你可以一键部署自己的中继服务（免费套餐完全够用），也可以粘贴朋友的邀请链接来使用对方的中继服务。",
  "No subtitle cues available": "没有可用的字幕条目",
  "Could not read the subtitle file": "无法读取字幕文件",
  "Player not ready": "播放器尚未就绪",
  "No video files found in that folder.": "该文件夹中未找到视频文件。",
  "Prime Video": "Prime Video",
  "Add a TMDB key in Settings to see cast, related titles, and trailers here.":
    "在设置中添加 TMDB 密钥，即可在此查看演员阵容、相关影片和预告片。",
  "Last source wasn't actually cached on your debrid yet. Pick another from the list.":
    "上一个来源尚未缓存在你的 Debrid 服务中。请从列表中另选一个。",
  "No playable streams turned up, and no debrid is configured. Real-Debrid, TorBox, AllDebrid, Premiumize, or Debrid-Link will unlock raw torrent results. Some addons bake debrid in (Sootio, Comet/ElfHosted, MediaFusion/ElfHosted) and play without your own keys.":
    "未找到可播放的视频流，且尚未配置 Debrid。Real-Debrid、TorBox、AllDebrid、Premiumize 或 Debrid-Link 可解锁原始种子结果。部分插件已内置 Debrid（Sootio、Comet/ElfHosted、MediaFusion/ElfHosted），无需你自己的密钥即可播放。",
  "Set up a debrid": "配置 Debrid",
  "No source returned a stream": "没有任何来源返回视频流",
  "Try signing in to Stremio so Harbor can use your addon collection. Older or foreign titles often need Torrentio + a debrid addon to find anything.":
    "请尝试登录 Stremio，以便 Harbor 使用你的插件集合。较老或外语条目通常需要 Torrentio 搭配 Debrid 插件才能找到资源。",
  "We could not find a working stream": "无法找到可用的视频流",
  "· A debrid key (TorBox, Real-Debrid, etc.) is missing or expired.":
    "· Debrid 密钥（TorBox、Real-Debrid 等）缺失或已过期。",
  "· No stream addon is installed yet (Torrentio, MediaFusion, Comet).":
    "· 尚未安装视频流插件（Torrentio、MediaFusion、Comet）。",
  "Debrid is down": "Debrid 服务不可用",
  "· Install a stream addon (Torrentio, Comet, MediaFusion).":
    "· 安装视频流插件（Torrentio、Comet、MediaFusion）。",
  "· Add a debrid key (TorBox, Real-Debrid, AllDebrid, Premiumize, Debrid-Link).":
    "· 添加 Debrid 密钥（TorBox、Real-Debrid、AllDebrid、Premiumize、Debrid-Link）。",
  "No debrid configured": "未配置 Debrid",
  "uncached on debrid": "未缓存在 Debrid 中",
  "Play / Pause": "播放/暂停",
  "Switch stream / TV Guide": "切换流/电视指南",
  "Where your video comes from": "视频来源",
  "P2P sources, debrid-ready": "P2P 来源，支持 debrid",
  "Head to Discover. Cinemeta and OpenSubtitles cover the basics; Torrentio + a debrid key cover almost everything else.":
    "前往“发现”。Cinemeta 和 OpenSubtitles 可满足基本需求；Torrentio + debrid 密钥几乎可满足其他所有需求。",
  "URLs can carry debrid keys or tokens; reveal when you need to copy":
    "URL 可能包含 debrid 密钥或令牌；需要复制时再显示",
  "Hidden by default. Manifest paths often carry API keys (debrid tokens, OMDB keys, etc.) you don't want over a shoulder.":
    "默认隐藏。清单路径通常包含 API 密钥（debrid 令牌、OMDB 密钥等），不应让旁人看到。",
  "{subtitle} · ranked by current popularity": "{subtitle} · 按当前人气排名",
  "Pick your subtitle languages": "选择字幕语言",
  "When playback starts, Harbor finds and loads a subtitle in one of these languages automatically. The first available match wins, so put your main language first.":
    "开始播放时，Harbor 会自动查找并加载这些语言之一的字幕。系统会使用首个可用匹配项，因此请将主要语言放在首位。",
  "Debrid required": "需要 Debrid",
  "This order drives your catalog rows and the default stream order. A stream priority set in Settings overrides it for streams.":
    "此顺序决定目录内容栏和默认片源顺序。设置中指定的片源优先级会覆盖这里的片源顺序。",
  "Number 1 answers first when you press Play, unless Settings has a stream priority.":
    "按下“播放”时，排在第 1 位的插件会优先提供片源，除非设置中指定了片源优先级。",
  "Best for debrid": "最适合 Debrid",
  "Cached on Real-Debrid, TorBox, AllDebrid. Instant play.":
    "已缓存在 Real-Debrid、TorBox、AllDebrid，可立即播放。",
  "Free torrent + usenet": "免费种子 + Usenet",
  "No subscription needed. Quality varies.": "无需订阅，质量不一。",
  "Quality-of-life upgrades. Sync, ratings, trailers.": "提升使用体验，包括同步、评分和预告片。",
  "A debrid service is connected. You'll get instant, high-quality streams.":
    "已连接 Debrid 服务。你将获得即时、高质量的视频流。",
  "Adds a blurred glass effect behind the stream picker panel.":
    "在视频流选择面板后方添加模糊玻璃效果。",
  "After you stop watching, a stream file stays cached for this long so reopening resumes instead of re-downloading. Older files are cleaned up automatically. Off deletes the file as soon as you leave the player.":
    "停止观看后，视频流文件会缓存这么长时间，以便再次打开时续播，无需重新下载。较旧的文件会自动清理。设为关闭时，一离开播放器就会删除文件。",
  "AudD · in-player song ID": "AudD · 播放器内歌曲识别",
  "Gemini · in-player song ID": "Gemini · 播放器内歌曲识别",
  "Auto is best for most people. mpv handles the trickiest 4K, HDR, and audio formats.":
    "自动模式适合大多数用户。mpv 能处理最棘手的 4K、HDR 和音频格式。",
  "Blur stream backdrop": "模糊播放源背景图",
  "Buffer fill": "缓冲区填充",
  "Buffer fill brightness": "缓冲区填充亮度",
  "Build a named filter once, then apply it in the source picker to hide everything that doesn't match. Each filter ANDs its dimensions and ignores any you leave blank.":
    "创建一次命名筛选，然后在来源选择器中应用它，隐藏所有不匹配的内容。筛选条件各维度之间采用“且”逻辑，留空的维度将被忽略。",
  "Changing the location restarts the engine. Clearing removes all cached stream files right away; anything you reopen will re-fetch.":
    "更改位置会重启引擎。清除操作会立即删除所有播放缓存文件；重新打开任何内容时都需要重新获取。",
  "Choose how far the keyboard arrows and player seek buttons jump.":
    "选择按键盘方向键和播放器快进快退按钮时的跳转时长。",
  "Connect a debrid service (Real-Debrid, TorBox, AllDebrid) for instant HD without the wait.":
    "连接云解服务（Real-Debrid、TorBox、AllDebrid），无需等待即可立即观看高清内容。",
  "Copy diagnostics grabs the engine status and your P2P settings as JSON, handy to paste into a bug report. The engine folder holds the DHT cache (dht.json) and active torrent data.":
    "复制诊断信息会获取引擎状态和你的 P2P 设置并生成 JSON，方便粘贴到错误报告中。引擎文件夹中存有 DHT 缓存（dht.json）和活跃 Torrent 数据。",
  "Displays the resolution, HDR format and audio (e.g. 4K · Dolby Vision · TrueHD 7.1) under the movie or episode title while playing. Off by default.":
    "播放时在电影或单集标题下方显示分辨率、HDR 格式和音频信息（例如 4K · Dolby Vision · TrueHD 7.1）。默认关闭。",
  "Downloaded peer-to-peer stream files are kept on disk so reopening a title resumes instantly instead of starting over. Control how long they stay and where they live.":
    "已下载的 P2P 流媒体文件会保留在磁盘上，因此重新打开条目时可立即续播，无需从头开始。你可以控制其保留时间和存储位置。",
  "Downloaded subtitles can arrive a moment after playback starts. Leave this off to keep whatever subtitle is already showing; turn it on to switch to the best language match as soon as it loads.":
    "下载的字幕可能会在播放开始片刻后才载入。关闭此项可保留当前显示的字幕；开启后，最佳语言匹配的字幕一经载入便会自动切换。",
  "Export player log": "导出播放器日志",
  "Frame interpolation shines on anime but can look off on live-action film. Limit it to the content you want, then restart playback.":
    "帧插值在动漫上的效果出色，但在真人电影上可能显得不自然。请仅对需要的内容启用，然后重新开始播放。",
  "Full quality frames": "全画质帧",
  "Heads up: this is a large file for peer-to-peer streaming, so it can take a while to start. A 1080p source or a debrid service will load faster.":
    "请注意：此文件对于点对点流式播放来说较大，因此可能需要一段时间才能开始播放。1080p 来源或 Debrid 服务的加载速度会更快。",
  "High-quality episode images": "高质量剧集图片",
  "How keys behave during playback.": "播放期间按键的行为。",
  "If a stream or the video player misbehaves, export the player log and attach it above. It saves to your Downloads folder.":
    "如果视频流或视频播放器出现异常，请导出播放器日志并附在上方。日志会保存到“下载”文件夹。",
  "Keeps fetching the full torrent in the background, even when paused, so you can pre-buffer big remuxes and scrub a finished file with no re-downloading. Uses more bandwidth and disk; cleaned up when you switch or close like normal.":
    "即使暂停，也会在后台继续下载完整种子内容，因此你可以预缓冲大型 Remux 资源，并在下载完成后随意拖动播放而无需重新下载。此功能会占用更多带宽和磁盘空间；切换来源或关闭时会照常清理。",
  "Keeps HDR inside Harbor with the controls floating above the video. Subtitles render on the video. If the control bar does not appear, press Esc or use separate window.":
    "在 Harbor 内播放 HDR 内容，控件悬浮在视频上方。字幕会渲染在视频上。如果控制栏未显示，请按 Esc 或使用独立窗口。",
  "Low-level knobs for the peer-to-peer engine, plus quick ways to grab debug info when a stream misbehaves.":
    "点对点引擎的底层参数，以及视频流异常时快速获取调试信息的方式。",
  Pause: "暂停",
  "Peers, speed and progress while a torrent streams. Sits clear of the exit button, top left.":
    "流式播放种子时显示对等节点、速度和进度。位于左上角，避开退出按钮。",
  "Pick a source once and Harbor keeps playing the rest of that season from the same release, no re-picking. Works best with a debrid season pack. Skipped for anime.":
    "选择一次来源后，Harbor 会继续从同一资源版本播放该季的其余剧集，无需再次选择。搭配 debrid 整季包效果最佳。动漫不适用。",
  "Pick a video": "选择视频",
  "Pick which audio and subtitle languages Harbor reaches for first.":
    "选择 Harbor 优先使用的音频和字幕语言。",
  "Player log": "播放器日志",
  "RTX Video HDR": "RTX Video HDR",
  "RTX Video Super Resolution": "RTX Video Super Resolution",
  "Saved stream filters": "已保存视频流筛选条件",
  "Saved to Downloads as harbor-mpv-log.txt": "已作为 harbor-mpv-log.txt 保存到“下载”文件夹",
  "Scroll cast left": "向左滚动演员列表",
  "Scroll cast right": "向右滚动演员列表",
  "Seek step": "跳转步长",
  "Send audio to specific speakers, headphones or a receiver. System default follows Windows.":
    "将音频输出到指定的扬声器、耳机或接收器。选择系统默认时将跟随 Windows 设置。",
  "Set to where the video is right now": "设为视频当前播放位置",
  "Show a quick volume overlay when you change volume with the player controls hidden, so keyboard and scroll wheel changes are always visible.":
    "播放器控件隐藏时，更改音量会显示简洁的音量浮层，确保键盘和滚轮操作始终可见。",
  "Show stream quality under the title": "在标题下显示播放画质",
  "Show the report button on every torrent stream, not just likely new releases.":
    "在每个种子播放源上显示举报按钮，而不只是可能的新发布内容。",
  "Show torrent name": "显示种子名称",
  "Show what you're actually watching, under the title in the player.":
    "在播放器标题下方显示你实际正在观看的内容。",
  "Show your operating system's own title bar with its minimize, maximize, and close buttons. They stay reachable everywhere, including while a video is playing. Turn this off to use Harbor's built-in window buttons.":
    "显示操作系统自带的标题栏及其最小化、最大化和关闭按钮。它们在任何界面中都可使用，包括视频播放期间。关闭后使用 Harbor 内置的窗口按钮。",
  "Skip the 'stream over peer-to-peer?' prompt and start uncached torrents immediately. Harbor remembers your choice after the first confirmation anyway.":
    "跳过“通过 P2P 播放？”提示并立即播放未缓存的种子。首次确认后，Harbor 仍会记住你的选择。",
  "Some cam and new-release rips have ads spliced into the video itself. When the community has marked one, a Skip button appears. You can also report ads you spot for review. Off by default.":
    "部分枪版和新发布的盗录版本会将广告直接拼接到视频中。社区标记后会显示“跳过”按钮。你也可以举报发现的广告以供审核。默认关闭。",
  "Start trailers with audio": "播放预告片时开启声音",
  "Stay in fullscreen after closing the player": "关闭播放器后保持全屏",
  Stream: "播放源",
  "Stream / addons": "播放源/插件",
  "Stream / addons instead": "改用播放源/插件",
  "Stream cache": "播放缓存",
  "Stream descriptions": "播放源描述",
  "Stream quality in player": "播放器中的播放画质",
  "Stream torrents straight from Harbor's built-in engine when you have no debrid set up, or a torrent isn't cached. This connects to peers over your own connection. Turn off to only ever play debrid and direct links.":
    "未设置 debrid 服务或种子尚未缓存时，直接使用 Harbor 内置引擎播放种子。这会通过你的网络直接连接其他对等节点。关闭后将仅播放 debrid 和直链。",
  "Streaming quality": "播放画质",
  Subtitle: "字幕",
  "Subtitle sync": "字幕同步",
  "Needs an external subtitle": "需要外挂字幕",
  "SVP is already handling frame interpolation. Turn off SVP below to use this instead. Running both delays the audio.":
    "SVP 已在进行帧插值。要改用此功能，请在下方关闭 SVP。同时运行两者会导致音频延迟。",
  "The lighter fill showing how much is buffered or downloaded ahead. It hides automatically once a stream is fully cached (green dot).":
    "较浅的填充部分表示已提前缓冲或下载的进度。内容完全缓存后（绿色圆点），它会自动隐藏。",
  "Torrent name": "种子名称",
  "Upconverts SDR video to HDR on an Nvidia RTX GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.":
    "使用 Nvidia RTX GPU 将 SDR 视频上转换为 HDR（请在 Nvidia 应用中开启 RTX Video HDR；需要 GPU 解码）。此功能为实验性功能。当前视频启用 SVP 时不可用。",
  "Upscales SDR video with AI on an Nvidia RTX GPU (turn on RTX Video Super Resolution in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.":
    "使用 Nvidia RTX GPU 通过 AI 放大 SDR 视频（请在 Nvidia 应用中开启 RTX Video Super Resolution；需要 GPU 解码）。此功能为实验性功能。当前视频启用 SVP 时不可用。",
  "Video {n}": "视频 {n}",
  "Volume pop-up while watching": "观看时显示音量弹窗",
  "What Play does when a movie or episode also exists on your disk. Autoplay always prefers the local copy unless set to Stream.":
    "当电影或剧集也存在于磁盘中时，“播放”按钮的操作方式。除非设为“播放源”，否则自动播放始终优先使用本地版本。",
  "When auto-playing the next episode, keep the same release/source you were just watching instead of Harbor's top-ranked stream. Falls back to the best stream if that source isn't available.":
    "自动播放下一集时，继续使用刚才观看的同一版本或播放源，而非 Harbor 排名最高的播放源。如果该播放源不可用，则回退到最佳播放源。",
  "When in fullscreen, Esc leaves fullscreen instead of closing the player. Press Esc again to close. Turn off to make Esc always close.":
    "全屏时，按 Esc 将退出全屏，而非关闭播放器。再次按 Esc 即可关闭。关闭此选项后，按 Esc 将始终关闭播放器。",
  "When you exit playback, keep the window fullscreen instead of dropping back to a window. Turn off to leave fullscreen automatically whenever the player closes.":
    "退出播放时保持窗口全屏，而非恢复为窗口模式。关闭此选项后，播放器关闭时将自动退出全屏。",
  "Where the volume overlay appears on the video.": "音量浮层在视频中的显示位置。",
  "With no TMDB key, the About panel pulls cast, crew, and title info from a free IMDb source. TMDB is still used whenever a key is set.":
    "未设置 TMDB 密钥时，“关于”面板会从免费的 IMDb 数据源获取演职人员和影片信息。只要设置了密钥，就仍会使用 TMDB。",
  "Use a game controller to browse Harbor and control playback. Works with Xbox, PlayStation, and most USB or Bluetooth gamepads.":
    "使用游戏控制器浏览 Harbor 并控制播放。支持 Xbox、PlayStation 及大多数 USB 或蓝牙游戏手柄。",
  "Use a game controller to browse Harbor and control playback. Tune the sticks and see the button map.":
    "使用游戏控制器浏览 Harbor 并控制播放。您可以调整摇杆参数并查看按键映射。",
  "When on, a connected controller moves focus around Harbor and drives the player. Turn it off to ignore all controllers.":
    "开启后，已连接的控制器可在 Harbor 中移动焦点并控制播放器。关闭后将忽略所有控制器。",
  "In the player": "在播放器中",
  "Play or pause": "播放或暂停",
  "Seek back or forward": "快退或快进",
  "Volume up or down": "调高或调低音量",
  "Exit player": "退出播放器",
  "Stream over P2P?": "要通过 P2P 播放吗？",
  "This source is not cached. Harbor will stream it peer to peer, which shares data with other peers.":
    "此播放源未缓存。Harbor 将通过点对点方式播放，这会与其他对等节点共享数据。",
  "Your debrid service is not responding. Try a different source.":
    "您的 Debrid 服务未响应。请尝试其他来源。",
  "Autoplay profile songs": "自动播放个人主页歌曲",
  "Buffers the whole file in the background as you watch, even while paused, so big remuxes pre-load and you can scrub a cached file with no re-buffering. Works for debrid and torrent streams. Uses more disk and bandwidth; cleared when you switch or close.":
    "观看时会在后台缓冲整个文件，即使暂停也会继续，让大型重封装文件提前加载，并可在已缓存的文件中拖动进度而无需重新缓冲。支持 debrid 和种子流。会占用更多磁盘空间和带宽；切换或关闭时将清除缓存。",
  "Harbor loads the native svpflow filter through VapourSynth and starts SVP Manager when available. Restart playback to apply.":
    "Harbor 会通过 VapourSynth 加载原生 svpflow 滤镜，并在可用时启动 SVP Manager。重启播放后生效。",
  "Harbor's own menus and labels. Subtitle languages come later, and you can change both in Settings.":
    "用于 Harbor 自身的菜单和标签。字幕语言可稍后设置，这两项都能在设置中更改。",
  "Native 48/60fps motion through your Linux SVP and VapourSynth installation, rendered inside Harbor's embedded player.":
    "通过 Linux 上安装的 SVP 和 VapourSynth 实现原生 48/60fps 运动画面，并在 Harbor 内置播放器中渲染。",
  "Shows a small green dot on the player's subtitle button while a subtitle track is active. Turn it off if you would rather keep the controls clean.":
    "当字幕轨启用时，播放器的字幕按钮上会显示一个绿色小圆点。如果你希望控件更简洁，可以将其关闭。",
  "Subtitle indicator dot": "字幕指示圆点",
  "A classic neural edge-directed luma doubler. Very high quality, heavy on the GPU. More neurons means sharper and slower.":
    "经典的神经网络边缘导向亮度倍增器。画质极高，但 GPU 负载较重。神经元越多，画面越锐利，速度越慢。",
  "A filter applies everywhere Harbor picks a stream: the source picker, the instant pick, and Big Picture on TV.":
    "筛选条件会应用于 Harbor 选择视频流的所有位置：来源选择器、即时选择和电视大屏模式。",
  "A high quality chroma upscaler. Fixes the color blur and bleeding of default chroma scaling, most visible on saturated edges and subtitles.":
    "高质量色度放大器。可修复默认色度缩放造成的色彩模糊和溢色，在高饱和度边缘和字幕上最明显。",
  "AMD FidelityFX Super Resolution. A fast spatial upscaler that fires when the video is smaller than the window. A great default for live action where Anime4K is the wrong tool.":
    "AMD FidelityFX Super Resolution。一种快速空间放大器，会在视频尺寸小于窗口时启用。对于不适合使用 Anime4K 的真人影像，这是很好的默认选项。",
  "Add a video": "添加视频",
  "Advanced mpv options (mpv.conf)": "高级 mpv 选项（mpv.conf）",
  "All video": "所有视频",
  "Always stream P2P": "始终使用 P2P 流式传输",
  "Applies to both audio and subtitle tracks. You can still pick a skipped track by hand in the player.":
    "同时应用于音轨和字幕轨。你仍可在播放器中手动选择被跳过的轨道。",
  "Audio (normalize, bass, night mode)": "音频（音量标准化、低音、夜间模式）",
  "Audio and subtitle languages on the TV": "电视上的音频和字幕语言",
  "Audio downmix": "音频降混",
  "Bigger buffer for slow connections": "为慢速连接使用更大的缓冲区",
  "Block mouse and keyboard input until you unlock the player.":
    "解锁播放器前，阻止鼠标和键盘输入。",
  "Built from IMDb's public datasets. Career ratings volume.":
    "基于 IMDb 的公开数据集构建。职业生涯获评数量。",
  "Cam-quality picture with audio plugged into the projector or a separate recorder. Sound is clean, but the image is still a theater capture. Better than CAM, far below a real release.":
    "影院偷拍画质，音频直接接入放映机或用单独的录音设备录制。声音清晰，但画面仍为影院拍摄。优于 CAM，但远逊于正式发行版。",
  "Debrid services (RealDebrid / TorBox / AllDebrid / Premiumize / Debrid-Link)":
    "Debrid 服务（RealDebrid / TorBox / AllDebrid / Premiumize / Debrid-Link）",
  "Deletes every cached stream file and restarts the engine.": "删除所有缓存的流文件并重启引擎。",
  "Denoise + upscale. Lightest, cleanest on already-sharp video.":
    "降噪 + 超分辨率。对于本就清晰的视频，处理最轻、画面最干净。",
  "Double restore. Sharpest detail, for high-quality sources.":
    "双重修复。细节最锐利，适合高质量片源。",
  "Downloading the start of the file. Playback begins once there is enough to keep going.":
    "正在下载文件开头部分。数据足以支持持续播放后即会开始播放。",
  "Each shader is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.":
    "每个着色器均由其作者托管，并未内置于 Harbor。下载所需着色器后，Harbor 会按正确顺序串联，并在播放器中应用。",
  "Embed a YouTube video": "嵌入 YouTube 视频",
  "Fetches a small public test torrent, then reports UDP and HTTPS egress, DHT bootstrap and tracker reachability step by step.":
    "获取一个小型公开测试种子，然后逐步报告 UDP 和 HTTPS 出站连接、DHT 引导及 Tracker 可达性。",
  "Filmed in a theater with a handheld camera. Picture is shaky, faces look soft, you'll hear the crowd. Watch only if you can't wait. Quality is rough.":
    "手持摄像机在影院内拍摄。画面抖动，人脸模糊，还会听到观众的声音。实在等不及再看，画质很差。",
  "Handles torrent playback and transcoding for this machine.": "负责此设备的种子播放和转码。",
  "Harbor needs at least one streaming source before it can play {title}. Install a stream addon or add a debrid key in settings.":
    "Harbor 至少需要一个流媒体源才能播放 {title}。请安装流媒体插件或在设置中添加 debrid 密钥。",
  "Harbor reads the speech in the audio, then slides the subtitle track until the two line up.":
    "Harbor 会识别音频中的语音，然后调整字幕轨，直到两者同步。",
  "Harbor tried {n} sources for {title} and none of them played. Usually that means a debrid key has expired, no stream addon is installed yet, or nothing has this title cached.":
    "Harbor 已为 {title} 尝试 {n} 个播放源，但均无法播放。通常是因为 debrid 密钥已过期、尚未安装流媒体插件，或没有任何服务缓存该片。",
  "Harbor's built-in HDR to SDR conversion is on. Turn it off in Video tuning to use this instead. Running both double-processes the picture.":
    "Harbor 的内置 HDR 转 SDR 转换已开启。请在视频调校中将其关闭后再使用此功能。同时运行会让画面被处理两次。",
  "High quality": "高画质",
  "How large a backdrop image the TV fetches. It does not change video quality. Balanced is the safe choice on older hardware.":
    "电视端获取的背景图尺寸。这不会改变视频画质。较旧的硬件建议选择“均衡”。",
  "Instant playback preparation": "即时播放准备",
  "Jump back by the shorter Short seek step set under Behavior.":
    "按“行为”中设置的较短“短距离跳转”步长后退。",
  "Jump forward by the shorter Short seek step set under Behavior.":
    "按“行为”中设置的较短“短距离跳转”步长前进。",
  "Layout, time format and volume style apply when you save.":
    "保存后，布局、时间格式和音量样式将生效。",
  "Live state of Harbor's own torrent engine on this machine.":
    "此设备上 Harbor 自有种子引擎的实时状态。",
  "Local torrent engine": "本地种子引擎",
  "Lock player controls": "锁定播放器控件",
  "Main subtitle line": "主字幕行",
  "Name it, tick the resolutions, sources, codecs and audio you want, and leave the rest blank.":
    "为其命名，勾选所需的分辨率、来源、编解码器和音频，其余留空。",
  "No quality label": "无画质标签",
  "No subtitle languages set": "未设置字幕语言",
  "Nothing selected. Harbor will not load a subtitle on its own.":
    "未选择任何内容。Harbor 不会自动加载字幕。",
  "Opens the folder holding the DHT cache and active torrent data.":
    "打开存放 DHT 缓存和活跃种子数据的文件夹。",
  "Optional. Add one to turn on automatic subtitle sync.": "可选。添加密钥即可启用字幕自动同步。",
  "Paste a direct video file link.": "粘贴视频文件直链。",
  "Peers, speed and progress on the player while a torrent streams. Sits top left, clear of the exit button.":
    "种子流式播放期间，在播放器上显示对等节点数、速度和进度。位于左上角，避开退出按钮。",
  "Pick a source to swap in place. Playback keeps running.": "选择要替换的来源。播放会继续进行。",
  "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "选择要保存的内容，随后所有选中内容都会存入一个文件，包括主题、首页布局、设置、插件、个人资料、片单、播放器布局、观看进度等。你的 Stremio 登录信息会特意排除在外。",
  "Picture quality (weak PC / balanced / max)": "画质（低配电脑 / 均衡 / 最高）",
  "Picture quality on the TV": "电视端画质",
  "Playback quality": "播放质量",
  "Player audio": "播放器音频",
  "Player chrome": "播放器界面",
  "Player controls": "播放器控制",
  "Player controls on the TV": "电视端播放器控制",
  "Player engine on the TV": "电视端播放引擎",
  "Player layout / chrome": "播放器布局 / 界面",
  "Plays the best stream straight away.": "立即播放最佳片源。",
  "Plays the trailer behind the hero after a short pause.":
    "短暂停顿后，在主视觉背景中播放预告片。",
  "Pop the video into a small always-on-top window, or restore it.":
    "将视频弹出为置顶小窗，或恢复原状。",
  "Powers the Identify song button in the player.": "为播放器中的“识别歌曲”按钮提供支持。",
  "Prepares up to two provider-confirmed cached debrid sources while the picker is open, so Play can start sooner. This may create or update transfers on your debrid account before you click Play. It never touches P2P or uncached sources, is rate-limited, and keeps prepared links in memory for two minutes only. Off by default.":
    "选择器打开时，最多预先准备两个经服务商确认已缓存的 Debrid 片源，以便更快开始播放。这可能会在你点击“播放”前创建或更新 Debrid 账户中的传输任务。它绝不会处理 P2P 或未缓存片源，且有速率限制；准备好的链接仅在内存中保留两分钟。默认关闭。",
  "Puts every control, icon and option on this player style back the way it shipped.":
    "将此播放器样式的所有控件、图标和选项恢复为初始状态。",
  "Quality badge style": "画质徽标样式",
  "Quality unverified": "画质未验证",
  "RTX Video HDR toggle": "RTX Video HDR 开关",
  "Real-Debrid, TorBox, AllDebrid and Premiumize all have brief outages where they stop returning links. Wait a few minutes and try again, or check the service's status page.":
    "Real-Debrid、TorBox、AllDebrid 和 Premiumize 偶尔会短暂中断并停止返回链接。请等待几分钟后重试，或查看服务状态页面。",
  "Reference quality, very heavy.": "参考级画质，性能开销极高。",
  "Relative to your main subtitle size.": "相对于主要字幕字号。",
  "Remap stream badges": "重新映射片源标记",
  "Reset subtitle style to defaults": "将字幕样式重置为默认值",
  "Row & player title size": "行与播放器标题字号",
  "Save the last 30 seconds as a video clip with audio, choosing subtitles on or off. Saves to Pictures/Harbor.":
    "将最后 30 秒保存为带音频的视频片段，并可选择是否包含字幕。保存到“图片/Harbor”。",
  "Save video clip": "保存视频片段",
  "Searching works without a key. A key lets Harbor line subtitles up with the audio automatically.":
    "无需密钥即可搜索。添加密钥后，Harbor 可自动将字幕与音频同步。",
  Seek: "跳转",
  "Show every stream, with no quality preference applied.": "显示所有视频流，不应用任何画质偏好。",
  "Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they do not cover subtitles.":
    "使用键盘暂停或继续播放时显示播放器控件。关闭后控件将保持隐藏，以免遮挡字幕。",
  "Show what you are actually watching, under the title in the player.":
    "在播放器的标题下显示你实际正在观看的内容。",
  "Shown at the same time as your main subtitle.": "与主字幕同时显示。",
  "Shows the stream list every time.": "每次都显示视频流列表。",
  "Small controls that sit around playback rather than in the picture.":
    "位于播放画面周围而非画面内的小型控件。",
  "Stops and starts the engine. Cached stream files are kept.":
    "用于停止或启动引擎。已缓存的视频流文件会保留。",
  "Stream badges": "视频流徽章",
  "Stream filters": "视频流筛选",
  "Stream ranking": "视频流排序",
  "Stream this via peer-to-peer?": "要通过 P2P 播放此内容吗？",
  "Subtitle auto-sync (fix out-of-sync subtitles)": "字幕自动同步（修复字幕不同步）",
  "Subtitle language order": "字幕语言顺序",
  "Subtitle languages & autoload": "字幕语言与自动加载",
  "Subtitle look on the TV": "电视上的字幕外观",
  "Subtitle size": "字幕大小",
  "Subtitle sources (OpenSubtitles, Wyzie, addons)": "字幕来源（OpenSubtitles、Wyzie、插件）",
  "The addon didn't tell us anything about this file's resolution or source. It could be anything from 4K Blu-ray to a phone capture. Pick a labeled stream if one exists.":
    "插件未提供此文件的分辨率或来源信息。它可能是 4K Blu-ray，也可能是手机拍摄。如果有标明信息的流，请优先选择。",
  "The editor is a working copy of the player. Click any control on it to move, resize, restyle or hide that control.":
    "编辑器是播放器的可编辑副本。点击其中任意控件，即可移动、调整大小、更改样式或隐藏该控件。",
  "The label looks high (1080p / 4K) but doesn't match expected file size or release window. Often a CAM or TS rebadged. Try a Theater Capture stream or check the source list before committing.":
    "标记看似清晰度很高（1080p/4K），但与预期文件大小或发布时间不符。通常是伪装成高清的 CAM 或 TS。请尝试影院拍摄流，或在播放前查看来源列表。",
  "The player has the stream open and is waiting on the next piece.":
    "播放器已打开流，正在等待下一个数据块。",
  "The source responded but the stream would not open. Try a different one.":
    "来源已响应，但无法打开流。请尝试其他来源。",
  "The stronger fix when streams refuse to load. Cached stream files and the DHT cache are removed, so the next stream starts from scratch.":
    "当流始终无法加载时，可使用此强力修复。已缓存的流文件和 DHT 缓存将被删除，因此下次播放将从头开始。",
  "The title shown at the top of the player.": "播放器顶部显示的标题。",
  "This is how a subtitle will look.": "字幕显示效果如下。",
  "This source isn't cached on your debrid, so Harbor would pull it directly from peers. It can take a moment to start and may buffer on low-seed torrents.":
    "此来源尚未缓存在你的 debrid 服务中，因此 Harbor 会直接从对等节点拉取。开始播放可能需要片刻，做种人数较少的种子可能会缓冲。",
  "This source rejected the stream": "此来源拒绝了该流",
  "Toggle RTX Video HDR": "开启或关闭 RTX Video HDR",
  "Toggle RTX Video HDR during mpv playback. Unavailable while HDR-to-SDR tonemapping or SVP is active.":
    "在 mpv 播放期间切换 RTX Video HDR。启用 HDR 转 SDR 色调映射或 SVP 时不可用。",
  "Toggle RTX Video Super Resolution during mpv playback. Unavailable while SVP is active.":
    "在 mpv 播放期间切换 RTX Video Super Resolution。启用 SVP 时不可用。",
  "Torrent streaming": "种子流媒体播放",
  "Unsaved changes to your layout, time format and volume style.":
    "布局、时间格式和音量样式有未保存的更改。",
  "Video files": "视频文件",
  "Video links need to start with https.": "视频链接必须以 https 开头。",
  "Video tuning": "视频调优",
  "When playback starts, Harbor finds and loads a subtitle in one of these languages. The first available match wins, so put your main language first.":
    "播放开始时，Harbor 会查找并加载以下语言之一的字幕。优先使用第一个可用匹配项，因此请将主要语言放在首位。",
  "Whether Harbor reports playback to Simkl while you watch.":
    "观看时 Harbor 是否向 Simkl 报告播放情况。",
  "Whether subtitles are showing the moment a video starts.": "视频开始播放时是否立即显示字幕。",
  "Which service names the track when you tap Identify song in the player.":
    "在播放器中轻触“识别歌曲”时，由哪个服务识别曲目名称。",
  "Which subtitle Harbor lands on when more than one is available.":
    "有多个字幕可用时 Harbor 默认选中的字幕。",
  "Which subtitle languages, in order?": "字幕语言及其优先顺序？",
  "X-Ray (cast on screen)": "X-Ray（屏幕上的演员）",
  "Your debrid service can't process this right now.": "你的 debrid 服务目前无法处理此请求。",
  debrid: "debrid",
  "mpv.conf": "mpv.conf",
  "Choose where subtitle timing feedback appears and how large it is.":
    "选择字幕时间调整反馈的显示位置和大小。",
  "Pause downloads": "暂停下载",
  "Show subtitle sync indicator": "显示字幕同步指示器",
  "Show the current offset when you adjust subtitle timing with Z or X.":
    "使用 Z 或 X 调整字幕时间时显示当前偏移量。",
  "Subtitle sync indicator": "字幕同步指示器",
  "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own.":
    "当字幕过早或过晚时，Harbor 会分析语音并自动校正时间。",
  "Downloaded subtitles can arrive after playback starts. Harbor switches from a temporary track when a stronger release match becomes available.":
    "下载的字幕可能会在播放开始后才就绪。当有与片源版本匹配度更高的字幕可用时，Harbor 会从临时字幕轨切换到该字幕。",
  "Timing and drift are corrected. Check playback, then save.":
    "时间偏移和漂移均已校正。请检查播放效果，然后保存。",
  "Harbor's full video engine. Plays anything you throw at it.":
    "Harbor 的完整视频播放引擎，几乎可播放任何内容。",
  "libmpv did not load, so playback falls back to HTML5 and formats like MKV may refuse to play. On Linux, install your distribution's libmpv package, then restart Harbor.":
    "libmpv 加载失败，因此将回退到 HTML5 播放，MKV 等格式可能无法播放。在 Linux 上，请安装你的发行版提供的 libmpv 软件包，然后重启 Harbor。",
  "Play, pause, seek, volume and casting from the couch.":
    "坐在沙发上即可播放、暂停、跳转、调节音量和投屏。",
  "Keep the clock on screen when the player is not fullscreen.":
    "播放器未全屏时也在屏幕上显示时钟。",
  "Player screen lock": "播放器屏幕锁定",
  "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.":
    "在播放器中显示锁定控件，锁定后将屏蔽鼠标、键盘、遥控器和媒体键输入，直至解锁。",
  "Autoplay trailer on detail pages": "在详情页自动播放预告片",
  "Unlock player controls ({binding})": "解锁播放器控件（{binding}）",
  "Lock player controls ({binding})": "锁定播放器控件（{binding}）",
  "Player controls locked": "播放器控件已锁定",
  "Player controls unlocked": "播放器控件已解锁",
  "{name} left the video": "{name} 已退出观看",
  "You'll stay in the room either way. Keep watching with the others, or step out of the player.":
    "无论如何，你都会留在房间里。你可以和其他人继续观看，也可以退出播放器。",
  "You'll stay in the room either way. Keep watching alone, or step out of the player.":
    "无论如何，你都会留在房间里。你可以独自继续观看，也可以退出播放器。",
  "Leave the video": "退出观看",
  "Pause download": "暂停下载",
  "Higher quality · slower": "质量更高 · 速度较慢",
  "{count} volume": "{count} 卷",
  "Choose an Edge TTS voice before generating audio": "生成音频前，请先选择 Edge TTS 语音",
  "Volume {volume}": "第 {volume} 卷",
  "The generated audio could not be played": "无法播放生成的音频",
  "Pause narration": "暂停朗读",
  "Cancel audio generation": "取消生成音频",
  "Audio position": "音频位置",
  "Saved audio": "已保存的音频",
  "Saved audio deleted": "已保存的音频已删除",
  "Delete saved audio": "删除已保存的音频",
  "Volume {number}": "第 {number} 卷",
  "Select a volume to see its chapters.": "选择一卷以查看其章节。",
  "TrueHD audio unsupported": "不支持 TrueHD 音频",
  "DTS audio unsupported": "不支持 DTS 音频",
  "AC-3 audio unsupported": "不支持 AC-3 音频",
  "audio must be re-encoded": "音频需要重新编码",
  "{deviceName} is an audio-only device. Harbor can't transcode video to audio yet, so this device can only stream audio files. Pick a TV, Chromecast, or display-equipped device to stream video.":
    "{deviceName} 是纯音频设备。Harbor 暂时无法将视频转码为音频，因此只能向此设备流式传输音频文件。若要流式传输视频，请选择电视、Chromecast 或带显示屏的设备。",
  '{deviceLabel} can\'t play this stream ({reasons}). Click "Pick another" first to load alternatives, then try casting again.':
    "{deviceLabel} 无法播放此媒体流（{reasons}）。请先点击“选择其他”加载备选流，然后再次尝试投屏。",
  "{deviceLabel} can't play this stream ({reasons}) and none of the {count} available alternatives match its capabilities.":
    "{deviceLabel} 无法播放此媒体流（{reasons}），且 {count} 个可用备选流均不符合其播放能力。",
  "{deviceLabel} can't decode this stream natively ({reasons}). Harbor uses ffmpeg to convert it into a format your TV understands.":
    "{deviceLabel} 无法原生解码此媒体流（{reasons}）。Harbor 会使用 ffmpeg 将其转换为电视可识别的格式。",
  "Open the cast menu and try this device again.": "打开投屏菜单，然后再次尝试此设备。",
  "Close the cast menu and reopen it to rescan the network.":
    "关闭投屏菜单后重新打开，以重新扫描网络。",
  "Roku changed its OS to block the built-in Media Player from accepting video from other apps. Media Assistant is a free channel built to take over that job. One-time install on your Roku and casting works.":
    "Roku 更改了操作系统，导致内置 Media Player 无法接收其他应用发送的视频。Media Assistant 是一个免费频道，可接替这一功能。只需在 Roku 上安装一次，即可正常投屏。",
  "Could not cast to {deviceName}.": "无法投屏到 {deviceName}。",
  Video: "视频",
  "Images and video from https or data URLs.": "来自 https 或 data URL 的图片和视频。",
  "Sets streaming availability and the Now Playing release window. Pick a country and Harbor offers to match the interface, metadata, subtitle, and audio languages to it.":
    "用于设置流媒体可用性和“正在热映”的上映时间范围。选择国家/地区后，Harbor 会提示将界面、元数据、字幕和音频语言与之匹配。",
  "Adds an Identify-song button to the player that recognizes the current music via AudD and shows a Now Playing card. Off by default; needs an AudD key below.":
    "在播放器中添加“识别歌曲”按钮，通过 AudD 识别当前音乐并显示“正在播放”卡片。默认关闭；需要在下方填写 AudD 密钥。",
  "Show the in-player Identify-song button and Now Playing card.":
    "显示播放器内的“识别歌曲”按钮和“正在播放”卡片。",
  "Reskin the quality chips (4K, HDR, Dolby Vision, Atmos and more) that ride each stream in the play picker. Click any slot to drop in your own PNG or animated GIF, or import a whole set at once. You do not have to fill every slot.":
    "更换播放选择器中每个视频流所带画质标签（4K、HDR、Dolby Vision、Atmos 等）的外观。点击任意槽位即可添加自己的 PNG 或动态 GIF，也可一次导入整套素材。无需填满所有槽位。",
  "Quality badges": "画质徽章",
  "Download Video": "下载视频",
  "Direct stream": "直接串流",
  "Cast to": "投屏到",
  "No cast devices found on your network.": "你的网络中未找到投屏设备。",
  "Stream offline": "直播流已离线",
  "Or paste a stream URL": "或粘贴直播流 URL",
  "Seek forward 10 seconds": "快进 10 秒",
  "Seek back 10 seconds": "后退 10 秒",
  "{app} itself does not host, distribute, or index any media. All streams come from third-party addons, debrid services, or your own {service} account that you configure yourself. You are responsible for what you choose to play and for complying with the laws of your jurisdiction.":
    "{app} 本身不托管、分发或索引任何媒体。所有流均来自第三方插件、Debrid 服务或您自行配置的 {service} 账户。您须对自己选择播放的内容以及遵守所在司法管辖区的法律负责。",
  "Works without a key at low volume; add a key for higher quotas.":
    "低用量时无需密钥即可使用；添加密钥可获得更高配额。",
  "Debrid keys": "Debrid 密钥",
  "Powers the Identify-song button in the player. Get a token at":
    "为播放器中的“识别歌曲”按钮提供支持。令牌获取地址：",
  "Applies when you play something. Only visibly changes the picture when the video is being scaled.":
    "播放内容时应用。仅当视频被缩放时，画面才会出现明显变化。",
  "We originally built this as our own personal client. We love {service} so much and wanted to put our own spin on a protocol we use almost daily. It started as a simple, clean player, and as our friends started using it too, it grew into something bigger: watch together, instant play, and a lot more.":
    "我们最初将它作为自用客户端。我们非常喜爱 {service}，希望用自己的方式诠释这个几乎每天都在使用的协议。它起初只是一个简洁易用的播放器，随着朋友们也开始使用，逐渐发展出更多功能：一起观看、即点即播等等。",
  "Same read-only usage as Real-Debrid. Also lets you queue uncached torrents from the play picker.":
    "与 Real-Debrid 相同，仅进行只读操作。还可让您从播放选择器中将未缓存的种子加入队列。",
};

export default playback;
