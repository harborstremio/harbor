package android.content

open class ClipData(val label: CharSequence?, private val items: List<Item>) {

    open class Item(private val text: CharSequence?) {
        open fun getText(): CharSequence? = text
    }

    open fun getItemCount(): Int = items.size

    open fun getItemAt(index: Int): Item? = items.getOrNull(index)

    companion object {
        @JvmStatic
        fun newPlainText(label: CharSequence?, text: CharSequence?): ClipData =
            ClipData(label, listOf(Item(text)))
    }
}
