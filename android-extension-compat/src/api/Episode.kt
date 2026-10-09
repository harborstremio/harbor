package com.lagradost.cloudstream3

class Episode(
    var data: String,
    var name: String? = null,
    var season: Int? = null,
    var episode: Int? = null,
    var posterUrl: String? = null,
    var score: Score? = null,
    var description: String? = null,
    var date: Long? = null,
    var runTime: Int? = null,
) {
    fun copy(
        data: String = this.data,
        name: String? = this.name,
        season: Int? = this.season,
        episode: Int? = this.episode,
        posterUrl: String? = this.posterUrl,
        score: Score? = this.score,
        description: String? = this.description,
        date: Long? = this.date,
        runTime: Int? = this.runTime,
    ): Episode = Episode(data, name, season, episode, posterUrl, score, description, date, runTime)

    override fun toString(): String = "Episode(s$season e$episode $name)"
}
