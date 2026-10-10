package com.lagradost.nicehttp

import java.io.File

class NiceFile(
    val name: String,
    val fileName: String? = null,
    val file: File? = null,
    val fileBytes: ByteArray? = null,
    val contentType: String? = null
) {
    constructor(name: String, value: String) : this(name, null, null, value.toByteArray(), null)
}

fun File.toNiceFile(name: String): NiceFile = NiceFile(name, this.name, this)
