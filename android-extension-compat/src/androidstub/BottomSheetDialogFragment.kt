package com.google.android.material.bottomsheet

import android.app.Dialog
import android.os.Bundle
import androidx.fragment.app.DialogFragment

open class BottomSheetDialogFragment : DialogFragment() {

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog = BottomSheetDialog(getContext())
}
