#!/usr/bin/env python3
"""Check reference delivery bytes without claiming browser or design-quality coverage."""

import argparse
import base64
import hashlib
import io
import json
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image


class Gallery(HTMLParser):
    def __init__(self):
        super().__init__()
        self.style = None
        self.page = None
        self.images = []
        self.external_resources = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "article":
            self.style = attrs["id"]
        if tag == "details" and "data-page" in attrs:
            self.page = attrs["data-page"]
        if tag == "img" and self.page:
            self.images.append({"style": self.style, "page": self.page, **attrs})
        if tag == "script" and attrs.get("src"):
            self.external_resources.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.external_resources.append(attrs.get("href"))

    def handle_endtag(self, tag):
        if tag == "details":
            self.page = None
        if tag == "article":
            self.style = None


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--offline", type=Path, required=True)
    parser.add_argument("--installed", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    catalog_bytes = (args.repo / "design-library/presentation-references/catalog.json").read_bytes()
    catalog = json.loads(catalog_bytes)
    cases = sorted(catalog["cases"], key=lambda case: not case["technical_priority"])
    expected = [(case, page) for case in cases for page in case["pages"]]
    lightweight = args.repo / "skills/storyweave-imagegen/assets/reference-library"
    filenames = {"index.html", "catalog.json", "coverage.json"}
    files = {str(path.relative_to(lightweight)) for path in lightweight.rglob("*") if path.is_file()}
    check(files == filenames, "Unexpected distributed reference asset; raw images belong in private caches")
    installed_root = args.installed / "assets/reference-library"
    installed_files = {str(path.relative_to(installed_root)) for path in installed_root.rglob("*") if path.is_file()}
    check(installed_files == filenames, "Unexpected installed reference asset")
    distribution = []
    for name in sorted(filenames):
        data = (lightweight / name).read_bytes()
        check(data == (args.installed / "assets/reference-library" / name).read_bytes(),
              f"Installed reference asset differs: {name}")
        distribution.append({"path": name, "bytes": len(data), "sha256": digest(data)})
    remote = Gallery()
    remote.feed((lightweight / "index.html").read_text())
    check(len(remote.images) == len(expected), "Distributed content-page count differs")
    for image, (case, page) in zip(remote.images, expected):
        check((image["style"], image["page"], image["src"]) == (case["id"], page["id"], page["url"]),
              "Distributed image identity or source differs")
    check("data:image/" not in (lightweight / "index.html").read_text(),
          "Offline image bytes leaked into the distributed gallery")

    manifest_bytes = (args.cache / "cache.json").read_bytes()
    cache = json.loads(manifest_bytes)
    check(cache["catalog_sha256"] == digest(catalog_bytes), "Cache catalog is stale")
    offline = Gallery()
    offline_bytes = (args.offline / "index.html").read_bytes()
    offline.feed(offline_bytes.decode())
    check(not offline.external_resources, "Offline gallery has external runtime resources")
    check(len(offline.images) == len(expected), "Offline content-page count differs")
    rows = []
    for image, (case, page) in zip(offline.images, expected):
        identity = f'{case["id"]}/{page["id"]}'
        check((image["style"], image["page"]) == (case["id"], page["id"]), f"Wrong image: {identity}")
        record = cache["images"][page["url"]]
        cached_path = (args.cache / record["path"]).resolve(strict=True)
        check(cached_path.is_relative_to(args.cache.resolve()), f"Cache path escapes root: {identity}")
        cached = cached_path.read_bytes()
        check(len(cached) == record["bytes"] and digest(cached) == record["sha256"],
              f"Cached bytes changed: {identity}")
        header, encoded = image["src"].split(",", 1)
        check(header == f'data:{record["mime"]};base64', f"Image is not embedded: {identity}")
        embedded = base64.b64decode(encoded, validate=True)
        check(embedded == cached, f"Embedded bytes differ: {identity}")
        with Image.open(io.BytesIO(embedded)) as picture:
            picture.load()
            check(picture.size == (page["width"], page["height"]), f"Wrong dimensions: {identity}")
            check(Image.MIME[picture.format] == record["mime"], f"Wrong MIME: {identity}")
        check(image.get("loading") == ("eager" if page is case["pages"][0] else "lazy"),
              f"Initial loading policy differs: {identity}")
        rows.append({"id": identity, "url": page["url"], "sha256": digest(embedded),
                     "bytes": len(embedded), "width": page["width"], "height": page["height"],
                     "roles": page["roles"], "decoded": True})
    check((args.offline / "catalog.json").read_bytes() == catalog_bytes, "Offline catalog differs")
    coverage = json.loads((args.offline / "coverage.json").read_text())
    expected_roles = {role["id"]: sum(role["id"] in page["roles"] for _, page in expected)
                      for role in catalog["roles"]}
    check(coverage["totals"]["styles"] == len(cases)
          and coverage["totals"]["content_pages"] == len(expected)
          and coverage["totals"]["by_role"] == expected_roles, "Coverage totals differ from actual pages")
    check(len(rows) == len({row["url"] for row in rows}), "A source image is counted twice")
    result = {"status": "pass", "coverage": "bytes-and-image-decode-only", "browser_verified": False,
              "network_used": False, "styles": len(cases), "images": len(rows), "by_role": expected_roles,
              "catalog_sha256": digest(catalog_bytes), "cache_manifest_sha256": digest(manifest_bytes),
              "offline_html": {"bytes": len(offline_bytes), "sha256": digest(offline_bytes)},
              "distribution": {"files": distribution, "bytes": sum(row["bytes"] for row in distribution),
                               "raw_images": 0, "embedded_images": 0}, "images_decoded": rows}
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "images_decoded"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
