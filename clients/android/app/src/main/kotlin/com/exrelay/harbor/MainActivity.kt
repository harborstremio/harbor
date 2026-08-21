package com.exrelay.harbor

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var nowPlaying: NowPlayingBridge? = null

    // Whether the player is actively playing — set from Dart. When true, leaving
    // the app (Home / recents) auto-enters PiP so playback keeps going.
    private var playerActive = false

    private fun pipSupported(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (playerActive && pipSupported()) {
            try {
                enterPictureInPictureMode(PictureInPictureParams.Builder().build())
            } catch (e: Exception) {
                // Some OEMs restrict PiP; ignore and stay full-screen.
            }
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // Reports whether this is an Android TV (leanback) device, so the app can
        // resolve the ten-foot idiom and gate sender-only features (Chromecast,
        // Picture-in-Picture) off — a TV is a cast/AirPlay receiver, not a sender.
        MethodChannel(messenger, "harbor/platform").setMethodCallHandler { call, result ->
            when (call.method) {
                "isTv" ->
                    result.success(
                        packageManager.hasSystemFeature(
                            PackageManager.FEATURE_LEANBACK
                        ) ||
                            packageManager.hasSystemFeature(
                                "android.hardware.type.television"
                            )
                    )
                else -> result.notImplemented()
            }
        }

        // Picture-in-Picture: the player asks the Activity to shrink into a PiP
        // window so playback continues while the viewer uses other apps. Only on
        // devices that support it (Android 8+ with the PiP system feature); a TV
        // is excluded on the Dart side (it is a receiver, not a PiP host).
        MethodChannel(messenger, "harbor/pip").setMethodCallHandler { call, result ->
            when (call.method) {
                "isSupported" -> result.success(pipSupported())
                "setPlaying" -> {
                    playerActive = (call.arguments as? Boolean) == true
                    result.success(null)
                }
                "enterPip" -> {
                    if (!pipSupported()) {
                        result.success(false)
                    } else {
                        try {
                            val ok =
                                enterPictureInPictureMode(
                                    PictureInPictureParams.Builder().build()
                                )
                            result.success(ok)
                        } catch (e: Exception) {
                            result.success(false)
                        }
                    }
                }
                else -> result.notImplemented()
            }
        }

        // The OS media session (lock screen / notification transport + hardware
        // media keys), driven from the player over the shared now-playing channel.
        nowPlaying =
            NowPlayingBridge(
                applicationContext,
                MethodChannel(messenger, "harbor/now_playing"),
            )
    }
}
