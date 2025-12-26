import { Camera } from "./camera";
import { InputManager } from "./inputManager";

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

export class ShaderRenderer {
  private canvas: HTMLCanvasElement;
  private errorsDiv: HTMLDivElement;
  private statusDiv: HTMLDivElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private lastRenderTime: number = 0;

  private input: InputManager;
  private camera: Camera;

  constructor(canvas: HTMLCanvasElement, errorsDiv: HTMLDivElement, statusDiv: HTMLDivElement, inputManager: InputManager) {
    this.canvas = canvas;
    this.errorsDiv = errorsDiv;
    this.statusDiv = statusDiv;
    this.input = inputManager;
    this.camera = inputManager.getCamera();
    this.gl = canvas.getContext("webgl2");

    if (!this.gl) {
      this.showError("WebGL not supported.");
    }

    this.startTime = performance.now();
  }

  private updateStatus(fps: number) {
    const status = `${fps.toFixed(1)} FPS` + (this.input.inputLocked ? " | MOVE" : "");
    this.statusDiv.textContent = status;
  }

  private showError(message: string) {
    this.errorsDiv.textContent = message;
  }

  private clearError() {
    this.errorsDiv.textContent = "";
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

    return program;
  }

  compile(userCode: string): boolean {
    if (!this.gl) return false;

    const fragSrc = `#version 300 es
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec4 iMouse;
      uniform vec3 iCameraPosition;
      uniform vec3 iCameraForward;
      uniform vec3 iCameraRight;
      uniform vec3 iCameraUp;
      ${userCode}
      out vec4 fragColor;
      void main() {
        mainImage(fragColor, gl_FragCoord.xy);
      }
    `;

    try {
      this.program = this.createProgram(VERTEX_SCREEN, fragSrc);
      this.clearError();
      return true;
    } catch (e: any) {
      this.showError(e.message);
      return false;
    }
  }

  start() {
    if (!this.gl || !this.program) return;

    this.stop();
    this.gl.useProgram(this.program);

    const iTimeLoc = this.gl.getUniformLocation(this.program, "iTime");
    const iResolutionLoc = this.gl.getUniformLocation(this.program, "iResolution");
    const iMouseLoc = this.gl.getUniformLocation(this.program, "iMouse");
    const iCameraPositionLoc = this.gl.getUniformLocation(this.program, "iCameraPosition");
    const iCameraForwardLoc = this.gl.getUniformLocation(this.program, "iCameraForward");
    const iCameraRightLoc = this.gl.getUniformLocation(this.program, "iCameraRight");
    const iCameraUpLoc = this.gl.getUniformLocation(this.program, "iCameraUp");

    this.lastRenderTime = performance.now();

    const render = () => {
      if (!this.gl || !this.program) return;

      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      const now = performance.now();
      const deltaTime = (now - this.lastRenderTime) / 1000.0;
      this.input.tick(deltaTime);
      this.updateStatus(1.0 / deltaTime);
      this.lastRenderTime = now;

      this.gl.uniform1f(iTimeLoc, (now - this.startTime) / 1000.0);
      this.gl.uniform2f(iResolutionLoc, this.canvas.width, this.canvas.height);
      this.gl.uniform4f(iMouseLoc, this.input.mouseX, this.input.mouseY, this.input.canvasMouseDown ? 1.0 : 0.0, 0.0);
      this.gl.uniform3f(iCameraPositionLoc, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
      this.gl.uniform3f(iCameraForwardLoc, this.camera.forward[0], this.camera.forward[1], this.camera.forward[2]);
      this.gl.uniform3f(iCameraRightLoc, this.camera.right[0], this.camera.right[1], this.camera.right[2]);
      this.gl.uniform3f(iCameraUpLoc, this.camera.up[0], this.camera.up[1], this.camera.up[2]);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

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

  compileAndStart(userCode: string) {
    if (this.compile(userCode)) {
      this.start();
    }
  }
}
