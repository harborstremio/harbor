package com.lagradost.cloudstream3.utils

import android.content.Context
import android.content.SharedPreferences

/** Where an extension reads and writes its own settings. The file name matches the platform
 * default preference file so a plugin settings screen and a scraper see the same values. */
object DataStore {

    fun getSharedPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences(context.getPackageName() + "_preferences", 0)
}
