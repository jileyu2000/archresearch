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

  it("loads public page status without reading page data", async () => {
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
  });

  it("explains that the current public page still needs connection", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      result: {
        paired: false,
        connection: "disconnected",
        research_permission: false,
      },
    });

    mountBridgeUi(document, { sendMessage, requestResearchPermission });

    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-role="permission-guidance"]')?.textContent,
      ).toBe(
        "当前 ArchResearch 网页尚未连接。请回到网页所在标签，点击网页中的连接提示。",
      ),
    );
    expect(document.documentElement.dataset.paired).toBe("false");
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

  it("requests Chrome access directly before synchronizing the public page gate", async () => {
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

  it("does not blame a valid public page when reconnecting fails", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(statusResponse)
      .mockRejectedValueOnce(new Error("registration still active"));
    mountBridgeUi(document, { sendMessage, requestResearchPermission });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    (document.querySelector(
      '[data-command="public.connect"]',
    ) as HTMLButtonElement).click();

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="error"]')?.textContent).toBe(
        "连接没有完成。请保持 ArchResearch 网页为当前标签后重试；若网页提醒已关闭，则连接已经生效。",
      ),
    );
  });

  it.each([
    ["permissions.request", "ui.permissions.request"],
    ["permissions.revoke", "ui.permissions.revoke"],
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
