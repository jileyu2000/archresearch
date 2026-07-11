import {
  createManagedTabRemovalHandler,
  createUiMessageHandler,
} from "./background-runtime";
import { ChromeBrowserPort } from "./chrome-browser-port";
import { BrowserCommandExecutor } from "./browser-command-executor";
import {
  BrowserSocketClient,
  type SocketFactory,
  type SocketLike,
} from "./browser-socket-client";
import { ExtensionController } from "./extension-controller";
import { PairingStore } from "./pairing-store";
import { BrowserPermissionService } from "./permissions";

type BackgroundChromeApi = ConstructorParameters<typeof ChromeBrowserPort>[0] & {
  storage: {
    local: ConstructorParameters<typeof PairingStore>[0];
  };
  permissions: ConstructorParameters<typeof BrowserPermissionService>[0];
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean,
      ): void;
    };
  };
  tabs: ConstructorParameters<typeof ChromeBrowserPort>[0]["tabs"] & {
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
};

export function startBackground(
  api: BackgroundChromeApi,
  socketFactory: SocketFactory = createSocket,
): void {
  const permissions = new BrowserPermissionService(api.permissions);
  const executor = new BrowserCommandExecutor(new ChromeBrowserPort(api));
  const store = new PairingStore(api.storage.local);
  const controller = new ExtensionController(
    store,
    permissions,
    (pairing, onPairingToken) =>
      new BrowserSocketClient(
        pairing,
        socketFactory,
        executor,
        permissions,
        undefined,
        onPairingToken,
      ),
  );
  const handleUiMessage = createUiMessageHandler(controller);

  api.runtime.onMessage.addListener((message, _sender, sendResponse) =>
    handleUiMessage(message, sendResponse),
  );
  api.tabs.onRemoved.addListener(createManagedTabRemovalHandler(executor));
  void controller.restore().catch(() => undefined);
}

function createSocket(endpoint: string): SocketLike {
  return new WebSocket(endpoint) as unknown as SocketLike;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  startBackground(chrome);
}
