package android.app

import android.content.Context
import android.content.DialogInterface
import android.view.KeyEvent
import android.view.View
import android.view.Window

open class Dialog @JvmOverloads constructor(private val context: Context? = null) : DialogInterface {

    private val window = Window(context)
    private var content: View? = null
    private var keyListener: DialogInterface.OnKeyListener? = null
    private var dismissListener: DialogInterface.OnDismissListener? = null
    private var cancelListener: DialogInterface.OnCancelListener? = null
    private var showing = false

    open fun getContext(): Context? = context

    open fun getWindow(): Window? = window

    open fun requestWindowFeature(featureId: Int): Boolean = true

    open fun setContentView(view: View?) {
        content = view
    }

    open fun findViewById(id: Int): View? = content?.findViewById(id)

    open fun setOnKeyListener(listener: DialogInterface.OnKeyListener?) {
        keyListener = listener
    }

    open fun setOnDismissListener(listener: DialogInterface.OnDismissListener?) {
        dismissListener = listener
    }

    open fun setOnCancelListener(listener: DialogInterface.OnCancelListener?) {
        cancelListener = listener
    }

    open fun setCancelable(cancelable: Boolean) {}

    open fun setCanceledOnTouchOutside(cancel: Boolean) {}

    open fun isShowing(): Boolean = showing

    open fun show() {
        showing = true
    }

    open fun hide() {
        showing = false
    }

    override fun dismiss() {
        if (!showing) return
        showing = false
        dismissListener?.onDismiss(this)
    }

    override fun cancel() {
        cancelListener?.onCancel(this)
        dismiss()
    }

    /** The key listener an extension installs is its own escape handling, so it has to stay
     * reachable rather than merely stored. */
    open fun dispatchKeyEvent(keyCode: Int, event: KeyEvent?): Boolean =
        keyListener?.onKey(this, keyCode, event) ?: false
}
