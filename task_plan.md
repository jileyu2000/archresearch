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
| 8. M7 Board usability simplification | complete | One prompt-and-results workflow, contextual evidence/tools, 1440/1024/390 acceptance, 26 Board tests and repository-wide verification pass |
| 9. M8 Mature-product visual redesign | complete | Mature-product study, global DESIGN.md, ordered digital pin-up wall, modal accessibility, 1440/1024/390 acceptance, zero design-detector findings and full repository verification pass |
| 10. M9 Problem-first home and result separation | complete | Completed runs no longer replace the default question composer; explicit “查看上次结果 / 发起新研究” transitions pass 27 Board tests and live-browser acceptance |
| 11. M10 Useful research-workbench home | complete | One composer, three research paths, four problem starters and lazy-loaded recent runs pass 1280/1024/700/390 browser acceptance, workspace-race regression tests and the full repository gate |
| 12. M11 Livelier studio identity | complete | Product-first motion study, blueprint task island, global visual/motion rules, 1440/1024/700/390 acceptance, zero design-detector findings and the full repository gate |
| 13. M12 Global architectural studio canvas | complete | One global 128px drafting canvas, 1760/1600px responsive composition, route-specific plan/section fragments, 2048/1440/1024/700/390 acceptance, 39 Board tests and the full repository gate |
| 14. M13 Research prompt vertical proportion | complete | Semantic 152/132/108px prompt heights, 2048/1440/1024/700/390 visual acceptance, zero detector findings and 40 Board tests |
| 15. M14 Research answer and method comparison | complete | Result task provenance, evidence-backed method summary and five-row comparison matrix pass 1440/390 browser acceptance and 40 Board tests |
| 16. M15 Decomposed deep research dossiers | complete | Post-audit depth, evidence, retry, durable traffic and retention boundaries pass 137 API tests, 41 Board tests, 111 Extension tests, 6 packaged-Chrome E2E cases and the full repository gate |
| 17. M16 Chinese research results and reliable previews | complete | Chinese provider contracts, browser readiness/pairing, conservative crop enrichment and truthful legacy recovery pass 141 API tests, 45 Board tests, 111 Extension tests, 6 packaged-Chrome E2E cases and 1440/390 Chromium acceptance |
| 18. M17 Local runtime and extension onboarding reliability | complete | Loopback-only one-click pairing, authenticated connection state, Chinese fallback controls and research-time permission requests pass 141 API tests, 48 Board tests, 118 Extension tests and 6 packaged-Chrome E2E cases |
| 19. M18 Open-source browser research integration | complete | Audited eight current GitHub projects; integrated an optional Firecrawl public-page fallback and bounded semantic page snapshot; full gate passes 157 API, 48 Board, 121 Extension and 6 packaged-Chrome tests without live provider traffic |
| 20. M19 Direct browser-research enrichment | complete | Configured public sources are parsed once in the normal path; bounded Markdown improves visual classification and typed image leads improve recall; full gate passes 159 API, 48 Board, 121 Extension and 6 packaged-Chrome tests without live provider traffic |
| 21. M20 Live architecture research acceptance | in_progress | Complete one Board-started Balanced run with temporary Chrome permission; verify real crops, Chinese decomposition, live sources, evidence boundaries and result-page usability without treating direct-API permission errors as product failures |
| 22. M21 Direct Firecrawl source discovery | complete | All four Firecrawl searches survive a real gpt-5.5 timeout/skip sequence; clean live output contains only unique highest-quality image variants and zero malformed URLs; full repository gate passes |
| 23. M22 Search-quality refinement | complete | Concise subquestion queries raise a clean live run from 2 to 8 assets, 1 to 2 source pages and add a section; shared media paths remove the observed cross-CDN duplicate; 164 API tests and the full repository gate pass |
| 24. M23 Bounded remote visual classification | complete | Firecrawl 的未分类图片按每次运行最多 1 批、每批最多 4 张交给 gpt-5.5 低细节结构化分类；只保存有直接可见中文观察且相关性不低于 2 的 visual lead；调用前断点保证重试不重复计费；全仓 173 API、53 Board、122 Extension 与 6 E2E 通过 |
| 25. M24 Stable active-research UI and honest browser onboarding | complete | Active zero-result runs retain the submitted question, current stage and evidence questions; public research remains available without Chrome; status-first pairing and packaged-Chrome E2E distinguish unsupported surfaces from a working extension bridge |
| 26. M25 Public-image mode and Chrome enhancement clarity | complete | Public previews and Chrome crops are labeled separately; fixed loopback handoff auto-pairs; a strict 20-second MV3 heartbeat kept the real user-profile connection active across ten samples over 45 seconds |
| 27. M26 Quick-path performance and timeout isolation | complete | OpenAI worst-case search wait fell from 120s to 30s with a per-run timeout circuit; Firecrawl page waits are capped at 20s; the comparable live Quick run fell from about 194s to 143s before the final Firecrawl cap, and the full repository gate passes |
| 28. M27 Project-page expansion and evidence promotion | complete | One-hop same-host project links are capped at two and consume the existing page/deadline budget; exact child-page image evidence promotes visual leads in place to partial with URL-bound claims while primary source and rights stay unknown; full 177/53/122/6 repository gate passes |
| 29. M28 Result diagnosis and release-quality acceptance | complete | Recent runs and result headers translate stop/gap codes into compact Chinese diagnosis and next action; live Balanced run 0c8fa2aa produced 5 useful images across 2 concrete projects with 5 partial results; full 177/54/122/6 gate passes |
| 30. M29 Semantic research depth and fair subquestion coverage | complete | Depth is defined by 3×2 / 4×3 / 6×4 decomposition and pass contracts, per-question drawing targets and progressive analysis obligations; complete-round stopping, persisted pass counts, Chinese UI choices and the full 170/52/122/6 repository gate pass |
| 31. M30 Self-explanatory result tools | complete | “结果工具” groups compare/organize, export and process review; every action states its outcome and disabled prerequisite, user-facing Trace jargon is removed, and the full 170/53/122/6 gate passes |
| 32. M31 Promote result-use entry | complete | The result header now makes “整理与导出” the filled primary action, previews 对照/规范/导出 before opening, keeps new research secondary, collapses cleanly on mobile, and passes the full 170/53/122/6 gate |
| 33. M32 Persistent result workbench | complete | The top-right menu is replaced by a full-width in-page workbench exposing compare, style, private/share export and process review directly; 1440/390 acceptance, disabled guidance, zero detector findings and the full 170/53/122/6 gate pass |
| 34. M33 Completion-first research and final user-flow audit | complete | Completion and enrichment are separate; uncovered branches receive a dedicated recovery pass and per-branch page capacity; honest partial delivery, 739px browser acceptance, 186/62/124/6 verification and three real Quick limitations are recorded |
| 35. M34 Complete-answer delivery and portfolio demos | complete | All depth modes share one evidence-complete delivery floor and 30-minute safety ceiling; uncovered branches get three recovery rounds and resumable continuation; Firecrawl retains a 100-credit default reserve; three no-cost replay demos and the full 189/66/124/6 gate pass |
| 36. M35 intent-aware inspiration sources and real portfolio acceptance | implementation_complete | XHS is a default, account-authorized visual source beside authoritative architecture research; Pinterest remains opt-in link evidence; provider credits remain reserved for signed-in XHS acceptance and three final real-result screenshots |
| 37. M36 release preflight and real portfolio capture | in_progress | Clarify Chrome/XHS launch readiness without exposing internal quota management; accept one bounded signed-in XHS check; lock three showcase tasks; then capture real Quick/Balanced/Deep result pages while Codex preserves the Firecrawl reserve |

## M6 completion summary

1. Real provider/run loop complete: timeout reserve, deadline/cancellation, structured-search compatibility, partial delivery and a versioned gpt-5.5 smoke record.
2. Durable workbench complete: real workspaces, restoration/polling, evidence detail, save/reject/note, comparison Board, StyleProfile and rights-filtered exports.
3. Browser loop complete: real FastAPI WebSocket pairing, packaged MV3 page inspection, PNG crop persistence, content delivery, permission revoke and disconnect recovery.
4. Evaluation/delivery complete: security fixtures, 30 research tasks, 108 deterministic classification samples, clean launcher, full verification, README, architecture/failure notes and three demos.

## M15 implementation checkpoint

1. Research depth is now persisted as `task → 3–6 subquestions → project dossiers → multiple supporting assets`; mode-specific targets govern subquestion, project and asset coverage without creating a case library or cross-workspace index.
2. Each subquestion association retains its own project context, mechanism, transfer strategy, observations and boundary. Query state is grouped by execution generation and latest query-key state, so crash recovery resumes inherited completions while a deliberate retry after a complete partial run can research again.
3. Browser inspection is bounded by SQLite-persisted run-level call, byte and page budgets. Accepted duplicate images can carry a source relation without reclassification or another file, provider-first assets adopt the real crop/hash, and unused duplicate files are removed.
4. The Board presents case chapters and multi-image dossiers, and keeps the evidence drawer aligned with the subquestion the user opened. Provider, browser and follow-up passes merge analysis monotonically instead of clearing supported context, mechanism or earlier observations.
5. Candidate retention resolves the default `.archresearch/...` storage form consistently, so the lifecycle sweep removes only genuine orphan crops. Desktop 1440px and mobile 390px visual acceptance covers home, result chapters, project dossiers and evidence drawers with no document-level horizontal overflow.
6. The final `scripts/verify.ps1` gate exits 0: 137 API tests, 41 Board tests, 111 Extension tests, 6 packaged-Chrome E2E cases, PowerShell contracts, type/lint/build checks and all 30/108 evaluation fixtures pass without live provider calls.

## M33 completion summary

1. A run is complete only when every planned subquestion has at least one displayable, relevant partial/verified asset with a current source-evidence binding. Additional drawings, project diversity and deeper analysis remain enrichment targets rather than false completeness blockers.
2. Quick/Balanced/Deep keep their normal depth passes. Precedent research alone receives one bounded completion recovery pass; already covered branches are skipped and each uncovered branch retains two dedicated public/browser page attempts after the normal page budget is exhausted.
3. Disconnected Chrome remains an optional enhancement and cannot downgrade public research. Once a Chrome inspection is actually attempted, an execution failure is preserved as `browser_inspection_incomplete` and the run stays partial.
4. Exact unique image URLs and perceptual hashes deduplicate across provider and browser sources. Stronger primary/trusted sources can promote a candidate; later aggregator results cannot recreate or downgrade it.
5. The Board distinguishes usable output from unverified leads (`3 张可用 · 18 条待核验线索` in the accepted live result) and keeps every unsupported subquestion visible.
6. The final repository gate exits 0: 186 API tests, 62 Board tests, 124 Extension tests, 6 packaged-Chrome E2E cases, all lint/type/build/security contracts and the 30/108 evaluation fixtures pass. Impeccable reports zero design-detector findings.
7. Three comparable live Quick runs remained honest partials at 3 usable drawings, one concrete project and 1/3 covered branches after the relay model search timed out and Firecrawl returned weak recovery sources. This is a measured provider/recall limitation, not relabeled as completion.

## M34 completion summary

1. Quick, Balanced and Deep now use the same evidence-complete terminal rule. Depth changes 3/4/6-way decomposition, pass count, drawing density and analysis rigor; it no longer changes whether an unanswered branch may be called complete.
2. All three modes use a 30-minute safety ceiling and three completion-only recovery rounds. An unfinished precedent run becomes a retained `blocked` checkpoint; “继续补齐研究” searches only uncovered branches until the evidence floor is reached.
3. Firecrawl checks the official remaining-credit endpoint before each paid search or scrape. The application defaults to retaining 100 credits and fails closed when the balance cannot be verified; tests use mocks and M34 made no live Firecrawl call.
4. `?demo=quick`, `?demo=balanced` and `?demo=deep` are deterministic local replay routes with visible 3/4/6-question depth contracts. They create no workspace/run and call no OpenAI, Firecrawl, TinEye or Chrome extension service.
5. Clean 1280×720 portfolio captures are stored under `docs/assets/portfolio-demos/`. The three pages have no horizontal overflow and remain visibly distinct in the first fold.
6. The final repository gate exits 0: 189 API tests, 66 Board tests, 124 Extension tests, 6 packaged-Chrome E2E cases, lint/format/type/build/security contracts and the 30/108 evaluation fixtures all pass without live provider traffic.
7. Remaining product limits are explicit: provider/source outages can still block completeness; Firecrawl balance is protected but not displayed in the Board; real TinEye, signed-in Chrome permission/crop, automatic StyleProfile extraction and workspace deletion UI still require follow-up acceptance or implementation.

## M35 implementation summary

1. Every new Board research request defaults to Xiaohongshu alongside the normal architecture-source search. Starting requires the user's already signed-in, temporarily authorized Chrome session; the application never asks for or stores account credentials, cookies or browser storage.
2. XHS is bounded to one visible search visit per planned subquestion, one fixed scroll and at most four note links. It shares the existing page and vision budgets, and remains available to uncovered branches even when the relay model-search circuit times out.
3. XHS, Pinterest and `pin.it` results are deterministically restricted to visual leads with direct visible observations. They cannot establish project identity, asset association, formal facts or complete-case evidence; those obligations remain with project sites and trusted architecture publications.
4. Pinterest is opt-in and link-only. No direct Chrome or Firecrawl extraction is performed without an officially permitted API path.
5. Source preferences persist on every run and through retry/resume. A new research request restores XHS as the default even after the user disabled it for the preceding request.
6. Development and verification use deterministic mocks only. No OpenAI, Firecrawl, TinEye, XHS or Pinterest quota is consumed; the three final Quick/Balanced/Deep portfolio runs remain a separate live acceptance gate.
7. The authoritative repository gate exits 0 with 195 API tests, 69 Board tests, 126 Extension tests and 6 packaged-Chrome E2E cases, plus lint, format, type, build, security and the 30/108 evaluation fixtures.

## M36 execution plan

1. **Chrome/XHS launch readiness — complete (2026-07-15).** The existing research form now has one compact, non-technical status section for Chrome connection, current-page extension availability, temporary page permission and the honest boundary “小红书登录态待可见页面验证”. It displays no model or Firecrawl balances, creates no run and contacts no research provider.
2. **Internal quota discipline.** Remaining balance and the protected reserve are Codex execution constraints, not a product feature. Do not add a balance endpoint, settings page, meter or Firecrawl credit copy to the Board. Development, replay and debugging stay on mocks; real quota is reserved for the later accepted runs.
3. **Bounded XHS acceptance.** With the user signed in through their own Chrome, exercise one visible XHS query, one fixed scroll and at most four note links through the shipped extension protocol. Verify that no credentials, cookies, storage, private content or social actions enter Trace. Do not call OpenAI, Firecrawl or TinEye in this source-only acceptance.
4. **Portfolio task lock.** Choose and freeze one Quick, one Balanced and one Deep task before any paid run. Each acceptance rubric requires every planned subquestion to have displayable, source-bound partial/verified architecture evidence; XHS visual leads enrich presentation but cannot close case-evidence gaps. Chinese analysis, loaded images, working source links and duplicate control are mandatory.
5. **One candidate at a time.** Run Quick first. If it fails the rubric, stop, reproduce with fixtures and fix before spending again. Then run Balanced and Deep with the same gate. The successful Balanced run also closes the outstanding Board-started M20 Chrome acceptance.
6. **Portfolio evidence package.** For each accepted real run retain the run id, date, model, depth contract, source manifest, redacted Trace summary, internally recorded credit usage and clean result-page captures. The current `?demo=quick|balanced|deep` pages remain rehearsal fixtures and must not be presented as final real evidence.
7. **Post-capture backlog.** After the three real pages are secured, separately address real TinEye-key acceptance, automatic StyleProfile extraction, visible workspace deletion and the six-student usability study; none of these should delay or consume the protected portfolio run budget.

## External acceptance gates

The code delivery is complete. These product claims require user-owned credentials, paid/live execution, rights-cleared data or human participants and are intentionally not fabricated by the implementation:

- Run the TinEye live capability check after the user supplies a TinEye Key.
- Execute the 30 versioned tasks against changing live websites and add human relevance/source labels; this is opt-in because it costs money.
- Collect 100+ independently sourced, rights-cleared real drawing samples before claiming real-image classification accuracy; the delivered 108 samples are deterministic synthetic fixtures.
- Conduct the planned six-student usability study and record collection behavior.
- Load the packaged ArchResearch extension in the user's normal Chrome profile for a final logged-in-site acceptance run.
- Complete one bounded signed-in Xiaohongshu acceptance run after the user grants temporary Chrome permission; do not request or store the user's password.
- Capture the final Quick, Balanced and Deep portfolio result pages from three real provider-backed runs only after checking the protected Firecrawl reserve.

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
- Research depth is a semantic contract: problem decomposition, per-subquestion source/project/drawing coverage and analysis/evidence obligations. Query/page/time values are bounded execution ceilings, not the user-facing definition of depth.
- Quick, Balanced and Deep all owe a complete answer across their planned subquestions. Depth changes enrichment and analysis rigor, never permission to deliver a knowingly incomplete answer as complete. External blockers remain explicit and resumable.
- Deterministic replay fixtures remain the zero-cost development and regression path. Final portfolio demonstrations must be three real Quick/Balanced/Deep research runs and result-page screenshots; live Firecrawl execution retains a configurable reserve until those acceptance runs.
- Xiaohongshu support uses only the user's visible, signed-in Chrome pages after explicit temporary permission. The system never asks for or stores a password, reads cookies/local storage/private messages, bypasses verification, or performs social actions.
- Source priority follows research intent: authoritative architecture/project sources establish case facts and completion; Xiaohongshu and Pinterest are visual-inspiration leads for drawing style, massing and diagram language and cannot alone prove a complete project case.
- Pinterest's current official rules prohibit unauthorized automated scraping. Until the user supplies a permitted official API path, Pinterest may appear only as a search-engine/provider link lead and is excluded from direct Chrome/Firecrawl extraction.

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
| M29 full verification first requested canonical Ruff formatting for the touched workflow | 1 | Format only the touched workflow file and rerun the authoritative gate |
| M29 Mypy rejected nullable legacy `QueryAttempt.subquestion_id` while counting passes | 1 | Ignore legacy attempts without a subquestion id; planned current attempts remain fully counted |
| M29 analysis-depth contract was initially data-only | 1 | Add a red query-planning test and carry the selected observation/mechanism/transfer/boundary/verification obligations into every model research query |
| M29 in-app visual acceptance hit the recorded `Cannot redefine property: process` host error | 1 | Do not repeat the known failing preview-control path; use the complete Board/build/packaged-Chrome gates plus the zero-finding local design detector, while keeping the live app available for user inspection |
| One-click stop tracked launcher PIDs while Python/Vite child processes owned the ports | 1 | Harden shutdown to resolve and verify workspace-owned listener processes before stopping the process tree |
| Bundled Playwright package referenced browser files that were not installed | 2 | Use the system Chrome executable for deterministic local screenshot and extension E2E runs; do not download browsers at runtime |
| Initial M6 Board screenshot showed all Demo cards without visual assets | 1 | Treat usable local drawing previews and bounded desktop preview height as Board acceptance requirements |
| Planning recovery called the disabled Windows Store `python` alias | 1 | Run the catch-up script with `apps/api/.venv/Scripts/python.exe`; keep project commands on the resolved workspace runtime |
| M35 catch-up reused the stale root `.venv` path from a compacted summary | 1 | Stop using the missing root environment; resolve the current app-owned or bundled Python before running catch-up again |
| M35 inspection assumed a nonexistent `providers/base.py` path | 1 | Discover the concrete provider module with `rg --files`; provider contracts live in `providers.py` |
| M35 migration inspection included the `__pycache__` directory as a file | 1 | Filter Alembic discovery to `*.py` before reading revision contents |
| M35 Windows `rg` used shell-style wildcard paths for tests/CSS | 1 | Search concrete directories, then filter `rg --files` output instead of passing wildcard paths |
| M35 first focused API command duplicated the workspace prefix from an `apps/api` working directory | 1 | Invoke the existing environment as `.venv/Scripts/python.exe` from the API directory |
| M35 inspection search used an unclosed regular expression | 1 | Stop the malformed pattern and inspect the known `inspection.py` range directly; no production result depended on the failed search |
| M35 first static gate requested canonical Ruff formatting in four new/touched Python files | 1 | Run the repository formatter only on those files, then rerun the full authoritative verification |
| M35 post-gate review found model timeout could stop still-available XHS branches | 1 | Add a failing three-branch regression and include XHS availability in the loop stop predicate; all planned XHS branches now continue independently |
| M35 browser QA used an unavailable DOM constructor inside the restricted read-only page scope | 1 | Re-read the checkbox through its plain `checked` property without relying on page-global constructors; desktop and mobile geometry checks then passed |
| M36 first Impeccable setup used the repository-local `.claude` path, but this installation is user-scoped | 1 | Resolve and run the installed script from `C:\Users\76384\.codex\skills\impeccable\scripts`; project context then loaded successfully |
| M36 session catch-up first used unavailable `python`/`py` aliases | 2 | Resolve the bundled Codex Python runtime and complete catch-up without relying on Store aliases |
| M36 Board lint rejected a readiness loader invoked directly by an effect | 1 | Start the local-only async check from a zero-delay callback with unmount protection; manual refresh remains an explicit event action |
| M36 Chrome desktop-control binding remained unavailable after the documented retry | 2 | Keep the accepted 459px in-app-browser QA and full build/E2E evidence; do not substitute another automation path, and leave signed-in XHS acceptance pending until the user-facing Chrome connection is active |
| The claimed in-app tab exposed no callable finalization marker | 1 | Leave the user's existing tab open on the verified local homepage instead of closing or replacing it |
| Board lint rejected synchronous restoration resets inside a React effect | 1 | Move reset/loading transitions to explicit workspace-selection actions and keep the effect limited to asynchronous restoration |
| Real Chrome capture rejected HTTP/HTTPS wildcard host permissions | 1 | Request optional `<all_urls>` only for the task lifetime, retain public-HTTP(S)-only navigation/injection checks, and revoke at every terminal path |
| Uvicorn started without a WebSocket protocol implementation | 1 | Add the concrete `websockets` runtime dependency and cover pairing through a real network server |
| Full-stack page inspection completed with zero captured candidates | 1 | Trace the real Chrome error to host permission semantics, keep crop bounds strict, and verify PNG persistence after the scoped permission fix |
| Parallel loading of two external UI reference sites timed out the browser session | 1 | Avoid repeating the parallel navigation; inspect one public source at a time and prefer stable open-source README screenshots |
| The system `python` alias was unavailable during M9 session recovery | 1 | Re-run recovery with the project-owned API virtual environment instead of relying on a machine-global alias |
| The cached browser-skill version path changed between sessions | 1 | Discover the installed `SKILL.md` with `rg --files` and use the current package path |
| The first M9 test insertion used a stale neighboring test name | 1 | Inspect the exact test boundaries and reapply the small patch at the verified location |
| A multiline inline Python contrast probe was escaped literally by PowerShell | 1 | Replace it with a single-line Node calculation; the placeholder contrast is 5.25:1 |
| Browser tab recovery first called the wrong `tabs.claim` surface | 1 | Use the documented `browser.user.claimTab` method and retain the existing browser binding |
| The first M11 combined CSS patch expected an empty `.research-quick-actions` rule that does not exist | 1 | Re-read the exact selector block and split the implementation into smaller verified patches; no production CSS was changed |
| A GitHub directory click for the React Bits Magnet source did not complete | 1 | Stop the hung request after the ClickSpark source and live preview already provided sufficient comparative evidence |
| The first motion pass chose an effect before finishing the mature-product behavior audit | 1 | Reorder the work as requested: audit FigJam/Miro/Milanote/Eagle/Cosmos first, then map only the supported task feedback to React Bits and move the spark to the single launch action |
| Chrome's raw `--window-size=390` screenshot cropped an outer window and looked like page overflow | 1 | Re-test with an exact Playwright 390px viewport; DOM width, expanded settings and long filename states all remain within the viewport |
| The first CSS contract test resolved `import.meta.url` to Vite's non-file module URL | 1 | Switch away from URL-based filesystem loading; the next gate then exposed the browser-only TypeScript boundary before the final `?raw` fix |
| The CSS contract test's Node filesystem fallback was excluded by the Board browser-only TypeScript config | 1 | Import the stylesheet through Vite's typed `?raw` contract so the same source is available to Vitest without adding Node types to browser code |
| M15 resume inspection referenced the obsolete `apps/board/src/index.css` path | 1 | Use the current global stylesheet at `apps/board/src/styles.css`; no production file was changed |
| M15 startup inspection referenced a nonexistent `archresearch_api/app.py` | 1 | Locate the application lifespan from the package file list before changing startup; no production file was changed |
| Three legacy workflow tests still encoded the pre-M15 six-asset threshold and flat duplicate semantics | 1 | Update the tests to require 12 Balanced assets and treat a first-time subquestion association as useful progress |
| Two API integration tests still selected/asserted all six Mock results after Mock depth increased to twelve | 1 | Keep the Board comparison limit at six by selecting the first six, and update result persistence to expect all twelve |
| M15 documentation review looked for `PRODUCT.md` at repository root | 1 | Use the existing app product context at `apps/board/PRODUCT.md`; keep root `DESIGN.md` as the global visual authority |
| The first shared visual-budget test patch targeted a stale assertion line | 1 | Re-read the focused test section and insert the regression test at the verified page-budget boundary |
| The first M15 Board association test patch expected a nonexistent neighboring test name | 1 | Re-read the exact test boundary and insert the focused regression test after the verified inspector test |
| The first service smoke check used `/v1/health`, but health is not versioned | 1 | Use the implemented `/health` route; it returns 200 and reports `gpt-5.5` |
| The in-app browser backend rejected `networkidle` although the generic docs list it | 1 | Use the supported `load` state and verify rendered content directly |
| A combined PowerShell source-range inspection built a malformed default range for `inspection.py` | 1 | Read the visual inspection loop in a separate bounded command before changing it |
| M15 final recovery again invoked the disabled system `python` alias | 1 | Switch immediately to `apps/api/.venv/Scripts/python.exe` for every project recovery command |
| The first stale-retry regression expected a fourth program query after the run had already stopped on two duplicate replay batches | 1 | Assert the actual boundary: previously completed program and circulation queries are replayed; normal no-new-assets stopping remains intact |
| Parallel API verification yielded the long pytest process without printing its reusable session id | 1 | Keep Ruff/Mypy results and rerun pytest alone with a 30-second yield so its final exit code is captured |
| The read-only final audit's first PowerShell range helper passed an array to `[Math]::Min` | 1 | The audit switched to a fixed file range and continued without modifying the repository |
| The first final-audit mailbox wait used 1 second below the tool's 10-second minimum | 1 | Retry with the documented 10-second minimum; no project work was affected |
| The first durable-budget model patch referenced SQLAlchemy `Boolean` without importing it | 1 | Add the missing model import before rerunning the focused migration/retry tests |
| Final audit searched two stale test filenames that do not exist | 1 | Use the actual workflow/API test files found by `rg`; no repository files were changed by the audit |
| `verify.ps1` continued after Ruff's native format check returned non-zero | 1 | Add a red-first PowerShell contract and enable `$PSNativeCommandUseErrorActionPreference`; the gate now stops on native command failures |
| The first changed-file secret scan nested two command result arrays and reported only two aggregate entries | 1 | Flatten both Git file lists before scanning file contents; never print matched secret text |
| The first post-audit static gate found two unformatted Python files and one unsorted import block | 1 | Apply the project Ruff formatter/import fixer, then rerun the complete API and repository gates |
| A read-only audit started a second full verification before the main gate | 1 | Stop launching commands from the audit workstream and treat the main thread's single exit-0 run as the authoritative result |
| The final secret scan treated a newline after an empty `.env` assignment as a value | 1 | Restrict assignment whitespace to spaces/tabs instead of `\s`; all 39 changed files then scan with zero credential-pattern matches |
| The cached in-app browser skill path changed before M16 | 1 | Discover the currently installed `control-in-app-browser/SKILL.md` with `rg --files` before browser acceptance |
| The first M16 API summary expanded the wrong PowerShell result property | 1 | Inspect the actual result item contract, then summarize the eight `project_name` records without changing data |
| A Windows `rg` command passed a wildcard path literally to the executable | 1 | Enumerate package files first and filter them with `rg`; do not pass `browser*.py` as a Windows path argument |
| The image-pipeline audit selected a stale, nonexistent content-route test node | 1 | Locate the current test name with `rg` before running a focused pytest node |
| A Board audit repeated the Windows wildcard-path mistake on `*.py` | 1 | Use explicit files or enumerate paths before filtering; no project code was affected |
| The first crop-association format gate found one unformatted workflow block | 1 | Run Ruff format on the touched workflow file, then re-run Ruff check and format check |
| An `rg` pattern beginning with `--icon-lg` was parsed as a command flag | 1 | Add the `--` end-of-options marker before patterns that start with hyphens |
| The first responsive CSS patch assumed the media query began with `.app-header` | 1 | Inspect the exact `@media` opening and insert the rules after its existing `:root` block |
| The new-run UI test expected a non-existent “正在检索网页” status phrase | 1 | Reuse the product's established “正在搜索” state vocabulary and keep the implementation unchanged |
| The ChatGPT Chrome control extension was unavailable after the documented retry | 1 | Keep browser-profile state untouched and use isolated system-Chrome Playwright only for local ArchResearch visual acceptance |
| The first M17 multi-endpoint PowerShell probe placed a pipeline directly after `foreach` | 1 | Assign the loop output to a variable before piping to `ConvertTo-Json`; no project state changed |
| Chrome control initialization failed twice with `Cannot redefine property: process` | 2 | Stop retrying the same browser runtime path and move to the documented Windows-control fallback for extension onboarding |
| M18 recovery first invoked the disabled Windows Store `python` alias | 1 | Use the project-owned API virtual environment for session recovery instead of relying on global Python |
| The advertised Karpathy skill path was absent from the local skill directory | 1 | Follow the repository's equivalent simplicity/TDD rules directly; do not block M18 on an unavailable optional skill |
| The M18 web-search backend timed out and then returned empty GitHub payloads | 2 | Stop repeating the same search path; use bounded reads from official GitHub API/raw repository endpoints and retain primary-source URLs |
| The first M18 documentation patch assumed README used the architecture document's Mermaid labels | 1 | Re-read the exact README block and apply smaller file-specific patches; no documentation changed in the failed attempt |
| The first M18 Ruff gate found one 103-character test fixture line | 1 | Wrap the fixture list without changing behavior, then restart the gate from Ruff |
| Ruff format check found three M18 Python files requiring canonical layout | 1 | Apply Ruff format only to those files, then rerun check/type/tests |
| M34 browser acceptance initially reached the localhost offline interstitial | 1 | Confirm both services were stopped, restart them through `scripts/start.ps1`, and continue on a fresh local tab without provider traffic |
| M34 full gate found one stale Python formatting expectation and one packaged-Chrome `partial` assertion | 1 | Format only the touched test and update the E2E terminal expectation to the new truthful `blocked` contract; the full gate then passes |
| The first saved Balanced portfolio screenshot contained browser compositor black blocks | 2 | Verify the DOM had no black surfaces, discard the corrupted captures, create a fresh local tab and accept only the clean recapture |
| M18 Mypy found five narrowings/reused-loop-variable type errors | 1 | Add explicit metadata/dict narrowing and distinct type-name variables; no runtime behavior changed |
| The first M18 credential scan treated runtime `api_key` variable assignments as literal secrets | 1 | Inspect only file/line locations, confirm all ten hits are variable flow or credential reads, and narrow the final scan to quoted secret literals |
| The first M19 static gate found one 101-character test assertion | 1 | Wrap only the failing generator expression, then restart the focused gate from Ruff |
| M19 Ruff format check requested canonical layout in two touched files | 1 | Apply Ruff formatting only to the workflow and its focused test, then rerun lint/type/tests |
| The post-ordering M19 full gate found three Mypy optional-client narrowings | 1 | Add explicit non-null assertions under the already computed `can_inspect` guard, then rerun the authoritative gate from the start |
| The first live Firecrawl credential check returned HTTP 401 | 1 | Explain that the relay/OpenAI key is not a Firecrawl key, reopen hidden Firecrawl input, and require a successful bounded live scrape before accepting configuration |
| The first M21 green run instantiated `ProviderSearchResult` without required assets | 1 | Supply explicit empty `sources`/`assets` in both degraded workflow construction and the focused timeout fixture, then rerun the red tests |
| The first M21 blocked-status search used an over-escaped `rg` regex | 1 | Replace the grouped pattern with separate `-e` expressions; confirm no existing test relies on blocking runs that already preserve visual leads |
| M21 API format gate requested canonical layout in two touched files | 1 | Apply Ruff format only to the workflow and focused browser test, then restart the API gate from Ruff |
| M20 in-app browser control again failed with `Cannot redefine property: process` and no initialized agent | 1 | Stop the repeated plugin path after its required troubleshooting document was unreachable; use API/result contracts and the repository's packaged Chromium acceptance instead |
| The first M21 dedup/deadline test patch used a pre-format multiline assertion context | 1 | Locate the Ruff-formatted one-line assertion and apply the two test additions in smaller file-specific patches |
| The M21 image-normalization and independent-deadline regressions failed on their first red run | 1 | Keep the failures as the behavior baseline: reject structurally truncated URLs, collapse known image delivery variants, and admit Firecrawl/model calls against their own worst-case reserves |
| The first M21 API gate found two files outside canonical Ruff layout | 1 | Format only the touched workflow and focused test, then restart the API gate from lint rather than treating the passing tests as authoritative |
| The first read-only live SQLite probe broke on nested PowerShell/Python quote escaping | 1 | Avoid another inline multi-query expression; use PowerShell's SQLite-capable project models through a short existing-package invocation or separate simpler queries |
| M24 in-app browser runtime again failed during setup with `Cannot redefine property: process` | 3 | Stop retrying this known host-plugin failure; validate the Board with its tests/system Chromium and the extension bridge with packaged-Chrome E2E, while making non-Chrome degradation explicit in the product UI |
| Planning session catch-up could not invoke the `python` alias on Windows | 1 | Existing planning files and clean committed M24 state provide recovery context; use the project Python launcher/runtime for later helper scripts instead of repeating the missing Store alias |
| API inspection referenced non-existent `archresearch_api/app.py` | 1 | The application factory is `archresearch_api/main.py`; continue from that existing file and do not repeat the stale path |
| Extension inspection referenced non-existent `apps/extension/manifest.json` | 1 | Use the packaged source manifest at `apps/extension/public/manifest.json`; do not repeat the stale root path |
