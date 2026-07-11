// Chrome captureVisibleTab requires the exact <all_urls> host permission.
export const ALL_HOST_ORIGINS = ["<all_urls>"];

type PermissionPort = {
  request(options: { origins: string[] }): Promise<boolean>;
  remove(options: { origins: string[] }): Promise<boolean>;
  contains(options: { origins: string[] }): Promise<boolean>;
};

export class BrowserPermissionService {
  constructor(private readonly permissions: PermissionPort) {}

  requestForResearch(): Promise<boolean> {
    return this.permissions.request({ origins: ALL_HOST_ORIGINS });
  }

  revokeAfterResearch(): Promise<boolean> {
    return this.permissions.remove({ origins: ALL_HOST_ORIGINS });
  }

  hasResearchAccess(): Promise<boolean> {
    return this.permissions.contains({ origins: ALL_HOST_ORIGINS });
  }
}
