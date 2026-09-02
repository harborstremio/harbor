const system: Record<string, string> = {
  "An unexpected error occurred": "发生意外错误",
  "Scanning your network…": "正在扫描你的网络…",
  "Cache buffering": "缓存缓冲",
  "Couldn't open this file": "无法打开此文件",
  "Failed: {message}": "失败：{message}",
  File: "文件",
  "Load file": "加载文件",
  "Same file": "同一文件",
  'This file is in OneDrive. If "Files On-Demand" is on, the file is a cloud placeholder until it\'s downloaded. Right-click it in Explorer and pick':
    "此文件位于 OneDrive 中。如果已开启“文件按需”，下载前该文件只是云端占位符。请在文件资源管理器中右键点击它，然后选择",
  "Copy error": "复制出错",
  "Server did not respond": "服务器未响应",
  "Connection refused": "连接被拒绝",
  "Connection reset by server": "连接被服务器重置",
  "The server rejected the request. Some providers block generic clients; verify the credentials work in their official app first.":
    "服务器拒绝了请求。部分提供商会拦截通用客户端，请先确认这些凭据可在其官方应用中使用。",
  "The host did not respond. The URL may have expired (many providers rotate domains), the server is down, or your network is blocking it. Contact your provider for an updated URL.":
    "主机未响应。URL 可能已过期（许多提供商会更换域名）、服务器已宕机，或你的网络阻止了连接。请联系提供商索取更新后的 URL。",
  "Server returned an empty response": "服务器返回空响应",
  "The server is reachable but is not sending any data. Check the URL or contact your provider.":
    "服务器可以连接，但未发送任何数据。请检查 URL 或联系提供商。",
  "Failed to load match details.": "无法加载比赛详情。",
  "Server URL plus username and password.": "服务器 URL、用户名和密码。",
  "Server URL": "服务器 URL",
  "Server + login": "服务器 + 登录信息",
  "Jina API key": "Jina API 密钥",
  "Minimum file size (local scan)": "最小文件大小（本地扫描）",
  "Caps file size. Unknown sizes still pass.": "限制文件大小。大小未知的文件仍可通过。",
  "Any badges.json link works: a raw gist, Pastebin, or repo file. Broken JSON gets auto-repaired.":
    "任何 badges.json 链接均可使用，例如原始 gist、Pastebin 或仓库文件。损坏的 JSON 会自动修复。",
  "Export my setup": "导出我的设置",
  "Groq API key (gsk-...)": "Groq API 密钥（gsk-...）",
  "Import a file instead": "改为导入文件",
  "Install a pack": "安装包",
  "Jina API key (optional)": "Jina API 密钥（可选）",
  "Minimum file size": "最小文件大小",
  "No custom rules yet. Add one below, or install a pack to bring some in.":
    "暂无自定义规则。请在下方添加，或安装规则包来导入。",
  "Nothing usable in that file": "该文件中没有可用内容",
  "Setup copied to clipboard as JSON": "设置已以 JSON 形式复制到剪贴板",
  "That file isn't valid JSON": "该文件不是有效的 JSON",
  "That pack's file isn't valid JSON": "该包的文件不是有效的 JSON",
  "The window and taskbar icon updates right away. The installed shortcut refreshes on the next update.":
    "窗口和任务栏图标会立即更新。已安装的快捷方式将在下次更新时刷新。",
  "TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.":
    "TMDB 会在创建密钥时要求填写应用 URL。填写任意 URL 即可，例如 https://harbor.app。你只需获取 API 密钥。",
  "v3 API key": "v3 API 密钥",
  "subscriber API key": "订阅者 API 密钥",
  "mdblist api key": "MDBList API 密钥",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup.":
    "将整个 Harbor 配置导出为单个文件，以便在新电脑上恢复或留作备份。",
  Privacy: "隐私",
  "Stremio install links": "Stremio 安装链接",
  "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app.":
    "Harbor 会接管 stremio:// 安装链接，让配置和安装流程都在应用内完成。",
  "API budget": "API 配额",
  "TorBox API key": "TorBox API 密钥",
  "AllDebrid API key": "AllDebrid API 密钥",
  "Premiumize API key": "Premiumize API 密钥",
  "API token": "API 令牌",
  "API key": "API 密钥",
  "Faster and quieter than torrents if you already pay for Usenet. Configure on the addon page, paste the manifest URL it returns.":
    "如果你已订阅 Usenet，它比种子下载更快、更省心。请在插件页面进行配置，然后粘贴其返回的 manifest URL。",
  "Choose file": "选择文件",
  "Spins up a tiny server on Cloudflare's free Workers tier. Stays online forever (or until you stop it). Friends connect by URL.":
    "在 Cloudflare 免费 Workers 套餐上启动一个微型服务器。它会一直在线，直到你将其停止。好友可通过 URL 连接。",
  "Paste your API token first.": "请先粘贴 API 令牌。",
  "Open the Discord server where you want notifications to land.":
    "打开要接收通知的 Discord 服务器。",
  "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.":
    "没有“集成”选项？你需要“管理 Webhook”权限。请联系服务器所有者。",
  "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.":
    "Harbor 会从 AniSkip、TheIntroDB 和文件自带章节中查找片头与片尾字幕的时间点，并在恰当时机显示“跳过”按钮。",
  "Start server": "启动服务器",
  "Your streaming server address": "你的流媒体服务器地址",
  "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer.":
    "将当前安装的 Harbor 作为 Web 应用提供给同一网络中的设备。在手机、笔记本电脑或电视浏览器上打开并登录后，内容会通过此计算机播放。",
  "Couldn't import that file. {error}": "无法导入该文件。{error}",
  "Generate a Cloudflare API token with {code1} and {code2} permissions at {code3}. Paste it into Harbor.":
    "在 {code3} 生成具有 {code1} 和 {code2} 权限的 Cloudflare API 令牌，然后将其粘贴到 Harbor 中。",
  "Install wrangler and authenticate:": "安装 wrangler 并完成身份验证：",
  "Unlimited Durable Object storage at $0.20 per million reads.":
    "Durable Object 存储空间不限，读取每百万次收费 0.20 美元。",
  "Connection refused / DNS does not resolve": "连接被拒绝 / DNS 无法解析",
  "Token name can be anything. The permission row must be exactly {b1} + {b2} + {b3}.":
    "令牌名称可随意填写。权限行必须严格设置为 {b1} + {b2} + {b3}。",
  Failed: "失败",
  "Harbor checks harbor.site for new versions and installs them in place. Nothing installs until you choose to, and a dismissed update never nags you again.":
    "Harbor 会在 harbor.site 上检查新版本并就地安装更新。只有在你选择后才会安装，忽略的更新也不会再次提醒。",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your Stremio sign-in.":
    "将完整的 Harbor 配置导出为单个文件，以便在新电脑上恢复或留作备份。除 Stremio 登录信息外，其他内容均会包含。",
  "Server address": "服务器地址",
  Connection: "连接",
  "Relay needs update": "中继需要更新",
  "Server reachable": "服务器可访问",
  "Test failed": "测试失败",
  "The server answered with status {status}. Is that a streaming server?":
    "服务器返回状态 {status}。这是流媒体服务器吗？",
  "Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.":
    "无法在 1.5 秒内连接到服务器。请检查地址，并确认服务器所在设备已开机。",
  "Loads a backup file and replaces your current setup with it. Perfect for a new computer. Your Stremio sign-in on this device stays as is.":
    "加载备份文件并用其替换当前配置，非常适合在新电脑上使用。此设备上的 Stremio 登录状态保持不变。",
  "Could not build the backup file.": "无法创建备份文件。",
  "Could not read that file.": "无法读取该文件。",
  "Restore and reload": "恢复并重新加载",
  "Receive early builds with the newest fixes before they reach the stable release. Betas can be rough around the edges; switch this off to return to stable at the next update.":
    "抢先获取包含最新修复的版本，无需等到稳定版发布。测试版可能不够稳定；关闭此选项后，将在下次更新时恢复到稳定版。",
  "Catch stremio:// install links inside Harbor": "在 Harbor 内接管 stremio:// 安装链接",
  "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.":
    "stremio:// 链接现在会在 Stremio 应用中打开。仅当你从 Harbor 内触发安装时，Harbor 才会执行安装。",
  "Downloaded. Ready to install and restart.": "下载完成。可以安装并重启。",
  "Couldn't reach the update server. Try again in a moment.": "无法连接到更新服务器。请稍后重试。",
  "Update now": "立即更新",
  "Failed: {error}": "失败：{error}",
  "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.":
    "你在此保存的所有数据都仅保留在此浏览器中，包括 Stremio 登录信息、API 密钥、观看进度、选择器缓存和已忽略的提示。Harbor 服务器绝不会接触这些数据。清除浏览器数据会将其全部删除。",
  "Test connection": "测试连接",
  "Relay version {version}. Update available.": "中继版本 {version}。有可用更新。",
  "Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.":
    "Cloudflare 只会显示 API 令牌一次。请立即保存副本，否则将无法再从 Harbor 停止或重新部署此中继。",
  "Relay test failed": "中继测试失败",
  "Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.":
    "部署中继需要使用 Cloudflare API，但浏览器客户端无法调用。请使用桌面版部署 Worker，然后在下方输入生成的 URL。",
  "Install failed": "安装失败",
  "Couldn't install. Double-check the URL and try again.": "无法安装。请仔细检查 URL 后重试。",
  "Paste the manifest URL the configure page gave you": "粘贴配置页面提供的 manifest URL",
  "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.":
    "只需安装一次 SVP（免费版已足够）。其中包含 VapourSynth + svpflow，Harbor 会直接复用，无需额外设置。",
  "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.":
    "SVP 已安装，但 Harbor 找不到其引擎文件（svpflow + VapourSynth）。请尝试修复 SVP 安装，或重新打开一次 SVP。",
  "Finish the install above first. Flipping this on now won't do anything until Harbor can find SVP's engine.":
    "请先完成上方的安装。在 Harbor 找到 SVP 引擎前，现在开启此功能不会有任何效果。",
  "Slow or unstable connection": "网络连接缓慢或不稳定",
  "Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.":
    "如果您使用笔记本电脑或耳机观看，并且对白比音效小太多，请开启。如果您使用真正的环绕声系统或回音壁，请保持关闭。",
  "Generate a Cloudflare API token with": "生成 Cloudflare API 令牌，并授予",
  "Failed to fetch JSON": "无法获取 JSON",
  "Suspicious file": "可疑文件",
  "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.":
    "SVP 文件已就绪，但其 VapourSynth 引擎无法加载（{err}）。这通常是因为存在失效的 VapourSynth 条目，或缺少 Microsoft VC++ 运行库。请重新安装 SVP，或安装 Microsoft 最新版“Visual C++ Redistributable (x64)”，然后重新打开 Harbor。",
  "Serve Harbor on your network": "在你的网络中提供 Harbor 服务",
  "Storage overview": "存储空间概览",
  "App storage": "应用存储空间",
  "Continue Watching suggestions cache": "继续观看建议缓存",
  "Paste your SUBDL API key": "粘贴你的 SUBDL API 密钥",
  "Paste your Subsource API key": "粘贴你的 Subsource API 密钥",
  "No Docker, no server, nothing to configure.": "无需 Docker，无需服务器，无需配置。",
  "Includes Comet, MediaFusion, AIOStreams, StremThru, Jackettio and more, plus TorBox and Usenet accounts. No Docker, no server, no config.":
    "包括 Comet、MediaFusion、AIOStreams、StremThru、Jackettio 等，还附带 TorBox 和 Usenet 账户。无需 Docker，无需服务器，无需配置。",
  "Defends privacy, free expression, and the open internet, in the courts and in the code.":
    "通过司法和代码捍卫隐私、言论自由与开放互联网。",
  "Update the clock every second.": "每秒更新时钟。",
  "Could not reach TMDB. Check the connection.": "无法连接 TMDB。请检查网络连接。",
  "Phone setup is off": "手机设置已关闭",
  Setup: "设置",
  "Setup QR code": "设置用二维码",
  "TMDB API key": "TMDB API 密钥",
  "Turn on phone setup": "启用手机设置",
  "Manage connection": "管理连接",
  "Couldn't reach Harbor, check your connection": "无法连接 Harbor，请检查网络连接",
  "Could not update group photo.": "无法更新群组照片。",
  "Could not update photo.": "无法更新照片。",
  "Could not update banner.": "无法更新横幅。",
  "Something went wrong reaching Harbor. Check your connection and try again.":
    "连接 Harbor 时出现问题。请检查网络连接后重试。",
  "An API key is needed": "需要 API 密钥",
  "Check your connection and try again.": "请检查网络连接后重试。",
  "Could not update showcase": "无法更新展示作品",
  Reload: "重新加载",
  "This server is too old to add repos from Harbor": "此服务器版本过旧，无法通过 Harbor 添加仓库",
  "The server could not load that repository": "服务器无法加载该仓库",
  "Action failed": "操作失败",
  "update available": "有可用更新",
  "Update {name}": "更新 {name}",
  "Could not reach this server": "无法连接此服务器",
  "This server lists no extensions": "此服务器未列出任何扩展",
  "Update available": "有可用更新",
  "No Suwayomi server at this address": "此地址没有 Suwayomi 服务器",
  "This server responded but is not supported": "此服务器有响应，但不受支持",
  "Enter a valid http(s):// server address": "请输入有效的 http(s):// 服务器地址",
  "Could not save this server": "无法保存此服务器",
  "This server needs a username and password": "此服务器需要用户名和密码",
  "Add server": "添加服务器",
  "Connect a Suwayomi server": "连接 Suwayomi 服务器",
  "1 file": "1 个文件",
  "Moved, but Harbor couldn't confirm the result. Reload to see the current state.":
    "已移动，但 Harbor 无法确认结果。请重新加载以查看当前状态。",
  "Install an extension above to get sources": "安装上方的扩展以获取内容源",
  "Import failed, try again": "导入失败，请重试",
  "This is a Tachiyomi / Mihon repo. Those are Android (APK) extensions, so Harbor can't run them directly. To use these sources on desktop, run a Suwayomi server and connect Harbor to it from the Servers section.":
    "这是 Tachiyomi / Mihon 仓库。其中包含 Android (APK) 扩展，因此 Harbor 无法直接运行。要在桌面端使用这些内容源，请运行 Suwayomi 服务器，然后在“服务器”部分将 Harbor 连接到该服务器。",
  "This is a Paperback (iOS) repo, which Harbor can't use. For desktop sources, connect a Suwayomi server from the Servers section.":
    "这是 Paperback (iOS) 仓库，Harbor 无法使用。要在桌面端使用内容源，请在“服务器”部分连接 Suwayomi 服务器。",
  "This doesn't look like a Harbor plugin repo. Harbor expects a JSON file shaped { name, plugins: [ ... ] }.":
    "这似乎不是 Harbor 插件仓库。Harbor 需要结构为 { name, plugins: [ ... ] } 的 JSON 文件。",
  "https:// API or site URL": "https:// API 或网站 URL",
  "This one also replaces Harbor's bundled players and tools, so it installs through Harbor Setup. Harbor closes, the installer finishes, then Harbor reopens.":
    "此更新还会替换 Harbor 内置的播放器和工具，因此需要通过 Harbor Setup 安装。Harbor 会关闭，安装程序完成后将重新打开 Harbor。",
  "Install and reopen": "安装并重新打开",
  "Harbor is closing. Harbor Setup will finish and reopen it.":
    "Harbor 正在关闭。Harbor Setup 完成安装后会重新打开 Harbor。",
  "Harbor Setup did not finish updating Harbor. Nothing was changed.":
    "Harbor Setup 未能完成 Harbor 更新。未进行任何更改。",
  "Failed to load": "加载失败",
  "{shown} of {total} file from your computer": "已显示电脑中的 {shown}/{total} 个文件",
  "Failed to create thread": "创建主题失败",
  "Install failed.": "安装失败。",
  "Configure & install": "配置并安装",
  "Install default": "默认安装",
  "Pulled from manifest": "从清单中获取",
  "Manifest URL": "清单 URL",
  "Configure on the addon's setup page": "在插件设置页面中配置",
  "Or paste the install link manually": "或手动粘贴安装链接",
  Install: "安装",
  "Install addon": "安装插件",
  Update: "更新",
  "Open setup page": "打开设置页面",
  "https://...manifest.json or stremio://...": "https://...manifest.json 或 stremio://...",
  "Export as file": "导出为文件",
  "Import from file...": "从文件导入...",
  Error: "错误",
  "update.ready": "更新已可安装",
  "update.installing": "正在安装更新",
  "update.downloading": "正在下载更新",
  "update.failed": "更新失败",
  "update.available": "有可用更新",
  "update.harborVersion": "Harbor {version}",
  "update.fetching": "正在获取最新版本",
  "update.errorServer": "连接更新服务器时出错。",
  "update.later": "稍后",
  "update.installRestart": "安装并重启",
  "update.restartAuto": "Harbor 将自动重启。",
  "update.tryAgain": "重试",
  "update.keepUsing": "下载期间继续使用 Harbor",
  "update.of": "已下载 {downloaded}，共 {total}",
  "Common picks for a fresh setup.": "适合全新配置的常用选择。",
  "Version and capabilities come straight from the addon's manifest. Ratings and categories come from the":
    "版本和功能信息直接来自插件清单。评分和分类则来自",
  "'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "的设置页面。选择所需选项，然后复制页面提供的安装链接并粘贴到下方，以更新插件。",
  "'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "的设置页面将在 Harbor 内置浏览器中打开。选择所需选项。点击其页面上的“安装”后，Harbor 会自动捕获链接并更新插件。",
  "Skip setup": "跳过设置",
  "Continue Watching, then your addon catalogs in install order. No hero, no Harbor rails.":
    "先显示“继续观看”，再按安装顺序显示插件目录。不显示焦点推荐和 Harbor 内容栏。",
  "Sign-in failed": "登录失败",
  "Click to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "点击打开 {name} 的设置页面。选择所需选项，然后复制页面提供的安装链接并粘贴到下方，以更新该插件。",
  "Click to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "点击在 Harbor 内置浏览器中打开 {name} 的设置页面。选择所需选项。在其页面上点击“安装”后，Harbor 会自动获取链接并更新该插件。",
  "Manifest URL copied": "已复制 manifest URL",
  "Paste manifest URL or stremio:// link": "粘贴 manifest URL 或 stremio:// 链接",
  "Install from URL: paste any manifest or stremio:// link":
    "从 URL 安装：粘贴任意 manifest 或 stremio:// 链接",
  "Click below to open {name}'s setup page. Pick your options, then copy the install link it gives you and paste it below to update the addon.":
    "点击下方打开 {name} 的设置页面。选择所需选项，然后复制页面提供的安装链接并粘贴到下方，以更新该插件。",
  "Click below to open {name}'s setup page in Harbor's built-in browser. Pick your options. When you click Install on their page, Harbor catches the link automatically and updates the addon.":
    "点击下方在 Harbor 内置浏览器中打开 {name} 的设置页面。选择所需选项。在其页面上点击“安装”后，Harbor 会自动获取链接并更新该插件。",
  "{n} episodes · {file}": "{n} 集 · {file}",
  "Add an MDBList API key to unlock this.": "添加 MDBList API 密钥以解锁此功能。",
  "An error occurred": "发生错误",
  "Gemini API key": "Gemini API 密钥",
  "AudD API token": "AudD API 令牌",
  "Cache location": "缓存位置",
  "Cap how much disk the cache can use. When it goes over, Harbor deletes the oldest files first. Enforced on launch and as streams close.":
    "限制缓存可占用的磁盘空间。超出限制时，Harbor 会优先删除最旧的文件。该限制会在启动时及播放任务结束时执行。",
  "Clear cache now": "立即清除缓存",
  "Could not send: {error}": "无法发送：{error}",
  "Couldn't reach harbor.site to load earlier builds. Check your connection and try again.":
    "无法连接到 harbor.site 以加载较早版本。请检查网络连接后重试。",
  "Default app cache folder": "默认应用缓存文件夹",
  "Export failed: {reason}": "导出失败：{reason}",
  "Exported {ok}, {fail} failed": "已导出 {ok} 个，{fail} 个失败",
  "Found {n} .nfo file in this folder.": "在此文件夹中找到 {n} 个 .nfo 文件。",
  "Identify every file by its name and pull fresh titles and artwork from TMDB.":
    "根据文件名识别每个文件，并从 TMDB 获取最新标题和图片。",
  "Lock to season server": "锁定到本季服务器",
  Network: "电视网",
  "OpenRouter API key (sk-or-...)": "OpenRouter API 密钥（sk-or-...）",
  "Same file as host": "与主机使用相同文件",
  "Server couldn't start:": "服务器无法启动：",
  "Shows each episode's rating. Add your free OMDb API key for real IMDb scores; without it, ratings fall back to TMDB.":
    "显示每集的评分。添加免费的 OMDb API 密钥可获取真实的 IMDb 评分；未添加时将改用 TMDB 评分。",
  "This usually means antivirus removed the server file (stremio-server.exe). Add Harbor's install folder to your antivirus exclusions, then reinstall.":
    "这通常表示杀毒软件删除了服务器文件（stremio-server.exe）。请将 Harbor 安装文件夹添加到杀毒软件的排除项，然后重新安装。",
  "unknown error": "未知错误",
  "Your network blocks UDP, so DHT is offline, but HTTPS trackers are reachable over TCP. Streams can still find peers, they may just take a little longer to start.":
    "你的网络阻止了 UDP，因此 DHT 已离线，但仍可通过 TCP 访问 HTTPS Tracker。播放源仍可找到对等节点，只是可能需要更长时间才能开始播放。",
  "Everything else, via your own server": "其余所有内容均通过你自己的服务器获取",
  "Install it in Extensions": "在“扩展”中安装",
  "Page failed to load": "页面加载失败",
  "Paste your repo.json URL into Extensions above, then install. That is how you bring any site's sources back.":
    "将 repo.json URL 粘贴到上方的“扩展”中，然后安装。这样即可重新添加任意网站的来源。",
  "Plugins run sandboxed in an isolated worker with no access to your files, accounts, or the rest of Harbor. What a plugin scrapes is between you and the site it targets. Only install plugins from repositories you trust.":
    "插件在隔离的工作线程沙盒中运行，无法访问您的文件、账号或 Harbor 的其他部分。插件抓取什么内容是您与目标网站之间的事。请仅安装来自可信仓库的插件。",
  "Prefer a server? Run every source through your own Suwayomi and point Harbor at it":
    "更喜欢使用服务器？通过您自己的 Suwayomi 运行所有来源，并让 Harbor 连接到该服务器",
  "Put your plugin file and a repo.json manifest on any static HTTPS host: GitHub Pages, a raw gist, an object store, your own server.":
    "将插件文件和 repo.json 清单放到任意静态 HTTPS 主机上，例如 GitHub Pages、原始 gist、对象存储或您自己的服务器。",
  "Reach the network with harbor.http(url, opts) and parse HTML with harbor.parseHtml(html). There is no fetch, DOM, or storage in the sandbox.":
    "使用 harbor.http(url, opts) 访问网络，并使用 harbor.parseHtml(html) 解析 HTML。沙盒中没有 fetch、DOM 或存储功能。",
  "Run your own server": "运行自己的服务器",
  "Setup .txt": "设置说明 .txt",
  "Storage location": "存储位置",
  "Update plugin": "更新插件",
  "Works on plain server-rendered HTML. Sites that build the page with JavaScript, or hide data inside scripts, need a plugin instead.":
    "适用于普通的服务器端渲染 HTML。使用 JavaScript 构建页面或将数据隐藏在脚本中的网站则需要插件。",
  "Write a scraper for any site, host it, and install it like any other plugin":
    "为任意网站编写抓取器，将其托管后像其他插件一样安装",
  "Write one JavaScript file": "编写一个 JavaScript 文件",
  "on your machine, install the sources you want inside it (hundreds are available), then add its address (like":
    "在您的设备上安装所需来源（有数百个可用），然后添加其地址（例如",
  "under Your server above. Everything you enable there shows up here.":
    "位于上方的“您的服务器”下。您在那里启用的所有内容都会显示在这里。",
  "update to v{version}": "更新至 v{version}",
  "Click to choose a different file": "点击选择其他文件",
  "Failed to save": "保存失败",
  "The server stopped responding, the rest stayed on this device.":
    "服务器停止响应，其余内容仍保留在此设备上。",
  "API budget (OMDb)": "API 配额（OMDb）",
  "Add a TMDB key in Setup to power this view.": "在设置向导中添加 TMDB 密钥以启用此视图。",
  "Also joins Harbor's Discord server.": "同时加入 Harbor 的 Discord 服务器。",
  "AniList connection": "AniList 连接",
  "Apply and reload": "应用并重新加载",
  "Auto follows your connection speed.": "自动模式会根据你的连接速度调整。",
  "Both devices need to be on the same Wi-Fi network, and some guest networks block devices from seeing each other.":
    "两台设备需要连接到同一 Wi-Fi 网络，部分访客网络会阻止设备相互发现。",
  Cache: "缓存",
  "Cache folder": "缓存文件夹",
  "Change server": "更换服务器",
  "Checking your connection": "正在检查网络连接",
  "Checks that this network can reach trackers and peers.":
    "检查此网络能否连接到 trackers 和 peers。",
  "Choose API in the left sidebar.": "在左侧边栏中选择 API。",
  "Continue Watching first, then your addon catalogs in install order.":
    "先显示“继续观看”，再按安装顺序显示插件目录。",
  'Copy the value labelled "API Key (v3 auth)".': "复制标为“API Key (v3 auth)”的值。",
  "Could not reach Harbor. Check your phone's connection and try again.":
    "无法连接到 Harbor。请检查手机的网络连接后重试。",
  "Could not reach Stremio. Check your phone's connection and try again.":
    "无法连接到 Stremio。请检查手机的网络连接后重试。",
  "Could not reach TMDB. Check your phone's connection and try again.":
    "无法连接到 TMDB。请检查手机的网络连接后重试。",
  "Drag a dial and watch the still update. Each dial resets on its own.":
    "拖动旋钮即可查看静止画面实时变化。每个旋钮均可单独重置。",
  "Episode titles, network info, and the alternate orderings.":
    "剧集标题、电视网信息和其他排序方式。",
  "Every source Harbor tried failed to start. Pick a different one, or try again in a moment.":
    "Harbor 尝试的所有片源均无法开始播放。请选择其他片源，或稍后重试。",
  "Export your setup": "导出设置",
  "Filmographies come from TMDB. Add a key in Setup to fill this page.":
    "影人作品来自 TMDB。请在“设置”中添加密钥以填充此页面。",
  "Finish setup on your phone": "在手机上完成设置",
  "Harbor cannot find this TV's network address, so the phone hand-off is unavailable here.":
    "Harbor 无法找到此电视的网络地址，因此无法在此使用手机接力。",
  "Harbor could not open its web server. Try again, or set this up on the TV.":
    "Harbor 无法启动其 Web 服务器。请重试，或在电视上进行设置。",
  "Harbor needs to be serving on your network before a phone can reach it.":
    "Harbor 必须先在你的网络上启动服务，手机才能访问。",
  "Harbors on your network": "网络上的 Harbor",
  "Join the same network your TV is on, not the guest one.":
    "连接到电视所在的同一网络，而不是访客网络。",
  "Leave setup": "退出设置流程",
  "Leave setup?": "退出设置流程？",
  "Letterboxd connection": "Letterboxd 连接",
  "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.":
    "加载备份文件，并完全按其内容恢复，不影响其他设置。此设备上的 Stremio 登录状态保持不变。",
  "Lost the connection to your TV. Reconnecting.": "与电视的连接已断开，正在重新连接。",
  "MDBList API key": "MDBList API 密钥",
  "Needs an API key": "需要 API 密钥",
  "Network discovery needs the desktop app.": "网络发现功能需要桌面应用。",
  "Network's best": "电视网最佳作品",
  "No network address": "无网络地址",
  "No other Harbor answered on this network. One shows up here a moment after it starts.":
    "未收到此网络上其他 Harbor 的响应。其他 Harbor 启动后片刻便会显示在这里。",
  "Nothing else answered. A Harbor shows up here a moment after it starts on this network.":
    "未收到其他响应。此网络上的 Harbor 启动后片刻便会显示在这里。",
  "Nothing has connected yet. Your phone may be on a guest network, or this TV may be on a different network from your phone.":
    "尚未连接任何设备。您的手机可能连接了访客网络，或者这台电视与手机不在同一网络。",
  "Open Setup": "打开设置",
  "Open this page by scanning the code on your TV's setup screen.":
    "扫描电视设置界面上的二维码以打开此页面。",
  "OpenSubtitles API key": "OpenSubtitles API 密钥",
  "Paste your OpenSubtitles API key": "粘贴你的 OpenSubtitles API 密钥",
  "Paste your v3 API key": "粘贴你的 v3 API 密钥",
  "Phone setup unavailable": "手机设置不可用",
  "Privacy & tracker blocking": "隐私和跟踪器拦截",
  "Private mode stops all contact with this server in either direction.":
    "隐私模式会阻止与此服务器之间的所有双向通信。",
  SETUP: "设置",
  "Saves the relay URL and your Cloudflare token to a file.":
    "将中继 URL 和你的 Cloudflare 令牌保存到文件。",
  'Select "Request an API key" and pick Developer.': "选择“申请 API 密钥”，然后选择“开发者”。",
  Server: "服务器",
  "Server and privacy": "服务器与隐私",
  "Setup progress": "设置进度",
  "Sign in with a server, username and password": "使用服务器、用户名和密码登录",
  Storage: "存储",
  "Streaming server": "流媒体服务器",
  "TMDB API key (v3)": "TMDB API 密钥（v3）",
  "TMDB API key, v3 auth": "TMDB API 密钥，v3 身份验证",
  'TMDB did not accept that key. Check you copied the "API Key (v3 auth)" value, not the read access token.':
    "TMDB 不接受该密钥。请确认复制的是“API Key (v3 auth)”值，而不是读取访问令牌。",
  "Test relay connection": "测试中继连接",
  "That Harbor is on the network but is not answering, so it cannot be driven.":
    "该 Harbor 已接入网络，但没有响应，因此无法控制。",
  'That looks like the v4 Read Access Token. Harbor needs the shorter "API Key (v3 auth)" from the same page.':
    "这看起来像 v4 Read Access Token。Harbor 需要同一页面上较短的“API Key (v3 auth)”。",
  "The provider's server could not be reached. It may be offline, or you have no connection.":
    "无法连接提供商的服务器。服务器可能已离线，或你的设备未联网。",
  "The provider's server returned an error. Nothing on Harbor's side can fix this. Pick another source.":
    "提供商的服务器返回错误。Harbor 端无法修复，请选择其他来源。",
  "This page works while your TV is showing its setup screen. Go back to that screen on the TV, then try again.":
    "此页面仅在电视显示设置界面时有效。请在电视上返回该界面，然后重试。",
  "Turn on network serving": "开启网络服务",
  "Update all": "全部更新",
  "Use my own server": "使用我自己的服务器",
  "What's new on the network": "电视网最新内容",
  "Your TV did not confirm that. Check it is still on the setup screen.":
    "你的电视未确认该操作。请检查电视是否仍停留在设置界面。",
  "Your TV is not on the setup screen": "你的电视未停留在设置界面",
  "Addons you could install": "可安装的插件",
  "This exact install, served as a web app. Open it on a phone, laptop or TV browser and it streams through this computer.":
    "将当前安装的 Harbor 作为 Web 应用提供。在手机、笔记本电脑或电视浏览器上打开后，内容会通过此电脑播放。",
  "One switch serves Harbor on your network. Scan a code below with your phone, or open an address on any device on the same Wi-Fi.":
    "只需打开一个开关，即可通过局域网使用 Harbor。用手机扫描下方二维码，或在连接同一 Wi-Fi 的任意设备上打开地址。",
  "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.":
    "将 Harbor 设置导出到一个文件中，并精确选择要包含的内容。恢复时只会还原文件中包含的内容，且始终不包含你的 Stremio 登录信息。",
  "{n} episodes · {file}#one": "{n} 集 · {file}",
  "{n} episodes · {file}#few": "{n} 集 · {file}",
  "File it with the government": "将其提交给政府备案",
  'You file a tax return as a "sole proprietor" or self-employed. You owe tax on:':
    "你以“个体经营者”或自雇人士身份申报纳税。你需要按以下哪项缴税：",
  "Restart to update": "重启以更新",
  "Update ready": "更新已就绪",
  "Harbor {version} downloaded but did not install on its own.":
    "Harbor {version} 已下载，但未能自动安装。",
  "Reload original link": "重新加载原始链接",
  "Addon setup": "插件设置",
  "Paste a stremio:// link or an https://…/manifest.json URL.":
    "粘贴 stremio:// 链接或 https://…/manifest.json URL。",
  "Open it in a regular browser, set it up there, then come back and paste the install link below.":
    "请在常规浏览器中打开并完成设置，然后返回此处粘贴安装链接。",
  "Configure the addon above, then copy its manifest URL and paste it here. The web app can't catch the Install button automatically the way the desktop app does.":
    "请在上方配置插件，然后复制其清单 URL 并粘贴到此处。Web 应用无法像桌面应用一样自动捕获“安装”按钮。",
  "Paste the manifest URL, or click Install on the addon's configuration page above.":
    "粘贴清单 URL，或点击上方插件配置页面中的“安装”。",
  "stremio://… or https://…/manifest.json": "stremio://… 或 https://…/manifest.json",
  "Your browser's storage is full. Remove custom icons or delete profiles to free up space, then try again.":
    "浏览器存储空间已满。请移除自定义图标或删除配置方案以释放空间，然后重试。",
  "Save failed: {error}": "保存失败：{error}",
  "Save failed for an unknown reason.": "保存失败，原因未知。",
  "Not valid JSON. The file may be corrupted.": "JSON 无效。文件可能已损坏。",
  "Install an extension": "安装扩展",
  "Could not validate this API key.": "无法验证此 API 密钥。",
  "Google Books API key": "Google Books API 密钥",
  "Storage is full. Clear Harbor cache storage, then try saving again.":
    "存储空间已满。请清除 Harbor 缓存存储，然后重试保存。",
  "Translation test failed": "翻译测试失败",
  "DeepSeek API key (sk-...)": "DeepSeek API 密钥（sk-...）",
  "Update repository": "更新仓库",
  "Repository update failed.": "仓库更新失败。",
  "Translation failed": "翻译失败",
  "Edge TTS failed": "Edge TTS 失败",
  "Install ffmpeg": "安装 ffmpeg",
  "Restart Harbor after the install completes.": "安装完成后重启 Harbor。",
  "Open a terminal and run: brew install ffmpeg": "打开终端并运行：brew install ffmpeg",
  "Install ffmpeg using your system package manager (apt, dnf, pacman, zypper, etc.).":
    "使用系统包管理器（apt、dnf、pacman、zypper 等）安装 ffmpeg。",
  "Open a terminal and run: winget install Gyan.FFmpeg":
    "打开终端并运行：winget install Gyan.FFmpeg",
  "Enable Roku Network Access": "启用 Roku 网络访问",
  'Select "Control by mobile apps" and set Network access to "Default".':
    "选择“通过移动应用控制”，并将“网络访问”设为“默认”。",
  "Install Media Assistant": "安装 Media Assistant",
  "Install it.": "安装它。",
  "Harbor uses ffmpeg to convert streams into formats TVs can play. It's a one-time install and Harbor will pick it up automatically.":
    "Harbor 使用 ffmpeg 将视频流转换为电视可播放的格式。只需安装一次，Harbor 就会自动检测到它。",
  "Clip save failed": "剪辑保存失败",
  "Frame grab failed": "截帧失败",
  "GIF export failed": "GIF 导出失败",
  "Save dialog failed": "保存对话框出错",
  "Could not update privacy. Try again.": "无法更新隐私设置，请重试。",
  "large file ({size} KB)": "文件过大（{size} KB）",
  "Unexpected file contents.": "文件内容异常。",
  "Could not read the file.": "无法读取文件。",
  "One-time setup downloads the shader pack (about 1 MB) into Harbor. No files to hunt down.":
    "首次设置会将着色器包（约 1 MB）下载到 Harbor，无需自行查找文件。",
  "Couldn't read that image. Try a different file.": "无法读取该图片，请尝试其他文件。",
  "That file is {size}. Source images need to be under 16 MB before resizing.":
    "该文件大小为 {size}。源图片必须小于 16 MB 才能调整尺寸。",
  "Publish themes under your name and update them anytime.": "以你的名义发布主题，并可随时更新。",
  "Update photo": "更新头像",
  "Update password": "更新密码",
  "Install pack": "安装图标包",
  "Drop many images, GIFs, or a .zip at once. Name each file after its slot ({example}) and we match them. Any size is fine, we resize big images and keep animated GIFs light.":
    "一次拖入多张图片、GIF 或一个 .zip 文件。请以槽位名称为每个文件命名（{example}），我们会自动匹配。尺寸不限，我们会缩小过大的图片，并优化动态 GIF 的体积。",
  "{count} file was skipped": "已跳过 {count} 个文件",
  "Name each file after its slot": "以槽位名称为每个文件命名",
  "That is the whole trick. A file called {example} drops straight into the matching slot. The name before .png is all that matters, capitals and spaces are ignored.":
    "就这么简单。名为 {example} 的文件会直接放入对应槽位。只有 .png 前的名称有影响，大小写和空格均会被忽略。",
  "Click any single slot to pick one file, select many PNGs at once, or drop a whole .zip of them. Named files land in their slots automatically, the rest you can place by hand.":
    "点击单个槽位选择一个文件、一次选择多个 PNG，或拖入包含这些文件的整个 .zip。已按槽位命名的文件会自动归位，其余文件可手动放置。",
  "Update the pack or take it down whenever you want.": "你可以随时更新或下架此包。",
  "Update queued.": "更新已加入队列。",
  "Update the look or take it down whenever you want.": "你可以随时更新此外观或将其下架。",
  "API cheat sheet": "API 速查表",
  "window.harbor API": "window.harbor API",
  "{file} is empty. Start typing to restyle Harbor.":
    "{file} 为空。开始输入即可重新设置 Harbor 的样式。",
  "Open the TMDB API page": "打开 TMDB API 页面",
  "Use the button below. If you are not signed in yet TMDB says you do not have permission, which is normal. Click the link in that message to sign in.":
    "请使用下方按钮。如果您尚未登录，TMDB 会提示您没有权限，这是正常现象。点击该消息中的链接即可登录。",
  "Choose API in the sidebar": "在侧边栏中选择 API",
  "Confirm personal use once more and tick the box to agree to the API terms.":
    "再次确认仅供个人使用，并勾选复选框以同意 API 条款。",
  "Copy your API Key": "复制 API Key",
  "Back on the API page, scroll to the bottom. Copy the value under API Key and paste it into Harbor. Harbor saves it on its own.":
    "返回 API 页面并滚动到底部。复制 API Key 下方的值并粘贴到 Harbor。Harbor 会自动保存。",
  "Take the short API Key at the very bottom, not the long API Read Access Token above it.":
    "请复制最底部较短的 API Key，而不是其上方较长的 API Read Access Token。",
  "Sign-in failed.": "登录失败。",
  "Sharing your diagnostics for issue #{ticket}. Your session tokens, API keys, and passwords are removed before anything leaves your device.":
    "正在分享问题 #{ticket} 的诊断信息。任何数据离开设备前，都会移除会话令牌、API 密钥和密码。",
  Crash: "崩溃",
  "Previous native crash": "上次原生崩溃",
  "Something blew up while rendering. Reload to recover, or send us the technical detail.":
    "渲染时出了问题。请重新加载以恢复，或向我们发送技术详情。",
  "Resolving manifest": "正在解析清单",
  "Harbor couldn't reach MyAnimeList or AniList. Check your connection and try again.":
    "Harbor 无法连接 MyAnimeList 或 AniList。请检查网络连接后重试。",
  "Harbor on the server display": "服务器屏幕上的 Harbor",
  "Scanning your network...": "正在扫描您的网络…",
  "unavailable: {error}": "不可用：{error}",
  "File another": "再提交一个",
  "Episode titles, alternate names, network info, and the arc/DVD/absolute orderings. Layered on TMDB so the better source wins per field. Free for personal use at":
    "剧集标题、别名、电视网信息，以及篇章顺序、DVD 顺序和绝对顺序。与 TMDB 数据分层整合，每个字段采用更优来源。个人使用免费，获取地址：",
  "a bare RPDB-compatible server (your RPDB key is still sent), or a full URL template using":
    "一个基础 RPDB 兼容服务器地址（仍会发送您的 RPDB 密钥），或使用以下格式的完整 URL 模板",
  "The number is bytes divided by the time they actually took to arrive. Cloudflare is a single origin, so on a very fast line this can read lower than a multi-server test like speedtest.net.":
    "该数值用字节数除以数据实际到达所用时间得出。Cloudflare 是单一源站，因此在网速极快时，结果可能低于 speedtest.net 这类多服务器测试。",
  "Used to check cache and unrestrict links. Harbor never adds or removes torrents on its own.":
    "用于检查缓存和解除链接限制。Harbor 绝不会自行添加或移除种子。",
  "EU-hosted, fast cache check. Same read-only usage as the others.":
    "服务器位于欧盟，可快速检查缓存。与其他服务一样，仅进行只读操作。",
  "Couldn't save that background. Your local storage is full. Try a smaller crop or clear cached data.":
    "无法保存该背景。本地存储空间已满。请尝试缩小裁剪范围或清除缓存数据。",
  "Have a file?": "已有文件？",
  "Update submitted": "更新已提交",
  "Push a new version. Your published version stays live while the update is reviewed.":
    "推送新版本。更新审核期间，已发布的版本仍可正常使用。",
  "Submit update": "提交更新",
};

export default system;
