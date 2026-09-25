@file:JvmName("SystemClock")

package android.os

private val start: Long = System.nanoTime()

fun uptimeMillis(): Long = (System.nanoTime() - start) / 1_000_000L

fun elapsedRealtime(): Long = uptimeMillis()

fun currentThreadTimeMillis(): Long = uptimeMillis()

fun sleep(millis: Long) {
    try {
        Thread.sleep(if (millis < 0) 0L else millis)
    } catch (interrupted: InterruptedException) {
        Thread.currentThread().interrupt()
    }
}
