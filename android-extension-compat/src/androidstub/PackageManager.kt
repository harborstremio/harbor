package android.content.pm

import android.content.Intent

open class PackageManager {

    open fun getLaunchIntentForPackage(packageName: String): Intent? = null
}
