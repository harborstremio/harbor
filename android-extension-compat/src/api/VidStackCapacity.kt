package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode

internal fun capacityPause(tree: JsonNode?): Long? {
    val delivery = tree?.path("delivery")?.takeIf { it.isObject } ?: return null
    val seconds = delivery.path("retryAfter").asInt(0).coerceIn(1, CAPACITY_PAUSE_CAP_S)
    return seconds * 1000L
}

private const val CAPACITY_PAUSE_CAP_S = 4
