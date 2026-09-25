package com.lagradost.cloudstream3.utils

import java.util.regex.Pattern

/** Decoder for the "p,a,c,k,e,d" javascript packer that most embed players ship their source list
 * inside. The packed form is a payload plus a symbol table, where every word in the payload that
 * decodes to a table index is replaced by the table entry. */
class JsUnpacker(private val packedJS: String?) {

    /** The unpacked javascript, or null when the input was not packed or was truncated. */
    fun unpack(): String? {
        val js = packedJS ?: return null
        val matcher = HEADER.matcher(js)
        if (!matcher.find()) return null

        val payload = unescape(matcher.group(1) ?: return null)
        val radix = matcher.group(2)?.toIntOrNull() ?: 36
        val count = matcher.group(3)?.toIntOrNull() ?: 0
        val symtab = (matcher.group(4) ?: "").split("|")
        if (symtab.size != count) return null

        val unbaser = Unbaser(radix)
        val words = WORD.matcher(payload)
        val out = StringBuilder()
        var last = 0
        while (words.find()) {
            val word = words.group()
            val index = unbaser.unbase(word)
            val replacement = if (index != null && index < symtab.size && symtab[index].isNotEmpty()) {
                symtab[index]
            } else {
                word
            }
            out.append(payload, last, words.start()).append(replacement)
            last = words.end()
        }
        out.append(payload, last, payload.length)
        return out.toString()
    }

    private fun unescape(text: String): String {
        val out = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c == BACKSLASH && i + 1 < text.length) {
                val next = text[i + 1]
                if (next == BACKSLASH || next == '\'' || next == '"') {
                    out.append(next)
                    i += 2
                    continue
                }
            }
            out.append(c)
            i++
        }
        return out.toString()
    }

    /** Decodes a word written in an arbitrary base. Above base 36 the packer uses its own digit
     * alphabet, which is why this cannot just be Integer.parseInt. */
    private class Unbaser(private val base: Int) {

        fun unbase(value: String): Int? {
            if (value.isEmpty()) return null
            if (base <= 36) return value.toIntOrNull(base)
            var result = 0L
            for (ch in value) {
                val digit = ALPHABET.indexOf(ch)
                if (digit < 0 || digit >= base) return null
                result = result * base + digit
                if (result > Int.MAX_VALUE) return null
            }
            return result.toInt()
        }
    }

    private companion object {
        val HEADER: Pattern = Pattern.compile(
            """\}\s*\(\s*'(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\s*\.\s*split\s*\(\s*'\|'\s*\)""",
            Pattern.DOTALL,
        )
        val BACKSLASH: Char = 92.toChar()
        val WORD: Pattern = Pattern.compile("""\b\w+\b""")
        const val ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    }
}
