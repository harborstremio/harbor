package com.lagradost.api

object Log {
    var sink: ((level: Char, tag: String, message: String) -> Unit)? = null

    fun v(tag: String, message: String) = write('V', tag, message)

    fun d(tag: String, message: String) = write('D', tag, message)

    fun i(tag: String, message: String) = write('I', tag, message)

    fun w(tag: String, message: String) = write('W', tag, message)

    fun e(tag: String, message: String) = write('E', tag, message)

    private fun write(level: Char, tag: String, message: String) {
        val forward = sink
        if (forward != null) {
            try {
                forward(level, tag, message)
                return
            } catch (t: Throwable) {
            }
        }
        val line = "$level/$tag: $message"
        if (level == 'E' || level == 'W') System.err.println(line) else println(line)
    }
}
