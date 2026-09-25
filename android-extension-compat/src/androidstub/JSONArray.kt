package org.json

import com.google.gson.JsonArray as GsonArray

/** The platform's JSON list type. Out of range is absent rather than fatal on every opt accessor,
 * which is what lets a scrape survive a site that shortened a list. */
class JSONArray {

    private val values: ArrayList<Any>

    constructor() {
        values = ArrayList()
    }

    constructor(text: String) {
        val parsed = JsonValue.parse(text)
        if (parsed !is JSONArray) throw JSONException("not a JSON array")
        values = parsed.values
    }

    constructor(tokener: JSONTokener) {
        val parsed = tokener.nextValue()
        if (parsed !is JSONArray) throw JSONException("not a JSON array")
        values = parsed.values
    }

    constructor(source: Collection<*>) {
        values = ArrayList(source.size)
        for (value in source) values.add(JsonValue.wrap(value))
    }

    internal constructor(source: GsonArray) {
        values = JsonValue.fromGsonArray(source)
    }

    fun length(): Int = values.size

    fun isNull(index: Int): Boolean = opt(index).let { it == null || it === JSONObject.NULL }

    fun put(value: Any?): JSONArray {
        values.add(JsonValue.wrap(value))
        return this
    }

    fun put(value: Boolean): JSONArray = put(value as Any?)

    fun put(value: Int): JSONArray = put(value as Any?)

    fun put(value: Long): JSONArray = put(value as Any?)

    fun put(value: Double): JSONArray = put(value as Any?)

    fun put(index: Int, value: Any?): JSONArray {
        while (values.size <= index) values.add(JSONObject.NULL)
        values[index] = JsonValue.wrap(value)
        return this
    }

    fun remove(index: Int): Any? =
        if (index in values.indices) values.removeAt(index) else null

    fun opt(index: Int): Any? = values.getOrNull(index)

    fun get(index: Int): Any =
        values.getOrNull(index) ?: throw JSONException("no value at $index")

    fun getString(index: Int): String =
        JsonValue.asString(get(index)) ?: throw JSONException("$index is not a string")

    fun getBoolean(index: Int): Boolean =
        JsonValue.asBoolean(get(index)) ?: throw JSONException("$index is not a boolean")

    fun getDouble(index: Int): Double =
        JsonValue.asDouble(get(index)) ?: throw JSONException("$index is not a number")

    fun getInt(index: Int): Int = getDouble(index).toInt()

    fun getLong(index: Int): Long =
        JsonValue.asLong(get(index)) ?: throw JSONException("$index is not a number")

    fun getJSONObject(index: Int): JSONObject =
        get(index) as? JSONObject ?: throw JSONException("$index is not an object")

    fun getJSONArray(index: Int): JSONArray =
        get(index) as? JSONArray ?: throw JSONException("$index is not an array")

    @JvmOverloads
    fun optString(index: Int, fallback: String = ""): String =
        JsonValue.asString(opt(index)) ?: fallback

    @JvmOverloads
    fun optBoolean(index: Int, fallback: Boolean = false): Boolean =
        JsonValue.asBoolean(opt(index)) ?: fallback

    @JvmOverloads
    fun optDouble(index: Int, fallback: Double = Double.NaN): Double =
        JsonValue.asDouble(opt(index)) ?: fallback

    @JvmOverloads
    fun optInt(index: Int, fallback: Int = 0): Int =
        JsonValue.asDouble(opt(index))?.toInt() ?: fallback

    @JvmOverloads
    fun optLong(index: Int, fallback: Long = 0L): Long =
        JsonValue.asLong(opt(index)) ?: fallback

    fun optJSONObject(index: Int): JSONObject? = opt(index) as? JSONObject

    fun optJSONArray(index: Int): JSONArray? = opt(index) as? JSONArray

    fun join(separator: String): String =
        values.joinToString(separator) { StringBuilder().also { out -> JsonValue.write(out, it, 0, 0) }.toString() }

    override fun toString(): String = StringBuilder().also { write(it, 0, 0) }.toString()

    fun toString(indentSpaces: Int): String =
        StringBuilder().also { write(it, indentSpaces, 0) }.toString()

    internal fun write(out: StringBuilder, indent: Int, depth: Int) {
        out.append('[')
        for ((position, value) in values.withIndex()) {
            if (position > 0) out.append(',')
            JsonValue.newline(out, indent, depth + 1)
            JsonValue.write(out, value, indent, depth + 1)
        }
        if (values.isNotEmpty()) JsonValue.newline(out, indent, depth)
        out.append(']')
    }
}
