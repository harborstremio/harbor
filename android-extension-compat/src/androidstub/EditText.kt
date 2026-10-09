package android.widget

import android.content.Context
import android.text.Editable

open class EditText(context: Context?) : TextView(context) {

    private val editable = Content()

    init {
        isFocusable = true
        isFocusableInTouchMode = true
    }

    var hint: CharSequence? = null
    var imeOptions: Int = 0
    var inputType: Int = 0
    var isSingleLine: Boolean = false
    var onEditorActionListener: TextView.OnEditorActionListener? = null

    var selectionStart: Int = 0
        private set

    var selectionEnd: Int = 0
        private set

    open fun getText(): Editable = editable

    open fun setSelection(index: Int) {
        val at = index.coerceIn(0, editable.length)
        selectionStart = at
        selectionEnd = at
    }

    open fun onEditorAction(actionId: Int): Boolean {
        val listener = onEditorActionListener ?: return false
        return try {
            listener.onEditorAction(this, actionId, null)
        } catch (t: Throwable) {
            false
        }
    }

    private inner class Content : Editable {

        override val length: Int
            get() = text?.length ?: 0

        override fun get(index: Int): Char {
            val current = text ?: return ' '
            return if (index >= 0 && index < current.length) current[index] else ' '
        }

        override fun subSequence(startIndex: Int, endIndex: Int): CharSequence {
            val current = text ?: return ""
            val from = startIndex.coerceIn(0, current.length)
            val to = endIndex.coerceIn(from, current.length)
            return current.subSequence(from, to)
        }

        override fun clear() {
            text = ""
            selectionStart = 0
            selectionEnd = 0
        }

        override fun toString(): String = text?.toString() ?: ""
    }
}
