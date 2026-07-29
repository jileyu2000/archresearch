import { describe, expect, it, vi } from "vitest";

import {
  forwardPublicBoardBridgeRequest,
  startPublicBoardBridge,
} from "../src/public-board-bridge";

const envelope = {
  channel: "archresearch.board",
  protocol_version: 2,
  id: "public-request-1",
};

describe("public Web Board bridge", () => {
  it("forwards bounded planned Xiaohongshu research from an explicitly connected HTTPS page", async () => {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          sources: [{
            direction_id: "linework",
            source_url: "https://www.xiaohongshu.com/explore/note-1",
            title: "蓝色轴测图与紧凑注释",
            image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
            preview_data_url: "data:image/png;base64,aW1hZ2U=",
            adjacent_text: "蓝色轴测图，使用细线与编号组织信息。",
          }],
          budget: {
            image_count: 1,
            preview_bytes: 30,
            exhausted: false,
          },
        },
      }),
    };

    await expect(forwardPublicBoardBridgeRequest({
      ...envelope,
      action: "xiaohongshu_research",
      payload: {
        directions: [{
          id: "linework",
          query: "社区图书馆 蓝色轴测图",
        }],
      },
    }, "https://research.example.com", runtime)).resolves.toEqual({
      channel: "archresearch.extension",
      protocol_version: 2,
      id: "public-request-1",
      ok: true,
      result: {
        sources: [{
          direction_id: "linework",
          source_url: "https://www.xiaohongshu.com/explore/note-1",
          title: "蓝色轴测图与紧凑注释",
          image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
          preview_data_url: "data:image/png;base64,aW1hZ2U=",
          adjacent_text: "蓝色轴测图，使用细线与编号组织信息。",
        }],
        budget: {
          image_count: 1,
          preview_bytes: 30,
          exhausted: false,
        },
      },
    });
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: "public.xiaohongshu.research",
      directions: [{
        id: "linework",
        query: "社区图书馆 蓝色轴测图",
      }],
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
          visual_protocol: 2,
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

  it("relays only validated runtime failures and source arrays", async () => {
    const runtime = {
      sendMessage: vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          error: { code: "permission_required", message: "Permission required" },
        })
        .mockResolvedValueOnce({
          ok: true,
          result: {
            paired: true,
            connection: "error",
            research_permission: true,
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          result: { sources: Array.from({ length: 9 }, () => ({})) },
        }),
    };
    const statusRequest = { ...envelope, action: "status", payload: {} };
    const searchRequest = {
      ...envelope,
      action: "xiaohongshu_research",
      payload: { directions: [{ id: "section", query: "剖面" }] },
    };

    await expect(
      forwardPublicBoardBridgeRequest(statusRequest, "https://research.example.com", runtime),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "permission_required" },
    });
    await expect(
      forwardPublicBoardBridgeRequest(statusRequest, "https://research.example.com", runtime),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "bridge_error" },
    });
    await expect(
      forwardPublicBoardBridgeRequest(searchRequest, "https://research.example.com", runtime),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "bridge_error" },
    });
  });

  it("starts once on a marked HTTPS page and contains runtime failures", async () => {
    let listener: ((event: MessageEvent<unknown>) => void) | undefined;
    const runtime = {
      sendMessage: vi.fn().mockRejectedValue(new Error("worker stopped")),
    };
    const scope = {
      location: { origin: "https://research.example.com" },
      document: { querySelector: vi.fn().mockReturnValue({}) },
      addEventListener: vi.fn((_type: string, callback: (event: MessageEvent<unknown>) => void) => {
        listener = callback;
      }),
      postMessage: vi.fn(),
    };

    startPublicBoardBridge(scope as unknown as Window, runtime);
    startPublicBoardBridge(scope as unknown as Window, runtime);
    expect(scope.addEventListener).toHaveBeenCalledOnce();

    listener?.({
      source: scope,
      origin: "https://attacker.example.com",
      data: {},
    } as unknown as MessageEvent<unknown>);
    expect(runtime.sendMessage).not.toHaveBeenCalled();

    listener?.({
      source: scope,
      origin: scope.location.origin,
      data: { ...envelope, action: "status", payload: {} },
    } as unknown as MessageEvent<unknown>);
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: envelope.id,
        ok: false,
        error: { code: "bridge_error", message: "Extension command failed" },
      }),
      scope.location.origin,
    ));
  });

  it.each([
    ["http://research.example.com", { ...envelope, action: "status", payload: {} }],
    ["not a URL", { ...envelope, action: "status", payload: {} }],
    ["https://research.example.com", {
      ...envelope,
      action: "xiaohongshu_research",
      payload: {
        directions: [{ id: "drawing", query: "图纸" }],
        script: "document.cookie",
      },
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
