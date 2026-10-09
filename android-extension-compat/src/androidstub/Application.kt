package android.app

import android.content.Context
import android.content.ContextWrapper
import android.os.Bundle
import harbor.compat.host.PlatformHost
import java.util.concurrent.CopyOnWriteArrayList

open class Application @JvmOverloads constructor(base: Context? = null) : ContextWrapper(base) {

    interface ActivityLifecycleCallbacks {
        fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?)
        fun onActivityStarted(activity: Activity)
        fun onActivityResumed(activity: Activity)
        fun onActivityPaused(activity: Activity)
        fun onActivityStopped(activity: Activity)
        fun onActivitySaveInstanceState(activity: Activity, outState: Bundle)
        fun onActivityDestroyed(activity: Activity)
    }

    private val callbacks = CopyOnWriteArrayList<ActivityLifecycleCallbacks>()

    open fun registerActivityLifecycleCallbacks(callback: ActivityLifecycleCallbacks?) {
        if (callback != null && !callbacks.contains(callback)) callbacks.add(callback)
    }

    open fun unregisterActivityLifecycleCallbacks(callback: ActivityLifecycleCallbacks?) {
        if (callback != null) callbacks.remove(callback)
    }

    fun dispatchActivityLifecycle(stage: Int, activity: Activity, state: Bundle? = null) {
        for (callback in callbacks) {
            try {
                when (stage) {
                    CREATED -> callback.onActivityCreated(activity, state)
                    STARTED -> callback.onActivityStarted(activity)
                    RESUMED -> callback.onActivityResumed(activity)
                    PAUSED -> callback.onActivityPaused(activity)
                    STOPPED -> callback.onActivityStopped(activity)
                    SAVED -> callback.onActivitySaveInstanceState(activity, state ?: Bundle())
                    DESTROYED -> callback.onActivityDestroyed(activity)
                }
            } catch (t: Throwable) {
                PlatformHost.log(5, "Application", "lifecycle callback failed", t)
            }
        }
    }

    companion object {
        const val CREATED: Int = 0
        const val STARTED: Int = 1
        const val RESUMED: Int = 2
        const val PAUSED: Int = 3
        const val STOPPED: Int = 4
        const val SAVED: Int = 5
        const val DESTROYED: Int = 6
    }
}
