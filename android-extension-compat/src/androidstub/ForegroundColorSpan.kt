package android.text.style

open class ForegroundColorSpan(private val color: Int) {

    fun getForegroundColor(): Int = color

    override fun toString(): String = "ForegroundColorSpan{$color}"
}
