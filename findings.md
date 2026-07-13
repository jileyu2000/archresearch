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
- Layout: compact top bar, one research composer and a flat drawing grid. Workspaces use a selector; evidence and Trace use contextual drawers; compare actions appear only after selection.
- Palette: vellum `#F3F5F2`, graphite `#171B19`, blueprint `#315CF4`, signal red `#E4583E`, evidence green `#2D846B`, fog `#DDE3DF`.
- Type: system Chinese sans for readability, condensed/mono utility labels for drawing metadata.
- Default disclosure: cards show the drawing, project, type, evidence tier and one useful sentence; provenance, claims, boundaries, notes, StyleProfile, exports and Trace stay one explicit action away.
- Avoid permanent side rails, repeated filter buttons, generic rounded SaaS cards, decorative gradients, and chat-first layout.

## M7 Usability Simplification

- The current 1330 px screenshot exposes four permanent regions, nine asset filters, full evidence metadata, four evidence prose blocks, comparison/export controls and the stage rail at once. The feature set is valid, but the default disclosure level is too high for first-time users.
- The primary task is singular: describe a design problem and review useful drawings. Workspace administration, evidence audit, comparison, StyleProfile, exports and Trace are secondary and should not compete with that path.
- Mature references support a simpler pattern: Perplexica centers one research prompt and defers modes; Zotero keeps the item list primary and details contextual; Karakeep shows an immediate asset collection with filters and metadata available on demand.
- The redesign should use a compact top bar plus a single results canvas. Workspaces become a menu, asset filters become one horizontal segmented row with an overflow menu, and source evidence becomes a contextual drawer opened from the selected result.
- Result cards should show only image, project, asset type, evidence tier and one useful sentence by default. Detailed source status, facts, observations, inferences, boundaries, notes and evidence locators remain available in the drawer.
- Advanced actions remain complete but move behind clear entry points: compare selection in a bottom action bar, StyleProfile/Trace/export in a tools menu, and research progress in a compact status strip.
- Accepted implementation: the default result screen contains only the workspace selector, new-research action, tools menu, one asset-type select and a flat reference grid. Source evidence opens from a card; advanced research inputs stay collapsed; cancel/retry remain directly reachable from the run status.
- Responsive acceptance passed at 1440, 1024 and 390 px: four/three/one-column grids, no document-level horizontal overflow, full-width mobile evidence drawer, no permanent inspector or stage navigation, and no browser console warnings or errors.
- The legacy `diagram` label remains readable but is merged into the single `analysis_diagram` filter option, preventing duplicate “分析图” choices.

## M8 Mature-product UI study

- Karakeep's strongest transferable pattern is an image-first masonry collection: mixed-height assets fill the canvas, metadata is quiet, actions live at card edges, and navigation/search remain stable. ArchResearch should borrow the browsing rhythm, not its generic bookmark taxonomy.
- Linkwarden confirms that a permanent full dashboard, metric tiles and a dark shell would be wrong for this product. Architecture drawings need a light inspection surface and should not compete with summary statistics.
- Vane/Perplexica confirms that sources and research progress work best as compact, collapsible context near the active question. ArchResearch should keep evidence one action away and avoid turning the result board into a prose answer page.
- Chosen direction: a restrained light asset browser with a slim utility rail, a command-like research bar, a masonry drawing wall and a contextual evidence drawer. The distinctive domain cue is a “digital pin-up wall”: drawing sheets retain their native aspect ratios, hover lifts only the active sheet, and evidence appears as small source pins rather than decorative borders.
- Palette: neutral studio canvas `#EEF0ED`, paper `#FFFFFF`, graphite `#171A18`, secondary ink `#5E6661`, blueprint action `#2F5BFF`, verified green `#1F7A5A`, and warning vermilion `#D6533C`. Color stays restrained and functional.
- UI typography remains a single system sans family for trust and speed. Drawings, project titles and one method sentence form the hierarchy; uppercase utility labels and mono metadata are reduced rather than used as a visual theme.
- First 1440 px implementation check confirms the intended asset-browser hierarchy: four masonry columns, drawing sheets with varied heights, compact source pins, icon actions, no permanent inspector and no horizontal overflow. The previous engineering-table feel is gone.
- The first visual pass also exposed two token-alignment refinements: the sticky header should lose its redundant visible “工作区” field label to approach the documented compact shell height, and card method text should use the documented 13px compact-body tier instead of 12px.
- The refined mobile pass is a clean single-column drawing feed with the workspace on its own second row, no horizontal overflow and intact evidence pins. The remaining concrete mobile issue is the 30px compare icon target; the design system requires a 44px touch target below 620px.
- The consistency audit found that the repository had both a legacy `apps/board/DESIGN.md` and the new root `DESIGN.md`. M8 removes the legacy file so the root system is the single inherited authority for Board and later extension surfaces.
- The 1024 px pass showed why generic CSS masonry is wrong for ranked evidence: column-first flow visually placed result 2 below results 3/5. The final system uses an ordered 1/2/3/4-column pin-up grid with intrinsic image ratios, so browsing stays lively without sacrificing relevance order.
- Final ordered-grid checks pass at 1024 and 390 px: result order remains 1→2→3→4, the grid resolves to three/one columns, mobile compare targets are 44px, and neither viewport has document-level horizontal overflow. The first eight images load eagerly so the initial desktop and tablet wall does not reveal blank lazy placeholders; later results remain lazy.
- The source drawer passes the mobile interaction check at full viewport width with no overflow, initial focus on “关闭”, Escape support and return focus covered by the Board test. The final 1440 px wall resolves to four ordered columns, a 60px shell and zero console warnings/errors.
- The final Impeccable design-system detector returns an empty finding set: CSS no longer uses an undocumented font, radius or color, and the root `DESIGN.md` is the only design authority.

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
- Board and API currently run as user-session background processes, not Windows services. A reboot or host process cleanup can leave the saved launcher state behind while ports 5173/8000 are no longer listening; `scripts/start.ps1` safely recreates both listeners and rewrites the state file.

## M6 Delivery Status

- The evidence-desk layout passed screenshot acceptance at 1440, 1024 and 390 px with seven inspectable drawing assets, automatic first-result selection, no document-level overflow and no console errors.
- The real Board restores SQLite runs, evidence, saved/rejected state, notes, comparison selection, StyleProfile and Trace. Historical asset labels normalize through the nine-class read contract, and `has_local_content` prevents nonexistent crop requests.
- The first live `gpt-5.5` Quick run produced eight unique source leads and reached `coverage_satisfied`; its versioned report explicitly records that the browser was unavailable and no drawing crops were produced.
- A separate packaged-Chrome replay now proves the missing half of that loop: real FastAPI WebSocket pairing, fixed-page inspection, `captureVisibleTab`, PNG persistence, content delivery and terminal permission revocation.
- Chrome requires task-scoped optional `<all_urls>` for continuous `captureVisibleTab`; no permanent host permission or manifest content script exists, and API/protocol/final-tab tests still reject `file:`, `ftp:`, `chrome:`, loopback, private and reserved destinations.
- Uvicorn declares `websockets>=14,<16`, so the production launcher supports the same real network handshake exercised by E2E.
- `scripts/verify.ps1` is the complete offline delivery gate: 105 API tests, 26 Board tests, 111 extension tests, 6 packaged Chrome E2E cases, lint/type/build checks, PowerShell safety/process tests, 30 research tasks and 108 deterministic classification samples.
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
