package androidx.fragment.app

import android.app.Dialog
import android.content.DialogInterface
import android.os.Bundle

open class DialogFragment : Fragment() {

    private var dialog: Dialog? = null
    private var dismissed: Boolean = false

    open fun getDialog(): Dialog? = dialog

    open fun getShowsDialog(): Boolean = true

    open fun onCreateDialog(savedInstanceState: Bundle?): Dialog = Dialog(getContext())

    open fun show(manager: FragmentManager?, tag: String?) {
        val into = manager ?: return
        dismissed = false
        into.beginTransaction().add(this, tag).commitAllowingStateLoss()
    }

    open fun dismiss() {
        close()
    }

    open fun dismissAllowingStateLoss() {
        close()
    }

    open fun onDismiss(dialog: DialogInterface?) {}

    open fun onCancel(dialog: DialogInterface?) {}

    override fun onStart() {
        super.onStart()
        dialog?.show()
    }

    override fun onStop() {
        dialog?.hide()
        super.onStop()
    }

    override fun onDestroy() {
        dialog = null
        super.onDestroy()
    }

    internal fun createDialog(savedInstanceState: Bundle?) {
        val made = onCreateDialog(savedInstanceState)
        made.setOnDismissListener(object : DialogInterface.OnDismissListener {
            override fun onDismiss(dialog: DialogInterface?) {
                close()
            }
        })
        dialog = made
    }

    /** One dismissal only, whichever route reaches it first: the fragment's own dismiss, the
     * dialog going away under a host surface, or a button listener holding the dialog face. */
    private fun close() {
        if (dismissed) return
        dismissed = true
        val face: DialogInterface = dialog ?: Face(this)
        dialog?.dismiss()
        manager?.detach(this)
        onDismiss(face)
        onDestroy()
    }

    private class Face(private val owner: DialogFragment) : DialogInterface {

        override fun dismiss() {
            owner.close()
        }

        override fun cancel() {
            owner.close()
        }
    }
}
