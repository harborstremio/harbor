package androidx.appcompat.app

import android.content.Context
import android.content.DialogInterface
import android.view.View
import android.widget.Button
import harbor.compat.host.PlatformHost

open class AlertDialog(private val host: Context? = null) : DialogInterface {

    var title: CharSequence? = null
    var message: CharSequence? = null
    var cancelable: Boolean = true

    var contentView: View? = null
    var choices: Array<CharSequence>? = null
    var checked: BooleanArray? = null
    var checkedChoice: Int = -1

    private val buttonText = HashMap<Int, CharSequence?>()
    private val buttonAction = HashMap<Int, DialogInterface.OnClickListener?>()
    private val buttons = HashMap<Int, Button>()
    private var showing: Boolean = false
    private var dismissListener: DialogInterface.OnDismissListener? = null
    private var cancelListener: DialogInterface.OnCancelListener? = null
    private var showListener: DialogInterface.OnShowListener? = null
    private var choiceAction: DialogInterface.OnClickListener? = null
    private var checkAction: DialogInterface.OnMultiChoiceClickListener? = null
    private var dismissOnChoice: Boolean = false

    open fun getContext(): Context? = host

    open fun isShowing(): Boolean = showing

    open fun getButtonText(which: Int): CharSequence? = buttonText[which]

    open fun setOnDismissListener(listener: DialogInterface.OnDismissListener?) {
        dismissListener = listener
    }

    open fun setOnCancelListener(listener: DialogInterface.OnCancelListener?) {
        cancelListener = listener
    }

    open fun setOnShowListener(listener: DialogInterface.OnShowListener?) {
        showListener = listener
    }

    open fun getButton(which: Int): Button = buttons.getOrPut(which) {
        Button(host).also { button ->
            button.text = buttonText[which]
            button.onClickListener = object : View.OnClickListener {
                override fun onClick(v: View?) {
                    fire(which)
                }
            }
        }
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
            return
        }
        try {
            showListener?.onShow(this)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "show listener failed", error)
        }
    }

    open fun click(which: Int) {
        val listener = buttons[which]?.onClickListener
        if (listener == null) {
            fire(which)
            return
        }
        try {
            listener.onClick(buttons[which])
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "button $which failed", error)
        }
    }

    open fun clickItem(position: Int) {
        checkedChoice = position
        try {
            choiceAction?.onClick(this, position)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "item $position failed", error)
        }
        if (dismissOnChoice) dismiss()
    }

    open fun checkItem(position: Int, isChecked: Boolean) {
        checked?.let { if (position in it.indices) it[position] = isChecked }
        try {
            checkAction?.onClick(this, position, isChecked)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "check $position failed", error)
        }
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
        try {
            cancelListener?.onCancel(this)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "cancel listener failed", error)
        }
        dismiss()
    }

    private fun fire(which: Int) {
        try {
            buttonAction[which]?.onClick(this, which)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "button $which failed", error)
        }
        dismiss()
    }

    internal fun setButton(which: Int, text: CharSequence?, listener: DialogInterface.OnClickListener?) {
        buttonText[which] = text
        buttonAction[which] = listener
        buttons[which]?.text = text
    }

    internal fun applyChoices(
        items: Array<CharSequence>?,
        state: BooleanArray?,
        selected: Int,
        closeOnPick: Boolean,
        click: DialogInterface.OnClickListener?,
        check: DialogInterface.OnMultiChoiceClickListener?,
    ) {
        choices = items
        checked = state
        checkedChoice = selected
        dismissOnChoice = closeOnPick
        choiceAction = click
        checkAction = check
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

        open fun setView(view: View?): Builder {
            dialog.contentView = view
            return this
        }

        open fun setItems(
            items: Array<CharSequence>?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.applyChoices(items, null, -1, true, listener, null)
            return this
        }

        open fun setSingleChoiceItems(
            items: Array<CharSequence>?,
            checkedItem: Int,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.applyChoices(items, null, checkedItem, false, listener, null)
            return this
        }

        open fun setMultiChoiceItems(
            items: Array<CharSequence>?,
            checkedItems: BooleanArray?,
            listener: DialogInterface.OnMultiChoiceClickListener?
        ): Builder {
            dialog.applyChoices(items, checkedItems ?: BooleanArray(items?.size ?: 0), -1, false, null, listener)
            return this
        }

        open fun setPositiveButton(
            text: CharSequence?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.setButton(DialogInterface.BUTTON_POSITIVE, text, listener)
            return this
        }

        open fun setPositiveButton(
            textId: Int,
            listener: DialogInterface.OnClickListener?
        ): Builder = setPositiveButton(label(textId), listener)

        open fun setNegativeButton(
            text: CharSequence?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.setButton(DialogInterface.BUTTON_NEGATIVE, text, listener)
            return this
        }

        open fun setNegativeButton(
            textId: Int,
            listener: DialogInterface.OnClickListener?
        ): Builder = setNegativeButton(label(textId), listener)

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

        open fun setOnCancelListener(listener: DialogInterface.OnCancelListener?): Builder {
            dialog.setOnCancelListener(listener)
            return this
        }

        open fun create(): AlertDialog = dialog

        open fun show(): AlertDialog {
            dialog.show()
            return dialog
        }

        private fun label(textId: Int): CharSequence =
            try {
                context?.getResources()?.getString(textId).orEmpty()
            } catch (error: Throwable) {
                ""
            }
    }

    companion object {

        @JvmStatic
        @Volatile
        var presenter: Presenter? = null
    }
}
