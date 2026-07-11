import { parseContentMessage } from "./message-protocol";
import { executeContentCommand } from "./operations";

type SendResponse = (response: unknown) => void;
type ContentRuntime = {
  onMessage: {
    addListener(
      listener: (
        message: unknown,
        sender: unknown,
        sendResponse: SendResponse,
      ) => boolean,
    ): void;
  };
};
type ContentInstallationState = {
  archresearchContentInstalled?: boolean;
};

export function createContentMessageHandler(
  root: Document,
  view: Window & typeof globalThis,
) {
  return (message: unknown, sendResponse: SendResponse): false => {
    try {
      const command = parseContentMessage(message);
      sendResponse({
        ok: true,
        result: executeContentCommand(root, view, command),
      });
    } catch {
      sendResponse({
        ok: false,
        error: {
          code: "invalid_content_command",
          message: "Command was rejected",
        },
      });
    }
    return false;
  };
}

export function installContentScript(
  runtime: ContentRuntime,
  root: Document,
  view: Window & typeof globalThis,
  state: ContentInstallationState,
): void {
  if (state.archresearchContentInstalled) {
    return;
  }
  const handle = createContentMessageHandler(root, view);
  runtime.onMessage.addListener((message, _sender, sendResponse) =>
    handle(message, sendResponse),
  );
  state.archresearchContentInstalled = true;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  installContentScript(
    chrome.runtime,
    document,
    window,
    globalThis as ContentInstallationState,
  );
}
