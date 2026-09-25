package io.ktor.http

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/** Percent decoding over a range of a string.
 *
 * The three defaults are load bearing: the compiler emits the bridge extensions call from them.
 * An escape that is not valid hex is left as written rather than throwing, because a scraped page
 * carries stray percent signs all the time. */
fun String.decodeURLPart(
    start: Int = 0,
    end: Int = length,
    charset: Charset = Charsets.UTF_8,
): String {
    val from = start.coerceIn(0, length)
    val to = end.coerceIn(from, length)
    if (from == to) return ""
    if (indexOf('%', from) !in from until to) return substring(from, to)

    val out = ByteArrayOutputStream(to - from)
    var index = from
    while (index < to) {
        val c = this[index]
        if (c == '%' && index + 2 < to) {
            val value = hex(this[index + 1], this[index + 2])
            if (value >= 0) {
                out.write(value)
                index += 3
                continue
            }
        }
        out.write(c.toString().toByteArray(charset))
        index++
    }
    return out.toByteArray().toString(charset)
}

private fun hex(high: Char, low: Char): Int {
    val h = Character.digit(high, 16)
    val l = Character.digit(low, 16)
    if (h < 0 || l < 0) return -1
    return (h shl 4) or l
}
