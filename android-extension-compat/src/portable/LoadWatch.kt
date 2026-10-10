package com.harbor.capstan

enum class LoadStage {
    ARCHIVE,

    CONVERT,

    LINK,

    ENTRY,

    INSTANTIATE,

    REGISTER,
}

fun interface LoadWatch {

    fun reached(stage: LoadStage, detail: String)

    companion object {
        val NONE = LoadWatch { _, _ -> }
    }
}
