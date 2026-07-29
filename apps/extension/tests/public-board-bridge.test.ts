import { describe, expect, it, vi } from "vitest";

import { forwardPublicBoardBridgeRequest } from "../src/public-board-bridge";

const envelope = {
  channel: "archresearch.board",
  protocol_version: 1,
  id: "public-request-1",
};

describe("public Web Board bridge", () => {
  it("forwards a bounded Xiaohongshu search from an explicitly connected HTTPS page", async () => {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          sources: [{
            source_url: "https://www.xiaohongshu.com/explore/note-1",
            title: "蓝色轴测图与紧凑注释",
            image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
            adjacent_text: "蓝色轴测图，使用细线与编号组织信息。",
          }],
        },
      }),
    };

    await expect(forwardPublicBoardBridgeRequest({
      ...envelope,
      action: "xiaohongshu_search",
      payload: { query: "社区图书馆 蓝色轴测图" },
    }, "https://research.example.com", runtime)).resolves.toEqual({
      channel: "archresearch.extension",
      protocol_version: 1,
      id: "public-request-1",
      ok: true,
      result: {
        sources: [{
          source_url: "https://www.xiaohongshu.com/explore/note-1",
          title: "蓝色轴测图与紧凑注释",
          image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
          adjacent_text: "蓝色轴测图，使用细线与编号组织信息。",
        }],
      },
    });
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: "public.xiaohongshu.search",
      query: "社区图书馆 蓝色轴测图",
    });
  });

  it("maps public status to the existing Board readiness shape", async () => {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          paired: true,
          connection: "connected",
          research_permission: true,
        },
      }),
    };

    await expect(forwardPublicBoardBridgeRequest({
      ...envelope,
      action: "status",
      payload: {},
    }, "https://research.example.com", runtime)).resolves.toMatchObject({
      ok: true,
      result: { connection: "connected", research_permission: true },
    });
    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: "public.status" });
  });

  it.each([
    ["http://research.example.com", { ...envelope, action: "status", payload: {} }],
    ["https://research.example.com", {
      ...envelope,
      action: "xiaohongshu_search",
      payload: { query: "图纸", script: "document.cookie" },
    }],
    ["https://research.example.com", {
      ...envelope,
      action: "open_url",
      payload: { url: "https://example.com" },
    }],
  ])("rejects insecure origins and non-enumerated page commands", async (origin, request) => {
    const runtime = { sendMessage: vi.fn() };

    await expect(
      forwardPublicBoardBridgeRequest(request, origin, runtime),
    ).resolves.toBeNull();
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });
});
