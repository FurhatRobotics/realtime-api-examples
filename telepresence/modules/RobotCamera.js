import { CONFIG, getWebSocketUrl } from '../config.js';

export class RobotCameraManager {
    constructor() {
        this.currentUsers = [];
        this.robotcamContainer = document.getElementById("robotcam_container");
        this.robotcam = document.getElementById("robotcam");
        this.robotcamOverlay = document.getElementById("robotcam_overlay");
        this.robotcamOverlayCtx = this.robotcamOverlay.getContext("2d");
        this.controls = document.getElementById("controls");
    }

    resizeRobotcam() {
        const aspectRatio = 640.0 / 480.0;
        const maxHeight = window.innerHeight;
        const maxWidth = window.innerWidth - CONFIG.ux.controlWidth;
        const containerAspectRatio = maxWidth / maxHeight;

        let camWidth, camHeight;
        if (containerAspectRatio > aspectRatio) {
            // Height is the limiting factor
            camHeight = maxHeight - 5;
            camWidth = Math.floor(aspectRatio * maxHeight) - 5;
        } else {
            // Width is the limiting factor
            camWidth = maxWidth - 5;
            camHeight = Math.floor(maxWidth / aspectRatio) - 5;
        }
        this.robotcam.style.width = camWidth + "px";
        this.robotcam.style.height = camHeight + "px";

        this.robotcamOverlay.width = camWidth;
        this.robotcamOverlay.height = camHeight;
        
        this.robotcamOverlay.style.width = this.robotcam.style.width;
        this.robotcamOverlay.style.height = this.robotcam.style.height;
        
        this.robotcam.style.left = maxWidth / 2 - this.robotcam.clientWidth / 2 + "px";
        this.robotcam.style.top = maxHeight / 2 - this.robotcam.clientHeight / 2 + "px";
        this.robotcamOverlay.style.left = this.robotcam.style.left;
        this.robotcamOverlay.style.top = this.robotcam.style.top;

        this.robotcamOverlayCtx = this.robotcamOverlay.getContext("2d");
    }

    userRect(user) {
        if (!user || !user.camera) {
            return { x: 0, y: 0, w: 0, h: 0 };
        }
        const cameraW = 640 * (this.robotcamOverlay.height / 480)
        const offsetX = (this.robotcamOverlay.width - cameraW) / 2
        const x = ((640-user.camera.x-user.camera.w) / 640) * cameraW + offsetX;
        const y = (user.camera.y / 480) * this.robotcamOverlay.height;
        const w = (user.camera.w / 640) * cameraW;
        const h = (user.camera.h / 480) * this.robotcamOverlay.height;
        return { x, y, w, h }
    }      
      
    drawUsers() {
        this.robotcamOverlayCtx.clearRect(0, 0, this.robotcamOverlay.width, this.robotcamOverlay.height);
        for (const user of this.currentUsers) {
            const { x, y, w, h } = this.userRect(user);
            if (user.attended) {
                this.robotcamOverlayCtx.strokeStyle = 'purple';
            } else {
                this.robotcamOverlayCtx.strokeStyle = 'orange';
            }
            this.robotcamOverlayCtx.lineWidth = 4;
            this.robotcamOverlayCtx.strokeRect(x, y, w, h);
        }
    }      

    setAttendClosest(enabled) {
        if (enabled) {
            this.attendUser("closest")
        }
    }

    clearAttendClosestCheckbox() {
        if (CONFIG.attendClosestCheckbox) {
            CONFIG.attendClosestCheckbox.checked = false;
        }
    }

    updateUsers(users) {
        this.currentUsers = users;
        const closeUsers = users.filter(user => user.distance < 1.5);
        closeUsers.sort((a, b) => a.x - b.x);
        this.drawUsers();
    }

    attendUser(userId) {
        CONFIG.state.userHeadposeHist.reset(CONFIG.state.userHeadpose.yaw, CONFIG.state.userHeadpose.pitch, CONFIG.state.userHeadpose.roll);
        
        // Clear the attend closest checkbox when manually attending users
        if (userId !== "closest") {
            this.clearAttendClosestCheckbox();
        }
        
        if (userId == "nobody") {
            CONFIG.eventBus.send("request.attend.location", { x: 0, y: 0, z: 1 });
        } else {
            CONFIG.eventBus.send("request.attend.user", { user_id: userId });
        }
    }

    handleCameraFrame(data) {
        const imageUrl = `data:image/jpeg;base64,${data}`;
        this.robotcam.src = imageUrl;
    }

    handleOverlayClick(event) {
        const rect = this.robotcamOverlay.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.robotcamOverlay.width / rect.width);
        const y = (event.clientY - rect.top) * (this.robotcamOverlay.height / rect.height);

        for (const user of this.currentUsers) {
            const { x: userX, y: userY, w: userW, h: userH } = this.userRect(user);
            if (x > userX && x < userX + userW && y > userY && y < userY + userH) {
                this.attendUser(user.id);
                return;
            }
        }
        this.attendUser("nobody");
    }

    setupEventHandlers() {
        this.robotcamOverlay.addEventListener("click", (event) => this.handleOverlayClick(event));
        window.addEventListener('resize', () => this.resizeRobotcam());
        CONFIG.eventBus.on('response.users.data', (event) => this.updateUsers(event.users));
        CONFIG.eventBus.on('response.camera.data', (event) => this.handleCameraFrame(event.image));
    }

    init() {
        this.setupEventHandlers();
        this.resizeRobotcam();
    }

}

