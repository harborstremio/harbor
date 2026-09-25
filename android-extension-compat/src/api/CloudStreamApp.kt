package com.lagradost.cloudstream3

import android.content.Context
import java.util.concurrent.ConcurrentHashMap

class CloudStreamApp {
    companion object {
        private val store = ConcurrentHashMap<String, Any>()

        @Volatile
        var context: Context? = null

        fun <T> setKey(path: String, value: T) {
            if (value == null) {
                store.remove(path)
                return
            }
            store[path] = value
        }

        fun <T> setKey(folder: String, path: String, value: T) = setKey("$folder/$path", value)

        @Suppress("UNCHECKED_CAST")
        fun <T> getKey(path: String): T? = store[path] as? T

        @Suppress("UNCHECKED_CAST")
        fun <T> getKey(path: String, defVal: T): T = (store[path] as? T) ?: defVal

        fun removeKey(path: String) {
            store.remove(path)
        }

        fun getKeys(prefix: String): List<String> = store.keys.filter { it.startsWith(prefix) }
    }
}
