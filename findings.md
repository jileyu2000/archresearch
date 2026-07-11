# Findings

## Environment

- Workspace started empty except for `work/` and `outputs/`.
- No existing Git repository or code needs preservation.
- Bundled runtimes are available for Python, Node.js, pnpm, documents, and browser testing.
- Runtime versions: Node.js 24.14.0, pnpm 11.7.0, Python 3.12.13.
- The bundled Python interpreter does not preinstall FastAPI; the API app must declare/install its own locked development dependencies in a workspace virtual environment.

## Approved Product Decisions

- Runtime: local Windows/Chrome single-user application.
- Surfaces: Chrome MV3 extension + local board + local FastAPI executor.
- Storage: SQLite and local files only.
- Search: OpenAI web search for text/image discovery; Chrome for page inspection; TinEye for reverse image lookup.
- Result delivery: verified, partial, and visual-lead tiers; private full export and rights-filtered share export.
- No platform case library, global index, or cross-workspace retrieval.

## Frontend Direction

- Subject: an architectural evidence desk, not a chat application.
- Layout: compact project rail, central drawing board, evidence inspector, and a research-stage rail.
- Palette: vellum `#F3F5F2`, graphite `#171B19`, blueprint `#315CF4`, signal red `#E4583E`, evidence green `#2D846B`, fog `#DDE3DF`.
- Type: system Chinese sans for readability, condensed/mono utility labels for drawing metadata.
- Signature: every reference card has an evidence rail and registration-mark corners, visually connecting the drawing to its source chain.
- Avoid generic rounded SaaS cards, decorative gradients, and chat-first layout.

## External Capability Facts

- OpenAI Responses web search supports text and image results, raw result metadata, source lists, and domain filters.
- OpenAI strict Pydantic parsing and cropped `input_image` requests support the research and nine-class visual contracts; this project now defaults both paths to `gpt-5.5`.
- The 梭子蟹 relay configuration uses `https://suoxie.codes/v1` with API model `gpt-5.5`; the `suoxie/gpt-5.5` prefix belongs only to OpenCode routing. ArchResearch stores its Key under Windows Credential Manager service `ArchResearch/suoxie`, account `api-key`.
- Windows PowerShell 5.1 can misdecode UTF-8 scripts without a BOM. Security-sensitive executable PowerShell scripts are kept ASCII-safe and parser-tested under both Windows PowerShell 5.1 and PowerShell 7.
- The user-supplied 梭子蟹 credential passed the live Responses + `web_search` capability probe. The committed local configuration selects `gpt-5.5` for both research and visual classification; the credential is present only in Windows Credential Manager.
- TinEye uses `https://api.tineye.com/rest/`, an `x-api-key` header, and returns matches with backlink page URLs; crawl dates are not publication dates and are not persisted as evidence.
- Chrome MV3 supports optional host permissions; extension code must be bundled and cannot execute remotely hosted code.
- Playwright tests MV3 extensions through a persistent Chromium context.

## Implemented Boundaries

- Browser pairing rotates a one-time code to a persistent token; only its SHA-256 digest is stored by the API.
- Browser commands are enumerated and payload-strict. Generic `safe_click` is a no-op on untrusted pages.
- Candidate inspection sends at most three cropped regions per page to the visual classifier; full pages and image data are excluded from Trace.
- API DNS resolution rejects failed, private, reserved, and IPv4-mapped private A/AAAA results before navigation; the extension rechecks final URLs.
- Saved-reference snapshots survive temporary candidate cleanup. Startup cleanup removes expired candidates, source metadata, queries, and Trace, then resumes active runs.

## M6 Delivery Status

- The evidence-desk layout passed screenshot acceptance at 1440, 1024 and 390 px with seven inspectable drawing assets, automatic first-result selection, no document-level overflow and no console errors.
- The real Board restores SQLite runs, evidence, saved/rejected state, notes, comparison selection, StyleProfile and Trace. Historical asset labels normalize through the nine-class read contract, and `has_local_content` prevents nonexistent crop requests.
- The first live `gpt-5.5` Quick run produced eight unique source leads and reached `coverage_satisfied`; its versioned report explicitly records that the browser was unavailable and no drawing crops were produced.
- A separate packaged-Chrome replay now proves the missing half of that loop: real FastAPI WebSocket pairing, fixed-page inspection, `captureVisibleTab`, PNG persistence, content delivery and terminal permission revocation.
- Chrome requires task-scoped optional `<all_urls>` for continuous `captureVisibleTab`; no permanent host permission or manifest content script exists, and API/protocol/final-tab tests still reject `file:`, `ftp:`, `chrome:`, loopback, private and reserved destinations.
- Uvicorn declares `websockets>=14,<16`, so the production launcher supports the same real network handshake exercised by E2E.
- `scripts/verify.ps1` is the complete offline delivery gate: 105 API tests, 25 Board tests, 111 extension tests, 6 packaged Chrome E2E cases, lint/type/build checks, PowerShell safety/process tests, 30 research tasks and 108 deterministic classification samples.
- Remaining acceptance is external rather than unfinished code: a user-provided TinEye live test, opt-in paid execution and human labeling of 30 live tasks, 100+ independent rights-cleared real images, six-student usability research and a normal-profile logged-in Chrome run.

## Open-source reference study (M6)

- LangChain `open_deep_research` validates a bounded research loop with separate summarization/research/compression roles, explicit model/tool configuration, source-aware outputs, and benchmarkable run records. ArchResearch should borrow its observable stages and evaluation record shape, but keep the approved deterministic single-run state machine instead of adopting LangGraph or a multi-agent runtime.
- Karakeep demonstrates mature mixed-asset handling: links, images, PDFs, automatic metadata fetching, OCR, lists, highlights, browser capture, two-phase fetching, skeleton states, bulk actions, archival and SSRF hardening. ArchResearch should borrow its immediate-item-first loading, persistent user organization and resilient asset preview patterns, not its global bookmark library or server-first architecture.
- AFFiNE demonstrates a local-first edgeless canvas that mixes images, notes, embeds and database views. ArchResearch should borrow direct manipulation and multiple views of the same selected references, while retaining a constrained evidence-board layout rather than a general-purpose infinite canvas.
- Browsertrix demonstrates crawl jobs as first-class resumable objects with start/schedule/manage/share states and high-fidelity browser capture. ArchResearch should borrow visible job status, recoverable failures and explicit scope, not its Kubernetes/cloud crawl infrastructure.
- Zotero/Better Notes patterns reinforce keeping metadata, annotations and source navigation bound together. ArchResearch evidence cards should make every supported fact jump to its URL/PDF/page/region and keep notes user-editable without rewriting provenance.
- Perplexica provides a useful real-time search UX reference—query expansion/focus modes, current-web results, image search and citations—but ArchResearch should avoid collapsing the output back into a chat answer; the board and evidence hierarchy remain primary.
- GPT Researcher's official event model supports query/source/image/tool events and downloadable logs. ArchResearch will expose only the eight user stages while keeping URLs, retries, timing and costs inside the expandable Trace.
- STORM's useful transferable idea is coverage-driven follow-up from distinct viewpoints. Here those viewpoints become design strategy, plan organization, section space, circulation, adaptive reuse and drawing expression; no simulated personas or multi-agent runtime are needed.
- Linkwarden's orthogonal search/filter/sort/bulk-action views map well to Run-as-temporary-collection plus asset type, evidence tier, project and rights filters. ArchResearch will not add permanent page archives or a global library.
- Excalidraw and tldraw validate separating durable document assets from transient selection/session state. The first board remains a constrained evidence grid with persisted comparison selection; a general canvas dependency is unnecessary, and tldraw's current production-license restriction rules it out.
- Chrome's official permissions lifecycle requires `permissions.request()` from an extension user gesture and `permissions.remove()` when the task ends. The extension side panel therefore remains the explicit “authorize and start” surface; the localhost board cannot silently grant host access.
