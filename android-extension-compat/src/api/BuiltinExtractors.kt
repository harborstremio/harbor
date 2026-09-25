package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.utils.ExtractorApi

/** Every extractor the layer ships with, in priority order.
 *
 * This list is the registry. To support a new host: add a class, usually one line extending
 * EmbedPlayerExtractor, then add one instance here. An extension can add its own at runtime with
 * registerExtractor, and the generic reader still runs for anything nobody has written a class
 * for, so an unknown embed is never silently dropped.
 *
 * Some hosts the samples reach are deliberately absent, because an entry that claims a host and
 * can only ever return empty reads as coverage the user does not have, while the generic reader
 * makes the same attempt without the claim. Measured 2026-09-24: streamlare.com serves a parking
 * page, filemoon.to serves the fingerprint and proof of work gated frontend, mkissa.to is a
 * site rather than a file host, whose pages carry no media url and are assembled by script that
 * deliberately defeats interception, and videobin.co has kept its zone but publishes no address
 * record, with no successor domain of that name serving the same ids. */
fun builtinExtractors(): List<ExtractorApi> = listOf(
    // the byse frontend, ten domains on one api. Ahead of the page readers below because two of
    // these domains are also claimed by a page reader that cannot work on this frontend.
    ByseLapuix(),
    ByseKoze(),
    ByseSukior(),
    ByseVepoin(),
    ByseWihe(),
    ByseZejataos(),
    FilemoonByse(),
    FilemoonToByse(),
    FilemoonIn(),
    Gn1r5n(),

    // wish family
    StreamWishTo(),
    StrwishCom(),
    Hlswish(),
    Flaswish(),
    Wishembed(),
    Swiftplayers(),
    Embedwish(),
    Sfastwish(),

    // vidstack players. vidwish and vidtube are named after the wish family but are served by
    // this engine, which is what the extensions shipping their own copies of them do too.
    MegaPlay(),
    MegaPlayOne(),
    Vidwish(),
    VidTube(),
    VidStackIo(),
    UnsBio(),

    // file hosts
    Voe(),
    Filemoon(),
    Mp4Upload(),
    StreamSB(),
    MixDrop(),
    VidHide(),
    DoodStream(),
    DoodLi(),
    PlayMogo(),
    MyVidPlay(),
    OkRu(),

    // sites that are their own host
    Dailymotion(),
    DailyMotionShort(),
    DailyMotionGeo(),
    InternetArchive(),
    Invidious(),
    YoutubeExtractor(),
    YoutubeShort(),
    YoutubeNoCookie(),
    TwitchExtractor(),
    TwitchPlayer(),
)
