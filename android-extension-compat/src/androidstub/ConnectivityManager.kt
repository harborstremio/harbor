package android.net

/** The connectivity service, reached through Context.getSystemService.
 *
 * Registrations are accepted and dropped. Accepting them is the point: an extension that wires up
 * a connectivity callback while it starts would otherwise fail to load over a signal a desktop has
 * no way to produce. Nothing is held, so there is nothing to leak and nothing that could fire
 * later at a moment the extension did not ask for. */
open class ConnectivityManager {

    /** What extensions subclass. On a device this is called when the network comes and goes. */
    open class NetworkCallback {
        open fun onAvailable(network: Network) {}
    }

    open fun registerNetworkCallback(request: NetworkRequest, callback: NetworkCallback) {}

    open fun unregisterNetworkCallback(callback: NetworkCallback) {}
}
