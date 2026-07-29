# Repository Instructions

## Session Recovery

- At the start of a new conversation, read `HANDOFF.md` completely before taking project actions.
- Then read active phases in `task_plan.md` and the recent ends of `findings.md` and `progress.md`; search older history only when needed.
- Treat the working tree as user-owned state. Never reset, overwrite, or clean existing changes during recovery.
- Update `HANDOFF.md` only when the architecture, verified baseline, or single next action materially changes.

## Scope

- Preserve the approved local-first ArchResearch V2.1 system and build the separately
  deployed Cloudflare Web Edition only within its explicit product contract.
- The local edition remains Windows/Chrome, BYOK, SQLite, and local filesystem based.
  Web Edition code, storage, provider credentials, and deployment configuration must
  not change those defaults.
- The Web Edition may use Cloudflare Workers, Workflows, Durable Objects, R2, Browser
  Rendering, Turnstile, and Rate Limiting for bounded execution, temporary checkpoints,
  abuse protection, and exact cost gating. Long-term user history remains browser-local.
- Do not add a platform case library, global vector index, Qdrant, PostgreSQL, Redis, S3, Celery, Docker, LangGraph, or multi-agent runtime.
- Keep provider calls behind small concrete clients with deterministic mocks.
- Never publish the Web Edition URL in GitHub repository content, releases, or repository
  metadata. It is a private submission link even though anyone holding it may use it.

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
