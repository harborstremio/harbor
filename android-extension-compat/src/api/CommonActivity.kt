package com.lagradost.cloudstream3

import android.app.Activity
import android.widget.Toast
import com.lagradost.api.Log

object CommonActivity {

    var activity: Activity? = null

    fun showToast(message: String?, duration: Int? = null) {
        if (message.isNullOrBlank()) return
        try {
            Toast.makeText(activity, message, duration ?: Toast.LENGTH_SHORT).show()
        } catch (t: Throwable) {
            Log.w("CommonActivity", "toast failed: ${t.message}")
        }
    }
}
