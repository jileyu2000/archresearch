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

  it("bounds media enumeration work on pages with a heavy DOM", () => {
    document.body.innerHTML = Array.from(
      { length: 650 },
      (_, index) =>
        `<a href="/explore/note-${index}"><img src="https://images.example/${index}.jpg" alt="Drawing ${index}"></a>`,
    ).join("");
    const getBounds = vi.fn(() => ({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      right: 650,
      bottom: 500,
      width: 640,
      height: 480,
      toJSON: () => ({}),
    }));
    document.querySelectorAll("img").forEach((image, index) => {
      Object.defineProperty(image, "getBoundingClientRect", {
        value: getBounds,
      });
      Object.defineProperties(image, {
        naturalWidth: { value: 1_600 },
        naturalHeight: { value: 900 },
        currentSrc: { value: `https://images.example/${index}.jpg` },
      });
    });

    const media = collectMedia(document);

    expect(media).toHaveLength(100);
    expect(media.at(-1)?.alt).toBe("Drawing 99");
    expect(getBounds.mock.calls.length).toBeLessThanOrEqual(200);
  });

  it("stops scanning after a bounded number of unusable media nodes", () => {
    document.body.innerHTML = "<img>".repeat(650);
    const getBounds = vi.fn(() => ({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      right: 20,
      bottom: 30,
      width: 10,
      height: 10,
      toJSON: () => ({}),
    }));
    document.querySelectorAll("img").forEach((image) => {
      Object.defineProperty(image, "getBoundingClientRect", {
        value: getBounds,
      });
    });

    expect(collectMedia(document)).toEqual([]);
    expect(getBounds.mock.calls.length).toBeLessThanOrEqual(1_000);
  });

  it("returns promptly when the media collection time budget is exhausted", () => {
    document.body.innerHTML = `
      <img src="https://images.example/section.jpg" alt="旧厂房剖面">
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });
    const now = vi
      .spyOn(window.performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValue(2_000);

    expect(collectMedia(document)).toEqual([]);
    expect(now).toHaveBeenCalled();
  });

  it("associates a visible thumbnail with its bounded same-page source link", () => {
    document.body.innerHTML = `
      <a href="/explore/note-42">
        <img src="https://images.example/section.jpg" alt="旧厂房剖面">
        <span>旧厂房更新：架空步道与公共展厅的剖面关系</span>
      </a>
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
        link_url: "http://localhost:3000/explore/note-42",
        adjacent_text: "旧厂房更新：架空步道与公共展厅的剖面关系",
      }),
    ]);
  });

  it("associates media with a nearby sibling link in the same card", () => {
    document.body.innerHTML = `
      <article class="note-card">
        <a href="/explore/note-84">旧厂房改造剖面</a>
        <div class="cover"><img src="https://images.example/section.jpg" alt="旧厂房剖面"></div>
      </article>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });

    expect(collectMedia(document)[0]).toEqual(
      expect.objectContaining({
        link_url: "http://localhost:3000/explore/note-84",
        adjacent_text: "旧厂房改造剖面",
      }),
    );
  });

  it("clicks only the exact Xiaohongshu note link from a search result page", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `
      <section class="note-item">
        <a href="https://www.xiaohongshu.com/explore/note-41">另一个笔记</a>
        <a id="target" href="https://www.xiaohongshu.com/explore/note-42?xsec_token=visible">
          精细线稿剖面图
        </a>
      </section>
    `;
    const target = document.querySelector<HTMLAnchorElement>("#target")!;
    const click = vi.fn((event: Event) => event.preventDefault());
    target.addEventListener("click", click);

    expect(
      executeContentCommand(document, window, {
        action: "open_xiaohongshu_note",
        note_url:
          "https://www.xiaohongshu.com/explore/note-42?xsec_token=visible",
      }),
    ).toEqual({ opened: true });
    expect(click).toHaveBeenCalledOnce();

    expect(
      executeContentCommand(document, window, {
        action: "open_xiaohongshu_note",
        note_url: "https://www.xiaohongshu.com/explore/note-99",
      }),
    ).toEqual({ opened: false });
  });

  it("matches a note by its safe path when the card adds a query token", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `
      <section class="note-item">
        <a id="target" href="https://www.xiaohongshu.com/search_result/note-42?xsec_token=visible">
          精细线稿剖面图
        </a>
      </section>
    `;
    const target = document.querySelector<HTMLAnchorElement>("#target")!;
    const click = vi.fn((event: Event) => event.preventDefault());
    target.addEventListener("click", click);

    expect(
      executeContentCommand(document, window, {
        action: "open_xiaohongshu_note",
        note_url: "https://www.xiaohongshu.com/search_result/note-42",
      }),
    ).toEqual({ opened: true });
    expect(click).toHaveBeenCalledOnce();
  });

  it("associates deeply nested media with the bounded semantic card link", () => {
    document.body.innerHTML = `
      <section class="note-item">
        <div><div><div><div><div><div>
          <img src="https://images.example/section.jpg" alt="旧厂房剖面">
        </div></div></div></div></div></div>
        <footer>
          <a href="/explore/note-126?xsec_token=visible">旧厂房剖面叙事与线型层级</a>
        </footer>
      </section>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });

    expect(collectMedia(document)[0]).toEqual(
      expect.objectContaining({
        link_url:
          "http://localhost:3000/explore/note-126?xsec_token=visible",
        adjacent_text: "旧厂房剖面叙事与线型层级",
      }),
    );
  });

  it("keeps a note link when a card has more than eight auxiliary links", () => {
    document.body.innerHTML = `
      <section class="note-item">
        <div class="cover"><img src="https://images.example/section.jpg" alt="剖面图"></div>
      </section>
    `;
    const card = document.querySelector("section.note-item")!;
    for (let index = 0; index < 8; index += 1) {
      const auxiliary = document.createElement("a");
      auxiliary.href = `/user/profile/author-${index}`;
      auxiliary.textContent = `作者 ${index}`;
      card.appendChild(auxiliary);
    }
    const note = document.createElement("a");
    note.href = "/explore/note-210?xsec_token=visible";
    note.textContent = "精细线稿剖面图";
    card.appendChild(note);

    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });

    expect(collectMedia(document)[0]).toEqual(
      expect.objectContaining({
        link_url:
          "http://localhost:3000/explore/note-210?xsec_token=visible",
        adjacent_text: "精细线稿剖面图",
      }),
    );
  });

  it("does not treat a generic page section as one media card", () => {
    document.body.innerHTML = `
      <section class="feeds-container">
        <a href="/explore/unrelated-note">页面级导航链接</a>
        <div><div><img src="https://images.example/section.jpg" alt="旧厂房剖面"></div></div>
      </section>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/section.jpg" },
    });

    expect(collectMedia(document)[0]).toEqual(
      expect.objectContaining({
        link_url: null,
        adjacent_text: "",
      }),
    );
  });

  it("does not associate a thumbnail with an external-site anchor", () => {
    document.body.innerHTML = `
      <a href="https://tracking.example/redirect">
        <img src="https://images.example/plan.jpg" alt="平面图">
      </a>
    `;
    const image = document.querySelector("img")!;
    makeVisible(image);
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
      currentSrc: { value: "https://images.example/plan.jpg" },
    });

    expect(collectMedia(document)[0]).toEqual(
      expect.objectContaining({ link_url: null }),
    );
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

  it("keeps only unobscured image media on an open Xiaohongshu note", () => {
    window.history.replaceState(
      {},
      "",
      "/search_result/note-42?xsec_token=visible",
    );
    document.body.innerHTML = `
      <main class="feeds-container">
        <img id="background" src="https://sns-webpic-qc.xhscdn.com/background.webp" alt="Background feed image">
      </main>
      <svg id="page-shell" viewBox="0 0 1200 800" aria-label="Page shell"></svg>
      <div id="note-overlay" role="dialog" aria-modal="true">
        <img id="note-media" src="https://sns-webpic-qc.xhscdn.com/note.webp" alt="Current note section drawing">
      </div>
    `;
    const background = document.querySelector<HTMLImageElement>("#background")!;
    const noteMedia = document.querySelector<HTMLImageElement>("#note-media")!;
    const pageShell = document.querySelector<SVGElement>("#page-shell")!;
    const overlay = document.querySelector<HTMLElement>("#note-overlay")!;
    makeVisible(background, 640, 480);
    makeVisible(pageShell, 1_200, 800);
    Object.defineProperty(noteMedia, "getBoundingClientRect", {
      value: () => ({
        x: 500,
        y: 20,
        top: 20,
        left: 500,
        right: 1_100,
        bottom: 780,
        width: 600,
        height: 760,
        toJSON: () => ({}),
      }),
    });
    for (const image of [background, noteMedia]) {
      Object.defineProperties(image, {
        naturalWidth: { value: 1_600 },
        naturalHeight: { value: 1_200 },
        currentSrc: { value: image.getAttribute("src") },
      });
    }
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(
      document,
      "elementFromPoint",
    );
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (x: number) => (x >= 500 ? noteMedia : overlay),
    });

    try {
      expect(collectMedia(document)).toEqual([
        expect.objectContaining({
          media_type: "image",
          url: "https://sns-webpic-qc.xhscdn.com/note.webp",
          alt: "Current note section drawing",
        }),
      ]);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(
          document,
          "elementFromPoint",
          originalElementFromPoint,
        );
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }
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

  it("reports a Xiaohongshu login wall without returning page or account data", () => {
    window.history.replaceState({}, "", "/website-login/error?error_code=300031");
    document.body.innerHTML = `<main><p>登录后查看搜索结果</p><form><input type="password"></form></main>`;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "not_logged_in" });
  });

  it("reports a Xiaohongshu safety-verification redirect separately", () => {
    window.history.replaceState(
      {},
      "",
      "/website-login/captcha?redirectPath=%2Fsearch_result&verifyType=124",
    );
    document.body.innerHTML = `<main><h1>安全验证</h1></main>`;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "verification_required" });
  });

  it("reports a visible Xiaohongshu login control before its modal opens", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `<header><button class="login-button">登录</button></header>`;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "not_logged_in" });
  });

  it("reports a visible Xiaohongshu user shell before note cards render", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `
      <header><a class="user-avatar" href="/user/profile/private-id"><img alt=""></a></header>
      <main><div class="feeds-container"></div></main>
    `;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "logged_in" });
  });

  it("reports a Xiaohongshu profile entry without relying on avatar classes", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `<nav><a href="/user/profile/private-id">我</a></nav>`;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "logged_in" });
  });

  it("reports a usable classless Xiaohongshu note link", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `
      <main class="feeds-container">
        <div><a href="/explore/note-42?xsec_token=private-token">Private note</a></div>
      </main>
    `;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "logged_in" });
  });

  it("reports a usable Xiaohongshu search session without returning note data", () => {
    window.history.replaceState({}, "", "/search_result?keyword=architecture");
    document.body.innerHTML = `
      <section class="note-item">
        <a href="/search_result/note-42?xsec_token=private-token">
          <span>Private account and note content</span>
        </a>
      </section>
    `;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "logged_in" });
  });

  it("does not infer a Xiaohongshu session from an unrelated page", () => {
    document.body.innerHTML = `<section class="note-item"><a href="/explore/note-1">Note</a></section>`;

    expect(
      executeContentCommand(document, window, {
        action: "xiaohongshu_session_status",
      }),
    ).toEqual({ status: "unknown" });
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
