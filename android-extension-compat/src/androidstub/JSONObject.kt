package org.json

import com.google.gson.JsonObject as GsonObject

/** The platform's JSON map type.
 *
 * Insertion order is kept because extensions round trip payloads back to a site often enough that
 * a reordered body is a changed request. */
class JSONObject {

    private val values: LinkedHashMap<String, Any>

    constructor() {
        values = LinkedHashMap()
    }

    constructor(text: String) {
        val parsed = JsonValue.parse(text)
        if (parsed !is JSONObject) throw JSONException("not a JSON object")
        values = parsed.values
    }

    constructor(tokener: JSONTokener) {
        val parsed = tokener.nextValue()
        if (parsed !is JSONObject) throw JSONException("not a JSON object")
        values = parsed.values
    }

    constructor(source: Map<*, *>) {
        values = LinkedHashMap()
        for ((key, value) in source) {
            if (key == null) continue
            values[key.toString()] = JsonValue.wrap(value)
        }
    }

    constructor(source: JSONObject, names: Array<out String>) {
        values = LinkedHashMap()
        for (name in names) source.values[name]?.let { values[name] = it }
    }

    internal constructor(source: GsonObject) {
        values = JsonValue.fromGsonObject(source)
    }

    fun length(): Int = values.size

    fun has(name: String?): Boolean = name != null && values.containsKey(name)

    fun isNull(name: String?): Boolean = name == null || values[name] === NULL || !values.containsKey(name)

    fun keys(): MutableIterator<String> = values.keys.iterator()

    fun names(): JSONArray? = if (values.isEmpty()) null else JSONArray(values.keys.toList())

    fun remove(name: String?): Any? = if (name == null) null else values.remove(name)

    fun put(name: String, value: Any?): JSONObject {
        if (value == null) {
            values.remove(name)
            return this
        }
        values[name] = JsonValue.wrap(value)
        return this
    }

    fun put(name: String, value: Boolean): JSONObject = put(name, value as Any?)

    fun put(name: String, value: Int): JSONObject = put(name, value as Any?)

    fun put(name: String, value: Long): JSONObject = put(name, value as Any?)

    fun put(name: String, value: Double): JSONObject = put(name, value as Any?)

    fun putOpt(name: String?, value: Any?): JSONObject {
        if (name == null || value == null) return this
        return put(name, value)
    }

    fun opt(name: String?): Any? = if (name == null) null else values[name]

    fun get(name: String): Any =
        values[name] ?: throw JSONException("no value for $name")

    fun getString(name: String): String =
        JsonValue.asString(get(name)) ?: throw JSONException("$name is not a string")

    fun getBoolean(name: String): Boolean =
        JsonValue.asBoolean(get(name)) ?: throw JSONException("$name is not a boolean")

    fun getDouble(name: String): Double =
        JsonValue.asDouble(get(name)) ?: throw JSONException("$name is not a number")

    fun getInt(name: String): Int = getDouble(name).toInt()

    fun getLong(name: String): Long =
        JsonValue.asLong(get(name)) ?: throw JSONException("$name is not a number")

    fun getJSONObject(name: String): JSONObject =
        get(name) as? JSONObject ?: throw JSONException("$name is not an object")

    fun getJSONArray(name: String): JSONArray =
        get(name) as? JSONArray ?: throw JSONException("$name is not an array")

    @JvmOverloads
    fun optString(name: String?, fallback: String = ""): String =
        JsonValue.asString(opt(name)) ?: fallback

    @JvmOverloads
    fun optBoolean(name: String?, fallback: Boolean = false): Boolean =
        JsonValue.asBoolean(opt(name)) ?: fallback

    @JvmOverloads
    fun optDouble(name: String?, fallback: Double = Double.NaN): Double =
        JsonValue.asDouble(opt(name)) ?: fallback

    @JvmOverloads
    fun optInt(name: String?, fallback: Int = 0): Int =
        JsonValue.asDouble(opt(name))?.toInt() ?: fallback

    @JvmOverloads
    fun optLong(name: String?, fallback: Long = 0L): Long =
        JsonValue.asLong(opt(name)) ?: fallback

    fun optJSONObject(name: String?): JSONObject? = opt(name) as? JSONObject

    fun optJSONArray(name: String?): JSONArray? = opt(name) as? JSONArray

    override fun toString(): String = StringBuilder().also { write(it, 0, 0) }.toString()

    fun toString(indentSpaces: Int): String =
        StringBuilder().also { write(it, indentSpaces, 0) }.toString()

    internal fun write(out: StringBuilder, indent: Int, depth: Int) {
        out.append('{')
        var first = true
        for ((key, value) in values) {
            if (!first) out.append(',')
            first = false
            JsonValue.newline(out, indent, depth + 1)
            JsonValue.quote(out, key)
            out.append(':')
            if (indent > 0) out.append(' ')
            JsonValue.write(out, value, indent, depth + 1)
        }
        if (!first) JsonValue.newline(out, indent, depth)
        out.append('}')
    }

    companion object {
        /** The value a JSON null parses to, which is not the same as a key being absent. */
        @JvmField
        val NULL: Any = object {
            override fun equals(other: Any?): Boolean = other === this || other == null
            override fun hashCode(): Int = 0
            override fun toString(): String = "null"
        }

        @JvmStatic
        fun quote(text: String?): String {
            if (text == null) return "\"\""
            return StringBuilder().also { JsonValue.quote(it, text) }.toString()
        }

        @JvmStatic
        fun numberToString(number: Number?): String = number?.toString() ?: "null"
    }
}
