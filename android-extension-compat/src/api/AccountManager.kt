package com.lagradost.cloudstream3.syncproviders

import com.lagradost.cloudstream3.syncproviders.providers.AniListApi

open class AccountManager {

    companion object {

        // A checkcast against null always passes, so this null reaches the extension's cast unharmed.
        val aniListApi: AniListApi? = null
    }
}
