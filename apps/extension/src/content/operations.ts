import type { SafeClickTarget } from "../protocol";

export type MediaCandidate = {
  media_type: "image" | "canvas" | "svg";
  url: string | null;
  link_url: string | null;
  alt: string;
  adjacent_text: string;
  intrinsic_width: number;
  intrinsic_height: number;
  region: { x: number; y: number; width: number; height: number };
};

export type ContentCommand =
  | { action: "page_metadata" }
  | { action: "page_snapshot" }
  | { action: "xiaohongshu_session_status" }
  | { action: "enumerate_media" }
  | { action: "viewport_metrics" }
  | { action: "scroll"; direction: "up" | "down"; distance: number }
  | { action: "safe_click"; target: SafeClickTarget }
  | { action: "type_search_query"; query: string };

const SENSITIVE_CONTEXT =
  /(?:password|passcode|sign[ -]?in|log[ -]?in|auth|private[ -]?messages?|direct[ -]?messages?|inbox|chat|checkout|payment|credit[ -]?card|account|comment)/iu;
const SENSITIVE_PAGE_PATH =
  /(?:^|\/)(?:messages?|inbox|chat|account|login|sign-in|signin|settings)(?:\/|$)/iu;
const MAX_SCANNED_MEDIA_NODES = 500;
const MAX_MEDIA_CANDIDATES = 100;
const MAX_MEDIA_COLLECTION_MILLISECONDS = 1_500;

export function collectMedia(root: Document): MediaCandidate[] {
  if (isSensitivePage(root)) {
    return [];
  }
  const candidates: MediaCandidate[] = [];
  const startedAt = mediaClock(root);
  let scannedNodes = 0;
  for (const element of boundedMediaElements(root)) {
    if (
      mediaClock(root) - startedAt >= MAX_MEDIA_COLLECTION_MILLISECONDS ||
      scannedNodes >= MAX_SCANNED_MEDIA_NODES ||
      candidates.length >= MAX_MEDIA_CANDIDATES
    ) {
      break;
    }
    scannedNodes += 1;
    if (isSensitive(element)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (!isVisible(element, rect)) {
      continue;
    }
    const dimensions = getIntrinsicDimensions(element, rect);
    if (
      rect.width < 120 ||
      rect.height < 80 ||
      dimensions.width < 240 ||
      dimensions.height < 160
    ) {
      continue;
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
      link_url: findSourceLink(element, root),
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
  }
  return candidates;
}

function* boundedMediaElements(root: Document): Generator<Element> {
  let yielded = 0;
  for (const tagName of ["img", "canvas", "svg"] as const) {
    const elements = root.getElementsByTagName(tagName);
    const limit = Math.min(elements.length, MAX_SCANNED_MEDIA_NODES - yielded);
    for (let index = 0; index < limit; index += 1) {
      const element = elements.item(index);
      if (element) {
        yielded += 1;
        yield element;
      }
    }
    if (yielded >= MAX_SCANNED_MEDIA_NODES) return;
  }
}

function mediaClock(root: Document): number {
  return root.defaultView?.performance.now() ?? Date.now();
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
    case "xiaohongshu_session_status":
      return readXiaohongshuSessionStatus(root, view);
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

function readXiaohongshuSessionStatus(
  root: Document,
  view: Window & typeof globalThis,
): {
  status: "logged_in" | "not_logged_in" | "verification_required" | "unknown";
} {
  const path = `${view.location.pathname}${view.location.search}`;
  if (/website-login\/captcha(?:[/?#]|$)/iu.test(path)) {
    return { status: "verification_required" };
  }
  if (
    /(?:^|\/)login(?:[/?#]|$)|website-login\/error|error_code=(?:300017|300031)/iu.test(
      path,
    )
  ) {
    return { status: "not_logged_in" };
  }
  const pageText = (root.body?.innerText || root.body?.textContent || "").slice(
    0,
    100_000,
  );
  const hasLoginControl = Array.from(
    root.querySelectorAll('button, a, [role="button"], [class*="login"]'),
  ).some((element) => (element.textContent ?? "").trim() === "登录");
  if (
    root.querySelector('input[type="password"]') ||
    /(?:登录后查看搜索结果|登录后查看|请先登录)/u.test(pageText) ||
    hasLoginControl
  ) {
    return { status: "not_logged_in" };
  }
  if (
    root.querySelector(
      'header [class*="avatar"], nav [class*="avatar"], aside [class*="avatar"], [class*="user-avatar"], a[href*="/user/profile/"]',
    )
  ) {
    return { status: "logged_in" };
  }
  if (
    view.location.pathname.startsWith("/search_result") &&
    root.querySelector(
      'a[href*="/search_result/"], a[href*="/explore/"]',
    )
  ) {
    return { status: "logged_in" };
  }
  return { status: "unknown" };
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

function isVisible(
  element: Element,
  rect = element.getBoundingClientRect(),
): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }
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
    const captionText = normalizeText(caption.textContent ?? "", 500);
    if (captionText) return captionText;
  }
  const link = element.closest("a[href]");
  if (link && !isSensitive(link)) {
    const linkText = normalizeText(link.textContent ?? "", 500);
    if (linkText) return linkText;
  }
  for (const cardLink of boundedSemanticCardLinks(element, element.ownerDocument)) {
    if (isSensitive(cardLink)) continue;
    const cardText = normalizeText(cardLink.textContent ?? "", 500);
    if (cardText) return cardText;
  }
  return "";
}

function findSourceLink(element: Element, root: Document): string | null {
  const directLink = samePageLink(
    element.closest<HTMLAnchorElement>("a[href]"),
    root,
  );
  if (directLink) return directLink;

  for (const link of boundedSemanticCardLinks(element, root)) {
    const source = samePageLink(link, root);
    if (source) return source;
  }

  let container = element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1) {
    if (
      container === root.body ||
      container === root.documentElement ||
      container.matches("main, section, article, li, figure")
    ) {
      break;
    }
    const links = container.getElementsByTagName("a");
    if (links.length <= 8) {
      for (let index = 0; index < links.length; index += 1) {
        const link = links.item(index);
        if (!link || !link.hasAttribute("href")) continue;
        const source = samePageLink(link, root);
        if (source) return source;
      }
    }
    container = container.parentElement;
  }
  return null;
}

function boundedSemanticCardLinks(
  element: Element,
  root: Document,
): HTMLAnchorElement[] {
  const card = element.closest("figure, article, li, section.note-item");
  if (
    !card ||
    card === root.body ||
    card === root.documentElement ||
    card.matches("main")
  ) {
    return [];
  }
  const links = card.getElementsByTagName("a");
  if (links.length > 8) return [];
  const bounded: HTMLAnchorElement[] = [];
  for (let index = 0; index < links.length; index += 1) {
    const link = links.item(index);
    if (link?.hasAttribute("href")) bounded.push(link);
  }
  return bounded;
}

function samePageLink(
  link: HTMLAnchorElement | null,
  root: Document,
): string | null {
  if (!link || isSensitive(link)) return null;
  try {
    const source = new URL(link.href, root.location.href);
    const page = new URL(root.location.href);
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.username ||
      source.password ||
      source.origin !== page.origin
    ) {
      return null;
    }
    return source.href.slice(0, 4_000);
  } catch {
    return null;
  }
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
