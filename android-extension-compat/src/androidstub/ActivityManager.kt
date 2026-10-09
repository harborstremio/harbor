package android.app

import java.lang.management.ManagementFactory

class ActivityManager {

    class MemoryInfo {
        @JvmField var totalMem: Long = totalMemory()
        @JvmField var availMem: Long = availableMemory()
        @JvmField var threshold: Long = totalMemory() / 16
        @JvmField var lowMemory: Boolean = false
    }

    fun getMemoryInfo(outInfo: MemoryInfo) {
        outInfo.totalMem = totalMemory()
        outInfo.availMem = availableMemory()
        outInfo.threshold = outInfo.totalMem / 16
        outInfo.lowMemory = outInfo.availMem < outInfo.threshold
    }
}

private val TOTAL_MEMORY: Long by lazy {
    val bean = ManagementFactory.getOperatingSystemMXBean()
    // The bean renamed this accessor, and its module cannot be named from a classpath build.
    for (name in listOf("getTotalMemorySize", "getTotalPhysicalMemorySize")) {
        val value = try {
            val method = bean.javaClass.getMethod(name)
            method.isAccessible = true
            method.invoke(bean) as? Long
        } catch (t: Throwable) {
            null
        }
        if (value != null && value > 0L) return@lazy value
    }
    Runtime.getRuntime().maxMemory()
}

private fun totalMemory(): Long = TOTAL_MEMORY

private fun availableMemory(): Long {
    val runtime = Runtime.getRuntime()
    return maxOf(0L, runtime.maxMemory() - (runtime.totalMemory() - runtime.freeMemory()))
}
