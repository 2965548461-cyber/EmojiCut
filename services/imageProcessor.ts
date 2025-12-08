import { StickerSegment } from '../types';

export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Loads an image from a File object.
 */
export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Checks if a pixel is effectively "white" or transparent.
 */
const isBackground = (r: number, g: number, b: number, a: number): boolean => {
  if (a < 20) return true; // Transparent
  // High brightness is considered background (white paper)
  return r > 240 && g > 240 && b > 240;
};

/**
 * Merges bounding boxes that are spatially close to each other.
 */
const mergeRects = (rects: Rect[], distanceThreshold: number): Rect[] => {
  let merged = [...rects];
  let changed = true;

  while (changed) {
    changed = false;
    const newMerged: Rect[] = [];
    const visited = new Set<number>();

    for (let i = 0; i < merged.length; i++) {
      if (visited.has(i)) continue;
      
      let current = { ...merged[i] };
      visited.add(i);

      for (let j = i + 1; j < merged.length; j++) {
        if (visited.has(j)) continue;
        
        const other = merged[j];
        
        const xDist = Math.max(0, current.minX - other.maxX, other.minX - current.maxX);
        const yDist = Math.max(0, current.minY - other.maxY, other.minY - current.maxY);
        
        if (xDist < distanceThreshold && yDist < distanceThreshold) {
          current.minX = Math.min(current.minX, other.minX);
          current.minY = Math.min(current.minY, other.minY);
          current.maxX = Math.max(current.maxX, other.maxX);
          current.maxY = Math.max(current.maxY, other.maxY);
          visited.add(j);
          changed = true;
        }
      }
      newMerged.push(current);
    }
    merged = newMerged;
  }
  return merged;
};

/**
 * Extracts a specific region from an image/canvas, removes background, and returns a segment.
 */
export const extractStickerFromRect = (
  source: HTMLImageElement | HTMLCanvasElement,
  rect: Rect,
  defaultName: string = 'sticker'
): StickerSegment | null => {
    const padding = 5;
    const width = source.width;
    const height = source.height;

    const finalX = Math.max(0, rect.minX - padding);
    const finalY = Math.max(0, rect.minY - padding);
    const finalW = Math.min(width - finalX, (rect.maxX - rect.minX) + padding * 2);
    const finalH = Math.min(height - finalY, (rect.maxY - rect.minY) + padding * 2);

    if (finalW <= 0 || finalH <= 0) return null;

    const segCanvas = document.createElement('canvas');
    segCanvas.width = finalW;
    segCanvas.height = finalH;
    const segCtx = segCanvas.getContext('2d');
    if (!segCtx) return null;

    segCtx.drawImage(
      source,
      finalX, finalY, finalW, finalH,
      0, 0, finalW, finalH
    );

    const segImageData = segCtx.getImageData(0, 0, finalW, finalH);
    const segPixels = segImageData.data;
    for (let i = 0; i < segPixels.length; i += 4) {
      if (isBackground(segPixels[i], segPixels[i+1], segPixels[i+2], segPixels[i+3])) {
        segPixels[i+3] = 0; 
      }
    }
    segCtx.putImageData(segImageData, 0, 0);

    return {
      id: crypto.randomUUID(),
      dataUrl: segCanvas.toDataURL('image/png'),
      originalX: finalX,
      originalY: finalY,
      width: finalW,
      height: finalH,
      name: defaultName,
      isNaming: false
    };
};

/**
 * Main function to process the sticker sheet.
 */
export const processStickerSheet = async (
  image: HTMLImageElement,
  onProgress: (msg: string) => void
): Promise<StickerSegment[]> => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  onProgress("Scanning image for content...");

  const visited = new Uint8Array(width * height);
  const rawRects: Rect[] = [];
  const getIdx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 0; y < height; y++) { 
    for (let x = 0; x < width; x++) {
      const visitIdx = y * width + x;

      if (visited[visitIdx]) continue;

      const idx = getIdx(x, y);
      if (!isBackground(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        let minX = x, maxX = x, minY = y, maxY = y;
        let count = 0;
        
        const stack = [[x, y]];
        visited[visitIdx] = 1;

        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          count++;

          const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nVisitIdx = ny * width + nx;
              if (visited[nVisitIdx] === 0) {
                const nIdx = getIdx(nx, ny);
                if (!isBackground(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3])) {
                  visited[nVisitIdx] = 1;
                  stack.push([nx, ny]);
                }
              }
            }
          }
        }

        const w = maxX - minX;
        const h = maxY - minY;
        if (count > 50 && w > 5 && h > 5) {
          rawRects.push({ minX, maxX, minY, maxY });
        }
      }
    }
  }

  onProgress(`Detected ${rawRects.length} components. Grouping...`);

  // Reduced threshold from 50 to 15 to prevent merging distinct stickers
  const mergedRects = mergeRects(rawRects, 15);

  onProgress(`Identified ${mergedRects.length} stickers. Extracting...`);

  const finalSegments: StickerSegment[] = [];
  
  for (let i = 0; i < mergedRects.length; i++) {
    const rect = mergedRects[i];
    const segment = extractStickerFromRect(canvas, rect, `sticker_${i + 1}`);
    if (segment) {
        finalSegments.push(segment);
    }
  }

  return finalSegments;
};