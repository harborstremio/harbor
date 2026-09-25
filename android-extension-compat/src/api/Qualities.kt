package com.lagradost.cloudstream3.utils

/** Quality ladder shared by every extension. The numbers are the vertical resolution, except
 * Unknown, which is deliberately 400 so an unlabelled stream sorts between 360p and 480p instead
 * of below everything. */
enum class Qualities(val value: Int) {
    Unknown(400),
    P144(144),
    P240(240),
    P360(360),
    P480(480),
    P720(720),
    P1080(1080),
    P1440(1440),
    P2160(2160);

    companion object {
        fun fromValue(value: Int): Qualities = entries.firstOrNull { it.value == value } ?: Unknown

        /** Nearest rung at or below [height], so 1088 lands on P1080 rather than on Unknown. */
        fun fromHeight(height: Int): Qualities =
            entries.filter { it != Unknown && it.value <= height }.maxByOrNull { it.value } ?: P144
    }
}
