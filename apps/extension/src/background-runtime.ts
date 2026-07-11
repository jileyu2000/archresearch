type UiController = {
  handle(message: unknown): Promise<Record<string, unknown>>;
};

type SendResponse = (response: unknown) => void;

export function createUiMessageHandler(controller: UiController) {
  return (message: unknown, sendResponse: SendResponse): true => {
    void controller.handle(message).then(
      (result) => sendResponse({ ok: true, result }),
      () =>
        sendResponse({
          ok: false,
          error: {
            code: "invalid_ui_command",
            message: "Command was rejected",
          },
        }),
    );
    return true;
  };
}

export function createManagedTabRemovalHandler(executor: {
  releaseTab(tabId: number): void;
}) {
  return (tabId: number): void => executor.releaseTab(tabId);
}
