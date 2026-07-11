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
| 0. Persist approved design and initialize repository | complete | Design doc, planning files, git repository |
| 1. M0 contract tests and vertical protocol spike | complete | Live gpt-5.5 search plus deterministic provider/vision/TinEye contracts and a real FastAPI-to-MV3 crop evidence card pass |
| 2. M1 local API, SQLite models, uploads, state machine | complete | Local foundation, PDF text context, checkpoints, recovery, TTL, SSE/WebSocket and launch lifecycle pass |
| 3. M2 research planner, search, TinEye, trace | complete | Three goals, budgets, bounded queries, provider clients, deduplication, trace and failure delivery pass |
| 4. M3 Chrome extension browser asset pipeline | complete | 111 unit tests and 6 packaged persistent-Chrome E2E cases cover pairing, assets, capture, hostile pages, revoke and reconnect |
| 5. M4 evidence, ranking, recovery, partial delivery | complete | Evidence binding, conservative tiers, stable ranking, cancellation, retry and partial preservation pass |
| 6. M5 visual board, save/reject/compare/export/style | complete | Real lifecycle/persistence/export contracts pass; responsive Board and evidence inspector accepted at 1440/1024/390 px |
| 7. M6 fixtures, E2E smoke, docs, full verification | implementation_complete | One-command verification passes; live smoke record, 30 tasks, 108 samples, docs, demos and real browser-crop replay are delivered |

## M6 completion summary

1. Real provider/run loop complete: timeout reserve, deadline/cancellation, structured-search compatibility, partial delivery and a versioned gpt-5.5 smoke record.
2. Durable workbench complete: real workspaces, restoration/polling, evidence detail, save/reject/note, comparison Board, StyleProfile and rights-filtered exports.
3. Browser loop complete: real FastAPI WebSocket pairing, packaged MV3 page inspection, PNG crop persistence, content delivery, permission revoke and disconnect recovery.
4. Evaluation/delivery complete: security fixtures, 30 research tasks, 108 deterministic classification samples, clean launcher, full verification, README, architecture/failure notes and three demos.

## External acceptance gates

The code delivery is complete. These product claims require user-owned credentials, paid/live execution, rights-cleared data or human participants and are intentionally not fabricated by the implementation:

- Run the TinEye live capability check after the user supplies a TinEye Key.
- Execute the 30 versioned tasks against changing live websites and add human relevance/source labels; this is opt-in because it costs money.
- Collect 100+ independently sourced, rights-cleared real drawing samples before claiming real-image classification accuracy; the delivered 108 samples are deterministic synthetic fixtures.
- Conduct the planned six-student usability study and record collection behavior.
- Load the packaged ArchResearch extension in the user's normal Chrome profile for a final logged-in-site acceptance run.

## Decisions

- React + Vite instead of Next.js: the board is a local SPA with no SSR requirement.
- FastAPI + SQLAlchemy + SQLite; no PostgreSQL, Redis, S3, Celery, Docker, Qdrant, LangGraph, or multi-agent runtime.
- Direct OpenAI Responses API with strict schemas; custom local trace to control sensitive data.
- Research and visual classification default to `gpt-5.5`; both remain environment-overridable.
- The `suoxie` relay key is accepted only through hidden PowerShell input, tested before commit, and stored in Windows Credential Manager; provider JSON contains no secret.
- Project automation defaults to PowerShell 7 (`pwsh`); Windows PowerShell 5.1 is used only for explicit compatibility checks.
- TinEye is required for reverse-image lookup when a key is present; mock/fallback behavior remains runnable without keys.
- All browser commands are enumerated JSON messages; no arbitrary selectors, JavaScript, credentials, social actions, or general form submission.
- Temporary candidates expire after 7 days; run metadata/trace after 30 days; explicit saves persist until deletion.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Workspace was not a git repository | 1 | Initialize after persisting the approved design |
| Initial commit lacked Git author identity | 1 | Set repository-local `Codex <codex@local>` identity and committed successfully |
| Bundled Python lacked FastAPI | 1 | Require app-local dependency installation from `apps/api/pyproject.toml`; keep tests independent of global packages |
| Board subtask hit transient model capacity | 1 | Resume from the existing TDD files with a replacement subtask; no work was discarded |
| Board proxy used port 8765 while API/extension used 8000 | 1 | Add a configuration test and unify the default; startup script can inject alternate ports |
| Extension security audit found unsafe generic clicks and capture/privacy races | 1 | Disable untrusted clicks, tighten sensitive-page filtering, verify capture tabs, bind permissions to sessions, and add API DNS resolution |
| Windows PowerShell 5.1 misparsed UTF-8 Chinese strings in the provider script | 1 | Make the executable script ASCII-safe and add parser tests for Windows PowerShell 5.1 and PowerShell 7 |
| Provider setup incorrectly required pnpm through the full workspace runtime resolver | 1 | Split out Python-only runtime resolution and cover it independently; provider setup now depends only on the API Python environment |
| First live Quick run remained inside one provider search with no local timeout | 1 | Add an SDK request timeout, enforce the run deadline between calls, and preserve cancellation/partial checkpoints before repeating the live smoke |
| One-click stop tracked launcher PIDs while Python/Vite child processes owned the ports | 1 | Harden shutdown to resolve and verify workspace-owned listener processes before stopping the process tree |
| Bundled Playwright package referenced browser files that were not installed | 2 | Use the system Chrome executable for deterministic local screenshot and extension E2E runs; do not download browsers at runtime |
| Initial M6 Board screenshot showed all Demo cards without visual assets | 1 | Treat usable local drawing previews and bounded desktop preview height as Board acceptance requirements |
| Planning recovery called the disabled Windows Store `python` alias | 1 | Run the catch-up script with `apps/api/.venv/Scripts/python.exe`; keep project commands on the resolved workspace runtime |
| Board lint rejected synchronous restoration resets inside a React effect | 1 | Move reset/loading transitions to explicit workspace-selection actions and keep the effect limited to asynchronous restoration |
| Real Chrome capture rejected HTTP/HTTPS wildcard host permissions | 1 | Request optional `<all_urls>` only for the task lifetime, retain public-HTTP(S)-only navigation/injection checks, and revoke at every terminal path |
| Uvicorn started without a WebSocket protocol implementation | 1 | Add the concrete `websockets` runtime dependency and cover pairing through a real network server |
| Full-stack page inspection completed with zero captured candidates | 1 | Trace the real Chrome error to host permission semantics, keep crop bounds strict, and verify PNG persistence after the scoped permission fix |
