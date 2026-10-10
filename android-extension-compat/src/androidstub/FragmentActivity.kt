package androidx.fragment.app

import android.app.Activity
import android.content.Context
import android.view.Window
import androidx.lifecycle.LifecycleOwner
import harbor.compat.host.PlatformHost

open class FragmentActivity @JvmOverloads constructor(base: Context? = null) : Activity(base), LifecycleOwner {

    private val fragments = FragmentManager().also { it.owner = this }
    private val activityWindow: Window by lazy { Window(this) }
    private var finishing: Boolean = false
    private var destroyed: Boolean = false
    private var started: Boolean = true

    open fun getSupportFragmentManager(): FragmentManager = fragments

    open fun getWindow(): Window = activityWindow

    override fun isFinishing(): Boolean = finishing

    override fun isDestroyed(): Boolean = destroyed

    open fun isStarted(): Boolean = started

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
