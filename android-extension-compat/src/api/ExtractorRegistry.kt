package com.lagradost.cloudstream3.utils

import com.lagradost.api.Log
import com.lagradost.cloudstream3.extractors.GENERIC_EXTRACTORS
import com.lagradost.cloudstream3.extractors.builtinExtractors
import java.net.URI
import java.util.concurrent.CopyOnWriteArrayList

/** Every extractor the host knows about, in priority order.
 *
 * To add a host: write a class extending [ExtractorApi], then add one instance to the list in
 * builtinExtractors. An extension can add its own at runtime with [registerExtractor], and one
 * registered later wins over a builtin for the same host, because an extension shipping its own
 * scraper for a host is doing it to correct the builtin. */
val extractorApis: MutableList<ExtractorApi> = CopyOnWriteArrayList(builtinExtractors())

/** Adds [api] in front of everything already there, which is what makes it win for its host.
 *
 * It deliberately does not evict a builtin claiming the same host and name. An extension that did
 * evict one took the host away for good, because the extension's own entry is withdrawn when its
 * file closes and the builtin never came back, leaving every later extension with no entry at all
 * for that host. Shadowing by position gives the extension priority and survives the unload. */
fun registerExtractor(api: ExtractorApi) {
    if (extractorApis.any { it === api }) return
    extractorApis.add(0, api)
}

/** Takes back what [registerExtractor] added, by identity.
 *
 * An extractor outlives the file it came from unless someone withdraws it, and once that file is
 * closed every class it still needs to reach is gone, so the entry has to go when the file does. */
fun unregisterExtractors(apis: Collection<ExtractorApi>) {
    if (apis.isEmpty()) return
    extractorApis.removeAll(apis.toList())
}

fun getExtractorApiFromName(name: String): ExtractorApi? =
    extractorApis.firstOrNull { it.name.equals(name, ignoreCase = true) }

/** The registry entries claiming [url]'s host, most specific first. Empty means no one wrote a
 * class for this host, which is a different situation from an entry that ran and found nothing. */
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

/** Extractors worth trying for [url], most specific first, with the generic scraper last so an
 * unknown host still gets a real attempt instead of an empty list. */
fun extractorsFor(url: String): List<ExtractorApi> {
    if (hostOf(url).isEmpty()) return emptyList()
    return namedExtractorsFor(url) + GENERIC_EXTRACTORS
}

/** One resolve attempt, as it happened. [named] is the registry coverage question the host cares
 * about: empty means the attempt fell through to the generic reader. */
class ExtractorProbe(
    val url: String,
    val host: String,
    val named: List<String>,
    val ran: List<String>,
    val produced: Int,
)

/** Set to watch resolve attempts. Null in production; the load path pays one null check. */
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
        // the host log is not wired up in every process the layer runs in
    }
}
