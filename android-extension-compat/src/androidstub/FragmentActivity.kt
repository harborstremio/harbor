package androidx.fragment.app

import android.app.Activity
import android.content.Context
import android.view.Window
import harbor.compat.host.PlatformHost

open class FragmentActivity @JvmOverloads constructor(base: Context? = null) : Activity(base) {

    private val fragments = FragmentManager().also { it.owner = this }
    private val activityWindow: Window by lazy { Window(this) }
    private var finishing: Boolean = false
    private var destroyed: Boolean = false
    private var started: Boolean = true

    open fun getSupportFragmentManager(): FragmentManager = fragments

    open fun getWindow(): Window = activityWindow

    open fun isFinishing(): Boolean = finishing

    open fun isDestroyed(): Boolean = destroyed

    open fun isStarted(): Boolean = started

    /** Extensions post their dialog work here from a scrape. Without a host loop the work still
     * has to happen, so it runs now, and a failure in it stays out of the scrape that posted it. */
    open fun runOnUiThread(action: Runnable?) {
        val task = action ?: return
        try {
            task.run()
        } catch (error: Throwable) {
            PlatformHost.log(5, "FragmentActivity", "posted work failed", error)
        }
    }

    open fun finish() {
        finishing = true
    }

    open fun onStart() {
        started = true
        fragments.dispatchStart()
    }

    open fun onStop() {
        started = false
    }

    open fun onDestroy() {
        destroyed = true
        started = false
        fragments.dispatchDestroy()
    }
}
