package android.net

open class NetworkRequest {

    open class Builder {

        open fun addCapability(capability: Int): Builder = this

        open fun removeCapability(capability: Int): Builder = this

        open fun addTransportType(transportType: Int): Builder = this

        open fun removeTransportType(transportType: Int): Builder = this

        open fun build(): NetworkRequest = NetworkRequest()
    }
}
