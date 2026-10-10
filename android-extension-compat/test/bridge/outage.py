import json
import queue
import subprocess
import sys
import threading

java, jvm, classpath, data_dir = sys.argv[1:5]
archives = sys.argv[5:]

proc = subprocess.Popen(
    [java, jvm, "-cp", classpath, "com.harbor.capstan.bridge.Bridge", "--data-dir", data_dir],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None,
    text=True, encoding="utf-8", bufsize=1,
)

frames = queue.Queue()


def pump():
    for line in proc.stdout:
        line = line.strip()
        if line:
            frames.put(json.loads(line))
    frames.put(None)


threading.Thread(target=pump, daemon=True).start()

failures = []


def check(label, condition, detail=""):
    print("  %s %s %s" % ("ok  " if condition else "FAIL", label, "" if condition else detail))
    if not condition:
        failures.append(label)


def call(rid, method, **params):
    proc.stdin.write(json.dumps({"id": rid, "method": method, "params": params}) + "\n")
    proc.stdin.flush()
    while True:
        frame = frames.get(timeout=300)
        if frame is None:
            raise SystemExit("bridge closed its output early")
        if "host" in frame:
            continue
        if frame.get("id") == rid:
            return frame


def result(frame):
    return frame.get("result") or {}


rid = 0


def nxt():
    global rid
    rid += 1
    return str(rid)


for archive in archives:
    frame = call(nxt(), "install", path=archive)
    check("installed %s" % archive.rsplit("\\", 1)[-1], frame.get("ok") is True, frame)

providers = result(call(nxt(), "providers")).get("providers") or []
check("every installed provider is listed", len(providers) >= len(archives), providers)

for provider in providers:
    name = provider["name"]
    print("\n=== %s  (%s)" % (name, provider.get("mainUrl")))
    frame = call(nxt(), "search", providerId=provider["id"], query="moon", timeoutMs=120000)
    if frame.get("ok") is not True:
        check("%s search answered" % name, False, frame)
        continue
    found = result(frame)
    results = found.get("results") or []
    note = found.get("note")
    print("  search   %d results" % len(results))
    if results:
        check("%s search: no note when the service answered" % name, note is None, note)
    else:
        print("  note     %s" % note)
        check("%s search: empty answer names the service" % name, isinstance(note, str) and note, note)
        continue

    url = results[0]["url"]
    frame = call(nxt(), "load", providerId=provider["id"], url=url, timeoutMs=120000)
    loaded = result(frame)
    print("  load     found=%s  %s" % (loaded.get("found"), url))
    if loaded.get("found") is not True:
        print("  note     %s" % loaded.get("note"))
        check("%s load: empty answer names the service" % name,
              isinstance(loaded.get("note"), str) and loaded.get("note"), loaded.get("note"))
        continue
    check("%s load: no note when the page loaded" % name, loaded.get("note") is None, loaded.get("note"))

    data = loaded["result"].get("playableData") or (
        (loaded["result"].get("episodes") or [{}])[0].get("data")
    )
    frame = call(nxt(), "loadLinks", providerId=provider["id"], data=data, timeoutMs=120000)
    links = result(frame)
    count = len(links.get("links") or [])
    print("  links    %d" % count)
    if count == 0:
        print("  note     %s" % links.get("note"))
    else:
        check("%s links: no note when links came back" % name, links.get("note") is None, links.get("note"))
        print("  first    %s" % (links["links"][0]["url"][:110]))

call(nxt(), "shutdown")
proc.wait(timeout=30)
print("\nOUTAGE GATE %s, %d checks failed" % ("ok" if not failures else "FAILED", len(failures)))
sys.exit(1 if failures else 0)
