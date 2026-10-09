package com.lagradost.cloudstream3.utils

import android.content.Context
import android.content.SharedPreferences

object DataStore {

    fun getSharedPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences(context.getPackageName() + "_preferences", 0)

    fun getDefaultSharedPrefs(context: Context): SharedPreferences = getSharedPrefs(context)
}
