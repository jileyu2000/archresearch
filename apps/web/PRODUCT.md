# Product

## Register

- Product name: ArchResearch Web Edition
- Product owner: ArchResearch
- Status: Active product contract
- Scope: `apps/web` and the browser-visible surfaces it consumes from `apps/edge`
- Source of truth: This document defines the Web Edition product. The repository-level `DESIGN.md` defines the shared visual and interaction system.

## Users

ArchResearch Web Edition serves architecture students and early-career designers who need to turn an architectural question into evidence-backed public case research without installing a local development environment.

Users arrive through a public HTTPS page. Their long-term research history, saved results, personal collections, and backups stay in their own browser. They should not need a local runtime, command-line setup, or provider key. Public case research runs directly; Xiaohongshu visual research requires the ArchResearch Chrome extension and the user's own signed-in Xiaohongshu session.

## Product Purpose

The Web Edition is the public deployment of the existing local ArchResearch product. Case research is install-free; Xiaohongshu visual research adds one Chrome extension. The local edition is the product and interaction source of truth; the Web Edition must not invent a separate information architecture or reduced feature set. It must preserve the complete research loop:

1. Start an architectural research or visual-inspiration task.
2. Follow bounded progress and inspect partial results.
3. Read source-bound findings and compare useful cases.
4. Save individual or multiple results into personal collections.
5. Reopen history and collections later from the same browser.
6. Export and restore a versioned local backup.

It is not a simplified product demo, marketing landing page, or single-form research toy.

## Edition Contract

The Web Edition must transfer the local edition's screens, navigation, terminology, and workflows to the public deployment:

- Stable top-level navigation for home, local history, and personal collections.
- Architecture research and visual-inspiration task entry.
- Recent research, complete run history, resumable terminal results, and preserved partial progress.
- Full result views with evidence, source links, comparison tools, and export actions supported by the available result data.
- Direct and batch collection from result views.
- A dedicated personal-collections page, not a modal.
- Architecture and visual-inspiration collection tabs.
- Architecture collections grouped by the original research question and direction.
- Persistent browser-local collection snapshots with remove actions.
- Versioned backup export and restore for browser-local records.

Implementation differences must stay below the product surface wherever possible. Any unavoidable edition difference must be explicit and narrow:

- Local-file integration remains a local-edition capability.
- Public case research reads bounded public HTTPS sources through the server protocol. Xiaohongshu visual research uses the ArchResearch Chrome extension to read bounded visible note cards from the user's signed-in Chrome; cookies, credentials, and browser storage never enter the Cloudflare request.
- The main page checks for the extension and shows one install/connection notice while it is missing. Once the extension is detected, the notice stops appearing; source-specific readiness remains visible at the visual-research entry.
- Capabilities that depend on unavailable source data may show an honest unavailable state; their surrounding workflow and navigation must remain present.
- Long-term user history and collections must not be stored as a platform-wide account library.

## Brand Personality

The product should feel clear-headed, lightweight, and dependable: closer to an architect's active drawing table than a generic SaaS dashboard. It should reward inspection, comparison, and traceability without looking bureaucratic.

## Design Principles

1. Feature parity before decoration. A polished surface cannot substitute for missing workflow steps.
2. Evidence stays visible. Formal claims, provenance, and source access belong near the result they support.
3. Local ownership is legible. History, collections, and backups clearly state that they live in the current browser.
4. One architecture across editions. Shared concepts use the same names, hierarchy, and interaction patterns in local and Web editions.
5. Honest degradation. Browser limitations are explained at the point of use, not hidden by removing the feature's place in the product.
6. Calm density. Prefer strong typography, measured spacing, drawing-grid structure, and restrained color over decorative card stacks.

## Anti-References

The Web Edition must not resemble:

- A marketing hero with a form attached.
- A chat application.
- A generic card-dashboard template.
- A crippled “lite” edition with missing navigation.
- A server-owned social library or global case database.
- A UI that disguises unavailable functionality by silently deleting it.

## Accessibility & Inclusion

- Target WCAG 2.2 AA contrast and keyboard behavior.
- All interactive controls expose visible focus states and accessible names.
- Mobile touch targets are at least 44 × 44 CSS pixels where practical.
- The 390-pixel layout must not scroll horizontally.
- Status, selection, and error meaning must never rely on color alone.
- Respect `prefers-reduced-motion`.
- Use plain Chinese product language and retain usable semantics when optional media or external sources fail.
