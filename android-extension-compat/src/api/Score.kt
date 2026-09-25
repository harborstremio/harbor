package com.lagradost.cloudstream3

import java.util.Locale
import kotlin.math.roundToInt

/**
 * A rating normalised to a fixed internal scale so that ratings collected from different sites,
 * some out of 5, some out of 10, some out of 100, stay comparable once they reach the host.
 */
class Score private constructor(private val normalized: Int) {

    fun toDouble(maxValue: Int = 10): Double = normalized.toDouble() * maxValue / SCALE

    fun toInt(maxValue: Int = 10): Int = toDouble(maxValue).roundToInt()

    fun toFloat(maxValue: Int = 10): Float = toDouble(maxValue).toFloat()

    fun toStringOutOf(maxValue: Int = 10): String {
        val scaled = toDouble(maxValue)
        val whole = scaled.roundToInt()
        return if (kotlin.math.abs(scaled - whole) < 0.05) "$whole" else String.format(Locale.ROOT, "%.1f", scaled)
    }

    override fun toString(): String = toStringOutOf(10)

    override fun hashCode(): Int = normalized

    override fun equals(other: Any?): Boolean = other is Score && other.normalized == normalized

    companion object {
        private const val SCALE = 1000

        fun from(value: Double?, maxValue: Int): Score? {
            if (value == null || maxValue <= 0 || value.isNaN() || value.isInfinite()) return null
            val scaled = (value * SCALE / maxValue).roundToInt()
            if (scaled < 0 || scaled > SCALE) return null
            return Score(scaled)
        }

        fun from(value: Int?, maxValue: Int): Score? = from(value?.toDouble(), maxValue)

        fun from(value: String?, maxValue: Int): Score? = from(parse(value), maxValue)

        fun from5(value: Double?): Score? = from(value, 5)

        fun from5(value: String?): Score? = from(value, 5)

        fun from10(value: Double?): Score? = from(value, 10)

        fun from10(value: Int?): Score? = from(value, 10)

        fun from10(value: String?): Score? = from(value, 10)

        fun from100(value: Double?): Score? = from(value, 100)

        fun from100(value: Int?): Score? = from(value, 100)

        fun from100(value: String?): Score? = from(value, 100)

        fun from1000(value: Int?): Score? = from(value, 1000)

        fun from1000(value: String?): Score? = from(value, 1000)

        /** Site ratings arrive as "8.4", "8,4", "84%", "8.4 / 10" and "7.8 out of 10". */
        private fun parse(raw: String?): Double? {
            val head = raw?.trim()?.substringBefore('/') ?: return null
            val number = NUMBER.find(head)?.value ?: return null
            return number.replace(',', '.').toDoubleOrNull()
        }

        private val NUMBER = Regex("""-?\d+(?:[.,]\d+)?""")
    }
}
