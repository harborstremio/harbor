package com.lagradost.cloudstream3.utils

import com.lagradost.api.Log
import com.lagradost.cloudstream3.extractors.GENERIC_EXTRACTORS
import com.lagradost.cloudstream3.extractors.builtinExtractors
import java.net.URI
import java.util.concurrent.CopyOnWriteArrayList

val extractorApis: MutableList<ExtractorApi> = CopyOnWriteArrayList(builtinExtractors())

fun registerExtractor(api: ExtractorApi) {
    if (extractorApis.any { it === api }) return
    extractorApis.add(0, api)
}

fun unregisterExtractors(apis: Collection<ExtractorApi>) {
    if (apis.isEmpty()) return
    extractorApis.removeAll(apis.toList())
}

fun getExtractorApiFromName(name: String): ExtractorApi? =
    extractorApis.firstOrNull { it.name.equals(name, ignoreCase = true) }

fun namedExtractorsFor(url: String): List<ExtractorApi> {
    val host = hostOf(url)
    if (host.isEmpty()) return emptyList()

    val exact = ArrayList<ExtractorApi>()
    val parent = ArrayList<ExtractorApi>()
    for (api in extractorApis) {
        val apiHost = hostOf(api.mainUrl)
        if (apiHost.isEmpty()) continue
        when {
            apiHost == host -> exact.add(api)
            host.endsWith(".$apiHost") -> parent.add(api)
        }
    }
    return exact + parent
}

fun extractorsFor(url: String): List<ExtractorApi> {
    if (hostOf(url).isEmpty()) return emptyList()
    return namedExtractorsFor(url) + GENERIC_EXTRACTORS
}

class ExtractorProbe(
    val url: String,
    val host: String,
    val named: List<String>,
    val ran: List<String>,
    val produced: Int,
)

@Volatile
var extractorWatch: ((ExtractorProbe) -> Unit)? = null

fun hostOf(url: String): String = try {
    (URI(httpsify(url.trim())).host ?: "").removePrefix("www.").lowercase()
} catch (t: Throwable) {
    ""
}

internal fun extractorLog(message: String) {
    try {
        Log.d("Extractor", message)
    } catch (t: Throwable) {
    }
}
