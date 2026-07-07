// Compress an image File to a WebP Blob using canvas.
export async function compressToWebP(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const img = await loadImage(file);
  const { width, height } = fit(img.width, img.height, maxDim);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/webp",
      quality
    )
  );
}

function fit(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const r = w > h ? max / w : max / h;
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
