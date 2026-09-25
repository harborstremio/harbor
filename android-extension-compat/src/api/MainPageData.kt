package com.lagradost.cloudstream3

/** One home screen row a provider offers. `data` is whatever the provider needs to fetch it. */
class MainPageData(
    val name: String,
    val data: String,
    val horizontalImages: Boolean = false,
)
