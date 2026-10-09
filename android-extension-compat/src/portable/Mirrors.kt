package com.harbor.capstan

import com.fasterxml.jackson.databind.ObjectMapper
import com.lagradost.cloudstream3.amap
import com.lagradost.cloudstream3.app
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

internal object Mirrors {

    private val registries = mapOf("invidious" to "https://api.invidious.io/instances.json")

    private val probePaths = mapOf("invidious" to "/api/v1/search?q=harbor&type=video")

    private const val PROBE_TIMEOUT_SECONDS = 8L

    private const val PROBE_TTL_MS = 15 * 60_000L

    private val listed = ConcurrentHashMap<String, List<String>>()

    private val probed = ConcurrentHashMap<String, Reading>()

    private val mapper = ObjectMapper()

    private class Reading(val instances: List<String>, val at: Long) {
        val fresh: Boolean get() = System.currentTimeMillis() - at < PROBE_TTL_MS
    }

    fun known(providerName: String): Boolean = registries.containsKey(providerName.lowercase())

    suspend fun of(providerName: String, mainUrl: String): List<String> {
        val key = providerName.lowercase()
        val registry = registries[key] ?: return emptyList()
        val all = listed[key] ?: read(registry).also { listed[key] = it }
        if (all.isEmpty()) return emptyList()
        val path = probePaths[key]
        val usable = if (path == null) all else probeRound(key, all, path)
        val current = host(mainUrl)
        return usable.filter { host(it) != current }
    }

    fun lastReading(providerName: String): Pair<Int, Int>? {
        val key = providerName.lowercase()
        val reading = probed[key] ?: return null
        val tried = listed[key]?.size ?: return null
        return reading.instances.size to tried
    }

    private suspend fun probeRound(key: String, all: List<String>, path: String): List<String> {
        probed[key]?.takeIf { it.fresh }?.let { return it.instances }
        val answered = all.amap { base -> probe(base, path) }.filterNotNull().sortedBy { it.second }
        val instances = answered.map { it.first }
        probed[key] = Reading(instances, System.currentTimeMillis())
        return instances
    }

    private suspend fun read(registry: String): List<String> {
        val body = runCatching { app.get(registry, timeout = 20).text }.getOrNull() ?: return emptyList()
        val tree = runCatching { mapper.readTree(body) }.getOrNull() ?: return emptyList()
        val apiOn = ArrayList<String>()
        val rest = ArrayList<String>()
        for (entry in tree) {
            val info = entry.path(1)
            if (info.path("type").asText("") != "https") continue
            val uri = info.path("uri").asText("").trimEnd('/')
            if (uri.isEmpty()) continue
            if (info.path("api").asBoolean(false)) apiOn.add(uri) else rest.add(uri)
        }
        return apiOn + rest
    }

    private suspend fun probe(base: String, path: String): Pair<String, Long>? {
        val started = System.nanoTime()
        val answer = runCatching { app.get(base + path, timeout = PROBE_TIMEOUT_SECONDS) }.getOrNull()
            ?: return null
        if (answer.code !in 200..299) return null
        if (!answer.headers["content-type"].orEmpty().contains("json")) return null
        return base to (System.nanoTime() - started)
    }

    private fun host(url: String): String =
        runCatching { URI(url).host.orEmpty().lowercase() }.getOrDefault("")
}
