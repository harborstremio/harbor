package com.harbor.capstan.bridge

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.OutputStream
import java.io.PrintStream

const val PROTOCOL_VERSION: Int = 1

const val CODE_BAD_REQUEST = "bad_request"
const val CODE_UNKNOWN_METHOD = "unknown_method"
const val CODE_PROVIDER_NOT_FOUND = "provider_not_found"
const val CODE_EXTENSION_NOT_FOUND = "extension_not_found"
const val CODE_INSTALL_FAILED = "install_failed"
const val CODE_EXTENSION_ERROR = "extension_error"
const val CODE_TIMEOUT = "timeout"

/** A failure the caller is meant to read, as opposed to an extension blowing up. */
class BridgeError(val code: String, message: String) : Exception(message)

class BridgeRequest(val id: String, val method: String, val params: JsonObject) {

    fun optString(key: String): String? {
        val element = params.get(key) ?: return null
        if (element.isJsonNull) return null
        return runCatching { element.asString }.getOrNull()
    }

    fun string(key: String): String {
        val value = optString(key)
        if (value.isNullOrEmpty()) throw BridgeError(CODE_BAD_REQUEST, "missing parameter '$key'")
        return value
    }

    fun int(key: String, fallback: Int): Int {
        val element = params.get(key) ?: return fallback
        if (element.isJsonNull) return fallback
        return runCatching { element.asInt }.getOrElse { fallback }
    }

    fun long(key: String, fallback: Long): Long {
        val element = params.get(key) ?: return fallback
        if (element.isJsonNull) return fallback
        return runCatching { element.asLong }.getOrElse { fallback }
    }

    fun bool(key: String, fallback: Boolean): Boolean {
        val element = params.get(key) ?: return fallback
        if (element.isJsonNull) return fallback
        return runCatching { element.asBoolean }.getOrElse { fallback }
    }

    companion object {
        /** The frame a line carries, or null when it is not one. Parsing is split from reading a
         * request because a line can also be an answer to a request this side sent. */
        fun frameOf(line: String): JsonObject? {
            val root = runCatching { JsonParser.parseString(line) }.getOrNull() ?: return null
            return if (root.isJsonObject) root.asJsonObject else null
        }

        fun parse(frame: JsonObject): BridgeRequest {
            val id = frame.get("id")?.takeIf { !it.isJsonNull }
                ?.let { runCatching { it.asString }.getOrNull() }
                ?: throw BridgeError(CODE_BAD_REQUEST, "frame has no id")
            val method = frame.get("method")?.takeIf { !it.isJsonNull }
                ?.let { runCatching { it.asString }.getOrNull() }
                ?: throw BridgeError(CODE_BAD_REQUEST, "frame has no method")
            val params = frame.get("params")?.takeIf { it.isJsonObject }?.asJsonObject ?: JsonObject()
            return BridgeRequest(id, method, params)
        }
    }
}

/** The only writer allowed to touch the protocol stream.
 *
 * Responses are produced off many coroutines at once, so the write of a whole frame plus its
 * newline is the unit that has to be atomic, not the individual print. */
class BridgeOutput(stream: OutputStream) {

    private val out = PrintStream(stream, false, Charsets.UTF_8.name())

    private val lock = Any()

    fun send(frame: JsonObject) {
        val text = frame.toString()
        synchronized(lock) {
            out.print(text)
            out.print('\n')
            out.flush()
        }
    }

    fun ok(id: String, result: JsonObject) {
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("ok", true)
        frame.add("result", result)
        send(frame)
    }

    /** A reverse request: this side asking the host. Shaped like a forward request so the host can
     * reuse its own frame reader, and named `host` so it can never be mistaken for an answer. */
    fun host(id: String, method: String, params: Map<String, String>) {
        val body = JsonObject()
        for ((key, value) in params) body.addProperty(key, value)
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("host", method)
        frame.add("params", body)
        send(frame)
    }

    fun fail(id: String, code: String, message: String) {
        val error = JsonObject()
        error.addProperty("code", code)
        error.addProperty("message", message)
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("ok", false)
        frame.add("error", error)
        send(frame)
    }
}

/** Turns anything an extension can throw into a code and a single readable line.
 *
 * The stack trace goes to stderr, never into the response, so the caller gets something it can
 * show a user and the operator still gets the detail. */
fun describeFailure(failure: Throwable): Pair<String, String> {
    val unwrapped = if (failure is java.lang.reflect.InvocationTargetException) {
        failure.targetException ?: failure
    } else {
        failure
    }
    if (unwrapped is BridgeError) return unwrapped.code to (unwrapped.message ?: unwrapped.code)
    if (unwrapped is kotlinx.coroutines.TimeoutCancellationException) {
        return CODE_TIMEOUT to "the extension did not answer in time"
    }
    val label = unwrapped.javaClass.simpleName.ifEmpty { unwrapped.javaClass.name }
    val detail = unwrapped.message?.trim()?.takeIf { it.isNotEmpty() }
    return CODE_EXTENSION_ERROR to if (detail == null) label else "$label: ${detail.lineSequence().first()}"
}
