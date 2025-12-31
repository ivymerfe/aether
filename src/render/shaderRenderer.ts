import type { App } from "../app";
import { Camera } from "./camera";
import { InputManager } from "../inputManager";
import {
  ShaderPipelineBuilder,
  type PipelineDesc,
  type PassDesc,
} from "./shaderPipeline";
import { TexturePool } from "./texturePool";

const VERTEX_SCREEN = `#version 300 es
precision highp float;
const vec2 positions[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);
void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`;

type SamplerBinding =
  | { kind: "texture"; name: string; url: string }
  | { kind: "buffer"; name: string; file: string };

type CompiledPass = {
  file: string;
  program: WebGLProgram;
  // if this pass is used as a buffer output, we render it into these:
  framebuffer: WebGLFramebuffer | null;
  colorTex: WebGLTexture | null;

  // directives
  samplers: SamplerBinding[];

  // uniform locations
  uTime: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uMouse: WebGLUniformLocation | null;
  uCamPos: WebGLUniformLocation | null;
  uCamFwd: WebGLUniformLocation | null;
  uCamRight: WebGLUniformLocation | null;
  uCamUp: WebGLUniformLocation | null;
  uSamplerLocs: Map<string, WebGLUniformLocation | null>;
};

export class ShaderRenderer {
  private canvas: HTMLCanvasElement;
  private errorsDiv: HTMLDivElement;
  private statusDiv: HTMLDivElement;

  private gl: WebGL2RenderingContext | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private lastRenderTime: number = 0;
  private lastCompileDuration: number = 0;

  private app: App;
  private input: InputManager;
  private camera: Camera;

  private vao: WebGLVertexArrayObject | null = null;

  private pipelineDesc: PipelineDesc | null = null;
  private passes: CompiledPass[] = [];
  private passByFile = new Map<string, CompiledPass>();

  private texturePool: TexturePool | null = null;
  private pipelineBuilder: ShaderPipelineBuilder;

  constructor(
    app: App,
    canvas: HTMLCanvasElement,
    errorsDiv: HTMLDivElement,
    statusDiv: HTMLDivElement
  ) {
    this.app = app;
    this.input = app.inputManager;
    this.camera = this.input.getCamera();

    this.canvas = canvas;
    this.errorsDiv = errorsDiv;
    this.statusDiv = statusDiv;

    this.gl = canvas.getContext("webgl2");

    if (!this.gl) {
      this.showError("WebGL2 not supported.");
    } else {
      // WebGL2 требует VAO для gl_VertexID-пайплайна (корректнее явно создать)
      this.vao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.vao);

      this.gl.clearColor(0, 0, 0, 1);
      this.texturePool = new TexturePool(this.gl);
    }

    this.pipelineBuilder = new ShaderPipelineBuilder((p) => this.app.read(p));

    this.startTime = performance.now();
  }

  loadShader(file: string) {
    const currentTime = performance.now();
    const success = this.compile(file);
    this.lastCompileDuration = performance.now() - currentTime;
    if (success) {
      this.start();
    }
  }

  private updateStatus(fps: number) {
    const safe = Number.isFinite(fps) ? fps : 0;
    var status =
      `${safe.toFixed(1)} FPS` + (this.input.inputLocked ? " | MOVE" : "");
    status += `\nCompile: ${this.lastCompileDuration.toFixed(1)} ms`;
    this.statusDiv.textContent = status;
  }

  private showError(message: string) {
    this.errorsDiv.textContent = message;
  }

  private clearError() {
    this.errorsDiv.textContent = "";
  }
  compile(file: string): boolean {
    if (!this.gl || !this.texturePool) return false;

    try {
      // build pipeline graph (recursive includes + buffers)
      this.pipelineDesc = this.pipelineBuilder.build(file);

      // compile programs for passes
      const newPasses: CompiledPass[] = [];
      const newPassByFile = new Map<string, CompiledPass>();

      for (const pass of this.pipelineDesc.passesInOrder) {
        const compiled = this.compilePass(pass);
        newPasses.push(compiled);
        newPassByFile.set(compiled.file, compiled);
      }

      // create FBO textures for passes that are referenced as buffers
      // (any pass that appears as buffer dependency should have render target)
      const referencedAsBuffer = new Set<string>();
      for (const p of this.pipelineDesc.passesInOrder) {
        for (const b of p.expanded.buffers) referencedAsBuffer.add(b.file);
      }
      for (const p of newPasses) {
        if (referencedAsBuffer.has(p.file)) {
          this.ensurePassRenderTarget(p);
        }
      }

      // kick texture loads (placeholders returned immediately)
      for (const p of this.pipelineDesc.passesInOrder) {
        for (const t of p.expanded.textures) {
          this.texturePool.get(t.url);
        }
      }
      this.disposePassResources();
      this.passes = newPasses;
      this.passByFile = newPassByFile;

      this.clearError();
      return true;
    } catch (e: any) {
      this.showError(e?.message ?? String(e));
      return false;
    }
  }

  start() {
    if (!this.gl || this.passes.length === 0) return;

    this.stop();

    this.lastRenderTime = performance.now();

    const render = () => {
      if (!this.gl) return;

      // resize-aware RTs
      for (const p of this.passes) {
        if (p.framebuffer) this.ensurePassRenderTarget(p);
      }

      const now = performance.now();
      const deltaTime = (now - this.lastRenderTime) / 1000.0;
      this.input.tick(deltaTime);
      this.updateStatus(1.0 / deltaTime);
      this.lastRenderTime = now;

      const timeSec = (now - this.startTime) / 1000.0;

      // render passes in topo order (deps first), final pass renders to screen
      const entry = this.pipelineDesc?.entry ?? null;

      for (const pass of this.passes) {
        const isFinal = pass.file === entry;
        this.renderPass(pass, {
          timeSec,
          isFinal,
        });
      }

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private renderPass(
    pass: CompiledPass,
    opts: { timeSec: number; isFinal: boolean }
  ) {
    if (!this.gl || !this.texturePool) return;

    // target
    if (opts.isFinal) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    } else if (pass.framebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, pass.framebuffer);
    } else {
      // pass without RT and not final: do not draw anything
      return;
    }

    this.gl.useProgram(pass.program);
    if (this.vao) this.gl.bindVertexArray(this.vao);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // common uniforms
    if (pass.uTime) this.gl.uniform1f(pass.uTime, opts.timeSec);
    if (pass.uResolution)
      this.gl.uniform2f(
        pass.uResolution,
        this.canvas.width,
        this.canvas.height
      );
    if (pass.uMouse) {
      this.gl.uniform4f(
        pass.uMouse,
        this.input.mouseX,
        this.input.mouseY,
        this.input.canvasMouseDown ? 1.0 : 0.0,
        0.0
      );
    }
    if (pass.uCamPos) {
      this.gl.uniform3f(
        pass.uCamPos,
        this.camera.position[0],
        this.camera.position[1],
        this.camera.position[2]
      );
    }
    if (pass.uCamFwd) {
      this.gl.uniform3f(
        pass.uCamFwd,
        this.camera.forward[0],
        this.camera.forward[1],
        this.camera.forward[2]
      );
    }
    if (pass.uCamRight) {
      this.gl.uniform3f(
        pass.uCamRight,
        this.camera.right[0],
        this.camera.right[1],
        this.camera.right[2]
      );
    }
    if (pass.uCamUp) {
      this.gl.uniform3f(
        pass.uCamUp,
        this.camera.up[0],
        this.camera.up[1],
        this.camera.up[2]
      );
    }

    // samplers: textures + buffers
    let unit = 0;
    for (const s of pass.samplers) {
      const loc = pass.uSamplerLocs.get(s.name) ?? null;
      if (!loc) {
        unit++;
        continue;
      }

      this.gl.activeTexture(this.gl.TEXTURE0 + unit);

      if (s.kind === "texture") {
        const tex = this.texturePool.get(s.url);
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      } else {
        const dep = this.passByFile.get(s.file);
        if (!dep?.colorTex) {
          // if dependency does not yet have RT, bind a dummy
          this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        } else {
          this.gl.bindTexture(this.gl.TEXTURE_2D, dep.colorTex);
        }
      }

      this.gl.uniform1i(loc, unit);
      unit++;
    }

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private compilePass(pass: PassDesc): CompiledPass {
    if (!this.gl) throw new Error("WebGL context not available");

    const expanded = pass.expanded;

    // Build sampler list (stable order):
    // first textures, then buffers (so units are deterministic)
    const samplers: SamplerBinding[] = [];
    for (const t of expanded.textures)
      samplers.push({ kind: "texture", name: t.name, url: t.url });
    for (const b of expanded.buffers)
      samplers.push({ kind: "buffer", name: b.name, file: b.file });

    const samplerUniformDecl = samplers
      .map((s) => `uniform sampler2D ${s.name};`)
      .join("\n");

    const fragSrc = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec3 iCameraPosition;
uniform vec3 iCameraForward;
uniform vec3 iCameraRight;
uniform vec3 iCameraUp;

${samplerUniformDecl}

${expanded.code}

out vec4 fragColor;
void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
`;

    const program = this.createProgram(VERTEX_SCREEN, fragSrc);

    const uSamplerLocs = new Map<string, WebGLUniformLocation | null>();
    for (const s of samplers) {
      uSamplerLocs.set(s.name, this.gl.getUniformLocation(program, s.name));
    }

    return {
      file: pass.file,
      program,
      framebuffer: null,
      colorTex: null,
      samplers,

      uTime: this.gl.getUniformLocation(program, "iTime"),
      uResolution: this.gl.getUniformLocation(program, "iResolution"),
      uMouse: this.gl.getUniformLocation(program, "iMouse"),
      uCamPos: this.gl.getUniformLocation(program, "iCameraPosition"),
      uCamFwd: this.gl.getUniformLocation(program, "iCameraForward"),
      uCamRight: this.gl.getUniformLocation(program, "iCameraRight"),
      uCamUp: this.gl.getUniformLocation(program, "iCameraUp"),
      uSamplerLocs,
    };
  }

  private ensurePassRenderTarget(pass: CompiledPass) {
    if (!this.gl) return;

    const w = Math.max(1, this.canvas.width | 0);
    const h = Math.max(1, this.canvas.height | 0);

    // (re)create if missing
    if (!pass.framebuffer || !pass.colorTex) {
      const fbo = this.gl.createFramebuffer();
      const tex = this.gl.createTexture();
      if (!fbo || !tex)
        throw new Error("Failed to create framebuffer/texture for buffer pass");

      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE
      );
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        w,
        h,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      );

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        tex,
        0
      );

      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(
          `Framebuffer incomplete for pass ${pass.file}: 0x${status.toString(
            16
          )}`
        );
      }

      pass.framebuffer = fbo;
      pass.colorTex = tex;

      // cleanup binds
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      return;
    }

    // resize tex if needed (we don’t store size per-pass; just reallocate each time canvas changes)
    this.gl.bindTexture(this.gl.TEXTURE_2D, pass.colorTex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      w,
      h,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
  }

  private disposePassResources() {
    if (!this.gl) return;
    for (const p of this.passes) {
      if (p.framebuffer) this.gl.deleteFramebuffer(p.framebuffer);
      if (p.colorTex) this.gl.deleteTexture(p.colorTex);
      if (p.program) this.gl.deleteProgram(p.program);
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error("WebGL context not available");

    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(info || "Shader compile error");
    }

    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    if (!this.gl) throw new Error("WebGL context not available");

    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
    const program = this.gl.createProgram()!;

    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(info || "Program link error");
    }

    // shaders no longer needed after link
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);

    return program;
  }
}
      