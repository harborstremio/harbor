package android.content.pm

import android.content.Intent

open class PackageManager {

    /** Null is the answer a host with no installed packages must give, and it is also the safe one:
     * the one extension that asks builds a restart task from the result and then calls
     * Runtime.exit, which would take the whole host process down with it. */
    open fun getLaunchIntentForPackage(packageName: String): Intent? = null
}
