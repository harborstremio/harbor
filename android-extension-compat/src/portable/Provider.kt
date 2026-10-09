package com.harbor.capstan

import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.MainPageRequest
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.unregisterExtractors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.io.File
import java.util.Collections
import kotlin.coroutines.Continuation

internal class SuspendEdge(private val scope: CoroutineScope, private val timeoutMs: Long) {

    fun <T> call(block: suspend CoroutineScope.() -> T): T = runBlocking(scope.coroutineContext) {
        if (timeoutMs > 0) withTimeout(timeoutMs) { block() } else block()
    }
}

class Provider internal constructor(
    private val api: MainAPI,
    private val edge: SuspendEdge,
) {
    private val mirrorLock = Any()

    private val spentMirrors = Collections.synchronizedSet(HashSet<String>())

    val name: String get() = api.name

    var mainUrl: String
        get() = api.mainUrl
        set(value) {
            api.mainUrl = value
        }

    val lang: String get() = api.lang

    val info: ProviderInfo get() = ResultMapping.provider(api)

    private val hosts: List<String>
        get() = (listOf(api.mainUrl) + spentMirrors).mapNotNull(ServiceLedger::hostOf).distinct()

    fun why(since: Long): String? {
        val head = ServiceLedger.note(hosts, since) ?: return null
        val reading = Mirrors.lastReading(api.name) ?: return head
        val (answering, tried) = reading
        if (tried <= 1) return head
        if (answering == 0) return "$head, and no other instance of this service is answering"
        if (answering == 1) return "$head, and only 1 of $tried instances is reachable at all"
        return "$head, and only $answering of $tried instances are reachable at all"
    }

    val catalogue: List<CatalogueRow>
        get() {
            val declared = api.mainPage.map {
                CatalogueRow(it.name, it.data, it.horizontalImages, declared = true)
            }
            if (declared.isNotEmpty()) return declared
            if (!answersCatalogue) return emptyList()
            return listOf(CatalogueRow(api.name, api.mainUrl, horizontalImages = false, declared = false))
        }

    fun cataloguePage(row: String, page: Int = 1): CataloguePage {
        val target = rowNamed(row) ?: throw IllegalArgumentException("$name has no catalogue row '$row'")
        val request = MainPageRequest(target.name, target.data, target.horizontalImages)
        val number = page.coerceAtLeast(1)
        return onMirror({ it.items > 0 }) {
            ResultMapping.cataloguePage(edge.call { api.getMainPage(number, request) })
        }
    }

    fun rowNamed(row: String): CatalogueRow? =
        catalogue.firstOrNull { it.name.equals(row, ignoreCase = true) }

    private val answersCatalogue: Boolean by lazy {
        runCatching {
            api.javaClass.getMethod(
                "getMainPage",
                Int::class.javaPrimitiveType,
                MainPageRequest::class.java,
                Continuation::class.java,
            ).declaringClass != MainAPI::class.java
        }.getOrDefault(false)
    }

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
        const val MIRROR_LIMIT = 4
    }
}

class LoadedExtension internal constructor(
    val name: String,
    val version: Int,
    val file: File,
    val entryClassName: String,
    val providers: List<Provider>,
    private val extractors: List<ExtractorApi>,
    private val classLoader: ClassLoader,
    val unavailable: List<UnconvertedMethod> = emptyList(),
) : AutoCloseable {

    val extractorNames: List<String> get() = extractors.map { it.name }

    val providerNames: List<String> get() = providers.map { it.name }

    fun provider(name: String): Provider? = providers.firstOrNull { it.name.equals(name, ignoreCase = true) }

    override fun close() {
        unregisterExtractors(extractors)
        (classLoader as? AutoCloseable)?.close()
    }

    override fun toString(): String = "LoadedExtension($name v$version, ${providers.size} providers)"
}
