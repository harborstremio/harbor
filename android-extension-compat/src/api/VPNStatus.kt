package com.lagradost.cloudstream3

/** Whether an extension expects a VPN to reach the site it scrapes.
 *
 * A provider declares this so the app can warn a user before a load fails rather than after. The
 * shim has no VPN to report on and cannot act on the answer, so this exists to be declared and
 * stored: the values are inert here.
 *
 * It has to exist as a class all the same. Providers hold one as a field and read it back through a
 * getter, so the constant is resolved while the provider is constructed — before any of its own code
 * runs — and its absence fails the whole load rather than one feature of it.
 *
 * All three constants are declared, not only the one extensions were seen using. A provider is
 * written against the real API, so one that says `None` or `Torrent` is as valid as one that says
 * `MightBeNeeded`, and an enum missing them would turn a working extension into a failed install. */
enum class VPNStatus {
    None,
    MightBeNeeded,
    Torrent,
}
