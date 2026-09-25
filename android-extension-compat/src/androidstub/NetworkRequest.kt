package android.net

/** Describes which network an extension wants to be told about.
 *
 * The host never reads one: there is a single network here and no change to it to report, so a
 * request is a description that is built and then dropped. The builder is the shape extensions
 * actually write, so the calls have to answer with themselves and produce a request. */
open class NetworkRequest {

    open class Builder {

        open fun addCapability(capability: Int): Builder = this

        open fun removeCapability(capability: Int): Builder = this

        open fun addTransportType(transportType: Int): Builder = this

        open fun removeTransportType(transportType: Int): Builder = this

        open fun build(): NetworkRequest = NetworkRequest()
    }
}
