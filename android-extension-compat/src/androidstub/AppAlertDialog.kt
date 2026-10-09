package android.app

import android.content.Context
import android.content.DialogInterface
import android.view.View
import android.widget.ListView
import android.widget.TextView
import harbor.compat.host.PlatformHost

open class AlertDialog(context: Context? = null) : Dialog(context) {

    var title: CharSequence? = null
    var message: CharSequence? = null
    var choices: Array<CharSequence>? = null

    private val buttonText = HashMap<Int, CharSequence?>()
    private val buttonAction = HashMap<Int, DialogInterface.OnClickListener?>()
    private var showListener: DialogInterface.OnShowListener? = null
    private var choiceAction: DialogInterface.OnClickListener? = null
    private var rows: ListView? = null
    private var content: View? = null

    open fun setOnShowListener(listener: DialogInterface.OnShowListener?) {
        showListener = listener
    }

    open fun getButtonText(which: Int): CharSequence? = buttonText[which]

    open fun getContentView(): View? = content

    override fun setContentView(view: View?) {
        content = view
        super.setContentView(view)
    }

    open fun getListView(): ListView? = rows

    override fun show() {
        if (isShowing()) return
        super.show()
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
        try {
            buttonAction[which]?.onClick(this, which)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "button $which failed", error)
        }
        dismiss()
    }

    open fun clickItem(position: Int) {
        try {
            choiceAction?.onClick(this, position)
        } catch (error: Throwable) {
            PlatformHost.log(5, "AlertDialog", "item $position failed", error)
        }
        dismiss()
    }

    internal fun setButton(which: Int, text: CharSequence?, listener: DialogInterface.OnClickListener?) {
        buttonText[which] = text
        buttonAction[which] = listener
    }

    internal fun applyChoices(
        context: Context?,
        items: Array<CharSequence>?,
        listener: DialogInterface.OnClickListener?,
    ) {
        choices = items
        choiceAction = listener
        rows = items?.let { labels ->
            ListView(context).also { list ->
                labels.forEachIndexed { index, label -> list.addView(row(context, index, label)) }
            }
        }
    }

    private fun row(context: Context?, index: Int, label: CharSequence): TextView =
        TextView(context).also { view ->
            view.text = label
            view.isClickable = true
            view.isFocusable = true
            view.onClickListener = object : View.OnClickListener {
                override fun onClick(v: View?) {
                    clickItem(index)
                }
            }
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

        open fun setView(view: View?): Builder {
            dialog.setContentView(view)
            return this
        }

        open fun setItems(
            items: Array<CharSequence>?,
            listener: DialogInterface.OnClickListener?
        ): Builder {
            dialog.applyChoices(context, items, listener)
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
