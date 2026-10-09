package com.lagradost.cloudstream3.plugins

import android.content.Context
import com.lagradost.api.Log
import harbor.compat.host.PlatformHost
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap

object PluginManager {

    @Volatile
    var installedProvider: (() -> List<PluginData>)? = null

    @Volatile
    var unloadHook: ((String) -> Unit)? = null

    @Volatile
    var loadHook: (suspend (Context, String) -> Boolean)? = null

    private val open = ConcurrentHashMap<String, WeakReference<BasePlugin>>()

    val plugins: Map<String, BasePlugin>
        get() {
            val live = LinkedHashMap<String, BasePlugin>()
            for ((path, ref) in open) {
                val plugin = ref.get()
                if (plugin == null) open.remove(path) else live[path] = plugin
            }
            return live
        }

    val pluginsOnline: Array<PluginData>
        get() = try {
            installedProvider?.invoke()?.toTypedArray() ?: emptyArray()
        } catch (t: Throwable) {
            Log.w(TAG, "installed plugin list failed: ${t.message}")
            emptyArray()
        }

    fun getPluginPath(context: Context, internalName: String, repositoryUrl: String): File =
        File(File(PlatformHost.dataDir, "plugins"), "${repositoryUrl.hashCode()}/$internalName.cs3")

    suspend fun loadSinglePlugin(context: Context, apiName: String): Boolean {
        if (plugins.values.any { plugin -> plugin.mainApis.any { it.name.equals(apiName, ignoreCase = true) } }) {
            return true
        }
        val hook = loadHook ?: return false
        return try {
            hook(context, apiName)
        } catch (t: Throwable) {
            Log.w(TAG, "loading $apiName failed: ${t.message}")
            false
        }
    }

    fun unloadPlugin(absolutePath: String) {
        open.remove(absolutePath)
        val hook = unloadHook ?: return
        try {
            hook(absolutePath)
        } catch (t: Throwable) {
            Log.w(TAG, "unloading $absolutePath failed: ${t.message}")
        }
    }

    fun attach(file: File, plugin: BasePlugin) {
        open[file.absolutePath] = WeakReference(plugin)
    }

    private const val TAG = "PluginManager"
}
