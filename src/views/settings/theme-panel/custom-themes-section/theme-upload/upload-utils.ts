export async function fileToPreviewDataUrl(file: File, maxDim = 720): Promise<string | null> {
  const blob = await scaleToBlob(file, maxDim);
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export async function scaleToBlob(file: File, maxDim = 1920): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    if (!img.naturalWidth) return file;
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || file), "image/webp", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
