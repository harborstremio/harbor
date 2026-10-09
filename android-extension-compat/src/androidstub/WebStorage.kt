package android.webkit

class WebStorage private constructor() {

    class Origin(val origin: String, val quota: Long, val usage: Long)

    private val data = LinkedHashMap<String, MutableMap<String, String>>()

    fun deleteAllData() {
        synchronized(data) { data.clear() }
    }

    fun deleteOrigin(origin: String?) {
        val key = origin?.trim().orEmpty()
        if (key.isEmpty()) return
        synchronized(data) { data.remove(key) }
    }

    fun getOrigins(callback: ValueCallback<MutableMap<String, Origin>>?) {
        val out = LinkedHashMap<String, Origin>()
        synchronized(data) {
            for ((origin, values) in data) out[origin] = Origin(origin, 0L, usageOf(values))
        }
        callback?.onReceiveValue(out)
    }

    fun getUsageForOrigin(origin: String?, callback: ValueCallback<Long>?) {
        val values = synchronized(data) { data[origin?.trim().orEmpty()] }
        callback?.onReceiveValue(usageOf(values.orEmpty()))
    }

    fun getQuotaForOrigin(origin: String?, callback: ValueCallback<Long>?) {
        callback?.onReceiveValue(0L)
    }

    internal fun put(origin: String, key: String, value: String) {
        synchronized(data) { data.getOrPut(origin) { LinkedHashMap() }[key] = value }
    }

    private fun usageOf(values: Map<String, String>): Long =
        values.entries.sumOf { (it.key.length + it.value.length).toLong() * 2L }

    companion object {

        private val INSTANCE = WebStorage()

        @JvmStatic
        fun getInstance(): WebStorage = INSTANCE
    }
}
