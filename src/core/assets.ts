const images: Map<string, Promise<HTMLImageElement>> = new Map();

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image ${src}`));
      image.src = src;
      return image;
    });

    images.set(src, promise);
  }

  return images.get(src)!;
}
