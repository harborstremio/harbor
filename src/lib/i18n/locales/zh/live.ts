const live: Record<string, string> = {
  "Switch to channel list (hide program guide)": "切换到频道列表（隐藏节目指南）",
  "Channel is taking a while": "频道加载时间较长",
  "Channel won't load": "频道无法加载",
  "Is the channel playing right?": "频道播放是否正常？",
  "No favorites yet. Star a channel to pin it here.": "暂无收藏。为频道加星即可将其固定在此处。",
  "Pick playlist": "选择播放列表",
  "Record from live TV": "录制直播电视节目",
  "Wrong channel or source?": "频道或来源有误？",
  "Provider returned a webpage, not a playlist": "提供商返回的是网页，而非播放列表",
  "Credentials are likely expired or the subscription is inactive. Edit the playlist URL above, or contact your provider.":
    "凭据可能已过期，或订阅未激活。请编辑上方的播放列表 URL，或联系提供商。",
  "This Xtream account is expired, banned, or disabled on the provider side. Renew or confirm with your provider.":
    "此 Xtream 账号已过期、被封禁或被提供商停用。请续订或向提供商确认。",
  "Xtream login was rejected": "Xtream 登录被拒绝",
  "The server URL, username, or password is wrong. Edit the playlist and re-check the credentials your provider sent.":
    "服务器 URL、用户名或密码错误。请编辑播放列表，并重新核对提供商发送的凭据。",
  "The server replied with a webpage instead of Xtream data. The account may be expired, or the server URL is not an Xtream panel.":
    "服务器返回的是网页，而非 Xtream 数据。账号可能已过期，或服务器 URL 并非 Xtream 面板地址。",
  "The credentials in the URL are wrong. Edit the playlist and double check the username and password against what your provider sent.":
    "URL 中的凭据错误。请编辑播放列表，并仔细核对提供商发送的用户名和密码。",
  "Playlist URL not found": "未找到播放列表 URL",
  "The server responded but the playlist is not at that URL. Check for typos and verify with your provider.":
    "服务器已响应，但该 URL 下没有播放列表。请检查是否有拼写错误，并向提供商核实。",
  "The playlist server is down or your network is blocking it. Try again in a few minutes.":
    "播放列表服务器已宕机，或你的网络阻止了连接。请几分钟后重试。",
  "The URL hostname is wrong or no longer exists. Many providers rotate domains; ask your provider for an updated playlist URL.":
    "URL 主机名错误或已失效。许多提供商会更换域名，请向提供商索取更新后的播放列表 URL。",
  "The playlist server actively refused the connection.": "播放列表服务器主动拒绝了连接。",
  "Could not reach playlist server": "无法连接播放列表服务器",
  "Playlist contained no channels": "播放列表中没有频道",
  "The URL is valid but the playlist is empty. The provider may be in maintenance, or the URL is misconfigured.":
    "URL 有效，但播放列表为空。提供商可能正在维护，或 URL 配置有误。",
  "Playlist is too large": "播放列表过大",
  "Could not load this playlist": "无法加载此播放列表",
  "Loading playlist...": "正在加载播放列表…",
  "Channel categories": "频道分类",
  "Match EPG": "匹配 EPG",
  "Match EPG channel": "匹配 EPG 频道",
  "No EPG channels match. This playlist's EPG source may be empty.":
    "没有匹配的 EPG 频道。此播放列表的 EPG 源可能为空。",
  "Search {n} EPG channels": "搜索 {n} 个 EPG 频道",
  "Drag to resize the channel column": "拖动以调整频道栏宽度",
  "Connect a playlist to get started.": "连接播放列表即可开始使用。",
  "Live EPG": "实时 EPG",
  "M3U playlist": "M3U 播放列表",
  "Direct .m3u or get.php URL with credentials baked in.":
    "直接使用 .m3u 或内含凭据的 get.php URL。",
  "Xtream codes": "Xtream codes",
  "EPG / XMLTV only": "仅 EPG / XMLTV",
  "Playlist URL": "播放列表 URL",
  "EPG URL": "EPG URL",
  "EPG / XMLTV URL": "EPG / XMLTV URL",
  "Stored locally on this device. Credentials never leave your machine. If a channel fails to play, your provider may rate-limit shared accounts: refresh the playlist or check with them.":
    "数据存储在此设备本地，凭据绝不会离开你的设备。如果频道无法播放，可能是提供商对共享账号进行了限流：请刷新播放列表或联系提供商确认。",
  "Xtream provider": "Xtream 提供商",
  "EPG source": "EPG 源",
  "My playlist": "我的播放列表",
  "EPG failed:": "EPG 加载失败：",
  "No playlist": "没有播放列表",
  "Add another playlist": "添加另一个播放列表",
  "Export as .m3u": "导出为 .m3u",
  "URL + EPG saved": "已保存 URL 和 EPG",
  "Switch to this playlist first": "请先切换到此播放列表",
  "M3U URL": "M3U URL",
  "Direct .m3u link": ".m3u 直链",
  Xtream: "Xtream",
  EPG: "EPG",
  "EPG URL (optional)": "EPG URL（可选）",
  "EPG fetch failed:": "EPG 获取失败：",
  "Stored as a standalone EPG source. No channels are loaded for EPG-only entries; they're kept here for future attachment to existing playlists.":
    "已存储为独立 EPG 源。仅 EPG 条目不会加载任何频道；这些条目将保留，供日后关联到现有播放列表。",
  "This playlist has no movies. It may be live channels only, or an Xtream login that exposes movies separately.":
    "此播放列表中没有电影。它可能只有直播频道，或者 Xtream 登录会单独提供电影。",
  "This playlist has no shows. It may be live channels only, or an Xtream login that exposes shows separately.":
    "此播放列表中没有剧集。它可能只有直播频道，或者 Xtream 登录会单独提供剧集。",
  "Live controller preview": "实时控制器预览",
  "Live TV reminder": "直播电视提醒",
  "Move focus with the keyboard, like a TV remote.": "像使用电视遥控器一样，通过键盘移动焦点。",
  "TV navigation": "电视导航",
  "Hide Live TV": "隐藏直播电视",
  "Removes the Live TV tab from the sidebar.": "从侧边栏移除“直播电视”标签。",
  "Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.":
    "在导航中添加“播放列表”入口，用于浏览 M3U 或 Xtream 播放列表中的电影和剧集（与添加到直播电视的播放列表相同）。默认关闭，以保持导航简洁。",
  "Sent. Check your channel.": "已发送，请检查你的频道。",
  "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.":
    "每当 Harbor 发出通知时，Discord 都会向频道发布消息。设置大约需要一分钟。",
  "Edit Channel": "编辑频道",
  "Previous channel": "上一个频道",
  "Jump back to the last live channel you watched (live TV only).":
    "返回上次观看的直播频道（仅限直播电视）。",
  "Open or close the live TV guide (live channels only).":
    "打开或关闭直播电视节目表（仅限直播频道）。",
  "Open or close the live TV recorder (live channels only).":
    "打开或关闭直播电视录像功能（仅限直播频道）。",
  "Right-click a text channel, pick": "右键点击文本频道，然后选择",
  "A Live TV program is about to start": "直播电视节目即将开始",
  "Live TV": "直播电视",
  "no channel": "未选择频道",
  "Harbor scans your IPTV playlists' EPG every 30 min for programs about to start.":
    "Harbor 每 30 分钟扫描一次 IPTV 播放列表的 EPG，查找即将开始的节目。",
  "Remote server": "远程服务器",
  "Disabled while strict remote streaming is on": "严格远程流式传输开启时不可用",
  "Remote streaming server": "远程流媒体服务器",
  "Xtream credentials were left out of this backup.": "此备份不包含 Xtream 凭据。",
  "Adds a Playlists tab to the nav for your M3U and Xtream libraries.":
    "在导航栏中添加“播放列表”标签页，用于访问你的 M3U 和 Xtream 媒体库。",
  "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.":
    "想找浏览器版 Harbor、手机遥控器或漫画阅读器遥控器？它们已移至“遥控器”页面。",
  "One switch powers everything on this page: the web app, the phone remote, and the manga reader remote.":
    "一个开关即可启用此页面的所有功能：Web 应用、手机遥控器和漫画阅读器遥控器。",
  "Phone remote": "手机遥控器",
  "Manga reader remote": "漫画阅读器遥控器",
  "Flip the switch above and the phone remote and manga reader remote addresses appear here.":
    "打开上方开关后，手机遥控器和漫画阅读器遥控器的地址会显示在此处。",
  "Live TV caches": "直播电视缓存",
  "Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.":
    "使用键盘或遥控器浏览海报行时，使用预加载的宽幅图片展开海报卡片。",
  "Add an M3U link or Xtream Codes login": "添加 M3U 链接或 Xtream Codes 登录信息",
  "Add playlist": "添加播放列表",
  "Harbor plays IPTV from your own provider. Add a playlist and the guide fills in.":
    "Harbor 可以播放你自己的服务提供商提供的 IPTV。添加播放列表后，节目指南会自动填充。",
  "Live TV playlists": "直播电视播放列表",
  "Press OK on a field to type, or use the Harbor remote on your phone.":
    "在字段上按 OK 即可输入，也可在手机上使用 Harbor 遥控器。",
  "Scan with your phone to sign in without typing on the remote.":
    "用手机扫码登录，无需通过遥控器输入。",
  "Set up Live TV": "设置直播电视",
  'Remove playlist "{name}"?': "移除播放列表“{name}”？",
  "Turn on controller support to light up your inputs here.":
    "开启手柄支持后，你的操作会实时显示在这里。",
  "Connect a controller: every press and stick move shows up here, live.":
    "连接手柄后，每次按键和摇杆移动都会实时显示在这里。",
  "Press buttons and move the sticks. This mirrors your controller in real time.":
    "按下按键并移动摇杆。这里会实时映射你的手柄操作。",
  "Off by default, so your controller only drives Harbor while it is the focused window. Leave it off if you play games with the same controller.":
    "默认关闭，因此只有 Harbor 窗口获得焦点时，手柄才能控制 Harbor。如果你还用同一手柄玩游戏，请保持关闭。",
  "British Television": "英国电视节目",
  "Top rated television": "评分最高的电视节目",
  "Unpin channel": "取消置顶频道",
  "DVR record (Live TV)": "DVR 录制（直播电视）",
  "Film and television": "电影与电视",
  "Television's finest": "电视界最高荣誉",
  "Sports & live TV": "体育与电视直播",
  Channel: "频道",
  "Live channel": "直播频道",
  Playlist: "播放列表",
  "Refresh playlist": "刷新播放列表",
  "This channel isn't responding": "此频道无响应",
  "Controller support": "控制器支持",
  "Enable controller": "启用控制器",
  "A direct .m3u or .m3u8 address from your provider": "服务提供商给出的直接 .m3u 或 .m3u8 地址",
  "Add a playlist": "添加播放列表",
  "An M3U link or Xtream Codes login. Entered on the TV so the credentials stay on it.":
    "M3U 链接或 Xtream Codes 登录信息。请在电视上输入，以便凭据仅保存在电视上。",
  "BAFTA Television": "英国电影和电视艺术学院电视奖",
  "Big Picture closes. Harbor keeps running behind it.": "大屏模式关闭。Harbor 继续在后台运行。",
  "Content filters (hide anime / manga / live tv / sports / adult)":
    "内容筛选（隐藏动画 / 漫画 / 电视直播 / 体育 / 成人内容）",
  "Controller connected": "手柄已连接",
  "Controller navigation on the TV": "在电视上使用手柄导航",
  "Couldn't load this playlist": "无法加载此播放列表",
  "Couldn't reach AniList. Check the connection and reopen Big Picture.":
    "无法连接 AniList。请检查网络连接并重新打开 Big Picture 模式。",
  "Couldn't reach MyAnimeList. Check the connection and reopen Big Picture.":
    "无法连接 MyAnimeList。请检查网络连接并重新打开 Big Picture 模式。",
  "Couldn't save the playlist. Free up storage space in Settings and try again.":
    "无法保存播放列表。请在“设置”中释放存储空间，然后重试。",
  "Everything on this page is written to your Harbor account. Your TV reads it on its next check-in, so you can set the whole thing up from here and never touch the remote.":
    "此页面上的所有设置都会写入你的 Harbor 账号。电视端会在下次同步时读取这些设置，因此你可以在这里完成全部设置，无需操作遥控器。",
  "Favorite {channel}": "收藏 {channel}",
  "Harbor couldn't reach MyAnimeList or AniList. Check the connection and reopen Big Picture.":
    "Harbor 无法连接 MyAnimeList 或 AniList。请检查网络连接并重新打开大屏模式。",
  "Kids profiles are not available in Big Picture yet.": "大屏模式暂不支持儿童个人资料。",
  "Leave Big Picture and open settings": "退出大屏模式并打开设置",
  "Live TV source": "直播源",
  "Live TV sources": "直播源",
  "M3U link": "M3U 链接",
  "M3U link, Xtream login, or guide data": "M3U 链接、Xtream 登录信息或节目指南数据",
  "Open the remote": "打开遥控器",
  "Paste a track, album or playlist link.": "粘贴单曲、专辑或播放列表链接。",
  "Pick the palette Big Picture wears on the television. A theme this computer knows but the TV does not is sent whole, colors and all.":
    "选择电视端大屏模式使用的配色。如果此电脑有某个主题而电视没有，系统会将整个主题连同所有颜色一起发送到电视。",
  "Playlist address": "播放列表地址",
  "Press the star on any channel to keep it at the top of the guide.":
    "按下任意频道上的星标，即可将其固定在节目指南顶部。",
  "Puts a Big Picture button in the top bar so you can switch to the ten-foot layout in one click. The keyboard shortcut keeps working either way.":
    "在顶栏中添加“大屏模式”按钮，让你一键切换到客厅大屏布局。无论是否显示此按钮，键盘快捷键都仍然有效。",
  "Remote control is off on that Harbor, so it cannot be driven from here.":
    "该 Harbor 已关闭远程控制，因此无法从这里操控。",
  "Remote control is off, so other Harbors can see this one but cannot drive it.":
    "远程控制已关闭，因此其他 Harbor 可以发现此设备，但无法操控。",
  "Remote control is on, so other Harbors on this network can drive this one.":
    "远程控制已开启，因此此网络中的其他 Harbor 可以操控此设备。",
  "Remote off": "远程控制已关闭",
  "Saved on that device. You can close this page, or use this phone as a remote.":
    "已保存在该设备上。你可以关闭此页面，也可以将此手机用作遥控器。",
  "Scan this with your phone camera to open the Harbor remote, then type straight into the search box.":
    "用手机相机扫描此码打开 Harbor 遥控器，然后直接在搜索框中输入。",
  "Television Award": "电视奖",
  "Test remote server connection": "测试远程服务器连接",
  "The Roku Channel": "The Roku Channel",
  "These need the television in front of you, either because they show a pairing code or because the credential should never leave the device.":
    "这些操作需要你在电视前完成，因为它们要么会显示配对码，要么要求登录凭据始终留在设备上。",
  "This playlist came back without any live channels.": "此播放列表中没有任何直播频道。",
  "Unfavorite {channel}": "取消收藏 {channel}",
  "Xbox controller connected": "Xbox 控制器已连接",
  "Xtream Codes": "Xtream Codes",
  "{count} manga items are not shown in Big Picture.": "大屏模式下未显示 {count} 个漫画项目。",
  "Big Picture": "大屏模式",
  "Leave Big Picture": "退出大屏模式",
  "Show the Big Picture button": "显示大屏模式按钮",
  "Adds a Big Picture button to Harbor's navigation. Turn this off to keep it out of the way.":
    "在 Harbor 导航中添加大屏模式按钮。关闭此项可隐藏该按钮。",
  "Open in Big Picture": "以大屏模式打开",
  "Launch straight into Big Picture when Harbor starts. Press Esc at any time to leave.":
    "Harbor 启动时直接进入大屏模式。随时按 Esc 即可退出。",
  "Harbor couldn't reach the catalog servers. Check the connection and reopen Big Picture.":
    "Harbor 无法连接到内容目录服务器。请检查网络连接，然后重新打开大屏模式。",
  "Controller navigation": "控制器导航",
  "Use a gamepad or remote to move around Harbor": "使用游戏手柄或遥控器在 Harbor 中导航",
  "Launch straight into Big Picture when Harbor starts": "Harbor 启动时直接进入大屏模式",
  "Test mode: your controller only moves this diagram. Press Esc to stop.":
    "测试模式：控制器只能操控此示意图。按 Esc 停止。",
  "Test controller": "测试控制器",
  "Controller cursor": "控制器光标",
  "Another program already holds this port, usually a Stremio server that is running on this machine. Harbor tried its spare ports too. Stop that server, or leave it running and point Harbor at it in Remote streaming server below.":
    "另一个程序已占用此端口，通常是此电脑上正在运行的 Stremio 服务器。Harbor 也尝试了备用端口。请停止该服务器，或让其继续运行，并在下方的“远程流媒体服务器”中配置 Harbor 使用该服务器。",
  "Powers everything on this page: the web app, the phone remote, and the manga reader remote.":
    "为本页的所有功能提供支持：Web 应用、手机遥控器和漫画阅读器遥控器。",
  "Size of the controller on-screen keyboard.": "控制器屏幕键盘的大小。",
  "Search {n} EPG channels#one": "搜索 {n} 个 EPG 频道",
  "Search {n} EPG channels#few": "搜索 {n} 个 EPG 频道",
  "this channel": "此频道",
  "Watch Live TV?": "要观看电视直播吗？",
  "Live TV can't be synced in a watch party, so playing {name} will leave your party. Everyone else can keep watching together.":
    "电视直播无法在观影派对中同步，因此播放 {name} 会使你离开派对。其他人仍可一起继续观看。",
  "Back to remote": "返回遥控器",
  "Remote style": "遥控器样式",
  Remote: "遥控器",
  "On your Roku remote, press Home.": "按 Roku 遥控器上的 Home 键。",
  'Search for "Media Assistant" (channel ID 782875, free).':
    "搜索“Media Assistant”（频道 ID 782875，免费）。",
  "No Live TV playlists yet": "尚无直播电视播放列表",
  "Add an M3U or Xtream playlist in Settings → Live TV to use the guide.":
    "在“设置”→“直播电视”中添加 M3U 或 Xtream 播放列表以使用节目指南。",
  "This playlist hasn't been loaded yet, or it has no channels.":
    "此播放列表尚未加载，或其中没有频道。",
  "Add a channel": "添加频道",
  "Change channel": "更换频道",
  "Search {n} channel": "搜索 {n} 个频道",
  "{n} channel": "{n} 个频道",
  "Live TV · {scope} · {minutes} min lead": "电视直播 · {scope} · 提前 {minutes} 分钟",
};

export default live;
