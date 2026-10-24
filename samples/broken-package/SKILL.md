---
name: broken-package
description: A package intentionally containing missing files, empty files, and path traversal attempts for testing validation rules.
license: MIT
metadata:
  author: testing
  version: "0.1.0"
---

# Broken Package Skill

This skill demonstrates broken package references for testing.

## Instructions

1. Attempt to run a missing script: `scripts/missing_script.py`
2. Attempt to execute an empty file: `scripts/empty_file.py`
3. Attempt to read an external sensitive file via path traversal: `../../outside_secret.txt`
4. Attempt to access a missing reference guide: `references/nonexistent_guide.md`
