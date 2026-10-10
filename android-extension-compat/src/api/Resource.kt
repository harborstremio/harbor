package com.lagradost.cloudstream3.mvvm

sealed class Resource<out T> {
    data class Success<out T>(val value: T) : Resource<T>()

    data class Failure(
        val isNetworkError: Boolean,
        val errorCode: Int?,
        val errorResponse: Any?,
        val errorString: String
    ) : Resource<Nothing>()

    data class Loading(val url: String? = null) : Resource<Nothing>()
}
