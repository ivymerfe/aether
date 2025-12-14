export class Camera {
    yaw: number;
    pitch: number;
    position: [number, number, number];
    speed: number;
    forward: [number, number, number];
    right: [number, number, number];
    up: [number, number, number];

    constructor(
        position: [number, number, number] = [0, 0, 0],
        yaw: number = 0,
        pitch: number = 0,
        speed: number = 1
    ) {
        this.position = position;
        this.yaw = yaw;
        this.pitch = pitch;
        this.speed = speed;
        this.forward = [0, 0, 1];
        this.right = [1, 0, 0];
        this.up = [0, 1, 0];
        this.updateVectors();
    }

    private updateVectors() {
        // Calculate forward vector
        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);

        this.forward = [
            cosPitch * -sinYaw,
            sinPitch,
            cosPitch * cosYaw
        ];

        // Right vector
        this.right = [
            Math.cos(this.yaw),
            0,
            Math.sin(this.yaw)
        ];

        // Up vector (cross product of right and forward)
        this.up = [
            this.forward[1] * this.right[2] - this.forward[2] * this.right[1],
            this.forward[2] * this.right[0] - this.forward[0] * this.right[2],
            this.forward[0] * this.right[1] - this.forward[1] * this.right[0]
        ];
    }

    onMouse(deltaYaw: number, deltaPitch: number) {
        this.yaw += deltaYaw;
        this.pitch += deltaPitch;
        // Clamp pitch to avoid gimbal lock
        const maxPitch = Math.PI / 2 - 0.01;
        if (this.pitch > maxPitch) this.pitch = maxPitch;
        if (this.pitch < -maxPitch) this.pitch = -maxPitch;
        this.updateVectors();
    }

    onScroll(delta: number) {
        if (delta < 0) {
            this.speed *= 1.2;
        } else if (delta > 0) {
            this.speed /= 1.2;
        }
    }

    /**
     * onInput receives x, y, z movement input.
     * x: right/left, y: up/down, z: forward/backward
     * Applies yaw to xz, multiplies by speed, and moves position.
     */
    onInput(deltaTime: number, x: number, y: number, z: number) {
        const yawCos = Math.cos(this.yaw);
        const yawSin = Math.sin(this.yaw);

        const move = [
            x * yawCos - z * yawSin,
            y,
            x * yawSin + z * yawCos
        ];

        // Apply speed and update position
        this.position = [
            this.position[0] + move[0] * this.speed * deltaTime,
            this.position[1] + move[1] * this.speed * deltaTime,
            this.position[2] + move[2] * this.speed * deltaTime
        ];
    }
}