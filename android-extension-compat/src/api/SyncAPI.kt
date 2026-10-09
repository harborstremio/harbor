package com.lagradost.cloudstream3.syncproviders

import com.lagradost.cloudstream3.SearchResponse
import com.lagradost.cloudstream3.utils.UiText

interface SyncAPI {

    suspend fun library(): LibraryMetadata? = null

    class LibraryList(val name: UiText, val items: List<SearchResponse>)

    class LibraryMetadata(val allLibraryLists: List<LibraryList>)
}
