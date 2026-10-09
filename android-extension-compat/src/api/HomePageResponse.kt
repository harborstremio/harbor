package com.lagradost.cloudstream3

/** What a provider's main page answered, and whether another page follows.
 *
 * `hasNext` defaults to true because this default is the one that applies. Kotlin fills in a
 * default argument in the class that declares it, so an extension that writes
 * `HomePageResponse(items)` has taken this value rather than one of its own -- and every extension
 * scanned does exactly that, none of them passing the flag. A false here therefore told every
 * catalogue it had no next page, and each row stopped at its first one. */
class HomePageResponse(
    val items: List<HomePageList>,
    val hasNext: Boolean = true,
)
