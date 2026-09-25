package android.os

open class Bundle {

    private val values = LinkedHashMap<String, Any?>()

    open fun size(): Int = values.size

    open fun isEmpty(): Boolean = values.isEmpty()

    open fun keySet(): MutableSet<String> = values.keys

    open fun containsKey(key: String): Boolean = values.containsKey(key)

    open fun remove(key: String) {
        values.remove(key)
    }

    open fun clear() {
        values.clear()
    }

    open fun putString(key: String, value: String?) {
        values[key] = value
    }

    open fun getString(key: String): String? = values[key] as? String

    open fun getString(key: String, defaultValue: String?): String? = getString(key) ?: defaultValue

    open fun putInt(key: String, value: Int) {
        values[key] = value
    }

    open fun getInt(key: String): Int = getInt(key, 0)

    open fun getInt(key: String, defaultValue: Int): Int = (values[key] as? Int) ?: defaultValue

    open fun putLong(key: String, value: Long) {
        values[key] = value
    }

    open fun getLong(key: String): Long = getLong(key, 0L)

    open fun getLong(key: String, defaultValue: Long): Long = (values[key] as? Long) ?: defaultValue

    open fun putFloat(key: String, value: Float) {
        values[key] = value
    }

    open fun getFloat(key: String, defaultValue: Float): Float = (values[key] as? Float) ?: defaultValue

    open fun putBoolean(key: String, value: Boolean) {
        values[key] = value
    }

    open fun getBoolean(key: String): Boolean = getBoolean(key, false)

    open fun getBoolean(key: String, defaultValue: Boolean): Boolean =
        (values[key] as? Boolean) ?: defaultValue

    open fun putStringArrayList(key: String, value: ArrayList<String>?) {
        values[key] = value
    }

    @Suppress("UNCHECKED_CAST")
    open fun getStringArrayList(key: String): ArrayList<String>? = values[key] as? ArrayList<String>

    open fun putBundle(key: String, value: Bundle?) {
        values[key] = value
    }

    open fun getBundle(key: String): Bundle? = values[key] as? Bundle

    open fun putAll(other: Bundle) {
        values.putAll(other.values)
    }

    override fun toString(): String = "Bundle$values"
}
