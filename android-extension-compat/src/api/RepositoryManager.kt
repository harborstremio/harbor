package com.lagradost.cloudstream3.plugins

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.lagradost.api.Log
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.ui.settings.extensions.RepositoryData
import java.net.URI

object RepositoryManager {

    @Volatile
    var repositoryProvider: (() -> List<RepositoryData>)? = null

    fun getRepositories(): Array<RepositoryData> = try {
        repositoryProvider?.invoke()?.toTypedArray() ?: emptyArray()
    } catch (t: Throwable) {
        Log.w(TAG, "repository list failed: ${t.message}")
        emptyArray()
    }

    suspend fun getRepoPlugins(repository: RepositoryData): List<PluginWrapper>? {
        val index = fetch(repository.url)?.let { parse(it, Index::class.java) } ?: return null
        val out = ArrayList<PluginWrapper>()
        for (list in index.pluginLists) {
            val body = fetch(resolve(repository.url, list)) ?: continue
            val plugins = parse(body, Array<SitePlugin>::class.java) ?: continue
            for (plugin in plugins) out.add(PluginWrapper(plugin, repository))
        }
        return out
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Index(
        val name: String = "",
        val pluginLists: List<String> = emptyList(),
    )

    private fun resolve(base: String, target: String): String = try {
        URI(base).resolve(target).toString()
    } catch (t: Throwable) {
        target
    }

    private suspend fun fetch(url: String): String? {
        if (url.isBlank()) return null
        return try {
            app.get(url, timeout = FETCH_TIMEOUT_SECONDS).text.ifBlank { null }
        } catch (t: Throwable) {
            Log.w(TAG, "repository fetch failed for $url: ${t.message}")
            null
        }
    }

    private fun <T> parse(body: String, type: Class<T>): T? = try {
        mapper.readValue(body, type)
    } catch (t: Throwable) {
        Log.w(TAG, "repository index did not parse: ${t.message}")
        null
    }

    private const val TAG = "RepositoryManager"

    private const val FETCH_TIMEOUT_SECONDS = 20L

    private val mapper: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .build()
}
