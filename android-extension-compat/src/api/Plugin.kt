package com.lagradost.cloudstream3.plugins

import android.content.Context
import android.content.res.Resources

open class Plugin : BasePlugin() {
    open var resources: Resources? = null
        get() = field ?: resourceProvider?.invoke(this) ?: emptyTable

    open var openSettings: ((Context) -> Unit)? = null

    open fun load(context: Context) {
        load()
    }

    companion object {
        @JvmStatic
        var resourceProvider: ((Plugin) -> Resources?)? = null

        private val emptyTable: Resources? by lazy {
            runCatching {
                val c = Resources::class.java.getDeclaredConstructor()
                c.isAccessible = true
                c.newInstance()
            }.getOrNull()
        }
    }
}
