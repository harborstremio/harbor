// Newly introduced UI copy remains usable until each locale provides an override.
const uiFallback: Record<string, string> = {
  "Dropped frames": "Dropped frames",
  "A/V sync": "A/V sync",
  "Current A/V bitrate": "Current A/V bitrate",
  "Average A/V bitrate": "Average A/V bitrate",
  "Source colour": "Source colour",
  "HDR metadata": "HDR metadata",
  "Display target": "Display target",
  "Audio channels": "Audio channels",
  "Cache ahead": "Cache ahead",
  "Download speed": "Download speed",
  "Cached data": "Cached data",
  Renderer: "Renderer",
  "Video output": "Video output",
  Viewport: "Viewport",
  Video: "Video",
  "Audio & subtitles": "Audio & subtitles",
  "Streaming & renderer": "Streaming & renderer",
  Claim: "Claim",
  "Show {n} more": "Show {n} more",
  "Performance & resource use": "Performance & resource use",
  "Choose whether Harbor favours the lightest idle footprint or warms up common pages and keeps optional automation active while hidden.":
    "Choose whether Harbor favours the lightest idle footprint or warms up common pages and keeps optional automation active while hidden.",
  "Warm up common pages after launch": "Warm up common pages after launch",
  "Preloads the player, source picker, details, and Settings when the app is idle. Leave this off for lower startup memory and battery use.":
    "Preloads the player, source picker, details, and Settings when the app is idle. Leave this off for lower startup memory and battery use.",
  "Allow optional background checks": "Allow optional background checks",
  "Lets scheduled downloads and release webhooks check for updates while Harbor is hidden. Turn it off to keep background network activity to a minimum.":
    "Lets scheduled downloads and release webhooks check for updates while Harbor is hidden. Turn it off to keep background network activity to a minimum.",
  "Click a swatch or drag": "Click a swatch or drag",
  Tight: "Tight",
  Mid: "Mid",
  Wide: "Wide",
  "Enter fullscreen": "Enter fullscreen",
  "Close editor": "Close editor",
  "Show {control}": "Show {control}",
  Together: "Together",
  "Couldn't read that image. Try a different file.":
    "Couldn't read that image. Try a different file.",
  "Custom image loaded": "Custom image loaded",
  Processing: "Processing",
  "Remove image": "Remove image",
  "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and filmography. Optional on-device face matching can identify who is on screen. Off by default.":
    "Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and filmography. Optional on-device face matching can identify who is on screen. Off by default.",
  "Periodically match faces in the current frame against the cast. Nothing leaves your machine, but this can make playback stutter on lower-power laptops. Leave it off unless you need live matches.":
    "Periodically match faces in the current frame against the cast. Nothing leaves your machine, but this can make playback stutter on lower-power laptops. Leave it off unless you need live matches.",
  "14s": "14s",
  "20s": "20s",
  "6-digit code": "6-digit code",
  "Addons ({n})": "Addons ({n})",
  "All selected": "All selected",
  "Also joins Harbor's Discord server.": "Also joins Harbor's Discord server.",
  "Apply and reload": "Apply and reload",
  "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.":
    "Changing the metadata language reloads Harbor so the new language takes effect. Apply when you're done with the options above.",
  "Choose source": "Choose source",
  "Choose your username": "Choose your username",
  Colored: "Colored",
  "Content Advisory": "Content Advisory",
  "Content advisory style": "Content advisory style",
  "Continue with Discord": "Continue with Discord",
  "Could not reach the extension list. Check your server connection and try again.":
    "Could not reach the extension list. Check your server connection and try again.",
  "Couldn't save the playlist. Free up storage space in Settings and try again.":
    "Couldn't save the playlist. Free up storage space in Settings and try again.",
  "Cursor speed": "Cursor speed",
  "Data copied from {name}": "Data copied from {name}",
  "Didn't get it? Send another code": "Didn't get it? Send another code",
  "Discord confirmed. Pick a username and password to finish.":
    "Discord confirmed. Pick a username and password to finish.",
  "Discord linked": "Discord linked",
  "Enter your code": "Enter your code",
  "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.":
    "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.",
  "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.":
    "Export your Harbor setup to a single file — pick exactly what goes in. Restore brings back only what the file contains. Your Stremio sign-in is always left out.",
  "Export your setup": "Export your setup",
  "Export {n} sections": "Export {n} sections",
  "Favorites ({n})": "Favorites ({n})",
  "Finish creating my account": "Finish creating my account",
  "How quickly the Harbor cursor moves with the right stick.":
    "How quickly the Harbor cursor moves with the right stick.",
  "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.":
    "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.",
  "Import data from {name}": "Import data from {name}",
  "Instant playback preparation": "Instant playback preparation",
  "Keyboard size": "Keyboard size",
  "Latest chapters": "Latest chapters",
  "Link Discord": "Link Discord",
  "Linked as {username}": "Linked as {username}",
  "Linked to your Harbor account.": "Linked to your Harbor account.",
  "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.":
    "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.",
  "Monochrome (White)": "Monochrome (White)",
  "New releases": "New releases",
  "On shows titles in your metadata language (English by default). Off keeps titles in English.":
    "On shows titles in your metadata language (English by default). Off keeps titles in English.",
  "Open Harbor on desktop to link Discord.": "Open Harbor on desktop to link Discord.",
  "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.":
    "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.",
  "Player screen lock": "Player screen lock",
  "Recover via Discord": "Recover via Discord",
  "Recover via a code sent to Discord": "Recover via a code sent to Discord",
  "Replace selected data?": "Replace selected data?",
  "Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.":
    "Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.",
  "Send code": "Send code",
  "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.":
    "Show a lock control in the player that blocks mouse, keyboard, remote, and media-key input until you unlock it.",
  "Sign in with Discord": "Sign in with Discord",
  "Size of the controller on-screen keyboard.": "Size of the controller on-screen keyboard.",
  "Source extension": "Source extension",
  "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.":
    "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.",
  "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.":
    "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.",
  Unlink: "Unlink",
  "Use color to distinguish severity, or keep every advisory monochrome.":
    "Use color to distinguish severity, or keep every advisory monochrome.",
  "Watched history": "Watched history",
  "Watchlist ({n})": "Watchlist ({n})",
  "We sent a 6-digit code to your Discord DMs. It expires in 10 minutes.":
    "We sent a 6-digit code to your Discord DMs. It expires in 10 minutes.",
  "We'll show a one-time recovery key and send it to you on Discord. Save it: it's the only way back in if you forget your password.":
    "We'll show a one-time recovery key and send it to you on Discord. Save it: it's the only way back in if you forget your password.",
  "What should the backup include?": "What should the backup include?",
  "When a movie or episode starts, briefly show its Common Sense Media parental guide (violence, nudity, profanity, substances) with severity. Fades on its own.":
    "When a movie or episode starts, briefly show its Common Sense Media parental guide (violence, nudity, profanity, substances) with severity. Fades on its own.",
  "contains login credentials": "contains login credentials",
  "{n} of {total} chosen": "{n} of {total} chosen",
  "{n} px/s": "{n} px/s",
};

export default uiFallback;
