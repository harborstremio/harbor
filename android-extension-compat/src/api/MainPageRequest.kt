package com.lagradost.cloudstream3

data class MainPageRequest(
    val name: String,
    val data: String,
    val horizontalImages: Boolean = false,
)
