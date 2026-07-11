# Repository Instructions

## Scope

- Build only the approved local-first ArchResearch V2.1 system.
- Do not add a platform case library, global vector index, Qdrant, PostgreSQL, Redis, S3, Celery, Docker, LangGraph, or multi-agent runtime.
- Keep provider calls behind small concrete clients with deterministic mocks.

## Engineering

- Use PowerShell 7 (`pwsh`) for project commands by default. Use Windows PowerShell (`powershell`) only for explicit compatibility tests.
- Write a failing behavior test before production code.
- Use Pydantic models as the backend schema source and generate/align TypeScript contracts.
- Keep the browser protocol enumerated; never accept executable code, arbitrary selectors, credentials, social actions, or general form submission.
- Bind formal facts to source evidence. Keep provenance separate from rights status.
- Preserve partial results and checkpoint state after each workflow stage.

## Verification

- Python: lint, type check, unit tests, integration tests.
- TypeScript: lint, type check, unit tests, production builds.
- Extension: manifest validation and browser protocol tests.
- Never require live provider keys for the default test suite or demo.
