# JL Media Vision for Android TV

A WebView shell around the JL Media Vision web app (`BuildConfig.APP_URL`) for Android TV and the
NVIDIA Shield. Streams play in a native ExoPlayer (Media3) drawn over the WebView, which the page
drives through `window.JLNativePlayer`.

Build: `gradle -p android-tv assembleRelease` (JDK 17, Android SDK platform 35). CI builds it in
`.github/workflows/jl-release.yml`.

## Native player bridge

`window.JLNativePlayer` exists in the main WebView only (not in the in-app browser). Calls do
nothing unless the WebView is on an `APP_HOSTS` page (or the `APP_URL` host). Every call is
handed to the main thread, so it returns before the player has acted on it; follow the
`jl-native-player` events for the actual state.

```js
const player = window.JLNativePlayer;
if (player?.isAvailable()) {
  player.setMode("full");
  player.play(url, JSON.stringify({ Referer: "https://example.com/" }), "Channel 4", 0);
}
```

| Method | Description |
| --- | --- |
| `isAvailable(): boolean` | `true` when the bridge will accept calls on this page. |
| `play(url, headersJson, title, startMs): boolean` | Plays an `http`/`https` URL, replacing what was playing. `headersJson` is a JSON object of request headers (`""` or `"{}"` for none); a `User-Agent` entry replaces the default `JLMediaVisionTV/<version> … AndroidXMedia3/<version>`. `startMs > 0` starts there (ignored by live streams). Returns `false` when the URL or page is rejected. The current mode is kept. |
| `setMode(mode)` | `"full"`, `"hero"` or `"hidden"`. Unknown values are ignored. The mode can be set before `play`. |
| `setRect(x, y, w, h)` | The hero area in CSS pixels relative to the WebView viewport (`element.getBoundingClientRect()`). Call it again whenever the area moves or resizes. `w` or `h` `<= 0` clears it. |
| `pause()` / `resume()` | Pauses or resumes. `resume()` restarts an ended or failed stream. |
| `seek(ms)` | Seeks to `ms`, clamped to the stream's duration when known. |
| `stop()` | Stops, releases the player and returns to `hidden`. |

### Modes

- `full`: fills the screen. The remote controls the player: Center/Enter and Play/Pause toggle
  pause, Left/Right (and Rewind/Fast-forward) seek 10 seconds, Up/Down show the progress bar.
  Back sends `exit-full`, then returns to `hero` when the page has set a hero rect, otherwise
  stops (`stopped` follows).
- `hero`: the video sits in the hero rect while the page keeps the remote and scrolls beneath it.
  Nothing is drawn until a rect has been set. The video covers anything the page draws in that
  area, so switch to `hidden` while a menu or dialog overlaps it.
- `hidden`: the video is not drawn. Playback continues; call `pause()` or `stop()` as needed.

In `hero` and `hidden`, keys go to the page and Back walks the page's history as before.

### Events

The player reports through a window event:

```js
window.addEventListener("jl-native-player", (event) => {
  const { type, mode, positionMs, durationMs, message } = event.detail;
});
```

| `type` | When |
| --- | --- |
| `ready` | The stream is ready to play (once per `play`). |
| `playing` | Playback started or resumed. |
| `paused` | Paused (by the page, the remote, or the app leaving the screen). |
| `buffering` | Waiting for data. |
| `ended` | The stream finished. |
| `error` | Playback failed; `message` holds the Media3 error code name and text. A live stream that falls behind its window rejoins the live edge without an error. |
| `stopped` | The player was released. `message` is `"navigation"` when the WebView loaded a new document, `"background"` when the app left the screen, and absent for `stop()` or Back. |
| `position` | About once a second while playing. |
| `exit-full` | Back left full screen. |

`mode` is `"full"`, `"hero"` or `"hidden"` at the time of the event. `positionMs` and
`durationMs` are milliseconds; `durationMs` is `0` when unknown, and for a live stream it is the
length of the live window.

### Lifecycle

The player pauses when the activity pauses and is released (`stopped`, message `"background"`)
when it stops, which also frees the provider connection. The page calls `play` again to resume.

### Streams

HTTP requests allow redirects between `http` and `https`. URLs whose path ends in `.m3u8`, or
with `output=hls` or `output=m3u8` in the query, play as HLS; anything else is detected from the
content (MPEG-TS, MP4, MKV and other progressive formats).
