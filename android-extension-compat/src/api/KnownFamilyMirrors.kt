package com.lagradost.cloudstream3.extractors

class LuluVdo : LuluStream() {
    override val name = "LuluStream"
    override val mainUrl = "https://luluvdo.com"
}

/* The Lulu family as CloudStream names it.
 *
 * An extension registers these by CloudStream's class name — `Lulustream1` is what the provider
 * imports, not whatever the host happens to call the same mirror — so a family with only the host's
 * own names in it fails to load rather than failing to extract. Each is the same extractor pointed
 * at a different host, which is all CloudStream's own definitions are. */
class Lulustream1 : LuluStream() {
    override val name = "Lulustream"
    override val mainUrl = "https://lulustream.com"
}

class Lulustream2 : LuluStream() {
    override val name = "Lulustream"
    override val mainUrl = "https://kinoger.pw"
}

class Luluvdoo : LuluStream() {
    override val name = "LuluStream"
    override val mainUrl = "https://luluvdoo.com"
}

class DoodstreamCom : DoodLaExtractor() {
    override val name = "DoodStream"
    override val mainUrl = "https://doodstream.com"
}

class ByseMfw09 : Byse("Byse", "https://mfw09.org")

class MiiixDrop : MixDrop() {
    override val name = "MixDrop"
    override val mainUrl = "https://miiixdrop.net"
}

class VidmolyNet : Vidmoly() {
    override val name = "Vidmoly"
    override val mainUrl = "https://vidmoly.net"
}

class VVide0 : DoodStream() {
    override val name = "DoodStream"
    override val mainUrl = "https://vvide0.com"
}
