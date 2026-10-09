package com.harbor.capstan.bridge

import com.google.gson.JsonObject
import harbor.compat.host.HostChannel
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class BridgeHostRequests(private val output: BridgeOutput) : HostChannel {

    private val counter = AtomicLong()

    private val pending = ConcurrentHashMap<String, ArrayBlockingQueue<JsonObject>>()

    @Volatile
    private var open = true

    override fun request(
        method: String,
        params: Map<String, String>,
        timeoutMs: Long,
    ): Map<String, String>? {
        if (!open) return null
        val id = "h" + counter.incrementAndGet()
        val mailbox = ArrayBlockingQueue<JsonObject>(1)
        pending[id] = mailbox
        try {
            output.host(id, method, params)
            val frame = mailbox.poll(timeoutMs.coerceIn(1_000L, 600_000L), TimeUnit.MILLISECONDS)
                ?: return null
            val ok = frame.get("ok")?.takeIf { it.isJsonPrimitive }
                ?.let { runCatching { it.asBoolean }.getOrDefault(false) } ?: false
            if (!ok) return null
            val result = frame.get("result")?.takeIf { it.isJsonObject }?.asJsonObject ?: return emptyMap()
            val fields = LinkedHashMap<String, String>()
            for ((key, value) in result.entrySet()) {
                if (value == null || value.isJsonNull || !value.isJsonPrimitive) continue
                fields[key] = value.asString
            }
            return fields
        } finally {
            pending.remove(id)
        }
    }

    fun answer(frame: JsonObject) {
        val id = frame.get("id")?.takeIf { it.isJsonPrimitive }
            ?.let { runCatching { it.asString }.getOrNull() }
            ?: return
        pending[id]?.offer(frame)
    }

    fun close() {
        open = false
        for (mailbox in pending.values) mailbox.offer(JsonObject())
    }

    companion object {
        fun isAnswer(frame: JsonObject): Boolean = !frame.has("method") && frame.has("ok")
    }
}
