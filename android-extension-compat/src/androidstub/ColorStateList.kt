package android.content.res

open class ColorStateList(private val states: Array<IntArray>?, private val colors: IntArray?) {

    constructor(color: Int) : this(arrayOf(IntArray(0)), intArrayOf(color))

    open fun getDefaultColor(): Int = colors?.lastOrNull() ?: 0

    open fun getColorForState(stateSet: IntArray?, defaultColor: Int): Int {
        val table = states ?: return getDefaultColor()
        val values = colors ?: return defaultColor
        val active = stateSet ?: IntArray(0)
        for (index in table.indices) {
            if (index >= values.size) break
            if (table[index].all { required -> active.contains(required) }) return values[index]
        }
        return defaultColor
    }

    open fun isStateful(): Boolean = (states?.size ?: 0) > 1

    companion object {
        @JvmStatic
        fun valueOf(color: Int): ColorStateList = ColorStateList(color)
    }
}
