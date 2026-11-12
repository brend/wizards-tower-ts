export function getPixelRatio(): number {
  return window.devicePixelRatio || 1;
}

// Convert once, then reuse the canvas without relying on Canvas 2D filters.
export function createGrayscaleImage(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Could not create canvas");

  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * 0.6;
    data[i] = data[i + 1] = data[i + 2] = gray;
    // Preserve alpha so the sprite's transparent pixels stay transparent.
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function generateCanvas(width: number, height: number, zoom: number = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create canvas");
  const ratio = getPixelRatio();

  canvas.width = Math.round(width * zoom * ratio);
  canvas.height = Math.round(height * zoom * ratio);
  canvas.style.width = `${width * zoom}px`;
  canvas.style.height = `${height * zoom}px`;
  canvas.classList.add("game");
  // Drawing coordinates remain in logical pixels on high-density displays.
  context.setTransform(
    canvas.width / width,
    0,
    0,
    canvas.height / height,
    0,
    0,
  );
  context.imageSmoothingEnabled = false;

  return canvas;
}
