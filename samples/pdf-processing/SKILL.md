---
name: pdf-processing
description: Extract text from PDFs, fill forms, and merge multiple files. Use when the user mentions PDFs, forms, document extraction, or needs to work with PDF files.
license: MIT
compatibility: Requires Python 3.11+ and the pypdf2 package
metadata:
  author: example-org
  version: "1.0"
---

## Overview

This skill handles all common PDF operations including text extraction, form filling, and file merging.

## Instructions

### Extracting text from a PDF

1. Identify the target PDF file path from the user's message.
2. Run the extraction script: `scripts/extract.py <file_path>`
3. Present the extracted text to the user, preserving the original structure.
4. If the file is password-protected, ask the user for the password before proceeding.

### Filling PDF forms

1. Ask the user to provide the form field names and values if not already given.
2. Run: `scripts/fill_form.py <file_path> --fields '<json>'`
3. Save the filled form as `<original_name>_filled.pdf` in the same directory.

### Merging PDFs

1. Collect all file paths to merge from the user.
2. Run: `scripts/merge.py <file1> <file2> ... --output merged.pdf`
3. Confirm successful merge and report the output file path.

### Reference & Troubleshooting

Consult `references/guide.md` for form field schemas, encryption rules, and batch processing guidelines.

## Edge Cases

- Do NOT attempt to edit PDFs that appear to be digitally signed.
- For scanned PDFs (image-based), warn the user that text extraction may be inaccurate.
- Maximum merge size: 50 files. For larger batches, suggest splitting into groups.

## Out of Scope

This skill does NOT:
- Convert PDFs to other formats (use a dedicated conversion skill)
- Perform OCR on scanned documents
- Edit or annotate PDF content directly
