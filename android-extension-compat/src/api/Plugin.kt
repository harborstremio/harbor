package com.lagradost.cloudstream3.plugins

import android.content.Context
import android.content.res.Resources

/** An extension that also carries its own resource table and settings screen. */
open class Plugin : BasePlugin() {
    /** The resource table of the extension file, set by the host once it has opened that file.
     * Call sites null assert the result before reading an identifier off it, so the getter falls
     * back rather than handing back null. */
    open var resources: Resources? = null
        get() = field ?: resourceProvider?.invoke(this) ?: emptyTable

    /** Invoked by the host when the user opens this plugin's settings. */
    open var openSettings: ((Context) -> Unit)? = null

    /** An extension may override either this or the no argument [load], so this one falls through
     * to the other instead of leaving it unrun. */
    open fun load(context: Context) {
        load()
    }

    companion object {
        /** Installed by the host to resolve a plugin's own resource table lazily. */
        @JvmStatic
        var resourceProvider: ((Plugin) -> Resources?)? = null

        /** Last resort so the accessor is never null. Built reflectively because the constructor
         * of the platform type belongs to the platform layer and need not be public. */
        private val emptyTable: Resources? by lazy {
            runCatching {
                val c = Resources::class.java.getDeclaredConstructor()
                c.isAccessible = true
                c.newInstance()
            }.getOrNull()
        }
    }
}
