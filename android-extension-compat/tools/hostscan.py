"""Hosts named in an extension's own bytecode.

Reads the dex string pool of every archive given and keeps the entries that are a hostname or
carry one. Ranking is by how many distinct archives name the host, because a host two extensions
reach is two extensions' worth of streams.

Usage: python tools/hostscan.py samples/repo86/*.cs3
"""

import collections
import re
import sys
import zipfile

from dexscan import Dex

URL = re.compile(r"https?://([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
BARE = re.compile(r"^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$")

# Infrastructure an extension talks to for metadata, art or its own updates. None of these is ever
# handed to the extractor registry, so leaving them in the ranking buries the hosts that are.
NOT_A_VIDEO_HOST = {
    "api.themoviedb.org", "image.tmdb.org", "themoviedb.org", "www.themoviedb.org",
    "api.thetvdb.org", "thetvdb.org", "artworks.thetvdb.com",
    "graphql.anilist.co", "anilist.co", "api.jikan.moe", "myanimelist.net",
    "api.myanimelist.net", "kitsu.io", "kitsu.app", "api.simkl.com", "simkl.com",
    "api.trakt.tv", "trakt.tv", "api.mal.moe", "api.consumet.org",
    "github.com", "raw.githubusercontent.com", "api.github.com", "gitlab.com",
    "www.google.com", "google.com", "fonts.googleapis.com", "www.gstatic.com",
    "schemas.android.com", "developer.android.com", "android.com",
    "www.w3.org", "w3.org", "json-schema.org", "example.com", "localhost",
    "kotlinlang.org", "square.github.io", "jsoup.org", "www.apache.org", "apache.org",
    "creativecommons.org", "opensource.org", "purl.org", "xmlpull.org",
    "t.me", "telegram.me", "discord.gg", "discord.com",
    "fonts.gstatic.com", "translate.google.com", "gstatic.com", "googleapis.com",
    "api.github.io", "shields.io", "img.shields.io", "opencollective.com",
    "www.youtube.com/watch", "sun.com", "java.sun.com", "javax.xml.XMLConstants",
}


def strings_in(path):
    z = zipfile.ZipFile(path)
    out = []
    for name in z.namelist():
        if not name.endswith(".dex"):
            continue
        dx = Dex(z.read(name))
        for i in range(dx.string_ids_size):
            s = dx.string(i)
            if len(s) <= 400:
                out.append(s)
    return out


def urled(strings):
    """Hosts that appeared after a scheme, so the string is a url and the host is not a guess."""
    found = set()
    for s in strings:
        for m in URL.finditer(s):
            found.add(m.group(1).lower().strip("."))
    return found


def bare(strings, tlds):
    """Bare hostnames, kept only when their last label is a suffix the corpus itself uses in a url.

    Without that check a Kotlin filename and a reversed package name both read as a hostname, and
    they outrank the real hosts because every archive carries them.
    """
    found = set()
    for s in strings:
        t = s.strip().lower()
        if 4 < len(t) < 60 and BARE.match(t) and t.rsplit(".", 1)[-1] in tlds:
            found.add(t)
    return found


def registrable(host):
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    two = ".".join(parts[-2:])
    if parts[-2] in ("co", "com", "net", "org", "ac") and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return two


if __name__ == "__main__":
    pool = {}
    for path in sys.argv[1:]:
        short = path.replace("\\", "/").split("/")[-1]
        try:
            pool[short] = strings_in(path)
        except Exception as exc:
            print(f"# {short}: FAILED {exc}", file=sys.stderr)

    tlds = set()
    for strings in pool.values():
        for h in urled(strings):
            tlds.add(h.rsplit(".", 1)[-1])

    per_host = collections.defaultdict(set)
    for short, strings in pool.items():
        for h in urled(strings) | bare(strings, tlds):
            if h not in NOT_A_VIDEO_HOST:
                per_host[h].add(short)

    ranked = sorted(per_host.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    print(f"# {len(ranked)} hosts named across {len(pool)} archives, {len(tlds)} suffixes accepted")
    for host, who in ranked:
        print(f"{len(who):>3}\t{host}\t{','.join(sorted(who))}")
