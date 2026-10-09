package com.harbor.capstan

class UnconvertedMethod(val owner: String, val method: String, val descriptor: String, val reason: String) {

    val display: String get() = "$owner.$method"

    val message: String
        get() = "capstan: $display is unavailable in this build ($reason). " +
            "This one provider path cannot run; the rest of the extension is unaffected."

    internal fun encode(): String = "$owner\t$method\t$descriptor\t$reason"

    companion object {
        internal fun decode(line: String): UnconvertedMethod? {
            val parts = line.split('\t')
            if (parts.size < 4) return null
            return UnconvertedMethod(parts[0], parts[1], parts[2], parts[3])
        }
    }
}
