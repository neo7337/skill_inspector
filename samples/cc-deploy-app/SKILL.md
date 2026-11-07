---
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

If the user passed an argument (e.g. `/deploy-app production`), use that value.
Otherwise, default to `staging` and tell the user.

Valid environments: `staging`, `production`.
If the argument is anything else, stop and ask the user to clarify.

### 2 — Build and push the Docker image

```bash
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t registry.example.com/myapp:$IMAGE_TAG .
docker push registry.example.com/myapp:$IMAGE_TAG
```

Report the image tag once the push completes.

### 3 — Roll out to Kubernetes

```bash
kubectl set image deployment/myapp \
  myapp=registry.example.com/myapp:$IMAGE_TAG \
  --namespace=$ENV
kubectl rollout status deployment/myapp --namespace=$ENV --timeout=120s
```

If the rollout times out, run `kubectl rollout undo deployment/myapp --namespace=$ENV` to revert and tell the user.

### 4 — Smoke test

After a successful rollout, hit the health endpoint:

```bash
kubectl run smoke-test --rm -it --restart=Never \
  --image=curlimages/curl -- \
  curl -sf https://$ENV.example.com/health
```

Report `✅ Deployment succeeded` on HTTP 200, or `❌ Health check failed` and the HTTP status otherwise.

### Reference

See `references/deploy-guide.md` for cluster credentials, registry URLs, namespace naming conventions, and rollback runbooks.

## Edge Cases

- Do NOT deploy to `production` without first confirming with the user, even if explicitly requested in the argument.
- If `git rev-parse` fails (not inside a git repo), stop and ask the user for the image tag to use.
- Never overwrite the `:latest` tag in production — always use the commit SHA.
