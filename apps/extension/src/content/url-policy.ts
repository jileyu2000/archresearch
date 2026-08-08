export function isSafeXiaohongshuNoteUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      (hostname === "xiaohongshu.com" ||
        hostname.endsWith(".xiaohongshu.com")) &&
      /^\/(?:explore|discovery\/item|search_result)\/[^/]+/u.test(url.pathname)
    );
  } catch {
    return false;
  }
}
