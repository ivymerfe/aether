type TextureRecord = {
  texture: WebGLTexture;
  ready: boolean;
  width: number;
  height: number;
  error?: string;
  loading?: boolean;
};

export class TexturePool {
  private readonly map = new Map<string, TextureRecord>();
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  get(url: string): WebGLTexture {
    const existing = this.map.get(url);
    if (existing) return existing.texture;

    const tex = this.gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");

    // placeholder 1x1
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    const rec: TextureRecord = { texture: tex, ready: false, width: 1, height: 1, loading: true };
    this.map.set(url, rec);

    this.loadInto(url, rec).catch((e) => {
      rec.error = String(e?.message ?? e);
      rec.loading = false;
    });

    return tex;
  }

  private async loadInto(url: string, rec: TextureRecord): Promise<void> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    // wait load
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    });

    // decode if supported (optional)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyImg: any = img;
    if (typeof anyImg.decode === "function") {
      try {
        await anyImg.decode();
      } catch {
        // ignore decode errors; onload already fired
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, rec.texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      img
    );

    // NPOT safe params already set; no mipmaps
    rec.ready = true;
    rec.loading = false;
    rec.width = img.naturalWidth || img.width;
    rec.height = img.naturalHeight || img.height;
  }
}
