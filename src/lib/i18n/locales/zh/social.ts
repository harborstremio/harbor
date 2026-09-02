const social: Record<string, string> = {
  "Share with {name}": "与 {name} 共享",
  "Pick it from the home view to follow.": "在首页中选择即可关注。",
  "Next and Previous follow this show": "“下一项”和“上一项”将按本剧顺序跳转",
  "The TMDB community score.": "TMDB 社区评分。",
  "Watch Together rooms are routed through Harbor's hosted relay.":
    "“共同观看”房间通过 Harbor 托管的中继连接。",
  "Living-room focus, floating glass chrome.": "专为客厅操控优化的悬浮玻璃质感界面。",
  "Copied. Paste it to your friend.": "已复制，请粘贴给好友。",
  "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.":
    "Harbor Relay 是一个 Cloudflare Worker，为“一起看”功能托管 WebSocket 房间。每位用户都运行自己的实例，不存在中央 Harbor 服务器。",
  "The test calls {code} and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "测试会调用 {code}，确认 Worker 可访问且运行的是当前版本。测试通过表示“一起看”房间可以连接。",
  "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.":
    "如果“一起看”弹出窗口显示中继版本过旧的横幅，请按上述步骤重新部署。中继报告当前版本后，横幅会在你下次连接时自动消失。",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique {code} subdomain acts as the access token. There is no login.":
    "中继 URL 可以共享。任何拥有该 URL 的人都能加入托管在你中继上的“一起看”房间。唯一的 {code} 子域名相当于访问令牌，无需登录。",
  "A typical Watch Together session uses a few hundred messages per hour. Solo and small-group use stays well under free tier limits.":
    "一次典型的“一起看”会话每小时仅使用几百条消息。单人和小组使用量会远低于免费套餐限额。",
  "Watch Together rooms drop after 6 hours": "“一起看”房间在 6 小时后断开",
  "{code} with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "使用 WebSocket 升级访问 {code}：打开一个“一起看”房间。状态保存在 Durable Object 中，仅在当前会话期间保留。",
  "Set up a Cloudflare relay for Watch Together": "为一起看设置 Cloudflare 中继",
  "Watch Together panel": "一起观看面板",
  "Watch party join button": "一起看“加入”按钮",
  "Add a Join button with your room link while you're in a watch party.":
    "加入一起看房间后，添加带有房间链接的“加入”按钮。",
  "Watch Together": "一起看",
  "Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.":
    "请重新部署以获取最新的“一起看”修复。新版本上线后，应用内横幅会自动消失。",
  "Running the latest Watch Together protocol.": "正在运行最新的“一起看”协议。",
  "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Test to send yourself a sample first.":
    "连接 Discord 或 Telegram 后，你关注的内容即将上线时，Harbor 会发送消息。请先点击“测试”给自己发送一条示例消息。",
  "and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.":
    "并确认 Worker 可访问且运行的是当前版本。测试通过即表示“一起看”房间可以连接。",
  "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique":
    "中继 URL 可以共享。任何获得该 URL 的人都能加入由您的中继托管的“一起看”房间。唯一的",
  "with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.":
    "通过 WebSocket 升级打开“一起看”房间。状态保存在 Durable Object 中，仅在活动会话期间保留。",
  "Use community corrections": "使用社区修正",
  "Leave blank to use Harbor's own community server. Enter a URL to point at your own server instead. Private mode below stops all contact either way.":
    "留空则使用 Harbor 自有的社区服务器。也可输入 URL，改用你自己的服务器。无论选择哪种方式，下方的隐私模式都会阻止一切连接。",
  "Never contact the community server in either direction. Nothing is looked up and nothing is contributed from this device.":
    "绝不以任何方式连接社区服务器。此设备不会查询或贡献任何内容。",
  "Downloaded from community": "从社区下载",
  "Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.":
    "选择“一起看”以及最小化、最大化和关闭按钮的样式。“液态玻璃”会取代“简洁透明”控件。",
  "Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.":
    "Harbor 的后端运行在 ElfHosted 上。他们免费为社区运行我们的服务器。",
  "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.":
    "维持 Harbor 后端在线需要真金白银，而 ElfHosted 承担了这笔费用，社区无需付费。订阅 ElfHosted 是让这一切持续下去的最佳方式，而且这不是捐款。你自己的部署可以获得完善的基础设施，同时 Harbor 也能继续获得资金支持。",
  "Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.":
    "Harbor 使用 Stremio 的插件协议，整个插件生态都源自他们的工作。Stremio 由社区资助，提供支持的用户可以抢先体验实验性功能。如果你有余力，也请支持他们。",
  "Add a review": "添加短评",
  "Edit your review": "编辑你的短评",
  "Write a review": "撰写短评",
  "Edit review": "编辑短评",
  "Share your thoughts (optional)": "分享你的看法（可选）",
  "Save review": "保存短评",
  "Invite member": "邀请成员",
  "Create a group to watch and share together.": "创建群组，一起观看和分享。",
  "Link and social": "链接与社交账号",
  "Social links": "社交链接",
  "Add friend": "添加好友",
  "Sign in to leave a comment": "登录后即可发表评论",
  "Leave a comment. No links.": "发表评论，请勿包含链接。",
  "Unlike comment": "取消点赞评论",
  "Like comment": "点赞评论",
  "Delete comment": "删除评论",
  "Add your social links": "添加社交链接",
  "In a watch party": "正在参加同看派对",
  Share: "分享",
  "Remove friend": "删除好友",
  "1 friend in common": "1 位共同好友",
  "You have reached {max} lists. Remove one to make room.":
    "列表数量已达到 {max} 个。请移除一个以腾出空间。",
  "In a watch party of {count}": "正在参加 {count} 人观影派对",
  "Find people who watch what you watch. Join a group to share lists, post, and watch together.":
    "找到与你爱看相同内容的人。加入小组即可分享片单、发帖并一起观看。",
  "Groups are where people watch and read together. Start one and invite your friends.":
    "小组让大家一起观看和阅读。创建一个小组并邀请好友吧。",
  "Invite only": "仅限邀请",
  "It may be invite only, or it no longer exists.": "该小组可能仅限邀请加入，或已不存在。",
  "Share something with {group}": "在 {group} 中分享内容",
  "Share what you're watching, drop a recommendation, or announce a watch night.":
    "分享你正在观看的内容、推荐作品，或发布观影夜活动。",
  "Invite a member": "邀请成员",
  "Watch together": "一起观看",
  "Invite via link": "通过链接邀请",
  "Open invite link panel": "打开邀请链接面板",
  "Close invite link panel": "关闭邀请链接面板",
  Invite: "邀请",
  "Watch Together needs a relay.": "“一起观看”需要中继服务。",
  "Paste invite link": "粘贴邀请链接",
  "Start a new room": "创建新房间",
  "or paste an invite link": "或粘贴邀请链接",
  "Room code": "房间码",
  "Copy room code": "复制房间码",
  "Leave room": "离开房间",
  "Redeploy it to get the latest Watch Together fixes. Harbor's public relay updates on its own.":
    "重新部署即可获取最新的“一起看”修复。Harbor 的公共中继会自动更新。",
  "Start a room first.": "请先创建房间。",
  "Once you're in a room you can copy a link that joins anyone instantly: it sets the relay URL and the room code in one click.":
    "进入房间后，您可以复制一个链接，让任何人立即加入：只需点击一次，即可同时设置中继 URL 和房间码。",
  "Invite link": "邀请链接",
  "Copy invite link": "复制邀请链接",
  "Anyone who opens this link gets the relay URL and room code set automatically. Works in the browser too: no install required for the joiner.":
    "任何打开此链接的人都会自动设置中继 URL 和房间码。浏览器中也可使用：加入者无需安装。",
  "Play Together": "一起观看",
  "Failed to post comment": "发表评论失败",
  "Write a comment...": "发表评论…",
  "By community stars": "按社区星级排序",
  Community: "社区",
  "community API. Star, browse, and contribute on their site.":
    "社区 API。可在其网站上加星、浏览和贡献内容。",
  "Shared to the community": "已分享到社区",
  "Share to the community": "分享到社区",
  "Listed collections will appear in community browse when that rolls out.":
    "社区浏览功能上线后，公开的合集将显示在其中。",
  "Add up to {max} tags so people can find this in the community.":
    "最多添加 {max} 个标签，方便其他人在社区中找到此合集。",
  "{count} community ratings on stremio-addons.net": "stremio-addons.net 上有 {count} 条社区评分",
  "{n} titles need review — help us identify them.": "有 {n} 部作品待确认，请帮助我们识别。",
  "1 title needs review — help us identify it.": "有 1 部作品待确认，请帮助我们识别。",
  "Next review": "下一条评论",
  "Open review source": "打开评论来源",
  "Previous review": "上一条评论",
  review: "评论",
  Review: "评论",
  "Show a Skip button when a known injected ad plays, and a small report button on new releases so you can mark ads for review.":
    "播放已知的插入广告时显示“跳过”按钮，并在新发布内容上显示小型举报按钮，以便将广告标记为待审核。",
  "Thanks. Sent for review.": "谢谢。已提交审核。",
  "Know a good one? Add a name, its API or site URL, and an icon if you have one. We review every suggestion before it goes live.":
    "知道合适的来源？请添加名称、API 或网站 URL，如果有图标也可一并添加。每条建议都会在上线前经过审核。",
  "Only add repositories you trust. Harbor cannot vouch for third-party plugins.":
    "仅添加您信任的仓库。Harbor 无法为第三方插件担保。",
  "We review every source. Yours will be reviewed and approved shortly if it checks out.":
    "我们会审核每个来源。如果您的来源通过检查，很快就会获批。",
  "Could not respond to that invite.": "无法处理该邀请。",
  "Dismiss notification": "关闭通知",
  "Friend requests": "好友请求",
  Notification: "通知",
  "Popular community addons ranked by the public directory's stars. Install anything else by URL on the Browse tab.":
    "按公开目录星级排名的热门社区插件。其他插件可在「浏览」标签页中通过 URL 安装。",
  "Remove friend?": "移除好友？",
  "Review request": "审核请求",
  "Watch party": "一起看",
  "{n} titles together": "共同参与 {n} 部作品",
  "A passing test means Watch Together rooms will connect from this machine.":
    "测试通过即表示同看房间可从此设备建立连接。",
  "Browse community themes": "浏览社区主题",
  "Can post, moderate and invite": "可以发帖、管理和邀请成员",
  "Community collections are unavailable right now.": "社区合集当前不可用。",
  "Fresh looks shared by the Harbor community": "Harbor 社区分享的全新外观",
  "Harbor's own community server": "Harbor 自有社区服务器",
  "How Watch Together and the window buttons are drawn.": "“一起看”和窗口按钮的显示方式。",
  "Leave this blank to use Harbor's own community server, or enter the address of a server you run yourself.":
    "留空即可使用 Harbor 自有的社区服务器，也可以输入你自行运行的服务器地址。",
  "Paste a wss:// URL that a friend or your community shared with you.":
    "粘贴朋友或社区与你分享的 wss:// URL。",
  "Paste any YouTube link. Watch, share, shorts or embed all work.":
    "粘贴任意 YouTube 链接。观看页、分享链接、Shorts 或嵌入链接均可。",
  "Pick a drive with room to spare. Files already cached stay where they are.":
    "选择空间充足的驱动器。已缓存的文件会保留在原位置。",
  "Post, moderate and invite": "发帖、审核和邀请",
  "See what the people you follow are watching right now.": "查看你关注的人此刻正在观看什么。",
  "Share what you build and see who is using it.": "分享你的作品，并查看谁在使用它。",
  "Sign in to comment": "登录后评论",
  "Starting or joining a room. It has to happen on the device that is playing.":
    "创建或加入房间。必须在正在播放的设备上操作。",
  "Stops the TV playing to an empty room all night.": "防止电视对着空房间播放一整夜。",
  Together: "一起看",
  "Watch Together relay": "一起看中继",
  "Community collections are coming soon": "社区合集即将推出",
  "Curated, themed sets you can make beautiful and share by link. A Studio Ghibli shelf, the best heist movies, a marathon for a rainy weekend.":
    "创建精美的主题精选集，并通过链接分享。比如吉卜力工作室作品合集、最佳劫案电影，或雨天周末马拉松片单。",
  "From the community": "来自社区",
  "Give it a cover, a background, and the titles you want to show off. Then share the link.":
    "添加封面、背景和你想展示的作品，然后分享链接。",
  "What ties these together? A studio, a mood, a marathon night.":
    "是什么将这些作品联系在一起？同一个工作室、同一种氛围，或是一场刷片之夜。",
  "Make it bigger for a TV across the room, smaller for a desk monitor.":
    "远距离看电视时调大，使用桌面显示器时调小。",
  Social: "社交",
  "{count} community ratings on stremio-addons.net#one":
    "stremio-addons.net 上有 {count} 条社区评分",
  "{count} community ratings on stremio-addons.net#few":
    "stremio-addons.net 上有 {count} 条社区评分",
  "{n} titles need review — help us identify them.#one": "{n} 部作品需要审核，请帮助我们识别。#one",
  "{n} titles need review — help us identify them.#few": "{n} 部作品需要审核，请帮助我们识别。#few",
  "{n} titles together#one": "共 {n} 部作品#one",
  "{n} titles together#few": "共 {n} 部作品#few",
  'Friend asks you to "co-sign" a loan. You agree to:': "朋友请你为贷款“共同担保”。这表示你同意：",
  "Pay if the friend defaults": "如果朋友违约则代为还款",
  "Receive interest from the friend": "从朋友那里收取利息",
  "Inherit the largest share": "继承最大份额的遗产",
  "Not share their confidential info": "不泄露其机密信息",
  "A share matching your months worked": "与你实际工作月数相对应的薪资",
  "Follow them out?": "要一起退出吗？",
  "Stay in party": "留在派对中",
  "{staff} requested your diagnostics": "{staff} 请求获取你的诊断信息",
  "Harbor Staff": "Harbor 工作人员",
  "Share watch activity": "分享观看动态",
  "Share live watching status": "分享实时观看状态",
  "Remove community photo": "移除社区头像",
  "Remove your community photo": "移除你的社区头像",
  "Highly rated by the community": "社区高分推荐",
  "Share an icon pack": "分享图标包",
  "It goes to a quick review, then it's live for everyone.": "通过快速审核后，所有人都能使用。",
  "Submit for review": "提交审核",
  "Submitted for review": "已提交审核",
  "Could not post your comment.": "无法发布评论。",
  "Share what you think. [b]bold[/b], [img]https://...[/img], and links welcome.":
    "分享你的想法。支持 [b]粗体[/b]、[img]https://...[/img] 和链接。",
  "This comment can't be posted.": "无法发布这条评论。",
  "Share a pack": "分享素材包",
  "No community themes yet": "暂无社区主题",
  "Browse community": "浏览社区",
  "{actor} left a comment": "{actor} 留下了评论",
  "No community themes yet. Be the first to share one.": "暂无社区主题。快来分享第一个吧。",
  "Fresh from the community": "社区新作",
  "Made a look you love? Share it with the community in a couple of clicks and watch the downloads roll in.":
    "打造了心仪的外观？只需点击几下即可分享到社区，坐看下载量节节攀升。",
  "The author submitted a new version that's in review. You're seeing the current published version until it's approved.":
    "作者提交了新版本，目前正在审核。获批前，你看到的仍是当前已发布版本。",
  "The most-downloaded creators in the community.": "社区中下载量最高的创作者。",
  "No themes to share yet": "暂无可分享的主题",
  "Pick one of your themes to share.": "选择一个要分享的主题。",
  "You have no key yet, so TMDB asks you to request one. Follow the link to create it.":
    "您还没有密钥，因此 TMDB 会提示您申请。点击链接即可创建。",
  "TMDB confirms the key is created. Follow the link it gives you to see your API key details.":
    "TMDB 会确认密钥已创建。点击其提供的链接，即可查看 API 密钥详情。",
  "Community index": "社区指数",
  "Ranked by the {site} community from their public index.": "根据{site}社区的公开指数排名。",
  "Verified Harbor Staff": "已认证的 Harbor 员工",
  "Share diagnostics": "分享诊断信息",
  "Sorry, Harbor crashed the last time it was running. You can review the details and choose whether to send a report.":
    "抱歉，Harbor 上次运行时崩溃了。你可以查看详情并选择是否发送报告。",
  "Got one a friend shared? Drop it in.": "有朋友分享的主题？拖到这里即可。",
  "Update in review": "更新审核中",
  "Push updates, flip visibility, and track where each one is in review.":
    "推送更新、切换可见性并跟踪每个主题的审核状态。",
  "Your new version is in for a quick review. The live listing keeps working until this one is approved.":
    "新版本已提交快速审核。在获批前，当前线上版本仍可正常使用。",
};

export default social;
