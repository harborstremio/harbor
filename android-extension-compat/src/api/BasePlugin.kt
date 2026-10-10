package com.lagradost.cloudstream3.plugins

import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.utils.ExtractorApi
import java.util.concurrent.CopyOnWriteArrayList

open class BasePlugin {
    val mainApis: MutableList<MainAPI> = CopyOnWriteArrayList()

    val extractorApis: MutableList<ExtractorApi> = CopyOnWriteArrayList()

    open fun load() {}

    fun registerMainAPI(element: MainAPI) {
        mainApis.add(element)
    }

    fun registerExtractorAPI(element: ExtractorApi) {
        extractorApis.add(element)
    }
}
