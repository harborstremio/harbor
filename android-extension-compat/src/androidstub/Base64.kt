@file:JvmName("Base64")

package android.util

import java.io.ByteArrayOutputStream

const val DEFAULT: Int = 0
const val NO_PADDING: Int = 1
const val NO_WRAP: Int = 2
const val CRLF: Int = 4
const val URL_SAFE: Int = 8
const val NO_CLOSE: Int = 16

private const val STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
private const val WEB_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

/** Extensions sign request URLs with these flags, so the alphabet, the padding and the wrapping
 * all have to match the platform exactly or the signature they send is a different string. */
fun encodeToString(input: ByteArray, flags: Int): String {
    val alphabet = if (flags and URL_SAFE != 0) WEB_SAFE else STANDARD
    val out = StringBuilder()
    var index = 0
    while (index + 2 < input.size) {
        val word = ((input[index].toInt() and 0xff) shl 16) or
            ((input[index + 1].toInt() and 0xff) shl 8) or
            (input[index + 2].toInt() and 0xff)
        out.append(alphabet[(word ushr 18) and 0x3f])
        out.append(alphabet[(word ushr 12) and 0x3f])
        out.append(alphabet[(word ushr 6) and 0x3f])
        out.append(alphabet[word and 0x3f])
        index += 3
    }
    when (input.size - index) {
        1 -> {
            val word = (input[index].toInt() and 0xff) shl 16
            out.append(alphabet[(word ushr 18) and 0x3f])
            out.append(alphabet[(word ushr 12) and 0x3f])
            if (flags and NO_PADDING == 0) out.append("==")
        }
        2 -> {
            val word = ((input[index].toInt() and 0xff) shl 16) or
                ((input[index + 1].toInt() and 0xff) shl 8)
            out.append(alphabet[(word ushr 18) and 0x3f])
            out.append(alphabet[(word ushr 12) and 0x3f])
            out.append(alphabet[(word ushr 6) and 0x3f])
            if (flags and NO_PADDING == 0) out.append('=')
        }
    }
    if (flags and NO_WRAP != 0) return out.toString()
    return wrap(out.toString(), if (flags and CRLF != 0) "\r\n" else "\n")
}

fun encode(input: ByteArray, flags: Int): ByteArray =
    encodeToString(input, flags).toByteArray(Charsets.US_ASCII)

/** Lenient the way the platform decoder is: either alphabet, missing padding and stray characters
 * all decode, because payloads scraped out of a page rarely arrive clean. */
fun decode(input: String, flags: Int): ByteArray {
    val values = IntArray(4)
    val out = ByteArrayOutputStream(input.length * 3 / 4 + 3)
    var held = 0
    for (character in input) {
        val value = when (character) {
            in 'A'..'Z' -> character - 'A'
            in 'a'..'z' -> character - 'a' + 26
            in '0'..'9' -> character - '0' + 52
            '+', '-' -> 62
            '/', '_' -> 63
            '=' -> break
            else -> continue
        }
        values[held] = value
        held++
        if (held == 4) {
            val word = (values[0] shl 18) or (values[1] shl 12) or (values[2] shl 6) or values[3]
            out.write((word ushr 16) and 0xff)
            out.write((word ushr 8) and 0xff)
            out.write(word and 0xff)
            held = 0
        }
    }
    if (held == 2) {
        out.write(((values[0] shl 2) or (values[1] ushr 4)) and 0xff)
    } else if (held == 3) {
        val word = (values[0] shl 18) or (values[1] shl 12) or (values[2] shl 6)
        out.write((word ushr 16) and 0xff)
        out.write((word ushr 8) and 0xff)
    }
    return out.toByteArray()
}

fun decode(input: ByteArray, flags: Int): ByteArray = decode(String(input, Charsets.US_ASCII), flags)

private fun wrap(text: String, terminator: String): String {
    if (text.isEmpty()) return terminator
    val out = StringBuilder()
    var index = 0
    while (index < text.length) {
        val end = minOf(index + 76, text.length)
        out.append(text, index, end).append(terminator)
        index = end
    }
    return out.toString()
}
