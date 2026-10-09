"""Original larger payloads for process-termination tests; pycdlib==1.14.0.

Separate from generate.py so regenerating these does not replace the qualified
small corpus. Gzip is transport only; the production engine receives real ISO.
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import pycdlib

root = Path(__file__).parent
payload = bytes(range(256)) * (2 * 1024 * 1024 // 256)
manifest = {"generator": "pycdlib 1.14.0", "payloadBytes": len(payload),
            "payloadSha256": hashlib.sha256(payload).hexdigest(), "images": []}
for name, options in [("recovery-iso", {}), ("recovery-udf", {"udf": "2.60"})]:
    disc = pycdlib.PyCdlib()
    disc.new(interchange_level=3, joliet=3, vol_ident="HARBOR_RECOVERY", **options)
    paths = {"iso_path": "/PAYLOAD.BIN;1", "joliet_path": "/Payload 雨.bin"}
    if options:
        paths["udf_path"] = "/Payload 雨.bin"
    disc.add_fp(io.BytesIO(payload), len(payload), **paths)
    output = io.BytesIO()
    disc.write_fp(output)
    disc.close()
    data = output.getvalue()
    compressed = gzip.compress(data, mtime=0)
    (root / (name + ".iso.gz")).write_bytes(compressed)
    manifest["images"].append({"name": name, "bytes": len(data),
                               "gzipBytes": len(compressed), "sha256": hashlib.sha256(data).hexdigest()})
(root / "recovery-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
