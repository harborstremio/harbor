package com.lagradost.cloudstream3.plugins

/** Marks the class the host must instantiate when it opens an extension file. Retained at runtime
 * because that is how the loader finds it. */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class CloudstreamPlugin
