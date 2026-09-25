package androidx.appcompat.app

import android.content.Context
import android.content.DialogInterface
import harbor.compat.host.PlatformHost

open class AlertDialog(private val host: Context? = null) : DialogInterface {

    var title: CharSequence? = null
    var message: CharSequence? = null
    var cancelable: Boolean = true

    private val buttonText = HashMap<Int, CharSequence?>()
    private val buttonAction = HashMap<Int, DialogInterface.OnClickListener?>()
    private var showing: Boolean = false
    private var dismissListener: DialogInterface.OnDismissListener? = null

    open fun getContext(): Context? = host

    open fun isShowing(): Boolean = showing

    open fun getButtonText(which: Int): CharSequence? = buttonText[which]

    open fun setOnDismissListener(listener: DialogInterface.OnDismissListener?) {
        dismissListener = listener
    }

    open fun show() {
        if (showing) return
        showing = true
        val surface = presenter
        if (surface == null) {
            PlatformHost.log(4, "AlertDialog", "no surface wired, holding: ${title ?: message ?: ""}")
            return
        }
        try {
            surface.present(this)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "surface failed to present", error)
        }
    }

    /** What the host calls when a button is pressed. The listener was compiled against the
     * platform button ids, so the caller passes those and gets its own dialog back. */
    open fun click(which: Int) {
        val listener = buttonAction[which]
        try {
            listener?.onClick(this, which)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "button $which failed", error)
        }
        dismiss()
    }

    override fun dismiss() {
        if (!showing) return
        showing = false
        try {
            dismissListener?.onDismiss(this)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "dismiss listener failed", error)
        }
    }

    override fun cancel() {
        dismiss()
    }

    internal fun setButton(which: Int, text: CharSequence?, listener: DialogInterface.OnClickListener?) {
        buttonText[which] = text
        buttonAction[which] = listener
    }

    fun interface Presenter {
        fun present(dialog: AlertDialog)
    }

    open class Builder(private val context: Context?) {

        private val dialog = AlertDialog(context)

        open fun getContext(): Context? = context

        open fun setTitle(title: CharSequence?): Builder {
            dialog.title = title
            return this
        }

        open fun setMessage(message: CharSequence?): Builder {
            dialog.message = message
            return this
        }

        open fun setCancelable(cancelable: Boolean): Builder {
            dialog.cancelable = cancelable
            return this
        }

        open fun setPositiveButton(
            text: CharSequence?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.setButton(DialogInterface.BUTTON_POSITIVE, text, listener)
            return this
        }

        open fun setNegativeButton(
            text: CharSequence?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.setButton(DialogInterface.BUTTON_NEGATIVE, text, listener)
            return this
        }

        open fun setNeutralButton(
            text: CharSequence?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.setButton(DialogInterface.BUTTON_NEUTRAL, text, listener)
            return this
        }

        open fun setOnDismissListener(listener: DialogInterface.OnDismissListener?): Builder {
            dialog.setOnDismissListener(listener)
            return this
        }

        open fun create(): AlertDialog = dialog

        open fun show(): AlertDialog {
            dialog.show()
            return dialog
        }
    }

    companion object {

        @JvmStatic
        @Volatile
        var presenter: Presenter? = null
    }
}
