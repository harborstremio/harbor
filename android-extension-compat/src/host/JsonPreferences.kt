package harbor.compat.host

import android.content.SharedPreferences
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.File

/** A SharedPreferences backed by one JSON file per preference name.
 *
 * Extensions keep real state here: cached crypto material, tokens, cookie hosts, cache stamps.
 * Values carry a one letter type tag on disk so a long comes back a long rather than a double,
 * which is what a plain JSON number round trip would give. */
class JsonPreferences(private val file: File) : SharedPreferences {

    private val values = LinkedHashMap<String, Any>()

    init {
        load()
    }

    override fun getAll(): MutableMap<String, *> = synchronized(this) { LinkedHashMap(values) }

    override fun getString(key: String, defValue: String?): String? =
        synchronized(this) { values[key] as? String ?: defValue }

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? =
        synchronized(this) { (values[key] as? Set<String>)?.toMutableSet() ?: defValues }

    override fun getInt(key: String, defValue: Int): Int =
        synchronized(this) { (values[key] as? Int) ?: defValue }

    override fun getLong(key: String, defValue: Long): Long =
        synchronized(this) { (values[key] as? Long) ?: defValue }

    override fun getFloat(key: String, defValue: Float): Float =
        synchronized(this) { (values[key] as? Float) ?: defValue }

    override fun getBoolean(key: String, defValue: Boolean): Boolean =
        synchronized(this) { (values[key] as? Boolean) ?: defValue }

    override fun contains(key: String): Boolean = synchronized(this) { values.containsKey(key) }

    override fun edit(): SharedPreferences.Editor = PendingEdit()

    private fun commit(pending: Map<String, Any?>, clearFirst: Boolean): Boolean = synchronized(this) {
        if (clearFirst) values.clear()
        for ((key, value) in pending) {
            if (value == null) values.remove(key) else values[key] = value
        }
        persist()
    }

    private fun load() {
        if (!file.isFile) return
        try {
            val root = JsonParser.parseString(file.readText()).asJsonObject
            for ((key, raw) in root.entrySet()) {
                decode(raw as? JsonObject ?: continue)?.let { values[key] = it }
            }
        } catch (error: Exception) {
            PlatformHost.log(5, "Preferences", "cannot read ${file.name}, starting empty", error)
        }
    }

    private fun persist(): Boolean {
        return try {
            val root = JsonObject()
            for ((key, value) in values) encode(value)?.let { root.add(key, it) }
            val text = root.toString()
            file.parentFile?.mkdirs()
            val temp = File(file.parentFile, file.name + ".tmp")
            temp.writeText(text)
            if (!temp.renameTo(file)) {
                file.writeText(text)
                temp.delete()
            }
            true
        } catch (error: Exception) {
            PlatformHost.log(5, "Preferences", "cannot write ${file.name}", error)
            false
        }
    }

    private fun encode(value: Any): JsonObject? {
        val holder = JsonObject()
        when (value) {
            is String -> {
                holder.addProperty("t", "s")
                holder.addProperty("v", value)
            }
            is Int -> {
                holder.addProperty("t", "i")
                holder.addProperty("v", value)
            }
            is Long -> {
                holder.addProperty("t", "l")
                holder.addProperty("v", value)
            }
            is Float -> {
                holder.addProperty("t", "f")
                holder.addProperty("v", value)
            }
            is Boolean -> {
                holder.addProperty("t", "b")
                holder.addProperty("v", value)
            }
            is Set<*> -> {
                holder.addProperty("t", "S")
                val items = com.google.gson.JsonArray()
                for (item in value) items.add(item?.toString() ?: "")
                holder.add("v", items)
            }
            else -> return null
        }
        return holder
    }

    private fun decode(holder: JsonObject): Any? {
        val tag = holder.get("t")?.asString ?: return null
        val raw = holder.get("v") ?: return null
        return when (tag) {
            "s" -> raw.asString
            "i" -> raw.asInt
            "l" -> raw.asLong
            "f" -> raw.asFloat
            "b" -> raw.asBoolean
            "S" -> raw.asJsonArray.map { it.asString }.toSet()
            else -> null
        }
    }

    private inner class PendingEdit : SharedPreferences.Editor {

        private val pending = LinkedHashMap<String, Any?>()
        private var clearFirst = false

        override fun putString(key: String, value: String?): SharedPreferences.Editor = set(key, value)

        override fun putStringSet(key: String, values: MutableSet<String>?): SharedPreferences.Editor =
            set(key, values?.toSet())

        override fun putInt(key: String, value: Int): SharedPreferences.Editor = set(key, value)

        override fun putLong(key: String, value: Long): SharedPreferences.Editor = set(key, value)

        override fun putFloat(key: String, value: Float): SharedPreferences.Editor = set(key, value)

        override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor = set(key, value)

        override fun remove(key: String): SharedPreferences.Editor = set(key, null)

        override fun clear(): SharedPreferences.Editor {
            clearFirst = true
            pending.clear()
            return this
        }

        override fun commit(): Boolean = this@JsonPreferences.commit(pending, clearFirst)

        override fun apply() {
            this@JsonPreferences.commit(pending, clearFirst)
        }

        private fun set(key: String, value: Any?): SharedPreferences.Editor {
            pending[key] = value
            return this
        }
    }
}
