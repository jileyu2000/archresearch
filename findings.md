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

## M9 Problem-first navigation contract

- The default `/` surface did contain a question field, but `hydrateRun()` automatically collapsed it as soon as the latest completed run restored. This made a persisted result page silently replace the homepage and caused the user's confusion.
- A completed historical run is now data restored in the background, not the current view. The homepage remains a single problem composer and exposes “查看上次结果” only when history exists; the result view exposes the inverse “发起新研究” transition.
- An unfinished run is the intentional exception: it resumes directly into progress/results so cancellation and recovery remain visible. Explicit `?demo=1` continues to open a result demonstration.
- “研究结果” names the result section; “图纸类型” remains only a filter. The accessible collection name is “研究结果列表”, and the shared page container is “研究工作区”.

## M10 Homepage audit

- Audit scope: the logged-in `/` workbench at 1280×720. The user goal is to state a concrete architecture problem, understand what kinds of research are possible, and reopen prior work without landing in a full result wall.
- Strengths: the screen has one unmistakable primary action, a properly labelled question field, a visible workspace switcher and an explicit route to the previous result.
- Structural risk: after the composer, roughly two thirds of the viewport is inert canvas. The page tells users where to type but does not teach the three supported research goals, provide varied architecture-specific starting points or make previous work legible in context.
- The single example sentence forces all onboarding into placeholder text, which disappears as soon as the user types. “查看上次结果” in the far header is useful navigation but too weak to function as a recent-work surface.
- The accepted direction is a workbench home, not a marketing landing: one dominant composer, three compact goal paths, four problem starters and a small recent-research list. Full result cards, feature sales copy, dashboards and generic “how it works” panels remain excluded.
- Accessibility evidence from the current DOM confirms a labelled textarea and named buttons. Screenshot evidence alone cannot establish keyboard order, focus visibility, contrast or zoom resilience; those remain implementation checks.

## M10 Mature-product homepage patterns

- Perplexity starts a session from the homepage query box and keeps search mode, source choice and file attachment adjacent to that primary input; durable sessions move to History rather than remaining as full answers on the homepage. Source: https://www.perplexity.ai/help-center/en/articles/10354769-what-is-a-thread
- NotebookLM pairs a “create/find sources” prompt with named recent-work groupings such as Recent, Shared and Title. Its source-search results explain why each source relates before import. This supports a compact recent-research section below ArchResearch's composer, not a restored result wall. Source: https://support.google.com/notebooklm/answer/16296687
- Figma's file browser makes Recents a first-class return path and keeps templates/community discovery nearby. The transferable idea is “continue work + start from a known pattern”; ArchResearch should use architecture problem starters instead of generic templates or a marketplace. Source: https://help.figma.com/hc/en-us/articles/14381406380183-Guide-to-the-file-browser
- Notion places its AI search module at the top of Home while search surfaces recently viewed pages for immediate return. The transferable idea is to combine one dominant action with contextual recent work, without visually equating both. Source: https://www.notion.com/help/search
- Linear team home uses pinned resources and shortcuts to common destinations. For a single-user architecture tool, three goal-specific research paths are enough; adding a permanent sidebar, team metrics or configurable dashboard would be unnecessary. Source: https://linear.app/docs/default-team-pages
- Combined pattern: one primary composer, lightweight mode affordances next to it, 3–4 domain-specific starter questions, and recent work below. This is materially more useful than a lone hero form but remains a workbench rather than a marketing homepage.

## M10 Accepted workbench home

- The homepage now combines one dominant problem composer with three visible research paths, four architecture-specific problem starters and up to three recent task summaries. Full drawing cards and evidence remain exclusive to the result view.
- Completed historical runs no longer trigger result/board/evidence hydration during bootstrap. Opening “查看上次结果” or a recent-task row loads the selected run on demand, while unfinished runs still resume automatically.
- The starter rows fill and focus the question without submitting; research-path buttons expose pressed state and remain in the request contract. Attachment fields and research depth stay progressively disclosed.
- The home follows the global 4/8px rhythm, 960px work surface, flat structure-line hierarchy and one blue primary action. Static composer shadow was removed; the lower index uses open rows rather than generic feature cards.
- Every research path now has a specific prompt, starter actions say that they fill the question, and global geometry is aligned to the documented 36px controls, 16/20px icons and 8px control radius.
- Historical hydration, terminal-result hydration, new-run submission, active polling, cancellation and retry are request-scoped. Switching workspaces cannot revive an old poll, inject a late response, close the new home or flash the previous result wall; a completed in-flight poll cannot overwrite a successful cancellation.
- Browser acceptance passed at 1280×720, 1024×768, 700×800 and 390×844 with no horizontal overflow. The 700px footer reflows before controls collide; mobile research-path, attachment and submit targets are at least 44px high. The before/after comparison confirms that the former inert canvas is now used for starting and continuing work without becoming a result wall.
- Repository verification remains green: 105 API tests, 35 Board tests, 111 extension tests, 6 packaged Chrome E2E cases, lint/type/build checks, PowerShell contracts and all 30/108 evaluation fixtures. The design detector reports no findings and the muted prompt text measures 5.25:1 contrast.

## M11 Livelier visual direction

- The current homepage logic is accepted, but its all-neutral flat surfaces, medium-scale heading and evenly weighted rows make it read as a tidy form rather than a creative architectural workbench.
- The requested change is visual, not structural: preserve the single composer, three research modes, four problem starters, recent research and explicit result transition.
- Milanote makes creative work approachable by letting mixed visual materials and flexible boards carry the product identity; the transferable lesson is a visible creative working surface, not more dashboard chrome. Source: https://milanote.com/
- FigJam uses a friendly whiteboard metaphor, direct “start a whiteboard” action and colorful working artifacts to reduce the seriousness of an otherwise complex tool. ArchResearch should borrow the immediate, welcoming task surface while keeping its deterministic research flow. Source: https://www.figma.com/figjam/online-whiteboard/
- Are.na organizes research as understandable blocks and channels and frames the product around learning and connection. The transferable lesson is to make starting points feel like material on a desk rather than feature cards. Sources: https://www.are.na/about and https://www.are.na/editorial/information-systems
- Recommended signature: one committed blueprint-blue composer zone with a white working form inset, supported by stronger type scale and livelier starter-row states. The rest of the page stays quiet so the focal surface reads as intentional rather than decorative.
- This is an explicit design-system evolution: the homepage may use one committed blueprint surface for the active task, while result/evidence screens retain the existing restrained color rule so drawings and provenance remain primary.
- Miro's current dashboard documentation confirms the durable hierarchy: create, search and recent boards are first-class dashboard actions, while templates remain a secondary exploration path. ArchResearch should likewise keep one strong research start and a quieter recent-work area. Source: https://help.miro.com/hc/en-us/articles/360017571294-What-is-on-your-dashboard
- FigJam's official surface uses direct starts, recognizable template categories and playful collaboration artifacts to make a complex tool feel approachable. The transferable part is friendly, task-bound feedback around concrete starts, not decorative animation across the whole page. Source: https://www.figma.com/figjam/online-whiteboard/
- React Bits is a copy-ready animated React component collection with TypeScript/CSS variants. Its repository is licensed under MIT plus Commons Clause, so an adapted in-product component is suitable, but the license notice and source attribution must be retained. Sources: https://reactbits.dev/get-started/index and https://github.com/DavidHDev/react-bits
- Motion was selected in the product-first order requested by the user. FigJam and Miro use short, event-bound reaction bursts; Milanote and Eagle use motion to preserve continuity during direct manipulation or reveal; Cosmos uses ambient image motion mainly to establish a marketing atmosphere. Sources: https://help.figma.com/hc/en-us/articles/1500004290981-Stamps-emotes-and-high-fives, https://help.miro.com/hc/en-us/articles/360021249320-Reactions, https://help.milanote.com/en/articles/491831-moving-content-between-boards, https://www.eagle.cool/ and https://www.cosmos.so/
- The resulting rule is “action response, not ambient display”: no orbiting imagery, cursor trails, magnetic controls, glare or page-load choreography on the research workbench.
- React Bits `ClickSpark` is retained only on the unique “开始研究” action. It uses six lines, a 12px radius and 300ms lifetime, fires only after a complete pointer click on an interactive target, starts no idle animation loop and disappears entirely under `prefers-reduced-motion`.
- React Bits `AnimatedContent` was inspected as the closest mapping for Milanote-style state continuity, but its GSAP + ScrollTrigger implementation is unnecessary for one local expansion. ArchResearch uses the same low-displacement idea only when “添加资料和研究设置” appears: native CSS, 8px to 0, 220ms, no blur and no scroll trigger.
- A second decorative component is intentionally not added. `Magnet` changes target stability, `GlareHover` reads as retail polish, `StickerPeel` implies unsupported dragging, and persistent/background effects would compete with the design question and later drawing evidence.
- Live-browser and persistent-Chrome checks at 1440/1024/700/390 confirm the blue task island, yellow problem note, CTA feedback and responsive reflow have no document-level horizontal overflow. The apparent crop in the first raw headless screenshot came from Chrome's minimum outer-window behavior; Playwright viewport metrics remained exactly equal at every acceptance width.

## M12 Global studio-canvas correction

- The user's 2048px screenshot exposes a composition problem hidden by the earlier 1440px checks: the homepage stops at a 1040px centered island, leaving roughly half of an ultra-wide viewport as undifferentiated gray. The page has color but no full-screen visual field.
- The requested correction is global, not another homepage-only accent. Home, result wall, empty/loading states and drawers need to inherit the same architectural canvas vocabulary while keeping evidence semantics and drawing legibility intact.
- Approved system expansion: a tiled drafting grid, registration/crop marks and exactly one route-specific off-canvas plan or section fragment using only the existing graphite, blueprint and marker palette. These are static, `aria-hidden`, pointer-inert and reduced on compact screens; fake dimensions, axes and arbitrary decorative shapes remain prohibited.
- Layout correction: widen the homepage working frame on large screens and use the side margins as intentional annotation zones; do not simply stretch form controls edge to edge or fill the space with extra feature cards.
- Success criteria: no inert ultra-wide field at 2048px, coherent visual continuity in home and result routes, no decoration over interactive content, no document overflow at 390/700/1024/1440/2048, and unchanged task behavior.
- Exact 2048px baseline: the composer is 1040px (50.8% of the viewport), the shared workspace stops at 1440px and the result wall stops at 1320px with only four columns. Both routes leave 304–504px of blank space on each side, so the issue affects the whole product rather than only the homepage.
- Ultra-wide structure needs a dedicated wider frame. The final direction keeps four result columns and enlarges each drawing sheet instead of adding a fifth dense column; image legibility is more valuable than maximizing item count.
- Mature canvas products treat the viewport itself as the work surface: tldraw uses an inset-0 canvas and camera framing; Miro/FigJam use subtle grids plus frames/sections to make spatial emptiness navigable; Excalidraw derives identity from a consistent line language rather than ambient effects. Sources: https://github.com/tldraw/tldraw, https://help.figma.com/hc/en-us/articles/15300412458647-Explore-FigJam-files, https://help.miro.com/hc/en-us/articles/360018261813-Frames and https://github.com/excalidraw/excalidraw
- The transferable rule is a low-contrast spatial reference layer rather than a marketing background: global grid and frame/crop marks at rest, page-specific diagram fragments in wide margins, and no continuous animation.
- Code boundary: mount one `StudioBackdrop` before the sticky header inside `.research-desk`, tag it with the current home/results view, and keep its own fixed overflow-clipped container pointer-inert. Do not add transform, filter, containment or z-index to `.board-workspace`, because that would interfere with fixed drawers and modal stacking.
- First 2048px implementation check: the home composer and result wall both expand to 1600px inside a 1760px shell with exact `scrollWidth === clientWidth`. The four problem starters become one horizontal launch strip; result drawings remain four larger columns.
- The global 128px registration grid, one cropped plan fragment on home and one cropped section fragment on results now make the unused margins read as an architectural working field. Each route shows only its own diagram and the result route reduces background strength, so decoration does not compete with drawing evidence.
- Final responsive acceptance covers 2048, 1440, 1024, 700 and 390px with no document-level horizontal overflow. Diagram fragments appear only above 1380px, the grid softens at 860px and disappears at 620px; modal/drawer content remains above the backdrop with an opaque surface and locked page scroll.
- M12 ships without a new animation dependency. The existing task-bound `ClickSpark` remains the only expressive motion, while the global canvas is static and supports `prefers-reduced-motion` by construction.
- Tablet QA found the only non-blocking usability gap: 700px header actions were 38px high and comparison controls were 30px. The `≤860px` global contract now promotes both to 44px, keeps card actions visible for touch input and preserves the two-column result wall without overflow.
- Repository verification after M12 passes 105 API tests, 39 Board tests, 111 extension tests and 6 packaged-Chrome E2E cases, plus Python/TypeScript lint, type checks, production builds, PowerShell contracts and all 30/108 evaluation fixtures.

## M13 Research prompt vertical proportion

- The 1600px-wide composer made the former 108px textarea read as a shallow strip. The user's requested correction is vertical working space, not another width increase or a chat-style layout change.
- The prompt now uses one semantic responsive token: 152px on desktop, 132px at `≤860px` and the existing 108px at `≤620px`. Vertical resize remains available for longer briefs.
- Exact Chromium acceptance at 2048/1440/1024/700/390px confirms the intended heights, unchanged mobile density and no document-level horizontal overflow. The design detector reports zero findings; Board verification passes 40 tests plus lint, typecheck and production build.
