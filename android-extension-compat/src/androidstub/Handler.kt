package android.os

import harbor.compat.host.PlatformHost
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** Real scheduling, because extensions drive tickers and retry loops through it: a dialog posts
 * itself every second and cancels on dismiss, so a handler that dropped work would hang the flow
 * it belongs to. */
open class Handler @JvmOverloads constructor(private val looper: Looper? = null) {

    private val pending = ConcurrentHashMap<Runnable, CopyOnWriteArrayList<ScheduledFuture<*>>>()

    open fun getLooper(): Looper = looper ?: Looper.getMainLooper()

    open fun post(runnable: Runnable): Boolean = postDelayed(runnable, 0L)

    open fun postDelayed(runnable: Runnable, delayMillis: Long): Boolean {
        val queue = pending.computeIfAbsent(runnable) { CopyOnWriteArrayList() }
        val future = getLooper().scheduler.schedule(
            { run(runnable) },
            if (delayMillis < 0) 0L else delayMillis,
            TimeUnit.MILLISECONDS,
        )
        queue.add(future)
        return true
    }

    open fun postAtTime(runnable: Runnable, atMillis: Long): Boolean =
        postDelayed(runnable, atMillis - uptimeMillis())

    open fun removeCallbacks(runnable: Runnable) {
        pending.remove(runnable)?.forEach { it.cancel(false) }
    }

    open fun removeCallbacksAndMessages(token: Any?) {
        for (key in pending.keys) {
            pending.remove(key)?.forEach { it.cancel(false) }
        }
    }

    private fun run(runnable: Runnable) {
        pending.computeIfPresent(runnable) { _, queue ->
            queue.removeAll { it.isDone }
            if (queue.isEmpty()) null else queue
        }
        try {
            runnable.run()
        } catch (error: Throwable) {
            PlatformHost.log(6, "Handler", "posted work failed", error)
        }
    }
}
