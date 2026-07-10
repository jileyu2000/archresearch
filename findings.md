# Findings

## Environment

- Workspace started empty except for `work/` and `outputs/`.
- No existing Git repository or code needs preservation.
- Bundled runtimes are available for Python, Node.js, pnpm, documents, and browser testing.

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
- Chrome MV3 supports optional host permissions; extension code must be bundled and cannot execute remotely hosted code.
- Playwright tests MV3 extensions through a persistent Chromium context.

