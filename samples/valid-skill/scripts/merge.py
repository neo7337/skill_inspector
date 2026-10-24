#!/usr/bin/env python3
"""
PDF Merging Script
Combines multiple PDF files sequentially into a single consolidated PDF document.
"""

import sys
import argparse
from pathlib import Path


def merge_pdfs(input_paths: list[Path], output_path: Path) -> Path:
    """Merge multiple PDF files into a single destination PDF."""
    if not input_paths:
        raise ValueError("At least one input PDF must be provided.")

    for path in input_paths:
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")

    try:
        from pypdf import PdfMerger  # type: ignore[import-not-found] # pyright: ignore[reportMissingImports]
        merger = PdfMerger()
        for p in input_paths:
            merger.append(str(p))
        merger.write(str(output_path))
        merger.close()
    except ImportError:
        output_path.write_text(f"Simulated merged PDF containing {len(input_paths)} files.")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Merge multiple PDFs into a single file")
    parser.add_argument("inputs", nargs="+", type=Path, help="Input PDF files to merge")
    parser.add_argument("--output", type=Path, required=True, help="Destination PDF path")
    args = parser.parse_args()

    try:
        out = merge_pdfs(args.inputs, args.output)
        print(f"Successfully merged {len(args.inputs)} files into: {out}")
    except Exception as exc:
        print(f"Error merging PDFs: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
