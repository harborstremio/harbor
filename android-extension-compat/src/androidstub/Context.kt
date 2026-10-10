package android.content

import android.app.ActivityManager
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.Resources
import android.net.ConnectivityManager
import harbor.compat.host.PlatformHost
import java.io.File

open class Context {

    open fun getApplicationContext(): Context = PlatformHost.applicationContext

    open fun getPackageManager(): PackageManager = PlatformHost.packageManager

    open fun getPackageName(): String = PlatformHost.packageName

    open fun getResources(): Resources = PlatformHost.resources

    open fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
        PlatformHost.preferences(name)

    open fun startActivity(intent: Intent) {
        PlatformHost.launch(intent)
    }

    open fun getFilesDir(): File = ensure(File(PlatformHost.dataDir, "files"))

    open fun getCacheDir(): File = ensure(File(PlatformHost.dataDir, "cache"))

    open fun getContentResolver(): ContentResolver = resolver

    open fun getApplicationInfo(): ApplicationInfo = ApplicationInfo()

    open fun getSystemService(name: String): Any? = when (name) {
        CONNECTIVITY_SERVICE -> PlatformHost.connectivityManager
        CLIPBOARD_SERVICE -> PlatformHost.clipboardManager
        ACTIVITY_SERVICE -> activityManager
        else -> null
    }

    private val activityManager: ActivityManager by lazy { ActivityManager() }

    private val resolver: ContentResolver by lazy { ContentResolver() }

    private fun ensure(dir: File): File {
        if (!dir.isDirectory) dir.mkdirs()
        return dir
    }

    companion object {
        const val CONNECTIVITY_SERVICE: String = "connectivity"
        const val CLIPBOARD_SERVICE: String = "clipboard"
        const val ACTIVITY_SERVICE: String = "activity"
    }
}
