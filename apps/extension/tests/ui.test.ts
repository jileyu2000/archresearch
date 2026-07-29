// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mountBridgeUi } from "../src/ui";

function renderShell(): void {
  document.body.innerHTML = `
    <p data-role="connection"></p>
    <p data-role="permission"></p>
    <p data-role="permission-guidance"></p>
    <p data-role="error"></p>
    <button data-command="permissions.request">Grant</button>
    <button data-command="permissions.revoke">Revoke</button>
    <button data-command="public.connect">Connect public page</button>
    <details data-role="manual-pairing">
      <summary>连接有问题？手动配对</summary>
      <form data-role="pair-form">
        <input data-role="endpoint" value="ws://127.0.0.1:8000/v1/browser">
        <input data-role="token">
        <button type="submit">Pair</button>
      </form>
      <button data-command="disconnect">Disconnect</button>
    </details>
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
  let requestResearchPermission = vi.fn<() => Promise<boolean>>();

  beforeEach(() => {
    renderShell();
    requestResearchPermission = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true);
  });

  it("loads local bridge status without reading page data", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);

    mountBridgeUi(document, { sendMessage, requestResearchPermission });

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "ui.status" }),
    );
    expect(document.querySelector('[data-role="connection"]')?.textContent).toBe(
      "已连接",
    );
    expect(document.querySelector('[data-role="permission"]')?.textContent).toBe(
      "网页读取未授权",
    );
    expect(document.documentElement.dataset.connection).toBe("connected");
    expect(document.documentElement.dataset.paired).toBe("true");
    expect(
      document.querySelector('[data-role="permission-guidance"]')?.textContent,
    ).toBe("只差这一步：允许 ArchResearch 在研究时读取可见网页。授权会保留，直到你主动撤销。");
    expect(
      (document.querySelector('[data-role="manual-pairing"]') as HTMLDetailsElement)
        .open,
    ).toBe(false);
  });

  it("does not mistake a saved pairing for a new pairing task", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      result: {
        paired: true,
        connection: "disconnected",
        research_permission: false,
      },
    });

    mountBridgeUi(document, { sendMessage, requestResearchPermission });

    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-role="permission-guidance"]')?.textContent,
      ).toBe(
        "本地服务未连接。请先打开 ArchResearch；已保存的配对无需重新填写。",
      ),
    );
    expect(document.documentElement.dataset.paired).toBe("true");
  });

  it("keeps the pairing code visible when pairing fails", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(statusResponse)
      .mockRejectedValueOnce(new Error("expired"));
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
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
        "配对码无效或已过期。请回到 ArchResearch 重新一键连接。",
      ),
    );
    expect(token.value).toBe("246810");
  });

  it("explains how to recover when Chrome does not grant page access", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);
    requestResearchPermission.mockRejectedValueOnce(
      new Error("permission denied"),
    );
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      '[data-command="permissions.request"]',
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="error"]')?.textContent).toBe(
        "Chrome 没有完成授权。请再次点击“允许网页读取”，并确认浏览器提示。",
      ),
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("treats a declined direct Chrome permission response as unfinished", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);
    requestResearchPermission.mockResolvedValueOnce(false);
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      '[data-command="permissions.request"]',
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="error"]')?.textContent).toBe(
        "Chrome 没有完成授权。请再次点击“允许网页读取”，并确认浏览器提示。",
      ),
    );
    expect(requestResearchPermission).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("requests Chrome access directly before synchronizing the socket gate", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(statusResponse)
      .mockResolvedValueOnce({
        ok: true,
        result: {
          paired: true,
          connection: "connected",
          research_permission: true,
        },
      });
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      '[data-command="permissions.request"]',
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({
        type: "ui.permissions.request",
      }),
    );
    expect(requestResearchPermission).toHaveBeenCalledOnce();
    expect(
      document.querySelector('[data-role="permission-guidance"]')?.textContent,
    ).toBe("已获得网页研究权限，后续研究无需再次确认。");
  });

  it("requests Chrome access before connecting the current public Web page", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(statusResponse)
      .mockResolvedValueOnce({
        ok: true,
        result: {
          paired: true,
          connection: "connected",
          research_permission: true,
        },
      });
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      '[data-command="public.connect"]',
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({
        type: "ui.public.connect",
      }),
    );
    expect(requestResearchPermission).toHaveBeenCalledOnce();
  });

  it("sends the loopback endpoint and one-time code for pairing", async () => {
    const sendMessage = vi.fn().mockResolvedValue(statusResponse);
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
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
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      `[data-command="${buttonCommand}"]`,
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({ type: messageType }),
    );
  });
});
