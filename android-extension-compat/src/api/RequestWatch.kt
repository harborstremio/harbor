package com.lagradost.nicehttp

/** One request that actually went out, with the status the server answered.
 *
 * A provider that swallows a failed fetch and returns an empty list looks identical from the
 * outside to a provider that fetched fine and found nothing. This is the difference. */
class RequestRecord(
    val method: String,
    val url: String,
    val status: Int,
    val contentType: String,
    val bodyBytes: Int,
    val millis: Long,
    val error: String?,
)

/** Set to watch requests. Null in production; the request path pays one null check. */
@Volatile
var requestWatch: ((RequestRecord) -> Unit)? = null

/** Set for the life of the process rather than for one recording, so a call that came back empty
 * can still ask what the host it was talking to actually answered. Kept apart from [requestWatch]
 * so a gate installing its own recorder cannot displace it. */
@Volatile
var serviceLedger: ((RequestRecord) -> Unit)? = null
