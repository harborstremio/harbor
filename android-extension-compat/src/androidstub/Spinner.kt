package android.widget

import android.content.Context
import android.view.ViewGroup

open class Spinner(context: Context?) : ViewGroup(context) {

    private var spinnerAdapter: SpinnerAdapter? = null

    private var selection: Int = INVALID_POSITION

    open fun setAdapter(adapter: SpinnerAdapter?) {
        spinnerAdapter = adapter
        val count = adapter?.getCount() ?: 0
        selection = if (count <= 0) INVALID_POSITION else selection.coerceIn(0, count - 1)
    }

    open fun getAdapter(): SpinnerAdapter? = spinnerAdapter

    open fun getSelectedItemPosition(): Int = selection

    open fun getSelectedItem(): Any? {
        val at = selection
        if (at < 0) return null
        return spinnerAdapter?.getItem(at)
    }

    open fun getSelectedItemId(): Long {
        val at = selection
        if (at < 0) return INVALID_ROW_ID
        return spinnerAdapter?.getItemId(at) ?: INVALID_ROW_ID
    }

    open fun setSelection(position: Int) {
        selection = position
    }

    open fun setSelection(position: Int, animate: Boolean) {
        setSelection(position)
    }

    companion object {
        const val INVALID_POSITION: Int = -1
        const val INVALID_ROW_ID: Long = Long.MIN_VALUE
    }
}
