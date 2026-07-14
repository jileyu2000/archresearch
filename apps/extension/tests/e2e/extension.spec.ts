import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import {
  WebSocket as ServerSocket,
  WebSocketServer,
} from "ws";

type WireMessage = Record<string, unknown>;
type BrowserResult = {
  type: "browser.result";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
};

const EXTENSION_BUILD_PATH = resolve(import.meta.dirname, "../../dist");
const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../..");
const E2E_API_SCRIPT = resolve(
  import.meta.dirname,
  "support/full-stack-api.py",
);
const E2E_PYTHON = [
  process.env.ARCHRESEARCH_E2E_PYTHON,
  resolve(REPOSITORY_ROOT, ".venv/Scripts/python.exe"),
  resolve(REPOSITORY_ROOT, "apps/api/.venv/Scripts/python.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ??
  "python";
const FIXTURE_HOST = "archresearch.test";
const HOST_ORIGINS = ["<all_urls>"];

test.describe.serial("packaged MV3 browser bridge", () => {
  let context: BrowserContext;
  let serviceWorker: Worker;
  let popup: Page;
  let testRoot: string;
  let hostileManagedPage: Page;
  let fixtures: FixtureServer;
  let coordinator: ResearchCoordinator;

  test.beforeAll(async () => {
    fixtures = await FixtureServer.start();
    coordinator = await ResearchCoordinator.start();
    testRoot = await mkdtemp(join(tmpdir(), "archresearch-extension-"));
    const userDataDir = join(testRoot, "profile");
    const extensionPath = join(testRoot, "extension");
    await mkdir(userDataDir);
    await cp(EXTENSION_BUILD_PATH, extensionPath, { recursive: true });
    await primeOptionalHostAccess(userDataDir, extensionPath);
    context = await launchExtension(userDataDir, extensionPath);
    serviceWorker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(serviceWorker.url()).host;
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test.afterAll(async () => {
    await context?.close();
    await coordinator?.close();
    await fixtures?.close();
    if (testRoot) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  test("pairs from the local board and restores optional host access", async () => {
    const board = await context.newPage();
    await board.goto(fixtures.loopbackUrl("/board"));
    const paired = await requestBoardBridge(board, "pair", {
      endpoint: coordinator.endpoint,
      token: "e2e-pairing-code",
    });
    expect(paired).toMatchObject({ ok: true, result: { paired: true } });
    await coordinator.waitForAuthenticationCount(1);

    await popup.reload();
    await expect(popup.locator('[data-role="connection"]')).toHaveText("已连接");
    await expect.poll(() => hasHostAccess(serviceWorker)).toBe(true);
    await popup.getByRole("button", { name: "授予网页读取权限" }).click();
    await expect(popup.locator('[data-role="permission"]')).toHaveText(
      "网页读取已授权",
    );
    await expect
      .poll(() => hasHostAccess(serviceWorker))
      .toBe(true);
  });

  test("enumerates drawing assets and metadata from a static page", async () => {
    const url = fixtures.url("/static");
    const opened = await coordinator.command("open_url", { url });
    expect(opened.ok, JSON.stringify(opened)).toBe(true);
    const tabId = readTabId(opened);
    const managedPage = await waitForPage(context, url);
    await managedPage.waitForLoadState("domcontentloaded");
    await expect(managedPage).toHaveTitle("Courtyard Archive");

    const metadata = await coordinator.command("page_metadata", {
      tab_id: tabId,
    });
    expect(metadata).toMatchObject({
      ok: true,
      result: {
        title: "Courtyard Archive",
        publisher: "Fixture Architecture Review",
        canonical_url: "https://fixture.example/projects/courtyard-archive",
      },
    });

    const snapshot = await coordinator.command("page_snapshot", {
      tab_id: tabId,
    });
    expect(snapshot).toMatchObject({
      ok: true,
      result: {
        blocks: [
          { kind: "heading", text: "Courtyard Archive reuse strategy" },
          {
            kind: "paragraph",
            text: "The public stair is inserted without erasing the retained shell.",
          },
          {
            kind: "caption",
            text: "Section through the retained shell and new public stair.",
          },
        ],
        truncated: false,
      },
    });

    const mediaResult = await coordinator.command("enumerate_media", {
      tab_id: tabId,
    });
    const media = readMedia(mediaResult);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      media_type: "image",
      alt: "Longitudinal section",
      adjacent_text: "Section through the retained shell and new public stair.",
      intrinsic_width: 1200,
      intrinsic_height: 675,
    });
    expect(media[0]?.url).toContain("/assets/section.svg");

    const captured = await coordinator.command("capture_region", {
      tab_id: tabId,
      region: media[0]!.region,
    });
    expect(
      captured.ok,
      JSON.stringify({ captured, media: media[0] }),
    ).toBe(true);
    expect(
      (captured.result as { image_data_url?: string }).image_data_url,
    ).toMatch(/^data:image\/png;base64,/u);

    await coordinator.command("close_tab", { tab_id: tabId });
    await expect.poll(() => managedPage.isClosed()).toBe(true);
  });

  test("finds media added by a lazy page after a fixed scroll action", async () => {
    const url = fixtures.url("/dynamic");
    const opened = await coordinator.command("open_url", { url });
    const tabId = readTabId(opened);
    const managedPage = await waitForPage(context, url);
    await managedPage.waitForLoadState("domcontentloaded");

    expect(
      readMedia(
        await coordinator.command("enumerate_media", { tab_id: tabId }),
      ).map((item) => item.alt),
    ).toEqual(["Ground floor plan"]);

    await coordinator.command("scroll", {
      tab_id: tabId,
      direction: "down",
      distance: 1_200,
    });
    await managedPage.locator("#lazy-section").waitFor();
    const media = readMedia(
      await coordinator.command("enumerate_media", { tab_id: tabId }),
    );
    expect(media.map((item) => item.alt)).toEqual(["Loaded section"]);
    const captured = await coordinator.command("capture_region", {
      tab_id: tabId,
      region: media[0]!.region,
    });
    expect(captured.ok, JSON.stringify(captured)).toBe(true);

    await coordinator.command("close_tab", { tab_id: tabId });
  });

  test("keeps hostile page content inside the enumerated protocol boundary", async () => {
    const url = fixtures.url("/malicious");
    const opened = await coordinator.command("open_url", { url });
    const tabId = readTabId(opened);
    hostileManagedPage = await waitForPage(context, url);
    await hostileManagedPage.waitForLoadState("domcontentloaded");

    const media = readMedia(
      await coordinator.command("enumerate_media", { tab_id: tabId }),
    );
    expect(media).toEqual([]);
    expect(
      await coordinator.command("page_metadata", { tab_id: tabId }),
    ).toMatchObject({
      ok: false,
      error: { code: "execution_failed" },
    });

    const typed = await coordinator.command("type_search_query", {
      tab_id: tabId,
      query: "museum circulation section",
    });
    expect(typed).toMatchObject({ ok: true, result: { typed: true } });
    expect(
      await hostileManagedPage.evaluate(() => {
        const state = (window as typeof window & {
          fixtureState: { submissions: number; publishClicks: number };
        }).fixtureState;
        return {
          search: document.querySelector<HTMLInputElement>('input[type="search"]')
            ?.value,
          email: document.querySelector<HTMLInputElement>('input[name="email"]')
            ?.value,
          submissions: state.submissions,
          publishClicks: state.publishClicks,
        };
      }),
    ).toEqual({
      search: "museum circulation section",
      email: "private@example.test",
      submissions: 0,
      publishClicks: 0,
    });

    const rejected = await coordinator.rawCommand({
      type: "browser.command",
      protocol_version: 1,
      id: coordinator.nextId(),
      action: "execute_script",
      payload: { code: "document.cookie" },
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "invalid_command", message: "Command was rejected" },
    });
    expect(JSON.stringify(rejected)).not.toContain("document.cookie");

    const privateNavigation = await coordinator.command("open_url", {
      url: `http://127.0.0.1:${fixtures.port}/static`,
    });
    expect(privateNavigation).toMatchObject({
      ok: false,
      error: { code: "invalid_command" },
    });

  });

  test("revokes permissions, closes tabs, and reconnects without reopening access", async () => {
    coordinator.send({
      type: "research.session",
      protocol_version: 1,
      state: "completed",
    });
    await expect.poll(() => hostileManagedPage.isClosed()).toBe(true);
    await expect.poll(() => hasHostAccess(serviceWorker)).toBe(false);
    await popup.reload();
    await expect(popup.locator('[data-role="permission"]')).toHaveText(
      "网页读取未授权",
    );

    const locked = await coordinator.command("wait", { milliseconds: 0 });
    expect(locked).toMatchObject({
      ok: false,
      error: { code: "permission_required" },
    });

    coordinator.dropActiveConnection();
    await coordinator.waitForAuthenticationCount(2);
    await popup.reload();
    await expect(popup.locator('[data-role="connection"]')).toHaveText("已连接");
    await expect(popup.locator('[data-role="permission"]')).toHaveText(
      "网页读取未授权",
    );
    await expect.poll(() => hasHostAccess(serviceWorker)).toBe(false);

    const stillLocked = await coordinator.command("wait", { milliseconds: 0 });
    expect(stillLocked).toMatchObject({
      ok: false,
      error: { code: "permission_required" },
    });
  });

});

test.describe.serial("FastAPI browser workflow", () => {
  let context: BrowserContext;
  let serviceWorker: Worker;
  let popup: Page;
  let testRoot: string;
  let fixtures: FixtureServer;

  test.beforeAll(async () => {
    fixtures = await FixtureServer.start();
    testRoot = await mkdtemp(join(tmpdir(), "archresearch-full-stack-"));
    const userDataDir = join(testRoot, "profile");
    const extensionPath = join(testRoot, "extension");
    await mkdir(userDataDir);
    await cp(EXTENSION_BUILD_PATH, extensionPath, { recursive: true });
    await primeOptionalHostAccess(userDataDir, extensionPath);
    context = await launchExtension(userDataDir, extensionPath);
    serviceWorker = await waitForServiceWorker(context);
    const extensionId = new URL(serviceWorker.url()).host;
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test.afterAll(async () => {
    await context?.close();
    await fixtures?.close();
    if (testRoot) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  test("persists a real browser crop through the FastAPI workflow", async () => {
    const api = await TestApi.start(testRoot, fixtures.url("/static"));
    try {
      const pairing = await requestJson<{ code: string }>(
        `${api.httpEndpoint}/v1/browser/pairing-code`,
        { method: "POST" },
      );
      await popup.locator('[data-role="endpoint"]').fill(api.websocketEndpoint);
      await popup.locator('[data-role="token"]').fill(pairing.code);
      await popup.getByRole("button", { name: "手动配对" }).click();
      await expect
        .poll(() => storedPairingToken(serviceWorker))
        .not.toBe(pairing.code);
      await popup.reload();
      await expect(popup.locator('[data-role="connection"]')).toHaveText(
        "已连接",
      );
      await expect(popup.locator('[data-role="permission"]')).toHaveText(
        "网页读取已授权",
      );

      const workspace = await requestJson<{ id: string }>(
        `${api.httpEndpoint}/v1/workspaces`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Full stack browser E2E" }),
        },
      );
      const createdRun = await requestJson<{ id: string; status: string }>(
        `${api.httpEndpoint}/v1/workspaces/${workspace.id}/runs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: "旧建筑中如何形成有层次的剖面？",
            goal: "precedent_research",
            budget_mode: "quick",
          }),
        },
      );
      const run = await waitUntilAsync(async () => {
        const current = await requestJson<{ id: string; status: string }>(
          `${api.httpEndpoint}/v1/runs/${createdRun.id}`,
        );
        return ["completed", "partial", "blocked", "failed"].includes(
          current.status,
        )
          ? current
          : null;
      });
      const trace = await (
        await fetch(`${api.httpEndpoint}/v1/runs/${createdRun.id}/events`)
      ).text();
      expect(run.status, trace).toBe("partial");

      const results = await requestJson<
        Array<{ id: string; asset_type: string; has_local_content: boolean }>
      >(`${api.httpEndpoint}/v1/runs/${createdRun.id}/results`);
      const captured = results.find((candidate) => candidate.has_local_content);
      expect(captured).toMatchObject({
        asset_type: "section",
        has_local_content: true,
      });

      const content = await fetch(
        `${api.httpEndpoint}/v1/assets/${captured!.id}/content`,
      );
      expect(content.status).toBe(200);
      expect(content.headers.get("content-type")).toBe("image/png");
      expect(
        Array.from(new Uint8Array((await content.arrayBuffer()).slice(0, 8))),
      ).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

      await expect.poll(() => hasHostAccess(serviceWorker)).toBe(false);
      await popup.reload();
      await expect(popup.locator('[data-role="permission"]')).toHaveText(
        "网页读取未授权",
      );
    } finally {
      await api.close();
    }
  });
});

type MediaItem = {
  media_type: string;
  url: string | null;
  alt: string;
  adjacent_text: string;
  intrinsic_width: number;
  intrinsic_height: number;
  region: { x: number; y: number; width: number; height: number };
};

function readTabId(message: BrowserResult): number {
  const result = message.result as { tab_id?: unknown } | undefined;
  expect(message.ok).toBe(true);
  expect(typeof result?.tab_id).toBe("number");
  return result!.tab_id as number;
}

function readMedia(message: BrowserResult): MediaItem[] {
  expect(message.ok).toBe(true);
  const result = message.result as { media?: unknown } | undefined;
  expect(Array.isArray(result?.media)).toBe(true);
  return result!.media as MediaItem[];
}

async function waitForPage(context: BrowserContext, url: string): Promise<Page> {
  return waitUntil(() => context.pages().find((page) => page.url() === url) ?? null);
}

function hasHostAccess(worker: Worker): Promise<boolean> {
  return worker.evaluate(
    (origins) => chrome.permissions.contains({ origins }),
    HOST_ORIGINS,
  );
}

function storedPairingToken(worker: Worker): Promise<string | null> {
  return worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("archresearch.pairing");
    const pairing = stored["archresearch.pairing"];
    return pairing && typeof pairing === "object" && "token" in pairing
      ? String(pairing.token)
      : null;
  });
}

async function primeOptionalHostAccess(
  userDataDir: string,
  extensionPath: string,
): Promise<void> {
  // Headless Chromium cannot accept the optional-permission prompt. Prime the
  // same unpacked path once, then restore the production optional manifest.
  const manifestPath = join(extensionPath, "manifest.json");
  const productionManifest = await readFile(manifestPath, "utf8");
  const primingManifest = JSON.parse(productionManifest) as Record<
    string,
    unknown
  >;
  primingManifest.host_permissions = HOST_ORIGINS;
  delete primingManifest.optional_host_permissions;
  await writeFile(manifestPath, `${JSON.stringify(primingManifest, null, 2)}\n`);
  const primingContext = await launchExtension(userDataDir, extensionPath);
  await waitForServiceWorker(primingContext);
  await primingContext.close();
  await writeFile(manifestPath, productionManifest);
}

function launchExtension(
  userDataDir: string,
  extensionPath: string,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--host-resolver-rules=MAP ${FIXTURE_HOST} 127.0.0.1`,
      "--no-proxy-server",
    ],
  });
}

async function waitForServiceWorker(context: BrowserContext): Promise<Worker> {
  return (
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"))
  );
}

class FixtureServer {
  private constructor(
    private readonly server: Server,
    readonly port: number,
  ) {}

  static async start(): Promise<FixtureServer> {
    const fixtureDirectory = resolve(import.meta.dirname, "fixtures");
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      const pages: Record<string, string> = {
        "/board": "board.html",
        "/static": "static.html",
        "/dynamic": "dynamic.html",
        "/malicious": "malicious.html",
      };
      const page = pages[pathname];
      if (page) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(await readFile(resolve(fixtureDirectory, page)));
        return;
      }
      if (pathname.startsWith("/assets/") && pathname.endsWith(".svg")) {
        response.writeHead(200, { "content-type": "image/svg+xml" });
        response.end(svg(pathname.slice("/assets/".length, -4)));
        return;
      }
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return new FixtureServer(server, readPort(server.address()));
  }

  url(pathname: string): string {
    return `http://${FIXTURE_HOST}:${this.port}${pathname}`;
  }

  loopbackUrl(pathname: string): string {
    return `http://127.0.0.1:${this.port}${pathname}`;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolveClose, rejectClose) => {
      this.server.close((error) => {
        if (error) {
          rejectClose(error);
        } else {
          resolveClose();
        }
      });
    });
  }
}

async function requestBoardBridge(
  page: Page,
  action: "pair" | "status",
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return page.evaluate(
    ({ bridgeAction, bridgePayload }) =>
      new Promise<Record<string, unknown>>((resolveResponse, rejectResponse) => {
        const id = crypto.randomUUID();
        const timeout = window.setTimeout(
          () => rejectResponse(new Error("Board bridge timed out")),
          3_000,
        );
        window.addEventListener("message", function receive(event) {
          const response = event.data as Record<string, unknown> | null;
          if (
            event.source !== window ||
            event.origin !== window.location.origin ||
            response?.channel !== "archresearch.extension" ||
            response.id !== id
          ) {
            return;
          }
          window.removeEventListener("message", receive);
          window.clearTimeout(timeout);
          resolveResponse(response);
        });
        window.postMessage(
          {
            channel: "archresearch.board",
            protocol_version: 1,
            id,
            action: bridgeAction,
            payload: bridgePayload,
          },
          window.location.origin,
        );
      }),
    { bridgeAction: action, bridgePayload: payload },
  );
}

class ResearchCoordinator {
  private readonly sockets = new Set<ServerSocket>();
  private readonly messages: WireMessage[] = [];
  private authenticationCount = 0;
  private commandNumber = 0;

  private constructor(
    private readonly server: WebSocketServer,
    readonly endpoint: string,
  ) {}

  static async start(): Promise<ResearchCoordinator> {
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await once(server, "listening");
    const port = readPort(server.address());
    const coordinator = new ResearchCoordinator(
      server,
      `ws://127.0.0.1:${port}/v1/browser`,
    );
    server.on("connection", (socket) => coordinator.accept(socket));
    return coordinator;
  }

  nextId(): string {
    this.commandNumber += 1;
    return `e2e-${this.commandNumber}`;
  }

  async command(action: string, payload: unknown): Promise<BrowserResult> {
    return this.rawCommand({
      type: "browser.command",
      protocol_version: 1,
      id: this.nextId(),
      action,
      payload,
    });
  }

  async rawCommand(message: WireMessage): Promise<BrowserResult> {
    const id = message.id;
    if (typeof id !== "string") {
      throw new Error("Raw browser command requires an id");
    }
    this.send(message);
    return waitUntil(() => {
      const result = this.messages.find(
        (candidate) => candidate.type === "browser.result" && candidate.id === id,
      );
      return (result as BrowserResult | undefined) ?? null;
    });
  }

  send(message: WireMessage): void {
    const socket = [...this.sockets].reverse().find(
      (candidate) => candidate.readyState === ServerSocket.OPEN,
    );
    if (!socket) {
      throw new Error("No connected extension socket");
    }
    socket.send(JSON.stringify(message));
  }

  dropActiveConnection(): void {
    const socket = [...this.sockets].reverse().find(
      (candidate) => candidate.readyState === ServerSocket.OPEN,
    );
    if (!socket) {
      throw new Error("No connected extension socket to drop");
    }
    socket.terminate();
  }

  waitForAuthenticationCount(count: number): Promise<number> {
    return waitUntil(() =>
      this.authenticationCount >= count ? this.authenticationCount : null,
    );
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) {
      socket.terminate();
    }
    await new Promise<void>((resolveClose) => this.server.close(() => resolveClose()));
  }

  private accept(socket: ServerSocket): void {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("message", (data) => {
      const parsed = JSON.parse(data.toString()) as WireMessage;
      this.messages.push(parsed);
      if (
        parsed.type === "browser.authenticate" &&
        parsed.protocol_version === 1 &&
        parsed.token === "e2e-pairing-code"
      ) {
        this.authenticationCount += 1;
        socket.send(
          JSON.stringify({
            type: "browser.authenticated",
            protocol_version: 1,
          }),
        );
      }
    });
  }
}

class TestApi {
  private constructor(
    readonly httpEndpoint: string,
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly readOutput: () => string,
  ) {}

  get websocketEndpoint(): string {
    return this.httpEndpoint.replace("http://", "ws://") + "/v1/browser";
  }

  static async start(testRoot: string, fixtureUrl: string): Promise<TestApi> {
    const port = await unusedLoopbackPort();
    const dataDirectory = join(testRoot, "full-stack-api");
    await mkdir(dataDirectory, { recursive: true });
    let output = "";
    const child = spawn(
      E2E_PYTHON,
      [
        E2E_API_SCRIPT,
        "--port",
        String(port),
        "--data-dir",
        dataDirectory,
        "--source-url",
        fixtureUrl,
      ],
      {
        cwd: REPOSITORY_ROOT,
        env: {
          ...process.env,
          PYTHONPATH: resolve(REPOSITORY_ROOT, "apps/api/src"),
        },
      },
    );
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    const api = new TestApi(
      `http://127.0.0.1:${port}`,
      child,
      () => output,
    );
    await waitUntilAsync(async () => {
      if (child.exitCode !== null) {
        throw new Error(`E2E API exited during startup:\n${output}`);
      }
      try {
        const response = await fetch(`${api.httpEndpoint}/health`);
        return response.ok ? true : null;
      } catch {
        return null;
      }
    }, 15_000);
    return api;
  }

  async close(): Promise<void> {
    if (this.child.exitCode !== null) {
      return;
    }
    await fetch(`${this.httpEndpoint}/__e2e__/shutdown`, {
      method: "POST",
    }).catch(() => undefined);
    await Promise.race([
      once(this.child, "exit"),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (this.child.exitCode === null) {
      this.child.kill();
      throw new Error(`E2E API did not stop:\n${this.readOutput()}`);
    }
  }
}

function svg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#f4f4f0"/><path d="M80 530H1120M180 530V210H520V530M680 530V130H1020V530" fill="none" stroke="#171b19" stroke-width="12"/><text x="80" y="90" font-family="sans-serif" font-size="40">${label}</text></svg>`;
}

function readPort(address: AddressInfo | string | null): number {
  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP port");
  }
  return address.port;
}

async function unusedLoopbackPort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = readPort(server.address());
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  return port;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function waitUntil<T>(
  read: () => T | null,
  timeoutMilliseconds = 8_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== null) {
      return value;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error("Timed out waiting for E2E condition");
}

async function waitUntilAsync<T>(
  read: () => Promise<T | null>,
  timeoutMilliseconds = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) {
      return value;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error("Timed out waiting for asynchronous E2E condition");
}
