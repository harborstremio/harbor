package com.lagradost.cloudstream3

data class Actor(
    val name: String,
    val image: String? = null,
)

enum class ActorRole {
    Main,
    Supporting,
    Background,
}

data class ActorData(
    val actor: Actor,
    val role: ActorRole? = null,
    val roleString: String? = null,
    val voiceActor: Actor? = null,
)
