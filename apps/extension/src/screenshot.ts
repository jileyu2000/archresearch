export type ViewportMetrics = { width: number; height: number };

export async function cropScreenshot(
  dataUrl: string,
  region: { x: number; y: number; width: number; height: number },
  viewport: ViewportMetrics,
): Promise<string> {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("Invalid viewport metrics");
  }
  const sourceBlob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const scaleX = bitmap.width / viewport.width;
    const scaleY = bitmap.height / viewport.height;
    const sourceX = Math.round(region.x * scaleX);
    const sourceY = Math.round(region.y * scaleY);
    const sourceWidth = Math.round(region.width * scaleX);
    const sourceHeight = Math.round(region.height * scaleY);
    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceWidth < 1 ||
      sourceHeight < 1 ||
      sourceX + sourceWidth > bitmap.width ||
      sourceY + sourceHeight > bitmap.height
    ) {
      throw new Error("Capture region falls outside the visible viewport");
    }

    const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Screenshot canvas is unavailable");
    }
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );
    return blobToDataUrl(await canvas.convertToBlob({ type: "image/png" }));
  } finally {
    bitmap.close();
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}
