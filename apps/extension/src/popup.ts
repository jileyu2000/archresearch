import "./ui.css";
import { requestResearchAccess } from "./permissions";
import { mountBridgeUi } from "./ui";

mountBridgeUi(document, {
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  requestResearchPermission: () => requestResearchAccess(chrome.permissions),
});
