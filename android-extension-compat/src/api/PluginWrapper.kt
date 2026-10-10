package com.lagradost.cloudstream3.plugins

import com.lagradost.cloudstream3.ui.settings.extensions.RepositoryData

data class PluginWrapper(
    val plugin: SitePlugin,
    val repositoryData: RepositoryData,
)
