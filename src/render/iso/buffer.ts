/**
 * A tiny RGBA pixel buffer for baking iso terrain one art pixel at a time.
 * Baking happens once per room (and again only when the ground changes), so
 * per-pixel work here costs nothing at frame time.
 */
export type RGB = [number, number, number];

export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shade(c: RGB, k: number): RGB {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class PixelBuffer {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  }

  set(x: number, y: number, c: RGB, a = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const k = a / 255;
    const da = this.data[i + 3]! / 255;
    const oa = k + da * (1 - k);
    if (oa <= 0) return;
    for (let j = 0; j < 3; j++) this.data[i + j] = (c[j]! * k + this.data[i + j]! * da * (1 - k)) / oa;
    this.data[i + 3] = oa * 255;
  }

  get(x: number, y: number): RGB | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const i = (y * this.width + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.getContext('2d')!.putImageData(new ImageData(this.data, this.width, this.height), 0, 0);
    return canvas;
  }
}
