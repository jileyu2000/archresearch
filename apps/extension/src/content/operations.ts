import type { SafeClickTarget } from "../protocol";

export type MediaCandidate = {
  media_type: "image" | "canvas" | "svg";
  url: string | null;
  alt: string;
  adjacent_text: string;
  intrinsic_width: number;
  intrinsic_height: number;
  region: { x: number; y: number; width: number; height: number };
};

export type ContentCommand =
  | { action: "page_metadata" }
  | { action: "page_snapshot" }
  | { action: "enumerate_media" }
  | { action: "viewport_metrics" }
  | { action: "scroll"; direction: "up" | "down"; distance: number }
  | { action: "safe_click"; target: SafeClickTarget }
  | { action: "type_search_query"; query: string };

const SENSITIVE_CONTEXT =
  /(?:password|passcode|sign[ -]?in|log[ -]?in|auth|private[ -]?messages?|direct[ -]?messages?|inbox|chat|checkout|payment|credit[ -]?card|account|comment)/iu;
const SENSITIVE_PAGE_PATH =
  /(?:^|\/)(?:messages?|inbox|chat|account|login|sign-in|signin|settings)(?:\/|$)/iu;

export function collectMedia(root: Document): MediaCandidate[] {
  if (isSensitivePage(root)) {
    return [];
  }
  const candidates: MediaCandidate[] = [];
  root.querySelectorAll("img, canvas, svg").forEach((element) => {
    if (isSensitive(element) || !isVisible(element)) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const dimensions = getIntrinsicDimensions(element, rect);
    if (
      rect.width < 120 ||
      rect.height < 80 ||
      dimensions.width < 240 ||
      dimensions.height < 160
    ) {
      return;
    }

    const mediaType =
      element instanceof root.defaultView!.HTMLImageElement
        ? "image"
        : element instanceof root.defaultView!.HTMLCanvasElement
          ? "canvas"
          : "svg";
    const rawUrl =
      mediaType === "image"
        ? ((element as HTMLImageElement).currentSrc ||
          (element as HTMLImageElement).src)
        : null;
    const url = rawUrl && /^https?:\/\//iu.test(rawUrl) ? rawUrl : null;

    candidates.push({
      media_type: mediaType,
      url,
      alt: normalizeText(
        element.getAttribute("alt") ?? element.getAttribute("aria-label") ?? "",
        240,
      ),
      adjacent_text: findAdjacentText(element),
      intrinsic_width: dimensions.width,
      intrinsic_height: dimensions.height,
      region: {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  });
  return candidates;
}

export function executeContentCommand(
  root: Document,
  view: Window & typeof globalThis,
  command: ContentCommand,
): unknown {
  switch (command.action) {
    case "page_metadata":
      return readPageMetadata(root, view);
    case "page_snapshot":
      return readPageSnapshot(root);
    case "enumerate_media":
      return { media: collectMedia(root) };
    case "viewport_metrics":
      return { width: view.innerWidth, height: view.innerHeight };
    case "scroll":
      view.scrollBy({
        top: command.direction === "down" ? command.distance : -command.distance,
        behavior: "auto",
      });
      return { scrolled: true };
    case "safe_click":
      return safeClick();
    case "type_search_query":
      return typeSearchQuery(root, view, command.query);
  }
}

function readPageSnapshot(root: Document): {
  blocks: Array<{ kind: "heading" | "paragraph" | "caption"; text: string }>;
  truncated: boolean;
} {
  if (isSensitivePage(root)) {
    throw new Error("Sensitive page context cannot be extracted");
  }
  const blocks: Array<{
    kind: "heading" | "paragraph" | "caption";
    text: string;
  }> = [];
  const seen = new Set<string>();
  let characters = 0;
  let truncated = false;
  for (const element of root.querySelectorAll("h1, h2, h3, p, figcaption")) {
    if (isSensitive(element) || !isVisible(element)) continue;
    const text = normalizeText(element.textContent ?? "", 500);
    if (!text || seen.has(text)) continue;
    if (blocks.length >= 40 || characters + text.length > 6_000) {
      truncated = true;
      break;
    }
    const kind = element.matches("h1, h2, h3")
      ? "heading"
      : element.matches("figcaption")
        ? "caption"
        : "paragraph";
    blocks.push({ kind, text });
    seen.add(text);
    characters += text.length;
  }
  return { blocks, truncated };
}

function readPageMetadata(
  root: Document,
  view: Window & typeof globalThis,
): Record<string, unknown> {
  if (isSensitivePage(root)) {
    throw new Error("Sensitive page context cannot be extracted");
  }
  const canonical = root.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const description = root.querySelector<HTMLMetaElement>(
    'meta[name="description"], meta[property="og:description"]',
  );
  const publisher = root.querySelector<HTMLMetaElement>(
    'meta[property="og:site_name"], meta[name="publisher"]',
  );
  return {
    url: view.location.href,
    title: normalizeText(root.title, 300),
    canonical_url: canonical?.href ?? null,
    language: root.documentElement.lang || null,
    description: normalizeText(description?.content ?? "", 1_000) || null,
    publisher: normalizeText(publisher?.content ?? "", 300) || null,
  };
}

function safeClick(): { clicked: boolean } {
  // Page labels cannot prove that invoking a page-owned handler is side-effect free.
  return { clicked: false };
}

function typeSearchQuery(
  root: Document,
  view: Window & typeof globalThis,
  query: string,
): { typed: boolean } {
  const inputs = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="search"], [role="searchbox"], form[role="search"] input, form[role="search"] textarea',
  );
  const input = Array.from(inputs).find(
    (candidate) =>
      !candidate.disabled &&
      !candidate.readOnly &&
      candidate.getAttribute("type") !== "password" &&
      !isSensitive(candidate),
  );
  if (!input) {
    return { typed: false };
  }

  const prototype =
    input instanceof view.HTMLTextAreaElement
      ? view.HTMLTextAreaElement.prototype
      : view.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(input, query.slice(0, 500));
  input.dispatchEvent(new view.Event("input", { bubbles: true }));
  input.dispatchEvent(new view.Event("change", { bubbles: true }));
  return { typed: true };
}

function getIntrinsicDimensions(
  element: Element,
  rect: DOMRect,
): { width: number; height: number } {
  if (element instanceof element.ownerDocument.defaultView!.HTMLImageElement) {
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
    };
  }
  if (element instanceof element.ownerDocument.defaultView!.HTMLCanvasElement) {
    return { width: element.width, height: element.height };
  }
  const viewBox = element.getAttribute("viewBox")?.trim().split(/[ ,]+/u).map(Number);
  return {
    width: viewBox?.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2]! : rect.width,
    height:
      viewBox?.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3]! : rect.height,
  };
}

function isVisible(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  return (
    view !== null &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x < view.innerWidth &&
    rect.y < view.innerHeight &&
    rect.x + rect.width > 0 &&
    rect.y + rect.height > 0
  );
}

function isSensitive(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.matches('[hidden], [aria-hidden="true"], input[type="password"]')) {
      return true;
    }
    if (current.tagName === "FORM" && current.getAttribute("role") !== "search") {
      return true;
    }
    const markers = [
      current.id,
      current.className,
      current.getAttribute("aria-label"),
      current.getAttribute("data-testid"),
      current.getAttribute("role"),
      current.getAttribute("name"),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    if (SENSITIVE_CONTEXT.test(markers)) {
      return true;
    }
  }
  return false;
}

function findAdjacentText(element: Element): string {
  const figure = element.closest("figure");
  const caption = figure?.querySelector("figcaption");
  if (caption && !isSensitive(caption)) {
    return normalizeText(caption.textContent ?? "", 500);
  }
  return "";
}

function isSensitivePage(root: Document): boolean {
  let pathname = "";
  try {
    pathname = new URL(root.location.href).pathname;
  } catch {
    // Documents without a navigable URL are judged only by their page markers.
  }
  if (SENSITIVE_PAGE_PATH.test(pathname)) {
    return true;
  }
  if (root.querySelector('input[type="password"]')) {
    return true;
  }
  const pageMarkers = [
    root.title,
    root.documentElement.id,
    root.documentElement.className,
    root.body?.id,
    root.body?.className,
    root.querySelector("main")?.getAttribute("aria-label"),
    root.querySelector("main")?.getAttribute("data-testid"),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return SENSITIVE_CONTEXT.test(pageMarkers);
}

function normalizeText(value: string, maximumLength: number): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, maximumLength);
}
