package android.os

import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService

open class Looper internal constructor(name: String) {

    internal val scheduler: ScheduledExecutorService =
        Executors.newSingleThreadScheduledExecutor { runnable ->
            Thread(runnable, name).apply { isDaemon = true }
        }

    open fun getThread(): Thread = Thread.currentThread()

    open fun quit() {}

    companion object {

        private val main = Looper("compat-main-looper")

        @JvmStatic
        fun getMainLooper(): Looper = main

        @JvmStatic
        fun myLooper(): Looper = main
    }
}
