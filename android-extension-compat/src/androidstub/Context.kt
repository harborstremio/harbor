package android.content

import android.content.pm.PackageManager
import android.content.res.Resources
import android.net.ConnectivityManager
import harbor.compat.host.PlatformHost

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

    /** Extensions ask for a service by name. Only the services the host actually has are answered;
     * null for the rest, which is what Android returns for a service that is not present. */
    open fun getSystemService(name: String): Any? = when (name) {
        CONNECTIVITY_SERVICE -> PlatformHost.connectivityManager
        else -> null
    }

    companion object {
        const val CONNECTIVITY_SERVICE: String = "connectivity"
    }
}
