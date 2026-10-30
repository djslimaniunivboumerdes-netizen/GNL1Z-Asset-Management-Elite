#!/usr/bin/env python3
"""Rasterise every local P&ID sheet and run OCR over it once.

This is the *slow* half of the P&ID index pipeline and it is meant to be run
once per drawing revision — never at query time. It writes one JSON document per
sheet into the work directory so the Node builder (scripts/build-pid-index.mjs)
can turn it into src/data/pid_index.json.

    python3 -m venv .venv-pdf
    .venv-pdf/bin/pip install pymupdf rapidocr-onnxruntime
    .venv-pdf/bin/python scripts/ocr_pid_pages.py

The script is resumable: a sheet whose JSON already exists with the same PDF
sha256 is skipped, so re-running after adding drawings only pays for the new
ones.

Requires: pymupdf (rendering), rapidocr-onnxruntime (PP-OCR). Neither is a
dependency of the application — they live in the throw-away venv above.
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import sys
import time

DEFAULT_SRC = "public/pids"
DEFAULT_OUT = "pid_work/ocr"


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ocr_pdf(pdf_path: str, dpi: int, engine):
    import pymupdf

    pages = []
    with pymupdf.open(pdf_path) as doc:
        for index, page in enumerate(doc):
            pixmap = page.get_pixmap(dpi=dpi)
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                pixmap.save(tmp_path)
                result, _ = engine(tmp_path)
            finally:
                os.unlink(tmp_path)

            lines = []
            for row in result or []:
                box, text, score = row[0], row[1], row[2]
                try:
                    xs = [float(point[0]) for point in box]
                    ys = [float(point[1]) for point in box]
                    rect = [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]
                except Exception:  # pragma: no cover - defensive
                    rect = None
                lines.append({"t": text, "c": round(float(score), 3), "box": rect})
            pages.append({"page": index, "width": pixmap.width, "height": pixmap.height, "lines": lines})
    return pages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", default=DEFAULT_SRC, help="directory holding the P&ID PDFs")
    parser.add_argument("--out", default=DEFAULT_OUT, help="directory for the OCR JSON documents")
    parser.add_argument("--dpi", type=int, default=300, help="raster resolution (300 is the quality/speed compromise)")
    parser.add_argument("--min-confidence", type=float, default=0.35, help="drop OCR lines below this score")
    parser.add_argument("--limit", type=int, default=0, help="only process the first N sheets")
    args = parser.parse_args()

    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        print("missing OCR engine — run: .venv-pdf/bin/pip install pymupdf rapidocr-onnxruntime", file=sys.stderr)
        return 2

    os.makedirs(args.out, exist_ok=True)
    engine = RapidOCR()

    files = sorted(glob.glob(os.path.join(args.src, "*.pdf")))
    if args.limit:
        files = files[: args.limit]

    done = 0
    skipped = 0
    failed = 0
    for position, pdf_path in enumerate(files, start=1):
        name = os.path.basename(pdf_path)
        slug = os.path.splitext(name)[0].replace(" ", "-").replace("/", "-")
        out_path = os.path.join(args.out, f"{slug}.json")
        digest = sha256_of(pdf_path)

        if os.path.exists(out_path):
            try:
                with open(out_path, encoding="utf-8") as handle:
                    existing = json.load(handle)
                if existing.get("sha256") == digest:
                    skipped += 1
                    print(f"[{position}/{len(files)}] skip  {name}", flush=True)
                    continue
            except Exception:
                pass

        started = time.time()
        try:
            pages = ocr_pdf(pdf_path, args.dpi, engine)
        except Exception as error:  # pragma: no cover - defensive
            failed += 1
            print(f"[{position}/{len(files)}] FAIL  {name}: {error}", flush=True)
            continue

        total = 0
        for page in pages:
            page["lines"] = [line for line in page["lines"] if line["c"] >= args.min_confidence]
            total += len(page["lines"])

        document = {
            "file": f"/pids/{name}",
            "title": os.path.splitext(name)[0],
            "sha256": digest,
            "bytes": os.path.getsize(pdf_path),
            "dpi": args.dpi,
            "engine": "rapidocr-onnxruntime",
            "ocrAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "pages": pages,
        }
        with open(out_path, "w", encoding="utf-8") as handle:
            json.dump(document, handle, ensure_ascii=False)
        done += 1
        print(f"[{position}/{len(files)}] ocr   {name} — {total} lines in {time.time() - started:.0f}s", flush=True)

    print(f"\ndone={done} skipped={skipped} failed={failed} total={len(files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
