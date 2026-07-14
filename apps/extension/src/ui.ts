type UiRuntime = {
  sendMessage(message: unknown): Promise<unknown>;
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
  const error = requireElement<HTMLElement>(root, '[data-role="error"]');

  const run = async (command: unknown): Promise<boolean> => {
    error.textContent = "";
    try {
      const status = readStatus(await runtime.sendMessage(command));
      connection.textContent = connectionLabel(status.connection);
      permission.textContent = status.research_permission
        ? "网页读取已授权"
        : "网页读取未授权";
      root.documentElement.dataset.connection = status.connection;
      root.documentElement.dataset.permission = String(status.research_permission);
      return true;
    } catch {
      error.textContent = "连接失败。请回到 ArchResearch 重新一键连接。";
      return false;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = token.value.trim();
    if (code === "") {
      error.textContent = "请输入一次性配对码。";
      return;
    }
    void run({
      type: "ui.pair",
      endpoint: endpoint.value.trim(),
      token: code,
    }).then((succeeded) => {
      if (succeeded) {
        token.value = "";
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (command === "permissions.request") {
        void run({ type: "ui.permissions.request" });
      } else if (command === "permissions.revoke") {
        void run({ type: "ui.permissions.revoke" });
      } else if (command === "disconnect") {
        void run({ type: "ui.disconnect" });
      }
    });
  });

  void run({ type: "ui.status" });
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
