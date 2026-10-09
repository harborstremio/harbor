package android.widget

import android.content.Context
import android.view.View

open class RadioGroup(context: Context?) : LinearLayout(context) {

    private var checkedId: Int = View.NO_ID

    open fun check(id: Int) {
        checkedId = id
        for (index in 0 until getChildCount()) {
            val button = getChildAt(index) as? CompoundButton ?: continue
            button.isChecked = id != View.NO_ID && button.id == id
        }
    }

    open fun getCheckedRadioButtonId(): Int {
        for (index in 0 until getChildCount()) {
            val button = getChildAt(index) as? CompoundButton ?: continue
            if (button.isChecked && button.id != View.NO_ID) return button.id
        }
        return checkedId
    }

    override fun addView(child: View?) {
        super.addView(child)
        val button = child as? CompoundButton ?: return
        if (button.isChecked && button.id != View.NO_ID) check(button.id)
    }

    override fun removeAllViews() {
        super.removeAllViews()
        checkedId = View.NO_ID
    }
}
