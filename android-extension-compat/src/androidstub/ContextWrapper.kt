package android.content

import android.content.pm.PackageManager
import android.content.res.Resources
import harbor.compat.host.PlatformHost

/** Extensions walk up a context chain with instanceof plus getBaseContext looking for an activity,
 * so the base must always be something that is not itself a wrapper or that walk never ends. */
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
}
