import { Camera } from "./camera";

export class InputManager {
    private camera: Camera = new Camera();
    private sensitivityX: number = 0.008;
    private sensitivityY: number = 0.004;

    private lookButton = 0;
    private moveButton = 2;

    private lookButtonDown: boolean = false;
    public inputLocked = false;
    private keyState: { [key: string]: boolean } = {};
    private lastKey: string = "";

    private canvas: HTMLCanvasElement;

    private setInputLock(value: boolean) {
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
                e.preventDefault();
                if (!e.altKey) e.stopImmediatePropagation();
            }
            if (this.inputLocked) {
                this.keyState[e.code] = true;
            }
        });
        window.addEventListener("keyup", (e) => {
            this.keyState[e.code] = false;
            if (this.inputLocked) {
                e.preventDefault();
                if (!e.altKey) e.stopImmediatePropagation();
            }
            if (e.code === "AltLeft" && this.lastKey === "AltLeft") {
                this.setInputLock(!this.inputLocked);
            }
        });
        this.canvas.addEventListener("dblclick", (e) => {
            if (e.button === this.lookButton) {
                this.setInputLock(true);
                e.preventDefault();
                this.canvas.requestPointerLock();
            }
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
        });
        window.addEventListener("mouseup", (e) => {
            if (e.button === this.lookButton) {
                this.lookButtonDown = false;
                e.preventDefault();
            }
        });
        this.canvas.addEventListener("mousedown", (e) => {
            if (e.button === this.lookButton) {
                this.lookButtonDown = true;
                e.preventDefault();
            }
        });
        window.addEventListener("mousemove", (e) => {
            if (this.lookButtonDown || this.inputLocked) {
                this.camera.onMouse(e.movementX * -this.sensitivityX, e.movementY * -this.sensitivityY);
            }
        });
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.camera.onScroll(e.deltaY);
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
