package com.harbor.capstan.bridge

import com.google.gson.JsonObject
import harbor.compat.host.HostChannel
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/** The reverse direction of the line protocol: the layer asking the host, over the same two pipes.
 *
 * Correlation is the forward direction's, unchanged. Ids are unique while in flight, answers may
 * arrive in any order, and an answer is matched by id alone. Direction is what separates the two id
 * spaces: the host only ever reads frames carrying `host`, this class only ever reads frames
 * carrying `ok`, so an id used by both sides at once cannot be confused for the other's.
 */
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

    /** Hands [frame] to whoever is waiting on its id. An id nobody is waiting on is dropped: it is
     * a late answer to a request that already gave up, not a failure. */
    fun answer(frame: JsonObject) {
        val id = frame.get("id")?.takeIf { it.isJsonPrimitive }
            ?.let { runCatching { it.asString }.getOrNull() }
            ?: return
        pending[id]?.offer(frame)
    }

    /** Releases every waiter. Called when the host's input ends, so a request still outstanding
     * fails on the spot rather than holding a call open for its whole timeout. */
    fun close() {
        open = false
        for (mailbox in pending.values) mailbox.offer(JsonObject())
    }

    companion object {
        /** A frame from the host is an answer to this side when it carries no method and does
         * carry an outcome. Every forward request carries a method, so the two never overlap. */
        fun isAnswer(frame: JsonObject): Boolean = !frame.has("method") && frame.has("ok")
    }
}
