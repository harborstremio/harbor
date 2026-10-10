package android.content

import android.content.pm.PackageManager
import android.content.res.Resources
import harbor.compat.host.PlatformHost

open class ContextWrapper @JvmOverloads constructor(private var base: Context? = null) : Context() {

    open fun getBaseContext(): Context = base ?: PlatformHost.applicationContext

    open fun attachBaseContext(context: Context?) {
        base = if (context === this) null else context
    }

    override fun getApplicationContext(): Context = getBaseContext().getApplicationContext()

    override fun getPackageManager(): PackageManager = getBaseContext().getPackageManager()

    override fun getPackageName(): String = getBaseContext().getPackageName()

    override fun getResources(): Resources = getBaseContext().getResources()

    override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
        getBaseContext().getSharedPreferences(name, mode)

    override fun startActivity(intent: Intent) {
        getBaseContext().startActivity(intent)
    }

    override fun getSystemService(name: String): Any? = getBaseContext().getSystemService(name)
}
