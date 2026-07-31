import { afterEach, describe, expect, it, vi } from "vitest";

import { cropScreenshot } from "../src/screenshot";

type FakeBitmap = {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
};

type FakeCanvas = {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  convertToBlob: ReturnType<typeof vi.fn>;
};

function installBrowserPrimitives(context: { drawImage: ReturnType<typeof vi.fn> } | null = {
  drawImage: vi.fn(),
}) {
  const bitmap: FakeBitmap = {
    width: 800,
    height: 600,
    close: vi.fn(),
  };
  const sourceBlob = {} as Blob;
  const outputBlob = {
    type: "image/png",
    arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
  } as unknown as Blob;
  const fetchMock = vi.fn().mockResolvedValue({
    blob: vi.fn().mockResolvedValue(sourceBlob),
  });
  const canvasInstances: FakeCanvas[] = [];

  class FakeOffscreenCanvas {
    readonly getContext = vi.fn(() => context);
    readonly convertToBlob = vi.fn().mockResolvedValue(outputBlob);

    constructor(readonly width: number, readonly height: number) {
      canvasInstances.push(this);
    }
  }

  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  vi.stubGlobal(
    "btoa",
    (value: string) => Buffer.from(value, "binary").toString("base64"),
  );

  return { bitmap, canvasInstances, context, fetchMock };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("screenshot cropping", () => {
  it("scales a viewport crop and encodes the PNG result", async () => {
    const state = installBrowserPrimitives();

    await expect(
      cropScreenshot(
        "data:image/png;base64,source",
        { x: 10, y: 20, width: 30, height: 40 },
        { width: 400, height: 300 },
      ),
    ).resolves.toBe("data:image/png;base64,AQID");

    expect(state.fetchMock).toHaveBeenCalledWith("data:image/png;base64,source");
    expect(state.canvasInstances).toHaveLength(1);
    expect(state.canvasInstances[0]!.width).toBe(60);
    expect(state.canvasInstances[0]!.height).toBe(80);
    expect(state.context!.drawImage).toHaveBeenCalledWith(
      state.bitmap,
      20,
      40,
      60,
      80,
      0,
      0,
      60,
      80,
    );
    expect(state.bitmap.close).toHaveBeenCalledOnce();
  });

  it("rejects invalid viewport metrics before fetching the source", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cropScreenshot(
        "data:image/png;base64,source",
        { x: 0, y: 0, width: 10, height: 10 },
        { width: 0, height: 300 },
      ),
    ).rejects.toThrow("Invalid viewport metrics");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["negative x", { x: -1, y: 20, width: 30, height: 40 }],
    ["negative y", { x: 10, y: -1, width: 30, height: 40 }],
    ["zero width", { x: 10, y: 20, width: 0, height: 40 }],
    ["zero height", { x: 10, y: 20, width: 30, height: 0 }],
    ["right overflow", { x: 390, y: 20, width: 20, height: 40 }],
    ["bottom overflow", { x: 10, y: 290, width: 30, height: 20 }],
  ])("rejects a %s capture region and closes the bitmap", async (_label, region) => {
    const state = installBrowserPrimitives();

    await expect(
      cropScreenshot("data:image/png;base64,source", region, {
        width: 400,
        height: 300,
      }),
    ).rejects.toThrow("Capture region falls outside the visible viewport");
    expect(state.canvasInstances).toHaveLength(0);
    expect(state.bitmap.close).toHaveBeenCalledOnce();
  });

  it("rejects when the browser cannot create a 2D canvas context", async () => {
    const state = installBrowserPrimitives(null);

    await expect(
      cropScreenshot(
        "data:image/png;base64,source",
        { x: 10, y: 20, width: 30, height: 40 },
        { width: 400, height: 300 },
      ),
    ).rejects.toThrow("Screenshot canvas is unavailable");
    expect(state.bitmap.close).toHaveBeenCalledOnce();
  });
});
