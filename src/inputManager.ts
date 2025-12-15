import { Camera } from "./camera";

export class InputManager {
    private camera: Camera = new Camera();
    private sensitivityX: number = 0.008;
    private sensitivityY: number = 0.004;

    private moveForward: number = 0;
    private mouseX: number = 0;
    private mouseY: number = 0;
    private lookButtonDown: boolean = false;

    private lookButton = 0;
    private forwardButton = 4;
    private backwardButton = 2;

    private canvas: HTMLCanvasElement;

    constructor() {
        this.canvas = document.getElementById("canvas") as HTMLCanvasElement;

        this.canvas.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            if (e.button === this.lookButton) {
                this.lookButtonDown = true;
            } else if (e.button === this.backwardButton) {
                if (e.altKey) {
                    const canvasContainer = document.getElementById("canvas-container");
                    if (canvasContainer) {
                        canvasContainer.classList.toggle("canvas-aspect");
                        canvasContainer.classList.toggle("canvas-max");
                    }
                } else {
                    this.moveForward = -1;
                }
            } else if (e.button === this.forwardButton) {
                this.moveForward = 1;
            }
        });

        this.canvas.addEventListener("mouseup", (e) => {
            e.preventDefault();
            if (e.button === this.lookButton) {
                this.lookButtonDown = false;
            } else if (e.button === this.backwardButton || e.button === this.forwardButton) {
                this.moveForward = 0;
            }
        });

        this.canvas.addEventListener("mouseleave", () => {
            this.lookButtonDown = false;
            this.moveForward = 0;
        });

        this.canvas.addEventListener("mousemove", (e) => {
            if (this.lookButtonDown) {
                this.camera.onMouse(e.movementX * -this.sensitivityX, e.movementY * -this.sensitivityY);
            }
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
        this.canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.camera.onScroll(e.deltaY);
        });
    }

    private screenToWorld(mouseX: number, mouseY: number): [number, number, number] {
        const ndcX = (mouseX / this.canvas.width) * 2 - 1;
        const ndcY = 1 - (mouseY / this.canvas.height) * 2;
        const cam = this.camera;
        const fov = cam.fov;
        const aspect = this.canvas.width / this.canvas.height;
        const tanFov = Math.tan(fov / 2);
        const rayCam = [
            ndcX * aspect * tanFov,
            ndcY * tanFov,
            1
        ];
        const fx = cam.forward[0], fy = cam.forward[1], fz = cam.forward[2];
        const rx = cam.right[0], ry = cam.right[1], rz = cam.right[2];
        const ux = cam.up[0], uy = cam.up[1], uz = cam.up[2];
        const dir: [number, number, number] = [
            rayCam[0] * rx + rayCam[1] * ux + rayCam[2] * fx,
            rayCam[0] * ry + rayCam[1] * uy + rayCam[2] * fy,
            rayCam[0] * rz + rayCam[1] * uz + rayCam[2] * fz
        ];
        const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
        dir[0] /= len; dir[1] /= len; dir[2] /= len;
        return dir;
    }

    public tick(deltaTime: number) {
        if (this.moveForward !== 0) {
            const dir = this.lookButtonDown ? this.camera.forward : this.screenToWorld(this.mouseX, this.mouseY);
            this.camera.move(deltaTime, dir[0] * this.moveForward, dir[1] * this.moveForward, dir[2] * this.moveForward);
        }
    }

    getCamera(): Camera {
        return this.camera;
    }
}
