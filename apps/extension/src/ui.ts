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
  const connection = requireElement<HTMLElement>(root, '[data-role="connection"]');
  const permission = requireElement<HTMLElement>(root, '[data-role="permission"]');
  const permissionGuidance = requireElement<HTMLElement>(
    root,
    '[data-role="permission-guidance"]',
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
          "连接没有完成。请保持 ArchResearch 网页为当前标签后重试；若网页提醒已关闭，则连接已经生效。";
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
    throw new Error("Invalid public extension response");
  }
  const status = response.result as Record<string, unknown>;
  if (
    typeof status.paired !== "boolean" ||
    !isConnectionStatus(status.connection) ||
    typeof status.research_permission !== "boolean"
  ) {
    throw new Error("Invalid public extension status");
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
  if (!status.paired || status.connection === "disconnected") {
    return "当前 ArchResearch 网页尚未连接。请回到网页所在标签，点击网页中的连接提示。";
  }
  switch (status.connection) {
    case "connected":
      return status.research_permission
        ? "已获得网页研究权限，后续研究无需再次确认。"
        : "只差这一步：允许 ArchResearch 在研究时读取可见网页。授权会保留，直到你主动撤销。";
    case "connecting":
      return "正在连接当前 ArchResearch 网页，连接完成后即可允许网页读取。";
    case "error":
      return "当前网页连接已失效。请回到 ArchResearch 网页重新连接。";
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
