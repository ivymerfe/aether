import { Camera } from "./render/camera";

export class InputManager {
  private canvas: HTMLCanvasElement;
  private camera: Camera = new Camera();

  private sensitivityX: number = 0.006;
  private sensitivityY: number = 0.004;
  private lookButton = 0;
  private moveButton = 2;

  public lookButtonDown: boolean = false;
  public inputLocked = false;
  public keyState: { [key: string]: boolean } = {};
  public lastKey: string = "";

  public mouseX: number = 0;
  public mouseY: number = 0
  public canvasMouseDown: boolean = false;

  public setInputLock(value: boolean) {
    this.inputLocked = value;
    if (!this.inputLocked) {
      document.exitPointerLock();
    }
  }

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;

    window.addEventListener("keydown", (e) => {
      this.lastKey = e.code;
      if (this.inputLocked || this.keyState[e.code] || this.lookButtonDown) {
        console.log(e.key);
        e.preventDefault();
        if (!e.altKey) e.stopImmediatePropagation();
      }
      if (this.inputLocked) {
        this.keyState[e.code] = true;
      }
    }, true);
    window.addEventListener("keyup", (e) => {
      this.keyState[e.code] = false;
      if (this.inputLocked) {
        e.preventDefault();
        if (!e.altKey) e.stopImmediatePropagation();
      }
    }, true);
    this.canvas.addEventListener("dblclick", (e) => {
      if (e.button === this.lookButton) {
        this.setInputLock(true);
        this.canvas.requestPointerLock();
      }
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === this.lookButton) {
        this.lookButtonDown = true;
        this.canvasMouseDown = true;
        e.preventDefault();
      }
    });
    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === this.lookButton) {
        this.canvasMouseDown = false;
      }
    });
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = rect.bottom - e.clientY;
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === this.moveButton) {
        this.lastKey = "MoveButton";
        this.setInputLock(!this.inputLocked);
        e.preventDefault();
        return;
      }
      if (e.target !== this.canvas) {
        this.setInputLock(false);
      }
    }, true);
    window.addEventListener("mouseup", (e) => {
      if (e.button === this.lookButton) {
        this.lookButtonDown = false;
      }
    }, true);
    window.addEventListener("mousemove", (e) => {
      if (this.lookButtonDown || this.inputLocked) {
        this.camera.onMouse(e.movementX * -this.sensitivityX, e.movementY * -this.sensitivityY);
      }
    });
    window.addEventListener("wheel", (e) => {
      if (this.inputLocked) {
        this.camera.onScroll(e.deltaY);
      }
    });
    window.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  private isPressed(key: string): number {
    return this.keyState[key] ? 1 : 0;
  }

  public tick(deltaTime: number) {
    if (this.inputLocked) {
      const forward = this.isPressed("KeyW") - this.isPressed("KeyS");
      const right = this.isPressed("KeyD") - this.isPressed("KeyA");
      const up = this.isPressed("Space") - this.isPressed("ShiftLeft");
      this.camera.onInput(deltaTime, right, up, forward, 0);
    }
  }

  getCamera(): Camera {
    return this.camera;
  }
}
