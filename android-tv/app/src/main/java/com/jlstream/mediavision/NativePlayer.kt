package com.jlstream.mediavision

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import org.json.JSONObject

/**
 * ExoPlayer drawn over the WebView, driven by the web app through [MainActivity]'s
 * `window.JLNativePlayer` bridge. Every method runs on the main thread.
 *  - FULL: fills the screen; the remote controls playback.
 *  - HERO: placed in the page's sticky hero area (a rect the page sends); the WebView keeps the remote.
 *  - HIDDEN: not drawn; playback carries on until the page pauses or stops it.
 */
@OptIn(UnstableApi::class)
class NativePlayer(
    private val activity: Activity,
    private val root: FrameLayout,
    /** The WebView: hero rects are relative to it, and it takes the remote outside full screen. */
    private val web: View,
    /** Sends an event's detail to the page. */
    private val emit: (JSONObject) -> Unit,
) {
    enum class Mode { FULL, HERO, HIDDEN }

    var mode = Mode.HIDDEN
        private set

    /** Device pixels per CSS pixel; MainActivity keeps it in step with the WebView's zoom. */
    var cssScale = activity.resources.displayMetrics.density

    private val view = PlayerView(activity).apply {
        visibility = View.GONE
        setBackgroundColor(Color.BLACK)
        keepScreenOn = true
        useController = false
        isFocusable = false
        controllerShowTimeoutMs = 3000
        controllerAutoShow = false
        setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
    }

    private var player: ExoPlayer? = null
    /** The hero rect in CSS pixels (x, y, w, h), or null when the page hasn't sent one. */
    private var heroRect: DoubleArray? = null
    private var readySent = false

    private val handler = Handler(Looper.getMainLooper())
    private val positionTick = object : Runnable {
        override fun run() {
            if (player?.isPlaying == true) send("position")
            handler.postDelayed(this, 1000)
        }
    }

    val isActive get() = player != null

    init {
        root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    fun play(url: String, headers: Map<String, String>, title: String, startMs: Long) {
        release()
        readySent = false
        var userAgent = Util.getUserAgent(activity, "JLMediaVisionTV")
        val requestHeaders = HashMap<String, String>()
        for ((name, value) in headers) {
            // DefaultHttpDataSource writes its own User-Agent after the request headers, so a page
            // supplied one has to go through setUserAgent to take effect.
            if (name.equals("User-Agent", ignoreCase = true)) userAgent = value else requestHeaders[name] = value
        }
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setDefaultRequestProperties(requestHeaders)
            // IPTV panels often redirect between http and https.
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(30_000)
        // More buffer than the default: IPTV servers stall, and a longer lead rides most stalls out.
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(20_000, 50_000, 2_500, 5_000)
            .build()
        val p = ExoPlayer.Builder(activity)
            .setMediaSourceFactory(DefaultMediaSourceFactory(http))
            .setLoadControl(load)
            .setHandleAudioBecomingNoisy(true)
            .build()
        p.addListener(listener)
        val item = MediaItem.Builder()
            .setUri(url)
            .setMediaMetadata(MediaMetadata.Builder().setTitle(title).build())
            .apply { if (looksLikeHls(Uri.parse(url))) setMimeType(MimeTypes.APPLICATION_M3U8) }
            .build()
        if (startMs > 0) p.setMediaItem(item, startMs) else p.setMediaItem(item)
        p.prepare()
        p.playWhenReady = true
        view.player = p
        player = p
        handler.removeCallbacks(positionTick)
        handler.postDelayed(positionTick, 1000)
        applyMode()
    }

    /** The hero area in CSS pixels, relative to the WebView's viewport; w or h <= 0 clears it. */
    fun setRect(x: Double, y: Double, w: Double, h: Double) {
        heroRect = if (w > 0 && h > 0) doubleArrayOf(x, y, w, h) else null
        if (mode == Mode.HERO) applyMode()
    }

    fun setMode(next: Mode) {
        mode = next
        applyMode()
    }

    fun pause() { player?.playWhenReady = false }

    fun resume() {
        val p = player ?: return
        if (p.playbackState == Player.STATE_ENDED) p.seekToDefaultPosition()
        if (p.playbackState == Player.STATE_IDLE) p.prepare()
        p.playWhenReady = true
    }

    fun togglePause() {
        val p = player ?: return
        if (p.playWhenReady) pause() else resume()
    }

    fun seek(ms: Long) {
        val p = player ?: return
        val duration = p.duration
        p.seekTo(if (duration != C.TIME_UNSET && duration > 0) ms.coerceIn(0, duration) else ms.coerceAtLeast(0))
    }

    fun seekBy(deltaMs: Long) {
        val p = player ?: return
        seek(p.currentPosition + deltaMs)
        view.showController()
    }

    /** Stops playback and tells the page; [message] says why when it wasn't the page's own call. */
    fun stop(message: String? = null) {
        if (player != null) send("stopped", message)
        release()
        mode = Mode.HIDDEN
        applyMode()
    }

    /** Releases the decoder without telling the page (the activity is going away). */
    fun release() {
        handler.removeCallbacks(positionTick)
        view.player = null
        player?.removeListener(listener)
        player?.release()
        player = null
    }

    /** Back in full screen: return to the hero area when the page has one, otherwise stop. */
    fun exitFull() {
        send("exit-full")
        if (heroRect != null) setMode(Mode.HERO) else stop()
    }

    /** Remote keys while full screen. Returns true when the key was used here. */
    fun handleFullKey(event: KeyEvent): Boolean {
        if (mode != Mode.FULL || player == null) return false
        val down = event.action == KeyEvent.ACTION_DOWN
        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER,
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> if (down && event.repeatCount == 0) { togglePause(); view.showController() }
            KeyEvent.KEYCODE_MEDIA_PLAY -> if (down) resume()
            KeyEvent.KEYCODE_MEDIA_PAUSE -> if (down) pause()
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> if (down) seekBy(-SEEK_STEP_MS)
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> if (down) seekBy(SEEK_STEP_MS)
            // Up/Down only bring up the progress bar; focus never moves into the controller, so
            // Center/Left/Right always mean play/pause and seek.
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> if (down) view.showController()
            else -> return false
        }
        return true
    }

    private fun applyMode() {
        val rect = heroRect
        val visible = player != null && when (mode) {
            Mode.FULL -> true
            Mode.HERO -> rect != null
            Mode.HIDDEN -> false
        }
        if (!visible) {
            view.hideController()
            view.useController = false
            view.isFocusable = false
            view.visibility = View.GONE
            if (view.hasFocus()) web.requestFocus()
            return
        }
        if (mode == Mode.FULL) {
            view.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            view.useController = true
            view.isFocusable = true
            view.visibility = View.VISIBLE
            view.requestFocus()
            view.showController()
        } else if (rect != null) {
            view.hideController()
            view.useController = false
            view.isFocusable = false
            view.layoutParams = FrameLayout.LayoutParams(px(rect[2]), px(rect[3]), Gravity.TOP or Gravity.START).apply {
                leftMargin = web.left + px(rect[0])
                topMargin = web.top + px(rect[1])
            }
            view.visibility = View.VISIBLE
            if (!web.hasFocus()) web.requestFocus()
        }
    }

    private fun px(css: Double) = Math.round(css * cssScale).toInt()

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_BUFFERING -> send("buffering")
                Player.STATE_READY -> if (!readySent) { readySent = true; send("ready") }
                Player.STATE_ENDED -> send("ended")
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            val p = player ?: return
            if (isPlaying) send("playing")
            else if (!p.playWhenReady && p.playbackState != Player.STATE_ENDED) send("paused")
        }

        override fun onPlayerError(error: PlaybackException) {
            val p = player ?: return
            // A live stream that fell out of the playlist window: rejoin at the live edge.
            if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                p.seekToDefaultPosition()
                p.prepare()
                return
            }
            send("error", listOfNotNull(error.errorCodeName, error.message).joinToString(": "))
        }
    }

    private fun send(type: String, message: String? = null) {
        val p = player
        val duration = p?.duration?.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L
        val detail = JSONObject()
            .put("type", type)
            .put("mode", mode.name.lowercase())
            .put("positionMs", p?.currentPosition ?: 0L)
            .put("durationMs", duration)
        if (message != null) detail.put("message", message)
        emit(detail)
    }

    companion object {
        private const val SEEK_STEP_MS = 10_000L

        fun looksLikeHls(uri: Uri): Boolean {
            if (uri.path.orEmpty().lowercase().endsWith(".m3u8")) return true
            val output = if (uri.isHierarchical) uri.getQueryParameter("output")?.lowercase() else null
            return output == "hls" || output == "m3u8"
        }
    }
}
