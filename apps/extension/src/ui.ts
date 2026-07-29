type UiRuntime = {
  sendMessage(message: unknown): Promise<unknown>;
  requestResearchPermission(): Promise<boolean>;
};

type BridgeStatus = {
  paired: boolean;
  connection: "disconnected" | "connecting" | "connected" | "error";
  research_permission: boolean;
};

export function mountBridgeUi(root: Document, runtime: UiRuntime): void {
  const form = requireElement<HTMLFormElement>(root, '[data-role="pair-form"]');
  const endpoint = requireElement<HTMLInputElement>(root, '[data-role="endpoint"]');
  const token = requireElement<HTMLInputElement>(root, '[data-role="token"]');
  const connection = requireElement<HTMLElement>(root, '[data-role="connection"]');
  const permission = requireElement<HTMLElement>(root, '[data-role="permission"]');
  const permissionGuidance = requireElement<HTMLElement>(
    root,
    '[data-role="permission-guidance"]',
  );
  const manualPairing = requireElement<HTMLDetailsElement>(
    root,
    '[data-role="manual-pairing"]',
  );
  const error = requireElement<HTMLElement>(root, '[data-role="error"]');

  const renderStatus = (status: BridgeStatus): void => {
    connection.textContent = connectionLabel(status.connection);
    permission.textContent = status.research_permission
      ? "网页读取已授权"
      : "网页读取未授权";
    permissionGuidance.textContent = guidanceLabel(status);
    root.documentElement.dataset.paired = String(status.paired);
    root.documentElement.dataset.connection = status.connection;
    root.documentElement.dataset.permission = String(status.research_permission);
    if (status.paired && status.connection === "connected") {
      manualPairing.open = false;
    }
  };

  const run = async (
    command: unknown,
    failureMessage: string,
  ): Promise<BridgeStatus | null> => {
    error.textContent = "";
    try {
      const status = readStatus(await runtime.sendMessage(command));
      renderStatus(status);
      return status;
    } catch {
      error.textContent = failureMessage;
      return null;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = token.value.trim();
    if (code === "") {
      error.textContent = "请输入一次性配对码。";
      return;
    }
    void run(
      {
        type: "ui.pair",
        endpoint: endpoint.value.trim(),
        token: code,
      },
      "配对码无效或已过期。请回到 ArchResearch 重新一键连接。",
    ).then((status) => {
      if (status?.paired) {
        token.value = "";
        manualPairing.open = false;
      } else {
        manualPairing.open = true;
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (command === "permissions.request") {
        const failureMessage =
          "Chrome 没有完成授权。请再次点击“允许网页读取”，并确认浏览器提示。";
        error.textContent = "";
        let permissionRequest: Promise<boolean>;
        try {
          permissionRequest = runtime.requestResearchPermission();
        } catch {
          error.textContent = failureMessage;
          return;
        }
        void permissionRequest.then(
          (granted) => {
            if (!granted) {
              error.textContent = failureMessage;
              return;
            }
            void run({ type: "ui.permissions.request" }, failureMessage).then(
              (status) => {
                if (status && !status.research_permission) {
                  error.textContent = failureMessage;
                }
              },
            );
          },
          () => {
            error.textContent = failureMessage;
          },
        );
      } else if (command === "public.connect") {
        const failureMessage =
          "未能连接当前网页。请确认当前标签页是 ArchResearch 公共版，并允许网页读取。";
        error.textContent = "";
        void runtime.requestResearchPermission().then(
          (granted) => {
            if (!granted) {
              error.textContent = failureMessage;
              return;
            }
            void run({ type: "ui.public.connect" }, failureMessage);
          },
          () => {
            error.textContent = failureMessage;
          },
        );
      } else if (command === "permissions.revoke") {
        void run(
          { type: "ui.permissions.revoke" },
          "未能撤销网页读取权限。请稍后重试。",
        );
      } else if (command === "disconnect") {
        void run(
          { type: "ui.disconnect" },
          "未能断开本地连接。请关闭扩展后重试。",
        );
      }
    });
  });

  void run(
    { type: "ui.status" },
    "无法读取连接状态。请先打开 ArchResearch，再重新打开扩展。",
  );
}

function readStatus(response: unknown): BridgeStatus {
  if (
    response === null ||
    typeof response !== "object" ||
    !("ok" in response) ||
    response.ok !== true ||
    !("result" in response) ||
    response.result === null ||
    typeof response.result !== "object"
  ) {
    throw new Error("Invalid local bridge response");
  }
  const status = response.result as Record<string, unknown>;
  if (
    typeof status.paired !== "boolean" ||
    !isConnectionStatus(status.connection) ||
    typeof status.research_permission !== "boolean"
  ) {
    throw new Error("Invalid local bridge status");
  }
  return {
    paired: status.paired,
    connection: status.connection,
    research_permission: status.research_permission,
  };
}

function isConnectionStatus(
  value: unknown,
): value is BridgeStatus["connection"] {
  return (
    value === "disconnected" ||
    value === "connecting" ||
    value === "connected" ||
    value === "error"
  );
}

function connectionLabel(status: BridgeStatus["connection"]): string {
  switch (status) {
    case "connected":
      return "已连接";
    case "connecting":
      return "正在连接";
    case "error":
      return "连接错误";
    case "disconnected":
      return "未连接";
  }
}

function guidanceLabel(status: BridgeStatus): string {
  if (!status.paired) {
    return "尚未连接。请回到 ArchResearch 一键连接；配对码只用于故障恢复。";
  }
  switch (status.connection) {
    case "connected":
      return status.research_permission
        ? "已获得网页研究权限，后续研究无需再次确认。"
        : "只差这一步：允许 ArchResearch 在研究时读取可见网页。授权会保留，直到你主动撤销。";
    case "connecting":
      return "正在连接本地服务，连接完成后即可允许网页读取。";
    case "error":
      return "连接信息已失效。请回到 ArchResearch 重新一键连接。";
    case "disconnected":
      return "本地服务未连接。请先打开 ArchResearch；已保存的配对无需重新填写。";
  }
}

function requireElement<ElementType extends Element>(
  root: Document,
  selector: string,
): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Missing extension UI element: ${selector}`);
  }
  return element;
}
