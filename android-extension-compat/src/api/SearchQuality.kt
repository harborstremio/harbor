package com.lagradost.cloudstream3

enum class SearchQuality {
    CamRip,
    Cam,
    Telesync,
    WorkPrint,
    Telecine,
    HQ,
    HD,
    HDR,
    BlueRay,
    DVD,
    SD,
    FourK,
    UHD,
    SDR,
    WebRip,
    // Appended rather than grouped next to Cam: an extension asks for this by name, quality
    // travels as that name, and keeping the existing ordinals stable costs nothing.
    HdCam,
}
