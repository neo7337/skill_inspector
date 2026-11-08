# Contributing

Thanks for your interest in Skill Inspector!

## Setup
```bash
make install   # backend + frontend dependencies
make dev       # run backend and frontend
```

## Before opening a PR
```bash
make test                          # backend pytest suite
cd frontend && npm run lint && npx tsc -b && npm test
ruff check backend/ --select E9,F63,F7,F82
```
- Add tests for new validation rules or endpoints.
- Update `CHANGELOG.md` under a new version heading.
- Keep PRs focused; describe the motivation and how you tested.

## Reporting bugs / ideas
Open a GitHub issue with reproduction steps (sample `SKILL.md` if relevant).
Security issues: see [SECURITY.md](SECURITY.md).

By contributing you agree your work is licensed under the MIT License.

## Releasing
1. Bump `__version__` in `backend/app/__init__.py` (the single source of truth).
2. Add a CHANGELOG entry.
3. Tag the release: `git tag vX.Y.Z && git push --tags`.
