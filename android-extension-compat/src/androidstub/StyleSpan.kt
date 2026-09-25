package android.text.style

open class StyleSpan(private val style: Int) {

    fun getStyle(): Int = style

    override fun toString(): String = "StyleSpan{$style}"
}
