# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub's
[private vulnerability reporting](https://github.com/neo7337/skill_inspector/security/advisories/new)
rather than opening a public issue. Expect an initial response within a few days.

## Scope notes

- Skill Inspector reads LLM provider API keys (OpenAI, Anthropic) from environment variables / `.env`. Never commit them.
- The backend is a local development server (FastAPI). Do not expose it to untrusted networks.
- The documented installer uses `curl | bash`; review `install/install.sh` before running it.
- Skill packages are read from disk with path-traversal protection; reports of bypasses are in scope.
