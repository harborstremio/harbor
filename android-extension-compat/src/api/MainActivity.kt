package com.lagradost.cloudstream3

import androidx.appcompat.app.AppCompatActivity
import com.lagradost.cloudstream3.utils.Event
import com.lagradost.nicehttp.Requests

val app: Requests = Requests()

class MainActivity : AppCompatActivity() {

    companion object {

        val afterPluginsLoadedEvent = Event<Boolean>()

        val bookmarksUpdatedEvent = Event<Boolean>()

        val reloadLibraryEvent = Event<Boolean>()
    }
}
