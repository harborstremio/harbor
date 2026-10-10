package com.lagradost.cloudstream3.plugins

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class SitePlugin(
    val url: String = "",
    val internalName: String = "",
    val name: String = "",
    val version: Int = 0,
    val apiVersion: Int = 0,
    val status: Int = 1,
    val authors: List<String> = emptyList(),
    val description: String? = null,
    val repositoryUrl: String? = null,
    val language: String? = null,
    val iconUrl: String? = null,
    val tvTypes: List<String>? = null,
    val fileSize: Long? = null,
)
