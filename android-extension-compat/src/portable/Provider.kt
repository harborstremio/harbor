package com.harbor.capstan

import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.unregisterExtractors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.io.File
import java.util.Collections

/** The single place blocking host code becomes a coroutine.
 *
 * Every suspend call into an extension starts here and nowhere deeper, so no extension is ever
 * asked to block a thread that is already inside a coroutine of its own. */
internal class SuspendEdge(private val scope: CoroutineScope, private val timeoutMs: Long) {

    fun <T> call(block: suspend CoroutineScope.() -> T): T = runBlocking(scope.coroutineContext) {
        if (timeoutMs > 0) withTimeout(timeoutMs) { block() } else block()
    }
}

/** One live provider registered by an extension. */
class Provider internal constructor(
    private val api: MainAPI,
    private val edge: SuspendEdge,
) {
    private val mirrorLock = Any()

    /** Instances that already failed this process. A walk costs a real call against every
     * one of them, including hosts that answer nothing at all until the connect timeout, so
     * an instance is asked once and then left alone until the next run. */
    private val spentMirrors = Collections.synchronizedSet(HashSet<String>())

    val name: String get() = api.name

    /** Settable because an extension that hardcodes one instance of a federated service has to be
     * repointable. Writing it changes where every later call goes. */
    var mainUrl: String
        get() = api.mainUrl
        set(value) {
            api.mainUrl = value
        }

    val lang: String get() = api.lang

    val info: ProviderInfo get() = ResultMapping.provider(api)

    /** Every address this provider has talked to: the instance it is pointed at now, plus any
     * alternate a walk has already burned. What a call that came back empty is asked about. */
    private val hosts: List<String>
        get() = (listOf(api.mainUrl) + spentMirrors).mapNotNull(ServiceLedger::hostOf).distinct()

    /** Why a call that started at [since] came back empty, or null when nothing on the wire
     * explains it and the honest answer is that the service simply had nothing.
     *
     * For a federated service the instance being down is only half the story, so the reading the
     * mirror walk already took is added: a user who is told one address is down will go looking for
     * another, and being told there is no other is the part that saves them the trip. */
    fun why(since: Long): String? {
        val head = ServiceLedger.note(hosts, since) ?: return null
        val reading = Mirrors.lastReading(api.name) ?: return head
        val (answering, tried) = reading
        if (tried <= 1) return head
        if (answering == 0) return "$head, and no other instance of this service is answering"
        if (answering == 1) return "$head, and only 1 of $tried instances is reachable at all"
        return "$head, and only $answering of $tried instances are reachable at all"
    }

    /** The paged entry point answers whichever of the two search overrides the extension wrote,
     * so this one call covers both. */
    fun search(query: String, page: Int = 1): List<SearchItem> =
        onMirror({ it.isNotEmpty() }) {
            edge.call { api.search(query, page) }?.items.orEmpty().map(ResultMapping::search)
        }

    fun quickSearch(query: String): List<SearchItem> =
        onMirror({ it.isNotEmpty() }) {
            edge.call { api.quickSearch(query) }.orEmpty().map(ResultMapping::search)
        }

    fun load(url: String): MediaItem? =
        onMirror({ it != null }) { edge.call { api.load(url) }?.let(ResultMapping::media) }

    fun loadLinks(data: String, isCasting: Boolean = false): LinkSet =
        onMirror({ it.links.isNotEmpty() }) {
            val links = Collections.synchronizedList(ArrayList<StreamLink>())
            val subtitles = Collections.synchronizedList(ArrayList<SubtitleItem>())
            val handled = edge.call {
                api.loadLinks(
                    data,
                    isCasting,
                    { subtitles.add(ResultMapping.subtitle(it)) },
                    { links.add(ResultMapping.link(it)) },
                )
            }
            LinkSet(handled, ArrayList(links), ArrayList(subtitles))
        }

    /** Runs [block] against the instance the extension shipped with, and when the answer fails
     * [good] runs it again against each alternate instance the service's registry lists. An
     * instance that answers is kept, so the calls after it go straight there.
     *
     * The shipped answer is what the caller gets if no alternate does better, including its
     * exception, so a provider with no mirrors behaves exactly as it did before. */
    private fun <T> onMirror(good: (T) -> Boolean, block: () -> T): T {
        val first = runCatching(block)
        if (first.isSuccess && good(first.getOrThrow())) return first.getOrThrow()
        if (!Mirrors.known(api.name)) return first.getOrElse { throw it }
        synchronized(mirrorLock) {
            val shipped = api.mainUrl
            val alternates = runCatching { edge.call { Mirrors.of(api.name, shipped) } }
                .getOrDefault(emptyList())
            for (candidate in alternates.filterNot(spentMirrors::contains).take(MIRROR_LIMIT)) {
                api.mainUrl = candidate
                val next = runCatching(block)
                if (next.isSuccess && good(next.getOrThrow())) return next.getOrThrow()
                spentMirrors.add(candidate)
            }
            api.mainUrl = shipped
        }
        return first.getOrElse { throw it }
    }

    override fun toString(): String = "Provider($name, $mainUrl)"

    private companion object {
        /** A walk costs a full call per instance, so it is bounded rather than exhaustive. */
        const val MIRROR_LIMIT = 4
    }
}

/** An extension file that has been converted, loaded and asked to register itself. */
class LoadedExtension internal constructor(
    val name: String,
    val version: Int,
    val file: File,
    val entryClassName: String,
    val providers: List<Provider>,
    private val extractors: List<ExtractorApi>,
    /** Held as the base type because the two platforms hand over different loaders: a closeable
     * URLClassLoader over a converted jar, or a DexClassLoader that has nothing to close. */
    private val classLoader: ClassLoader,
) : AutoCloseable {

    val extractorNames: List<String> get() = extractors.map { it.name }

    val providerNames: List<String> get() = providers.map { it.name }

    fun provider(name: String): Provider? = providers.firstOrNull { it.name.equals(name, ignoreCase = true) }

    /** Withdraws the extractors first. Closing the loader while the shared registry still points
     * into this file turns the next link resolved through one of them into a NoClassDefFoundError
     * somewhere else entirely. */
    override fun close() {
        unregisterExtractors(extractors)
        (classLoader as? AutoCloseable)?.close()
    }

    override fun toString(): String = "LoadedExtension($name v$version, ${providers.size} providers)"
}
