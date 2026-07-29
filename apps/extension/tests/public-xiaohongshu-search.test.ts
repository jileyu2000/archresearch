import { describe, expect, it, vi } from "vitest";

import { PublicXiaohongshuSearch } from "../src/public-xiaohongshu-search";

describe("bounded public Xiaohongshu search", () => {
  it("plans no directions itself and deeply inspects the supplied direction note by note", async () => {
    const firstImage = {
      media_type: "image",
      url: "https://sns-webpic-qc.xhscdn.com/note-1-a.webp",
      link_url: "https://www.xiaohongshu.com/explore/note-1",
      alt: "蓝色轴测图",
      adjacent_text: "细线、蓝色编号与留白组织公共流线。",
      intrinsic_width: 640,
      intrinsic_height: 480,
      region: { x: 10, y: 20, width: 320, height: 240 },
    };
    const secondImage = {
      ...firstImage,
      url: "https://sns-webpic-qc.xhscdn.com/note-1-b.webp",
      alt: "公共流线拆解图",
      region: { x: 340, y: 20, width: 320, height: 240 },
    };
    const execute = vi.fn()
      .mockResolvedValueOnce({ tab_id: 17 })
      .mockResolvedValueOnce({ waited_ms: 3500 })
      .mockResolvedValueOnce({ media: [{
        ...firstImage,
        url: "https://sns-webpic-qc.xhscdn.com/search-thumb.webp",
      }] })
      .mockResolvedValueOnce({ scrolled: true })
      .mockResolvedValueOnce({ waited_ms: 1000 })
      .mockResolvedValueOnce({ media: [] })
      .mockResolvedValueOnce({ closed: true })
      .mockResolvedValueOnce({ tab_id: 18 })
      .mockResolvedValueOnce({ waited_ms: 2000 })
      .mockResolvedValueOnce({ media: [firstImage, secondImage] })
      .mockResolvedValueOnce({ scrolled: true })
      .mockResolvedValueOnce({ waited_ms: 500 })
      .mockResolvedValueOnce({ media: [firstImage] })
      .mockResolvedValueOnce({
        image_data_url: "data:image/png;base64,aW1hZ2UtMQ==",
        media_type: "image/png",
      })
      .mockResolvedValueOnce({
        image_data_url: "data:image/png;base64,aW1hZ2UtMg==",
        media_type: "image/png",
      })
      .mockResolvedValueOnce({ closed: true });
    const search = new PublicXiaohongshuSearch({ execute });

    await expect(search.run([{
      id: "linework",
      query: "社区图书馆 精细线稿 轴测图",
    }])).resolves.toEqual({
      sources: [
        {
          direction_id: "linework",
          source_url: "https://www.xiaohongshu.com/explore/note-1",
          title: "蓝色轴测图",
          image_url: firstImage.url,
          preview_data_url: "data:image/png;base64,aW1hZ2UtMQ==",
          adjacent_text: firstImage.adjacent_text,
        },
        {
          direction_id: "linework",
          source_url: "https://www.xiaohongshu.com/explore/note-1",
          title: "蓝色轴测图",
          image_url: secondImage.url,
          preview_data_url: "data:image/png;base64,aW1hZ2UtMg==",
          adjacent_text: secondImage.adjacent_text,
        },
      ],
      budget: {
        image_count: 2,
        preview_bytes: 68,
        exhausted: false,
      },
    });
    expect(execute.mock.calls.map(([browserCommand]) => browserCommand.action)).toEqual([
      "open_url",
      "wait",
      "enumerate_media",
      "scroll",
      "wait",
      "enumerate_media",
      "close_tab",
      "open_url",
      "wait",
      "enumerate_media",
      "scroll",
      "wait",
      "enumerate_media",
      "capture_region",
      "capture_region",
      "close_tab",
    ]);
  });

  it("uses the existing enumerated browser executor and returns only sanitized note cards", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({
        tab_id: 17,
        url: "https://www.xiaohongshu.com/search_result?keyword=test",
      })
      .mockResolvedValueOnce({ waited_ms: 3500 })
      .mockResolvedValueOnce({
        media: [
          {
            media_type: "image",
            url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
            link_url: "https://www.xiaohongshu.com/explore/note-1",
            alt: "蓝色轴测图",
            adjacent_text: "蓝色轴测图，细线和编号。",
            intrinsic_width: 640,
            intrinsic_height: 480,
            region: { x: 0, y: 0, width: 320, height: 240 },
          },
          {
            media_type: "image",
            url: "https://example.com/not-xhs.jpg",
            link_url: "https://example.com/not-a-note",
            alt: "不应返回",
            adjacent_text: "",
            intrinsic_width: 640,
            intrinsic_height: 480,
            region: { x: 0, y: 0, width: 320, height: 240 },
          },
        ],
      })
      .mockResolvedValueOnce({ scrolled: true })
      .mockResolvedValueOnce({ waited_ms: 1000 })
      .mockResolvedValueOnce({
        media: [{
          media_type: "image",
          url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
          link_url: "https://www.xiaohongshu.com/explore/note-1",
          alt: "重复卡片",
          adjacent_text: "重复卡片",
          intrinsic_width: 640,
          intrinsic_height: 480,
          region: { x: 0, y: 0, width: 320, height: 240 },
        }],
      })
      .mockResolvedValueOnce({ closed: true });
    const search = new PublicXiaohongshuSearch({ execute });

    await expect(search.run("社区图书馆 蓝色轴测图")).resolves.toEqual({
      sources: [{
        source_url: "https://www.xiaohongshu.com/explore/note-1",
        title: "蓝色轴测图",
        image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
        adjacent_text: "蓝色轴测图，细线和编号。",
      }],
    });
    expect(execute.mock.calls.map(([command]) => command.action)).toEqual([
      "open_url",
      "wait",
      "enumerate_media",
      "scroll",
      "wait",
      "enumerate_media",
      "close_tab",
    ]);
  });

  it("always closes the managed search tab after a read failure", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ tab_id: 23, url: "https://www.xiaohongshu.com/search_result" })
      .mockRejectedValueOnce(new Error("page blocked"))
      .mockResolvedValueOnce({ closed: true });
    const search = new PublicXiaohongshuSearch({ execute });

    await expect(search.run("剖面表达")).rejects.toThrow("page blocked");
    expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "close_tab",
      payload: { tab_id: 23 },
    }));
  });

  it("rejects empty queries and invalid managed tab responses", async () => {
    const emptySearch = new PublicXiaohongshuSearch({ execute: vi.fn() });
    await expect(emptySearch.run(" \u0000 ")).rejects.toThrow("query is required");

    const invalidTabSearch = new PublicXiaohongshuSearch({
      execute: vi.fn().mockResolvedValue({ tab_id: 0 }),
    });
    await expect(invalidTabSearch.run("剖面")).rejects.toThrow("did not open a managed tab");
  });

  it("bounds malformed media and tolerates tab cleanup failure", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ tab_id: 31 })
      .mockResolvedValueOnce({ waited_ms: 3500 })
      .mockResolvedValueOnce({
        media: [
          null,
          {
            media_type: "video",
            url: null,
            link_url: null,
            alt: "",
            adjacent_text: "",
          },
        ],
      })
      .mockResolvedValueOnce({ scrolled: true })
      .mockResolvedValueOnce({ waited_ms: 1000 })
      .mockResolvedValueOnce({ not_media: true })
      .mockRejectedValueOnce(new Error("already closed"));
    const search = new PublicXiaohongshuSearch({ execute });

    await expect(search.run("社区中心")).resolves.toEqual({ sources: [] });
  });

  it("uses adjacent text as a safe title and drops invalid image URLs", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ tab_id: 32 })
      .mockResolvedValueOnce({ waited_ms: 3500 })
      .mockResolvedValueOnce({
        media: [{
          media_type: "canvas",
          url: "not a URL",
          link_url: "https://www.xiaohongshu.com/discovery/item/note-2?token=private",
          alt: " ",
          adjacent_text: "\u0000  剖面  表达  ",
        }],
      })
      .mockResolvedValueOnce({ scrolled: true })
      .mockResolvedValueOnce({ waited_ms: 1000 })
      .mockResolvedValueOnce({ media: [] })
      .mockResolvedValueOnce({ closed: true });
    const search = new PublicXiaohongshuSearch({ execute });

    await expect(search.run("剖面表达")).resolves.toEqual({
      sources: [{
        source_url: "https://www.xiaohongshu.com/discovery/item/note-2",
        title: "剖面 表达",
        image_url: null,
        adjacent_text: "剖面 表达",
      }],
    });
  });
});
