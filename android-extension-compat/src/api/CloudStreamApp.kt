package com.lagradost.cloudstream3

import android.content.Context
import android.content.SharedPreferences
import com.lagradost.cloudstream3.utils.DataStore
import harbor.compat.host.PlatformHost
import java.util.concurrent.ConcurrentHashMap

class CloudStreamApp {
    companion object {

        @Volatile
        var context: Context? = PlatformHost.applicationContext

        private val values = ConcurrentHashMap<String, Any>()

        fun <T> setKey(path: String, value: T) {
            if (value == null) {
                removeKey(path)
                return
            }
            values[path] = value
            preferences()?.edit()?.putString(path, mapper.writeValueAsString(value))?.apply()
        }

        fun <T> setKey(folder: String, path: String, value: T) = setKey("$folder/$path", value)

        @Suppress("UNCHECKED_CAST")
        fun <T> getKey(path: String): T? {
            values[path]?.let { return it as T }
            val stored = preferences()?.getString(path, null) ?: return null
            return runCatching { mapper.readValue(stored, Any::class.java) as T }.getOrNull()
        }

        fun <T> getKey(path: String, defVal: T): T = getKey<T>(path) ?: defVal

        fun removeKey(path: String) {
            values.remove(path)
            preferences()?.edit()?.remove(path)?.apply()
        }

        fun getKeys(prefix: String): List<String> {
            val stored = preferences()?.getAll()?.keys.orEmpty()
            return (values.keys + stored).filter { it.startsWith(prefix) }.distinct()
        }

        private fun preferences(): SharedPreferences? = context?.let { DataStore.getSharedPrefs(it) }
    }
}
