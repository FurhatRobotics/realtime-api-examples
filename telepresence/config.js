import { EventBus } from './modules/EventBus.js';
import { MediaPipeManager } from './modules/MediaPipe.js';
import { RobotCameraManager } from './modules/RobotCamera.js';
import { SendAudioManager } from './modules/SendAudioManager.js';
import { ReceiveAudioManager } from './modules/ReceiveAudioManager.js';


export class UserHeadPoseHist {
    constructor() {
        this.reset(0, 0, 0);
    }

    add(yaw, pitch, roll) {
        this.yaw.push(yaw);
        this.pitch.push(pitch);
        this.roll.push(roll);
        if (this.yaw.length > 50) {
            this.yaw.shift();
            this.pitch.shift();
            this.roll.shift();
        }
    }

    reset(yaw, pitch, roll) {
        this.yaw = Array.from({ length: 50 }, () => yaw);
        this.pitch = Array.from({ length: 50 }, () => pitch);
        this.roll = Array.from({ length: 50 }, () => roll);
    }

    meanYaw() {
        return this.yaw.reduce((a, b) => a + b) / this.yaw.length;
    }

    meanPitch() {
        return this.pitch.reduce((a, b) => a + b) / this.pitch.length;
    }

    meanRoll() {
        return this.roll.reduce((a, b) => a + b) / this.roll.length;
    }

}

export const CONFIG = {
    wsapi: {
        port: 9000,
        events: "/v1/events",
        sendAudio: "/v1/audio/send",
        camera: "/v1/camera"
    },
    audio: {
        sampleRate: 16000,
        vadThreshold: 0.02,
        bufferSize: 160
    },
    ux: {
        controlWidth: 340
    },
    eventThrottlers: {
        "action.attend.headpose": 100,
        "action.face.params": 20
    },
    face: {
        paramAmplification: 1.0
    },
    state: {
        userSpeaking: false,
        userHeadpose: {yaw: 0, pitch: 0, roll: 0},
        userHeadposeHist: new UserHeadPoseHist(),
        vadEnergy: 0
    },
    eventBus: new EventBus(),
    sendAudioManager: new SendAudioManager(),
    receiveAudioManager: new ReceiveAudioManager(),
    mediaPipeManager: new MediaPipeManager(),
    robotCameraManager: new RobotCameraManager()
};

export function getWebSocketUrl(path, port) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = document.getElementById('ipInput').value;
    return `${protocol}://${host}:${port}${path}`;
}

export function getAuthKey() {
    return document.getElementById('authKeyInput').value;
}
