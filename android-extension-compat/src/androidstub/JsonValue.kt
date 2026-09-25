package org.json

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive

class JSONException(message: String) : Exception(message)

/** Reads and writes the JSON text form, and coerces between the types a scraped payload arrives
 * as and the type the caller asked for.
 *
 * Coercion is the whole point of this API as extensions use it: a site that sends `"1080"` where
 * it sent `1080` last week must not take the scrape down, so a string that reads as a number is
 * a number here, and a value that cannot be coerced is absent rather than fatal. */
internal object JsonValue {

    fun parse(text: String): Any {
        val element = try {
            JsonParser.parseString(text)
        } catch (malformed: Throwable) {
            throw JSONException("not valid JSON: ${malformed.message}")
        }
        return convert(element)
    }

    fun convert(element: JsonElement): Any = when {
        element.isJsonNull -> JSONObject.NULL
        element.isJsonObject -> JSONObject(element.asJsonObject)
        element.isJsonArray -> JSONArray(element.asJsonArray)
        else -> primitive(element.asJsonPrimitive)
    }

    private fun primitive(value: JsonPrimitive): Any = when {
        value.isBoolean -> value.asBoolean
        value.isNumber -> number(value.asString)
        else -> value.asString
    }

    /** Keeps whole numbers whole. A round trip through Double would turn an id into 1.23457E14. */
    fun number(text: String): Any {
        if (text.none { it == '.' || it == 'e' || it == 'E' }) {
            text.toIntOrNull()?.let { return it }
            text.toLongOrNull()?.let { return it }
        }
        return text.toDoubleOrNull() ?: text
    }

    fun asString(value: Any?): String? = when (value) {
        null, JSONObject.NULL -> null
        is String -> value
        else -> value.toString()
    }

    fun asDouble(value: Any?): Double? = when (value) {
        is Number -> value.toDouble()
        is String -> value.trim().toDoubleOrNull()
        else -> null
    }

    fun asLong(value: Any?): Long? = when (value) {
        is Number -> value.toLong()
        is String -> value.trim().toLongOrNull() ?: value.trim().toDoubleOrNull()?.toLong()
        else -> null
    }

    fun asBoolean(value: Any?): Boolean? = when {
        value is Boolean -> value
        value is String && value.equals("true", ignoreCase = true) -> true
        value is String && value.equals("false", ignoreCase = true) -> false
        else -> null
    }

    /** Anything a caller hands to put, reduced to the value model this package stores. */
    fun wrap(value: Any?): Any = when (value) {
        null -> JSONObject.NULL
        is JSONObject, is JSONArray, is String, is Boolean, is Number -> value
        is JsonElement -> convert(value)
        is Map<*, *> -> JSONObject(value)
        is Collection<*> -> JSONArray(value)
        is Array<*> -> JSONArray(value.toList())
        else -> value.toString()
    }

    fun write(out: StringBuilder, value: Any?, indent: Int, depth: Int) {
        when (value) {
            null, JSONObject.NULL -> out.append("null")
            is JSONObject -> value.write(out, indent, depth)
            is JSONArray -> value.write(out, indent, depth)
            is Boolean -> out.append(value.toString())
            is Number -> out.append(numberText(value))
            else -> quote(out, value.toString())
        }
    }

    private fun numberText(value: Number): String {
        val text = value.toString()
        if (value is Double && (value.isNaN() || value.isInfinite())) return "null"
        return text
    }

    fun quote(out: StringBuilder, text: String) {
        out.append('"')
        for (c in text) {
            when (c) {
                '"' -> out.append("\\\"")
                '\\' -> out.append("\\\\")
                '\n' -> out.append("\\n")
                '\r' -> out.append("\\r")
                '\t' -> out.append("\\t")
                '\b' -> out.append("\\b")
                else -> if (c < ' ') out.append("\\u%04x".format(c.code)) else out.append(c)
            }
        }
        out.append('"')
    }

    fun newline(out: StringBuilder, indent: Int, depth: Int) {
        if (indent <= 0) return
        out.append('\n')
        repeat(indent * depth) { out.append(' ') }
    }

    fun fromGsonObject(source: JsonObject): LinkedHashMap<String, Any> {
        val values = LinkedHashMap<String, Any>()
        for ((key, element) in source.entrySet()) values[key] = convert(element)
        return values
    }

    fun fromGsonArray(source: JsonArray): ArrayList<Any> {
        val values = ArrayList<Any>(source.size())
        for (element in source) values.add(convert(element))
        return values
    }
}

/** Reads one value out of a JSON document, the way the platform type does. */
class JSONTokener(private val text: String) {

    private var consumed = false

    fun nextValue(): Any {
        if (consumed) throw JSONException("nothing left to read")
        consumed = true
        return JsonValue.parse(text)
    }
}
