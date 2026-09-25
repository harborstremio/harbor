package com.lagradost.cloudstream3

import com.lagradost.cloudstream3.syncproviders.SyncIdName
import com.lagradost.cloudstream3.utils.ExtractorLink

/**
 * The provider base class. Every extension subclasses this and overrides some part of it, so the
 * shape here is fixed by already compiled bytecode: the accessor names, the parameter order and,
 * for the suspend functions, the trailing continuation.
 *
 * `supportedTypes` and the `has*` flags are vals because several extensions override them as vars,
 * which Kotlin allows in that direction only.
 */
abstract class MainAPI {

    companion object {
        /** Host supplied, read by extensions to decide whether adult results may be returned. */
        var settingsForProvider: SettingsJson = SettingsJson()
    }

    open var name: String = "NONE"

    open var mainUrl: String = "NONE"

    open var lang: String = "en"

    open val supportedTypes: Set<TvType> = setOf(TvType.Movie, TvType.TvSeries)

    open val supportedSyncNames: Set<SyncIdName> = emptySet()

    open val hasMainPage: Boolean = false

    open val hasQuickSearch: Boolean = false

    open val hasDownloadSupport: Boolean = true

    open val hasChromecastSupport: Boolean = true

    open val instantLinkLoading: Boolean = false

    /** The rows this provider offers on the home screen, usually built with `mainPageOf`. */
    open val mainPage: List<MainPageData> = emptyList()

    open suspend fun getMainPage(page: Int, request: MainPageRequest): HomePageResponse? = null

    open suspend fun search(query: String): List<SearchResponse>? = null

    /**
     * Paged search. An extension that only overrides the unpaged form still answers here, and one
     * that only overrides this form is reached directly, so the host can always call this one.
     */
    open suspend fun search(query: String, page: Int): SearchResponseList? {
        if (page > 1) return SearchResponseList(emptyList(), false)
        val results = search(query) ?: return null
        return SearchResponseList(results, false)
    }

    open suspend fun quickSearch(query: String): List<SearchResponse>? = search(query)

    open suspend fun load(url: String): LoadResponse? = null

    open suspend fun loadLinks(
        data: String,
        isCasting: Boolean,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ): Boolean = false

    open suspend fun getLoadUrl(name: SyncIdName, id: String): String? = null
}
