// Newly introduced UI copy remains usable until each locale provides an override.
const uiFallback: Record<string, string> = {
  "#": "#",
  "%": "%",
  "1 minute": "1 minute",
  "1 second": "1 second",
  "1280 × 720.": "1280 × 720.",
  "14s": "14s",
  "1920 × 1080. This is what the Watch Trailer button targets.":
    "1920 × 1080. This is what the Watch Trailer button targets.",
  "2 minutes": "2 minutes",
  "20s": "20s",
  "6-digit code": "6-digit code",
  "640 × 360. Fastest to start, softest picture.": "640 × 360. Fastest to start, softest picture.",
  "90 seconds": "90 seconds",
  "A Letterboxd list you added by address.": "A Letterboxd list you added by address.",
  "A list by {owner}, {n} films.": "A list by {owner}, {n} films.",
  "A list by {owner}.": "A list by {owner}.",
  "A pack file lists your images with names and sets. Point items at files next to the JSON, at http links, or inline them as data URIs. Hover a set you imported and press Export to write one out.":
    "A pack file lists your images with names and sets. Point items at files next to the JSON, at http links, or inline them as data URIs. Hover a set you imported and press Export to write one out.",
  "A pack swaps Harbor's built-in badge art, or adds whole new badges of its own.":
    "A pack swaps Harbor's built-in badge art, or adds whole new badges of its own.",
  "A regular expression Harbor tests against each stream title. Every stream that matches gets this badge.":
    "A regular expression Harbor tests against each stream title. Every stream that matches gets this badge.",
  "A rule watches for one kind of release and pings the channels you pick. Each rule fires on its own.":
    "A rule watches for one kind of release and pings the channels you pick. Each rule fires on its own.",
  "A short hand-picked list, plus a box for pasting any badges.json link you were sent.":
    "A short hand-picked list, plus a box for pasting any badges.json link you were sent.",
  "A stream row in the play picker": "A stream row in the play picker",
  "API-Sports": "API-Sports",
  "API-Sports key": "API-Sports key",
  "API-Sports · leagues ESPN does not carry": "API-Sports · leagues ESPN does not carry",
  Acknowledgements: "Acknowledgements",
  "Add a Discord or Telegram destination first. Rules need somewhere to send their alerts.":
    "Add a Discord or Telegram destination first. Rules need somewhere to send their alerts.",
  "Add a Discord webhook URL on the Destinations tab first.":
    "Add a Discord webhook URL on the Destinations tab first.",
  "Add a Telegram bot token on the Destinations tab first.":
    "Add a Telegram bot token on the Destinations tab first.",
  "Add a rule": "Add a rule",
  "Add an IPTV source": "Add an IPTV source",
  "Add another home server": "Add another home server",
  "Add people in the Custom calendar manager first, then come back to this rule.":
    "Add people in the Custom calendar manager first, then come back to this rule.",
  "Add teams": "Add teams",
  "Add to your teams": "Add to your teams",
  "Addons ({n})": "Addons ({n})",
  "Adds a comments section to movie, show, and episode pages. No Trakt account needed to read them.":
    "Adds a comments section to movie, show, and episode pages. No Trakt account needed to read them.",
  "Adds it to the top of your list, already switched on.":
    "Adds it to the top of your list, already switched on.",
  "Adds the New York Times bestseller lists to the eBook page, on the hero and as a row, with rank and weeks on the list. Free key at":
    "Adds the New York Times bestseller lists to the eBook page, on the hero and as a row, with rank and weeks on the list. Free key at",
  "Advanced: use an access token": "Advanced: use an access token",
  "Aggregator addons": "Aggregator addons",
  "All listed rules": "All listed rules",
  "All selected": "All selected",
  "Also joins Harbor's Discord server.": "Also joins Harbor's Discord server.",
  "Always use for {league}": "Always use for {league}",
  "An accent line down the side, with each line revealed as it arrives.":
    "An accent line down the side, with each line revealed as it arrives.",
  "Animated sidebar icons": "Animated sidebar icons",
  "Another shortcut in this list now uses the same key. Change one of them.":
    "Another shortcut in this list now uses the same key. Change one of them.",
  "Any badges.json address works: a raw gist, Pastebin, or a file in a repo. Broken JSON gets repaired automatically.":
    "Any badges.json address works: a raw gist, Pastebin, or a file in a repo. Broken JSON gets repaired automatically.",
  "Anything TMDB has not translated stays in English. Picking a new language reloads Harbor.":
    "Anything TMDB has not translated stays in English. Picking a new language reloads Harbor.",
  "Appears in the release notes. Use whatever name you want credit under.":
    "Appears in the release notes. Use whatever name you want credit under.",
  "Apply and reload": "Apply and reload",
  "Attach a channel": "Attach a channel",
  "Attach a stream": "Attach a stream",
  "Auto uses mpv when Harbor can reach it and falls back to the built in player. Pick one yourself if playback misbehaves.":
    "Auto uses mpv when Harbor can reach it and falls back to the built in player. Pick one yourself if playback misbehaves.",
  Automatic: "Automatic",
  Avatar: "Avatar",
  "Badge art packs you installed from the community store. Remove one to put its badges back to Harbor's default.":
    "Badge art packs you installed from the community store. Remove one to put its badges back to Harbor's default.",
  "Badges you have changed": "Badges you have changed",
  Bench: "Bench",
  "Both shows direct, debrid, and peer-to-peer results together. Direct/debrid keeps torrents out of the way unless nothing else is available. P2P puts torrents first.":
    "Both shows direct, debrid, and peer-to-peer results together. Direct/debrid keeps torrents out of the way unless nothing else is available. P2P puts torrents first.",
  "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor through the Stremboxd bridge.":
    "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor through the Stremboxd bridge.",
  "Browse community badge packs": "Browse community badge packs",
  "Build a pack in one of these tools, export the JSON, host it as a gist, then paste the raw link below.":
    "Build a pack in one of these tools, export the JSON, host it as a gist, then paste the raw link below.",
  "Built on": "Built on",
  "Built-in format chips first, then any of your rules that match.":
    "Built-in format chips first, then any of your rules that match.",
  "Buttons, states, and the things that live on a card.":
    "Buttons, states, and the things that live on a card.",
  "Cached stream files and the DHT cache are deleted. The next stream starts from scratch.":
    "Cached stream files and the DHT cache are deleted. The next stream starts from scratch.",
  "Came off": "Came off",
  "Came on": "Came on",
  "Caps how many score chips a poster shows. Extras drop off the end of the chip. You have {n} turned on.":
    "Caps how many score chips a poster shows. Extras drop off the end of the chip. You have {n} turned on.",
  "Caps what Harbor asks {name} to send. Original streams the file exactly as it is stored.":
    "Caps what Harbor asks {name} to send. Original streams the file exactly as it is stored.",
  Carousel: "Carousel",
  "Centered along the top edge, clear of the subtitles.":
    "Centered along the top edge, clear of the subtitles.",
  "Change the ratio while watching": "Change the ratio while watching",
  "Change the shortcut for {name}": "Change the shortcut for {name}",
  "Change your picture": "Change your picture",
  "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.":
    "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.",
  "Charity Navigator": "Charity Navigator",
  "Checks the username against Stremboxd and turns on the catalogs it finds.":
    "Checks the username against Stremboxd and turns on the catalogs it finds.",
  "Chips are off, so the row stays bare.": "Chips are off, so the row stays bare.",
  "Choose a file": "Choose a file",
  "Choose source": "Choose source",
  "Choose whether Play asks you, prefers this device, prefers online sources, or goes straight to one of your home servers.":
    "Choose whether Play asks you, prefers this device, prefers online sources, or goes straight to one of your home servers.",
  "Choose whether your operating system draws the title bar, or Harbor draws its own.":
    "Choose whether your operating system draws the title bar, or Harbor draws its own.",
  "Choose which services feed your Continue Watching row. Turn on as many as you like and Harbor merges them, keeping the most recent progress for each title. What you watch is still scrobbled to every connected service regardless of what you pick here.":
    "Choose which services feed your Continue Watching row. Turn on as many as you like and Harbor merges them, keeping the most recent progress for each title. What you watch is still scrobbled to every connected service regardless of what you pick here.",
  "Choose your username": "Choose your username",
  "Clear home team": "Clear home team",
  "Clearing these is always safe. Nothing you downloaded on purpose is removed.":
    "Clearing these is always safe. Nothing you downloaded on purpose is removed.",
  "Cloudflare is a single origin, so on a very fast line this can read lower than a multi-server test. Uses up to 150 MB, with a 90 second cooldown.":
    "Cloudflare is a single origin, so on a very fast line this can read lower than a multi-server test. Uses up to 150 MB, with a 90 second cooldown.",
  Colored: "Colored",
  "Colors your name, your cursor in Watch Together, and the ring around your avatar.":
    "Colors your name, your cursor in Watch Together, and the ring around your avatar.",
  "Comments and reviews posted by other Trakt members.":
    "Comments and reviews posted by other Trakt members.",
  Compatibility: "Compatibility",
  "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Send test to send yourself a sample first.":
    "Connect Discord or Telegram and Harbor posts a message when something you follow is about to drop. Hit Send test to send yourself a sample first.",
  "Connect Jellyfin, Emby, and Plex libraries on this device. Credentials stay in native secret storage. Each server keeps its own refresh schedule, and cached titles stay available while a server is offline.":
    "Connect Jellyfin, Emby, and Plex libraries on this device. Credentials stay in native secret storage. Each server keeps its own refresh schedule, and cached titles stay available while a server is offline.",
  "Connected. {n} catalogs are available.": "Connected. {n} catalogs are available.",
  "Content Advisory": "Content Advisory",
  "Content advisory style": "Content advisory style",
  "Continue Watching on Home": "Continue Watching on Home",
  "Continue Watching sources": "Continue Watching sources",
  "Continue with Discord": "Continue with Discord",
  "Converts video to plain 8-bit before display for graphics cards that glitch on 10-bit or unusual formats. Fixes some visual artifacts, but turns off HDR. Leave off unless you need it.":
    "Converts video to plain 8-bit before display for graphics cards that glitch on 10-bit or unusual formats. Fixes some visual artifacts, but turns off HDR. Leave off unless you need it.",
  "Copies your badge art and rules to the clipboard as JSON, ready to paste into a gist and share.":
    "Copies your badge art and rules to the clipboard as JSON, ready to paste into a gist and share.",
  "Copy JSON": "Copy JSON",
  "Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor.":
    "Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor.",
  "Could not reach that page.": "Could not reach that page.",
  "Could not reach the extension list. Check your server connection and try again.":
    "Could not reach the extension list. Check your server connection and try again.",
  "Couldn't save the playlist. Free up storage space in Settings and try again.":
    "Couldn't save the playlist. Free up storage space in Settings and try again.",
  "Covers everything. The taskbar is hidden.": "Covers everything. The taskbar is hidden.",
  "Curated packs and link import": "Curated packs and link import",
  "Currently using {name}. Pick another preset or build your own.":
    "Currently using {name}. Pick another preset or build your own.",
  "Cursor speed": "Cursor speed",
  "Custom theme": "Custom theme",
  "Data copied from {name}": "Data copied from {name}",
  "Days to wait between automatic refreshes of this library.":
    "Days to wait between automatic refreshes of this library.",
  "Decide whether the genres below apply to movies or to series.":
    "Decide whether the genres below apply to movies or to series.",
  "Deep shadows keep their steps, so dark scenes stay readable.":
    "Deep shadows keep their steps, so dark scenes stay readable.",
  "Describe the result you were after.": "Describe the result you were after.",
  "Describe what Harbor did instead, including any message on screen.":
    "Describe what Harbor did instead, including any message on screen.",
  "Didn't get it? Send another code": "Didn't get it? Send another code",
  "Direct media link": "Direct media link",
  Direct3D: "Direct3D",
  "Directed by {names}": "Directed by {names}",
  "Discord confirmed. Pick a username and password to finish.":
    "Discord confirmed. Pick a username and password to finish.",
  "Discord linked": "Discord linked",
  Display: "Display",
  "Displays the raw release filename under each source in the condensed picker. Off keeps rows compact. The Stremio layout always shows it.":
    "Displays the raw release filename under each source in the condensed picker. Off keeps rows compact. The Stremio layout always shows it.",
  Donate: "Donate",
  "Download folder": "Download folder",
  "Downloaded and ready to use. Re-download to pick up a newer version from the author.":
    "Downloaded and ready to use. Re-download to pick up a newer version from the author.",
  Draws: "Draws",
  Drew: "Drew",
  "Each title gets its own folder holding its EPUB or PDF.":
    "Each title gets its own folder holding its EPUB or PDF.",
  "Egyptian, Qatari, Emirati and Korean football plus the KHL on the sports page.":
    "Egyptian, Qatari, Emirati and Korean football plus the KHL on the sports page.",
  "ElfHosted plans": "ElfHosted plans",
  Elsewhere: "Elsewhere",
  "Email address or Discord handle": "Email address or Discord handle",
  "Embedded player": "Embedded player",
  "Enable the Books API on your app. Lists refresh weekly.":
    "Enable the Books API on your app. Lists refresh weekly.",
  "Enter a full http:// or https:// address.": "Enter a full http:// or https:// address.",
  "Enter your code": "Enter your code",
  Essentials: "Essentials",
  Estimated: "Estimated",
  "Every change on this page shows up here first. The art you pick below rides on rows exactly like this one.":
    "Every change on this page shows up here first. The art you pick below rides on rows exactly like this one.",
  "Every format badge Harbor can show on streams. Pick one to swap its art, hide it, or put it back. Changes apply everywhere badges appear.":
    "Every format badge Harbor can show on streams. Pick one to swap its art, hide it, or put it back. Changes apply everywhere badges appear.",
  "Every saved frame goes. Press again to confirm, or wait to cancel.":
    "Every saved frame goes. Press again to confirm, or wait to cancel.",
  "Every source above follows one language order, and it lives on the Languages page.":
    "Every source above follows one language order, and it lives on the Languages page.",
  "Everything cached is removed. Anything you reopen downloads again from scratch.":
    "Everything cached is removed. Anything you reopen downloads again from scratch.",
  "Everything else that moves": "Everything else that moves",
  "Everything pulled toward the middle, so nothing jolts you late at night.":
    "Everything pulled toward the middle, so nothing jolts you late at night.",
  "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.":
    "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.",
  "Export again": "Export again",
  "Export failed: {error}": "Export failed: {error}",
  "Export log": "Export log",
  "Export pack": "Export pack",
  "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.":
    "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.",
  "Export your setup": "Export your setup",
  "Export {n} sections": "Export {n} sections",
  "Exporting…": "Exporting…",
  "Fade the text back if it sits too hard over bright scenes.":
    "Fade the text back if it sits too hard over bright scenes.",
  "Fallbacks for machines where the modern video path misbehaves. Leave these alone unless the picture is wrong or a file won't start.":
    "Fallbacks for machines where the modern video path misbehaves. Leave these alone unless the picture is wrong or a file won't start.",
  "Favorites ({n})": "Favorites ({n})",
  "Featured matches": "Featured matches",
  "Files land in a folder named after the movie or series instead of loose in the download folder.":
    "Files land in a folder named after the movie or series instead of loose in the download folder.",
  "Fills the screen, but the title bar and taskbar stay.":
    "Fills the screen, but the title bar and taskbar stay.",
  "Fills the sports page where ESPN has no feed: Egyptian Premier League, Qatar Stars League, UAE Pro League, K League and the KHL, with lineups and live minutes. Free key at":
    "Fills the sports page where ESPN has no feed: Egyptian Premier League, Qatar Stars League, UAE Pro League, K League and the KHL, with lineups and live minutes. Free key at",
  "Find a stream on a page": "Find a stream on a page",
  "Find a stream on a web page": "Find a stream on a web page",
  "Find streams": "Find streams",
  "Finish creating my account": "Finish creating my account",
  "Finish the setup on the configure page, then paste the manifest URL it hands back here.":
    "Finish the setup on the configure page, then paste the manifest URL it hands back here.",
  "Follow a club to pin its fixtures and results": "Follow a club to pin its fixtures and results",
  "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer, because this mode bypasses the HDR display path. Leave off unless you see that line. Restart playback to apply.":
    "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer, because this mode bypasses the HDR display path. Leave off unless you see that line. Restart playback to apply.",
  "Frosts the still image on each unwatched episode in the list.":
    "Frosts the still image on each unwatched episode in the list.",
  "Full mode is active, so diary, friends activity and your ratings all work.":
    "Full mode is active, so diary, friends activity and your ratings all work.",
  "Full mode signs in with your Letterboxd password so your diary, friends activity and personal ratings work too. The password goes only to Stremboxd to fetch a token, and Harbor never stores it.":
    "Full mode signs in with your Letterboxd password so your diary, friends activity and personal ratings work too. The password goes only to Stremboxd to fetch a token, and Harbor never stores it.",
  "Full pack format reference: docs/avatar-packs.md in the Harbor repository.":
    "Full pack format reference: docs/avatar-packs.md in the Harbor repository.",
  "Full time": "Full time",
  GB: "GB",
  GD: "GD",
  GP: "GP",
  "GPU (compatibility)": "GPU (compatibility)",
  "GPU next": "GPU next",
  Goals: "Goals",
  Graphics: "Graphics",
  "Groups Refresh beside Back at the start of the picker header. Off keeps it at the far end, across from Back.":
    "Groups Refresh beside Back at the start of the picker header. Off keeps it at the far end, across from Back.",
  "Harbor did not draw its own icons. Two people did, and they are worth hiring.":
    "Harbor did not draw its own icons. Two people did, and they are worth hiring.",
  "Harbor hosts no media and indexes no media. The sources and addons available to you are the ones you choose to configure, and their use is subject to the laws of your jurisdiction and the terms of the services concerned.":
    "Harbor hosts no media and indexes no media. The sources and addons available to you are the ones you choose to configure, and their use is subject to the laws of your jurisdiction and the terms of the services concerned.",
  "Harbor is an independent client. It is not affiliated with, endorsed by, or sponsored by Stremio, or by any company, addon author, or trademark holder referenced in this application. All trademarks are the property of their respective owners.":
    "Harbor is an independent client. It is not affiliated with, endorsed by, or sponsored by Stremio, or by any company, addon author, or trademark holder referenced in this application. All trademarks are the property of their respective owners.",
  "Harbor is authorized on this device and syncing with Simkl.":
    "Harbor is authorized on this device and syncing with Simkl.",
  "Harbor is free and open source software, released under the MIT License.":
    "Harbor is free and open source software, released under the MIT License.",
  "Harbor is signed in to your MyAnimeList account.":
    "Harbor is signed in to your MyAnimeList account.",
  "Harbor is using {used} of the {quota} this computer allows.":
    "Harbor is using {used} of the {quota} this computer allows.",
  "Harbor library": "Harbor library",
  "Harbor opens 4 parallel requests to speed.cloudflare.com, discards the first 1.2 seconds so TCP slow-start does not tank the result, then measures until it has 150 MB or 8 seconds of steady transfer.":
    "Harbor opens 4 parallel requests to speed.cloudflare.com, discards the first 1.2 seconds so TCP slow-start does not tank the result, then measures until it has 150 MB or 8 seconds of steady transfer.",
  "Harbor opens only the address you paste here and lists the media it finds in that page's own source. It does not search anywhere else.":
    "Harbor opens only the address you paste here and lists the media it finds in that page's own source. It does not search anywhere else.",
  "Harbor picks the best stream it can find and starts playing straight away.":
    "Harbor picks the best stream it can find and starts playing straight away.",
  "Harbor picks the size your connection can keep up with.":
    "Harbor picks the size your connection can keep up with.",
  "Harbor puts streams, audio tracks and subtitles in these languages first. Leave it empty to accept anything.":
    "Harbor puts streams, audio tracks and subtitles in these languages first. Leave it empty to accept anything.",
  "Harbor reads your display and lands between the two.":
    "Harbor reads your display and lands between the two.",
  "Harbor scales the prompt to the episode length, so a short episode does not ask this early. The bar shows the last three minutes.":
    "Harbor scales the prompt to the episode length, so a short episode does not ask this early. The bar shows the last three minutes.",
  "Harbor scrobbles your playback to Trakt and keeps your watchlist in sync.":
    "Harbor scrobbles your playback to Trakt and keeps your watchlist in sync.",
  "Harbor shows the full list of streams every time so you choose one yourself.":
    "Harbor shows the full list of streams every time so you choose one yourself.",
  "Harbor shows you a short code to type in at trakt.tv. Scrobbling and watchlist sync begin the moment you approve it.":
    "Harbor shows you a short code to type in at trakt.tv. Scrobbling and watchlist sync begin the moment you approve it.",
  "Harbor signs out and stops syncing. Your lists on Simkl are left exactly as they are.":
    "Harbor signs out and stops syncing. Your lists on Simkl are left exactly as they are.",
  "Harbor signs out and stops updating your progress. Your list on MyAnimeList is left as it is.":
    "Harbor signs out and stops updating your progress. Your list on MyAnimeList is left as it is.",
  "Harbor tries HTTP, HTTPS, reverse proxies, and the provider's default port. Credentials are stored separately.":
    "Harbor tries HTTP, HTTPS, reverse proxies, and the provider's default port. Credentials are stored separately.",
  "Harbor uses its own community server. You can point it at a server you run yourself.":
    "Harbor uses its own community server. You can point it at a server you run yourself.",
  "Head to head": "Head to head",
  "Heads-up time": "Heads-up time",
  "Hide email address": "Hide email address",
  "Hide the code editors": "Hide the code editors",
  "Hides the episode name, which often gives the twist away on its own.":
    "Hides the episode name, which often gives the twist away on its own.",
  "Hides the synopsis text under each unwatched episode.":
    "Hides the synopsis text under each unwatched episode.",
  "Hold Ctrl or Cmd and scroll to resize Harbor's interface smoothly. This one cannot be changed.":
    "Hold Ctrl or Cmd and scroll to resize Harbor's interface smoothly. This one cannot be changed.",
  "Home team": "Home team",
  "How Harbor draws its own interface. Leave this on Automatic unless the app itself stutters, flickers or tears while scrolling, which some G-SYNC and high refresh rate setups do. Switching backends usually settles it. This does not affect video playback.":
    "How Harbor draws its own interface. Leave this on Automatic unless the app itself stutters, flickers or tears while scrolling, which some G-SYNC and high refresh rate setups do. Switching backends usually settles it. This does not affect video playback.",
  "How big the handle sits on the timeline while you scrub.":
    "How big the handle sits on the timeline while you scrub.",
  "How dark the gradient behind the featured title on Home is. 100% is the classic look.":
    "How dark the gradient behind the featured title on Home is. 100% is the classic look.",
  "How far ahead of the start time Harbor pings you. It scans your playlist EPG every 30 minutes.":
    "How far ahead of the start time Harbor pings you. It scans your playlist EPG every 30 minutes.",
  "How heavy the stroke around each letter is.": "How heavy the stroke around each letter is.",
  "How large every poster card is drawn across Home and search.":
    "How large every poster card is drawn across Home and search.",
  "How large subtitles are drawn on the video, at any window size.":
    "How large subtitles are drawn on the video, at any window size.",
  "How long Harbor fills the buffer before the picture appears.":
    "How long Harbor fills the buffer before the picture appears.",
  "How long a poster takes to grow and settle as the pointer passes it.":
    "How long a poster takes to grow and settle as the pointer passes it.",
  "How many episodes auto-play back to back before Harbor pauses to ask.":
    "How many episodes auto-play back to back before Harbor pauses to ask.",
  "How much of the video Harbor downloads in front of where you are watching.":
    "How much of the video Harbor downloads in front of where you are watching.",
  "How often Harbor re-reads the library index from {name}. Manual only refreshes when you press Sync now.":
    "How often Harbor re-reads the library index from {name}. Manual only refreshes when you press Sync now.",
  "How quickly the Harbor cursor moves with the right stick.":
    "How quickly the Harbor cursor moves with the right stick.",
  "How rounded the corners of every poster card are.":
    "How rounded the corners of every poster card are.",
  "How solid the panel behind the text looks over the video.":
    "How solid the panel behind the text looks over the video.",
  "How strongly the buffered part stands out against the rest of the bar.":
    "How strongly the buffered part stands out against the rest of the bar.",
  "How subtitles are drawn over the picture. The still below updates as you change anything, so you can judge the size and the contrast before you start a film.":
    "How subtitles are drawn over the picture. The still below updates as you change anything, so you can judge the size and the contrast before you start a film.",
  "How the buttons map in each context. Xbox glyphs are listed first, PlayStation second. The layout is fixed and cannot be changed.":
    "How the buttons map in each context. Xbox glyphs are listed first, PlayStation second. The layout is fixed and cannot be changed.",
  "How the navigation icons behave.": "How the navigation icons behave.",
  "How thick the timeline sits at the bottom of the player.":
    "How thick the timeline sits at the bottom of the player.",
  Hue: "Hue",
  "If a stream or the video player misbehaves, the log usually names the cause.":
    "If a stream or the video player misbehaves, the log usually names the cause.",
  "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.":
    "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.",
  "Image address": "Image address",
  "Import data from {name}": "Import data from {name}",
  "Import from a file": "Import from a file",
  "Import from a link": "Import from a link",
  "Import or export a .json pack": "Import or export a .json pack",
  "Import pack (.json)": "Import pack (.json)",
  "Include anime episodes and seasons, even when TV is turned off.":
    "Include anime episodes and seasons, even when TV is turned off.",
  "Include film releases from every source you turned on above.":
    "Include film releases from every source you turned on above.",
  "Include series premieres and new episodes. Anime is counted separately.":
    "Include series premieres and new episodes. Anime is counted separately.",
  Independence: "Independence",
  "Instant playback preparation": "Instant playback preparation",
  "Instant starts the best-ranked stream straight away. Pick a source opens the stream list every time, so you choose the release, quality and provider yourself.":
    "Instant starts the best-ranked stream straight away. Pick a source opens the stream list every time, so you choose the release, quality and provider yourself.",
  "Jump to today": "Jump to today",
  "Keeps subtitles visible when the player shrinks into the small floating window. Turn off to hide them there.":
    "Keeps subtitles visible when the player shrinks into the small floating window. Turn off to hide them there.",
  "Keyboard size": "Keyboard size",
  L: "L",
  "Latest chapters": "Latest chapters",
  "Letterboxd asked for a second step. Enter the six digit code, then connect again.":
    "Letterboxd asked for a second step. Enter the six digit code, then connect again.",
  "Licence texts": "Licence texts",
  "Lift subtitles clear of a letterbox bar or a burned-in logo.":
    "Lift subtitles clear of a letterbox bar or a burned-in logo.",
  Lineups: "Lineups",
  "Link Discord": "Link Discord",
  "Linked as {username}": "Linked as {username}",
  "Linked to your Harbor account.": "Linked to your Harbor account.",
  "Live TV, {scope}, {minutes} min lead": "Live TV, {scope}, {minutes} min lead",
  "Live now": "Live now",
  "Live preview is on. Save keeps what you've picked as your Custom theme. Reset reverts the editor to the saved palette.":
    "Live preview is on. Save keeps what you've picked as your Custom theme. Reset reverts the editor to the saved palette.",
  "Loaders, boats, and the bits between screens.": "Loaders, boats, and the bits between screens.",
  "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.":
    "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.",
  "Look any of them up before you give, or find a cause of your own.":
    "Look any of them up before you give, or find a cause of your own.",
  Lost: "Lost",
  "Low end lifted, for weight on speakers that do not have it.":
    "Low end lifted, for weight on speakers that do not have it.",
  "Low end pulled back, kinder to small speakers and to the neighbours.":
    "Low end pulled back, kinder to small speakers and to the neighbours.",
  "Low is cosmetic. Normal is annoying. High means a feature is broken. Critical means Harbor is unusable.":
    "Low is cosmetic. Normal is annoying. High means a feature is broken. Critical means Harbor is unusable.",
  "Manage this rule": "Manage this rule",
  "Match details are not available yet.": "Match details are not available yet.",
  "Match preview": "Match preview",
  "Match report": "Match report",
  "Match stats": "Match stats",
  "Measure this connection": "Measure this connection",
  Meetings: "Meetings",
  "Mid range lifted, so dialogue sits forward of the music and effects.":
    "Mid range lifted, so dialogue sits forward of the music and effects.",
  "Modern renderer with higher-quality processing. The right choice for almost every machine.":
    "Modern renderer with higher-quality processing. The right choice for almost every machine.",
  "Monochrome (White)": "Monochrome (White)",
  Motion: "Motion",
  "MyAnimeList is a free site for tracking the anime you watch. Open it to read more or to make an account.":
    "MyAnimeList is a free site for tracking the anime you watch. Open it to read more or to make an account.",
  NR: "NR",
  NRR: "NRR",
  "Name of the badge": "Name of the badge",
  "Name or pattern": "Name or pattern",
  "Name what broke in one sentence. Maintainers read this line first.":
    "Name what broke in one sentence. Maintainers read this line first.",
  "Narrow the list below by rule name or by the pattern text.":
    "Narrow the list below by rule name or by the pattern text.",
  "Navigation animations": "Navigation animations",
  "Needs an API-Sports key. The free plan covers it.":
    "Needs an API-Sports key. The free plan covers it.",
  "New releases": "New releases",
  "Next match": "Next match",
  "No fixtures on this day.": "No fixtures on this day.",
  "No fixtures scheduled": "No fixtures scheduled",
  "No number": "No number",
  "No playable media was found in that page's source.":
    "No playable media was found in that page's source.",
  "No prompt. The episode plays out and stops.": "No prompt. The episode plays out and stops.",
  "No settings match that.": "No settings match that.",
  "No shaping. The track plays exactly as it was mixed.":
    "No shaping. The track plays exactly as it was mixed.",
  "No sports channels found in your playlists.": "No sports channels found in your playlists.",
  "No subtitle addons installed yet.": "No subtitle addons installed yet.",
  "No teams available for these competitions yet.":
    "No teams available for these competitions yet.",
  "No teams match that search.": "No teams match that search.",
  "None of the images in that pack could be loaded.":
    "None of the images in that pack could be loaded.",
  "None yet. This opens Streaming sources, where subtitle addons are installed.":
    "None yet. This opens Streaming sources, where subtitle addons are installed.",
  "Not verified on macOS yet. It needs the gpu-next renderer, which is reliable on Windows.":
    "Not verified on macOS yet. It needs the gpu-next renderer, which is reliable on Windows.",
  "Nothing in this title to badge.": "Nothing in this title to badge.",
  "Number every step from a fresh start. This is the single most useful thing in a report.":
    "Number every step from a fresh start. This is the single most useful thing in a report.",
  "Nvidia RTX GPUs only. Upconverts SDR video to HDR on the GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.":
    "Nvidia RTX GPUs only. Upconverts SDR video to HDR on the GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.",
  "Nvidia RTX GPUs only. Upscales SDR video with AI on the GPU (turn on RTX Video Super Resolution in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.":
    "Nvidia RTX GPUs only. Upscales SDR video with AI on the GPU (turn on RTX Video Super Resolution in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.",
  OTL: "OTL",
  "Off the row": "Off the row",
  "Older, simpler renderer. Use it only if the modern one shows a black screen, wrong colors, or won't start on your graphics card.":
    "Older, simpler renderer. Use it only if the modern one shows a black screen, wrong colors, or won't start on your graphics card.",
  "On shows titles in your metadata language (English by default). Off keeps titles in English.":
    "On shows titles in your metadata language (English by default). Off keeps titles in English.",
  "On the pad, hold {button} to stop.": "On the pad, hold {button} to stop.",
  "On the pitch": "On the pitch",
  "One account covers football and hockey. The free plan allows 100 requests a day and Harbor paces itself to stay inside it.":
    "One account covers football and hockey. The free plan allows 100 requests a day and Harbor paces itself to stay inside it.",
  "Only the card gets wider. The text stays the same size, so bigger cards mean bigger artwork and fewer of them on screen.":
    "Only the card gets wider. The text stays the same size, so bigger cards mean bigger artwork and fewer of them on screen.",
  "Open Harbor on desktop to link Discord.": "Open Harbor on desktop to link Discord.",
  "Open anilist.co": "Open anilist.co",
  "Open myanimelist.net": "Open myanimelist.net",
  "Open simkl.com": "Open simkl.com",
  "Open trakt.tv": "Open trakt.tv",
  OpenGL: "OpenGL",
  "Opens Stremio's donation page in your browser.":
    "Opens Stremio's donation page in your browser.",
  "Opens anilist.co in your browser, where you can read what AniList does and make a free account.":
    "Opens anilist.co in your browser, where you can read what AniList does and make a free account.",
  "Opens stremboxd.com, the community bridge that reads Letterboxd on Harbor's behalf.":
    "Opens stremboxd.com, the community bridge that reads Letterboxd on Harbor's behalf.",
  "Opens three editors for CSS, JavaScript, and an HTML overlay. Changes apply as you type.":
    "Opens three editors for CSS, JavaScript, and an HTML overlay. Changes apply as you type.",
  "Opens trakt.tv in your browser, where you can read what Trakt does and make a free account.":
    "Opens trakt.tv in your browser, where you can read what Trakt does and make a free account.",
  "Optional. Point at a png, webp, or svg to show a picture instead of a text badge.":
    "Optional. Point at a png, webp, or svg to show a picture instead of a text badge.",
  P: "P",
  PCT: "PCT",
  PD: "PD",
  PTS: "PTS",
  "Page metadata": "Page metadata",
  "Page source": "Page source",
  Pages: "Pages",
  "Paste a link to a png, webp, or svg. Harbor will use it for this badge everywhere streams show format chips.":
    "Paste a link to a png, webp, or svg. Harbor will use it for this badge everywhere streams show format chips.",
  "Paste a stream": "Paste a stream",
  "Paste from clipboard": "Paste from clipboard",
  "Paste the address of any public Letterboxd list to add it as its own row.":
    "Paste the address of any public Letterboxd list to add it as its own row.",
  "Paste the page address": "Paste the page address",
  "Pattern to match": "Pattern to match",
  "Peek at a title on hover": "Peek at a title on hover",
  "Pick a badges.json that is already saved on this computer.":
    "Pick a badges.json that is already saved on this computer.",
  "Pick as many as you like. With none picked, every genre counts.":
    "Pick as many as you like. With none picked, every genre counts.",
  "Pick the cap your connection can sustain. Streams that need more than this rank lower, so Harbor stops offering you files you cannot actually play.":
    "Pick the cap your connection can sustain. Streams that need more than this rank lower, so Harbor stops offering you files you cannot actually play.",
  "Pick the clubs you follow and their next fixture and last result stay pinned here.":
    "Pick the clubs you follow and their next fixture and last result stay pinned here.",
  "Pick the countries of origin you follow. With none picked, every country counts.":
    "Pick the countries of origin you follow. With none picked, every country counts.",
  "Pick the services you care about. With none picked, every service counts.":
    "Pick the services you care about. With none picked, every service counts.",
  "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.",
  "Pick which corner of the poster the bookmark sits in.":
    "Pick which corner of the poster the bookmark sits in.",
  "Pick which languages Harbor looks for first, and which ones it falls back to.":
    "Pick which languages Harbor looks for first, and which ones it falls back to.",
  "Pick who this rule watches. With nobody picked, everyone you track counts.":
    "Pick who this rule watches. With nobody picked, everyone you track counts.",
  Picked: "Picked",
  "Pin this competition": "Pin this competition",
  "Play opens the stream list so you pick the release yourself.":
    "Play opens the stream list so you pick the release yourself.",
  "Play starts the best-ranked stream straight away.":
    "Play starts the best-ranked stream straight away.",
  "Player config": "Player config",
  "Player screen lock": "Player screen lock",
  "Point Harbor at a hosted pack link, upload your own images, or import a .zip. Harbor stores the link, so the artwork stays with whoever made it.":
    "Point Harbor at a hosted pack link, upload your own images, or import a .zip. Harbor stores the link, so the artwork stays with whoever made it.",
  "Post the alert to the Discord channel set up on the Destinations tab.":
    "Post the alert to the Discord channel set up on the Destinations tab.",
  "Prefer these sources": "Prefer these sources",
  "Preview unavailable": "Preview unavailable",
  "Previous match": "Previous match",
  "Probes the server's settings endpoint from this device and reports what came back.":
    "Probes the server's settings endpoint from this device and reports what came back.",
  "Public mode reads your account with nothing but your username. You get your watchlist, liked films, popular this week and the Top 250, and no password is needed.":
    "Public mode reads your account with nothing but your username. You get your watchlist, liked films, popular this week and the Top 250, and no password is needed.",
  "Pull every title on your Trakt watchlist into Harbor. Anything already saved is left alone.":
    "Pull every title on your Trakt watchlist into Harbor. Anything already saved is left alone.",
  "Pulls what you have part-watched on Simkl into the row, marked with the Simkl logo. Requires a connected Simkl account.":
    "Pulls what you have part-watched on Simkl into the row, marked with the Simkl logo. Requires a connected Simkl account.",
  "Pulls what you have part-watched on Trakt into the row, marked with the Trakt logo. Requires a connected Trakt account.":
    "Pulls what you have part-watched on Trakt into the row, marked with the Trakt logo. Requires a connected Trakt account.",
  "Puts a small bookmark on posters you have already saved.":
    "Puts a small bookmark on posters you have already saved.",
  "Puts the current offset on screen while you nudge subtitle timing with Z or X, so you can see how far you have shifted them.":
    "Puts the current offset on screen while you nudge subtitle timing with Z or X, so you can see how far you have shifted them.",
  "Puts the score you gave a film in the corner of its poster, wherever Letterboxd has one for you.":
    "Puts the score you gave a film in the corner of its poster, wherever Letterboxd has one for you.",
  "Read the source, file an issue, or fork it and send a patch.":
    "Read the source, file an issue, or fork it and send a patch.",
  "Reading your environment details…": "Reading your environment details…",
  "Reading {host}...": "Reading {host}...",
  "Recommended: sign in with Plex": "Recommended: sign in with Plex",
  "Recover via Discord": "Recover via Discord",
  "Recover via a code sent to Discord": "Recover via a code sent to Discord",
  Red: "Red",
  "Red cards": "Red cards",
  "Refresh every": "Refresh every",
  "Refresh this library": "Refresh this library",
  "Relay update available": "Relay update available",
  "Remove comment": "Remove comment",
  "Remove from your teams": "Remove from your teams",
  "Remove this stream": "Remove this stream",
  Renderer: "Renderer",
  "Rendering backend": "Rendering backend",
  "Renders mpv inline so playback lives in Harbor itself. Turn off to open it in a separate window instead.":
    "Renders mpv inline so playback lives in Harbor itself. Turn off to open it in a separate window instead.",
  "Renders subtitles in a heavier weight. Turn off to use your font's normal weight.":
    "Renders subtitles in a heavier weight. Turn off to use your font's normal weight.",
  "Replace selected data?": "Replace selected data?",
  Required: "Required",
  "Reset size": "Reset size",
  "Resolved from {host}": "Resolved from {host}",
  "Rest the cursor on a poster to peek at the rating, story, and quick actions without opening it. Off by default.":
    "Rest the cursor on a poster to peek at the rating, story, and quick actions without opening it. Off by default.",
  "Right in the middle of the picture, hard to miss.":
    "Right in the middle of the picture, hard to miss.",
  Role: "Role",
  "Rule is active": "Rule is active",
  "Rule name": "Rule name",
  "Rulesets bring a full badge set with their own matching. Art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link imports here too.":
    "Rulesets bring a full badge set with their own matching. Art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link imports here too.",
  "Run your own relay": "Run your own relay",
  "Running version {version} of the Watch Together protocol.":
    "Running version {version} of the Watch Together protocol.",
  "Running version {version}. Harbor's public relay updates itself, so there is nothing for you to do.":
    "Running version {version}. Harbor's public relay updates itself, so there is nothing for you to do.",
  "Running version {version}. Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.":
    "Running version {version}. Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.",
  "Runs a short download test against Cloudflare and shows the result here, so you can pick a cap that matches your real line.":
    "Runs a short download test against Cloudflare and shows the result here, so you can pick a cap that matches your real line.",
  "SUBDL API key": "SUBDL API key",
  "SUBDL returns nothing until a key is saved here.":
    "SUBDL returns nothing until a key is saved here.",
  "Same coverage, but still a window, so alt-tab stays instant.":
    "Same coverage, but still a window, so alt-tab stays instant.",
  "Saturation and brightness": "Saturation and brightness",
  "Save as JSON": "Save as JSON",
  "Save as SVG": "Save as SVG",
  "Save the rule": "Save the rule",
  "Saved to Downloads as harbor-mpv-log.txt. Attach it above.":
    "Saved to Downloads as harbor-mpv-log.txt. Attach it above.",
  "Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.":
    "Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.",
  "Saved.": "Saved.",
  "Search channels": "Search channels",
  "Search rules": "Search rules",
  "Search teams": "Search teams",
  "Search your channels": "Search your channels",
  "Searching works without a key. Adding one lets Harbor line subtitles up with the audio on its own.":
    "Searching works without a key. Adding one lets Harbor line subtitles up with the audio on its own.",
  "See which fixes are already in review before you start on one.":
    "See which fixes are already in review before you start on one.",
  "Seek dot": "Seek dot",
  "Send code": "Send code",
  "Send every title in your Harbor watchlist up to Trakt. Safe to run again, Trakt skips anything it already has.":
    "Send every title in your Harbor watchlist up to Trakt. Safe to run again, Trakt skips anything it already has.",
  "Send the alert through the Telegram bot set up on the Destinations tab.":
    "Send the alert through the Telegram bot set up on the Destinations tab.",
  "Sent once to Stremboxd to obtain a sign-in token. Harbor never keeps it.":
    "Sent once to Stremboxd to obtain a sign-in token. Harbor never keeps it.",
  "Set as home team": "Set as home team",
  "Shader files": "Shader files",
  "Shadow strength": "Shadow strength",
  "Shots on target": "Shots on target",
  "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.":
    "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.",
  "Show a row of the anime on your Simkl plan-to-watch list.":
    "Show a row of the anime on your Simkl plan-to-watch list.",
  "Show a row of the anime you are part way through.":
    "Show a row of the anime you are part way through.",
  "Show a row of the movies on your Simkl plan-to-watch list.":
    "Show a row of the movies on your Simkl plan-to-watch list.",
  "Show a row of the shows on your Simkl plan-to-watch list.":
    "Show a row of the shows on your Simkl plan-to-watch list.",
  "Show a row of the shows you are part way through.":
    "Show a row of the shows you are part way through.",
  "Show email address": "Show email address",
  "Show the code editors": "Show the code editors",
  "Shows a lighter fill for how much is buffered or downloaded ahead. It hides itself once a stream is fully cached (green dot).":
    "Shows a lighter fill for how much is buffered or downloaded ahead. It hides itself once a stream is fully cached (green dot).",
  "Shows everything the addon sends in the Stremio picker layout instead of trimming it to a few lines. That matters for AIOStreams and other custom formats. Off gives shorter, tidier rows.":
    "Shows everything the addon sends in the Stremio picker layout instead of trimming it to a few lines. That matters for AIOStreams and other custom formats. Off gives shorter, tidier rows.",
  "Sidebar icons play a short animation when you hover them. Turn this off to keep them as plain static icons.":
    "Sidebar icons play a short animation when you hover them. Turn this off to keep them as plain static icons.",
  "Sign in at anilist.co and authorize Harbor. Your anime lists show up on the Anime page as soon as you are back.":
    "Sign in at anilist.co and authorize Harbor. Your anime lists show up on the Anime page as soon as you are back.",
  "Sign in once with MyAnimeList. Harbor then updates your episode count as you watch, and never lowers a count you already have.":
    "Sign in once with MyAnimeList. Harbor then updates your episode count as you watch, and never lowers a count you already have.",
  "Sign in once with a short device code. Harbor then marks what you finish as watched and keeps your plan-to-watch list in step.":
    "Sign in once with a short device code. Harbor then marks what you finish as watched and keeps your plan-to-watch list in step.",
  "Sign in to sync your library, add-ons and watch history with Stremio.":
    "Sign in to sync your library, add-ons and watch history with Stremio.",
  "Sign in with Discord": "Sign in with Discord",
  "Sign in with Full mode to use this catalog.": "Sign in with Full mode to use this catalog.",
  "Sign out of Stremio": "Sign out of Stremio",
  "Signed in": "Signed in",
  "Signed in as {email}. Your library, add-ons and watch history sync with Stremio.":
    "Signed in as {email}. Your library, add-ons and watch history sync with Stremio.",
  "Signed in. Enter your server address below.": "Signed in. Enter your server address below.",
  "Signs in to Letterboxd and unlocks your diary, friends activity and ratings.":
    "Signs in to Letterboxd and unlocks your diary, friends activity and ratings.",
  "Simkl is a free site for tracking the movies, shows, and anime you watch. Open it to read more or to make an account.":
    "Simkl is a free site for tracking the movies, shows, and anime you watch. Open it to read more or to make an account.",
  "Simkl progress": "Simkl progress",
  "Simkl rails are turned off, so none of the rows below appear on Home yet.":
    "Simkl rails are turned off, so none of the rows below appear on Home yet.",
  "Simple color mode": "Simple color mode",
  "Size of the controller on-screen keyboard.": "Size of the controller on-screen keyboard.",
  "Small outlined pills that slide in under the title.":
    "Small outlined pills that slide in under the title.",
  Software: "Software",
  "Source extension": "Source extension",
  "Space in use": "Space in use",
  Standings: "Standings",
  Starter: "Starter",
  "Starting soon": "Starting soon",
  "Still watching check-in": "Still watching check-in",
  "Stops syncing on this device. Your library stays safe in your Stremio account.":
    "Stops syncing on this device. Your library stays safe in your Stremio account.",
  "Streaming catalogs need a TMDB key": "Streaming catalogs need a TMDB key",
  "Structured data": "Structured data",
  "Subsource API key": "Subsource API key",
  "Subsource returns nothing until a key is saved here.":
    "Subsource returns nothing until a key is saved here.",
  "Swap the handle for a sticker, a cat, anything you like.":
    "Swap the handle for a sticker, a cat, anything you like.",
  "Switch every rule the list currently shows. With a search active this only touches the matches.":
    "Switch every rule the list currently shows. With a search active this only touches the matches.",
  "Switch relay": "Switch relay",
  "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.":
    "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.",
  T: "T",
  "TMDB, Fanart, TVDB, OMDb and RPDB supply posters, artwork and ratings. Adding your own free keys makes artwork load faster and more completely.":
    "TMDB, Fanart, TVDB, OMDb and RPDB supply posters, artwork and ratings. Adding your own free keys makes artwork load faster and more completely.",
  "Takes effect the next time Harbor starts.": "Takes effect the next time Harbor starts.",
  "Test a stream title": "Test a stream title",
  "That pack could not be imported.": "That pack could not be imported.",
  "That page answered {status} and sent nothing back.":
    "That page answered {status} and sent nothing back.",
  "That page answered {status}, so there was nothing to read.":
    "That page answered {status}, so there was nothing to read.",
  "That page sent back no readable content.": "That page sent back no readable content.",
  "The Last Stand has aired its last episode, so it drops off the row and comes back when a new one lands.":
    "The Last Stand has aired its last episode, so it drops off the row and comes back when a new one lands.",
  "The Last Stand stays on the row with an amber countdown to the next episode.":
    "The Last Stand stays on the row with an amber countdown to the next episode.",
  "The Up Next pill appears {lead} before the end. The bar shows the last three minutes.":
    "The Up Next pill appears {lead} before the end. The bar shows the last three minutes.",
  "The account identifier Stremio uses for your library and addon collection.":
    "The account identifier Stremio uses for your library and addon collection.",
  "The address of the streaming server, including its port.":
    "The address of the streaming server, including its port.",
  "The bar runs to {pct} percent. Everything past the mark is boost.":
    "The bar runs to {pct} percent. Everything past the mark is boost.",
  "The chrome abiyyu drew for the player: transport, subtitles, shaders, and the rest.":
    "The chrome abiyyu drew for the player: transport, subtitles, shaders, and the rest.",
  "The color of the panel behind the text.": "The color of the panel behind the text.",
  "The controller button glyphs elsewhere in Harbor are not ours. They come from Kenney's Input Prompts, released into the public domain under CC0.":
    "The controller button glyphs elsewhere in Harbor are not ours. They come from Kenney's Input Prompts, released into the public domain under CC0.",
  "The darkest steps flatten together, which is how an LCD really behaves.":
    "The darkest steps flatten together, which is how an LCD really behaves.",
  "The entries taking the most room right now. Most of them are caches that rebuild themselves, so this list changes as you browse.":
    "The entries taking the most room right now. Most of them are caches that rebuild themselves, so this list changes as you browse.",
  "The fill color of the subtitle letters themselves.":
    "The fill color of the subtitle letters themselves.",
  "The filled part of the timeline. Default follows your Harbor accent.":
    "The filled part of the timeline. Default follows your Harbor accent.",
  "The full text of every licence covering software distributed with Harbor. Select any entry to save a copy.":
    "The full text of every licence covering software distributed with Harbor. Select any entry to save a copy.",
  "The handle in your profile address, letterboxd.com/your-name.":
    "The handle in your profile address, letterboxd.com/your-name.",
  "The most memory the head start is allowed to take while a video plays.":
    "The most memory the head start is allowed to take while a video plays.",
  "The principal open source components Harbor is built from.":
    "The principal open source components Harbor is built from.",
  "The release Harbor watches for. Everything else on this page narrows it down.":
    "The release Harbor watches for. Everything else on this page narrows it down.",
  "The shadow is what keeps the title and buttons readable. Drop it too far and the text starts fighting the artwork.":
    "The shadow is what keeps the title and buttons readable. Drop it too far and the text starts fighting the artwork.",
  "The sidebar set. Click any one to save the SVG.":
    "The sidebar set. Click any one to save the SVG.",
  "The small on-screen readout that appears while you nudge subtitle timing with Z and X during playback. Automatic syncing lives in the Sync tab.":
    "The small on-screen readout that appears while you nudge subtitle timing with Z and X during playback. Automatic syncing lives in the Sync tab.",
  "The stroke or halo drawn behind the letters.": "The stroke or halo drawn behind the letters.",
  "The text Harbor prints on the badge, for example REMUX.":
    "The text Harbor prints on the badge, for example REMUX.",
  "The typeface subtitles are drawn in. Add your own TTF, OTF or WOFF file if none of these suit.":
    "The typeface subtitles are drawn in. Add your own TTF, OTF or WOFF file if none of these suit.",
  "The volume bar stops at 100 percent. No boost is available.":
    "The volume bar stops at 100 percent. No boost is available.",
  "Theme and appearance": "Theme and appearance",
  "Then notify": "Then notify",
  "These are Harbor's own, drawn for Harbor. Take them for a theme, a fork, a mockup, a personal project. Keep the credit on the artists and do not sell the set on its own.":
    "These are Harbor's own, drawn for Harbor. Take them for a theme, a fork, a mockup, a personal project. Keep the credit on the artists and do not sell the set on its own.",
  "These organisations provide their services to Harbor at no cost.":
    "These organisations provide their services to Harbor at no cost.",
  "These rows are switched on but hidden from your home page. Choose Show to bring one back.":
    "These rows are switched on but hidden from your home page. Choose Show to bring one back.",
  "This badge is hidden everywhere streams show format chips.":
    "This badge is hidden everywhere streams show format chips.",
  "This badge uses art you picked instead of Harbor's default.":
    "This badge uses art you picked instead of Harbor's default.",
  "This cannot be undone. You would need to deploy a new relay.":
    "This cannot be undone. You would need to deploy a new relay.",
  "This deletes those entries from your library. Playing them again re-adds them.":
    "This deletes those entries from your library. Playing them again re-adds them.",
  "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.":
    "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.",
  "Tile your own artwork across the timeline instead of a plain fill.":
    "Tile your own artwork across the timeline instead of a plain fill.",
  Timeline: "Timeline",
  "Titles you are part-way through in your local downloads, even offline.":
    "Titles you are part-way through in your local downloads, even offline.",
  "Torrentio 4K": "Torrentio 4K",
  "Trakt progress": "Trakt progress",
  Trigger: "Trigger",
  "Tucked into the upper corner, clear of the subtitles.":
    "Tucked into the upper corner, clear of the subtitles.",
  "Turn on AniList comments first.": "Turn on AniList comments first.",
  "Turn this off and the report ships with no name attached.":
    "Turn this off and the report ships with no name attached.",
  "Turn this off to keep the rule but stop it sending anything for now.":
    "Turn this off to keep the rule but stop it sending anything for now.",
  "Turn this on and Harbor watches just the Live TV channels you starred. Off means every channel in your playlists.":
    "Turn this on and Harbor watches just the Live TV channels you starred. Off means every channel in your playlists.",
  "Turning this on adds your Letterboxd catalogs to the home page and a Letterboxd panel to every film page.":
    "Turning this on adds your Letterboxd catalogs to the home page and a Letterboxd panel to every film page.",
  "Type any release name here to see what Harbor would badge it with.":
    "Type any release name here to see what Harbor would badge it with.",
  "Unavailable while Continue Watching is kept private to each profile, because Simkl progress is shared across every profile on this account.":
    "Unavailable while Continue Watching is kept private to each profile, because Simkl progress is shared across every profile on this account.",
  "Unavailable while Continue Watching is kept private to each profile, because Trakt progress is shared across every profile on this account.":
    "Unavailable while Continue Watching is kept private to each profile, because Trakt progress is shared across every profile on this account.",
  "Unavailable while Continue Watching is kept private to each profile.":
    "Unavailable while Continue Watching is kept private to each profile.",
  Unlink: "Unlink",
  "Unpin this competition": "Unpin this competition",
  "Up to 3840 × 2160 when the source has it. Takes a beat longer to start.":
    "Up to 3840 × 2160 when the source has it. Takes a beat longer to start.",
  "Upload a picture of your own, or pick one from the Harbor catalog.":
    "Upload a picture of your own, or pick one from the Harbor catalog.",
  "Uploads stay on this computer. Keep the file under 250 KB.":
    "Uploads stay on this computer. Keep the file under 250 KB.",
  "Use color to distinguish severity, or keep every advisory monochrome.":
    "Use color to distinguish severity, or keep every advisory monochrome.",
  "Use for this fixture": "Use for this fixture",
  "Used only if we need one more detail to reproduce the bug.":
    "Used only if we need one more detail to reproduce the bug.",
  "User-made packs from the community store, refreshed every week.":
    "User-made packs from the community store, refreshed every week.",
  "Using these": "Using these",
  "Video element": "Video element",
  "Volume {n}": "Volume {n}",
  Vulkan: "Vulkan",
  W: "W",
  "Warming up…": "Warming up…",
  "Watched history": "Watched history",
  "Watchlist ({n})": "Watchlist ({n})",
  "We sent a 6-digit code to your Discord DMs. It expires in 10 minutes.":
    "We sent a 6-digit code to your Discord DMs. It expires in 10 minutes.",
  "We tag this account on the issue so you see the fix land.":
    "We tag this account on the issue so you see the fix land.",
  "We'll show a one-time recovery key and send it to you on Discord. Save it: it's the only way back in if you forget your password.":
    "We'll show a one-time recovery key and send it to you on Discord. Save it: it's the only way back in if you forget your password.",
  "What should the backup include?": "What should the backup include?",
  "What the sidebar icons do when you land on them.":
    "What the sidebar icons do when you land on them.",
  "What this rule is called in your list. Leave it empty and Harbor names it after the trigger.":
    "What this rule is called in your list. Leave it empty and Harbor names it after the trigger.",
  "When a movie or episode starts, briefly show its Common Sense Media parental guide (violence, nudity, profanity, substances) with severity. Fades on its own.":
    "When a movie or episode starts, briefly show its Common Sense Media parental guide (violence, nudity, profanity, substances) with severity. Fades on its own.",
  "Where Play looks first": "Where Play looks first",
  "Where a subtitle line sits across the width of the video.":
    "Where a subtitle line sits across the width of the video.",
  "Where badges come from": "Where badges come from",
  "Where the laurel tab sits relative to the score chips on the poster.":
    "Where the laurel tab sits relative to the score chips on the poster.",
  "Which top corner of the poster the ribbon folds over.":
    "Which top corner of the poster the ribbon folds over.",
  "Who drew all this": "Who drew all this",
  "Writes the last playback session to your Downloads folder so you can attach it above.":
    "Writes the last playback session to your Downloads folder so you can attach it above.",
  "Yellow cards": "Yellow cards",
  "You have no automations yet. Create one and Harbor will message you the moment something matches.":
    "You have no automations yet. Create one and Harbor will message you the moment something matches.",
  "You have not added any favourites yet": "You have not added any favourites yet",
  "Your AniList account": "Your AniList account",
  "Your MyAnimeList account": "Your MyAnimeList account",
  "Your Simkl account": "Your Simkl account",
  "Your Trakt account": "Your Trakt account",
  "Your own Harbor account progress. The primary source for almost everyone.":
    "Your own Harbor account progress. The primary source for almost everyone.",
  "Your pick for this competition": "Your pick for this competition",
  "Your preferences, layout state, and small lookup caches. Clearing caches shrinks this.":
    "Your preferences, layout state, and small lookup caches. Clearing caches shrinks this.",
  "Your teams": "Your teams",
  at: "at",
  "contains login credentials": "contains login credentials",
  icons: "icons",
  "in 4d 6h": "in 4d 6h",
  "in {d}d": "in {d}d",
  "in {d}d {h}h": "in {d}d {h}h",
  "in {h}h": "in {h}h",
  "in {h}h {m}m": "in {h}h {m}m",
  "in {m}m": "in {m}m",
  "in {n}m": "in {n}m",
  "in {n}s": "in {n}s",
  "nowhere yet": "nowhere yet",
  username: "username",
  vs: "vs",
  "{count} installed. Their results are merged in with everything else.":
    "{count} installed. Their results are merged in with everything else.",
  "{ms} ms": "{ms} ms",
  "{m} of {n} on": "{m} of {n} on",
  "{n} badges use art you picked instead of Harbor's default.":
    "{n} badges use art you picked instead of Harbor's default.",
  "{n} badges, by {name}": "{n} badges, by {name}",
  "{n} films.": "{n} films.",
  "{n} followed": "{n} followed",
  "{n} found": "{n} found",
  "{n} images in that pack could not be loaded.": "{n} images in that pack could not be loaded.",
  "{n} of {total} chosen": "{n} of {total} chosen",
  "{n} px/s": "{n} px/s",
  "{n} seconds": "{n} seconds",
  "{n}x card width": "{n}x card width",
  "{trigger}. Sends to {channels}.": "{trigger}. Sends to {channels}.",
};

export default uiFallback;
