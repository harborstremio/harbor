package com.harbor.capstan

import com.fasterxml.jackson.databind.ObjectMapper
import com.lagradost.cloudstream3.amap
import com.lagradost.cloudstream3.app
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

/** Other deployments of the same federated service.
 *
 * An extension that hardcodes one instance stops working the day that operator turns their api
 * off, and nothing about that is the extension's fault or ours. Where the software publishes a
 * registry of its own instances the list is read from there rather than kept here, so it cannot go
 * stale in this file, and a registry that is unreachable simply yields no alternates.
 */
internal object Mirrors {

    /** Provider name, lowercased, to the registry its software publishes. */
    private val registries = mapOf("invidious" to "https://api.invidious.io/instances.json")

    /** A path under the api an extension actually calls, used to read each instance for itself.
     *
     * The registry's own `api` flag is whatever the operator last typed into it, and an instance
     * that serves its landing page while refusing every api path reads as healthy without this. */
    private val probePaths = mapOf("invidious" to "/api/v1/search?q=harbor&type=video")

    private const val PROBE_TIMEOUT_SECONDS = 8L

    /** Long enough that a walk does not re-read the federation on every call, short enough that an
     * instance coming back up is found by a session that has been open for a while. */
    private const val PROBE_TTL_MS = 15 * 60_000L

    private val listed = ConcurrentHashMap<String, List<String>>()

    private val probed = ConcurrentHashMap<String, Reading>()

    private val mapper = ObjectMapper()

    private class Reading(val instances: List<String>, val at: Long) {
        val fresh: Boolean get() = System.currentTimeMillis() - at < PROBE_TTL_MS
    }

    fun known(providerName: String): Boolean = registries.containsKey(providerName.lowercase())

    /** Every instance worth trying except the one already in use, best first.
     *
     * Where a probe path is known the list is the instances that answered it, ordered by how
     * quickly they did, and one that refused is left out rather than spending a whole provider call
     * to refuse again. Unreachable addresses drop out the same way, in parallel, instead of costing
     * a connect timeout each inside the walk. */
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

    /** How the last reading of this service went: how many instances answered, out of how many
     * tried. Null until a walk has read it, or for a provider that is not federated. */
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
