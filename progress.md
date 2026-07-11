# Progress Log

## 2026-07-11

- Read the approved V2.1 plan and confirmed it satisfies the brainstorming design gate.
- Read required skill instructions for persistent planning, TDD, coding restraint, and frontend design.
- Inspected the workspace: empty, no Git repository, no existing implementation.
- Created persistent plan, findings, progress, and design specification files.
- Completed Phase 0: initialized Git and committed the approved design baseline (`39f3a7f`).
- Started Phase 1: M0 test contracts and vertical protocol spike.
- Completed M0-M5 vertical implementation: local API/SQLite workflow, OpenAI/TinEye providers, paired MV3 browser bridge, evidence governance, and responsive reference board.
- Closed the extension security audit findings and added API-side DNS resolution, session-bound permissions, safe capture checks, and sensitive-page exclusion.
- Added deterministic browser inspection with cropped nine-class visual analysis, partial-result preservation, TTL cleanup, and restart recovery.
- Current verification baseline: API 64 tests; extension 103 tests; board 21 tests. API lint/type checks and board lint/type/build are green.
- M6 remains in progress: clean-start smoke, persistent-Chrome E2E, final interaction persistence, and packaged demo evidence.
- Completed the secure relay configuration milestone: hidden PowerShell input, live Responses/web-search capability probe, transactional Windows Credential Manager storage, startup loading for both `gpt-5.5` clients, redacted health reporting, and deterministic Mock fallback.
- Verified the milestone with 79 API tests, 103 extension tests, 21 board tests, Python lint/type checks, PowerShell security-contract tests, dependency checks, and both production builds. The live relay probe remains intentionally pending until the user enters their own Key.
- Fixed the provider command's Windows PowerShell 5.1 encoding/parser failure reported from the real terminal, and added a cross-version parse regression test. The command now reaches its hidden Key prompt under the user's exact invocation.
- Removed the provider command's accidental `pnpm` dependency, verified its Python-only runtime resolution under PowerShell 7, and launched the user's exact command through the hidden Key prompt without entering a credential.
- Confirmed the user's real relay setup completed successfully: the live capability gate passed, the non-secret provider configuration is present, and the Windows credential entry exists. The API was not running during verification and will load the relay on its next start.
- Resumed M6 acceptance after interruption: restored the Board to 23/23 tests, zero lint/type errors and a successful production build; added complete styles for workspace creation, cancel/retry, errors, partial coverage, loading/empty states, missing previews and evidence locators.
- Started the real local API and Board on ports 8000/5173 and captured 1440/1024/390 screenshots with system Chrome. The layout has no page-level horizontal overflow; missing Demo drawing assets are the remaining visual blocker.
- Closed M5 Board acceptance: added two inspected CC0 drawings and five deterministic project-owned replay assets, truthful source/rights metadata, a local source manifest, full-image previews, responsive two/single-column layouts and automatic first-result inspection. Final 1440/1024/390 screenshots have zero console errors and no document-level overflow; Board remains green at 23 tests plus lint/type/build.
- Resumed M6 from the persisted plan after interruption. Closed the live-run restoration boundary: legacy asset descriptions now normalize to the nine-class enum, API results expose whether a local crop exists, the Board avoids nonexistent crop URLs, and terminal runs display their real status. API is green at 102 tests; Board is green at 25 tests plus lint/type checks.
- Expanded the final delivery gate so one command also validates PowerShell security/process contracts, deterministic evaluation fixtures and the packaged Chrome extension E2E. README now uses PowerShell 7 and links the architecture, failure cases, three demo flows and versioned evaluation datasets.
- Started the last browser-loop acceptance item: a deterministic full-stack replay using the real FastAPI WebSocket, packaged MV3 extension, fixed page inspection and persisted crop delivery. This remains in progress until its E2E passes.
- Closed the browser-loop acceptance item: a separate persistent Chrome profile pairs to a real temporary FastAPI server, inspects a fixed architecture page, captures a PNG, persists it to SQLite/workspace storage, serves it through the content API and revokes host access at terminal state. Uvicorn now declares its WebSocket runtime dependency.
- Completed the repository-wide delivery gate. `scripts/verify.ps1` passes 105 API tests, 25 Board tests, 111 extension tests, 6 packaged Chrome E2E cases, Python/TypeScript lint and type checks, both production builds, PowerShell security/process tests, and deterministic validation of 30 research tasks plus 108 classification samples.
- Added a versioned gpt-5.5 live smoke report with explicit source-recall results, duplicate/coverage counts, historical time-budget observation and the browser-unavailable limitation. No credential or private page data is recorded.
- Restarted the real local services after verification. API health reports the stored 梭子蟹 provider with `gpt-5.5`; the Board is available on port 5173 and historical legacy assets now restore through the normalized enum without nonexistent crop requests.
- Started M7 usability simplification after first-user screenshot feedback. The accepted direction preserves all research/evidence capabilities but changes the default interface to one primary prompt-and-results workflow with progressive disclosure for workspaces, evidence, comparison, StyleProfile, exports and Trace.
- Completed M7 usability simplification: removed permanent workspace/evidence/stage rails, reduced the result controls to one asset-type select, converted evidence and Trace to drawers, collapsed advanced research inputs, and exposed compare/export/style actions only when relevant. Cancel/retry remain directly available from the compact run status.
- Accepted the simplified Board at 1440/1024/390 px with four/three/one-column grids, no horizontal overflow, a full-width mobile evidence drawer, one non-duplicated analysis-diagram filter, and zero browser console warnings/errors.
- Re-ran the repository-wide delivery gate after the redesign: 105 API tests, 26 Board tests, 111 extension tests, 6 packaged Chrome E2E cases, all lint/type/build checks, PowerShell safety/process tests, and all 30/108 evaluation fixtures pass.
