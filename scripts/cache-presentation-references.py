#!/usr/bin/env python3
"""Cache unmodified source images for a private, offline gallery export."""

import argparse
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import re
import urllib.request

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    # Application diagrams have their own routes and original aspect ratios; reuse the byte cache without mixing them into slide styles.
    parser.add_argument("--catalog", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    catalog_path = args.catalog.resolve() if args.catalog else root / "design-library/presentation-references/catalog.json"
    catalog_bytes = catalog_path.read_bytes()
    catalog = json.loads(catalog_bytes)
    cache = args.cache.resolve()
    manifest_path = cache / "cache.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"images": {}}
    pages = {page["url"]: page for case in catalog["cases"] for page in case["pages"]}

    def inspect(data, page):
        # Curated architecture references bind the exact inspected original, not merely its advertised dimensions.
        if page.get("sha256") and hashlib.sha256(data).hexdigest() != page["sha256"]:
            raise ValueError("Source image differs from the inspected original")
        with Image.open(io.BytesIO(data)) as picture:
            picture.load()
            if picture.format not in {"PNG", "JPEG", "WEBP"}:
                raise ValueError("Unsupported image format")
            if picture.size != (page["width"], page["height"]):
                raise ValueError(f"Source dimensions differ: {picture.size}")
            return {"width": picture.width, "height": picture.height,
                    "mime": Image.MIME[picture.format], "format": picture.format.lower()}

    def fetch(entry):
        url, page = entry
        if not url.startswith("https://"):
            raise ValueError("Expected HTTPS source")
        # Unpublished generated figures cannot be downloaded from main yet; read only repository-contained, hash-bound originals.
        local_data = None
        if page.get("local_asset"):
            asset = Path(page["local_asset"])
            if asset.is_absolute():
                raise ValueError("Local original must use a repository-relative path")
            source = (root / asset).resolve(strict=True)
            if not source.is_relative_to(root) or not source.is_file():
                raise ValueError("Local original escaped the repository")
            if not isinstance(page.get("sha256"), str) or not re.fullmatch(r"[a-f0-9]{64}", page["sha256"]):
                raise ValueError("Local original requires an inspected byte hash")
            if source.stat().st_size > 32 * 1024 * 1024:
                raise ValueError("Source image exceeds the cache limit")
            local_data = source.read_bytes()
            inspect(local_data, page)
        record = previous["images"].get(url)
        if record:
            path = cache / record["path"]
            if not path.resolve().is_relative_to(cache) or path.is_symlink():
                raise ValueError("Unsafe cached image path")
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != record["sha256"]:
                raise ValueError(f"Cached image changed: {page['title']}")
            inspect(data, page)
            return url, record, None
        if args.check:
            raise ValueError(f"Missing cached image: {page['title']}")
        if local_data is not None:
            data = local_data
        else:
            request = urllib.request.Request(url, headers={"User-Agent": "StoryWeave-offline-reference-viewer"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024:
            raise ValueError("Source image exceeds the cache limit")
        properties = inspect(data, page)
        relative = f"images/{hashlib.sha256(url.encode()).hexdigest()}.{properties['format']}"
        path = cache / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.parent.is_symlink():
            raise ValueError("Refusing a linked image directory")
        temporary = path.with_suffix(path.suffix + ".part")
        temporary.write_bytes(data)
        os.replace(temporary, path)
        return url, {"path": relative, "sha256": hashlib.sha256(data).hexdigest(),
                     "bytes": len(data), **properties}, "local" if local_data is not None else "remote"

    images, errors, downloaded, copied_local = {}, [], 0, 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch, entry): entry[0] for entry in pages.items()}
        for future in concurrent.futures.as_completed(futures):
            try:
                url, record, new = future.result()
                images[url] = record
                downloaded += int(new == "remote")
                copied_local += int(new == "local")
            except Exception as error:
                errors.append({"url": futures[future], "error": str(error)})
    manifest = {"schema_version": 1, "catalog_sha256": hashlib.sha256(catalog_bytes).hexdigest(),
                "images": dict(sorted(images.items()))}
    if not args.check:
        cache.mkdir(parents=True, exist_ok=True)
        temporary = manifest_path.with_suffix(".json.part")
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        os.replace(temporary, manifest_path)
    print(json.dumps({"result": "fail" if errors else "pass", "images": len(images),
                      "expected": len(pages), "downloaded": downloaded,
                      "copied_local": copied_local,
                      "bytes": sum(item["bytes"] for item in images.values()),
                      "errors": errors}, ensure_ascii=False))
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
