package android.content

interface SharedPreferences {

    fun getAll(): MutableMap<String, *>

    fun getString(key: String, defValue: String?): String?

    fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>?

    fun getInt(key: String, defValue: Int): Int

    fun getLong(key: String, defValue: Long): Long

    fun getFloat(key: String, defValue: Float): Float

    fun getBoolean(key: String, defValue: Boolean): Boolean

    fun contains(key: String): Boolean

    fun edit(): Editor

    interface Editor {

        fun putString(key: String, value: String?): Editor

        fun putStringSet(key: String, values: MutableSet<String>?): Editor

        fun putInt(key: String, value: Int): Editor

        fun putLong(key: String, value: Long): Editor

        fun putFloat(key: String, value: Float): Editor

        fun putBoolean(key: String, value: Boolean): Editor

        fun remove(key: String): Editor

        fun clear(): Editor

        fun commit(): Boolean

        fun apply()
    }
}
