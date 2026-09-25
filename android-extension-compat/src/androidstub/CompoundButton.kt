package android.widget

import android.content.Context

open class CompoundButton(context: Context?) : Button(context) {

    interface OnCheckedChangeListener {
        fun onCheckedChanged(buttonView: CompoundButton?, isChecked: Boolean)
    }

    var onCheckedChangeListener: OnCheckedChangeListener? = null

    var isChecked: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            try {
                onCheckedChangeListener?.onCheckedChanged(this, value)
            } catch (t: Throwable) {
            }
        }

    open fun toggle() {
        isChecked = !isChecked
    }

    override fun performClick(): Boolean {
        toggle()
        return super.performClick()
    }
}
