package com.lagradost.cloudstream3

import com.lagradost.cloudstream3.syncproviders.SyncIdName
import com.lagradost.cloudstream3.utils.ExtractorLink

abstract class MainAPI {

    companion object {
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

    open val mainPage: List<MainPageData> = emptyList()

    open suspend fun getMainPage(page: Int, request: MainPageRequest): HomePageResponse? = null

    open suspend fun search(query: String): List<SearchResponse>? = null

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
