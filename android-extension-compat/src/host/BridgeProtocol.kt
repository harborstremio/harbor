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
