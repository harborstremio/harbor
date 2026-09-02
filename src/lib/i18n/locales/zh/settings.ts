const settings: Record<string, string> = {
  Settings: "设置",
  "Pick a profile to continue.": "选择个人资料以继续。",
  "Add profile": "添加个人资料",
  "Profile not found.": "找不到个人资料。",
  "Profile is locked. Enter the 4-digit PIN to continue.":
    "个人资料已锁定。请输入 4 位 PIN 以继续。",
  "Profile PIN": "个人资料 PIN",
  "Couldn't find an AniList avatar on your account.": "未在你的 AniList 账号中找到头像。",
  "Pick a 4-digit PIN. You'll be asked for it before this profile opens.":
    "选择一个 4 位 PIN。打开此个人资料前需要输入该 PIN。",
  "Use a separate Stremio account": "使用单独的 Stremio 账号",
  "Delete profile": "删除个人资料",
  "Delete this profile?": "删除此个人资料？",
  "Create profile": "创建个人资料",
  "Only the primary profile can edit other profiles.": "只有主个人资料可以编辑其他个人资料。",
  "Profile security": "个人资料安全",
  "{n} tabs require this profile's PIN.": "有 {n} 个标签页需要输入此个人资料的 PIN。",
  "Home layout": "首页布局",
  "Year, runtime, language, and country filters need TMDB. Genre browsing falls back to Cinemeta automatically.":
    "年份、时长、语言和国家筛选需要 TMDB。按类型浏览时会自动改用 Cinemeta。",
  "Original language": "原始语言",
  "Customize layout": "自定义布局",
  "Embedded subtitles keep their own styling. Click to force your style onto them.":
    "内嵌字幕会保留自身样式。点击可强制对其应用你的样式。",
  "Toggle guide layout": "切换节目指南布局",
  "Account is not active": "账号未激活",
  "Most common cause: this account is at its max simultaneous connections. Close other devices and players using these credentials.":
    "最常见的原因是此账号已达到最大同时连接数。请关闭其他正在使用这些凭据的设备和播放器。",
  profile: "个人资料",
  "Create Harbor account": "创建 Harbor 账户",
  "Sign out of Harbor account": "退出 Harbor 账户",
  "Settings for this profile (shared or independent)": "此个人资料的设置（共享或独立）",
  "Home style (Harbor curated / Classic Stremio)": "首页样式（Harbor 精选 / 经典 Stremio）",
  "Show an on-disk badge on cards": "在卡片上显示本地文件徽章",
  "Export badge setup": "导出徽章设置",
  "Downloaded community badge packs": "已下载的社区徽章包",
  "Test badge rules (Try it)": "测试徽章规则（试用）",
  "Settings storage breakdown": "设置存储空间明细",
  "Badge art": "徽章图稿",
  "Badge art back to default": "徽章图稿已恢复默认设置",
  "Badge remaps": "徽章重新映射",
  "Badge updated": "徽章已更新",
  "Edit layout": "编辑布局",
  "Every format badge Harbor can show on streams. Click one to swap its art, hide it, or reset it. Changes apply everywhere badges appear.":
    "Harbor 可在片源上显示的所有格式徽章。点击任一徽章即可替换其图稿、隐藏或重置。更改会应用到所有显示徽章的位置。",
  "Hide badge": "隐藏徽章",
  "Image too large. Keep badge files under 250 KB.": "图片过大。徽章文件请保持在 250 KB 以下。",
  "One-click community packs. Rulesets bring full badge sets with their own matching; art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link on the Nuvio Discord or Reddit imports here too.":
    "一键安装社区包。规则集提供自带匹配规则的完整徽章套装；图稿重映射仅替换 Harbor 内置徽章的图片。Nuvio Discord 或 Reddit 上以 badges.json 链接分享的内容也可在此导入。",
  "Restore previous settings": "恢复之前的设置",
  "Settings for this profile": "此配置文件的设置",
  "Show badge": "显示徽章",
  "The button set your layout is built on. Your customizations are kept separately for each style.":
    "布局所采用的按钮样式。每种样式的自定义设置会单独保留。",
  "Type what you want in plain language and let a model find it. Bring your own API key.":
    "用自然语言描述你想找的内容，让模型帮你查找。需使用你自己的 API 密钥。",
  "{themeName} theme": "{themeName} 主题",
  "Stretch the featured hero edge to edge and taller, across every layout.":
    "在所有布局中，让推荐焦点横幅横向铺满并增加高度。",
  "Display language": "显示语言",
  "Interface language": "界面语言",
  "Metadata language": "元数据语言",
  "Region & language": "地区和语言",
  "Apply {language}": "应用{language}",
  "Switch Harbor to {language}?": "将 Harbor 切换为{language}？",
  "If disabled, titles remain in their original language.": "若关闭，标题将保留原始语言。",
  "If disabled, overviews and taglines remain in their original language. (Applies only inside the details page)":
    "若关闭，简介和宣传语将保留原始语言。（仅适用于详情页）",
  "If disabled, posters remain in their original language. (Applies only inside the details page)":
    "若关闭，海报将保留原始语言。（仅适用于详情页）",
  "Switch the menus and buttons to your language. Arabic flips the layout to right to left.":
    "将菜单和按钮切换为你的语言。阿拉伯语会将布局改为从右到左。",
  "Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.":
    "如有译文，TMDB 中的标题、简介和宣传语将以此语言显示。需要 TMDB 密钥。",
  "Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.":
    "提示：Harbor 最初以英语开发，多语言支持尚不完整，因此插件通常能找到 Harbor 自身筛选器遗漏的内容。如果你使用其他语言并愿意协助补全，源代码已开源。",
  "Stremio account": "Stremio 账户",
  "Search settings": "搜索设置",
  Account: "账户",
  "A Cloudflare Worker on your own account that hosts your Watch Together rooms.":
    "在你自己的账户中运行的 Cloudflare Worker，用于托管你的“共同观看”房间。",
  "Theme & appearance": "主题和外观",
  "Color presets, custom backgrounds, and the font pair Harbor renders in.":
    "Harbor 使用的配色预设、自定义背景和字体组合。",
  "Badge position": "徽章位置",
  Appearance: "外观",
  Theme: "主题",
  "Build a new theme": "新建主题",
  "Copy theme": "复制主题",
  "Apply custom theme": "应用自定义主题",
  "Color tokens": "颜色令牌",
  "Theme cheat sheet": "主题速查表",
  "Sidebar layout": "侧边栏布局",
  "Make your own in the Theme Studio, or import one a friend shared.":
    "在主题工作室中自行创建，或导入好友分享的主题。",
  "Build a Theme": "创建主题",
  "Pick a layout, set colors and fonts. No code needed.":
    "选择布局并设置颜色和字体。无需编写代码。",
  "Import a Theme": "导入主题",
  "Got a theme a friend shared? Drop it in.": "有朋友分享的主题？拖到这里即可。",
  "Your face in Watch Together rooms, sessions, and chat. Sits on top of your Stremio account.":
    "你在一起看房间、会话和聊天中显示的头像，将取代 Stremio 账户头像。",
  "Click the button below. It opens Cloudflare's token page in your browser. Sign in (free, takes 30 seconds if you don't have an account).":
    "点击下方按钮，在浏览器中打开 Cloudflare 令牌页面。登录即可（免费；如果没有账户，注册约需 30 秒）。",
  "Which account should the relay live in?": "要将中继部署到哪个账户？",
  "Send this to anyone you want to watch with. They paste it in their Settings → Harbor Relay. After that, share a 6-character room code from the people icon up top.":
    "将此 URL 发给想一起观看的人。对方需将其粘贴到“设置 → Harbor 中继”。之后，通过顶部的人物图标分享一个 6 字符房间代码。",
  "Open profile": "打开个人资料",
  "Connect your AniList account": "连接你的 AniList 账户",
  "Show your AniList profile picture as your Harbor avatar.":
    "使用你的 AniList 头像作为 Harbor 头像。",
  "Open Settings": "打开设置",
  "add one in settings": "在设置中添加一个",
  "New profile": "新建个人资料",
  "{n} tab requires this profile's PIN.": "{n} 个标签页需要此个人资料的 PIN。",
  Accessibility: "无障碍",
  "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.":
    "高级用户选项。将你自己的 CSS、JS 和 HTML 注入 Harbor。代码保存在本地设置中，不会离开你的设备。",
  Profile: "配置方案",
  "on the {themeName} theme.": "在 {themeName} 主题中。",
  "Couldn't save your layout. {error}": "无法保存布局。{error}",
  "Couldn't switch profile. {error}": "无法切换配置方案。{error}",
  "Couldn't create the profile. {error}": "无法创建配置方案。{error}",
  "Couldn't rename the profile. {error}": "无法重命名配置方案。{error}",
  "Delete this profile permanently? This cannot be undone.":
    "要永久删除此配置方案吗？此操作无法撤销。",
  "Couldn't delete the profile. {error}": "无法删除配置方案。{error}",
  "A free Cloudflare account.": "一个免费的 Cloudflare 账户。",
  "Open Settings, then Harbor Relay.": "打开“设置”，然后进入“Harbor 中继”。",
  "Pick the Cloudflare account to deploy under.": "选择用于部署的 Cloudflare 账户。",
  "Wait for the upload to finish. The relay URL gets written to {code} in Harbor settings.":
    "等待上传完成。中继 URL 会写入 Harbor 设置中的 {code}。",
  "In Harbor: Settings, Harbor Relay, then {kbd}. Paste the URL with {code1} as the scheme instead of {code2}.":
    "在 Harbor 中依次进入“设置”、“Harbor 中继”，然后点击 {kbd}。粘贴 URL，并使用 {code1} 作为协议，而不是 {code2}。",
  "Settings, Harbor Relay, then {kbd}.": "依次进入“设置”、“Harbor 中继”，然后点击 {kbd}。",
  "To run a public relay, post the {code} URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay, {kbd}.":
    "如需运行公共中继，请将 {code} URL 发布到 r/Stremio 或你的社区活跃的平台。其他 Harbor 用户可将其粘贴到“设置”>“Harbor 中继”> {kbd} 中。",
  "Cloudflare token form filled with name 'Harbor Relay' and one permission row set to Account / Workers Scripts / Edit":
    "Cloudflare 令牌表单，名称填写为“Harbor Relay”，其中一行权限设为“账户 / Workers Scripts / 编辑”",
  "Your account hasn't picked its free {code} address yet. Cloudflare only asks the first time. Quick to set up.":
    "您的账户尚未选择免费的 {code} 地址。Cloudflare 只会在首次使用时询问，设置很快即可完成。",
  "Your color": "你的颜色",
  "Used for your cursor in Watch Together, your draw color, and your name pill in chat.":
    "用于一起看时的光标、绘图颜色和聊天中的昵称标签。",
  "New layout": "新建布局",
  "Save layout": "保存布局",
  "Delete layout": "删除布局",
  "Layout name": "布局名称",
  "Reset layout": "重置布局",
  "Use my style": "使用我的样式",
  "Force your font, size, and color onto styled subs. Use this for Arabic or any subs showing boxes. Can affect karaoke and signs.":
    "将你的字体、大小和颜色强制应用于样式化字幕。阿拉伯语字幕或任何显示方框的字幕可使用此选项。可能影响卡拉 OK 和标识文字。",
  "Seeing empty boxes instead of letters? Choose Arabic under Font and switch to Use my style.":
    "看到的是空方框而不是文字？请在“字体”中选择“阿拉伯语”，并切换到“使用我的样式”。",
  "Render subtitles in a heavier weight. Turn off to use your font's normal weight.":
    "以较粗字重渲染字幕。关闭后使用字体的正常字重。",
  "Text color": "文字颜色",
  "Outline color": "描边颜色",
  "Box color": "背景框颜色",
  "Upload font": "上传字体",
  "Delete this font?": "要删除此字体吗？",
  "Bar style": "进度条样式",
  "Image bar active. Pick a style above to switch back, or clear the image below.":
    "图片进度条已启用。选择上方样式可切回，或清除下方图片。",
  "Bar color": "进度条颜色",
  "Rounded square in the same color.": "相同颜色的圆角方块。",
  "Probes the server's settings endpoint from this device.": "从此设备探测服务器的设置端点。",
  "Display what you are watching on your Discord profile, with the show poster and a live progress bar. Requires the Discord desktop app to be running.":
    "在 Discord 个人资料中显示你正在观看的内容，并附带节目海报和实时进度条。需要运行 Discord 桌面应用。",
  "Punchier color": "更鲜艳的色彩",
  "Color & HDR": "色彩与 HDR",
  "in Harbor settings.": "Harbor 设置中。",
  "In Harbor: Settings, Harbor Relay, then": "在 Harbor 中，依次前往“设置”>“Harbor Relay”，然后",
  "Settings, Harbor Relay, then": "依次前往“设置”>“Harbor Relay”，然后",
  "URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay,":
    "URL 发布到 r/Stremio 或您的社区所在平台。其他 Harbor 用户可将其粘贴到“设置”>“Harbor Relay”中，",
  "You must install this addon in your Stremio account first so Harbor can fetch its works.":
    "必须先在 Stremio 账户中安装此插件，Harbor 才能获取其中的作品。",
  "No filter. Home shows every language.": "不筛选。首页显示所有语言的内容。",
  "language. Home filters to it.": "种语言。首页会按该语言筛选。",
  "Type what you want in plain language and let a model find it. Bring your own OpenRouter key.":
    "用自然语言描述你想看的内容，让模型帮你查找。需要使用你自己的 OpenRouter 密钥。",
  'Adds an "Ask AI" button to search, so you can type things like a plain-language request.':
    "在搜索中添加“询问 AI”按钮，以便用自然语言描述你的需求。",
  "Watched badge": "已观看徽章",
  "Keep Continue Watching private to each profile": "让每个个人资料的“继续观看”保持私密",
  "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.":
    "只显示当前个人资料的“继续观看”。每个个人资料只能看到自己的观看进度，因此与你共用此 Stremio 账号的其他个人资料无法得知你观看的内容。",
  "A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.":
    "鼠标悬停时，海报上会出现细腻的 tvOS 风格扫光效果。默认关闭；无论是否开启，卡片浮起效果都会保留。",
  "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.":
    "遥控器服务由桌面应用提供。请在电脑上的 Harbor 中打开这些设置以获取链接。",
  "Settings storage": "设置存储空间",
  "Badge art packs you installed from the community store. Remove one to put its badges back to default.":
    "你从社区商店安装的徽章图包。移除某个图包后，其中的徽章会恢复默认样式。",
  "View community badge packs": "查看社区徽章图包",
  "Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.":
    "为胶囊形搜索框和横栏滚动箭头使用液态玻璃效果。以下外观设置会应用于 Harbor 中的所有玻璃表面。",
  "Native-style hybrid bar": "原生风格混合标题栏",
  "The operating system draws native window controls, so Harbor cannot change their appearance.":
    "原生窗口控件由操作系统绘制，因此 Harbor 无法更改其外观。",
  "Give to any charity below or subscribe to ElfHosted, and the badge lands on your profile.":
    "向下方任一慈善机构捐款或订阅 ElfHosted，徽章就会显示在你的个人资料中。",
  "To get a Charity badge, forward your donation receipt or invoice to":
    "要获得慈善徽章，请将捐款收据或发票转发至",
  "with your @handle in the body so we can match it to your account.":
    "并在正文中注明你的 @handle，以便我们与你的账号匹配。",
  "Stremio Supporters get a special badge on their Harbor profile.":
    "Stremio 支持者会在 Harbor 个人资料中获得专属徽章。",
  "Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.":
    "支持 ElfHosted 或 Stremio，或向下方任一慈善机构捐款，徽章就会显示在你的个人资料中。",
  "Clock style": "时钟样式",
  "Uses your theme's accent color.": "使用主题的强调色。",
  "Finish setting up Harbor": "完成 Harbor 设置",
  "Your name and the details shown at the top of your profile.":
    "你的姓名及个人资料顶部显示的详细信息。",
  "Your avatar, banner, and how the whole profile is styled.":
    "你的头像、横幅及整个个人资料的样式。",
  "Pick what appears on your profile, and the order it shows in.":
    "选择个人资料中显示的内容及其顺序。",
  "Show a Minecraft card on your profile. Leave the username blank to hide it.":
    "在个人资料中显示 Minecraft 卡片。将用户名留空即可隐藏。",
  "Ratings need a Harbor account": "评分需要 Harbor 账号",
  "Your Harbor account is separate from your Stremio sign in. Create one free or sign in from Settings.":
    "你的 Harbor 账号与 Stremio 登录账号相互独立。可免费创建账号，或前往“设置”登录。",
  "Open account settings": "打开账号设置",
  "Your review contains language that is not allowed": "你的短评包含不允许使用的语言",
  "Choose which stats show in the row at the top of your profile":
    "选择要在个人资料顶部一行显示的统计数据",
  "Pick the stats that show in the row at the top of your public profile. At least one has to stay visible.":
    "选择要在公开个人资料顶部一行显示的统计数据。至少须保留一项可见。",
  "Profile cards": "个人资料卡片",
  "Pick which cards show on your profile, and the order they appear in":
    "选择个人资料中显示的卡片及其顺序",
  "These cards run down your public profile. Set the order they appear in, and hide any you would rather keep to yourself.":
    "这些卡片会依次显示在你的公开个人资料中。设置其显示顺序，并隐藏你不想公开的卡片。",
  "Pick up to {max} lists to show on your public profile.":
    "最多选择 {max} 个列表显示在你的公开个人资料中。",
  "Open {alias} profile": "打开 {alias} 的个人资料",
  "Hidden language": "隐藏的语言",
  "Open @{handle} profile": "打开 @{handle} 的个人资料",
  "Preview unavailable. Click to open profile.": "无法预览。点击打开个人资料。",
  "Share profile": "分享个人资料",
  "Profile link": "个人资料链接",
  "Profile background": "个人资料背景",
  "Could not load this profile": "无法加载此个人资料",
  "We could not find anyone at @{handle}. The handle may have changed or the profile was removed.":
    "找不到 @{handle}。该用户名可能已更改，或个人资料已被删除。",
  "Pick up to {max} games to show on your profile.": "最多选择 {max} 款游戏展示在个人资料中。",
  "Pick up to {max} books to show on your profile.": "最多选择 {max} 本书展示在个人资料中。",
  "Pick up to {max} artists to show on your profile.": "最多选择 {max} 位艺人展示在个人资料中。",
  "Use your Harbor color": "使用你的 Harbor 主题色",
  "Transfer to another profile": "转移到其他个人资料",
  "Add your Groq API key in Settings, AI search to use this model.":
    "在“设置”中添加 Groq API 密钥，以便 AI 搜索使用此模型。",
  "Add your OpenRouter API key in Settings, AI search to use this model.":
    "在“设置”中添加 OpenRouter API 密钥，以便 AI 搜索使用此模型。",
  "Row card style": "横排卡片样式",
  "Edit your profile and reorder it your way: pick a font, a background, and drag your cards into the order you like.":
    "编辑个人资料并按自己的方式重新排列：选择字体和背景，再拖动卡片按喜欢的顺序排列。",
  "Off keeps your font, background, and canvas as a private preview.":
    "关闭后，你的字体、背景和画布仅供自己预览。",
  "Group font": "小组字体",
  "Background color": "背景颜色",
  "Your canvas runs in a sandbox with no scripts, so use HTML and CSS for layout and art.":
    "画布在无脚本的沙盒中运行，请使用 HTML 和 CSS 进行布局和创作。",
  "Font name can only use letters, numbers, and spaces.": "字体名称只能包含字母、数字和空格。",
  "Background color must be a hex or rgb/hsl value.": "背景颜色必须是 hex 或 rgb/hsl 值。",
  "Primary profile": "主个人资料",
  "Make this the primary profile": "设为主个人资料",
  "This is the primary profile": "这是主个人资料",
  "It manages profiles and can't be deleted. Hand primary to another profile to delete this one.":
    "它用于管理其他个人资料，且无法删除。将主身份交给其他个人资料后，才能删除此个人资料。",
  "View my profile": "查看我的个人资料",
  "Heads up: most IPTV providers cap how many streams an account can run at the same time. If other devices or players are using these credentials, close them and try again.":
    "请注意：大多数 IPTV 提供商会限制同一账号的并发播放数量。如果其他设备或播放器正在使用这些登录凭据，请将其关闭后重试。",
  "Harbor account": "Harbor 账号",
  "Everything here is already in your account.": "这里的所有内容都已在你的账号中。",
  "Moved 1 addon to your Stremio account. It now syncs everywhere you sign in.":
    "已将 1 个插件移至你的 Stremio 账号。现在，该插件会在你登录的所有设备上同步。",
  "Add every addon below to your Stremio account": "将下方所有插件添加到你的 Stremio 账号",
  "Move all to account": "全部移至账号",
  "Anything you install here saves to your Stremio account, so your addons are ready when you open Stremio on your phone.":
    "你在这里安装的任何内容都会保存到你的 Stremio 账号，这样在手机上打开 Stremio 时，插件就已准备就绪。",
  "For reliable HDR on this display, switch to True HDR, separate window in Settings.":
    "要在此显示器上稳定使用 HDR，请在“设置”中切换到“真 HDR，独立窗口”。",
  "Feature a theme": "精选一个主题",
  "Styled (ASS) subs keep their own font, color, and size. Truest to the release, but the size can vary a lot between files.":
    "带样式的字幕（ASS）会保留自身的字体、颜色和字号，最贴近原始发布效果，但不同文件的字号可能差异很大。",
  "Force your size, font, and color onto styled subs so every file looks consistent. Best fix if embedded sizes keep changing, or for Arabic and subs showing boxes. Can affect karaoke and signs.":
    "将你的字号、字体和颜色强制应用于带样式的字幕，让所有文件显示一致。如果内嵌字号总在变化，或阿拉伯语等字幕显示方框，这是最佳解决方案。可能会影响卡拉 OK 和标牌字幕。",
  "Embedded subtitles changing size between titles, or showing empty boxes? Switch to Use my style for a consistent size. For boxes, also choose Arabic under Font.":
    "不同影片的内嵌字幕字号不断变化，或显示为空方框？请切换到“使用我的样式”以统一字号。如出现方框，还请在“字体”中选择“阿拉伯语”。",
  "Add a TMDB key in Settings to unlock the full discovery feed.":
    "在设置中添加 TMDB 密钥，即可解锁完整的探索信息流。",
  "Open relay settings": "打开中继设置",
  "This catalog came back empty. Try another one, or check the addon in Settings.":
    "此目录中没有内容。请尝试其他目录，或前往设置检查该插件。",
  "Add a TMDB key in Settings to browse collections.": "在设置中添加 TMDB 密钥即可浏览合集。",
  "Come back tomorrow, or clear what you skipped in Settings.":
    "明天再来，或在“设置”中清除已跳过的内容。",
  "Kinetic Style": "动感风格",
  "Open settings": "打开设置",
  "Edit profile": "编辑个人资料",
  "Add a TMDB key in settings first": "请先在设置中添加 TMDB 密钥",
  "Set as theme backdrop": "设为主题背景",
  "Switch to Manual in settings if you'd rather pick the source yourself.":
    "如果你想自行选择片源，请在设置中切换为“手动”。",
  Font: "字体",
  "Connect your AniList account to see forum threads and comments.":
    "连接你的 AniList 账号即可查看论坛主题和评论。",
  "Couldn't read that font file.": "无法读取该字体文件。",
  "Create account": "创建账号",
  "Layout editor": "布局编辑器",
  "Save as new profile...": "另存为新配置...",
  "Reset this profile to factory defaults? Your tweaks on it will be lost.":
    "要将此配置重置为出厂默认设置吗？您对此配置所做的调整将会丢失。",
  "Addon order synced to your Stremio account": "插件顺序已同步到您的 Stremio 账号",
  "Anything you install in Harbor pushes back to your Stremio account so it shows up on mobile too. Sign in via the avatar in the bottom-left of the sidebar.":
    "您在 Harbor 中安装的任何插件都会同步回 Stremio 账号，因此也会显示在移动端。请通过侧边栏左下角的头像登录。",
  "Captions in your language": "您所选语言的字幕",
  "Add a TMDB key in Settings to load Arabic content.":
    "在“设置”中添加 TMDB 密钥以加载阿拉伯语内容。",
  "Parental controls are on. Enter your PIN to access settings.":
    "家长控制已开启。请输入 PIN 以访问设置。",
  "You'll need this to access settings while controls are on.":
    "家长控制开启时，需要此 PIN 才能访问设置。",
  "View profile": "查看个人资料",
  "Pick a home layout": "选择首页布局",
  "Don't have an account?": "还没有账号？",
  "Don't have an account? Create one →": "还没有账号？创建账号 →",
  "These rails activate once a TMDB key is set. You can come back to this anytime in Settings.":
    "设置 TMDB 密钥后，这些内容栏便会启用。你随时可以在“设置”中返回这里。",
  "Running on Cinemeta for now. Add a TMDB key from Settings whenever you're ready.":
    "目前使用 Cinemeta。准备好后，可随时在“设置”中添加 TMDB 密钥。",
  "Browse by Language": "按语言浏览",
  'Heads-up: a few addons (like AIOStatus) don\'t pre-fill from the URL. If the form loads blank, paste the existing manifest URL into their "Import from URL" field to restore your settings.':
    "注意：少数插件（如 AIOStatus）不会根据 URL 预填内容。如果表单加载后为空，请将现有 manifest URL 粘贴到其“从 URL 导入”字段中，以恢复你的设置。",
  "Your Stremio account": "你的 Stremio 账户",
  "This order syncs to every Stremio app signed into this account.":
    "此顺序会同步到所有已登录此账户的 Stremio 应用。",
  "No addons are synced to this account yet.": "此账户尚未同步任何插件。",
  "These live in Harbor on this computer and never touch your account.":
    "这些插件仅保存在这台电脑上的 Harbor 中，绝不会同步到你的账户。",
  "Sign in to Stremio to organize the addons synced to your account.":
    "登录 Stremio 以整理同步到你账户的插件。",
  "Proper search across providers, foreign-language coverage.":
    "跨提供商精准搜索，并覆盖外语内容。",
  "AI Search · natural-language search": "AI 搜索 · 自然语言搜索",
  "Connect your MyAnimeList account": "连接你的 MyAnimeList 账号",
  "Custom style": "自定义样式",
  "Edit custom theme": "编辑自定义主题",
  "Edit hover style": "编辑悬停样式",
  "Home Rail Settings": "首页内容栏设置",
  "How much of each source's description the Stremio picker layout shows. Full keeps everything the addon sends, which matters for AIOStreams and other custom formats.":
    "Stremio 选择器布局中每个来源描述的显示长度。“完整”会保留插件发送的全部内容，这对 AIOStreams 和其他自定义格式非常重要。",
  "How often the profile screen appears when you have more than one profile.":
    "拥有多个个人资料时，个人资料界面的显示频率。",
  "How you appear in Watch Together, sessions, and chat. Sits on top of your Stremio account.":
    "你在“一起观看”、会话和聊天中显示的形象，基于你的 Stremio 账户设置。",
  "Kids profile": "儿童个人资料",
  Language: "语言",
  "New hover style": "全新悬停样式",
  "Nothing matched this filter. Try another category or change your region in Settings.":
    "没有符合此筛选器的内容。请尝试其他类别，或在“设置”中更改你的地区。",
  "Pick a display and body pairing, or upload your own font to use across Harbor.":
    "选择一种标题与正文字体组合，或上传你自己的字体以在整个 Harbor 中使用。",
  "Pick a look. Every color and surface updates instantly.":
    "选择一种外观。所有颜色和界面元素都会立即更新。",
  "Picker layout": "选择器布局",
  "Poster card style": "海报卡片样式",
  "Profile details not available.": "无法获取个人资料详情。",
  "Set your MyAnimeList profile picture as your Harbor avatar.":
    "将你的 MyAnimeList 头像设为 Harbor 头像。",
  "Show an “on disk” badge on cards": "在卡片上显示“本地已有”徽标",
  "Show each source's full release filename on the condensed layout. The Stremio layout already shows it.":
    "在紧凑布局中显示每个来源的完整发行文件名。Stremio 布局已默认显示。",
  "Skip Who's watching and always start as this profile. PIN-locked profiles can't be a default.":
    "跳过“谁在观看”并始终以此个人资料启动。受 PIN 码保护的个人资料不能设为默认资料。",
  "Style name": "样式名称",
  "Switch profile": "切换个人资料",
  "Translate plot descriptions and taglines into the language above. Turn off to keep English overviews.":
    "将剧情简介和宣传语翻译成上方所选语言。关闭后保留英文简介。",
  "How the buttons map in each context. This is a reference; the layout is fixed.":
    "各场景下的按键功能。此处仅供参考，布局不可更改。",
  "Add your TMDB key in Settings first": "请先在设置中添加 TMDB 密钥",
  "Add your TMDB key in Settings to search.": "请在设置中添加 TMDB 密钥以进行搜索。",
  "Connect {name} in Settings first": "请先在设置中连接 {name}",
  "Install more shaders in Settings, Shaders to switch between them here.":
    "请在“设置 > 着色器”中安装更多着色器，以便在此处切换。",
  "Local storage is full, these ratings live on your account only.":
    "本地存储空间已满，这些评分将仅保存在你的账户中。",
  "Mute all profile songs": "将所有个人主页歌曲静音",
  "People can pin a track to their profile. This controls what happens when you visit one.":
    "用户可以将一首歌曲置顶到个人资料。此设置控制你访问其个人资料时的播放行为。",
  "Pick your language": "选择你的语言",
  "Portuguese-Language": "葡萄牙语作品",
  "Profile song": "个人资料歌曲",
  "Profile songs": "个人资料歌曲",
  "Profile songs stay hidden and never play.": "个人资料歌曲会保持隐藏，且不会播放。",
  "Spanish-Language": "西班牙语作品",
  "User-made badge packs from the community store": "来自社区商店的用户自制徽章包",
  "You earned a new badge": "你获得了一枚新徽章",
  "You earned the {name} badge": "你获得了「{name}」徽章",
  "A Harbor account": "一个 Harbor 账号",
  "A public profile with your stats, lists, badges, and custom styling.":
    "公开展示你的统计数据、列表、徽章和自定义样式的个人资料。",
  "Add a TMDB key in Settings to fill this page with curated series rows.":
    "在设置中添加 TMDB 密钥，即可在此页面显示精选剧集内容行。",
  "Affected settings:": "受影响的设置：",
  "Another phone is already setting this TV up.": "另一部手机已在设置此电视。",
  "Any language": "任何语言",
  "Choose your language": "选择语言",
  Color: "颜色",
  "Color & HDR tone-mapping": "色彩与 HDR 色调映射",
  "Copied {n} settings": "已复制 {n} 项设置",
  "Copy my settings to the TV": "将我的设置复制到电视",
  "Copy the settings you already tuned here onto the TV in one go. It overwrites the matching TV rows and leaves everything else alone.":
    "一次性将你已在此调好的设置复制到电视。此操作会覆盖电视端对应的设置项，其他设置保持不变。",
  "Create a Harbor account": "创建 Harbor 账号",
  "Create your account": "创建账号",
  "Custom regex badge rules": "自定义正则表达式徽章规则",
  "Deletes the Worker from your Cloudflare account. Rooms in progress end immediately.":
    "从你的 Cloudflare 账号中删除 Worker。正在进行的房间会立即结束。",
  "Display language on the TV": "电视端显示语言",
  "Each style keeps its own arrangement, icons and profiles, so switching back and forth never loses work.":
    "每种样式都有各自的布局、图标和配置，因此来回切换也不会丢失设置。",
  "Engine status and your P2P settings as JSON, ready to paste into a bug report.":
    "引擎状态和你的 P2P 设置，以 JSON 格式提供，可直接粘贴到错误报告中。",
  "Every Harbor that announces itself on this network appears here as it answers, with the theme it is wearing.":
    "此网络中所有广播自身信息的 Harbor 都会在响应时显示于此，并附带其当前使用的主题。",
  "Finish creating my account": "完成账号创建",
  "Harbor account linked as {name}": "Harbor 账号已关联为 {name}",
  "Harbor account signed in": "已登录 Harbor 账号",
  "Harbor asks your addons for titles and descriptions in this language. The TV menus stay in English.":
    "Harbor 会以此语言向你的插件请求片名和描述。电视端菜单仍为英文。",
  "Harbor creates a Cloudflare Worker on your own free account and saves the URL.":
    "Harbor 会在你自己的免费账号上创建 Cloudflare Worker 并保存 URL。",
  "Harbor identity (avatar / color)": "Harbor 身份（头像/颜色）",
  "Harbor speaks this everywhere. You can change it later in Settings.":
    "Harbor 会在所有界面使用此语言。你可以稍后在设置中更改。",
  "Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help, the source is open.":
    "Harbor 最初以英文开发。多语言支持尚不完整，因此你的插件通常能找到 Harbor 自带筛选器漏掉的内容。如果你使用其他语言并愿意提供帮助，源代码已开放。",
  "Home layout on the TV": "电视端首页布局",
  "Home style": "首页样式",
  "Hover style": "悬停样式",
  "How much theme color the surface carries.": "表面融入主题色的程度。",
  "I already have a TMDB account": "我已有 TMDB 账号",
  "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.":
    "如果此账号已关联 Discord，我们会私信发送一个代码，让你无需恢复密钥即可重置密码。",
  "Import a badge pack": "导入徽章包",
  "Import badge packs (Nuvio)": "导入徽章包（Nuvio）",
  "Installing and ordering addons on the TV. Addon lists already travel with your account, so install here and the TV picks them up.":
    "在电视上安装插件并调整顺序。插件列表已随账号同步，因此在这里安装后，电视也会自动获取。",
  "Interface scale (accessibility)": "界面缩放比例（无障碍）",
  "Keep setting up": "继续设置",
  "Kept. Your TV gets your account when you continue.": "已保留。继续后，电视将获取你的账号。",
  LANGUAGE: "语言",
  "Language for titles": "标题语言",
  "Let the TV keep its own theme": "让电视保留自己的主题",
  "Linked to your Harbor account.": "已关联到你的 Harbor 账号。",
  "No Harbor account yet": "还没有 Harbor 账号",
  "No files from your computer yet. Add a folder in Settings.":
    "您的电脑上还没有文件。请在“设置”中添加文件夹。",
  "No language matches that search.": "没有与该搜索匹配的语言。",
  "On themoviedb.org, open Settings.": "在 themoviedb.org 上打开“设置”。",
  "Open Account": "打开账号",
  "Open AniList profile": "打开 AniList 个人资料",
  "Open MAL profile": "打开 MAL 个人资料",
  "Opens your API settings page": "打开你的 API 设置页面",
  "Overwrite {n} TV settings": "覆盖 {n} 项电视设置",
  "Pick a metadata language above to translate overviews.":
    "在上方选择元数据语言，以翻译内容简介。",
  "Pick a style to turn interface sounds on.": "选择一种样式以开启界面音效。",
  "Picker layout (Condensed / Stremio)": "选择器布局（紧凑 / Stremio）",
  "Preview style": "预览样式",
  "Pulled from your Stremio account.": "从你的 Stremio 账户获取。",
  "Reset layout to defaults": "将布局重置为默认值",
  "Running on Cinemeta. Add a TMDB key in Settings whenever you want.":
    "当前使用 Cinemeta。你可以随时在设置中添加 TMDB 密钥。",
  "Saving to your profile": "正在保存到你的个人资料",
  "Send the theme you are looking at right now, exactly as it is here.":
    "将你当前看到的主题按原样发送。",
  "Setting up the hand-off…": "正在设置移交…",
  "Settings, lists and progress follow you between machines.":
    "设置、列表和进度会在不同设备间同步。",
  "Show an on disk badge on cards": "在卡片上显示“已存储到磁盘”徽章",
  "Signing in to your Harbor account. Your profiles will appear in a moment.":
    "正在登录你的 Harbor 账户。你的个人资料稍后就会显示。",
  "Skip Who's watching and always start as this profile.": "跳过“谁在观看”，始终以此个人资料启动。",
  "Sound profile": "声音配置",
  "Sound style": "声音风格",
  "Stremio account (email / sign out)": "Stremio 账户（邮箱/退出登录）",
  "Syncs your profile, themes, lists and friends. Optional, and you can do it later.":
    "同步你的个人资料、主题、列表和好友。此操作可选，也可稍后进行。",
  "TV Settings": "电视设置",
  "The language TMDB serves show and film text in. Separate from the interface language above.":
    "TMDB 提供剧集和电影文本时使用的语言。与上方的界面语言不同。",
  "The same camera pan on each setting. The lit lane is what you get right now.":
    "每种设置都使用同一个镜头平移画面。高亮的一栏就是当前效果。",
  "The two clock labels are ordinary controls. Move or hide either of them in the layout editor.":
    "两个时间标签都是普通控件。可在布局编辑器中移动或隐藏任意一个。",
  "Theme Studio / your themes": "主题工作室/你的主题",
  "Theme on the TV": "电视上的主题",
  "Theme preset": "主题预设",
  "Themes, lists and friends follow this account.": "主题、列表和好友将跟随此账户。",
  "There is no safe way to type a password for this on a TV, so this one only happens on your phone. Settings has it whenever you want it.":
    "无法在电视上安全输入此项的密码，因此只能在手机上操作。需要时可随时前往“设置”。",
  "These settings belong to a profile, and this computer is not in one. Pick a profile and the TV will follow it.":
    "这些设置属于个人资料，而此电脑当前未选择任何个人资料。请选择一个个人资料，电视将随之切换。",
  "This is the only way back into your account if you forget your password. It is shown once.":
    "如果忘记密码，这是找回账户的唯一方式。它只会显示一次。",
  "This opens Harbor to devices on your Wi-Fi. You can turn it off again in Settings.":
    "这会允许 Wi-Fi 网络中的设备访问 Harbor。你可以随时在“设置”中再次关闭。",
  "Upload a font": "上传字体",
  "When you open a profile": "打开个人资料时",
  "Who watches on the TV. The roster already syncs from your account, so add people here on the computer and they appear on the TV.":
    "在电视上观看的用户。成员名单已从你的账户同步，因此在电脑上添加用户后，他们也会出现在电视上。",
  "You are not signed in to a Harbor account, so nothing here can reach the TV.":
    "你尚未登录 Harbor 账号，因此此处的任何内容都无法发送到电视。",
  "Your Harbor account": "你的 Harbor 账号",
  "Your Harbor account is signed in on the TV.": "你的 Harbor 账号已在电视上登录。",
  "Your handle, your themes, your settings. Signed in once, waiting on the next machine you open.":
    "你的用户名、主题和设置。登录一次，即可同步至你接下来打开的设备。",
  "Your themes, lists, and profile follow you to any device.":
    "你的主题、片单和个人资料会同步到所有设备。",
  "Choose who can see the friends on your profile": "选择谁可以看到你个人资料中的好友",
  "Confirm you own this Stremio account ({email}).": "确认此 Stremio 账号（{email}）属于你。",
  "Confirm you own your Stremio account.": "确认你拥有此 Stremio 账号。",
  "Linked to a real Stremio account.": "已关联到真实的 Stremio 账号。",
  "None of your addons returned a downloadable package for {season}. Refresh the sources or check your source settings.":
    "你的插件均未返回 {season} 的可下载资源包。请刷新来源或检查来源设置。",
  "Prove you own a real Stremio account.": "证明你拥有真实的 Stremio 账号。",
  "Signed in to your Harbor account": "已登录你的 Harbor 账号",
  "Source settings": "来源设置",
  "The 20-character key from when you created your account. Paste it or type each block.":
    "这是创建账号时获得的 20 个字符密钥。请粘贴密钥或逐段输入。",
  "This font did not load. Remove it and upload it again.": "此字体加载失败。请移除后重新上传。",
  "Use a different Stremio account": "使用其他 Stremio 账号",
  "Loading settings": "正在加载设置",
  "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.":
    "更改元数据语言会重新加载 Harbor，以使新语言生效。完成上方选项设置后再应用。",
  "Content advisory style": "内容提示样式",
  "On shows titles in your metadata language (English by default). Off keeps titles in English.":
    "开启后，标题将以你的元数据语言显示（默认为英语）；关闭后，标题保留英语。",
  "Use color to distinguish severity, or keep every advisory monochrome.":
    "使用颜色区分严重程度，或让所有提示都以单色显示。",
  "{n} tab requires this profile's PIN.#one": "{n} 个标签页需要输入此个人资料的 PIN。#one",
  "{n} tab requires this profile's PIN.#few": "{n} 个标签页需要输入此个人资料的 PIN。#few",
  "{n} tabs require this profile's PIN.#one": "{n} 个标签页需要输入此个人资料的 PIN。#one",
  "{n} tabs require this profile's PIN.#few": "{n} 个标签页需要输入此个人资料的 PIN。#few",
  'Your account goes "overdrawn". What happened?': "你的账户“透支”了。这意味着什么？",
  "Your bank locked the account": "银行锁定了你的账户",
  "Translate it into another language": "将其翻译成另一种语言",
  "Whatever's in your bank account": "你银行账户中的全部资金",
  "Setting up an addon": "正在设置插件",
  "Could not serialize profile (a value may be circular).":
    "无法序列化配置方案（某个值可能存在循环引用）。",
  "Profile data is too large ({mb} MB). Remove unused custom icons or delete an old profile, then try again.":
    "配置方案数据过大（{mb} MB）。请移除未使用的自定义图标或删除旧配置方案，然后重试。",
  "My layout": "我的布局",
  "File is not a Harbor layout profile.": "该文件不是 Harbor 布局配置方案。",
  "Unsupported profile version ({version}). Update Harbor or use an older profile.":
    "不支持的配置方案版本（{version}）。请更新 Harbor 或使用较旧的配置方案。",
  "Profile file has no chrome config.": "配置方案文件中没有界面配置。",
  "Your theme": "你的主题",
  "New badge unlocked": "已解锁新徽章",
  "New profile comment": "配置方案有新评论",
  "Use your API key to Translate Chapters to Your Language. Get a key from the":
    "使用你的 API 密钥将章节翻译成你的语言。请前往以下网站获取密钥：",
  "Search {language}": "搜索 {language}",
  "{language} voices": "{language} 语音",
  "Show original language": "显示原文",
  "Highlight {color}": "以{color}高亮",
  "Use {color} ink": "使用{color}墨迹",
  "Remove {font}": "移除 {font}",
  "Importing font…": "正在导入字体…",
  "Import font": "导入字体",
  "Tracker color": "追踪器颜色",
  "Use {color} for the line tracker": "将{color}用于行追踪器",
  "Choose a custom tracker color": "选择自定义追踪器颜色",
  "Your Roku is set to block control requests from apps on your network, so Harbor can't reach it. This is a one-time setting on the Roku.":
    "你的 Roku 已设置为阻止网络中应用发出的控制请求，因此 Harbor 无法访问它。此设置只需在 Roku 上更改一次。",
  "Open Settings, then System, then Advanced system settings.":
    "依次打开“设置”、“系统”和“高级系统设置”。",
  "Show off. [b]bold[/b], [color=gold]color[/color], [youtube]link[/youtube], [img]https://...[/img] and more.":
    "尽情展示个性。[b]粗体[/b]、[color=gold]颜色[/color]、[youtube]链接[/youtube]、[img]https://...[/img] 等更多效果。",
  "Custom profile": "自定义个人资料",
  "Any HTML layout: headings, paragraphs, lists, tables, sections, divs.":
    "任意 HTML 布局：标题、段落、列表、表格、区块、div。",
  "Your HTML and CSS render inside a sandboxed frame, fully isolated from the rest of Harbor. Write it like a tiny self-contained page. Font and page background are separate controls above, applied to the whole profile.":
    "你的 HTML 和 CSS 会在沙盒框架内渲染，与 Harbor 的其余部分完全隔离。请将其编写成一个独立的微型页面。字体和页面背景可在上方单独设置，并应用于整个个人资料页。",
  "Profile font": "个人资料字体",
  "Page background color": "页面背景颜色",
  "Customize profile": "自定义个人资料",
  "Profile favicon": "个人资料网站图标",
  "Add a display name first. It is the name shown on your profile.":
    "请先添加显示名称。它会显示在你的个人资料中。",
  "Shows as a bubble on your profile": "在你的个人资料中显示为气泡标签",
  "Custom font, page background, and a freeform HTML/CSS canvas":
    "自定义字体、页面背景和自由编辑的 HTML/CSS 画布",
  "Reorder or hide the cards on your profile": "重新排序或隐藏个人资料中的卡片",
  "Show up to 6 of your lists on your profile": "最多在个人资料中显示 6 个列表",
  "Private profile": "设为私密个人资料",
  "Off by default. Show what you are watching right now, or your watch party, on your profile. Applies instantly":
    "默认关闭。在个人资料中显示你当前观看的内容或观影派对。设置会立即生效",
  "Type what you want in plain language and let a model find it. Bring your own API key from either service.":
    "用自然语言输入想找的内容，让模型帮你查找。使用你自己在任一服务中的 API 密钥。",
  "No profile": "无配置方案",
  "Save layout profile": "保存布局配置方案",
  "Profile name": "配置方案名称",
  "Rename profile": "重命名配置方案",
  "Author account": "作者账号",
  "This is the only time you'll see it. If you ever forget your password, this code is the only way back into your account. Store it somewhere safe.":
    "这是你唯一一次看到它。如果忘记密码，此代码是重新登录账号的唯一途径。请将它妥善保存在安全的位置。",
  "Theme author. Your published themes are tied to this account.":
    "主题作者。你发布的主题将与此账号关联。",
  "Set a Harbor profile picture first": "请先设置 Harbor 头像",
  "Show your Harbor profile picture on the community": "在社区中显示你的 Harbor 头像",
  "Your badge pack": "你的徽章包",
  "Badge pack": "徽章包",
  "Want a badge that moves? Drop in a GIF up to 8 MB. Harbor shrinks it down and converts it to a lightweight animated format so it stays crisp and loads fast. Keep it small and looping.":
    "想让徽章动起来？添加不超过 8 MB 的 GIF 即可。Harbor 会将其缩小并转换为轻量的动画格式，确保画面清晰、加载迅速。建议控制体积并设为循环播放。",
  "How badge packs work": "徽章包的工作方式",
  "Create a free account to publish. No email required.": "创建免费账号即可发布，无需邮箱。",
  "Open {name} profile": "打开 {name} 的个人资料",
  "Share a theme": "分享主题",
  "Be the first to share a look. Publish a theme and it shows up here for everyone.":
    "率先分享新外观吧。发布主题后，所有人都能在这里看到。",
  "Get theme": "获取主题",
  "No notifications yet. Publish a theme and watch it climb.":
    "暂无通知。发布主题，见证它不断走红。",
  theme: "主题",
  "Featured theme": "精选主题",
  "Rate this theme": "为此主题评分",
  "Build one in the studio or import a theme file first, then come back to share it.":
    "请先在工作室中创建主题或导入主题文件，然后再回来分享。",
  "Add up to 6 screenshots so people can see your theme in action. Optional, but they sell it.":
    "最多添加 6 张截图，让大家查看主题的实际效果。此项可选，但能让主题更具吸引力。",
  "Theme name": "主题名称",
  "Style {selector} and the posters on the right update live. Hit Insert starter for a head start.":
    "为 {selector} 编写样式，右侧海报会实时更新。点击“插入起始模板”即可快速开始。",
  "Font tokens": "字体令牌",
  "Call these from onclick handlers or your theme JS. They are stable and safe: each one drives the real Harbor feature, so your chrome never goes stale when Harbor adds menu items.":
    "可从 onclick 处理程序或主题 JS 中调用。这些 API 稳定且安全：每个 API 都会调用 Harbor 的实际功能，因此即使 Harbor 添加菜单项，你的界面也不会过时。",
  "Set on <html>. Use them to scope styles to a specific layout/card/button choice.":
    "在 <html> 上设置。可用它们将样式限定到特定的布局、卡片或按钮选项。",
  "Dispatched on window. Listen from your theme JS to react to Harbor's lifecycle.":
    "在 window 上派发。可在主题 JS 中监听，以响应 Harbor 的生命周期。",
  "Harbor theme": "Harbor 主题",
  "Remove font": "移除字体",
  "Name your theme": "为主题命名",
  Layout: "布局",
  "This layout shows icons only, so labels are not displayed.":
    "此布局仅显示图标，因此不会显示标签。",
  "This layout shows icons only, so renaming is off here. Reorder and hide still apply.":
    "此布局仅显示图标，因此无法在此重命名。仍可调整顺序和隐藏项目。",
  "Theme studio": "主题工作室",
  "Untitled theme": "未命名主题",
  "Sign in, or make an account": "登录或创建账户",
  "Your account needs activating": "您的账户需要激活",
  "Right after registering TMDB tells you the account is not active yet. Nothing is broken, the email is on its way.":
    "注册后，TMDB 会立即提示账户尚未激活。这不是故障，激活邮件正在发送途中。",
  "Open your account settings": "打开账户设置",
  "Back on TMDB, click your avatar in the top right and choose Settings from the menu.":
    "返回 TMDB，点击右上角的头像，然后在菜单中选择“设置”。",
  "Add a TMDB key in Settings to browse service catalogs.":
    "在“设置”中添加 TMDB 密钥以浏览各服务的目录。",
  "0% shows the raw image. 100% covers it with the theme color. 60-80% is the readable sweet spot.":
    "0% 显示原图，100% 使用主题色完全覆盖。60-80% 是兼顾可读性的最佳范围。",
  "Tied to your account. Manage it in My themes.": "与你的账号绑定。可在“我的主题”中管理。",
  "Theme code": "主题代码",
  "Build a theme": "创建主题",
  "Colors, layout, and fonts. No code.": "自定义颜色、布局和字体，无需编写代码。",
  "Import a theme": "导入主题",
  "Browse 1 theme. Apply in one click.": "浏览 1 个主题，一键应用。",
  "Import a theme file": "导入主题文件",
  "Drop a theme file here or click to browse.": "将主题文件拖到此处，或点击浏览。",
  "Claim a theme": "认领主题",
  "Attach a theme you shared before creating this account.": "关联你在创建此账号前分享的主题。",
  "Theme link or ID": "主题链接或 ID",
  "Claim theme": "认领主题",
  "Delete theme": "删除主题",
  "Theme API cheat sheet": "主题 API 速查表",
  "Every color token, stable selector, {api} call, live hook (bell, account menu, avatar, status dot, unread badge), and copy-paste recipe.":
    "包含所有颜色令牌、稳定选择器、{api} 调用、实时钩子（通知铃、账号菜单、头像、状态圆点、未读徽标）和可直接复制粘贴的用法示例。",
  "Build or import the updated theme first, then come back to push it as a new version.":
    "请先创建或导入更新后的主题，再返回将其推送为新版本。",
  "Pick the theme with your latest changes. It becomes the new version.":
    "选择包含最新更改的主题，它将成为新版本。",
  "Update a theme": "更新主题",
  "A 16:9 shot of your theme looks best": "使用 16:9 的主题截图效果最佳",
};

export default settings;
