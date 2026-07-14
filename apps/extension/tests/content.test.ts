// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  collectMedia,
  executeContentCommand,
} from "../src/content/operations";

function makeVisible(element: Element, width = 640, height = 480): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      right: 10 + width,
      bottom: 20 + height,
      width,
      height,
      toJSON: () => ({}),
    }),
  });
}

describe("content operations", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
  });

  it("enumerates visible drawing media with bounded adjacent text", () => {
    document.body.innerHTML = `
      <main>
        <figure>
          <img src="https://images.example/section.jpg" alt="Longitudinal section">
          <figcaption>Adaptive reuse section showing the new circulation core.</figcaption>
        </figure>
      </main>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });

    expect(collectMedia(document)).toEqual([
      expect.objectContaining({
        media_type: "image",
        url: "https://images.example/section.jpg",
        alt: "Longitudinal section",
        adjacent_text:
          "Adaptive reuse section showing the new circulation core.",
      }),
    ]);
  });

  it("excludes drawing media outside the visible viewport", () => {
    document.body.innerHTML = `
      <img id="visible" src="https://images.example/visible.jpg" alt="Visible plan">
      <img id="below" src="https://images.example/below.jpg" alt="Plan below fold">
    `;
    const [visible, below] = Array.from(document.querySelectorAll("img"));
    makeVisible(visible!);
    Object.defineProperty(below, "getBoundingClientRect", {
      value: () => ({
        x: 10,
        y: window.innerHeight + 100,
        top: window.innerHeight + 100,
        left: 10,
        right: 650,
        bottom: window.innerHeight + 580,
        width: 640,
        height: 480,
        toJSON: () => ({}),
      }),
    });
    for (const image of [visible!, below!]) {
      Object.defineProperties(image, {
        naturalWidth: { value: 1_600 },
        naturalHeight: { value: 900 },
        currentSrc: { value: image.getAttribute("src") },
      });
    }

    expect(collectMedia(document).map((item) => item.alt)).toEqual([
      "Visible plan",
    ]);
  });

  it("excludes media inside credential, chat, and hidden regions", () => {
    document.body.innerHTML = `
      <form aria-label="Sign in"><img id="login" src="https://images.example/login.jpg"></form>
      <section aria-label="Private messages"><img id="chat" src="https://images.example/chat.jpg"></section>
      <div aria-hidden="true"><img id="hidden" src="https://images.example/hidden.jpg"></div>
    `;
    document.querySelectorAll("img").forEach((image) => {
      makeVisible(image);
      Object.defineProperties(image, {
        naturalWidth: { value: 800 },
        naturalHeight: { value: 600 },
        currentSrc: { value: image.getAttribute("src") },
      });
    });

    expect(collectMedia(document)).toEqual([]);
  });

  it("types only into an explicit search field without submitting the form", () => {
    document.body.innerHTML = `
      <form id="search-form" role="search"><input id="search" type="search"></form>
      <form id="account"><input id="email" name="email"></form>
    `;
    const submit = vi.fn((event: Event) => event.preventDefault());
    document.querySelector("#search-form")!.addEventListener("submit", submit);

    const result = executeContentCommand(document, window, {
      action: "type_search_query",
      query: "museum circulation diagram",
    });

    expect(result).toEqual({ typed: true });
    expect((document.querySelector("#search") as HTMLInputElement).value).toBe(
      "museum circulation diagram",
    );
    expect((document.querySelector("#email") as HTMLInputElement).value).toBe("");
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not invoke a page click handler based on a spoofed media label", () => {
    document.body.innerHTML = `
      <button id="like">Like</button>
      <button id="next" aria-label="Next image">Publish draft</button>
    `;
    const like = vi.fn();
    const next = vi.fn();
    document.querySelector("#like")!.addEventListener("click", like);
    document.querySelector("#next")!.addEventListener("click", next);

    expect(
      executeContentCommand(document, window, {
        action: "safe_click",
        target: "next_media",
      }),
    ).toEqual({ clicked: false });
    expect(next).not.toHaveBeenCalled();
    expect(like).not.toHaveBeenCalled();
  });

  it("does not invoke an inline onclick through a safe-click command", () => {
    document.body.innerHTML = `<a id="more" href="https://example.com/submit" aria-label="Load more">Load more</a>`;
    const control = document.querySelector<HTMLAnchorElement>("#more")!;
    const onClick = vi.fn();
    control.onclick = onClick;

    expect(
      executeContentCommand(document, window, {
        action: "safe_click",
        target: "load_more",
      }),
    ).toEqual({ clicked: false });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("blocks media and metadata extraction on a generic private-message page", () => {
    document.body.innerHTML = readFileSync(
      "tests/fixtures/private-message.html",
      "utf8",
    );
    window.history.replaceState({}, "", "/messages/thread-42");
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/private-plan.jpg" },
    });

    expect(collectMedia(document)).toEqual([]);
    expect(() =>
      executeContentCommand(document, window, { action: "page_metadata" }),
    ).toThrow(/sensitive page context/i);
  });

  it("does not copy broad article text into a media candidate", () => {
    document.body.innerHTML = `
      <article>
        Confidential client notes outside an explicit caption.
        <img src="https://images.example/plan.jpg" alt="Ground-floor plan">
      </article>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/plan.jpg" },
    });

    expect(collectMedia(document)).toEqual([
      expect.objectContaining({
        alt: "Ground-floor plan",
        adjacent_text: "",
      }),
    ]);
  });

  it("returns a bounded visible semantic snapshot without controls or hidden text", () => {
    document.body.innerHTML = `
      <main>
        <h1>Adaptive reuse strategy</h1>
        <p>${"Visible project description ".repeat(30)}</p>
        <figure><figcaption>Longitudinal section through the retained hall.</figcaption></figure>
        <form><p>Private account text</p></form>
        <p hidden>Hidden instructions</p>
      </main>
    `;
    document.querySelectorAll("h1, p, figcaption").forEach((element) =>
      makeVisible(element, 640, 40),
    );

    const result = executeContentCommand(document, window, {
      action: "page_snapshot",
    }) as {
      blocks: Array<{ kind: string; text: string }>;
      truncated: boolean;
    };

    expect(result.blocks).toEqual([
      { kind: "heading", text: "Adaptive reuse strategy" },
      {
        kind: "paragraph",
        text: expect.stringMatching(/^Visible project description/),
      },
      {
        kind: "caption",
        text: "Longitudinal section through the retained hall.",
      },
    ]);
    expect(result.blocks[1]!.text.length).toBeLessThanOrEqual(500);
    expect(JSON.stringify(result)).not.toContain("Private account text");
    expect(JSON.stringify(result)).not.toContain("Hidden instructions");
  });
});
