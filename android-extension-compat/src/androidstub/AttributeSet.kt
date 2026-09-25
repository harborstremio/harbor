package android.util

interface AttributeSet {

    fun getAttributeCount(): Int

    fun getAttributeName(index: Int): String?

    fun getAttributeValue(index: Int): String?

    fun getAttributeValue(namespace: String?, name: String?): String?

    fun getAttributeIntValue(namespace: String?, name: String?, defaultValue: Int): Int

    fun getAttributeBooleanValue(namespace: String?, name: String?, defaultValue: Boolean): Boolean

    fun getPositionDescription(): String
}
