"""Build the per-add-on inventory from a saved, rendered official catalog.

Never infer coverage from a title or overwrite reviewed evidence on refresh.
Usage: python scripts/playnite-audit.py <firecrawl-catalog.json>
"""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


class Catalog(HTMLParser):
    def __init__(self):
        super().__init__()
        self.category = None
        self.item = None
        self.capture = None
        self.items = []
        self.link = None
        self.item_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        categories = {"addonsGameLibrary": "library", "addonsMetadataProvider": "metadata", "addonsGeneric": "generic", "addonsThemeDesktop": "theme", "addonsThemeFullscreen": "theme"}
        if tag == "div" and attrs.get("id") in categories:
            self.category = categories[attrs["id"]]
        if tag == "li" and self.item is not None:
            self.item_depth += 1
        if tag == "li" and "list-group-item" in attrs.get("class", "") and self.item is None:
            self.item = {"id": attrs["id"], "category": self.category, "name": "", "description": "", "sourceUrl": "", "links": []}
            self.item_depth = 1
        if self.item is None:
            return
        if tag == "h4":
            self.capture = "name"
        elif tag == "p" and attrs.get("class") == "addon-description":
            self.capture = "description"
        elif tag == "a":
            self.link = {"url": attrs.get("href", ""), "label": ""}

    def handle_data(self, data):
        if self.item is not None and self.capture:
            self.item[self.capture] += data
        if self.link is not None:
            self.link["label"] += data

    def handle_endtag(self, tag):
        if tag in ("h4", "p"):
            self.capture = None
        if tag == "a" and self.link is not None and self.item is not None:
            self.link["label"] = self.link["label"].strip()
            if self.link["label"] == "Source code":
                self.item["sourceUrl"] = self.link["url"]
            if self.link["url"].startswith("https://"):
                self.item["links"].append(self.link)
            self.link = None
        if tag == "li" and self.item is not None:
            self.item_depth -= 1
            if self.item_depth:
                return
            self.item["name"] = self.item["name"].strip()
            self.item["description"] = re.sub(r"\s+", " ", self.item["description"]).strip()
            self.items.append(self.item)
            self.item = None


def main():
    snapshot = Path(sys.argv[1])
    raw = snapshot.read_bytes()
    parser = Catalog()
    parser.feed(json.loads(raw)["html"])
    # Also guard the section markup: a missing category must never silently drop entries.
    if any(not item["category"] for item in parser.items):
        raise ValueError("Unrecognized catalog category")
    items = [item for item in parser.items if item["category"] != "theme"]
    headings = {"library": "Libraries", "metadata": "Metadata Sources", "generic": "Generic"}
    for category, label in headings.items():
        heading = re.search(re.escape(label) + r" \((\d+)\)", json.loads(raw)["markdown"])
        if not heading or int(heading.group(1)) != sum(item["category"] == category for item in items):
            raise ValueError(f"Catalog count mismatch: {category}")
    if len({item["id"] for item in items}) != len(items):
        raise ValueError("Duplicate catalog IDs")
    folder = Path(__file__).resolve().parents[1] / "docs/games/playnite"
    folder.mkdir(exist_ok=True)
    target = folder / "inventory.json"
    previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {"addons": []}
    old = {item["id"]: item for item in previous["addons"]}
    for item in items:
        item["review"] = old.get(item["id"], {}).get("review", {
            "status": "unreviewed", "sourceInspected": [], "behavior": [],
            "harborFiles": [], "tests": [], "gaps": [], "applicability": "undetermined"
        })
        if item["id"] in old and any(item[key] != old[item["id"]].get(key) for key in ("name", "description", "sourceUrl", "category")):
            item["review"] = {**item["review"], "status": "needs-review", "catalogChanged": True}
    digest = hashlib.sha256(raw).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    observed = {
        "source": "https://playnite.link/addons.html", "capturedAt": previous.get("capturedAt", now) if previous.get("snapshotSha256") == digest else now,
        "ledgerUpdatedAt": now, "snapshot": str(snapshot), "snapshotSha256": digest,
        "counts": {category: sum(item["category"] == category for item in items) for category in ("library", "metadata", "generic")},
        "excludedThemes": sum(item["category"] == "theme" for item in parser.items), "addons": items,
        "removedSincePreviousSnapshot": [item for item in previous["addons"] if item["id"] not in {entry["id"] for entry in items}]
    }
    target.write_text(json.dumps(observed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows = ["# Playnite non-theme add-on checklist", "", "Generated from inventory.json. Every row stays open until its behavior and applicable Harbor acceptance are evidenced. Theme exclusions do not exclude functionality merely packaged as a generic add-on.", "", "| Check | Category | Add-on | Review |", "| --- | --- | --- | --- |"]
    for item in items:
        name = item["name"].replace("|", "\\|")
        checked = "x" if item["review"]["status"] == "proven" else " "
        rows.append(f'| [{checked}] | {item["category"]} | [{name}](https://playnite.link/addons.html#{item["id"]}) | {item["review"]["status"]} |')
    (folder / "CHECKLIST.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(json.dumps({"counts": observed["counts"], "total": len(items), "excludedThemes": observed["excludedThemes"]}))


if __name__ == "__main__":
    main()
