import { Camera } from "./camera";

export class InputManager {
    private keyMap: { [key: string]: number } = {};
    private camera: Camera = new Camera();
    private cameraFocused: boolean = false;
    private pointerLockEnabled: boolean = false;
    private sensitivity: number = 0.002;

    private canvas: HTMLCanvasElement;

    constructor() {
        this.canvas = document.getElementById("canvas") as HTMLCanvasElement;

        this.canvas.addEventListener("keydown", async (e) => {
            this.keyMap[e.code] = 1;
            if (e.repeat) return;
            if (e.code == "KeyE") {
                if (!document.pointerLockElement) {
                    this.pointerLockEnabled = true;
                    await this.canvas.requestPointerLock()
                } else {
                    this.pointerLockEnabled = false;
                    document.exitPointerLock();
                }
            } else if (e.code == "KeyR") {
                this.camera.position = [0, 0, 0];
            } else if (e.code == "Backquote") {
                const canvasContainer = document.getElementById("canvas-container");
                if (canvasContainer) {
                    canvasContainer.classList.toggle("canvas-aspect");
                    canvasContainer.classList.toggle("canvas-max");
                }
            }
        });
        this.canvas.addEventListener("keyup", (e) => {
            this.keyMap[e.code] = 0;
        });
        this.canvas.addEventListener("focusin", () => {
            if (this.pointerLockEnabled) {
                this.canvas.requestPointerLock();
            }
        });
        this.canvas.addEventListener("focusout", () => {
            this.pointerLockEnabled = document.pointerLockElement === this.canvas;
            document.exitPointerLock();
        });
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === this.canvas) {
                this.cameraFocused = true;
            } else {
                this.cameraFocused = false;
            }
        }, false);
        document.addEventListener("mousemove", (e) => {
            if (this.cameraFocused) {
                this.camera.onMouse(e.movementX * -this.sensitivity, e.movementY * -this.sensitivity);
            }
        }, false);
        document.addEventListener("wheel", (e) => {
            e.preventDefault();
            if (this.cameraFocused) {
                this.camera.onScroll(e.deltaY);
            }
        }, false);
    }

    public isPressed(key: string): number {
        return this.keyMap[key] || 0;
    }

    public tick(deltaTime: number) {
        const movementX = this.isPressed("KeyD") - this.isPressed("KeyA");
        const movementY = this.isPressed("Space") - this.isPressed("ShiftLeft");
        const movementZ = this.isPressed("KeyW") - this.isPressed("KeyS");
        this.camera.onInput(deltaTime, movementX, movementY, movementZ);
    }

    getCamera(): Camera {
        return this.camera;
    }
}
