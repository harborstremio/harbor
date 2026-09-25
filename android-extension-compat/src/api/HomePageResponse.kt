package com.lagradost.cloudstream3

class HomePageResponse(
    val items: List<HomePageList>,
    val hasNext: Boolean = false,
)
