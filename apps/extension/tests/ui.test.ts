// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mountBridgeUi } from "../src/ui";

function renderShell(): void {
  document.body.innerHTML = `
    <form data-role="pair-form">
      <input data-role="endpoint" value="ws://127.0.0.1:8000/v1/browser">
      <input data-role="token">
      <button type="submit">Pair</button>
    </form>
    <p data-role="connection"></p>
    <p data-role="permission"></p>
    <p data-role="error"></p>
    <button data-command="permissions.request">Grant</button>
    <button data-command="permissions.revoke">Revoke</button>
    <button data-command="disconnect">Disconnect</button>
  `;
}

const statusResponse = {
  ok: true,
  result: {
    paired: true,
    connection: "connected",
    research_permission: false,
  },
};

describe("extension popup and side-panel UI", () => {
  beforeEach(renderShell);

  it("loads local bridge status without reading page data", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);

    mountBridgeUi(document, { sendMessage });

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "ui.status" }),
    );
    expect(document.querySelector('[data-role="connection"]')?.textContent).toBe(
      "已连接",
    );
    expect(document.querySelector('[data-role="permission"]')?.textContent).toBe(
      "网页读取未授权",
    );
  });

  it("keeps the pairing code visible when pairing fails", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(statusResponse)
      .mockRejectedValueOnce(new Error("expired"));
    mountBridgeUi(document, { sendMessage });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const token = document.querySelector(
      '[data-role="token"]',
    ) as HTMLInputElement;
    token.value = "246810";

    document
      .querySelector('[data-role="pair-form"]')!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="error"]')?.textContent).toBe(
        "连接失败。请回到 ArchResearch 重新一键连接。",
      ),
    );
    expect(token.value).toBe("246810");
  });

  it("sends the loopback endpoint and one-time code for pairing", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);
    mountBridgeUi(document, { sendMessage });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    (document.querySelector('[data-role="token"]') as HTMLInputElement).value =
      "246810";

    document
      .querySelector('[data-role="pair-form"]')!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({
        type: "ui.pair",
        endpoint: "ws://127.0.0.1:8000/v1/browser",
        token: "246810",
      }),
    );
  });

  it.each([
    ["permissions.request", "ui.permissions.request"],
    ["permissions.revoke", "ui.permissions.revoke"],
    ["disconnect", "ui.disconnect"],
  ])("maps %s to the fixed command %s", async (buttonCommand, messageType) => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);
    mountBridgeUi(document, { sendMessage });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      `[data-command="${buttonCommand}"]`,
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({ type: messageType }),
    );
  });
});
