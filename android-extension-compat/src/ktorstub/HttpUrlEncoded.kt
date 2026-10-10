package io.ktor.http

fun Parameters.formUrlEncode(): String {
    val out = StringBuilder()
    for (entry in entries) {
        for (value in entry.value) {
            if (out.isNotEmpty()) out.append('&')
            out.append(encodeFormPart(entry.key)).append('=').append(encodeFormPart(value))
        }
    }
    return out.toString()
}

private const val HEX = "0123456789ABCDEF"

private fun encodeFormPart(text: String): String {
    val out = StringBuilder(text.length)
    for (byte in text.toByteArray(Charsets.UTF_8)) {
        val code = byte.toInt() and 0xFF
        val c = code.toChar()
        when {
            c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9' || c in "-._~" -> out.append(c)
            c == ' ' -> out.append('+')
            else -> out.append('%').append(HEX[code shr 4]).append(HEX[code and 0xF])
        }
    }
    return out.toString()
}
