# ArchResearch V2.1 Design Specification

## Product Outcome

ArchResearch is a local-first research agent for architecture students and early-career designers. A user provides a concrete design question plus optional images, PDFs, or URLs. The system performs bounded multi-round web research, identifies architectural drawings, verifies the relationship between assets and source projects, and composes a reusable evidence board.

The final artifact is not a chat answer. It is a structured research board containing drawing candidates, source evidence, visual observations, design inferences, limitations, comparison controls, and export policies.

## Runtime Architecture

The product has three runtimes:

1. A React/Vite board for workspace inputs, run progress, evidence cards, comparison, exports, style profiles, and traces.
2. A local FastAPI process for SQLite persistence, uploads, research orchestration, model/provider calls, evidence ranking, TTL cleanup, and exports.
3. A Chrome Manifest V3 extension for paired, user-visible page inspection through the user's existing browser session.

The API listens only on loopback. The extension pairs using a one-time code and receives enumerated JSON commands over WebSocket. It never receives executable JavaScript or arbitrary selector programs.

## Research Behavior

Supported research goals are `precedent_research`, `source_lookup`, and `visual_reference_search`. Export and style extraction are post-processing actions.

The deterministic loop is:

1. Validate and normalize a `ResearchSpec`.
2. Generate bounded Chinese and English query batches.
3. Search current text and image results.
4. Inspect candidate pages through Chrome.
5. Locally enumerate and filter visual assets.
6. Classify drawing type and analyze relevance.
7. Verify project identity, asset association, publication tier, primary-source confidence, and rights status.
8. Produce a coverage report and repeat only when concrete evidence gaps remain within budget.
9. Deduplicate, rank by evidence tier and relevance rubric, then compose the board.

Quick, Balanced, and Deep modes have fixed round/query/page/time budgets. Partial usable work is always returned when later stages fail.

## Data Boundaries

No global case library, vector index, or cross-workspace corpus exists. `SourcePage` and `AssetCandidate` rows are scoped to a run. Only explicit `SavedReference` records persist with a workspace.

Temporary DOM snapshots and candidate crops expire after 7 days. Run evidence and trace metadata expire after 30 days. User uploads, saved references, boards, and style profiles persist until deletion.

Every formal fact is bound to an `EvidenceClaim` containing a URL or PDF locator. Results are split into `verified`, `partial`, and `visual_lead` tiers. Rights status is independent from provenance status.

## Security Boundaries

Page content is untrusted data and cannot issue instructions. Browser actions are restricted to navigation, safe expansion, scrolling, media enumeration, region capture, and explicit search-box input. Cookie/storage access, passwords, messages, purchases, social actions, and ordinary form submission are prohibited.

Only candidate crops and adjacent source context may be sent to cloud models. Full signed-in page screenshots, cookies, and form data are excluded from provider payloads and traces. Optional host access is requested per run and revoked at run termination.

## Interface Direction

The interface is an architectural evidence desk. It uses a restrained vellum/graphite/blueprint palette, dense drawing metadata, an evidence rail on every card, and a three-zone layout: project rail, drawing board, and source inspector. The research stage rail provides progress without interrupting the autonomous run.

## Acceptance

The implementation must provide deterministic mock mode, test the API/extension protocol, persist and resume state transitions, deliver partial results on failures, enforce share-export rights gates, and build all three runtimes successfully. Live provider calls remain opt-in through local secrets.

