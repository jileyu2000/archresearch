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
  alarms: {
    create(name: string, alarmInfo: { periodInMinutes: number }): void;
    onAlarm: {
      addListener(listener: (alarm: { name: string }) => void): void;
    };
  };
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

const RECONNECT_ALARM = "archresearch.reconnect";

export function startBackground(
  api: BackgroundChromeApi,
  socketFactory: SocketFactory = createSocket,
): void {
  const permissions = new BrowserPermissionService(api.permissions);
  const browserPort = new ChromeBrowserPort(api);
  const executor = new BrowserCommandExecutor(browserPort);
  const store = new PairingStore(api.storage.local);
  const controller = new ExtensionController(
    store,
    permissions,
    (pairing, onPairingToken) =>
      new BrowserSocketClient(
        pairing,
        socketFactory,
        executor,
        undefined,
        onPairingToken,
      ),
    browserPort.recoverOrphanedTabs(),
  );
  const handleUiMessage = createUiMessageHandler(controller);

  api.runtime.onMessage.addListener((message, _sender, sendResponse) =>
    handleUiMessage(message, sendResponse),
  );
  api.tabs.onRemoved.addListener(createManagedTabRemovalHandler(executor));
  api.alarms.create(RECONNECT_ALARM, { periodInMinutes: 1 });
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RECONNECT_ALARM) {
      void controller.restore().catch(() => undefined);
    }
  });
  void controller.restore().catch(() => undefined);
}

function createSocket(endpoint: string): SocketLike {
  return new WebSocket(endpoint) as unknown as SocketLike;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  startBackground(chrome);
}
