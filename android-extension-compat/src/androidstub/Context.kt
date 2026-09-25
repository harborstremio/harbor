package android.content

import android.content.pm.PackageManager
import android.content.res.Resources
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
}
