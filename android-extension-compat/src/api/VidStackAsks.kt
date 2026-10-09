package com.lagradost.cloudstream3.extractors

import kotlinx.coroutines.delay

internal class VidStackAsks {
    private var left = ASK_LIMIT
    private val deadline = System.currentTimeMillis() + CALL_BUDGET_MS

    fun take(): Boolean {
        if (left <= 0) return false
        left--
        return true
    }

    suspend fun pause(code: Int): Boolean {
        if (left <= 0 || !crossable(code)) return false
        if (System.currentTimeMillis() + ASK_GAP_MS >= deadline) return false
        delay(ASK_GAP_MS)
        return true
    }
}

internal fun crossable(code: Int): Boolean = code == 502 || code == 504 || code in 520..530

internal fun refusalNote(code: Int): String = when {
    code == 429 -> "the origin has no allowance left,"
    crossable(code) -> "the edge could not reach the origin,"
    else -> "the origin answered"
}

private const val ASK_LIMIT = 4
private const val ASK_GAP_MS = 4_000L
private const val CALL_BUDGET_MS = 20_000L
