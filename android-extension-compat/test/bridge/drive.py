import json
import subprocess
import sys
import threading
import queue

java, jvm, classpath, data_dir, sample, broken = sys.argv[1:7]

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
    if condition:
        print("  ok   %s" % label)
    else:
        print("  FAIL %s %s" % (label, detail))
        failures.append(label)


def send(rid, method, **params):
    proc.stdin.write(json.dumps({"id": rid, "method": method, "params": params}) + "\n")
    proc.stdin.flush()


reverse = []


def take(timeout=180):
    while True:
        frame = frames.get(timeout=timeout)
        if frame is None:
            raise SystemExit("bridge closed its output early")
        if "host" in frame:
            reverse.append(frame)
            continue
        return frame


def call(rid, method, **params):
    send(rid, method, **params)
    frame = take()
    check("%s answered with its own id" % method, frame.get("id") == rid, frame)
    return frame


def result(frame):
    return frame.get("result") or {}


def code(frame):
    return (frame.get("error") or {}).get("code")


print("ping")
frame = call("1", "ping")
check("ping ok", frame.get("ok") is True and result(frame).get("pong") is True, frame)
check("ping reports protocol", isinstance(result(frame).get("protocol"), int), frame)

print("a line that is not JSON")
proc.stdin.write("this is not json\n")
proc.stdin.flush()
frame = take()
check("garbage rejected", frame.get("ok") is False and frame["error"]["code"] == "bad_request", frame)

print("install a real extension while pinging, to prove requests do not queue")
send("2", "install", path=sample)
send("3", "ping")
first = take()
second = take()
check("ping overtook the slow install", first.get("id") == "3", [first.get("id"), second.get("id")])
check("install ok", second.get("ok") is True, second)
installed = second.get("result") or {}
extension_id = installed.get("id")
provider_id = (installed.get("providers") or [None])[0]
check("install named its entry class", bool(installed.get("entryClass")), installed)
check("install reported a provider", bool(provider_id), installed)
check("install reported an empty unavailable list",
      installed.get("unavailable") == [], installed.get("unavailable"))

print("providers")
frame = call("4", "providers")
providers = result(frame).get("providers") or []
check("provider listed", len(providers) >= 1, providers)
check("provider carries a name and a url",
      providers and providers[0].get("name") and providers[0].get("mainUrl"), providers)
check("provider id matches the install", providers and providers[0]["id"] == provider_id, providers)

print("extensions")
frame = call("5", "extensions")
listed = result(frame).get("extensions") or []
check("one extension installed", len(listed) == 1, listed)

print("catalogue")
frame = call("c1", "catalogue", providerId=provider_id)
check("catalogue ok", frame.get("ok") is True, frame)
rows = result(frame).get("rows")
check("catalogue answered a rows array", isinstance(rows, list), frame)
check("catalogue reports the provider's own flag",
      isinstance(result(frame).get("hasMainPage"), bool), frame)
check("every row carries a name, a payload and both flags",
      all(isinstance(r.get("name"), str) and r["name"]
          and isinstance(r.get("data"), str)
          and isinstance(r.get("horizontalImages"), bool)
          and isinstance(r.get("declared"), bool) for r in (rows or [])), rows)

frame = call("c2", "catalogue", providerId="nope/nope")
check("catalogue on an unknown provider", code(frame) == "provider_not_found", frame)
frame = call("c3", "cataloguePage", providerId=provider_id)
check("cataloguePage with no row named", code(frame) == "bad_request", frame)
frame = call("c4", "cataloguePage", providerId=provider_id, row="no such row here")
check("cataloguePage with a row the provider does not have", code(frame) == "bad_request", frame)

if rows:
    frame = call("c5", "cataloguePage", providerId=provider_id, row=rows[0]["name"], page=1)
    check("cataloguePage ok", frame.get("ok") is True, frame)
    page = result(frame)
    check("cataloguePage echoes the row it fetched", page.get("row") == rows[0]["name"], page)
    check("cataloguePage echoes the page", page.get("page") == 1, page)
    check("cataloguePage reports hasNext", isinstance(page.get("hasNext"), bool), page)
    sections = page.get("sections")
    check("cataloguePage answered a sections array", isinstance(sections, list), page)
    check("every section carries a name and an items array",
          all(isinstance(s.get("name"), str) and isinstance(s.get("items"), list)
              for s in (sections or [])), sections)
    items = [i for s in (sections or []) for i in s["items"]]
    check("every browsed item is shaped like a search result",
          all(isinstance(i.get("name"), str) and isinstance(i.get("url"), str) for i in items), items[:3])
    other = rows[0]["name"].upper() if rows[0]["name"].islower() else rows[0]["name"].lower()
    frame = call("c6", "cataloguePage", providerId=provider_id, row=other)
    check("a row name matches without regard to case", frame.get("ok") is True, frame)
    check("the echoed row is the provider's own spelling",
          result(frame).get("row") == rows[0]["name"], result(frame))
else:
    print("  note this provider declares no rows, so the page checks have nothing to fetch")

print("a url the provider cannot use costs only its own request")
frame = call("6", "load", providerId=provider_id, url="not-a-url://nowhere")
if frame.get("ok") is False:
    message = (frame.get("error") or {}).get("message", "")
    check("error carries a message", bool(message), frame.get("error"))
    check("error is a single line", "\n" not in message, frame.get("error"))
else:
    check("nothing found is reported as nothing found",
          result(frame).get("found") is False, frame)
    check("nothing found with nothing refused carries no note",
          result(frame).get("note") is None, result(frame).get("note"))
frame = call("7", "ping")
check("process still answering", frame.get("ok") is True, frame)

print("bad arguments and bad names")
frame = call("8", "search", providerId="nope/nope", query="x")
check("unknown provider", code(frame) == "provider_not_found", frame)
frame = call("9", "frobnicate")
check("unknown method", code(frame) == "unknown_method", frame)
frame = call("10", "load", providerId=provider_id)
check("missing parameter", code(frame) == "bad_request", frame)

print("a file that is not an extension")
frame = call("11", "install", path=broken)
check("bad install refused", frame.get("ok") is False, frame)
frame = call("12", "extensions")
check("bad install left nothing behind", len(result(frame).get("extensions") or []) == 1, frame)

print("uninstall")
frame = call("13", "uninstall", id=extension_id)
check("uninstall ok", frame.get("ok") is True, frame)
check("file removed", result(frame).get("fileRemoved") is True, frame)
frame = call("14", "providers")
check("no providers left", len(result(frame).get("providers") or []) == 0, frame)

print("reverse requests")
check("every reverse request named a method and an id",
      all(f.get("host") and f.get("id") for f in reverse), reverse)
check("none of them could be read as a response",
      all("ok" not in f for f in reverse), reverse)

print("shutdown")
frame = call("15", "shutdown")
check("shutdown acknowledged", frame.get("ok") is True, frame)
check("process exited", proc.wait(timeout=20) == 0, proc.returncode)

print("BRIDGE TEST %s, %d checks failed" % ("ok" if not failures else "FAILED", len(failures)))
sys.exit(1 if failures else 0)
