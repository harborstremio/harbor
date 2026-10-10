"""Fetch every extension archive the named repositories publish.

A repository is two hops: repo.json lists pluginLists, each of which is a JSON array of entries
carrying a url to a .cs3. Archives land in samples/corpus, deduplicated by content hash, and
samples/corpus/index.json records which repository each came from so a host can be traced back to
a publisher rather than to a filename.
"""

import concurrent.futures
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "samples", "corpus")


# Two forges here answer a browser user agent with a block page rather than the file: codeberg
# with "Codeberg is not a CDN.", disroot with an interstitial that is served as a 200. Both serve
# the real bytes to a plain client, so every fetch tries the browser agent and then the plain one,
# and a json fetch keeps going until a body actually parses.
AGENTS = (UA, "curl/8.9.1")


def fetch(url, agent, tries=2):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(quote(url), headers={"User-Agent": agent, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
            if body.strip() == b"Codeberg is not a CDN.":
                raise ValueError("codeberg refused this agent")
            return body
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def quote(url):
    head, _, tail = url.partition("://")
    host, _, path = tail.partition("/")
    return f"{head}://{host}/{urllib.parse.quote(path)}" if path else url


def get(url):
    last = None
    for agent in AGENTS:
        try:
            return fetch(url, agent)
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def jget(url):
    last = None
    for agent in AGENTS:
        try:
            return json.loads(fetch(url, agent).decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def safe(name):
    keep = "".join(c if (c.isalnum() or c in "-_.") else "_" for c in name)
    return keep[:80] or "plugin"


def walk_repo(repo_url):
    """(repo name, [(plugin list url, [entry, ...])]) for one repository."""
    doc = jget(repo_url)
    if isinstance(doc, list):
        entries = [e for e in doc if isinstance(e, dict) and e.get("url")]
        return repo_url.rsplit("/", 3)[-3] if "/" in repo_url else repo_url, [(repo_url, entries)]
    lists = doc.get("pluginLists") or []
    out = []
    for lurl in lists:
        try:
            entries = jget(lurl)
        except Exception as e:  # noqa: BLE001
            print(f"  plugin list FAILED {lurl}: {e}")
            continue
        if isinstance(entries, dict):
            entries = entries.get("plugins") or []
        out.append((lurl, [e for e in entries if isinstance(e, dict) and e.get("url")]))
    return doc.get("name") or repo_url, out


def main():
    repos = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
    os.makedirs(CORPUS, exist_ok=True)
    jobs = []
    seen_urls = set()
    for repo_url in repos:
        try:
            rname, lists = walk_repo(repo_url)
        except Exception as e:  # noqa: BLE001
            print(f"repo FAILED {repo_url}: {e}")
            continue
        n = sum(len(x[1]) for x in lists)
        print(f"repo {rname}: {len(lists)} list(s), {n} plugin(s)")
        for lurl, entries in lists:
            for e in entries:
                u = e["url"]
                if u in seen_urls:
                    continue
                seen_urls.add(u)
                jobs.append((repo_url, rname, lurl, e))

    print(f"\n{len(jobs)} distinct archive urls to fetch")
    by_hash = {}
    records = []
    failures = []

    def fetch(job):
        repo_url, rname, lurl, e = job
        try:
            return job, get(e["url"]), None
        except Exception as ex:  # noqa: BLE001
            return job, None, str(ex)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for i, (job, data, err) in enumerate(pool.map(fetch, jobs), 1):
            repo_url, rname, lurl, e = job
            name = e.get("internalName") or e.get("name") or "plugin"
            if err:
                failures.append({"name": name, "url": e["url"], "repo": rname, "error": err})
                print(f"[{i}/{len(jobs)}] FAIL {name}: {err}")
                continue
            h = hashlib.sha256(data).hexdigest()
            rec = {
                "name": name,
                "displayName": e.get("name"),
                "repo": rname,
                "repoUrl": repo_url,
                "pluginList": lurl,
                "url": e["url"],
                "sha256": h,
                "size": len(data),
                "version": e.get("version"),
                "authors": e.get("authors") or [],
                "tvTypes": e.get("tvTypes") or [],
                "language": e.get("language"),
            }
            if h in by_hash:
                rec["duplicateOf"] = by_hash[h]
                rec["file"] = by_hash[h]
                records.append(rec)
                continue
            fn = f"{safe(name)}.cs3"
            path = os.path.join(CORPUS, fn)
            k = 2
            while os.path.exists(path):
                fn = f"{safe(name)}-{k}.cs3"
                path = os.path.join(CORPUS, fn)
                k += 1
            with open(path, "wb") as fh:
                fh.write(data)
            by_hash[h] = fn
            rec["file"] = fn
            records.append(rec)

    index = {
        "repos": repos,
        "urls": len(jobs),
        "archives": len(by_hash),
        "duplicates": sum(1 for r in records if "duplicateOf" in r),
        "failures": failures,
        "entries": sorted(records, key=lambda r: (r["repo"], r["name"])),
    }
    with open(os.path.join(CORPUS, "index.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(index, fh, indent=1)
    print(f"\narchives {len(by_hash)}  urls {len(jobs)}  duplicates {index['duplicates']}  failures {len(failures)}")


if __name__ == "__main__":
    main()
