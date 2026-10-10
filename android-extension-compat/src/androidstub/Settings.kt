package android.provider

import android.content.ContentResolver
import harbor.compat.host.PlatformHost
import java.io.File
import java.security.SecureRandom

class Settings {

    object Secure {

        const val ANDROID_ID: String = "android_id"

        @JvmStatic
        fun getString(resolver: ContentResolver?, name: String?): String? =
            if (name == ANDROID_ID) installationId() else null
    }
}

private val INSTALLATION_ID: String by lazy {
    val file = File(PlatformHost.dataDir, "installation-id")
    val kept = try {
        file.readText().trim()
    } catch (t: Throwable) {
        ""
    }
    if (kept.length == 16) return@lazy kept
    val fresh = java.lang.Long.toHexString(SecureRandom().nextLong()).padStart(16, '0')
    try {
        file.parentFile?.mkdirs()
        file.writeText(fresh)
    } catch (t: Throwable) {
    }
    fresh
}

private fun installationId(): String = INSTALLATION_ID
