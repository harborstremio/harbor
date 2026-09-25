package com.harbor.capstan

/** The steps a load runs through, in order. */
enum class LoadStage {
    /** The file was opened and its manifest and Dalvik units read. */
    ARCHIVE,

    /** The Dalvik units became a jar of JVM bytecode. */
    CONVERT,

    /** The jar has a class loader and the barrier around it holds. */
    LINK,

    /** The entry class is named and present. */
    ENTRY,

    /** The entry class was constructed. */
    INSTANTIATE,

    /** The extension's own registration ran and its providers are live. */
    REGISTER,
}

/** Watches a load stage by stage.
 *
 * A stage is reported only once it has finished, so a load that throws names the failing stage by
 * omission: the first stage never reported is where it died. That is the difference between
 * knowing an extension failed and knowing what part of the surface owes the fix.
 */
fun interface LoadWatch {

    fun reached(stage: LoadStage, detail: String)

    companion object {
        val NONE = LoadWatch { _, _ -> }
    }
}
