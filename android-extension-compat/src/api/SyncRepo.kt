package com.lagradost.cloudstream3.syncproviders

import com.lagradost.cloudstream3.ErrorLoadingException

class SyncRepo(val api: SyncAPI?) {

    fun authUser(): AuthUser? = null

    suspend fun library(): Result<SyncAPI.LibraryMetadata?> {
        val account = api ?: return Result.failure(ErrorLoadingException("no sync account connected"))
        return try {
            Result.success(account.library())
        } catch (t: Throwable) {
            Result.failure(t)
        }
    }
}
