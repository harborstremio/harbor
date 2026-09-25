"""Drives the bridge over stdin and stdout the way the desktop app will, against real extensions.

Every check here is a property the Rust side depends on: one response per request id, an error
frame that carries a message rather than a trace, a failure that costs only its own request, and a
second request answered while a slow one is still running.
"""
import json
import subprocess
import sys
import threading
import queue

java, classpath, data_dir, sample, broken = sys.argv[1:6]

proc = subprocess.Popen(
    [java, "-cp", classpath, "com.harbor.capstan.bridge.Bridge", "--data-dir", data_dir],
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
    """The next response. A frame carrying `host` is a request to this side, not an answer to
    anything asked, so it is recorded and stepped over the way a client with no browser does."""
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

print("a url the provider cannot use costs only its own request")
frame = call("6", "load", providerId=provider_id, url="not-a-url://nowhere")
# A provider that simply finds nothing is not an error. Either shape is correct here, so what is
# checked is that the frame is well formed and that the message never carries a stack trace, which
# is the property the Rust side actually depends on.
if frame.get("ok") is False:
    message = (frame.get("error") or {}).get("message", "")
    check("error carries a message", bool(message), frame.get("error"))
    check("error is a single line", "\n" not in message, frame.get("error"))
else:
    check("nothing found is reported as nothing found",
          result(frame).get("found") is False, frame)
    # The note is a claim about the service, so it is only ever attached when an address the
    # provider uses actually refused. A url the provider never fetched must carry none.
    check("nothing found with nothing refused carries no note",
          result(frame).get("note") is None, result(frame).get("note"))
frame = call("7", "ping")
check("process still answering", frame.get("ok") is True, frame)

print("bad arguments and bad names")


def code(frame):
    """The error code, or None when the bridge answered ok. Never raises, so one wrong
    answer is reported as one failed check instead of ending the run."""
    return (frame.get("error") or {}).get("code")


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
