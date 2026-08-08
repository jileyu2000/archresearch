import { describe, expect, it } from "vitest";

import { parseContentMessage } from "../src/content/message-protocol";

const message = (command: Record<string, unknown>) => ({
  type: "archresearch.content",
  protocol_version: 1,
  command,
});

describe("packaged content-script protocol", () => {
  it.each([
    { action: "page_metadata" },
    { action: "page_snapshot" },
    { action: "xiaohongshu_session_status" },
    {
      action: "open_xiaohongshu_note",
      note_url: "https://www.xiaohongshu.com/explore/note-42",
    },
    { action: "enumerate_media" },
    { action: "viewport_metrics" },
    { action: "scroll", direction: "down", distance: 600 },
    { action: "safe_click", target: "expand" },
    { action: "type_search_query", query: "adaptive reuse plan" },
  ])("accepts fixed command $action", (command) => {
    expect(parseContentMessage(message(command))).toEqual(command);
  });

  it.each([
    { action: "page_metadata", selector: "body" },
    { action: "safe_click", target: "like" },
    { action: "type_search_query", query: "test", submit: true },
    {
      action: "open_xiaohongshu_note",
      note_url: "https://tracking.example/note-42",
    },
    { action: "execute_script", code: "document.cookie" },
    { action: "xiaohongshu_session_status", selector: "body" },
  ])("rejects content command escape hatches", (command) => {
    expect(() => parseContentMessage(message(command))).toThrow();
  });
});
