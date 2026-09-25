package android.webkit

interface ValueCallback<T> {
    fun onReceiveValue(value: T?)
}
