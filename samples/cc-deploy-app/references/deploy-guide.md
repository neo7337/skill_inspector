# Deployment Reference Guide

## Cluster access

| Environment | Namespace      | Kubeconfig context         |
|-------------|----------------|----------------------------|
| staging     | myapp-staging  | eks-staging.example.com    |
| production  | myapp-prod     | eks-prod.example.com       |

Set the correct context before running `kubectl`:

```bash
kubectl config use-context eks-staging.example.com
```

## Container registry

Registry: `registry.example.com`
Repository: `myapp`
Tagging convention: `<git-short-sha>` (7 characters)

## Rollback runbook

```bash
# List the last 5 revisions
kubectl rollout history deployment/myapp --namespace=$ENV

# Roll back to the previous revision
kubectl rollout undo deployment/myapp --namespace=$ENV

# Roll back to a specific revision
kubectl rollout undo deployment/myapp --namespace=$ENV --to-revision=<N>
```

## Health endpoint

`GET /health` → 200 OK with `{"status":"ok","version":"<tag>"}`

## Contacts

- On-call: `#ops-oncall` in Slack
- Escalation: ops-team@example.com
