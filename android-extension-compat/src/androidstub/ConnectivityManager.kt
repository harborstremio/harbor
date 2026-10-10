package android.net

open class ConnectivityManager {

    open class NetworkCallback {
        open fun onAvailable(network: Network) {}
    }

    open fun registerNetworkCallback(request: NetworkRequest, callback: NetworkCallback) {}

    open fun unregisterNetworkCallback(callback: NetworkCallback) {}
}
