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

  const run = async (command: unknown): Promise<void> => {
    error.textContent = "";
    try {
      const status = readStatus(await runtime.sendMessage(command));
      connection.textContent = connectionLabel(status.connection);
      permission.textContent = status.research_permission
        ? "Site access on"
        : "Site access off";
      root.documentElement.dataset.connection = status.connection;
      root.documentElement.dataset.permission = String(status.research_permission);
    } catch {
      error.textContent = "Local bridge command failed.";
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = token.value.trim();
    if (code === "") {
      error.textContent = "Enter the one-time pairing code.";
      return;
    }
    void run({
      type: "ui.pair",
      endpoint: endpoint.value.trim(),
      token: code,
    }).then(() => {
      token.value = "";
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
      return "Connected";
    case "connecting":
      return "Connecting";
    case "error":
      return "Connection error";
    case "disconnected":
      return "Disconnected";
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
