# PDF Processing Reference Guide

This reference guide provides operational instructions, schemas, and troubleshooting steps for the `pdf-processing` skill.

## 1. Supported Form Field Schemas

When filling PDF forms via `scripts/fill_form.py`, pass field data formatted as a JSON string:

```json
{
  "full_name": "Jane Doe",
  "email_address": "jane.doe@example.com",
  "signature_date": "2026-10-24",
  "opt_in_newsletter": true
}
```

### Supported Field Types
- **Text Box**: Accepts plain text strings or numeric values.
- **Checkbox**: Accepts boolean values (`true` / `false`) or `"Yes"` / `"Off"`.
- **Radio Buttons**: Pass the string key matching the radio option.
- **Dropdown List**: Pass the exact string matching an available option value.

## 2. Password Handling & Encryption

If a target PDF is encrypted or password-protected:
1. Identify whether user encryption requires an owner password or a user password.
2. Prompt the user explicitly for credentials before triggering script execution.
3. Never log or output passwords to console streams or trajectory traces.

## 3. Large File Handling & Batch Merging

- **File Size Limit**: Single files exceeding 100 MB should be checked with `pdfinfo` prior to loading.
- **Batching**: Merging more than 50 files simultaneously should be partitioned into sequential batches of 25 files to preserve memory headroom.

## 4. Troubleshooting Common Errors

| Error Code / Symptom | Root Cause | Recommended Action |
|---|---|---|
| `PdfReadError: EOF marker not found` | Corrupted download or truncated file | Prompt user to verify the source file integrity. |
| `KeyError: '/AcroForm'` | PDF does not contain interactive form fields | Clarify to the user that this document is flat and cannot be programmatically filled. |
| `PermissionError: Write denied` | Output destination is write-protected | Write to user-specified working directory or append timestamp. |
