package com.lagradost.cloudstream3.ui.home

import com.lagradost.cloudstream3.SearchResponse

class HomeViewModel {

    companion object {

        suspend fun getResumeWatching(): List<SearchResponse> = emptyList()
    }
}
