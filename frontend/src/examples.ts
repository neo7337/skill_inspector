export const VALID_SKILL_EXAMPLE = `---
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
2. Run the extraction script: \`scripts/extract.py <file_path>\`
3. Present the extracted text to the user, preserving the original structure.
4. If the file is password-protected, ask the user for the password before proceeding.

### Filling PDF forms

1. Ask the user to provide the form field names and values if not already given.
2. Run: \`scripts/fill_form.py <file_path> --fields '<json>'\`
3. Save the filled form as \`<original_name>_filled.pdf\` in the same directory.

### Merging PDFs

1. Collect all file paths to merge from the user.
2. Run: \`scripts/merge.py <file1> <file2> ... --output merged.pdf\`
3. Confirm successful merge and report the output file path.

## Edge Cases

- Do NOT attempt to edit PDFs that appear to be digitally signed.
- For scanned PDFs (image-based), warn the user that text extraction may be inaccurate.
- Maximum merge size: 50 files. For larger batches, suggest splitting into groups.

## Out of Scope

This skill does NOT:
- Convert PDFs to other formats (use a dedicated conversion skill)
- Perform OCR on scanned documents
- Edit or annotate PDF content directly
`

export const BROKEN_SKILL_EXAMPLE = `---
name: PDF-Processing
description: Helps with PDFs.
metadata:
  author: example-org
  count: 42
custom-field: this-is-not-valid
---
`

// ── Claude Code / plugin examples ──────────────────────────────────────────

export const CC_VALID_SKILL_EXAMPLE = `---
name: cc-deploy-app
description: Deploy a web application to staging or production. Use when the user says "deploy", "ship", "release", or mentions an environment like staging or prod. Accepts an optional [env] argument (staging|production); defaults to staging.
license: MIT
compatibility: Requires Docker, kubectl, and access to the cluster kubeconfig.
metadata:
  author: example-org
  version: "2.1"
allowed-tools:
  - Bash(kubectl *)
  - Bash(docker build *)
  - Bash(docker push *)
  - Read
  - Write
argument-hint: "[env]"
user-invocable: true
disable-model-invocation: false
context: fork
model: sonnet
effort: low
---

## Overview

This skill deploys a containerised web application to Kubernetes. It builds the Docker image, pushes it to the registry, and rolls out the new version to the requested environment.

## Instructions

### 1 — Determine the target environment

If the user passed an argument (e.g. \`/deploy-app production\`), use that value.
Otherwise, default to \`staging\` and tell the user.

Valid environments: \`staging\`, \`production\`.

### 2 — Build and push the Docker image

\`\`\`bash
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t registry.example.com/myapp:$IMAGE_TAG .
docker push registry.example.com/myapp:$IMAGE_TAG
\`\`\`

### 3 — Roll out to Kubernetes

\`\`\`bash
kubectl set image deployment/myapp \\
  myapp=registry.example.com/myapp:$IMAGE_TAG \\
  --namespace=$ENV
kubectl rollout status deployment/myapp --namespace=$ENV --timeout=120s
\`\`\`

If the rollout times out, run \`kubectl rollout undo\` to revert and notify the user.

## Edge Cases

- Do NOT deploy to \`production\` without first confirming with the user.
- Never overwrite the \`:latest\` tag in production — always use the commit SHA.
`

export const CC_BROKEN_SKILL_EXAMPLE = `---
name: Deploy-App
description: short
allowed-tools:
  - Bash(kubectl *)
  - 42
user-invocable: yes
effort: turbo
unknown-cc-field: should-not-be-here
---
`
