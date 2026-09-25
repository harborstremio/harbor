package com.lagradost.cloudstream3.plugins

import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.utils.ExtractorApi
import java.util.concurrent.CopyOnWriteArrayList

/** Entry point of an extension file. The host instantiates the annotated entry class, calls
 * [load], and then reads [mainApis] and [extractorApis] to learn what the file contributed. */
open class BasePlugin {
    /** Providers this plugin contributed, in registration order. Copy on write because load runs
     * off the thread that later reads these. */
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
