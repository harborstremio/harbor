package com.lagradost.nicehttp

class RequestRecord(
    val method: String,
    val url: String,
    val status: Int,
    val contentType: String,
    val bodyBytes: Int,
    val millis: Long,
    val error: String?,
)

@Volatile
var requestWatch: ((RequestRecord) -> Unit)? = null

@Volatile
var serviceLedger: ((RequestRecord) -> Unit)? = null
