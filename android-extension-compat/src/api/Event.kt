package com.lagradost.cloudstream3.utils

import java.util.concurrent.CopyOnWriteArrayList

class Event<T> {

    private val handlers = CopyOnWriteArrayList<(T) -> Unit>()

    operator fun plusAssign(handler: (T) -> Unit) {
        handlers.add(handler)
    }

    operator fun minusAssign(handler: (T) -> Unit) {
        handlers.remove(handler)
    }

    operator fun invoke(value: T) {
        for (handler in handlers) {
            try {
                handler(value)
            } catch (t: Throwable) {
                extractorLog("event handler failed: ${t::class.java.simpleName}: ${t.message}")
            }
        }
    }

    fun clear() {
        handlers.clear()
    }
}
