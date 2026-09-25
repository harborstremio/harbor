package harbor.compat.host

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.res.Resources
import java.io.File
import java.util.concurrent.ConcurrentHashMap

fun interface LogSink {
    fun write(priority: Int, tag: String, message: String, error: Throwable?)
}

fun interface ActivityLauncher {
    fun launch(intent: Intent)
}

/** The single seam between the platform classes the extensions link against and the running host.
 *
 * Everything an extension can observe about "the device" is read from here, so the host can point
 * preferences at a real directory, route logging into its own log, and decide what an outbound
 * intent means, without any extension knowing the difference. */
object PlatformHost {

    @Volatile
    var dataDir: File = defaultDataDir()

    @Volatile
    var packageName: String = "com.harbor.extensions"

    @Volatile
    var density: Float = 2f

    @Volatile
    var widthPixels: Int = 1920

    @Volatile
    var heightPixels: Int = 1080

    @Volatile
    var logSink: LogSink? = null

    @Volatile
    var activityLauncher: ActivityLauncher? = null

    val applicationContext: Context by lazy { Context() }

    val packageManager: PackageManager by lazy { PackageManager() }

    val resources: Resources by lazy { Resources() }

    private val preferenceFiles = ConcurrentHashMap<String, SharedPreferences>()

    private val resourceIds = ConcurrentHashMap<String, Int>()

    fun preferences(name: String): SharedPreferences =
        preferenceFiles.getOrPut(name) { JsonPreferences(File(preferenceDir(), "$name.json")) }

    fun preferenceDir(): File = File(dataDir, "preferences")

    /** Gives a name the id an extension will later look up with getIdentifier. */
    fun registerResource(type: String, name: String, id: Int) {
        resourceIds["$type/$name"] = id
    }

    fun resourceId(name: String?, defType: String?, defPackage: String?): Int {
        if (name.isNullOrEmpty()) return 0
        val qualified = name.substringAfter(':')
        val key = if (qualified.contains('/')) qualified else "${defType.orEmpty()}/$qualified"
        return resourceIds[key] ?: 0
    }

    fun log(priority: Int, tag: String, message: String, error: Throwable? = null) {
        val sink = logSink
        if (sink != null) {
            sink.write(priority, tag, message, error)
            return
        }
        val line = "${levelLabel(priority)}/$tag: $message"
        if (priority >= 5) System.err.println(line) else System.out.println(line)
        error?.printStackTrace(if (priority >= 5) System.err else System.out)
    }

    fun launch(intent: Intent) {
        val launcher = activityLauncher
        if (launcher != null) {
            launcher.launch(intent)
            return
        }
        log(4, "Intent", "no launcher wired, dropping $intent")
    }

    private fun levelLabel(priority: Int): String = when (priority) {
        2 -> "V"
        3 -> "D"
        4 -> "I"
        5 -> "W"
        6 -> "E"
        7 -> "A"
        else -> "?"
    }

    private fun defaultDataDir(): File {
        val configured = System.getProperty("harbor.compat.dataDir")
        if (!configured.isNullOrBlank()) return File(configured)
        val home = System.getProperty("user.home") ?: System.getProperty("java.io.tmpdir") ?: "."
        return File(File(home, ".harbor"), "extension-data")
    }
}
