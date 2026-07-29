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
import { PublicXiaohongshuSearch } from "./public-xiaohongshu-search";
import {
  isPublicWebCommand,
  PublicWebController,
} from "./public-web-controller";

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
  scripting: ConstructorParameters<typeof PublicWebController>[0]["scripting"];
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
  const publicController = new PublicWebController(
    api as unknown as ConstructorParameters<typeof PublicWebController>[0],
    permissions,
    new PublicXiaohongshuSearch(executor),
  );
  const handleUiMessage = createUiMessageHandler({
    handle: async (message, sender) => {
      if (
        typeof message === "object"
        && message !== null
        && "type" in message
        && message.type === "ui.status"
      ) {
        return await publicController.statusForActivePage()
          .catch(async () => await controller.handle(message));
      }
      return isPublicWebCommand(message)
        ? await publicController.handle(message, sender)
        : await controller.handle(message);
    },
  });

  api.runtime.onMessage.addListener((message, sender, sendResponse) =>
    handleUiMessage(message, sender, sendResponse),
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
