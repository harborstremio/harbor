package com.exrelay.harbor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Drives the Android OS media session — lock-screen / notification transport and
 * hardware media keys (TV remote, Bluetooth, headset) — from the player, and
 * relays transport commands back to Dart over the shared `harbor/now_playing`
 * channel. The Android counterpart of the iOS NowPlayingBridge; the same Dart
 * [NowPlayingService] speaks to both.
 */
class NowPlayingBridge(
    private val context: Context,
    private val channel: MethodChannel,
) : MethodChannel.MethodCallHandler {

    private companion object {
        const val CHANNEL_ID = "harbor_media"
        const val NOTIFICATION_ID = 0x48
    }

    private var session: MediaSessionCompat? = null

    init {
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "update" -> {
                update(call)
                result.success(null)
            }
            "clear" -> {
                clear()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun ensureSession(): MediaSessionCompat {
        session?.let { return it }
        val created = MediaSessionCompat(context, "Harbor")
        created.setCallback(
            object : MediaSessionCompat.Callback() {
                override fun onPlay() = send("play")
                override fun onPause() = send("pause")
                override fun onSkipToNext() = send("next")
                override fun onSkipToPrevious() = send("previous")
                override fun onFastForward() = send("seekForward")
                override fun onRewind() = send("seekBackward")
                override fun onSeekTo(pos: Long) = send("seekTo", pos / 1000.0)
            }
        )
        created.isActive = true
        session = created
        return created
    }

    private fun update(call: MethodCall) {
        val media = ensureSession()
        val title = call.argument<String>("title") ?: ""
        val subtitle = call.argument<String>("subtitle")
        val durationSec = call.argument<Double>("durationSec") ?: 0.0
        val positionSec = call.argument<Double>("positionSec") ?: 0.0
        val playing = call.argument<Boolean>("playing") ?: true

        val metadata =
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .apply {
                    if (subtitle != null) {
                        putString(MediaMetadataCompat.METADATA_KEY_ARTIST, subtitle)
                    }
                }
                .putLong(
                    MediaMetadataCompat.METADATA_KEY_DURATION,
                    (durationSec * 1000).toLong(),
                )
                .build()
        media.setMetadata(metadata)

        val actions =
            PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_FAST_FORWARD or
                PlaybackStateCompat.ACTION_REWIND
        val state =
            PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(
                    if (playing) {
                        PlaybackStateCompat.STATE_PLAYING
                    } else {
                        PlaybackStateCompat.STATE_PAUSED
                    },
                    (positionSec * 1000).toLong(),
                    if (playing) 1f else 0f,
                )
                .build()
        media.setPlaybackState(state)

        postNotification(media, title, subtitle, playing)
    }

    private fun postNotification(
        media: MediaSessionCompat,
        title: String,
        subtitle: String?,
        playing: Boolean,
    ) {
        createChannel()
        val notification =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(subtitle ?: "")
                .setOnlyAlertOnce(true)
                .setOngoing(playing)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(
                    androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(media.sessionToken)
                )
                .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager =
                context.getSystemService(Context.NOTIFICATION_SERVICE)
                    as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                            CHANNEL_ID,
                            "Playback",
                            NotificationManager.IMPORTANCE_LOW,
                        )
                        .apply { setShowBadge(false) }
                )
            }
        }
    }

    private fun clear() {
        session?.let {
            it.isActive = false
            it.release()
        }
        session = null
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    private fun send(type: String, position: Double? = null) {
        val payload = HashMap<String, Any>()
        payload["type"] = type
        if (position != null) payload["position"] = position
        Handler(Looper.getMainLooper()).post {
            channel.invokeMethod("command", payload)
        }
    }
}
