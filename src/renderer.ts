import { Camera } from "./camera";
import { InputManager } from "./inputManager";

const libCode = `
float tanh(float x) {
  float e1 = exp(x);
  float e2 = exp(-x);
  return (e1 - e2) / (e1 + e2);
}

vec2 tanh(vec2 x) {
  return vec2(tanh(x.x), tanh(x.y));
}

vec3 tanh(vec3 x) {
  return vec3(tanh(x.x), tanh(x.y), tanh(x.z));
}

vec4 tanh(vec4 x) {
  return vec4(tanh(x.x), tanh(x.y), tanh(x.z), tanh(x.w));
}
`;

export class GLSLRenderer {
  private canvas: HTMLCanvasElement;
  private errorsDiv: HTMLDivElement;
  private statusDiv: HTMLDivElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private lastRenderTime: number = 0;

  private mouseX: number = 0;
  private mouseY: number = 0
  private buttonPressed: boolean = false;

  private inputManager: InputManager;
  private camera: Camera;

  constructor(canvas: HTMLCanvasElement, errorsDiv: HTMLDivElement, statusDiv: HTMLDivElement, inputManager: InputManager) {
    this.canvas = canvas;
    this.errorsDiv = errorsDiv;
    this.statusDiv = statusDiv;
    this.inputManager = inputManager;
    this.camera = inputManager.getCamera();
    this.gl = canvas.getContext("webgl");

    if (!this.gl) {
      this.showError("WebGL not supported.");
    }

    this.startTime = performance.now();

    canvas.addEventListener("mousemove", (e) => {
      if (document.activeElement === canvas) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      }
    });
    canvas.addEventListener("mousedown", () => {
      this.buttonPressed = true;
    });
    canvas.addEventListener("mouseup", () => {
      this.buttonPressed = false;
    });
  }

  private updateStatus(fps: number) {
    this.statusDiv.textContent = `${fps.toFixed(1)} FPS`;
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

    // Stop any existing render loop
    this.stop();

    const vertexSrc = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragSrc = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec4 iMouse;
      uniform vec3 iCameraPosition;
      uniform vec3 iCameraForward;
      uniform vec3 iCameraRight;
      uniform vec3 iCameraUp;
      ${libCode}
      ${userCode}
      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    try {
      this.clearError();

      // Create and link the shader program
      this.program = this.createProgram(vertexSrc, fragSrc);
      this.gl.useProgram(this.program);

      // Set up geometry (full screen quad)
      const positionBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1, 1, -1, -1, 1,
          -1, 1, 1, -1, 1, 1
        ]),
        this.gl.STATIC_DRAW
      );

      const posLoc = this.gl.getAttribLocation(this.program, "position");
      this.gl.enableVertexAttribArray(posLoc);
      this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

      return true;
    } catch (e: any) {
      this.showError(e.message);
      return false;
    }
  }

  start() {
    if (!this.gl || !this.program) return;

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
      this.inputManager.tick(deltaTime);
      this.updateStatus(1.0 / deltaTime);
      this.lastRenderTime = now;

      this.gl.uniform1f(iTimeLoc, (now - this.startTime) / 1000.0);
      this.gl.uniform2f(iResolutionLoc, this.canvas.width, this.canvas.height);
      this.gl.uniform4f(iMouseLoc, this.mouseX, this.canvas.height - this.mouseY, this.buttonPressed ? 1.0 : 0.0, 0.0);
      this.gl.uniform3f(iCameraPositionLoc, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
      this.gl.uniform3f(iCameraForwardLoc, this.camera.forward[0], this.camera.forward[1], this.camera.forward[2]);
      this.gl.uniform3f(iCameraRightLoc, this.camera.right[0], this.camera.right[1], this.camera.right[2]);
      this.gl.uniform3f(iCameraUpLoc, this.camera.up[0], this.camera.up[1], this.camera.up[2]);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

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
