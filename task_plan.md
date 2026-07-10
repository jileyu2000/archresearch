# ArchResearch V2.1 Implementation Plan

## Goal

Build the approved local-first architecture research agent: a Chrome MV3 extension, a local FastAPI research executor, and a visual research board. The runtime must use live web research without a platform case library or global vector index.

## Success Criteria

- A user can create a workspace, add text/image/PDF/URL inputs, and start a persisted research run.
- The run follows a deterministic state machine, streams progress, and preserves partial results.
- OpenAI and TinEye have real adapters plus deterministic mock implementations.
- The Chrome extension pairs locally, requests/revokes optional host permissions, and executes only the approved browser action DSL.
- Results expose evidence tiers, saved/rejected actions, comparison, exports, and optional style extraction.
- API, board, and extension tests pass; lint/type checks/builds pass; README documents a local demo.

## Phases

| Phase | Status | Verification |
|---|---|---|
| 0. Persist approved design and initialize repository | in_progress | Design doc, planning files, git repository |
| 1. M0 contract tests and vertical protocol spike | pending | API/extension contract tests fail then pass |
| 2. M1 local API, SQLite models, uploads, state machine | pending | Pytest API/model suite |
| 3. M2 research planner, search, TinEye, trace | pending | Provider/loop tests with mocks |
| 4. M3 Chrome extension browser asset pipeline | pending | Vitest and extension build |
| 5. M4 evidence, ranking, recovery, partial delivery | pending | Workflow integration tests |
| 6. M5 visual board, save/reject/compare/export/style | pending | Vitest, accessibility checks, board build |
| 7. M6 fixtures, E2E smoke, docs, full verification | pending | Full test/lint/type/build matrix |

## Decisions

- React + Vite instead of Next.js: the board is a local SPA with no SSR requirement.
- FastAPI + SQLAlchemy + SQLite; no PostgreSQL, Redis, S3, Celery, Docker, Qdrant, LangGraph, or multi-agent runtime.
- Direct OpenAI Responses API with strict schemas; custom local trace to control sensitive data.
- TinEye is required for reverse-image lookup when a key is present; mock/fallback behavior remains runnable without keys.
- All browser commands are enumerated JSON messages; no arbitrary selectors, JavaScript, credentials, social actions, or general form submission.
- Temporary candidates expire after 7 days; run metadata/trace after 30 days; explicit saves persist until deletion.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Workspace was not a git repository | 1 | Initialize after persisting the approved design |

